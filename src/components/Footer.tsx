import { Heart, Shield, AlertCircle, PhoneCall, HelpCircle } from 'lucide-react';
import { AuthMode, User } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface FooterProps {
  currentUser?: User | null;
  onOpenAuth: (mode: AuthMode) => void;
  onTalkAnonymously: () => void;
  onOpenEmergencyModal: () => void;
  onOpenContactSupport?: () => void;
  onNavigateRules?: () => void;
}

export const Footer = ({
  currentUser,
  onOpenAuth,
  onTalkAnonymously,
  onOpenEmergencyModal,
  onOpenContactSupport,
  onNavigateRules,
}: FooterProps) => {
  const { language, strings } = useLanguage();

  return (
    <footer className="border-t border-[#E8E3DA] bg-[#F4EFE7] text-[#4A574F]">
      {/* Unobtrusive, clear safety note banner as requested */}
      <div className="bg-[#EDE6DC] border-b border-[#E0D8CB] px-4 py-3 text-center text-xs text-[#5D6B63]">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2">
          <span className="flex items-center gap-1.5 font-medium text-[#7D4F40]">
            <AlertCircle className="w-4 h-4 text-[#B55941] shrink-0" />
            <span>
              {language === 'ar'
                ? 'تنبيه أمان هام:'
                : language === 'fr'
                ? 'Avis de sécurité d\'urgence :'
                : 'Emergency Safety Notice:'}
            </span>
          </span>
          <span>
            {language === 'ar'
              ? 'هذه الخدمة ليست مخصصة للحالات الطارئة القصوى. أي شخص في خطر داهم يجب عليه الاتصال فوراً بخدمات الطوارئ المحلية.'
              : language === 'fr'
              ? 'Ce service n\'est pas destiné aux urgences vitales. Toute personne en danger immédiat doit contacter les services d\'urgence locaux.'
              : 'This service is not for emergencies. Anyone in immediate danger should contact local emergency services immediately.'}
          </span>
          <button
            onClick={onOpenEmergencyModal}
            className="text-[#315243] underline font-semibold hover:text-[#1F362C] cursor-pointer ms-1"
          >
            {language === 'ar'
              ? 'أرقام الطوارئ'
              : language === 'fr'
              ? 'Numéros d\'urgence'
              : 'Emergency numbers'}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand & mission */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#315243] text-white flex items-center justify-center">
                <Heart className="w-4 h-4 text-emerald-200 fill-emerald-200/20" />
              </div>
              <span className="text-xl font-bold text-[#1C2C24] font-['Lora',serif]">
                3awdli
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#616F67] leading-relaxed max-w-md">
              {strings.footer.disclaimerText}
            </p>
            <div className="flex items-center gap-3 text-xs text-[#57695F]">
              <span className="flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-emerald-700" />
                {language === 'ar'
                  ? 'لا يتم حفظ أي بيانات شخصية للمحادثات مجهولة الهوية'
                  : language === 'fr'
                  ? 'Aucune rétention de données pour les discussions anonymes'
                  : 'No data retention for anonymous chats'}
              </span>
            </div>
          </div>

          {/* Quick choices */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#2C3B33] mb-3">
              {strings.footer.quickLinks}
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={onTalkAnonymously}
                  className="hover:text-[#1F362C] hover:underline cursor-pointer flex items-center gap-1.5 font-medium text-[#2F5342]"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  {currentUser ? strings.common.talkOpenly : strings.common.talkAnonymously}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenAuth('signin')}
                  className="hover:text-[#1F362C] hover:underline cursor-pointer"
                >
                  {language === 'ar'
                    ? 'تسجيل الدخول (أعضاء سابقون)'
                    : language === 'fr'
                    ? 'Se connecter (utilisateurs inscrits)'
                    : 'Sign In (Returning Users)'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenAuth('signup')}
                  className="hover:text-[#1F362C] hover:underline cursor-pointer"
                >
                  {language === 'ar'
                    ? 'إنشاء حساب (حساب جديد)'
                    : language === 'fr'
                    ? 'S\'inscrire (nouveau compte)'
                    : 'Sign Up (New Account)'}
                </button>
              </li>
              {onNavigateRules && (
                <li>
                  <button
                    id="footer-rules-btn"
                    onClick={onNavigateRules}
                    className="hover:text-[#1F362C] hover:underline cursor-pointer flex items-center gap-1.5 font-medium text-[#2F5342]"
                  >
                    <span>{language === 'ar' ? 'ميثاق وقوانين المنصة' : language === 'fr' ? 'Règlement' : 'Rules & Charter'}</span>
                  </button>
                </li>
              )}
              {onOpenContactSupport && (
                <li className="pt-1.5 border-t border-[#E3DDD1]">
                  <button
                    id="footer-contact-support-btn"
                    onClick={onOpenContactSupport}
                    className="hover:text-[#1F362C] hover:underline cursor-pointer flex items-center gap-1.5 font-medium text-[#2F5342]"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-[#315243]" />
                    <span>{strings.nav.support}</span>
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Crisis assistance */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#2C3B33] mb-3">
              {strings.footer.emergency}
            </h4>
            <p className="text-xs text-[#6A7870] leading-relaxed mb-3">
              {language === 'ar'
                ? 'إذا كنت تعيش وضعاً يهدد حياتك أو سلامتك، تواصل فوراً مع خطوط المساعدة الطبية أو فرق الإنقاذ.'
                : language === 'fr'
                ? 'Si votre situation menace votre vie, contactez immédiatement les secours ou les lignes d\'aide hospitalières.'
                : 'If your situation is life-threatening, reach out to professional rescue or hospital helplines right now.'}
            </p>
            <button
              onClick={onOpenEmergencyModal}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#EAE3D7] hover:bg-[#DDD5C7] text-[#2F3E35] transition-colors cursor-pointer"
            >
              <PhoneCall className="w-3 h-3 text-[#315243]" />
              <span>{strings.footer.emergency}</span>
            </button>
          </div>
        </div>

        <div className="pt-8 border-t border-[#E3DDD1] flex flex-col sm:flex-row items-center justify-between text-xs text-[#7A8780] gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left rtl:sm:text-right">
            <p>
              &copy; {new Date().getFullYear()} {strings.footer.copyright}
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-medium border border-emerald-200/70">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                {language === 'ar'
                  ? 'قاعدة بيانات سحابية متصلة وآمنة (Firestore)'
                  : language === 'fr'
                  ? 'Base de données connectée (Firestore)'
                  : 'Real Database Connected (Firestore & Auth)'}
              </span>
            </div>
            {onOpenContactSupport && (
              <>
                <span className="hidden sm:inline text-[#C0C9C3]">&bull;</span>
                <button
                  id="footer-bottom-contact-link"
                  onClick={onOpenContactSupport}
                  className="text-[#3E5549] hover:text-[#1F362C] hover:underline cursor-pointer font-medium inline-flex items-center gap-1"
                >
                  <HelpCircle className="w-3 h-3 text-[#315243]" />
                  <span>
                    {language === 'ar'
                      ? 'هل تحتاج مساعدة في الموقع؟ اتصل بالدعم'
                      : language === 'fr'
                      ? 'Besoin d\'aide avec le site ? Contactez le support'
                      : 'Need help with the site? Contact Support'}
                  </span>
                </button>
              </>
            )}
          </div>
          <p className="italic text-[#6B7971]">
            {language === 'ar'
              ? '"تذكر دوماً أن صحتك النفسية وراحتك تهمنا بحق."'
              : language === 'fr'
              ? '"Rappelez-vous que votre santé mentale compte vraiment."'
              : '"Remind yourself that your mental health truly matters."'}
          </p>
        </div>
      </div>
    </footer>
  );
};
