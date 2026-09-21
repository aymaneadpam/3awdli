import React, { useState, useEffect } from 'react';
import { 
  User, 
  Briefcase, 
  History, 
  ArrowRight, 
  Clock, 
  Lock, 
  ShieldCheck, 
  LogOut, 
  Star, 
  Sparkles, 
  PenTool, 
  HelpCircle,
  Check,
  Edit3
} from 'lucide-react';
import { UserAccount } from '../types';
import { isWriter, updateUserDisplayName } from '../utils/userManagement';
import { useLanguage } from '../context/LanguageContext';
import { Navbar } from './Navbar';

interface PersonalDashboardProps {
  user: UserAccount;
  onSignOut: () => void;
  onNavigateHome: () => void;
  onOpenEmergencyModal: () => void;
  onNavigateDiscussions?: (tab?: any) => void;
  onNavigateAdmin?: () => void;
  onNavigateMemberManagement?: () => void;
  onNavigateGames?: () => void;
  onNavigateTeenSpace?: () => void;
  onNavigateLounge?: () => void;
  onNavigateRules?: () => void;
  onNavigateMailbox?: () => void;
  onNavigateReports?: () => void;
  onNavigateAdminReports?: () => void;
  onNavigateAdminSupport?: () => void;
  onOpenContactSupport?: () => void;
  onTalkAnonymously?: () => void;
}

