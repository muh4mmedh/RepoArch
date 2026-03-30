import React from 'react';
import { Github, Database, Sparkles, Shield, Zap } from 'lucide-react';
import { auth } from '../firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { motion } from 'motion/react';

export const Login: React.FC = () => {
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 overflow-hidden relative">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-2xl w-full text-center z-10"
      >
        <div className="bg-white/10 backdrop-blur-xl border border-white/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-10 shadow-2xl">
          <Database size={40} className="text-white" />
        </div>

        <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8 bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent">
          REPOARCH AI
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-400 font-medium mb-12 max-w-lg mx-auto leading-relaxed">
          Transform your code into clear, professional system architecture documentation with AI.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
            <Sparkles className="text-blue-400 mb-4 mx-auto" size={24} />
            <h3 className="font-bold mb-2">AI Analysis</h3>
            <p className="text-xs text-gray-500">Deep code understanding using Gemini Pro</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
            <Shield className="text-purple-400 mb-4 mx-auto" size={24} />
            <h3 className="font-bold mb-2">Private Access</h3>
            <p className="text-xs text-gray-500">Securely link your private repositories</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
            <Zap className="text-amber-400 mb-4 mx-auto" size={24} />
            <h3 className="font-bold mb-2">Instant Docs</h3>
            <p className="text-xs text-gray-500">Generate diagrams and flowcharts in seconds</p>
          </div>
        </div>

        <button 
          onClick={handleLogin}
          className="group relative inline-flex items-center gap-3 bg-white text-black px-10 py-5 rounded-2xl font-black text-lg hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)]"
        >
          Get Started with Google
          <motion.div 
            animate={{ x: [0, 5, 0] }} 
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            <Sparkles size={20} />
          </motion.div>
        </button>

        <p className="mt-10 text-gray-600 text-sm font-medium">
          Securely powered by Firebase & Gemini AI
        </p>
      </motion.div>
    </div>
  );
};
