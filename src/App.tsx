import { useState, useEffect } from 'react';
import { 
  MessageCircle, 
  ShieldCheck, 
  Heart, 
  Sparkles, 
  ArrowRight,
  Gamepad2,
  Coffee,
  Compass,
  Wind,
  Play,
  Activity
} from 'lucide-react';
import { useLanguage } from './context/LanguageContext';
import { Navbar } from './components/Navbar';
import { Logo } from './components/Logo';
import { AnonymousChatWidget } from './components/AnonymousChatWidget';
import { EmergencyModal } from './components/EmergencyModal';
import { Pillars } from './components/Pillars';
import { Footer } from './components/Footer';
import { SignInPage } from './components/SignInPage';
import { SignUpPage } from './components/SignUpPage';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { PersonalDashboard } from './components/PersonalDashboard';
import { DiscussionsPage } from './components/DiscussionsPage';
import { AdminRoleManagement } from './components/AdminRoleManagement';
import { GamesPage } from './components/GamesPage';
import { ValsalvaGamePage } from './components/ValsalvaGamePage';
import { LoungePage } from './components/LoungePage';
import { TeenSpacePage } from './components/TeenSpacePage';
import { UserMailboxPage } from './components/UserMailboxPage';
import { ReportsPage } from './components/ReportsPage';
import { AdminReportsPage } from './components/AdminReportsPage';
import { RulesPage } from './components/RulesPage';
import { GenderPreferenceModal } from './components/GenderPreferenceModal';
import { ContactSupportModal } from './components/ContactSupportModal';
import { ViewState, UserAccount, AuthMode, ListenerGenderPreference, SupportCategory, DiscussionConversation } from './types';
import { getCurrentUser, getStoredUsers, initFirestoreUsersSync, isAdministrator } from './utils/userManagement';
import { 
  updateDiscussionGenderPreference, 
  initFirestoreDiscussionsSync,
  getActiveAnonymousDiscussion,
  getActiveUserDiscussion,
  createNewDiscussion,
  clearActiveDiscussionReferences
} from './utils/discussionManagement';
import { initFirestoreShareRequestsSync, setUserOnlineStatus } from './utils/shareManagement';
import { initFirestoreSupportRequestsSync } from './utils/supportRequests';
import { initFirestoreLoungeArticlesSync } from './utils/loungeManagement';
import { initFirestoreTeenSpaceArticlesSync } from './utils/teenSpaceManagement';
import { initFirestoreRulesSync } from './utils/rulesManagement';
import { subscribeToAuthState, firebaseSignOut } from './lib/firestoreService';

const DEFAULT_DEMO_LISTENER: UserAccount = {
  id: 'listener_demo',
  name: 'Team Listener',
  email: 'listener@3awdli.org',
  role: 'listener',
  is_listener: true,
  profession: 'Psychology Resident',
  createdAt: 'Today',
};