export const PersonalDashboard: React.FC<PersonalDashboardProps> = ({
  user,
  onSignOut,
  onNavigateHome,
  onOpenEmergencyModal,
  onNavigateDiscussions,
  onNavigateAdmin,
  onNavigateMemberManagement,
  onNavigateGames,
  onNavigateTeenSpace,
  onNavigateLounge,
  onNavigateRules,
  onNavigateMailbox,
  onNavigateReports,
  onNavigateAdminReports,
  onNavigateAdminSupport,
  onOpenContactSupport,
  onTalkAnonymously,
}) => {
  const isListener = Boolean(user.is_listener || user.isListener || user.role === 'listener');
  const isHead = Boolean(user.is_head_of_listeners);
  const isAdmin = Boolean(user.role === 'admin' || user.is_administrator);
  const isWriterUser = isWriter(user);

  const { language } = useLanguage();
  const [displayName, setDisplayName] = useState(user.name || '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameFeedback, setNameFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setDisplayName(user.name || '');
  }, [user.name]);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = displayName.trim();
    if (!clean) {
      setNameFeedback({
        type: 'error',
        message: language === 'ar' ? 'يرجى إدخال اسم صحيح' : language === 'fr' ? 'Veuillez saisir un nom valide' : 'Please enter a valid name'
      });
      return;
    }
    if (clean === user.name) {
      return;
    }

    setIsSavingName(true);
    const result = updateUserDisplayName(user.id, clean);
    setIsSavingName(false);

    if (result.success) {
      setNameFeedback({
        type: 'success',
        message: language === 'ar' ? 'تم حفظ الاسم بنجاح' : language === 'fr' ? 'Nom enregistré avec succès' : 'Name updated successfully'
      });
      setTimeout(() => {
        setNameFeedback(null);
      }, 4000);
    } else {
      setNameFeedback({
        type: 'error',
        message: result.error || (language === 'ar' ? 'تعذر حفظ الاسم' : language === 'fr' ? 'Erreur lors de la mise à jour' : 'Failed to update name')
      });
    }
  };

  // Determine special role if any (regular users have nothing special)
  let specialRole: { label: string; icon: React.ReactNode; badgeClass: string } | null = null;

  if (isHead) {
    specialRole = {
      label: 'Head of Listeners',
      icon: <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />,
      badgeClass: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]',
    };
  } else if (isListener) {
    specialRole = {
      label: 'Listener',
      icon: <Sparkles className="w-3.5 h-3.5 text-emerald-600" />,
      badgeClass: 'bg-[#EAF3EE] text-[#1E3F2E] border-[#CFE1D6]',
    };
  } else if (isAdmin) {
    specialRole = {
      label: 'Administrator',
      icon: <ShieldCheck className="w-3.5 h-3.5 text-[#884B20]" />,
      badgeClass: 'bg-[#FBF0E4] text-[#55321B] border-[#E9D4BF]',
    };
  } else if (isWriterUser) {
    specialRole = {
      label: 'Teen Space Writer',
      icon: <PenTool className="w-3.5 h-3.5 text-[#1D4ED8]" />,
      badgeClass: 'bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]',
    };
  }

  const profession = user.profession?.trim();

  // Initial letter for the avatar
  const initial = (user.name || user.email || 'U').charAt(0).toUpperCase();

  return (
    <Navbar
      currentView="dashboard"
      currentUser={user}
      onNavigateHome={onNavigateHome}
      onNavigateDashboard={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      onNavigateDiscussions={onNavigateDiscussions}
      onNavigateAdmin={isAdmin && onNavigateAdmin ? onNavigateAdmin : undefined}
      onNavigateMemberManagement={onNavigateMemberManagement}
      onNavigateGames={onNavigateGames}
      onNavigateTeenSpace={onNavigateTeenSpace}
      onNavigateLounge={onNavigateLounge}
      onNavigateRules={onNavigateRules}
      onNavigateMailbox={onNavigateMailbox}
      onNavigateReports={onNavigateReports}
      onNavigateAdminReports={onNavigateAdminReports}
      onNavigateAdminSupport={onNavigateAdminSupport}
      onOpenContactSupport={onOpenContactSupport}
      onOpenEmergencyModal={onOpenEmergencyModal}
      onTalkAnonymously={onTalkAnonymously}
      onSignOut={onSignOut}
    >
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        {/* Simplified Personal Space Card */}
        <div className="bg-white border border-[#E3DDD1] rounded-3xl p-6 sm:p-10 shadow-xs">
          {/* Header section: Avatar, Name, Email, and Badges */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-[#FAF8F5] border border-[#E3DDD1] text-[#244233] flex items-center justify-center font-bold text-2xl font-['Lora',serif] shrink-0">
              {initial}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[11px] font-semibold text-[#315243] uppercase tracking-wider">
                  Personal Space
                </span>
                {specialRole && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${specialRole.badgeClass}`}>
                    {specialRole.icon}
                    <span>{specialRole.label}</span>
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold font-['Lora',serif] text-[#1E2E25] truncate">
                {user.name}
              </h1>

              <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-[#5B6E63]">
                <span className="flex items-center gap-1 text-[#5B6E63]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#315243]" />
                  {user.email}
                </span>

                {profession && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FAF8F5] text-[#2C4A3A] border border-[#E3DDD1] font-medium">
                    <Briefcase className="w-3 h-3 text-[#315243]" />
                    <span>{profession}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section Divider */}
          <div className="border-t border-[#EFECE5] my-8" />

          {/* Change Display Name Option */}
          <div className="bg-[#FAF8F5] border border-[#E8E3D8] rounded-2xl p-5 sm:p-6 mb-6">
            <div className="flex items-center gap-2 mb-1.5">
              <Edit3 className="w-4 h-4 text-[#315243]" />
              <h2 className="text-sm sm:text-base font-bold font-['Lora',serif] text-[#1E2E25]">
                {language === 'ar' ? 'تغيير الاسم' : language === 'fr' ? 'Changer votre nom' : 'Change Name'}
              </h2>
            </div>
            <p className="text-xs text-[#5B6E63] mb-4">
              {language === 'ar'
                ? 'يمكنك تعديل اسمك أو اللقب الذي يظهر في حسابك ومحادثاتك.'
                : language === 'fr'
                ? 'Modifiez votre nom d\'affichage pour votre espace personnel et vos échanges.'
                : 'Update your display name visible across your personal space and discussions.'}
            </p>

            <form onSubmit={handleSaveName} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <input
                  id="personal-space-change-name-input"
                  type="text"
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    if (nameFeedback) setNameFeedback(null);
                  }}
                  placeholder={language === 'ar' ? 'أدخل اسمك أو لقبك' : language === 'fr' ? 'Entrez votre nom' : 'Enter your name'}
                  maxLength={50}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5CEC2] bg-white text-sm text-[#1E2E25] placeholder-[#889B90] focus:outline-none focus:ring-2 focus:ring-[#315243]/20 focus:border-[#315243] transition-all"
                />
              </div>

              <button
                id="personal-space-save-name-btn"
                type="submit"
                disabled={isSavingName || !displayName.trim() || displayName.trim() === user.name}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#264536] hover:bg-[#1E382B] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer shrink-0 shadow-xs"
              >
                {isSavingName ? (
                  <span>{language === 'ar' ? 'جاري الحفظ...' : language === 'fr' ? 'Enregistrement...' : 'Saving...'}</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{language === 'ar' ? 'حفظ' : language === 'fr' ? 'Enregistrer' : 'Save'}</span>
                  </>
                )}
              </button>
            </form>

            {nameFeedback && (
              <p className={`mt-2.5 text-xs font-medium flex items-center gap-1.5 ${nameFeedback.type === 'success' ? 'text-emerald-700' : 'text-[#8B362A]'}`}>
                {nameFeedback.type === 'success' && <Check className="w-3.5 h-3.5 shrink-0" />}
                <span>{nameFeedback.message}</span>
              </p>
            )}
          </div>

          {/* Single Discussions History Action */}
          <div className="bg-[#FAF8F5] border border-[#E8E3D8] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-bold font-['Lora',serif] text-[#1E2E25]">
                Discussions
              </h2>
              <p className="text-xs sm:text-sm text-[#5B6E63] leading-relaxed max-w-md">
                Access your past and current conversations with verified listeners in your dedicated discussions space.
              </p>
            </div>

            <button
              id="personal-space-discussions-history-btn"
              onClick={() => onNavigateDiscussions?.('history')}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#264536] hover:bg-[#1E382B] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer shrink-0 shadow-xs"
            >
              <History className="w-4 h-4" />
              <span>Discussions History</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-80" />
            </button>
          </div>

          {/* Account Details & Sign Out Footer */}
          <div className="mt-8 pt-6 border-t border-[#EFECE5] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-[#6F7F76]">
            <div className="flex items-center gap-4 flex-wrap">
              {user.createdAt && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#889B90]" />
                  <span>Member since {user.createdAt}</span>
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#889B90]" />
                <span>Confidential &amp; Private</span>
              </span>
            </div>

            <button
              id="personal-space-signout-btn"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8B362A] hover:text-[#6E2920] transition-colors cursor-pointer self-start sm:self-auto"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="w-full py-6 text-center text-xs text-[#7A8A80] border-t border-[#E5DFD5] bg-[#FAF8F5]/80 mt-auto">
        <div className="max-w-3xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            &copy; {new Date().getFullYear()} 3awdli &bull; Free, confidential, and safe.
          </p>
          {onOpenContactSupport && (
            <button
              id="dashboard-footer-contact-link"
              onClick={onOpenContactSupport}
              className="text-[#315243] hover:underline font-medium cursor-pointer inline-flex items-center gap-1"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#315243]" />
              <span>Need help? Contact Support</span>
            </button>
          )}
        </div>
      </footer>
    </Navbar>
  );
};
