import React from 'react';
import { Github, LogOut, Layout, Database, Settings } from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

interface NavbarProps {
  user: any;
  onConnectGithub: () => void;
  onOpenSettings: () => void;
  isGithubConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onConnectGithub, onOpenSettings, isGithubConnected }) => {
  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <div className="bg-black text-white p-2 rounded-lg">
          <Database size={20} />
        </div>
        <span className="font-bold text-xl tracking-tight">RepoArch AI</span>
      </div>
      
      <div className="flex items-center gap-4">
        {user && (
          <>
            {!isGithubConnected ? (
              <button 
                onClick={onConnectGithub}
                className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                <Github size={16} />
                Connect GitHub
              </button>
            ) : (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-full text-xs font-medium border border-green-100">
                <Github size={14} />
                GitHub Linked
              </div>
            )}
            
            <div className="h-8 w-px bg-gray-200 mx-2" />
            
            <div className="flex items-center gap-3">
              <button 
                onClick={onOpenSettings}
                className="p-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded-full transition-all"
                title="AI Settings"
              >
                <Settings size={18} />
              </button>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-900">{user.displayName}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
              <button 
                onClick={() => signOut(auth)}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                title="Sign Out"
              >
                <LogOut size={18} />
              </button>
            </div>
          </>
        )}
      </div>
    </nav>
  );
};
