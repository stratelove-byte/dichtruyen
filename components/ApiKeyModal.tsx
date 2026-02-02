import React, { useState, useEffect } from 'react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (claudeKey: string, claudeModelId: string, geminiKey: string, geminiProKey: string) => void;
  currentClaudeKey: string;
  currentClaudeModelId: string;
  currentGeminiKey: string;
  currentGeminiProKey: string;
}

const CLAUDE_MODELS = [
  { 
    id: 'claude-sonnet-4-5-20250929', 
    name: 'Claude 4.5 Sonnet (Sept 2025)', 
    desc: 'Latest Experimental Build - Maximum Performance' 
  },
  { 
    id: 'claude-3-5-sonnet-20241022', 
    name: 'Claude 3.5 Sonnet (New - Oct 2024)', 
    desc: 'Best performance - Try this first' 
  },
  { 
    id: 'claude-3-5-haiku-20241022', 
    name: 'Claude 3.5 Haiku (New - Oct 2024)', 
    desc: 'Fastest & Smartest - Best for bulk translation' 
  },
  { 
    id: 'claude-3-5-sonnet-20240620', 
    name: 'Claude 3.5 Sonnet (Stable - June 2024)', 
    desc: 'Standard version - Most compatible 3.5 model' 
  },
  { 
    id: 'claude-3-5-sonnet-latest', 
    name: 'Claude 3.5 Sonnet (Auto Latest)', 
    desc: 'Automatically uses the newest available version' 
  },
  { 
    id: 'claude-3-opus-20240229', 
    name: 'Claude 3 Opus', 
    desc: 'Legacy Flagship - Try if 3.5 models return 404' 
  },
  { 
    id: 'claude-3-sonnet-20240229', 
    name: 'Claude 3 Sonnet (Legacy)', 
    desc: 'Legacy Standard - Highly compatible' 
  },
  { 
    id: 'claude-3-haiku-20240307', 
    name: 'Claude 3 Haiku (Legacy)', 
    desc: 'Fast & Compact - Use if others fail' 
  }
];

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  currentClaudeKey, 
  currentClaudeModelId,
  currentGeminiKey,
  currentGeminiProKey
}) => {
  const [claudeKey, setClaudeKey] = useState(currentClaudeKey);
  const [claudeModelId, setClaudeModelId] = useState(currentClaudeModelId);
  const [geminiKey, setGeminiKey] = useState(currentGeminiKey);
  const [geminiProKey, setGeminiProKey] = useState(currentGeminiProKey);
  const [activeTab, setActiveTab] = useState<'claude' | 'gemini'>('claude');

  useEffect(() => {
    setClaudeKey(currentClaudeKey);
    setClaudeModelId(currentClaudeModelId || 'claude-sonnet-4-5-20250929');
    setGeminiKey(currentGeminiKey);
    setGeminiProKey(currentGeminiProKey);
  }, [currentClaudeKey, currentClaudeModelId, currentGeminiKey, currentGeminiProKey, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(claudeKey, claudeModelId, geminiKey, geminiProKey);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-slate-900 rounded-2xl border border-white/10 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
        
        <div className="p-6 pb-4">
          <h3 className="text-xl font-bold text-white mb-2">API Settings</h3>
          <p className="text-slate-400 text-sm">
            Configure your API keys to avoid quota limits.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 px-6">
          <button
            onClick={() => setActiveTab('claude')}
            className={`pb-3 text-sm font-medium transition-colors relative ${
              activeTab === 'claude' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Claude (Anthropic)
            {activeTab === 'claude' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('gemini')}
            className={`pb-3 text-sm font-medium transition-colors relative ml-6 ${
              activeTab === 'gemini' ? 'text-pink-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Gemini (Google)
            {activeTab === 'gemini' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-500 rounded-t-full" />
            )}
          </button>
        </div>

        <div className="p-6 space-y-4">
          {activeTab === 'claude' ? (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Claude API Key
                </label>
                <input
                  type="password"
                  value={claudeKey}
                  onChange={(e) => setClaudeKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Model Version
                </label>
                <div className="relative">
                  <select
                    value={claudeModelId}
                    onChange={(e) => setClaudeModelId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  >
                    {CLAUDE_MODELS.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  {CLAUDE_MODELS.find(m => m.id === claudeModelId)?.desc}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in">
               <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Gemini API Key (Standard / Flash)
                </label>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIza... (Default used for OCR)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Used for OCR (Text Extraction) and basic translations.
                </p>
              </div>

              <div className="pt-2 border-t border-white/5">
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Gemini 3.0 Pro API Key <span className="text-xs text-slate-500 font-normal ml-1">(Optional, for High Quality)</span>
                </label>
                <input
                  type="password"
                  value={geminiProKey}
                  onChange={(e) => setGeminiProKey(e.target.value)}
                  placeholder="AIza... (Specific key for Pro model)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                />
                <p className="mt-2 text-xs text-slate-500">
                  If provided, this key is used exclusively for the <strong>Gemini 3.0 Pro</strong> model. Use this to separate your quotas.
                  <br/>
                  Get keys at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:underline">Google AI Studio</a>.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 pt-2 flex justify-end gap-3 border-t border-white/5 bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg transition-colors text-sm font-medium shadow-lg shadow-indigo-900/20"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};