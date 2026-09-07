import { X, AlertTriangle, Phone, ExternalLink } from 'lucide-react';

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTalkAnonymously: () => void;
}

export const EmergencyModal = ({
  isOpen,
  onClose,
  onTalkAnonymously,
}: EmergencyModalProps) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/40 backdrop-blur-xs overflow-hidden"
      onClick={onClose}
    >
      <div 
        className="bg-[#FAF8F5] border border-[#E5E0D6] rounded-3xl max-w-lg w-full max-h-[min(90vh,580px)] flex flex-col shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed / shrink-0 */}
        <div className="p-5 sm:p-6 pb-3 shrink-0 flex items-start justify-between border-b border-[#EBE6DD]">
          <div className="flex items-center gap-3 text-amber-700 pr-8">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center border border-amber-200 shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#2A342E]">Important Safety Notice</h2>
              <p className="text-xs text-amber-800/90 font-medium">3awdli is not an emergency service</p>
            </div>
          </div>

          <button
            id="close-emergency-modal-btn"
            onClick={onClose}
            className="p-2 text-[#7C8780] hover:text-[#2C332F] hover:bg-[#EFECE5] rounded-xl transition-colors cursor-pointer shrink-0"
            aria-label="Close emergency info"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          <p className="text-sm text-[#4E5B53] leading-relaxed">
            If you or someone you care about is experiencing thoughts of suicide, severe self-harm, or is in immediate physical danger, please do not wait for a chat response. Reach out to local emergency services immediately:
          </p>

          <div className="space-y-2.5">
            <div className="bg-white border border-[#E5E0D6] rounded-2xl p-3.5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#25322A]">Local Medical Emergencies / SAMU</p>
                <p className="text-xs text-[#6A7870]">Ambulance & immediate medical crisis</p>
              </div>
              <a 
                href="tel:15"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#315243] text-white text-xs font-medium rounded-xl hover:bg-[#253F33] transition-colors shrink-0"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call 15</span>
              </a>
            </div>

            <div className="bg-white border border-[#E5E0D6] rounded-2xl p-3.5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#25322A]">Police & Civil Safety</p>
                <p className="text-xs text-[#6A7870]">Urgent civil protection or danger</p>
              </div>
              <a 
                href="tel:19"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#315243] text-white text-xs font-medium rounded-xl hover:bg-[#253F33] transition-colors shrink-0"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call 19 / 112</span>
              </a>
            </div>

            <div className="bg-white border border-[#E5E0D6] rounded-2xl p-3.5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#25322A]">International Crisis Lifelines</p>
                <p className="text-xs text-[#6A7870]">Directory of global crisis centers</p>
              </div>
              <a 
                href="https://findahelpline.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EAE5DC] text-[#34423A] text-xs font-medium rounded-xl hover:bg-[#DDD7CC] transition-colors shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Find a Helpline</span>
              </a>
            </div>
          </div>
        </div>

        {/* Footer - Fixed / shrink-0 */}
        <div className="p-4 sm:p-5 bg-[#F6F3EC] border-t border-[#E8E3DA] flex items-center justify-between shrink-0">
          <p className="text-xs text-[#6B7971]">
            For non-emergency listening and guidance:
          </p>
          <button
            onClick={() => {
              onClose();
              onTalkAnonymously();
            }}
            className="text-xs font-semibold text-[#2C4A3C] hover:underline cursor-pointer flex items-center gap-1"
          >
            <span>Open Anonymous Chat</span>
            <span>&rarr;</span>
          </button>
        </div>
      </div>
    </div>
  );
};
