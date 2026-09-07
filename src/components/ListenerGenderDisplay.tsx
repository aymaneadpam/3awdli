import { Gender } from '../types';

interface ListenerGenderDisplayProps {
  gender?: Gender;
  className?: string;
  showText?: boolean;
}

/**
 * Visual representation of listener gender:
 * - Male: a simple man icon/emoji, shown in blue.
 * - Female: a simple woman icon/emoji, shown in pink.
 */
export const ListenerGenderIcon = ({ gender, className = '', showText = false }: ListenerGenderDisplayProps) => {
  if (!gender) return null;

  if (gender === 'Male') {
    return (
      <span 
        className={`inline-flex items-center gap-1 text-blue-600 ${className}`}
        title="Male"
        aria-label="Male"
      >
        <span className="text-base select-none leading-none filter drop-shadow-2xs">👨</span>
        {showText && <span className="text-xs font-semibold text-blue-600">Male</span>}
      </span>
    );
  }

  return (
    <span 
      className={`inline-flex items-center gap-1 text-pink-500 ${className}`}
      title="Female"
      aria-label="Female"
    >
      <span className="text-base select-none leading-none filter drop-shadow-2xs">👩</span>
      {showText && <span className="text-xs font-semibold text-pink-500">Female</span>}
    </span>
  );
};
