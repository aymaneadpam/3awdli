import React, { useState } from 'react';
import { Sparkles, Heart, Shield, HelpCircle, Gamepad2 } from 'lucide-react';
import { UserAccount, AuthMode } from '../types';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { CompanionGame } from './CompanionGame';
import { HeartbeatGame } from './HeartbeatGame';
import { BreathingPebbleGame } from './BreathingPebbleGame';
import { RainLightGame } from './RainLightGame';
import { ValsalvaGame } from './ValsalvaGame';
import { useLanguage } from '../context/LanguageContext';

interface GamesPageProps {
  initialGameId?: string;
  currentUser?: UserAccount | null;
  onNavigateHome: () => void;
  onNavigateDashboard?: () => void;
  onNavigateDiscussions?: (tab?: 'unopened' | 'mailbox') => void;
  onNavigateAdmin?: () => void;
  onNavigateMemberManagement?: () => void;
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

export const GamesPage: React.FC<GamesPageProps> = ({
  initialGameId = 'companion',
  currentUser,
  onNavigateHome,
  onNavigateDashboard,
  onNavigateDiscussions,
  onNavigateAdmin,
  onNavigateMemberManagement,
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
  const { language, strings } = useLanguage();
  const [selectedGameId, setSelectedGameId] = useState<string>(initialGameId);

  const gamesList = [
    {
      id: 'companion',
      title: language === 'ar' ? 'الرفيق المهدئ' : language === 'fr' ? 'Compagnon Apaisant' : 'Pet Companion',
      tag: language === 'ar' ? 'رفيق مهدئ' : language === 'fr' ? 'Compagnon' : 'Companion',
      isAvailable: true,
    },
    {
      id: 'breathing_pebble',
      title: strings.games?.breathingPebbleTitle || (language === 'ar' ? 'تأمل الحصاة والتنفس' : language === 'fr' ? 'Méditation du Galet' : 'Breathing Pals'),
      tag: language === 'ar' ? 'تنفس موجه' : language === 'fr' ? 'Respiration' : 'Breathing',
      isAvailable: true,
    },
    {
      id: 'valsalva',
      title: language === 'ar' ? 'تقنية فالسالفا' : language === 'fr' ? 'Technique de Valsalva' : 'Valsalva Technique',
      tag: language === 'ar' ? 'تهدئة العصب المبهم' : language === 'fr' ? 'Régulation' : 'Vagus Reset',
      isAvailable: true,
    },
    {
      id: 'heartbeat',
      title: strings.games?.heartbeatTitle || (language === 'ar' ? 'مُوائم نبضات القلب' : language === 'fr' ? 'Harmoniseur de Pulsations' : 'Heartbeat Rhythm'),
      tag: language === 'ar' ? 'إيقاع السكينة' : language === 'fr' ? 'Rythme' : 'Rhythm',
      isAvailable: true,
    },
    {
      id: 'rain_light',
      title: strings.games?.rainLightTitle || (language === 'ar' ? 'مطر ناعم وتوهج' : language === 'fr' ? 'Pluie Douce & Lueur' : 'Rain & Soft Light'),
      tag: language === 'ar' ? 'أجواء هادئة' : language === 'fr' ? 'Ambiance' : 'Peaceful',
      isAvailable: true,
    },
  ];

  return (
    <Navbar
      currentView="games"
      currentUser={currentUser}
      onNavigateHome={onNavigateHome}
      onNavigateDashboard={onNavigateDashboard}
      onNavigateMailbox={onNavigateMailbox}
      onNavigateDiscussions={onNavigateDiscussions}
      onNavigateAdmin={onNavigateAdmin}
      onNavigateMemberManagement={onNavigateMemberManagement}
      onNavigateGames={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      onNavigateTeenSpace={onNavigateTeenSpace}
      onNavigateLounge={onNavigateLounge}
      onNavigateRules={onNavigateRules}
      onOpenContactSupport={onOpenContactSupport}
      onOpenEmergencyModal={onOpenEmergencyModal}
      onOpenAuth={onOpenAuth}
      onTalkAnonymously={onTalkAnonymously}
      onSignOut={onSignOut}
    >
      <main className="flex-1 py-10 sm:py-14 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        {/* Header Introduction */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#EBF2EE] border border-[#D2E2D8] text-[#294838] text-xs font-semibold mb-3.5 shadow-2xs">
            <Gamepad2 className="w-3.5 h-3.5 text-[#315243]" />
            <span>{language === 'ar' ? 'ملاذ لتخفيف الضغط النفسي' : language === 'fr' ? 'Sanctuaire Anti-Stress' : 'Anti-Stress Sanctuary'}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-[#182C22] font-['Lora',serif] tracking-tight">
            {strings.games?.pageTitle || 'Calming Corner'}
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[#56685F] leading-relaxed">
            {strings.games?.pageSubtitle || 'Gentle, zero-pressure interactive spaces to help you slow down, breathe, and find comfort whenever things feel overwhelming.'}
          </p>
        </div>

        {/* Game Switcher / Catalog Bar */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mb-10">
          {gamesList.map((game) => {
            const isSelected = selectedGameId === game.id;
            return (
              <button
                key={game.id}
                type="button"
                id={`game-tab-${game.id}`}
                disabled={!game.isAvailable}
                onClick={() => {
                  if (game.isAvailable) setSelectedGameId(game.id);
                }}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all border ${
                  isSelected
                    ? 'bg-[#28493A] text-white border-[#28493A] shadow-xs'
                    : game.isAvailable
                    ? 'bg-white hover:bg-[#F2ECE3] text-[#2E483A] border-[#DFD8CC] cursor-pointer shadow-2xs'
                    : 'bg-[#F2ECE4]/60 text-[#8C9B92] border-[#E5DFD4] cursor-not-allowed opacity-75'
                }`}
              >
                <span>{game.title}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : game.isAvailable
                      ? 'bg-[#EAF2ED] text-[#2D4D3D]'
                      : 'bg-[#E8E2D7] text-[#7C8D84]'
                  }`}
                >
                  {game.tag}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Game Display Area */}
        <div className="mb-14">
          {selectedGameId === 'companion' && <CompanionGame />}
          {selectedGameId === 'heartbeat' && <HeartbeatGame />}
          {selectedGameId === 'breathing_pebble' && <BreathingPebbleGame />}
          {selectedGameId === 'valsalva' && (
            <ValsalvaGame onSelectOtherGame={() => setSelectedGameId('breathing_pebble')} />
          )}
          {selectedGameId === 'rain_light' && <RainLightGame />}
        </div>

        {/* Peaceful Design Philosophy Section */}
        <div className="max-w-2xl mx-auto rounded-3xl bg-white/75 border border-[#E5DFD5] p-6 sm:p-8 shadow-2xs text-center">
          <div className="w-10 h-10 rounded-2xl bg-[#EBF2EE] text-[#284838] flex items-center justify-center mx-auto mb-3.5 border border-[#D2E2D8]">
            <Heart className="w-5 h-5 text-[#315243]" />
          </div>
          <h2 className="text-base sm:text-lg font-semibold text-[#1C2F25] font-['Lora',serif]">
            {language === 'ar'
              ? 'فلسفة بدون أي ضغوط أو إخفاق'
              : language === 'fr'
              ? 'Philosophie Sans Échec ni Pression'
              : 'Zero-Failure Philosophy'}
          </h2>
          <p className="text-xs sm:text-sm text-[#5B6D63] mt-2 leading-relaxed">
            {language === 'ar'
              ? 'لا توجد نتائج، ولا ساعات توقيت، ولا توجد أي طريقة لارتكاب خطأ هنا. كل تفاعل مصمم لمنح جهازك العصبي لحظة استرخاء هادئة. خذ كل الوقت الذي تحتاجه.'
              : language === 'fr'
              ? 'Il n\'y a ni scores, ni compte à rebours, ni possibilité de se tromper ici. Chaque interaction est pensée uniquement pour offrir à votre esprit une respiration douce. Prenez tout le temps dont vous avez besoin.'
              : 'There are no scores, no clocks, and no ways to make a mistake here. Every interaction is designed solely to give your nervous system a gentle, unhurried breath. Take as much or as little time as you need.'}
          </p>

          <div className="mt-5 pt-5 border-t border-[#EAE4DC] flex flex-wrap items-center justify-center gap-6 text-xs text-[#6F7F77]">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#315243]" />
              <span>
                {language === 'ar' ? 'سري 100%' : language === 'fr' ? '100% Confidentiel' : '100% Private'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#315243]" />
              <span>
                {language === 'ar' ? 'تصميم بدون ضغط' : language === 'fr' ? 'Sans aucune pression' : 'Zero-Pressure Design'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-[#315243]" />
              <span>
                {language === 'ar' ? 'تكرار غير محدود' : language === 'fr' ? 'Répétitions illimitées' : 'Unlimited Repetitions'}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Standard Footer */}
      <Footer
        onOpenAuth={onOpenAuth}
        onTalkAnonymously={onTalkAnonymously}
        onOpenEmergencyModal={onOpenEmergencyModal}
        onOpenContactSupport={onOpenContactSupport}
      />
    </Navbar>
  );
};
