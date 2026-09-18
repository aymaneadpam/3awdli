import React, { useState, useEffect } from 'react';
import { Palette, Check, X, Sparkles, MessageSquare } from 'lucide-react';
import {
  LOUNGE_PARTICIPANT_COLORS,
  getAvailableColorsForSession,
} from '../utils/loungeChatManagement';
import { LoungeColorOption } from '../types';

interface LoungeColorSelectModalProps {
  articleId: string;
  currentUserId?: string;
  userName?: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirmColor: (colorId: string) => void;
}

export const LoungeColorSelectModal: React.FC<LoungeColorSelectModalProps> = ({
  articleId,
  currentUserId,
  userName = 'You',
  isOpen,
  onClose,
  onConfirmColor,
}) => {
  const [availableColors, setAvailableColors] = useState<LoungeColorOption[]>([]);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const colors = getAvailableColorsForSession(articleId, currentUserId);
      setAvailableColors(colors);
      // Default to first available color if none selected
      if (colors.length > 0) {
        setSelectedColorId(colors[0].id);
      } else {
        setSelectedColorId(null);
      }
    }
  }, [isOpen, articleId, currentUserId]);

  if (!isOpen) return null;

  const selectedColorOption =
    availableColors.find((c) => c.id === selectedColorId) || null;

  const handleConfirm = () => {
    if (selectedColorId) {
      onConfirmColor(selectedColorId);
    }
  };

  return (
    <div
      id="color-select-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-[#FAF7F2] border border-[#DDD4C5] rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#EBE4D8] text-[#28493A] flex items-center justify-center shadow-2xs">
              <Palette className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold mb-1">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>Your Turn Has Arrived</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#182C22] font-['Lora',serif]">
                Choose Your Personal Chat Color
              </h2>
            </div>
          </div>
          <button
            type="button"
            id="close-color-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#75867D] hover:bg-[#EFE7DA] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Explanatory description */}
        <p className="text-xs sm:text-sm text-[#506358] leading-relaxed">
          Select a distinct color to identify your messages in this live circle session.
          Once chosen, your color is exclusively reserved for you and removed from the list for others.
        </p>

        {/* Live speech bubble preview */}
        {selectedColorOption && (
          <div className="p-4 rounded-2xl bg-white border border-[#E4DCCE] shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-xs text-[#718579] font-medium">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Speech Bubble Preview
              </span>
              <span className="font-semibold text-[#182C22]">
                {selectedColorOption.name}
              </span>
            </div>

            <div className="pt-1">
              <div className="flex items-start gap-2.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-2xs shrink-0"
                  style={{ backgroundColor: selectedColorOption.hex }}
                >
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-[#506358] block mb-1">
                    {userName}
                  </span>
                  {/* Speech Bubble in chosen color */}
                  <div
                    className="px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm shadow-2xs font-normal"
                    style={{
                      backgroundColor: selectedColorOption.hex,
                      color: '#ffffff',
                    }}
                  >
                    Hello everyone! Glad to step into the circle with you today.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 10-Color Grid (Displaying available unchosen colors) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#687C71]">
              Available Colors ({availableColors.length} of 10 Remaining)
            </span>
            {availableColors.length < 10 && (
              <span className="text-[11px] text-[#A56740] font-medium">
                {10 - availableColors.length} already taken
              </span>
            )}
          </div>

          {availableColors.length === 0 ? (
            <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-center text-xs sm:text-sm text-amber-900">
              All 10 participant colors are currently in use by active members in the room.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {availableColors.map((color) => {
                const isSelected = selectedColorId === color.id;
                return (
                  <button
                    key={color.id}
                    type="button"
                    id={`color-choice-${color.id}`}
                    onClick={() => setSelectedColorId(color.id)}
                    className={`relative p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col items-center justify-center gap-2 group ${
                      isSelected
                        ? 'bg-white border-[#182C22] shadow-md ring-2 ring-[#182C22]/15 scale-[1.03]'
                        : 'bg-white/80 border-[#DDD4C5] hover:border-[#8E9F94] hover:bg-white'
                    }`}
                  >
                    {/* Color Swatch Circle */}
                    <div
                      className="w-10 h-10 rounded-full shadow-xs flex items-center justify-center transition-transform group-hover:scale-105"
                      style={{ backgroundColor: color.hex }}
                    >
                      {isSelected && <Check className="w-5 h-5 text-white" />}
                    </div>

                    {/* Color Name */}
                    <span className="text-xs font-semibold text-[#182C22] text-center leading-tight">
                      {color.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
          <button
            type="button"
            id="cancel-color-select-btn"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-[#D5C9B7] bg-white hover:bg-[#F2EDE4] text-[#4F6257] text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            id="confirm-enter-room-btn"
            disabled={!selectedColorId || availableColors.length === 0}
            onClick={handleConfirm}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-white text-xs sm:text-sm font-semibold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 ${
              selectedColorId && availableColors.length > 0
                ? 'bg-[#28493A] hover:bg-[#1C3529] hover:scale-[1.02]'
                : 'bg-[#98A79E] cursor-not-allowed'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-300" />
            <span>Enter Chat Room</span>
          </button>
        </div>
      </div>
    </div>
  );
};
