import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { RepositoryAnalysis } from '../types';
import { Download, Share2, Calendar, Link as LinkIcon, ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { Mermaid } from './Mermaid';

interface AnalysisViewProps {
  analysis: RepositoryAnalysis;
  onBack: () => void;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({ analysis, onBack }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto py-8 px-6"
    >
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-black mb-8 transition-colors"
      >
        <ChevronLeft size={16} />
        Back to Repositories
      </button>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={14} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Analyzed on {new Date(analysis.createdAt).toLocaleDateString()}
            </span>
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-4">
            {analysis.repoName}
          </h1>
          <a 
            href={analysis.repoUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
          >
            <LinkIcon size={14} />
            {analysis.repoFullName}
          </a>
        </div>

        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors">
            <Download size={16} />
            Export HTML
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors">
            <Share2 size={16} />
            Share
          </button>
        </div>
      </div>

      <div className="prose prose-slate max-w-none bg-white border border-gray-100 rounded-3xl p-8 md:p-12 shadow-sm">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-mermaid/.exec(className || '');
              return !inline && match ? (
                <Mermaid chart={String(children).replace(/\n$/, '')} />
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {analysis.analysisMarkdown}
        </ReactMarkdown>
      </div>
    </motion.div>
  );
};
