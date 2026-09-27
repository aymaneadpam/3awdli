import React from 'react';
import { 
  Clock, 
  CalendarClock, 
  HeartHandshake, 
  Gamepad2, 
  LifeBuoy, 
  Coffee, 
  X, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { NextWindowInfo, formatFriendlyNextOpening } from '../utils/scheduleManagement';

export interface ChatClosedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateSchedules: () => void;
  onOpenEmergencyModal?: () => void;
  onNavigateGames?: () => void;
  onNavigateLounge?: () => void;
  nextWindow?: NextWindowInfo;
}

export const ChatClosedModal: React.FC<ChatClosedModalProps> = ({
  isOpen,
  onClose,
  onNavigateSchedules,
  onOpenEmergencyModal,
  onNavigateGames,
  onNavigateLounge,
  nextWindow,
}) => {
  const { language } = useLanguage();

  if (!isOpen) return null;

  const friendlyNext = formatFriendlyNextOpening(nextWindow, language as any);

  const handleGoToSchedules = () => {
    onClose();
    onNavigateSchedules();
  };

  const handleGoToGames = () => {
    onClose();
    if (onNavigateGames) onNavigateGames();
  };

  const handleGoToLounge = () => {
    onClose();
    if (onNavigateLounge) onNavigateLounge();
  };

  const handleGoToEmergency = () => {
    onClose();
    if (onOpenEmergencyModal) onOpenEmergencyModal();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-closed-modal-title"
    >
      <div 
        className="relative w-full max-w-lg bg-[#FAF8F5] rounded-2xl sm:rounded-3xl border border-[#E5DFD4] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Soft Decorative Header */}
        <div className="relative px-6 pt-7 pb-5 bg-linear-to-b from-[#F2ECE1] to-[#FAF8F5] border-b border-[#EBE3D6] text-center">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-2 rounded-xl text-[#786C5E] hover:text-[#2E2822] hover:bg-[#E8DFCFA8] transition-colors cursor-pointer"
            aria-label={language === 'fr' ? 'Fermer' : language === 'ar' ? 'إغلاق' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#EBE2D3] border border-[#DDD1BE] flex items-center justify-center shadow-inner text-[#5A452C] mb-3.5">
            <Clock className="w-7 h-7 text-[#725433]" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#EAE2D5] text-[#5A452E] border border-[#D8CABE] mb-2">
            <HeartHandshake className="w-3.5 h-3.5 text-[#7A5A38]" />
            {language === 'fr' 
              ? 'Pause bienveillante' 
              : language === 'ar' 
              ? 'مساحة راحة واستعداد' 
              : 'Thoughtful Pause'}
          </span>

          <h2 id="chat-closed-modal-title" className="text-xl sm:text-2xl font-bold text-[#2A231C] font-['Lora',serif]">
            {language === 'fr'
              ? 'Notre écoute est actuellement fermée'
              : language === 'ar'
              ? 'خدمة الاستماع مغلقة حالياً'
              : 'Our chat is currently closed'}
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-[#675C4F] max-w-md mx-auto leading-relaxed">
            {language === 'fr'
              ? "Nous tenons à vous offrir toute notre attention et une présence humaine véritable lorsque nous sommes là. C'est pourquoi nous ouvrons nos échanges pendant des créneaux précis."
              : language === 'ar'
              ? "نحرص على منحك كل انتباهنا وحضورنا الإنساني الصادق عندما نتواجد معك، ولهذا السبب نفتح غرف الاستماع في مواعيد وفترات محددة."
              : "We care deeply about giving you our full, undivided attention when we're here. For this reason, our listening team opens during dedicated, scheduled windows."}
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {/* Next Opening Highlight Card */}
          {nextWindow ? (
            <div className="p-4 rounded-2xl bg-[#F4EDE2] border border-[#E3D7C5] flex items-start sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E8DCcb] text-[#694828] flex items-center justify-center shrink-0">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#7A5B3B]">
                    {language === 'fr' ? 'Prochaine session' : language === 'ar' ? 'الموعد القادم' : 'Next listening session'}
                  </p>
                  <p className="text-sm sm:text-base font-bold text-[#352516] mt-0.5">
                    {friendlyNext}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoToSchedules}
                className="px-3 py-1.5 rounded-xl bg-[#2A4B37] hover:bg-[#1E3728] text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer shrink-0"
              >
                <span>{language === 'fr' ? 'Voir tout' : language === 'ar' ? 'عرض الكل' : 'View all'}</span>
                <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-[#F4EDE2] border border-[#E3D7C5] text-center">
              <p className="text-sm font-semibold text-[#352516]">
                {language === 'fr' 
                  ? 'Consultez nos horaires pour connaître la prochaine permanence.' 
                  : language === 'ar' 
                  ? 'يرجى مراجعة جدول المواعيد للاطلاع على أوقات الفتح القادمة.' 
                  : 'Check our schedules to see all upcoming listening windows.'}
              </p>
            </div>
          )}

          {/* Gentle Alternatives while waiting */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#827566] mb-2.5 px-1">
              {language === 'fr' 
                ? 'En attendant notre retour' 
                : language === 'ar' 
                ? 'في انتظار موعد الفتح القادم' 
                : 'Gentle spaces while you wait'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Calming Games */}
              <button
                type="button"
                onClick={handleGoToGames}
                className="p-3 rounded-xl bg-white border border-[#E5DFD4] hover:border-[#CCD8CE] hover:bg-[#F4F8F5] text-left rtl:text-right transition-all flex items-center gap-3 cursor-pointer group shadow-2xs"
              >
                <div className="w-8 h-8 rounded-lg bg-[#E6F0EB] text-[#2C523D] flex items-center justify-center shrink-0 group-hover:bg-[#D5E6DC] transition-colors">
                  <Gamepad2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#23382C]">
                    {language === 'fr' ? 'Jeux apaisants' : language === 'ar' ? 'ألعاب الاسترخاء' : 'Calming Games'}
                  </p>
                  <p className="text-[11px] text-[#6B7B71] truncate">
                    {language === 'fr' ? 'Respiration & relaxation' : language === 'ar' ? 'تمارين تنفس وتأمل هادئة' : 'Breathing & mindfulness'}
                  </p>
                </div>
              </button>

              {/* The Lounge */}
              <button
                type="button"
                onClick={handleGoToLounge}
                className="p-3 rounded-xl bg-white border border-[#E5DFD4] hover:border-[#DFD2C0] hover:bg-[#FAF6EE] text-left rtl:text-right transition-all flex items-center gap-3 cursor-pointer group shadow-2xs"
              >
                <div className="w-8 h-8 rounded-lg bg-[#F5EDE0] text-[#715433] flex items-center justify-center shrink-0 group-hover:bg-[#EBDDC8] transition-colors">
                  <Coffee className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#352516]">
                    {language === 'fr' ? 'Le Lounge' : language === 'ar' ? 'الصالون' : 'The Lounge'}
                  </p>
                  <p className="text-[11px] text-[#7E7060] truncate">
                    {language === 'fr' ? 'Articles & lectures douces' : language === 'ar' ? 'مقالات داعمة وخواطر' : 'Supportive articles & thoughts'}
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Emergency Helpline Notice */}
          <div className="p-3 rounded-xl bg-[#FFF5F2] border border-[#FAD6CD] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <LifeBuoy className="w-4 h-4 text-[#C0392B] shrink-0" />
              <p className="text-xs text-[#7A2A20] leading-snug">
                <span className="font-bold">
                  {language === 'fr' ? 'Besoin d’aide immédiate ?' : language === 'ar' ? 'في حاجة لمساعدة عاجلة ؟' : 'Need urgent help?'}
                </span>{' '}
                {language === 'fr' 
                  ? 'Des numéros de crise officiels gratuits sont disponibles 24h/24.'
                  : language === 'ar'
                  ? 'خطوط الطوارئ المجانية متاحة على مدار الساعة 24/7.'
                  : 'Official free crisis hotlines are open 24/7.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleGoToEmergency}
              className="text-xs font-bold text-[#A93226] hover:underline cursor-pointer shrink-0 whitespace-nowrap"
            >
              {language === 'fr' ? 'Voir numéros' : language === 'ar' ? 'أرقام الطوارئ' : 'Hotlines'}
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#F2EDE4] border-t border-[#E5DFD4] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#5F5346] hover:text-[#25201A] hover:bg-[#E5DFD4] transition-colors cursor-pointer"
          >
            {language === 'fr' ? 'Compris, merci' : language === 'ar' ? 'حسناً، شكراً' : 'Understood, thank you'}
          </button>

          <button
            type="button"
            onClick={handleGoToSchedules}
            className="px-4 py-2 rounded-xl bg-[#264634] hover:bg-[#1C3627] text-white text-xs sm:text-sm font-semibold transition-all shadow-xs hover:shadow-sm cursor-pointer flex items-center gap-2"
          >
            <CalendarClock className="w-4 h-4 text-emerald-200" />
            <span>{language === 'fr' ? 'Consulter tous les horaires' : language === 'ar' ? 'عرض جدول المواعيد كاملاً' : 'View Full Schedule'}</span>
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
};
