import React from 'react';
import { ArrowLeft, Activity } from 'lucide-react';
import { UserAccount, AuthMode } from '../types';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { ValsalvaGame } from './ValsalvaGame';
import { useLanguage } from '../context/LanguageContext';

interface ValsalvaGamePageProps {
  currentUser?: UserAccount | null;
  onNavigateHome: () => void;
  onNavigateGames?: () => void;
  onNavigateDashboard?: () => void;
  onNavigateDiscussions?: (tab?: 'unopened' | 'mailbox') => void;
  onNavigateTeenSpace?: () => void;
  onNavigateLounge?: () => void;
  onNavigateRules?: () => void;
  onNavigateMailbox?: () => void;
  onOpenContactSupport?: () => void;
  onOpenEmergencyModal?: () => void;
  onOpenAuth?: (mode: AuthMode) => void;
  onTalkAnonymously?: () => void;
  onSignOut?: () => void;
}

export const ValsalvaGamePage: React.FC<ValsalvaGamePageProps> = ({
  currentUser,
  onNavigateHome,
  onNavigateGames,
  onNavigateDashboard,
  onNavigateDiscussions,
  onNavigateTeenSpace,
  onNavigateLounge,
  onNavigateRules,
  onNavigateMailbox,
  onOpenContactSupport,
  onOpenEmergencyModal,
  onOpenAuth,
  onTalkAnonymously,
  onSignOut,
}) => {
  const { language } = useLanguage();

  return (
    <Navbar
      currentView="games"
      currentUser={currentUser}
      onNavigateHome={onNavigateHome}
      onNavigateDashboard={onNavigateDashboard}
      onNavigateMailbox={onNavigateMailbox}
      onNavigateDiscussions={onNavigateDiscussions}
      onNavigateGames={onNavigateGames || onNavigateHome}
      onNavigateTeenSpace={onNavigateTeenSpace}
      onNavigateLounge={onNavigateLounge}
      onNavigateRules={onNavigateRules}
      onOpenContactSupport={onOpenContactSupport}
      onOpenEmergencyModal={onOpenEmergencyModal}
      onOpenAuth={onOpenAuth}
      onTalkAnonymously={onTalkAnonymously}
      onSignOut={onSignOut}
    >
      <main className="flex-1 py-10 sm:py-14 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#315243] hover:text-[#1F362C] transition-colors cursor-pointer bg-[#F0ECE4] hover:bg-[#E6E0D5] px-3.5 py-2 rounded-xl border border-[#DDD6C8]"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            <span>
              {language === 'ar' ? 'العودة للرئيسية' : language === 'fr' ? 'Retour à l\'accueil' : 'Back to Home'}
            </span>
          </button>

          {onNavigateGames && (
            <button
              type="button"
              onClick={onNavigateGames}
              className="text-xs text-[#586A60] hover:text-[#254133] underline font-medium cursor-pointer"
            >
              {language === 'ar' ? 'استعراض جميع الألعاب المهدئة' : language === 'fr' ? 'Tous les jeux apaisants' : 'All Calming Games'}
            </button>
          )}
        </div>

        {/* Header Introduction */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EBF2EE] border border-[#D2E2D8] text-[#294838] text-xs font-semibold mb-3.5 shadow-2xs">
            <Activity className="w-3.5 h-3.5 text-[#315243]" />
            <span>
              {language === 'ar' 
                ? 'تقنية تهدئة العصب المبهم' 
                : language === 'fr' 
                ? 'Manoeuvre vagale & Régulation' 
                : 'Vagus Nerve Reset Technique'}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#1B2B22] font-['Lora',serif] tracking-tight">
            {language === 'ar' 
              ? 'تقنية فالسالفا المهدئة' 
              : language === 'fr' 
              ? 'La Technique de Valsalva' 
              : 'The Valsalva Technique'}
          </h1>

          <p className="mt-3 text-sm sm:text-base text-[#57685F] leading-relaxed">
            {language === 'ar'
              ? 'تمرين جسدي لطيف ومعتمد يساعد على خفض تسارع نبضات القلب وتحفيز استجابة الاسترخاء عبر العصب المبهم.'
              : language === 'fr'
              ? 'Un exercice corporel doux et reconnu pour apaiser les palpitations rapides et stimuler le réflexe vagal de détente.'
              : 'A gentle, clinically recognized vagal stimulation method to naturally ease a racing pulse and activate the body\'s natural parasympathetic rest response.'}
          </p>
        </div>

        {/* The Valsalva Interactive Game */}
        <ValsalvaGame />
      </main>

      <Footer
        currentUser={currentUser}
        onOpenAuth={onOpenAuth || (() => {})}
        onTalkAnonymously={onTalkAnonymously || (() => {})}
        onOpenEmergencyModal={onOpenEmergencyModal || (() => {})}
        onOpenContactSupport={onOpenContactSupport}
        onNavigateRules={onNavigateRules}
      />
    </Navbar>
  );
};
