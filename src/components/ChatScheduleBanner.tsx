import React from 'react';
import { Clock, MessageCircleHeart, Sparkles, ChevronRight, ArrowRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useChatSchedule, formatFriendlyNextOpening } from '../utils/scheduleManagement';

export interface ChatScheduleBannerProps {
  onNavigateSchedules: () => void;
  className?: string;
}

export const ChatScheduleBanner: React.FC<ChatScheduleBannerProps> = ({
  onNavigateSchedules,
  className = '',
}) => {
  const { language } = useLanguage();
  const { isOpen, currentWindow, nextWindow } = useChatSchedule();

  const friendlyNext = formatFriendlyNextOpening(nextWindow, language as any);

  if (isOpen) {
    return (
      <aside
        aria-label={language === 'fr' ? "Disponibilité de l'écoute en direct" : language === 'ar' ? 'حالة خدمة الاستماع' : 'Live chat availability status'}
        className={`w-full bg-linear-to-r from-[#E8F5EE] via-[#EDF7F1] to-[#E2F0E7] border-b border-[#C8E4D3] text-[#1E4A32] py-1.5 px-3 sm:px-6 transition-all ${className}`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-[#193F2B] flex items-center gap-1">
                <span>💬</span>
                {language === 'fr' 
                  ? "L'écoute est ouverte en ce moment !" 
                  : language === 'ar' 
                  ? 'خدمة الاستماع مفتوحة الآن !' 
                  : 'Chat is open right now!'}
              </span>
              <span className="hidden md:inline text-[#355B46] text-xs">
                {language === 'fr'
                  ? '— Notre équipe bienveillante est à vos côtés.'
                  : language === 'ar'
                  ? '— فريقنا التطوعي المتفهم هنا من أجلك.'
                  : '— Our compassionate listening team is here for you.'}
              </span>
              {currentWindow?.endTime && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#D4EBDE] text-[#1D4A31] border border-[#BCE0CB]">
                  {language === 'fr' ? `Ouvert jusqu'à ${currentWindow.endTime}` : language === 'ar' ? `مفتوح حتى ${currentWindow.endTime}` : `Open until ${currentWindow.endTime}`}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onNavigateSchedules}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F4C34] hover:text-[#123121] hover:underline cursor-pointer shrink-0 whitespace-nowrap"
          >
            <span>{language === 'fr' ? 'Voir tous les horaires' : language === 'ar' ? 'عرض المواعيد' : 'See all schedules'}</span>
            <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
        </div>
      </aside>
    );
  }

  // Chat is Closed
  return (
    <aside
      aria-label={language === 'fr' ? "Disponibilité de l'écoute en direct" : language === 'ar' ? 'حالة خدمة الاستماع' : 'Live chat availability status'}
      className={`w-full bg-[#FAF3EA] border-b border-[#ECD9C5] text-[#5C3F24] py-1.5 px-3 sm:px-6 transition-all ${className}`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm">
        <div 
          onClick={onNavigateSchedules}
          className="flex items-center gap-2.5 min-w-0 cursor-pointer group flex-1"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigateSchedules();
            }
          }}
        >
          <div className="w-6 h-6 rounded-full bg-[#F3E3D1] text-[#7A5330] flex items-center justify-center shrink-0">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 text-left rtl:text-right">
            <span className="font-semibold text-[#543820] group-hover:text-[#382414] transition-colors">
              {language === 'fr'
                ? "Notre écoute est actuellement fermée — nous tenons à vous offrir toute notre attention lorsque nous sommes présents."
                : language === 'ar'
                ? "خدمة الاستماع مغلقة حالياً — نحرص على منحك كل انتباهنا ورعايتنا أثناء تواجدنا."
                : "Our chat is currently closed — we care about giving you our full attention when we're here."}
            </span>
            <span className="hidden sm:inline font-bold ml-1.5 rtl:mr-1.5 rtl:ml-0 text-[#7A4E27] underline group-hover:text-[#523318]">
              {language === 'fr'
                ? "Cliquez ici pour voir nos prochains horaires d'ouverture."
                : language === 'ar'
                ? "اضغط هنا لمعرفة مواعيد الفتح القادمة."
                : "Tap here to see when we're next available."}
            </span>
            {nextWindow && (
              <span className="inline-block mt-0.5 sm:mt-0 sm:ml-2 sm:rtl:mr-2 sm:rtl:ml-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#F0DFC9] text-[#694220] border border-[#E2CCAE]">
                {language === 'fr' ? `Prochaine permanence : ${friendlyNext}` : language === 'ar' ? `الموعد القادم : ${friendlyNext}` : `Next opening: ${friendlyNext}`}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onNavigateSchedules}
          className="inline-flex items-center gap-1 text-xs font-bold text-[#6D4421] hover:text-[#422912] bg-[#F3E3D1] hover:bg-[#EBD6C1] px-2.5 py-1 rounded-lg transition-all border border-[#DFCCAE] cursor-pointer shrink-0 whitespace-nowrap shadow-2xs"
        >
          <span>{language === 'fr' ? 'Horaires' : language === 'ar' ? 'المواعيد' : 'Schedules'}</span>
          <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
        </button>
      </div>
    </aside>
  );
};
