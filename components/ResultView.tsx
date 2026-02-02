import React, { useState } from 'react';
import { TranslationResult, TranslationSegment } from '../types';

interface ResultViewProps {
  result: TranslationResult;
  className?: string;
}

interface TranslationItemProps {
  segment: TranslationSegment;
}

const TranslationItem: React.FC<TranslationItemProps> = ({ segment }) => {
  // justCopied handles the temporary animation (green checkmark icon)
  const [justCopied, setJustCopied] = useState(false);
  // hasCopied handles the persistent state (red bold text)
  const [hasCopied, setHasCopied] = useState(false);

  const handleCopy = async () => {
    // Allow text selection without triggering copy
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return;
    }

    try {
      await navigator.clipboard.writeText(segment.target);
      setJustCopied(true);
      setHasCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className={`
      bg-slate-800/80 rounded-xl p-4 border transition-colors shadow-sm group
      ${hasCopied ? 'border-red-500/20' : 'border-white/5 hover:border-indigo-500/30'}
    `}>
      {/* Source Text (Top) */}
      <div className="mb-2 pb-2 border-b border-white/5">
         <p className="text-slate-400 text-sm leading-relaxed font-medium">
           {segment.source}
         </p>
      </div>
      
      {/* Translated Text (Bottom) - Click to Copy */}
      <div 
        onClick={handleCopy}
        className="flex gap-3 items-start cursor-pointer p-2 -ml-2 rounded-lg hover:bg-white/5 transition-all duration-200 group/copy"
        title="Click to copy translation"
      >
        <div className={`
             mt-1 shrink-0 transition-transform duration-200
             ${justCopied ? 'text-green-400 scale-110' : 'text-indigo-400/60 group-hover/copy:text-indigo-400 group-hover/copy:scale-105'}
        `}>
          {justCopied ? (
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
             </svg>
          ) : (
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
             </svg>
          )}
        </div>
        <p className={`
          text-base leading-relaxed transition-all duration-300
          ${hasCopied ? 'text-red-400 font-bold' : 'text-white font-light'}
        `}>
          {segment.target}
        </p>
      </div>
    </div>
  );
};

export const ResultView: React.FC<ResultViewProps> = ({ result, className = "" }) => {
  return (
    <div className={`flex flex-col bg-slate-800/20 rounded-2xl border border-white/5 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 bg-white/5 flex justify-between items-center backdrop-blur-sm">
        <h3 className="font-semibold text-slate-200 text-sm">Translation</h3>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
          <span className="text-pink-400">{result.detectedLanguage || 'Source'}</span>
          <span className="text-slate-600">→</span>
          <span className="text-indigo-400">English</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 overflow-auto custom-scrollbar space-y-3 max-h-[500px]">
        {result.segments.length === 0 ? (
          <div className="text-center text-slate-500 py-6 text-sm">
            No text detected in the image.
          </div>
        ) : (
          result.segments.map((segment, index) => (
            <TranslationItem key={index} segment={segment} />
          ))
        )}
      </div>
    </div>
  );
};