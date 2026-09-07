import { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Clock, 
  ArrowRight, 
  Check, 
  ShieldCheck, 
  HeartHandshake
} from 'lucide-react';
import { ListenerGenderPreference } from '../types';

interface GenderPreferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (preference: ListenerGenderPreference) => void;
  initialPreference?: ListenerGenderPreference;
  currentPreference?: ListenerGenderPreference;
  title?: string;
  subtitle?: string;
  confirmButtonText?: string;
}

export const GenderPreferenceModal = ({
  isOpen,
  onClose,
  onConfirm,
  initialPreference,
  currentPreference,
  title = 'Start a Conversation',
  subtitle = 'Who would you feel most comfortable opening up to today?',
  confirmButtonText = 'Start Conversation',
}: GenderPreferenceModalProps) => {
  const effectiveInitial = currentPreference || initialPreference || 'any';
  const [selectedPreference, setSelectedPreference] = useState<ListenerGenderPreference>(effectiveInitial);

  // Reset to initial or 'any' whenever opened
  useEffect(() => {
    if (isOpen) {
      setSelectedPreference(effectiveInitial);
    }
  }, [isOpen, effectiveInitial]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(selectedPreference);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gender-pref-modal-title"
    >
      <div 
        className="bg-white border border-[#DDD7CB] rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#EFEAE2] bg-[#FAF8F5]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EAF2ED] text-[#244535] flex items-center justify-center border border-[#CFDFD5]">
              <HeartHandshake className="w-5 h-5 text-[#2A4C3A]" />
            </div>
            <div>
              <h2 id="gender-pref-modal-title" className="text-base sm:text-lg font-bold text-[#1D3227] font-['Lora',serif] leading-tight">
                {title}
              </h2>
              <p className="text-xs text-[#67786E] mt-0.5">
                {subtitle}
              </p>
            </div>
          </div>

          <button
            id="close-gender-pref-modal-btn"
            type="button"
            onClick={onClose}
            className="text-[#76887D] hover:text-[#1E3227] p-2 rounded-xl hover:bg-[#ECE6DD] transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          <div className="space-y-3">
            {/* OPTION 1: Talk to a man */}
            <div
              id="pref-option-man"
              onClick={() => setSelectedPreference('male')}
              className={`group flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                selectedPreference === 'male'
                  ? 'border-[#2D4F3E] bg-[#F4F9F6] shadow-2xs'
                  : 'border-[#E4DED4] bg-white hover:border-[#C8BFB1] hover:bg-[#FAF8F5]'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-900 border border-blue-200 flex items-center justify-center text-xl shrink-0">
                  👨
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#1B3125]">
                      Talk to a man
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                      Male listener
                    </span>
                  </div>
                  <p className="text-xs text-[#5E7166] mt-0.5">
                    Connect with a male counselor or psychology student listener
                  </p>
                </div>
              </div>

              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                selectedPreference === 'male'
                  ? 'border-[#2D4F3E] bg-[#2D4F3E] text-white'
                  : 'border-[#C8BFB1] bg-white'
              }`}>
                {selectedPreference === 'male' && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </div>

            {/* OPTION 2: Talk to a girl */}
            <div
              id="pref-option-girl"
              onClick={() => setSelectedPreference('female')}
              className={`group flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                selectedPreference === 'female'
                  ? 'border-[#2D4F3E] bg-[#F4F9F6] shadow-2xs'
                  : 'border-[#E4DED4] bg-white hover:border-[#C8BFB1] hover:bg-[#FAF8F5]'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-pink-50 text-pink-900 border border-pink-200 flex items-center justify-center text-xl shrink-0">
                  👩
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#1B3125]">
                      Talk to a girl
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-pink-50 text-pink-700 border border-pink-200">
                      Female listener
                    </span>
                  </div>
                  <p className="text-xs text-[#5E7166] mt-0.5">
                    Connect with a female counselor or psychology student listener
                  </p>
                </div>
              </div>

              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                selectedPreference === 'female'
                  ? 'border-[#2D4F3E] bg-[#2D4F3E] text-white'
                  : 'border-[#C8BFB1] bg-white'
              }`}>
                {selectedPreference === 'female' && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </div>

            {/* Gentle note underneath the two specific-gender options */}
            <div className="p-3.5 bg-[#FAF6EE] border border-[#E9DFD1] rounded-2xl flex items-start gap-2.5 text-xs text-[#635544]">
              <Clock className="w-4 h-4 text-[#8C6D46] shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-semibold text-[#544637]">Please note:</span>{' '}
                Choosing a specific gender may mean a longer wait. Choosing &apos;Any gender&apos; is usually faster.
              </div>
            </div>

            {/* OPTION 3: Any gender (default/recommended option, visually highlighted as the suggested choice) */}
            <div
              id="pref-option-any"
              onClick={() => setSelectedPreference('any')}
              className={`group relative flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer overflow-hidden ${
                selectedPreference === 'any'
                  ? 'border-[#28503C] bg-[#F1F8F4] shadow-sm ring-1 ring-[#28503C]/20'
                  : 'border-[#BDD7C8] bg-[#FAFDFB] hover:border-[#28503C] hover:bg-[#F1F8F4]'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#E4F2EA] text-[#1E4532] border border-[#BFDFCD] flex items-center justify-center text-xl shrink-0">
                  🤝
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[#143022]">
                      Any gender
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#244C37] text-white shadow-2xs">
                      <Sparkles className="w-3 h-3 text-emerald-300" />
                      Recommended &bull; Fastest
                    </span>
                  </div>
                  <p className="text-xs text-[#416250] mt-0.5">
                    Connect with the first available caring counselor or listener right now
                  </p>
                </div>
              </div>

              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                selectedPreference === 'any'
                  ? 'border-[#244C37] bg-[#244C37] text-white'
                  : 'border-[#9EBFAD] bg-white'
              }`}>
                {selectedPreference === 'any' && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#697B71] pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span>All 3awdli listeners follow strict confidentiality ethics and empathetic care.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[#EFEAE2] bg-[#FAF8F5] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#D5CFC3] text-xs font-semibold text-[#57695F] hover:bg-[#EFEAE2] transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            id="confirm-gender-pref-btn"
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-xl bg-[#284C3A] hover:bg-[#1E3A2C] text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 shadow-xs"
          >
            <span>{confirmButtonText}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