function resolveInitialRouteState(): { view: ViewState; token: string; email: string } {
  if (typeof window === 'undefined') {
    return { view: 'home', token: '', email: '' };
  }

  try {
    const url = new URL(window.location.href);
    const searchParams = url.searchParams;

    let token = searchParams.get('token') || searchParams.get('reset_token') || '';
    let email = searchParams.get('email') || '';
    const view = searchParams.get('view');
    const pathname = window.location.pathname.toLowerCase();

    // Check hash for hash-based redirects (#/reset-password?token=...)
    if (!token && window.location.hash) {
      const hashStr = window.location.hash.replace(/^#\/?/, '');
      const queryPart = hashStr.includes('?') ? hashStr.split('?')[1] : hashStr;
      const hashParams = new URLSearchParams(queryPart);
      token = hashParams.get('token') || hashParams.get('reset_token') || '';
      if (!email) {
        email = hashParams.get('email') || '';
      }
    }

    if (
      token || 
      pathname.includes('/reset-password') || 
      pathname.endsWith('reset-password') || 
      view === 'reset-password' || 
      window.location.hash.includes('reset-password')
    ) {
      return { view: 'reset-password', token, email };
    }

    if (
      view === 'rules' || 
      view === 'reglement' || 
      pathname.includes('/rules') || 
      pathname.includes('/reglement') || 
      window.location.hash.includes('rules') || 
      window.location.hash.includes('reglement')
    ) {
      return { view: 'rules', token: '', email: '' };
    }
  } catch (err) {
    console.warn('URL parsing error in resolveInitialRouteState:', err);
  }

  return { view: 'home', token: '', email: '' };
}

export default function App() {
  const { language } = useLanguage();
  const initialRoute = resolveInitialRouteState();
  const [currentView, setCurrentView] = useState<ViewState>(initialRoute.view);
  const [discussionsInitialTab, setDiscussionsInitialTab] = useState<'unopened' | 'mailbox'>('unopened');
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [isContactSupportOpen, setIsContactSupportOpen] = useState(false);
  const [contactSupportInitialCategory, setContactSupportInitialCategory] = useState<SupportCategory | undefined>(undefined);
  const [isGenderPreferenceModalOpen, setIsGenderPreferenceModalOpen] = useState(false);
  const [anonGenderPreference, setAnonGenderPreference] = useState<ListenerGenderPreference>(() => {
    try {
      return (localStorage.getItem('3awdli_anon_gender_preference') as ListenerGenderPreference) || 'any';
    } catch {
      return 'any';
    }
  });

  const [resetPasswordToken, setResetPasswordToken] = useState<string>(initialRoute.token);
  const [resetPasswordEmail, setResetPasswordEmail] = useState<string>(initialRoute.email);
  const [signInPrefillEmail, setSignInPrefillEmail] = useState<string>('');
  const [signInOpenForgot, setSignInOpenForgot] = useState<boolean>(false);

  // Check URL parameters for password reset links or direct navigation
  useEffect(() => {
    const handleLocationSync = () => {
      const route = resolveInitialRouteState();
      if (route.view === 'reset-password') {
        setResetPasswordToken(route.token);
        setResetPasswordEmail(route.email);
        setCurrentView('reset-password');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (route.view === 'rules') {
        setCurrentView('rules');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    handleLocationSync();

    window.addEventListener('popstate', handleLocationSync);
    window.addEventListener('hashchange', handleLocationSync);

    return () => {
      window.removeEventListener('popstate', handleLocationSync);
      window.removeEventListener('hashchange', handleLocationSync);
    };
  }, []);

  useEffect(() => {
    // Seed and refresh users
    getStoredUsers();
    const user = getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }

    // 1. Initialize real-time synchronization for all application collections with Firestore
    const unsubUsers = initFirestoreUsersSync();
    const unsubDiscussions = initFirestoreDiscussionsSync();
    const unsubShares = initFirestoreShareRequestsSync();
    const unsubSupports = initFirestoreSupportRequestsSync();
    const unsubLounge = initFirestoreLoungeArticlesSync();
    const unsubTeenSpace = initFirestoreTeenSpaceArticlesSync();
    const unsubRules = initFirestoreRulesSync();

    // 2. Subscribe to Firebase Auth state
    const unsubAuth = subscribeToAuthState((fbUser) => {
      if (fbUser) {
        const stored = getCurrentUser();
        if (stored && stored.email.toLowerCase() === (fbUser.email || '').toLowerCase()) {
          setCurrentUser(stored);
        }
      }
    });

    // 3. Listen to local update events to keep UI in sync
    const handleUserUpdated = () => {
      const updated = getCurrentUser();
      setCurrentUser(updated);
    };

    window.addEventListener('3awdli_users_updated', handleUserUpdated);
    window.addEventListener('storage', handleUserUpdated);

    return () => {
      unsubUsers();
      unsubDiscussions();
      unsubShares();
      unsubSupports();
      unsubLounge();
      unsubTeenSpace();
      unsubRules();
      unsubAuth();
      window.removeEventListener('3awdli_users_updated', handleUserUpdated);
      window.removeEventListener('storage', handleUserUpdated);
    };
  }, []);

  // Update current user online status in presence registry
  useEffect(() => {
    if (currentUser?.id) {
      setUserOnlineStatus(currentUser.id, true);
    }
  }, [currentUser?.id]);

  const [gamesInitialTab, setGamesInitialTab] = useState<string>('companion');

  const handlePlayBreathingGame = () => {
    setGamesInitialTab('breathing_pebble');
    setCurrentView('games');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePlayValsalvaGame = () => {
    setCurrentView('valsalva');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateLounge = () => {
    setCurrentView('lounge');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateTeenSpace = () => {
    setCurrentView('teen-space');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateRules = () => {
    setCurrentView('rules');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateMemberManagement = () => {
    setCurrentView('member-management');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAuth = (mode: AuthMode) => {
    if (mode === 'signin') {
      if (currentUser) {
        setCurrentView('dashboard');
      } else {
        setCurrentView('signin');
      }
    } else if (mode === 'signup') {
      setCurrentView('signup');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAuthSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    setCurrentView('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateUserMailbox = () => {
    setCurrentView('user-mailbox');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateReports = () => {
    setCurrentView('reports');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateAdminReports = () => {
    setCurrentView('admin-reports');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateAdminSupport = () => {
    setCurrentView('admin-support');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenContactSupport = (category?: SupportCategory) => {
    setContactSupportInitialCategory(category);
    setIsContactSupportOpen(true);
  };

  const handleCloseContactSupport = () => {
    setIsContactSupportOpen(false);
    setContactSupportInitialCategory(undefined);
  };

  const handleSignOut = () => {
    if (currentUser?.id) {
      setUserOnlineStatus(currentUser.id, false);
    }
    firebaseSignOut().catch(() => {});
    localStorage.removeItem('3awdli_current_user');
    setCurrentUser(null);
    setCurrentView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTalkAnonymously = () => {
    if (currentView !== 'home') {
      setCurrentView('home');
    }
    setIsGenderPreferenceModalOpen(true);
  };

  const handleConfirmGenderPreference = (preference: ListenerGenderPreference) => {
    setAnonGenderPreference(preference);
    try {
      localStorage.setItem('3awdli_anon_gender_preference', preference);
    } catch {
      // localStorage fallback
    }

    // Clicking "Talk Openly" / "Talk Anonymously" unconditionally creates a brand new discussion
    // with a new unique ID every time, with no reference to any previous discussion
    clearActiveDiscussionReferences(undefined, currentUser?.id);

    const targetDisc = currentUser
      ? createNewDiscussion('registered', {
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email,
          genderPreference: preference,
        })
      : createNewDiscussion('anonymous', { genderPreference: preference });

    setIsGenderPreferenceModalOpen(false);
    setIsChatOpen(true);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('3awdli_open_new_discussion', { detail: { discussion: targetDisc } }));
    }
  };

  const handleNavigateSignInFromReset = (prefillEmail?: string, openForgotModal?: boolean) => {
    if (prefillEmail) {
      setSignInPrefillEmail(prefillEmail);
    }
    setSignInOpenForgot(Boolean(openForgotModal));
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    setCurrentView('signin');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Dedicated page rendering based on view state
  if (currentView === 'reset-password') {
    return (
      <>
        <ResetPasswordPage
          token={resetPasswordToken}
          initialEmail={resetPasswordEmail}
          onNavigateSignIn={handleNavigateSignInFromReset}
          onNavigateHome={() => {
            setCurrentView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateGames={() => {
            setCurrentView('games');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateTeenSpace={handleNavigateTeenSpace}
          onNavigateLounge={handleNavigateLounge}
          onNavigateRules={handleNavigateRules}
          onOpenContactSupport={() => setIsContactSupportOpen(true)}
          onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
          onTalkAnonymously={handleTalkAnonymously}
        />
        <ContactSupportModal
          isOpen={isContactSupportOpen}
          onClose={handleCloseContactSupport}
          currentUser={currentUser}
          initialCategory={contactSupportInitialCategory}
          onRedirectToChat={handleTalkAnonymously}
        />
        <EmergencyModal
          isOpen={isEmergencyModalOpen}
          onClose={() => setIsEmergencyModalOpen(false)}
          onTalkAnonymously={handleTalkAnonymously}
        />
      </>
    );
  }

  if (currentView === 'signin') {
    return (
      <>
        <SignInPage
          initialEmail={signInPrefillEmail}
          openForgotOnMount={signInOpenForgot}
          onSuccess={handleAuthSuccess}
          onNavigateToSignUp={() => {
            setCurrentView('signup');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateHome={() => {
            setCurrentView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateGames={() => {
            setCurrentView('games');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateTeenSpace={handleNavigateTeenSpace}
          onNavigateLounge={handleNavigateLounge}
          onNavigateRules={handleNavigateRules}
          onOpenContactSupport={handleOpenContactSupport}
          onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
          onTalkAnonymously={handleTalkAnonymously}
        />
        <ContactSupportModal
          isOpen={isContactSupportOpen}
          onClose={handleCloseContactSupport}
          currentUser={currentUser}
          initialCategory={contactSupportInitialCategory}
          onRedirectToChat={handleTalkAnonymously}
        />
        <EmergencyModal
          isOpen={isEmergencyModalOpen}
          onClose={() => setIsEmergencyModalOpen(false)}
          onTalkAnonymously={handleTalkAnonymously}
        />
      </>
    );
  }

  if (currentView === 'signup') {
    return (
      <>
        <SignUpPage
          onSuccess={handleAuthSuccess}
          onNavigateToSignIn={() => {
            setCurrentView('signin');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateHome={() => {
            setCurrentView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateGames={() => {
            setCurrentView('games');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateTeenSpace={handleNavigateTeenSpace}
          onNavigateLounge={handleNavigateLounge}
          onNavigateRules={handleNavigateRules}
          onOpenContactSupport={handleOpenContactSupport}
          onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
          onTalkAnonymously={handleTalkAnonymously}
        />
        <ContactSupportModal
          isOpen={isContactSupportOpen}
          onClose={handleCloseContactSupport}
          currentUser={currentUser}
          initialCategory={contactSupportInitialCategory}
          onRedirectToChat={handleTalkAnonymously}
        />
        <EmergencyModal
          isOpen={isEmergencyModalOpen}
          onClose={() => setIsEmergencyModalOpen(false)}
          onTalkAnonymously={handleTalkAnonymously}
        />
      </>
    );
  }

  if (currentView === 'discussions') {
    const activeListenerUser: UserAccount = currentUser || DEFAULT_DEMO_LISTENER;

    return (
      <>
        <DiscussionsPage
          user={activeListenerUser}
          initialTab={discussionsInitialTab}
          onNavigateHome={() => {
            setCurrentView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateDashboard={() => {
            setCurrentView('dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateAdmin={isAdministrator(currentUser) ? () => {
            setCurrentView('admin');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } : undefined}
          onNavigateMemberManagement={isAdministrator(currentUser) ? handleNavigateMemberManagement : undefined}
          onNavigateGames={() => {
            setCurrentView('games');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateTeenSpace={handleNavigateTeenSpace}
          onNavigateLounge={handleNavigateLounge}
          onNavigateRules={handleNavigateRules}
          onNavigateReports={handleNavigateReports}
          onNavigateAdminReports={isAdministrator(currentUser) ? handleNavigateAdminReports : undefined}
          onNavigateAdminSupport={isAdministrator(currentUser) ? handleNavigateAdminSupport : undefined}
          onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
          onOpenContactSupport={handleOpenContactSupport}
          onTalkAnonymously={handleTalkAnonymously}
          onSignOut={handleSignOut}
        />
        <ContactSupportModal
          isOpen={isContactSupportOpen}
          onClose={handleCloseContactSupport}
          currentUser={currentUser}
          initialCategory={contactSupportInitialCategory}
          onRedirectToChat={handleTalkAnonymously}
        />
        <EmergencyModal
          isOpen={isEmergencyModalOpen}
          onClose={() => setIsEmergencyModalOpen(false)}
          onTalkAnonymously={handleTalkAnonymously}
        />
      </>
    );
  }

  if (currentView === 'admin' || currentView === 'member-management' || currentView === 'admin-support') {
    const adminUser: UserAccount = currentUser || {
      id: 'admin_super',
      name: 'Aymane (Admin)',
      email: 'aymaneoumlala@gmail.com',
      role: 'admin',
      is_administrator: true,
      is_founder: true,
      createdAt: '2024-01-01',
    };

    return (
      <>
        <AdminRoleManagement
          currentUser={adminUser}
          mode={currentView === 'member-management' ? 'member-management' : (currentView === 'admin-support' ? 'admin-support' : 'admin')}
          initialTab={currentView === 'admin-support' ? 'support_requests' : undefined}
          onNavigateHome={() => {
            setCurrentView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateDashboard={() => {
            setCurrentView('dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateDiscussions={(tab) => {
            setDiscussionsInitialTab(tab || 'unopened');
            setCurrentView('discussions');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateGames={() => {
            setCurrentView('games');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateTeenSpace={handleNavigateTeenSpace}
          onNavigateLounge={handleNavigateLounge}
          onNavigateRules={handleNavigateRules}
          onNavigateAdmin={() => {
            setCurrentView('admin');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateMemberManagement={handleNavigateMemberManagement}
          onNavigateAdminReports={handleNavigateAdminReports}
          onNavigateAdminSupport={handleNavigateAdminSupport}
          onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
          onOpenContactSupport={handleOpenContactSupport}
          onTalkAnonymously={handleTalkAnonymously}
          onSignOut={handleSignOut}
          onSwitchUser={(switched) => {
            setCurrentUser(switched);
            localStorage.setItem('3awdli_current_user', JSON.stringify(switched));
            setCurrentView('dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
        <ContactSupportModal
          isOpen={isContactSupportOpen}
          onClose={handleCloseContactSupport}
          currentUser={currentUser}
          initialCategory={contactSupportInitialCategory}
          onRedirectToChat={handleTalkAnonymously}
        />
        <EmergencyModal
          isOpen={isEmergencyModalOpen}
          onClose={() => setIsEmergencyModalOpen(false)}
          onTalkAnonymously={handleTalkAnonymously}
        />
      </>
    );
  }

  if (currentView === 'dashboard' && currentUser) {
    return (
      <>
        <PersonalDashboard
          user={currentUser}
          onSignOut={handleSignOut}
          onNavigateHome={() => {
            setCurrentView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateDiscussions={(tab) => {
            setDiscussionsInitialTab(tab || 'unopened');
            setCurrentView('discussions');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateAdmin={isAdministrator(currentUser) ? () => {
            setCurrentView('admin');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } : undefined}
          onNavigateMemberManagement={isAdministrator(currentUser) ? handleNavigateMemberManagement : undefined}
          onNavigateGames={() => {
            setCurrentView('games');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateTeenSpace={handleNavigateTeenSpace}
          onNavigateLounge={handleNavigateLounge}
          onNavigateRules={handleNavigateRules}
          onNavigateMailbox={handleNavigateUserMailbox}
          onNavigateReports={handleNavigateReports}
          onNavigateAdminReports={isAdministrator(currentUser) ? handleNavigateAdminReports : undefined}
          onNavigateAdminSupport={isAdministrator(currentUser) ? handleNavigateAdminSupport : undefined}
          onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
          onOpenContactSupport={handleOpenContactSupport}
          onTalkAnonymously={handleTalkAnonymously}
        />
        <ContactSupportModal
          isOpen={isContactSupportOpen}
          onClose={handleCloseContactSupport}
          currentUser={currentUser}
          initialCategory={contactSupportInitialCategory}
          onRedirectToChat={handleTalkAnonymously}
        />
        <EmergencyModal
          isOpen={isEmergencyModalOpen}
          onClose={() => setIsEmergencyModalOpen(false)}
          onTalkAnonymously={handleTalkAnonymously}
        />
      </>
    );
  }

  if (currentView === 'user-mailbox' && currentUser) {
    return (
      <>
        <UserMailboxPage
          currentUser={currentUser}
          onNavigateHome={() => {
            setCurrentView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateDashboard={() => {
            setCurrentView('dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateGames={() => {
            setCurrentView('games');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateTeenSpace={handleNavigateTeenSpace}
          onNavigateLounge={handleNavigateLounge}
          onNavigateRules={handleNavigateRules}
          onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
          onOpenContactSupport={() => setIsContactSupportOpen(true)}
          onTalkAnonymously={handleTalkAnonymously}
          onSignOut={handleSignOut}
        />
        <ContactSupportModal
          isOpen={isContactSupportOpen}
          onClose={() => setIsContactSupportOpen(false)}
          currentUser={currentUser}
          onRedirectToChat={handleTalkAnonymously}
        />
        <EmergencyModal
          isOpen={isEmergencyModalOpen}
          onClose={() => setIsEmergencyModalOpen(false)}
          onTalkAnonymously={handleTalkAnonymously}
        />
      </>
    );
  }

  if (currentView === 'games') {
    return (
      <>
        <GamesPage
          initialGameId={gamesInitialTab}
          currentUser={currentUser}
          onNavigateHome={() => {
            setCurrentView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateDashboard={() => {
            setCurrentView('dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateDiscussions={(tab) => {
            setDiscussionsInitialTab(tab || 'unopened');
            setCurrentView('discussions');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateAdmin={isAdministrator(currentUser) ? () => {
            setCurrentView('admin');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } : undefined}
          onNavigateMemberManagement={isAdministrator(currentUser) ? handleNavigateMemberManagement : undefined}
          onNavigateTeenSpace={handleNavigateTeenSpace}
          onNavigateLounge={handleNavigateLounge}
          onNavigateRules={handleNavigateRules}
          onNavigateMailbox={handleNavigateUserMailbox}
          onOpenContactSupport={() => setIsContactSupportOpen(true)}
          onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
          onOpenAuth={handleOpenAuth}
          onTalkAnonymously={handleTalkAnonymously}
          onSignOut={handleSignOut}
        />
        <ContactSupportModal
          isOpen={isContactSupportOpen}
          onClose={() => setIsContactSupportOpen(false)}
          currentUser={currentUser}
          onRedirectToChat={handleTalkAnonymously}
        />
        <EmergencyModal
          isOpen={isEmergencyModalOpen}
          onClose={() => setIsEmergencyModalOpen(false)}
          onTalkAnonymously={handleTalkAnonymously}
        />
      </>
    );
  }

  if (currentView === 'valsalva') {
    return (
      <>
        <ValsalvaGamePage
          currentUser={currentUser}
          onNavigateHome={() => {
            setCurrentView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateGames={() => {
            setGamesInitialTab('valsalva');
            setCurrentView('games');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateDashboard={() => {
            setCurrentView('dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateDiscussions={(tab) => {
            setDiscussionsInitialTab(tab || 'unopened');
            setCurrentView('discussions');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateTeenSpace={handleNavigateTeenSpace}
          onNavigateLounge={handleNavigateLounge}
          onNavigateRules={handleNavigateRules}
          onNavigateMailbox={handleNavigateUserMailbox}
          onOpenContactSupport={() => setIsContactSupportOpen(true)}
          onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
          onOpenAuth={handleOpenAuth}
          onTalkAnonymously={handleTalkAnonymously}
          onSignOut={handleSignOut}
        />
        <ContactSupportModal
          isOpen={isContactSupportOpen}
          onClose={() => setIsContactSupportOpen(false)}
          currentUser={currentUser}
          onRedirectToChat={handleTalkAnonymously}
        />
        <EmergencyModal
          isOpen={isEmergencyModalOpen}
          onClose={() => setIsEmergencyModalOpen(false)}
          onTalkAnonymously={handleTalkAnonymously}
        />
      </>
    );
  }

  if (currentView === 'lounge') {
    return (
      <>
        <LoungePage
          currentUser={currentUser}
          onNavigateHome={() => {
            setCurrentView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateDashboard={() => {
            setCurrentView('dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateDiscussions={(tab) => {
            setDiscussionsInitialTab(tab || 'unopened');
            setCurrentView('discussions');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateAdmin={isAdministrator(currentUser) ? () => {
            setCurrentView('admin');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } : undefined}
          onNavigateMemberManagement={isAdministrator(currentUser) ? handleNavigateMemberManagement : undefined}
          onNavigateGames={() => {
            setCurrentView('games');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateTeenSpace={handleNavigateTeenSpace}
          onNavigateRules={handleNavigateRules}
          onNavigateMailbox={handleNavigateUserMailbox}
          onNavigateSignIn={() => {
            setCurrentView('signin');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateSignUp={() => {
            setCurrentView('signup');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
          onOpenContactSupport={() => setIsContactSupportOpen(true)}
          onTalkAnonymously={handleTalkAnonymously}
          onSignOut={handleSignOut}
        />
        <ContactSupportModal
          isOpen={isContactSupportOpen}
          onClose={() => setIsContactSupportOpen(false)}
          currentUser={currentUser}
          onRedirectToChat={handleTalkAnonymously}
        />
        <EmergencyModal
          isOpen={isEmergencyModalOpen}
          onClose={() => setIsEmergencyModalOpen(false)}
          onTalkAnonymously={handleTalkAnonymously}
        />
      </>
    );
  }

  if (currentView === 'teen-space') {
    return (
      <>
        <TeenSpacePage
          currentUser={currentUser}
          onNavigateHome={() => {
            setCurrentView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateDashboard={() => {
            setCurrentView('dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateDiscussions={(tab) => {
            setDiscussionsInitialTab(tab || 'unopened');
            setCurrentView('discussions');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateAdmin={isAdministrator(currentUser) ? () => {
            setCurrentView('admin');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } : undefined}
          onNavigateMemberManagement={isAdministrator(currentUser) ? handleNavigateMemberManagement : undefined}
          onNavigateGames={() => {
            setCurrentView('games');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateTeenSpace={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          onNavigateLounge={handleNavigateLounge}
          onNavigateRules={handleNavigateRules}
          onNavigateMailbox={handleNavigateUserMailbox}
          onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
          onOpenContactSupport={() => setIsContactSupportOpen(true)}
          onOpenAuth={handleOpenAuth}
          onTalkAnonymously={handleTalkAnonymously}
          onSignOut={handleSignOut}
        />
        <ContactSupportModal
          isOpen={isContactSupportOpen}
          onClose={() => setIsContactSupportOpen(false)}
          currentUser={currentUser}
          onRedirectToChat={handleTalkAnonymously}
        />
        <EmergencyModal
          isOpen={isEmergencyModalOpen}
          onClose={() => setIsEmergencyModalOpen(false)}
          onTalkAnonymously={handleTalkAnonymously}
        />
      </>
    );
  }

  if (currentView === 'rules') {
    return (
      <>
        <RulesPage
          currentUser={currentUser}
          onNavigateHome={() => {
            setCurrentView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateDashboard={() => {
            setCurrentView('dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateDiscussions={(tab) => {
            setDiscussionsInitialTab(tab || 'unopened');
            setCurrentView('discussions');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateAdmin={isAdministrator(currentUser) ? () => {
            setCurrentView('admin');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } : undefined}
          onNavigateMemberManagement={isAdministrator(currentUser) ? handleNavigateMemberManagement : undefined}
          onNavigateGames={() => {
            setCurrentView('games');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateTeenSpace={handleNavigateTeenSpace}
          onNavigateLounge={handleNavigateLounge}
          onNavigateRules={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          onNavigateMailbox={handleNavigateUserMailbox}
          onNavigateSignIn={() => {
            setCurrentView('signin');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateSignUp={() => {
            setCurrentView('signup');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
          onOpenContactSupport={handleOpenContactSupport}
          onOpenAuth={handleOpenAuth}
          onTalkAnonymously={handleTalkAnonymously}
          onSignOut={handleSignOut}
        />
        <ContactSupportModal
          isOpen={isContactSupportOpen}
          onClose={handleCloseContactSupport}
          currentUser={currentUser}
          initialCategory={contactSupportInitialCategory}
          onRedirectToChat={handleTalkAnonymously}
        />
        <EmergencyModal
          isOpen={isEmergencyModalOpen}
          onClose={() => setIsEmergencyModalOpen(false)}
          onTalkAnonymously={handleTalkAnonymously}
        />
      </>
    );
  }

  if (currentView === 'reports') {
    const activeHeadUser: UserAccount = currentUser || {
      id: 'head_demo',
      name: 'Head of Listeners',
      email: 'head@3awdli.org',
      role: 'listener',
      is_listener: true,
      is_head_of_listeners: true,
      createdAt: 'Today',
    };

    return (
      <>
        <ReportsPage
          currentUser={activeHeadUser}
          onNavigateHome={() => {
            setCurrentView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateDashboard={() => {
            setCurrentView('dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateDiscussions={(tab) => {
            setDiscussionsInitialTab(tab || 'unopened');
            setCurrentView('discussions');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateAdmin={isAdministrator(currentUser) ? () => {
            setCurrentView('admin');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } : undefined}
          onNavigateAdminReports={isAdministrator(currentUser) ? handleNavigateAdminReports : undefined}
          onNavigateMemberManagement={isAdministrator(currentUser) ? handleNavigateMemberManagement : undefined}
          onNavigateGames={() => {
            setCurrentView('games');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateTeenSpace={handleNavigateTeenSpace}
          onNavigateLounge={handleNavigateLounge}
          onNavigateRules={handleNavigateRules}
          onNavigateMailbox={handleNavigateUserMailbox}
          onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
          onOpenContactSupport={() => setIsContactSupportOpen(true)}
          onTalkAnonymously={handleTalkAnonymously}
          onSignOut={handleSignOut}
        />
        <ContactSupportModal
          isOpen={isContactSupportOpen}
          onClose={() => setIsContactSupportOpen(false)}
          currentUser={currentUser}
          onRedirectToChat={handleTalkAnonymously}
        />
        <EmergencyModal
          isOpen={isEmergencyModalOpen}
          onClose={() => setIsEmergencyModalOpen(false)}
          onTalkAnonymously={handleTalkAnonymously}
        />
      </>
    );
  }

  if (currentView === 'admin-reports') {
    const activeAdminUser: UserAccount = currentUser || {
      id: 'admin_demo',
      name: 'Administrator',
      email: 'admin@3awdli.org',
      role: 'administrator',
      is_admin: true,
      is_administrator: true,
      createdAt: 'Today',
    };

    return (
      <>
        <AdminReportsPage
          currentUser={activeAdminUser}
          onNavigateHome={() => {
            setCurrentView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateDashboard={() => {
            setCurrentView('dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateDiscussions={(tab) => {
            setDiscussionsInitialTab(tab || 'unopened');
            setCurrentView('discussions');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateAdmin={isAdministrator(currentUser) ? () => {
            setCurrentView('admin');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } : undefined}
          onNavigateMemberManagement={isAdministrator(currentUser) ? handleNavigateMemberManagement : undefined}
          onNavigateReports={handleNavigateReports}
          onNavigateAdminSupport={isAdministrator(currentUser) ? handleNavigateAdminSupport : undefined}
          onNavigateGames={() => {
            setCurrentView('games');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateTeenSpace={handleNavigateTeenSpace}
          onNavigateLounge={handleNavigateLounge}
          onNavigateRules={handleNavigateRules}
          onNavigateMailbox={handleNavigateUserMailbox}
          onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
          onOpenContactSupport={handleOpenContactSupport}
          onTalkAnonymously={handleTalkAnonymously}
          onSignOut={handleSignOut}
        />
        <ContactSupportModal
          isOpen={isContactSupportOpen}
          onClose={handleCloseContactSupport}
          currentUser={currentUser}
          initialCategory={contactSupportInitialCategory}
          onRedirectToChat={handleTalkAnonymously}
        />
        <EmergencyModal
          isOpen={isEmergencyModalOpen}
          onClose={() => setIsEmergencyModalOpen(false)}
          onTalkAnonymously={handleTalkAnonymously}
        />
      </>
    );
  }

  return (
    <>
      {/* Shared Persistent Sidebar & Sticky Top Navigation */}
      <Navbar
        currentView="home"
        currentUser={currentUser}
        onNavigateHome={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        onNavigateDashboard={() => {
          setCurrentView('dashboard');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onNavigateDiscussions={(tab) => {
          setDiscussionsInitialTab(tab || 'unopened');
          setCurrentView('discussions');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onNavigateAdmin={isAdministrator(currentUser) ? () => {
          setCurrentView('admin');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } : undefined}
        onNavigateAdminReports={isAdministrator(currentUser) ? handleNavigateAdminReports : undefined}
        onNavigateAdminSupport={isAdministrator(currentUser) ? handleNavigateAdminSupport : undefined}
        onNavigateMemberManagement={isAdministrator(currentUser) ? handleNavigateMemberManagement : undefined}
        onNavigateGames={() => {
          setCurrentView('games');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onNavigateTeenSpace={handleNavigateTeenSpace}
        onNavigateLounge={handleNavigateLounge}
        onNavigateRules={handleNavigateRules}
        onNavigateMailbox={handleNavigateUserMailbox}
        onNavigateReports={handleNavigateReports}
        onOpenContactSupport={handleOpenContactSupport}
        onOpenAuth={handleOpenAuth}
        onTalkAnonymously={handleTalkAnonymously}
        onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
        onSignOut={handleSignOut}
      >
        {/* Main Content Area */}
        <main className="flex-1">
        {/* TOP SECTION */}
        <section className="pt-14 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
          
          {/* 1. LOGO: Rendered as a simple plain image, prominent and unboxed */}
          <div className="flex justify-center mb-8 sm:mb-10">
            <Logo className="w-24 h-24 sm:w-28 sm:h-28" />
          </div>

          {/* 2. TAGLINE: Free, Non-profit & Confidential Mental Health Initiative */}
          <div className="flex justify-center mb-7 sm:mb-9">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#EBF2EE] border border-[#D3E4DB] text-[#28493A] text-xs font-medium tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              <span>
                {language === 'ar'
                  ? 'مبادرة صحة نفسية غير ربحية، مجانية وسرية'
                  : language === 'fr'
                  ? 'Initiative de soutien psychologique bénévole, gratuite & confidentielle'
                  : 'Free, Non-profit & Confidential Mental Health Initiative'}
              </span>
            </div>
          </div>

          {/* Calm Main Heading */}
          <div className="text-center max-w-2xl mx-auto mb-14 sm:mb-20">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-normal text-[#1B2B22] tracking-tight leading-[1.25] font-['Lora',serif]">
              {language === 'ar'
                ? 'لست مضطراً لحمل أعبائك وحدك.'
                : language === 'fr'
                ? 'Vous n\'avez pas à porter vos fardeaux tout seul.'
                : 'You don\'t have to carry your burdens all by yourself.'}
            </h1>
            <p className="mt-4 sm:mt-5 text-base sm:text-lg text-[#5A6961] leading-relaxed font-light">
              {language === 'ar' ? (
                <>مرحباً بكم في <span className="font-medium text-[#274738]">عاودلي</span> — أذن صاغية وملاذ آمن، متاح دائماً متى ما أردت التحدث.</>
              ) : language === 'fr' ? (
                <>Bienvenue sur <span className="font-medium text-[#274738]">3awdli</span> — une oreille attentive et bienveillante, disponible dès que vous en ressentez le besoin.</>
              ) : (
                <>Welcome to <span className="font-medium text-[#274738]">3awdli</span> — a compassionate listening ear, ready whenever you need to open up.</>
              )}
            </p>
          </div>

          {/* 3. GAME PROMOTIONS: Calm, uncluttered promotional callouts side by side (placed before introduction text) */}
          <div className="max-w-3xl mx-auto mb-16 sm:mb-24">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-7">
              {/* Promotion 1: Breathing Game */}
              <div 
                id="homepage-breathing-promo-card"
                className="bg-white/80 backdrop-blur-xs border border-[#E0E8E2] rounded-3xl p-6 sm:p-7 shadow-2xs hover:shadow-xs transition-all duration-300 flex flex-col justify-between text-start"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-9 h-9 rounded-xl bg-[#EAF2ED] text-[#244534] flex items-center justify-center border border-[#D5E3DA]">
                      <Wind className="w-4.5 h-4.5" />
                    </div>
                    <span className="text-[11px] font-medium text-[#355745] bg-[#EDF4F0] px-2.5 py-0.5 rounded-full border border-[#DBE9DF]">
                      {language === 'ar' ? 'تمرين تنفس' : language === 'fr' ? 'Respiration' : 'Breathing'}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-semibold font-['Lora',serif] text-[#1B2D23] mb-2 leading-snug">
                    {language === 'ar'
                      ? 'تشعر بالقلق؟ جرّب تمرين التنفس الموجه'
                      : language === 'fr'
                      ? 'Vous vous sentez anxieux ? Essayez un exercice de respiration'
                      : 'Feeling anxious? Try a guided breathing exercise'}
                  </h3>

                  <p className="text-xs sm:text-sm text-[#5D6F64] leading-relaxed mb-6 font-light">
                    {language === 'ar'
                      ? 'إيقاع بصري لطيف وبسيط يساعدك على إبطاء نبضات قلبك وتهدئة التوتر في لحظات.'
                      : language === 'fr'
                      ? 'Un rythme visuel apaisant pour relâcher les tensions et retrouver la sérénité.'
                      : 'A gentle rhythmic guide to help slow your breathing and soothe your nervous system.'}
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    id="homepage-play-breathing-btn"
                    onClick={handlePlayBreathingGame}
                    className="w-full py-2.5 px-4 bg-[#2D4D3D] hover:bg-[#20392C] text-white font-medium text-xs sm:text-sm rounded-xl shadow-2xs hover:shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 text-emerald-200 fill-emerald-200" />
                    <span>{language === 'ar' ? 'ابدأ اللعب' : language === 'fr' ? 'Jouer' : 'Play'}</span>
                  </button>
                </div>
              </div>

              {/* Promotion 2: Valsalva Technique Game */}
              <div 
                id="homepage-valsalva-promo-card"
                className="bg-white/80 backdrop-blur-xs border border-[#E7E2D8] rounded-3xl p-6 sm:p-7 shadow-2xs hover:shadow-xs transition-all duration-300 flex flex-col justify-between text-start"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-9 h-9 rounded-xl bg-[#F2EDE4] text-[#3E4F44] flex items-center justify-center border border-[#E2DDD2]">
                      <Activity className="w-4.5 h-4.5" />
                    </div>
                    <span className="text-[11px] font-medium text-[#46594C] bg-[#F2ECE3] px-2.5 py-0.5 rounded-full border border-[#E2DAD0]">
                      {language === 'ar' ? 'تهدئة القلب' : language === 'fr' ? 'Apaisement' : 'Vagus Reset'}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-semibold font-['Lora',serif] text-[#1B2D23] mb-2 leading-snug">
                    {language === 'ar'
                      ? 'تقنية فالسالفا: إعادة ضبط نبضك'
                      : language === 'fr'
                      ? 'Technique de Valsalva : Régulez vos battements'
                      : 'Valsalva Technique: Reset your heart rate'}
                  </h3>

                  <p className="text-xs sm:text-sm text-[#5D6F64] leading-relaxed mb-6 font-light">
                    {language === 'ar'
                      ? 'طريقة تفاعلية خطوة بخطوة لتنشيط العصب الحائر وتخفيف خفقان القلب السريع.'
                      : language === 'fr'
                      ? 'Une technique guidée pour stimuler le nerf vague et apaiser les palpitations.'
                      : 'A guided interactive technique to stimulate the vagus nerve and gently slow rapid heartbeats.'}
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    id="homepage-play-valsalva-btn"
                    onClick={handlePlayValsalvaGame}
                    className="w-full py-2.5 px-4 bg-[#3E5547] hover:bg-[#2E4135] text-white font-medium text-xs sm:text-sm rounded-xl shadow-2xs hover:shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 text-emerald-200 fill-emerald-200" />
                    <span>{language === 'ar' ? 'ابدأ اللعب' : language === 'fr' ? 'Jouer' : 'Play'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 4. EXACT REQUIRED INTRODUCTION TEXT: Now positioned AFTER the game cards */}
          <div 
            id="prominent-introduction-card"
            className="max-w-2xl mx-auto bg-white/75 backdrop-blur-xs border border-[#E3DDD3] rounded-3xl p-7 sm:p-9 shadow-2xs mb-20 sm:mb-28 text-center relative"
          >
            <p className="text-base sm:text-lg text-[#2A342E] leading-relaxed font-['Lora',serif] font-normal italic">
              {language === 'ar' ? (
                <>
                  &ldquo;في 3awdli، نؤمن أنك لست مضطراً لحمل معاناتك بمفردك. لماذا لا نتحدث بينما نحن هنا من أجلك؟ <strong className="font-bold text-[#14231B]">تواصل معنا</strong> <strong className="font-bold text-[#14231B]">مجاناً</strong>، <strong className="font-bold text-[#14231B]">واحكِ لنا</strong> ما يقلقك بكل حرية وسرية، فمشاكلك تستحق أن يُستمع إليها.&rdquo;
                </>
              ) : language === 'fr' ? (
                <>
                  &ldquo;Sur 3awdli, nous croyons que vous n&apos;avez pas à porter vos souffrances seuls. Pourquoi ne pas en parler alors que nous sommes là ? <strong className="font-bold text-[#14231B]">Contactez-nous</strong> <strong className="font-bold text-[#14231B]">gratuitement</strong>, <strong className="font-bold text-[#14231B]">racontez-nous</strong> ce qui vous préoccupe en toute liberté et confidentialité, car vos problèmes méritent d&apos;être écoutés.&rdquo;
                </>
              ) : (
                <>
                  &ldquo;At 3awdli, we believe you don&apos;t have to carry your burdens all by yourself. Why not talk about it when we&apos;re here? <strong className="font-bold text-[#14231B]">Contact us</strong> <strong className="font-bold text-[#14231B]">for free</strong>, <strong className="font-bold text-[#14231B]">tell us</strong> what&apos;s troubling you in complete freedom and confidentiality, because your problems deserve to be heard.&rdquo;
                </>
              )}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[#5D6F64] font-['Plus_Jakarta_Sans',sans-serif]">
              <span className="font-medium text-[#2A4839] not-italic">
                {language === 'ar' ? '— فريق 3awdli' : language === 'fr' ? '— L\'équipe 3awdli' : '— The 3awdli Team'}
              </span>
              <span>&bull;</span>
              <span>{language === 'ar' ? 'مجاني وسري' : language === 'fr' ? 'Gratuit & Confidentiel' : 'Free & Confidential'}</span>
            </div>
          </div>

          {/* 5. THREE SUPPORTIVE WINDOWS: Simplified, serene, zero visual pressure */}
          <div className="mb-10 sm:mb-12 text-center max-w-lg mx-auto">
            <h2 className="text-xl sm:text-2xl font-normal text-[#1C2C23] font-['Lora',serif]">
              {language === 'ar'
                ? 'مساحات مخصصة لراحتك'
                : language === 'fr'
                ? 'Espaces d\'apaisement'
                : 'Spaces for calm & connection'}
            </h2>
            <p className="text-xs sm:text-sm text-[#63726A] mt-1.5 font-light">
              {language === 'ar'
                ? 'خذ وقتك لاستكشاف المساحات المصممة لدعمك بكل هدوء وبدون أي ضغوط.'
                : language === 'fr'
                ? 'Prenez le temps d\'explorer nos espaces créés avec bienveillance.'
                : 'Take your time to explore our supportive spaces at your own pace.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* WINDOW 1: The Lounge */}
            <div 
              id="window-the-lounge"
              className="bg-white/80 backdrop-blur-xs border border-[#E3DDD1] rounded-3xl p-6 sm:p-7 shadow-2xs hover:shadow-xs transition-all duration-300 flex flex-col justify-between text-start"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#EAF2ED] text-[#274737] flex items-center justify-center border border-[#D2E2D8]">
                    <Coffee className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-medium bg-[#EBF0EC] text-[#3A5647] px-2.5 py-0.5 rounded-full border border-[#D8E4DC]">
                    {language === 'ar' ? 'مجتمع' : language === 'fr' ? 'Communauté' : 'Community'}
                  </span>
                </div>
                <h3 className="text-lg font-semibold font-['Lora',serif] text-[#1E2E25] mb-2">
                  {language === 'ar' ? 'الصالون' : language === 'fr' ? 'Le Salon' : 'The Lounge'}
                </h3>
                <p className="text-xs sm:text-sm text-[#5D6B63] leading-relaxed mb-6 font-light">
                  {language === 'ar'
                    ? 'حلقات نقاش وتأملات هادفة يشاركها أخصائيون نفسيون وميسرون ذوو خبرة في بيئة آمنة.'
                    : language === 'fr'
                    ? 'Participez à des cercles d\'échange thématiques et des réflexions apaisantes partagées par des spécialistes.'
                    : 'Step into curated group exchange circles and thoughtful reflections guided by empathetic facilitators.'}
                </p>
              </div>

              <div>
                <button
                  type="button"
                  id="visit-lounge-btn"
                  onClick={handleNavigateLounge}
                  className="w-full py-2.5 px-4 bg-[#315243] hover:bg-[#253E33] text-white font-medium text-xs sm:text-sm rounded-xl shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{language === 'ar' ? 'زيارة الصالون' : language === 'fr' ? 'Visiter Le Salon' : 'Visit The Lounge'}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-200 rtl:rotate-180" />
                </button>
              </div>
            </div>

            {/* WINDOW 2: Teen Space */}
            <div 
              id="window-teen-space"
              className="bg-white/80 backdrop-blur-xs border border-[#E3DDD1] rounded-3xl p-6 sm:p-7 shadow-2xs hover:shadow-xs transition-all duration-300 flex flex-col justify-between text-start"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#F2EFE8] text-[#33463B] flex items-center justify-center border border-[#E2DDCF]">
                    <Compass className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-medium bg-[#EBF0EC] text-[#345443] px-2.5 py-0.5 rounded-full border border-[#D5E4DB]">
                    {language === 'ar' ? 'شباب' : language === 'fr' ? 'Jeunesse' : 'Youth'}
                  </span>
                </div>
                <h3 className="text-lg font-semibold font-['Lora',serif] text-[#1E2E25] mb-2">
                  {language === 'ar' ? 'فضاء اليافعين' : language === 'fr' ? 'Espace Ados' : 'Teen Space'}
                </h3>
                <p className="text-xs sm:text-sm text-[#5D6B63] leading-relaxed mb-6 font-light">
                  {language === 'ar'
                    ? 'ملاذ لليافعين للحديث عن ضغوط الدراسة، الصداقات، والعلاقات الأسرية بدون أحكام مسبقة.'
                    : language === 'fr'
                    ? 'Un espace dédié aux ados pour aborder le stress des études et les doutes avec bienveillance.'
                    : 'A dedicated sanctuary for youth dealing with school stress, friendships, and life questions.'}
                </p>
              </div>

              <div>
                <button
                  type="button"
                  id="visit-teen-space-btn"
                  onClick={handleNavigateTeenSpace}
                  className="w-full py-2.5 px-4 bg-[#F2EFE8] hover:bg-[#E5E0D5] text-[#24372C] font-medium text-xs sm:text-sm rounded-xl border border-[#D9D2C4] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{language === 'ar' ? 'زيارة فضاء اليافعين' : language === 'fr' ? 'Visiter l\'Espace Ados' : 'Visit Teen Space'}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#315243] rtl:rotate-180" />
                </button>
              </div>
            </div>

            {/* WINDOW 3: Games */}
            <div 
              id="window-games"
              className="bg-white/80 backdrop-blur-xs border border-[#E3DDD1] rounded-3xl p-6 sm:p-7 shadow-2xs hover:shadow-xs transition-all duration-300 flex flex-col justify-between text-start"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#E7F0EB] text-[#244534] flex items-center justify-center border border-[#CCE0D3]">
                    <Gamepad2 className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-medium bg-[#EBF0EC] text-[#3D5648] px-2.5 py-0.5 rounded-full border border-[#D7E3DC]">
                    {language === 'ar' ? 'استرخاء' : language === 'fr' ? 'Détente' : 'Relaxation'}
                  </span>
                </div>
                <h3 className="text-lg font-semibold font-['Lora',serif] text-[#1E2E25] mb-2">
                  {language === 'ar' ? 'ألعاب مهدئة' : language === 'fr' ? 'Jeux Apaisants' : 'Calming Games'}
                </h3>
                <p className="text-xs sm:text-sm text-[#5D6B63] leading-relaxed mb-6 font-light">
                  {language === 'ar'
                    ? 'استراحة حسية بدون أي توقيت أو نقاط — رفقاء تفاعليون وموسيقى هادئة وتأملات بصرية.'
                    : language === 'fr'
                    ? 'Une pause sensorielle sans pression ni score — des visuels doux et une musique relaxante.'
                    : 'A zero-pressure sensory rest — peaceful interactive visuals, soothing sounds, and gentle rhythm.'}
                </p>
              </div>

              <div>
                <button
                  type="button"
                  id="visit-games-btn"
                  onClick={() => {
                    setGamesInitialTab('companion');
                    setCurrentView('games');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="w-full py-2.5 px-4 bg-[#E7F0EB] hover:bg-[#DAE7E0] text-[#234232] font-medium text-xs sm:text-sm rounded-xl border border-[#C9DCD0] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{language === 'ar' ? 'اكتشف الألعاب' : language === 'fr' ? 'Découvrir les Jeux' : 'Visit Games'}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#28493A] rtl:rotate-180" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 6. AT THE BOTTOM: Keep the existing "About 3awdli" introduction/description section at the very bottom */}
        <Pillars currentUser={currentUser} onTalkAnonymously={handleTalkAnonymously} />

        {/* Reassurance Call-to-Action Section */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
          <div className="p-8 sm:p-10 rounded-3xl bg-[#EBF2EE]/90 border border-[#D5E5DC] text-center flex flex-col items-center shadow-2xs">
            <div className="w-10 h-10 rounded-2xl bg-[#315243] text-white flex items-center justify-center mb-3.5 shadow-2xs">
              <Heart className="w-4.5 h-4.5 text-emerald-200 fill-emerald-200/20" />
            </div>
            <h3 className="text-lg sm:text-xl font-normal text-[#21382D] font-['Lora',serif]">
              {language === 'ar'
                ? 'هل أنت مستعد لأخذ الخطوة الأولى؟'
                : language === 'fr'
                ? 'Prêt(e) à faire le premier pas ?'
                : 'Ready to take the first step?'}
            </h3>
            <p className="text-xs sm:text-sm text-[#4E6156] max-w-md mt-2 mb-6 leading-relaxed font-light">
              {language === 'ar'
                ? 'رسالة واحدة تكفي. مستمع متفهم وودود من فريقنا مستعد للتحدث معك في سرية تامة.'
                : language === 'fr' 
                ? 'Un seul message suffit. Un membre bienveillant de notre équipe d\'écoute vous répondra en toute confidentialité.'
                : 'It only takes one message. A caring listener is ready to be with you in our anonymous chat.'}
            </p>
            <button
              id="homepage-start-chat-cta-btn"
              onClick={handleTalkAnonymously}
              className="px-7 py-3 bg-[#315243] hover:bg-[#233C30] text-white text-xs sm:text-sm font-medium rounded-xl shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4 text-emerald-200" />
              <span>
                {currentUser 
                  ? (language === 'ar' ? 'تحدث بصراحة' : language === 'fr' ? 'Parler à cœur ouvert' : 'Talk Openly') 
                  : (language === 'ar' ? 'تحدث بهوية مجهولة' : language === 'fr' ? 'Parler anonymement' : 'Talk Anonymously')}
              </span>
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer
        currentUser={currentUser}
        onOpenAuth={handleOpenAuth}
        onTalkAnonymously={handleTalkAnonymously}
        onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
        onOpenContactSupport={handleOpenContactSupport}
        onNavigateRules={handleNavigateRules}
      />
      </Navbar>

      {/* Floating Anonymous Chat Widget (draggable, session managed by team) */}
      {currentView !== 'discussions' && (
        <AnonymousChatWidget
          isOpen={isChatOpen}
          onOpen={handleTalkAnonymously}
          onRequestTalkOpenly={handleTalkAnonymously}
          onAutoOpenCall={() => setIsChatOpen(true)}
          onClose={() => setIsChatOpen(false)}
          onOpenSignUp={() => handleOpenAuth('signup')}
          genderPreference={anonGenderPreference}
          onChangeGenderPreference={() => setIsGenderPreferenceModalOpen(true)}
          currentUser={currentUser}
        />
      )}

      {/* Contact Support / Customer Service Modal */}
      <ContactSupportModal
        isOpen={isContactSupportOpen}
        onClose={handleCloseContactSupport}
        currentUser={currentUser}
        initialCategory={contactSupportInitialCategory}
        onRedirectToChat={handleTalkAnonymously}
      />

      {/* Gender Preference Modal before starting conversation */}
      <GenderPreferenceModal
        isOpen={isGenderPreferenceModalOpen}
        currentPreference={anonGenderPreference}
        onClose={() => setIsGenderPreferenceModalOpen(false)}
        onConfirm={handleConfirmGenderPreference}
      />

      {/* Emergency Helpline Modal */}
      <EmergencyModal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
        onTalkAnonymously={handleTalkAnonymously}
        currentUser={currentUser}
      />
    </>
  );
}
