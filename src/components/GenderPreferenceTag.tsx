import { ListenerGenderPreference } from '../types';

interface GenderPreferenceTagProps {
  preference?: ListenerGenderPreference;
  className?: string;
}

export const GenderPreferenceTag = ({ preference, className = '' }: GenderPreferenceTagProps) => {
  if (preference === 'male') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs ${className}`}
        title="User preference: Male listener"
      >
        <span className="text-xs" aria-hidden="true">👨</span>
        <span>Prefers: Male listener</span>
      </span>
    );
  }

  if (preference === 'female') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-pink-50 text-pink-800 border border-pink-200 shadow-2xs ${className}`}
        title="User preference: Female listener"
      >
        <span className="text-xs" aria-hidden="true">👩</span>
        <span>Prefers: Female listener</span>
      </span>
    );
  }

  // Default or 'any'
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F4EFE6] text-[#4E6156] border border-[#DDD5C7] shadow-2xs ${className}`}
      title="User preference: Any gender (fastest)"
    >
      <span className="text-xs" aria-hidden="true">🤝</span>
      <span>Any gender</span>
    </span>
  );
};
