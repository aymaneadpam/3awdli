import { ListenerGenderPreference } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface GenderPreferenceTagProps {
  preference?: ListenerGenderPreference;
  className?: string;
}

export const GenderPreferenceTag = ({ preference, className = '' }: GenderPreferenceTagProps) => {
  const { language } = useLanguage();

  if (preference === 'male') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs ${className}`}
        title={language === 'fr' ? 'Préférence utilisateur : Écoutant homme' : 'User preference: Male listener'}
      >
        <span className="text-xs" aria-hidden="true">👨</span>
        <span>{language === 'fr' ? 'Préférence : Écoutant homme' : 'Prefers: Male listener'}</span>
      </span>
    );
  }

  if (preference === 'female') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-pink-50 text-pink-800 border border-pink-200 shadow-2xs ${className}`}
        title={language === 'fr' ? 'Préférence utilisateur : Écoutante femme' : 'User preference: Female listener'}
      >
        <span className="text-xs" aria-hidden="true">👩</span>
        <span>{language === 'fr' ? 'Préférence : Écoutante femme' : 'Prefers: Female listener'}</span>
      </span>
    );
  }

  // Default or 'any'
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F4EFE6] text-[#4E6156] border border-[#DDD5C7] shadow-2xs ${className}`}
      title={language === 'fr' ? 'Préférence utilisateur : N\'importe quel genre (le plus rapide)' : 'User preference: Any gender (fastest)'}
    >
      <span className="text-xs" aria-hidden="true">🤝</span>
      <span>{language === 'fr' ? 'Tous genres' : 'Any gender'}</span>
    </span>
  );
};

