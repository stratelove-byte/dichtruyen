import React, { useState, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { LanguageSelector } from './components/LanguageSelector';
import { ResultView } from './components/ResultView';
import { ApiKeyModal } from './components/ApiKeyModal';
import { AppState, BatchItem, SourceLanguage, ModelProvider } from './types';
import { processFile } from './utils';
import { translateImageContent } from './services/geminiService';
import { translateImageContentWithClaude } from './services/claudeService';

const App: React.FC = () => {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [sourceLang, setSourceLang] = useState<SourceLanguage>(SourceLanguage.AUTO);
  const [modelProvider, setModelProvider] = useState<ModelProvider>(ModelProvider.CLAUDE);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // API Key and Model ID state
  const [claudeApiKey, setClaudeApiKey] = useState('');
  const [claudeModelId, setClaudeModelId] = useState('claude-sonnet-4-5-20250929');
  
  // Initialize with empty strings to force usage of process.env.API_KEY or prompt user
  const [geminiApiKey, setGeminiApiKey] = useState(''); 
  const [geminiProApiKey, setGeminiProApiKey] = useState(''); 
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load API keys and model preference from local storage on mount
  useEffect(() => {
    const storedClaudeKey = localStorage.getItem('lingua_claude_key');
    const storedClaudeModelId = localStorage.getItem('lingua_claude_model_id');
    const storedGeminiKey = localStorage.getItem('lingua_gemini_key');
    const storedGeminiProKey = localStorage.getItem('lingua_gemini_pro_key');
    
    if (storedClaudeKey) setClaudeApiKey(storedClaudeKey);
    if (storedClaudeModelId) setClaudeModelId(storedClaudeModelId);
    if (storedGeminiKey) setGeminiApiKey(storedGeminiKey);
    if (storedGeminiProKey) setGeminiProApiKey(storedGeminiProKey);
  }, []);

  const handleSaveSettings = (cKey: string, cModelId: string, gKey: string, gProKey: string) => {
    setClaudeApiKey(cKey);
    setClaudeModelId(cModelId);
    setGeminiApiKey(gKey);
    setGeminiProApiKey(gProKey);
    
    localStorage.setItem('lingua_claude_key', cKey);
    localStorage.setItem('lingua_claude_model_id', cModelId);
    localStorage.setItem('lingua_gemini_key', gKey);
    localStorage.setItem('lingua_gemini_pro_key', gProKey);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newItems: BatchItem[] = [];

    // Process all files first to get previews
    for (let i = 0; i < files.length; i++) {
      try {
        const processed = await processFile(files[i]);
        const newItem: BatchItem = {
          id: crypto.randomUUID(),
          ...processed,
          status: AppState.IDLE,
          result: null,
          error: null
        };
        newItems.push(newItem);
      } catch (e) {
        console.error("Error reading file", files[i].name, e);
      }
    }

    // Add to state
    setItems(prev => [...prev, ...newItems]);
    
    // Clear input
    if (fileInputRef.current) fileInputRef.current.value = '';

    // PARALLEL PROCESSING: Trigger translation for all new items immediately
    // We do not wait for one to finish before starting the next.
    newItems.forEach(item => {
      translateItem(item, sourceLang, modelProvider);
    });
  };

  const translateItem = async (item: BatchItem, lang: SourceLanguage, provider: ModelProvider) => {
    // Validation: Check if we have the necessary API keys before starting
    
    // 1. Claude Check
    if (provider === ModelProvider.CLAUDE && !claudeApiKey && !process.env.CLAUDE_API_KEY) {
      setItems(prev => prev.map(i => i.id === item.id ? { 
        ...i, 
        status: AppState.ERROR, 
        error: "Missing Claude API Key. Click the settings gear to add your key." 
      } : i));
      setIsSettingsOpen(true);
      return;
    }

    // 2. Gemini Check (Required for OCR in ALL modes, or translation in Gemini mode)
    // We strictly check for a standard key or the environment key.
    const hasGeminiKey = !!geminiApiKey || !!process.env.API_KEY;
    if (!hasGeminiKey) {
        setItems(prev => prev.map(i => i.id === item.id ? { 
            ...i, 
            status: AppState.ERROR, 
            error: "Missing Gemini API Key (Required for OCR). Click the settings gear to add your key." 
        } : i));
        setIsSettingsOpen(true);
        return;
    }

    // Update status to analyzing
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: AppState.ANALYZING, error: null } : i));

    try {
      let translation;
      if (provider === ModelProvider.CLAUDE) {
         translation = await translateImageContentWithClaude(
            item.base64Data, 
            item.mimeType, 
            lang, 
            claudeApiKey,
            claudeModelId,
            geminiApiKey
         );
      } else {
         translation = await translateImageContent(
           item.base64Data, 
           item.mimeType, 
           lang, 
           geminiApiKey, 
           geminiProApiKey
         );
      }

      setItems(prev => prev.map(i => i.id === item.id ? { 
        ...i, 
        status: AppState.SUCCESS, 
        result: translation 
      } : i));
    } catch (e) {
      console.error(e);
      setItems(prev => prev.map(i => i.id === item.id ? { 
        ...i, 
        status: AppState.ERROR, 
        error: e instanceof Error ? e.message : "Translation failed" 
      } : i));
    }
  };

  const handleRetry = (id: string) => {
    const item = items.find(i => i.id === id);
    if (item) {
        // Trigger immediate retry
        translateItem(item, sourceLang, modelProvider);
    }
  };

  const handleRemove = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleDownload = (item: BatchItem) => {
    if (!item.result) return;

    // Create a readable text format
    const header = `File: ${item.file.name}\nSource Language: ${item.result.detectedLanguage}\nDate: ${new Date().toLocaleString()}\n\n-----------------------------------\n\n`;
    
    const content = item.result.segments
      .map(seg => `[Original]\n${seg.source}\n\n[English]\n${seg.target}`)
      .join('\n\n-----------------------------------\n\n');

    const fullText = header + content;

    // Create blob and download link
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `translation-${item.file.name}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleClearAll = () => {
    setItems([]);
  };

  const handleLanguageChange = (newLang: SourceLanguage) => {
    setSourceLang(newLang);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0f172a]">
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />
      
      <ApiKeyModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
        currentClaudeKey={claudeApiKey}
        currentClaudeModelId={claudeModelId}
        currentGeminiKey={geminiApiKey}
        currentGeminiProKey={geminiProApiKey}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Intro / Empty State */}
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[70vh] text-center space-y-8 animate-fade-in">
            <div className="space-y-4 max-w-2xl">
              <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
                Translate <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Images</span> Instantly
              </h2>
              <p className="text-lg text-slate-400">
                Batch upload images containing Korean or Spanish text and get instant, AI-powered English translations.
              </p>
            </div>

            {/* Model Selection (Visible on Empty State) */}
            <div className="flex gap-2 p-1 bg-slate-800 rounded-lg border border-white/5">
                {Object.values(ModelProvider).map((provider) => (
                  <button
                    key={provider}
                    onClick={() => setModelProvider(provider)}
                    className={`
                      px-4 py-1.5 rounded-md text-sm font-medium transition-all
                      ${modelProvider === provider 
                        ? 'bg-indigo-600 text-white shadow' 
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }
                    `}
                  >
                    {provider}
                  </button>
                ))}
            </div>

            <div className="w-full max-w-md">
              <label 
                className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-2xl cursor-pointer bg-slate-800/50 border-slate-600 hover:border-indigo-500 hover:bg-slate-800 transition-all duration-300 group"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <div className="mb-4 p-3 rounded-full bg-slate-700/50 group-hover:bg-indigo-500/20 transition-colors">
                     <svg className="w-8 h-8 text-slate-400 group-hover:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  </div>
                  <p className="mb-2 text-sm text-slate-300"><span className="font-semibold text-indigo-400">Click to upload</span> multiple files</p>
                  <p className="text-xs text-slate-500">PNG, JPG, WEBP (MAX. 10MB)</p>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/png, image/jpeg, image/webp" 
                  multiple
                  onChange={handleFileChange}
                  ref={fileInputRef}
                />
              </label>
            </div>
            
            <div className="flex gap-4 text-sm text-slate-500">
               <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-500"></span> Korean</span>
               <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> Spanish</span>
               <span className="flex items-center gap-1">➔</span>
               <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> English</span>
            </div>
          </div>
        )}

        {/* Processing / Result State */}
        {items.length > 0 && (
          <div className="flex flex-col h-full animate-fade-in-up">
            
            <div className="sticky top-20 z-40 bg-[#0f172a]/90 backdrop-blur-md py-4 border-b border-white/5 mb-6 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <LanguageSelector 
                    selected={sourceLang} 
                    onChange={handleLanguageChange}
                    disabled={items.some(i => i.status === AppState.ANALYZING)}
                  />
                  
                  {/* Compact Model Selector for Results Page */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-xl border border-white/5">
                      <span className="text-sm text-slate-400 font-medium hidden sm:block">Model:</span>
                      <div className="flex gap-1">
                        {Object.values(ModelProvider).map((provider) => (
                          <button
                            key={provider}
                            onClick={() => setModelProvider(provider)}
                            disabled={items.some(i => i.status === AppState.ANALYZING)}
                            className={`
                              px-3 py-1 rounded-md text-xs font-medium transition-all
                              ${modelProvider === provider 
                                ? 'bg-indigo-600 text-white' 
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                              }
                            `}
                          >
                            {provider}
                          </button>
                        ))}
                      </div>
                  </div>
                </div>
                
                <div className="flex gap-3">
                   <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors font-medium shadow-lg shadow-indigo-900/20 text-sm flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Images
                  </button>
                  <button 
                    onClick={handleClearAll}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors border border-white/5"
                  >
                    Clear All
                  </button>
                </div>
              </div>
              <input 
                  type="file" 
                  className="hidden" 
                  accept="image/png, image/jpeg, image/webp" 
                  multiple
                  onChange={handleFileChange}
                  ref={fileInputRef}
                />
            </div>

            <div className="grid grid-cols-1 gap-6 pb-20">
              {items.map((item) => (
                <div key={item.id} className="bg-slate-900 rounded-2xl border border-white/10 overflow-hidden shadow-xl">
                  {/* Card Header */}
                  <div className="bg-white/5 px-4 py-3 flex items-center justify-between border-b border-white/5">
                    <div className="flex items-center gap-3 overflow-hidden">
                       <span className="text-sm font-medium text-slate-300 truncate max-w-[200px]">{item.file.name}</span>
                       
                       {item.status === AppState.ANALYZING && (
                         <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-medium text-indigo-400">
                           <div className="w-2 h-2 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin"></div>
                           Translating...
                         </span>
                       )}
                       {item.status === AppState.SUCCESS && (
                         <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-xs font-medium text-green-400">
                           <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                           Done
                         </span>
                       )}
                       {item.status === AppState.ERROR && (
                         <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-400">
                           <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                           Error
                         </span>
                       )}
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Show which model processed this item if successful */}
                      {item.status === AppState.SUCCESS && (
                        <span className="text-[10px] text-slate-500 font-mono border border-white/5 px-1.5 py-0.5 rounded mr-2">
                          {modelProvider === ModelProvider.CLAUDE ? 'CLAUDE' : 'GEMINI'}
                        </span>
                      )}

                      {/* Download Button - Only visible on Success */}
                      {item.status === AppState.SUCCESS && (
                        <button
                          onClick={() => handleDownload(item)}
                          className="text-slate-500 hover:text-indigo-400 transition-colors p-1"
                          title="Download Translation (.txt)"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                      )}

                      <button 
                        onClick={() => handleRemove(item.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors p-1"
                        title="Remove image"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-6 p-4 lg:p-6">
                    {/* Image Preview */}
                    <div className="lg:col-span-4 flex flex-col justify-center">
                      <div className="relative group rounded-xl overflow-hidden border border-white/10 bg-black/40">
                         <img 
                            src={item.previewUrl} 
                            alt="Original" 
                            className="w-full max-h-[400px] object-contain mx-auto"
                         />
                      </div>
                    </div>

                    {/* Result or State */}
                    <div className="lg:col-span-8 mt-4 lg:mt-0 min-h-[200px]">
                      
                      {item.status === AppState.ANALYZING && (
                         <div className="h-full flex flex-col items-center justify-center bg-slate-800/20 rounded-xl border border-white/5 py-12">
                            <div className="relative w-12 h-12 mb-4">
                              <div className="absolute inset-0 border-4 border-indigo-500/30 rounded-full animate-ping"></div>
                              <div className="absolute inset-0 border-4 border-t-indigo-500 rounded-full animate-spin"></div>
                            </div>
                            <p className="text-slate-400 text-sm">
                              {modelProvider === ModelProvider.CLAUDE ? 'Claude is thinking...' : 'Gemini is analyzing...'}
                            </p>
                         </div>
                      )}

                      {item.status === AppState.ERROR && (
                        <div className="h-full flex flex-col items-center justify-center bg-red-900/10 rounded-xl border border-red-500/20 py-8">
                          <p className="text-red-300 font-medium mb-2">Translation Failed</p>
                          <p className="text-red-400/70 text-sm mb-4 max-w-xs text-center">{item.error}</p>
                          <button 
                            onClick={() => handleRetry(item.id)}
                            className="px-4 py-2 bg-red-600/80 hover:bg-red-500 text-white rounded-lg text-sm font-medium"
                          >
                            Retry
                          </button>
                        </div>
                      )}

                      {item.status === AppState.SUCCESS && item.result && (
                         <ResultView result={item.result} className="h-full" />
                      )}

                      {item.status === AppState.IDLE && (
                         <div className="h-full flex flex-col items-center justify-center text-slate-500 bg-slate-800/20 rounded-xl border border-white/5 border-dashed">
                            Waiting to start...
                         </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;