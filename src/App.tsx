import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { UserProfile, Repository, RepositoryAnalysis, ChatMessage } from './types';
import { githubService } from './services/github';
import { geminiService } from './services/gemini';
import { Navbar } from './components/Navbar';
import { RepoCard } from './components/RepoCard';
import { AnalysisView } from './components/AnalysisView';
import { ChatSidebar } from './components/ChatSidebar';
import { Login } from './components/Login';
import { SettingsModal } from './components/SettingsModal';
import { Loader2, Search, Filter, History, Github, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AISettings } from './types';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [analyzingRepo, setAnalyzingRepo] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<string>('');
  const [selectedAnalysis, setSelectedAnalysis] = useState<RepositoryAnalysis | null>(null);
  const [pastAnalyses, setPastAnalyses] = useState<RepositoryAnalysis[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatTyping, setIsChatTyping] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setProfile(userDoc.data() as UserProfile);
        } else {
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName,
            email: firebaseUser.email,
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
        setRepos([]);
        setPastAnalyses([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch past analyses
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'analyses'), where('uid', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPastAnalyses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RepositoryAnalysis)));
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch chat messages when analysis is selected
  useEffect(() => {
    if (!selectedAnalysis) {
      setChatMessages([]);
      return;
    }
    const q = query(collection(db, 'analyses', selectedAnalysis.id, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChatMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage)));
    });
    return () => unsubscribe();
  }, [selectedAnalysis]);

  useEffect(() => {
    if (profile?.githubAccessToken) {
      loadRepos();
    }
  }, [profile?.githubAccessToken]);

  const loadRepos = async () => {
    if (!profile?.githubAccessToken) return;
    setLoadingRepos(true);
    try {
      const fetchedRepos = await githubService.fetchRepos(profile.githubAccessToken);
      setRepos(fetchedRepos);
    } catch (error) {
      console.error('Error loading repos:', error);
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleConnectGithub = async () => {
    try {
      const url = await githubService.getAuthUrl();
      const authWindow = window.open(url, 'github_oauth', 'width=600,height=700');
      
      const handleMessage = async (event: MessageEvent) => {
        if (event.data?.type === 'GITHUB_AUTH_SUCCESS') {
          const { token } = event.data;
          if (user) {
            await setDoc(doc(db, 'users', user.uid), { githubAccessToken: token }, { merge: true });
            setProfile(prev => prev ? { ...prev, githubAccessToken: token } : null);
          }
          window.removeEventListener('message', handleMessage);
        }
      };
      
      window.addEventListener('message', handleMessage);
    } catch (error) {
      console.error('GitHub connect error:', error);
    }
  };

  const handleSaveSettings = async (newSettings: AISettings) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { aiSettings: newSettings }, { merge: true });
      setProfile(prev => prev ? { ...prev, aiSettings: newSettings } : null);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const handleAnalyze = async (repo: Repository) => {
    if (!profile?.githubAccessToken) return;
    setAnalyzingRepo(repo.full_name);
    
    try {
      // 1. Fetch structure
      const structure = await githubService.fetchRepoStructure(profile.githubAccessToken, repo.full_name);
      
      // 2. Fetch key files (README, package.json, main files)
      const keyFilePaths = structure.tree
        .filter((f: any) => f.type === 'blob')
        .map((f: any) => f.path)
        .filter((p: string) => 
          p.toLowerCase().includes('readme') || 
          p.includes('package.json') || 
          p.includes('src/main') || 
          p.includes('src/App') ||
          p.includes('server.ts') ||
          p.includes('index.js')
        )
        .slice(0, 10); // Limit to 10 key files for context

      const keyFiles = await Promise.all(keyFilePaths.map(async (path: string) => {
        const content = await githubService.fetchFileContent(profile.githubAccessToken!, repo.full_name, path);
        return { path, content: content || '' };
      }));

      // 3. AI Analysis
      const analysisMarkdown = await geminiService.analyzeRepository(
        user.uid, 
        repo.name, 
        structure, 
        keyFiles, 
        profile?.aiSettings,
        (msg) => setAnalysisProgress(msg)
      );

      // 4. Store in Firestore
      const analysisData = {
        uid: user.uid,
        repoName: repo.name,
        repoFullName: repo.full_name,
        repoUrl: repo.html_url,
        analysisMarkdown,
        summary: analysisMarkdown.substring(0, 200) + '...',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'analyses'), analysisData);
      setSelectedAnalysis({ id: docRef.id, ...analysisData });
      setIsChatOpen(true);
    } catch (error) {
      console.error('Analysis error:', error);
      alert('Failed to analyze repository. Please check permissions and try again.');
    } finally {
      setAnalyzingRepo(null);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedAnalysis || !user) return;
    
    const userMessage = {
      analysisId: selectedAnalysis.id,
      uid: user.uid,
      role: 'user' as const,
      content,
      createdAt: new Date().toISOString()
    };

    await addDoc(collection(db, 'analyses', selectedAnalysis.id, 'messages'), userMessage);
    
    setIsChatTyping(true);
    try {
      const aiResponse = await geminiService.chatAboutAnalysis(
        user.uid,
        selectedAnalysis.analysisMarkdown,
        chatMessages.map(m => ({ role: m.role, content: m.content })),
        content,
        profile?.aiSettings
      );

      const assistantMessage = {
        analysisId: selectedAnalysis.id,
        uid: user.uid,
        role: 'assistant' as const,
        content: aiResponse,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'analyses', selectedAnalysis.id, 'messages'), assistantMessage);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsChatTyping(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-black" size={40} />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const filteredRepos = repos.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F9F9F9] text-gray-900 font-sans selection:bg-black selection:text-white">
      <Navbar 
        user={user} 
        onConnectGithub={handleConnectGithub} 
        onOpenSettings={() => setIsSettingsOpen(true)}
        isGithubConnected={!!profile?.githubAccessToken} 
      />

      <main className="max-w-7xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {selectedAnalysis ? (
            <AnalysisView 
              key="analysis"
              analysis={selectedAnalysis} 
              onBack={() => setSelectedAnalysis(null)} 
            />
          ) : (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Header Section */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
                <div className="max-w-2xl">
                  <h2 className="text-5xl font-black tracking-tight text-gray-900 mb-6">
                    YOUR REPOSITORIES
                  </h2>
                  <p className="text-lg text-gray-500 font-medium leading-relaxed">
                    Select a repository to generate a detailed system architecture documentation. 
                    We'll analyze the code structure, key components, and data flow.
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Search repositories..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-white border border-gray-200 rounded-2xl py-3 pl-12 pr-6 text-sm focus:outline-none focus:ring-4 focus:ring-black/5 focus:border-black transition-all w-64"
                    />
                  </div>
                  <button className="p-3 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 transition-colors">
                    <Filter size={20} className="text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Past Analyses */}
              {pastAnalyses.length > 0 && (
                <section className="mb-20">
                  <div className="flex items-center gap-3 mb-8">
                    <History size={20} className="text-gray-400" />
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Recent Analyses</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pastAnalyses.map(analysis => (
                      <motion.div 
                        key={analysis.id}
                        whileHover={{ y: -5 }}
                        onClick={() => setSelectedAnalysis(analysis)}
                        className="bg-white border border-gray-200 rounded-3xl p-6 cursor-pointer hover:shadow-xl hover:border-black/10 transition-all"
                      >
                        <div className="flex items-center gap-2 mb-4">
                          <div className="bg-blue-50 text-blue-600 p-2 rounded-xl">
                            <Database size={16} />
                          </div>
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                            {new Date(analysis.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="text-xl font-bold text-gray-900 mb-2">{analysis.repoName}</h4>
                        <p className="text-sm text-gray-500 line-clamp-2 mb-4">{analysis.summary}</p>
                        <div className="flex items-center gap-2 text-xs font-bold text-black group">
                          View Analysis
                          <motion.div animate={{ x: [0, 3, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                            →
                          </motion.div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

              {/* Repo Grid */}
              <section>
                <div className="flex items-center gap-3 mb-8">
                  <Github size={20} className="text-gray-400" />
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">GitHub Repositories</h3>
                </div>

                {!profile?.githubAccessToken ? (
                  <div className="bg-white border-2 border-dashed border-gray-200 rounded-[40px] p-20 text-center">
                    <div className="bg-gray-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8">
                      <Github size={40} className="text-gray-300" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">Connect GitHub to get started</h3>
                    <p className="text-gray-500 max-w-md mx-auto mb-10">
                      We need access to your repositories to analyze their architecture. 
                      Both public and private repositories are supported.
                    </p>
                    <button 
                      onClick={handleConnectGithub}
                      className="bg-black text-white px-10 py-5 rounded-2xl font-black text-lg hover:scale-105 transition-all shadow-2xl"
                    >
                      Connect GitHub Account
                    </button>
                  </div>
                ) : loadingRepos ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div key={i} className="bg-white border border-gray-100 rounded-3xl h-64 animate-pulse" />
                    ))}
                  </div>
                ) : filteredRepos.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRepos.map(repo => (
                      <RepoCard 
                        key={repo.id} 
                        repo={repo} 
                        onAnalyze={handleAnalyze} 
                        isAnalyzing={analyzingRepo === repo.full_name}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20">
                    <p className="text-gray-400 font-medium">No repositories found matching your search.</p>
                  </div>
                )}
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {analyzingRepo && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-10 left-10 bg-black text-white p-6 rounded-[32px] shadow-2xl z-[60] flex items-center gap-4 border border-white/10 backdrop-blur-xl"
        >
          <div className="bg-white/10 p-3 rounded-2xl">
            <Loader2 size={24} className="animate-spin" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Agent Task</p>
            <p className="text-sm font-medium">{analysisProgress || 'Starting analysis...'}</p>
          </div>
        </motion.div>
      )}

      {selectedAnalysis && (
        <ChatSidebar 
          messages={chatMessages} 
          onSendMessage={handleSendMessage} 
          isTyping={isChatTyping}
          isOpen={isChatOpen}
          onToggle={() => setIsChatOpen(!isChatOpen)}
        />
      )}

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={profile?.aiSettings || { 
          provider: 'gemini', 
          temperature: 0.7, 
          maxTokens: 2048, 
          rateLimit: 10,
          autoSelectModel: true
        }}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
