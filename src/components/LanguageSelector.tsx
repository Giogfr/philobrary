import React, { useState } from 'react';
import { Search, Globe, Check, X } from 'lucide-react';
import { useStore, SupportedLanguage } from '../store';
import { languageNames, t } from '../i18n';
import { Flag } from './Flag';

interface LanguageSelectorProps {
  onClose: () => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ onClose }) => {
  const { language, setLanguage } = useStore();
  const [search, setSearch] = useState('');

  const entries = Object.entries(languageNames) as [SupportedLanguage, string][];
  const filtered = entries.filter(([code, name]) =>
    name.toLowerCase().includes(search.toLowerCase()) ||
    code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-primary/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-bg-card border border-border-subtle rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        <div className="p-4 border-b border-border-subtle flex items-center justify-between">
          <h2 className="text-xl font-bold text-text-primary flex items-center">
            <Globe className="me-2 text-accent-indigo" size={24} />
            {t('lang.title')}
          </h2>
          <button onClick={onClose} className="p-2 text-text-secondary hover:text-text-primary bg-bg-secondary hover:bg-bg-hover rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 border-b border-border-subtle">
          <div className="relative">
            <div className="absolute inset-y-0 start-0 flex items-center ps-4 text-text-secondary">
              <Search size={18} />
            </div>
            <input 
              type="text" 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              placeholder={t('lang.search')}
              className="w-full py-3 ps-11 pe-4 bg-bg-secondary border border-border-subtle text-text-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-indigo/50 transition-all placeholder:text-text-secondary"
            />
          </div>
        </div>

        <div className="overflow-y-auto max-h-[50vh] p-2">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-text-secondary">{t('lang.none')}</p>
          ) : (
            filtered.map(([code, name]) => (
              <button
                key={code}
                onClick={() => { setLanguage(code); onClose(); }}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-colors ${language === code ? 'bg-accent-indigo/10 text-accent-indigo' : 'text-text-primary hover:bg-bg-secondary'}`}
              >
                <span className="flex items-center font-medium gap-3">
                  <Flag code={code} className="w-6 h-6" />
                  {name}
                </span>
                {language === code && <Check size={18} />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
