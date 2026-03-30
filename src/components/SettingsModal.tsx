import React, { useState } from 'react';
import { X, Key, Settings, Zap, Shield, Info } from 'lucide-react';
import { AISettings, AIProvider } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AISettings;
  onSave: (settings: AISettings) => void;
}

const DEFAULT_SETTINGS: AISettings = {
  provider: 'gemini',
  model: 'gemini-3.1-pro-preview',
  autoSelectModel: true,
  temperature: 0.7,
  maxTokens: 2048,
  rateLimit: 10
};

const PROVIDER_MODELS: Record<AIProvider, string[]> = {
  gemini: ['gemini-3.1-pro-preview', 'gemini-3.1-flash-preview', 'gemini-3.1-flash-lite-preview'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o1-preview'],
  anthropic: ['claude-3-5-sonnet-latest', 'claude-3-opus-latest', 'claude-3-haiku-latest']
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState<AISettings>(settings || DEFAULT_SETTINGS);

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white w-full max-w-xl rounded-[32px] overflow-hidden shadow-2xl relative z-10"
          >
            <div className="p-8 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-black text-white p-2 rounded-xl">
                  <Settings size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900">AI Configuration</h2>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Bring your own key & limits</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
              {/* Provider Selection */}
              <section>
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 block">AI Provider</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['gemini', 'openai', 'anthropic'] as AIProvider[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setLocalSettings({ 
                        ...localSettings, 
                        provider: p,
                        model: PROVIDER_MODELS[p][0]
                      })}
                      className={`py-3 px-4 rounded-2xl border-2 text-sm font-bold transition-all ${
                        localSettings.provider === p 
                          ? 'border-black bg-black text-white shadow-lg' 
                          : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'
                      }`}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </section>

              {/* Model Selection */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block">Model Selection</label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Auto-Select</span>
                    <button 
                      onClick={() => setLocalSettings({ ...localSettings, autoSelectModel: !localSettings.autoSelectModel })}
                      className={`w-10 h-5 rounded-full transition-colors relative ${localSettings.autoSelectModel ? 'bg-black' : 'bg-gray-200'}`}
                    >
                      <motion.div 
                        animate={{ x: localSettings.autoSelectModel ? 20 : 2 }}
                        className="absolute top-1 w-3 h-3 bg-white rounded-full"
                      />
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {!localSettings.autoSelectModel && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <select 
                        value={localSettings.model}
                        onChange={(e) => setLocalSettings({ ...localSettings, model: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-black/5 focus:border-black transition-all appearance-none"
                      >
                        {PROVIDER_MODELS[localSettings.provider].map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* API Keys */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block">API Keys</label>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                    <Shield size={10} />
                    <span>Encrypted Storage</span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                      type="password"
                      placeholder={`${localSettings.provider.toUpperCase()} API Key`}
                      value={
                        localSettings.provider === 'gemini' ? localSettings.geminiKey || '' :
                        localSettings.provider === 'openai' ? localSettings.openaiKey || '' :
                        localSettings.anthropicKey || ''
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (localSettings.provider === 'gemini') setLocalSettings({ ...localSettings, geminiKey: val });
                        else if (localSettings.provider === 'openai') setLocalSettings({ ...localSettings, openaiKey: val });
                        else setLocalSettings({ ...localSettings, anthropicKey: val });
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-4 focus:ring-black/5 focus:border-black transition-all"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 flex items-center gap-1">
                    <Info size={10} />
                    Leave empty to use the app's shared key (limited usage).
                  </p>
                </div>
              </section>

              {/* Parameters */}
              <div className="grid grid-cols-2 gap-6">
                <section>
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 block">Temperature ({localSettings.temperature})</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.1"
                    value={localSettings.temperature}
                    onChange={(e) => setLocalSettings({ ...localSettings, temperature: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-black"
                  />
                  <div className="flex justify-between text-[10px] font-bold text-gray-300 mt-2">
                    <span>PRECISE</span>
                    <span>CREATIVE</span>
                  </div>
                </section>

                <section>
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 block">Rate Limit (RPM)</label>
                  <div className="relative">
                    <Zap className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                      type="number"
                      value={localSettings.rateLimit}
                      onChange={(e) => setLocalSettings({ ...localSettings, rateLimit: parseInt(e.target.value) || 1 })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-4 focus:ring-black/5 focus:border-black transition-all"
                    />
                  </div>
                </section>
              </div>
            </div>

            <div className="p-8 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button 
                onClick={onClose}
                className="flex-1 px-6 py-4 rounded-2xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="flex-1 px-6 py-4 bg-black text-white rounded-2xl text-sm font-bold hover:bg-gray-800 transition-all shadow-xl"
              >
                Save Configuration
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
