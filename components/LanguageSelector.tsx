import React from 'react';
import { SourceLanguage } from '../types';

interface LanguageSelectorProps {
  selected: SourceLanguage;
  onChange: (lang: SourceLanguage) => void;
  disabled: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ selected, onChange, disabled }) => {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 mb-6 bg-slate-800/50 p-2 rounded-xl border border-white/5 w-fit mx-auto">
      <span className="text-sm text-slate-400 font-medium px-2 hidden sm:block">Source Language:</span>
      <div className="flex gap-1">
        {Object.values(SourceLanguage).map((lang) => (
          <button
            key={lang}
            onClick={() => onChange(lang)}
            disabled={disabled}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${selected === lang 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {lang}
          </button>
        ))}
      </div>
    </div>
  );
};