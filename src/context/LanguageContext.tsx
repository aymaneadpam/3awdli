import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, translations } from '../utils/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string, fallback?: string) => string;
  strings: typeof translations['en'];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'app_language';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'fr' || saved === 'ar') {
        return saved;
      }
    } catch {
      // safe fallback
    }
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      window.dispatchEvent(new Event('app_language_changed'));
    } catch {
      // safe fallback
    }
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const isRtl = language === 'ar';
      document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
      document.documentElement.setAttribute('lang', language);
      if (isRtl) {
        document.body.classList.add('font-arabic');
      } else {
        document.body.classList.remove('font-arabic');
      }
    }
  }, [language]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'en' || e.newValue === 'fr' || e.newValue === 'ar')) {
        setLanguageState(e.newValue as Language);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Helper function to get nested keys e.g. "genderModal.anyGenderTitle" or "nav.home"
  const t = (path: string, fallback?: string): string => {
    const currentDict = translations[language] || translations.en;
    const parts = path.split('.');
    let curr: any = currentDict;

    for (const p of parts) {
      if (curr && typeof curr === 'object' && p in curr) {
        curr = curr[p];
      } else {
        // Fallback to English dictionary
        let fallbackCurr: any = translations.en;
        for (const fp of parts) {
          if (fallbackCurr && typeof fallbackCurr === 'object' && fp in fallbackCurr) {
            fallbackCurr = fallbackCurr[fp];
          } else {
            fallbackCurr = undefined;
            break;
          }
        }
        if (typeof fallbackCurr === 'string') return fallbackCurr;
        return fallback || path;
      }
    }

    if (typeof curr === 'string') return curr;
    return fallback || path;
  };

  const strings = translations[language] || translations.en;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, strings }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
