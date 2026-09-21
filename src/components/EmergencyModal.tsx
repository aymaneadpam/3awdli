import { X, AlertTriangle, Phone, ExternalLink } from 'lucide-react';
import { User } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTalkAnonymously: () => void;
  currentUser?: User | null;
}

export const EmergencyModal = ({
  isOpen,
  onClose,
  onTalkAnonymously,
  currentUser,
}: EmergencyModalProps) => {
  const { language } = useLanguage();

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
          <div className="flex items-center gap-3 text-amber-700 pe-8">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center border border-amber-200 shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#2A342E]">
                {language === 'ar'
                  ? 'تنبيه أمان هام وعاجل'
                  : language === 'fr'
                  ? 'Avis de sécurité important'
                  : 'Important Safety Notice'}
              </h2>
              <p className="text-xs text-amber-800/90 font-medium">
                {language === 'ar'
                  ? 'منصة 3awdli ليست مخصصة لخدمات الطوارئ القصوى'
                  : language === 'fr'
                  ? '3awdli n\'est pas un service d\'urgence'
                  : '3awdli is not an emergency service'}
              </p>
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
            {language === 'ar'
              ? 'إذا كنت أنت أو شخص مقرب منك تمر بأفكار انتحارية، إيذاء النفس، أو في خطر جسدي مباشر، يرجى عدم الانتظار في المحادثة الكتابية. اتصل فوراً بأرقام الطوارئ والإغاثة المحلية:'
              : language === 'fr' 
              ? 'Si vous ou l\'un de vos proches avez des pensées suicidaires, des comportements auto-agressifs ou êtes en danger physique immédiat, n\'attendez pas une réponse de messagerie. Contactez immédiatement les services d\'urgence :'
              : 'If you or someone you care about is experiencing thoughts of suicide, severe self-harm, or is in immediate physical danger, please do not wait for a chat response. Reach out to local emergency services immediately:'}
          </p>

          <div className="space-y-2.5">
            {/* 15: Protection Civile */}
            <div className="bg-white border border-[#E5E0D6] rounded-2xl p-3.5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#25322A]">
                  {language === 'ar'
                    ? 'الوقاية المدنية (Protection Civile)'
                    : language === 'fr'
                    ? 'Protection Civile'
                    : 'Protection Civile'}
                </p>
                <p className="text-xs text-[#6A7870]">
                  {language === 'ar'
                    ? 'الإسعاف، الإنقاذ والتدخل في حالات الطوارئ والحرائق'
                    : language === 'fr'
                    ? 'Secours, ambulance et urgences'
                    : 'Civil protection, ambulance & rescue'}
                </p>
              </div>
              <a 
                href="tel:15"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#315243] text-white text-xs font-medium rounded-xl hover:bg-[#253F33] transition-colors shrink-0"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'اتصال بـ 15' : language === 'fr' ? 'Appeler 15' : 'Call 15'}</span>
              </a>
            </div>

            {/* 19: Police Secours */}
            <div className="bg-white border border-[#E5E0D6] rounded-2xl p-3.5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#25322A]">
                  {language === 'ar'
                    ? 'الشرطة والأمن الوطني (Police Secours)'
                    : language === 'fr'
                    ? 'Police Secours'
                    : 'Police Secours'}
                </p>
                <p className="text-xs text-[#6A7870]">
                  {language === 'ar'
                    ? 'الأمن والنجدة الفورية في المناطق الحضرية'
                    : language === 'fr'
                    ? 'Secours de police en zone urbaine'
                    : 'Emergency urban police safety'}
                </p>
              </div>
              <a 
                href="tel:19"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#315243] text-white text-xs font-medium rounded-xl hover:bg-[#253F33] transition-colors shrink-0"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'اتصال بـ 19' : language === 'fr' ? 'Appeler 19' : 'Call 19'}</span>
              </a>
            </div>

            {/* 177: Gendarmerie Royale */}
            <div className="bg-white border border-[#E5E0D6] rounded-2xl p-3.5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#25322A]">
                  {language === 'ar'
                    ? 'الدرك الملكي (Gendarmerie Royale)'
                    : language === 'fr'
                    ? 'Gendarmerie Royale'
                    : 'Gendarmerie Royale'}
                </p>
                <p className="text-xs text-[#6A7870]">
                  {language === 'ar'
                    ? 'النجدة والأمن في المناطق القروية والخارجية'
                    : language === 'fr'
                    ? 'Secours et sécurité en zone rurale'
                    : 'Rural areas & highway emergency safety'}
                </p>
              </div>
              <a 
                href="tel:177"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#315243] text-white text-xs font-medium rounded-xl hover:bg-[#253F33] transition-colors shrink-0"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'اتصال بـ 177' : language === 'fr' ? 'Appeler 177' : 'Call 177'}</span>
              </a>
            </div>

            <div className="bg-white border border-[#E5E0D6] rounded-2xl p-3.5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#25322A]">
                  {language === 'ar'
                    ? 'خطوط مساعدة دولية وأرقام مساندة عالمية'
                    : language === 'fr'
                    ? 'Lignes d\'écoute internationales'
                    : 'International Crisis Lifelines'}
                </p>
                <p className="text-xs text-[#6A7870]">
                  {language === 'ar'
                    ? 'دليل عالمي لمراكز الدعم والأزمات النفسية'
                    : language === 'fr'
                    ? 'Répertoire mondial des centres de crise'
                    : 'Directory of global crisis centers'}
                </p>
              </div>
              <a 
                href="https://findahelpline.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EAE5DC] text-[#34423A] text-xs font-medium rounded-xl hover:bg-[#DDD7CC] transition-colors shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'العثور على خط مساعدة' : language === 'fr' ? 'Trouver de l\'aide' : 'Find a Helpline'}</span>
              </a>
            </div>
          </div>
        </div>

        {/* Footer - Fixed / shrink-0 */}
        <div className="p-4 sm:p-5 bg-[#F6F3EC] border-t border-[#E8E3DA] flex items-center justify-between shrink-0">
          <p className="text-xs text-[#6B7971]">
            {language === 'ar'
              ? 'للحصول على استماع ومرافقة هادئة دون وجود خطر داهم:'
              : language === 'fr'
              ? 'Pour une écoute bienveillante sans urgence vitale :'
              : 'For non-emergency listening and guidance:'}
          </p>
          <button
            onClick={() => {
              onClose();
              onTalkAnonymously();
            }}
            className="text-xs font-semibold text-[#2C4A3C] hover:underline cursor-pointer flex items-center gap-1"
          >
            <span>
              {currentUser 
                ? (language === 'ar' ? 'تحدث علانية بحسابك' : language === 'fr' ? 'Parler à cœur ouvert' : 'Talk Openly')
                : (language === 'ar' ? 'تحدث بدون هوية' : language === 'fr' ? 'Parler anonymement' : 'Talk Anonymously')}
            </span>
            <span className="rtl:rotate-180">&rarr;</span>
          </button>
        </div>
      </div>
    </div>
  );
};

