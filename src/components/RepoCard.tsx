import React from 'react';
import { Github, Lock, Globe, ArrowRight, Clock, Code } from 'lucide-react';
import { Repository } from '../types';
import { motion } from 'motion/react';

interface RepoCardProps {
  repo: Repository;
  onAnalyze: (repo: Repository) => void;
  isAnalyzing?: boolean;
}

export const RepoCard: React.FC<RepoCardProps> = ({ repo, onAnalyze, isAnalyzing }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-lg hover:border-black/10 transition-all group"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          {repo.private ? (
            <Lock size={14} className="text-amber-500" />
          ) : (
            <Globe size={14} className="text-blue-500" />
          )}
          <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
            {repo.language || 'Unknown'}
          </span>
        </div>
        <Github size={18} className="text-gray-300 group-hover:text-black transition-colors" />
      </div>

      <h3 className="text-lg font-bold text-gray-900 mb-2 truncate" title={repo.full_name}>
        {repo.name}
      </h3>
      
      <p className="text-sm text-gray-500 line-clamp-2 mb-6 h-10">
        {repo.description || 'No description provided.'}
      </p>

      <div className="flex items-center justify-between pt-4 border-t border-gray-50">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Clock size={12} />
          <span>{new Date(repo.updated_at).toLocaleDateString()}</span>
        </div>
        
        <button 
          onClick={() => onAnalyze(repo)}
          disabled={isAnalyzing}
          className="flex items-center gap-2 text-sm font-bold text-black group-hover:translate-x-1 transition-transform disabled:opacity-50"
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze Architecture'}
          <ArrowRight size={16} />
        </button>
      </div>
    </motion.div>
  );
};
