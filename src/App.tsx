import { useState, useEffect } from 'react';
import { 
  MessageCircle, 
  ShieldCheck, 
  Heart, 
  Sparkles, 
  ArrowRight,
  Gamepad2,
  Coffee,
  Compass
} from 'lucide-react';
import { useLanguage } from './context/LanguageContext';
import { Navbar } from './components/Navbar';
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
    const activeAnonDisc = currentUser
      ? getActiveUserDiscussion(currentUser.id)
      : getActiveAnonymousDiscussion();

    let targetDisc: DiscussionConversation;
    if (activeAnonDisc && activeAnonDisc.status !== 'closed') {
      updateDiscussionGenderPreference(activeAnonDisc.id, preference);
      targetDisc = activeAnonDisc;
    } else {
      clearActiveDiscussionReferences(undefined, currentUser?.id);
      if (currentUser) {
        targetDisc = createNewDiscussion('registered', {
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email,
          genderPreference: preference,
        });
      } else {
        targetDisc = createNewDiscussion('anonymous', { genderPreference: preference });
      }
    }
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
        {/* HERO SECTION */}
        <section className="pt-12 pb-16 sm:pt-16 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
          {/* Gentle Team & Initiative Badge */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#EBF2EE] border border-[#D1E3D8] text-[#28493A] text-xs font-medium shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>
                {language === 'ar'
                  ? 'مبادرة صحة نفسية غير ربحية، مجانية وسرية'
                  : language === 'fr'
                  ? 'Initiative de soutien psychologique bénévole, gratuite & confidentielle'
                  : 'Free, Non-profit & Confidential Mental Health Initiative'}
              </span>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center max-w-3xl mx-auto mb-10">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-[#1B2B22] tracking-tight leading-[1.2] font-['Lora',serif]">
              {language === 'ar'
                ? 'لست مضطراً لحمل أعبائك وحدك.'
                : language === 'fr'
                ? 'Vous n\'avez pas à porter vos fardeaux tout seul.'
                : 'You don\'t have to carry your burdens all by yourself.'}
            </h1>
            <p className="mt-4 text-base sm:text-lg text-[#55635B] leading-relaxed">
              {language === 'ar' ? (
                <>مرحباً بكم في <span className="font-semibold text-[#274738]">عاودلي</span> — أذن صاغية وملاذ آمن، متاح دائماً متى ما أردت التحدث.</>
              ) : language === 'fr' ? (
                <>Bienvenue sur <span className="font-semibold text-[#274738]">3awdli</span> — une oreille attentive et bienveillante, disponible dès que vous en ressentez le besoin.</>
              ) : (
                <>Welcome to <span className="font-semibold text-[#274738]">3awdli</span> — a compassionate listening ear, ready whenever you need to open up.</>
              )}
            </p>
          </div>

          {/* EXACT REQUIRED INTRODUCTION TEXT */}
          {/* Displayed prominently near the top of the page, exactly as written */}
          <div 
            id="prominent-introduction-card"
            className="max-w-3xl mx-auto bg-white/90 backdrop-blur-xs border border-[#E2DDD3] rounded-3xl p-7 sm:p-9 shadow-xs mb-14 relative overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-1.5 w-full bg-gradient-to-r from-[#507A65] via-[#315243] to-[#7EA892]"></div>
            
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-[#EAF2ED] text-[#2A493B] flex items-center justify-center shrink-0 mt-0.5 border border-[#D2E2D8]">
                <Heart className="w-5 h-5 text-[#315243] fill-[#315243]/20" />
              </div>
              <div>
                <p className="text-base sm:text-lg text-[#2A342E] leading-relaxed font-['Lora',serif] font-normal italic text-start">
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
                <div className="mt-3.5 flex items-center gap-2 text-xs text-[#5D6F64] font-['Plus_Jakarta_Sans',sans-serif]">
                  <span className="font-semibold text-[#2A4839] not-italic">
                    {language === 'ar' ? '— فريق 3awdli' : language === 'fr' ? '— L\'équipe 3awdli' : '— The 3awdli Team'}
                  </span>
                  <span>&bull;</span>
                  <span>{language === 'ar' ? 'مجاني وسري' : language === 'fr' ? 'Gratuit & Confidentiel' : 'Free & Confidential'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* THREE REPURPOSED PROMOTIONAL WINDOWS: THE LOUNGE, TEEN SPACE, GAMES */}
          <div className="mb-6 text-center">
            <h2 className="text-xl sm:text-2xl font-semibold text-[#1C2C23] font-['Lora',serif]">
              {language === 'ar'
                ? 'اكتشف مساحات الدعم والراحة لدينا'
                : language === 'fr'
                ? 'Découvrez nos espaces d\'apaisement'
                : 'Explore our spaces for healing & connection'}
            </h2>
            <p className="text-xs sm:text-sm text-[#63726A] mt-1">
              {language === 'ar'
                ? 'خذ وقتك لاستكشاف مساحاتنا المختلفة المصممة بكل عناية ومحبة.'
                : language === 'fr'
                ? 'Prenez le temps d\'explorer nos différents espaces créés avec bienveillance.'
                : 'Take your time to discover our supportive spaces crafted with warmth and care.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* WINDOW 1: The Lounge */}
            <div 
              id="window-the-lounge"
              className="bg-white/85 backdrop-blur-xs border border-[#E3DDD1] hover:border-[#315243]/30 rounded-3xl p-7 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between text-start"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-[#EAF2ED] text-[#274737] flex items-center justify-center border border-[#D0E2D7]">
                    <Coffee className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-semibold bg-[#EDE8DF] text-[#42544A] px-2.5 py-0.5 rounded-full border border-[#DED7CC]">
                    {language === 'ar' ? 'مجتمع' : language === 'fr' ? 'Communauté' : 'Community'}
                  </span>
                </div>
                <h3 className="text-xl font-bold font-['Lora',serif] text-[#1E2E25] mb-2">
                  {language === 'ar' ? 'الصالون' : language === 'fr' ? 'Le Salon' : 'The Lounge'}
                </h3>
                <p className="text-xs font-medium text-[#4D6D5C] mb-3 uppercase tracking-wider">
                  {language === 'ar' ? 'حلقات نقاش وخواطر' : language === 'fr' ? 'Cercles d\'échange & Réflexions' : 'Discussion Circles & Insights'}
                </p>
                <p className="text-xs sm:text-sm text-[#5D6B63] leading-relaxed mb-6">
                  {language === 'ar'
                    ? 'انضم إلى مساحتنا التشاركية للمشاركة في حلقات نقاش وتأملات هادفة يشاركها أخصائيون نفسيون وميسرون ذوو خبرة.'
                    : language === 'fr'
                    ? 'Rejoignez notre espace convivial pour participer à des cercles d\'échange thématiques et découvrir des réflexions apaisantes partagées par des psychologues et animateurs.'
                    : 'Step into our shared space for scheduled group exchange circles and deep, thoughtful reflections curated by psychologists and experienced facilitators.'}
                </p>
              </div>

              <div>
                <button
                  type="button"
                  id="visit-lounge-btn"
                  onClick={handleNavigateLounge}
                  className="w-full py-3.5 px-4 bg-[#315243] hover:bg-[#253E33] text-white font-semibold text-sm rounded-2xl shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{language === 'ar' ? 'زيارة الصالون' : language === 'fr' ? 'Visiter Le Salon' : 'Visit The Lounge'}</span>
                  <ArrowRight className="w-4 h-4 text-emerald-200 rtl:rotate-180" />
                </button>
                <p className="mt-3 text-center text-[11px] text-[#7C8B82]">
                  {language === 'ar' ? 'جلسات نقاش • مقالات وتأملات هادفة' : language === 'fr' ? 'Salons en direct &bull; Articles guidés' : 'Scheduled circles &bull; Curated reflections'}
                </p>
              </div>
            </div>

            {/* WINDOW 2: Teen Space */}
            <div 
              id="window-teen-space"
              className="bg-white/85 backdrop-blur-xs border border-[#E3DDD1] hover:border-[#315243]/30 rounded-3xl p-7 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between text-start"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-[#F0ECE4] text-[#33463B] flex items-center justify-center border border-[#E0D8CA]">
                    <Compass className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-semibold bg-[#EAF0EC] text-[#345443] px-2.5 py-0.5 rounded-full border border-[#D5E4DB]">
                    {language === 'ar' ? 'شباب' : language === 'fr' ? 'Jeunesse' : 'Youth'}
                  </span>
                </div>
                <h3 className="text-xl font-bold font-['Lora',serif] text-[#1E2E25] mb-2">
                  {language === 'ar' ? 'فضاء اليافعين' : language === 'fr' ? 'Espace Ados' : 'Teen Space'}
                </h3>
                <p className="text-xs font-medium text-[#5F7066] mb-3 uppercase tracking-wider">
                  {language === 'ar' ? 'مخصص للمراهقين والشباب' : language === 'fr' ? 'Dédié aux ados & jeunes adultes' : 'For Teens & Young Adults'}
                </p>
                <p className="text-xs sm:text-sm text-[#5D6B63] leading-relaxed mb-6">
                  {language === 'ar'
                    ? 'ملاذ مخصص لليافعين للتعامل مع ضغوط الدراسة، الصداقات، والعلاقات الأسرية في بيئة آمنة ومتفهمة وبدون أحكام مسبقة.'
                    : language === 'fr'
                    ? 'Un sanctuaire spécialement dédié aux adolescents pour aborder le stress des études, les amitiés, les relations familiales et les doutes de la vie avec bienveillance et sans tabou.'
                    : 'A dedicated sanctuary created specifically for youth dealing with school stress, friendships, family expectations, and emotional growing pains in a safe, relatable way.'}
                </p>
              </div>

              <div>
                <button
                  type="button"
                  id="visit-teen-space-btn"
                  onClick={handleNavigateTeenSpace}
                  className="w-full py-3.5 px-4 bg-[#F2EFE8] hover:bg-[#E5E0D5] text-[#24372C] font-semibold text-sm rounded-2xl border border-[#D9D2C4] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{language === 'ar' ? 'زيارة فضاء اليافعين' : language === 'fr' ? 'Visiter l\'Espace Ados' : 'Visit Teen Space'}</span>
                  <ArrowRight className="w-4 h-4 text-[#315243] rtl:rotate-180" />
                </button>
                <p className="mt-3 text-center text-[11px] text-[#7C8B82]">
                  {language === 'ar' ? 'إرشاد داعم • سري 100%' : language === 'fr' ? 'Accompagnement bienveillant &bull; 100% confidentiel' : 'Safe guidance &bull; 100% confidential'}
                </p>
              </div>
            </div>

            {/* WINDOW 3: Games */}
            <div 
              id="window-games"
              className="bg-white/85 backdrop-blur-xs border border-[#E3DDD1] hover:border-[#315243]/30 rounded-3xl p-7 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between text-start"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-[#E7F0EB] text-[#244534] flex items-center justify-center border border-[#CCE0D3]">
                    <Gamepad2 className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-semibold bg-[#EDEAE3] text-[#4E5E55] px-2.5 py-0.5 rounded-full border border-[#DCD6C9]">
                    {language === 'ar' ? 'استرخاء' : language === 'fr' ? 'Détente' : 'Relaxation'}
                  </span>
                </div>
                <h3 className="text-xl font-bold font-['Lora',serif] text-[#1E2E25] mb-2">
                  {language === 'ar' ? 'ألعاب مهدئة' : language === 'fr' ? 'Jeux Apaisants' : 'Calming Games'}
                </h3>
                <p className="text-xs font-medium text-[#446252] mb-3 uppercase tracking-wider">
                  {language === 'ar' ? 'استراحة حسية بدون أي ضغوط' : language === 'fr' ? 'Pause sensorielle sans pression' : 'Zero-Pressure Sensory Rest'}
                </p>
                <p className="text-xs sm:text-sm text-[#5D6B63] leading-relaxed mb-6">
                  {language === 'ar'
                    ? 'خذ استراحة هادئة مع رفقائنا التفاعليين المهدئين. بدون نقاط أو توقيت — فقط موسيقى هادئة وتأملات بصرية مريحة.'
                    : language === 'fr'
                    ? 'Accordez-vous une pause ressourçante avec nos compagnons interactifs relaxants. Aucun score, aucun compte à rebours — seulement des visuels apaisants et une respiration guidée.'
                    : 'Take a quiet, restorative breather with our gentle interactive experiences. No scores, timers, or competition — just soothing audio and peaceful visual rhythms.'}
                </p>
              </div>

              <div>
                <button
                  type="button"
                  id="visit-games-btn"
                  onClick={() => {
                    setCurrentView('games');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="w-full py-3.5 px-4 bg-[#E7F0EB] hover:bg-[#DAE7E0] text-[#234232] font-semibold text-sm rounded-2xl border border-[#C9DCD0] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{language === 'ar' ? 'اكتشف الألعاب' : language === 'fr' ? 'Découvrir les Jeux' : 'Visit Games'}</span>
                  <ArrowRight className="w-4 h-4 text-[#28493A] rtl:rotate-180" />
                </button>
                <p className="mt-3 text-center text-[11px] text-[#7C8B82]">
                  {language === 'ar' ? 'تنفس موجه • أصوات مهدئة' : language === 'fr' ? 'Respiration guidée &bull; Sons apaisants' : 'Gentle breathing &bull; Soothing sounds'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Supportive Pillars Section */}
        <Pillars currentUser={currentUser} onTalkAnonymously={handleTalkAnonymously} />

        {/* Calming Game Callout */}
        <section className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto my-8 sm:my-10">
          <div
            id="homepage-games-callout-card"
            className="bg-[#F4F1EA]/80 border border-[#E4DEC9] rounded-3xl p-5 sm:p-6 shadow-2xs hover:shadow-xs transition-all duration-300 flex flex-col sm:flex-row items-center justify-between gap-5"
          >
            <div className="flex items-center gap-4 text-start w-full sm:w-auto">
              <div className="w-12 h-12 rounded-2xl bg-[#E2EBE5] text-[#294B3A] flex items-center justify-center shrink-0 border border-[#CEE0D5]">
                <Gamepad2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3D5E4D] bg-[#E7EFEA] px-2.5 py-0.5 rounded-full border border-[#CFDFD5]">
                    {language === 'ar' ? 'استراحة هادئة' : language === 'fr' ? 'Pause Douce' : 'Gentle Pause'}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-[#1C2E24] font-['Lora',serif] mt-1">
                  {language === 'ar'
                    ? 'هل تحتاج لحظة للتنفس والاسترخاء؟'
                    : language === 'fr'
                    ? 'Besoin d\'un moment pour respirer et décompresser ?'
                    : 'Need a moment to breathe and unwind?'}
                </h3>
                <p className="text-xs sm:text-sm text-[#5C6E63] mt-0.5">
                  {language === 'ar'
                    ? 'جرّب رفيقنا المهدئ بدون أي ضغوط. لا نقاط ولا استعجال — مجرد مساحة لطيفة للاسترخاء.'
                    : language === 'fr'
                    ? 'Essayez notre compagnon apaisant sans pression. Pas de score ni de précipitation — juste un espace bienveillant.'
                    : 'Try our zero-pressure calming companion. No scores or rush — just a gentle space to relax.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              id="homepage-play-game-btn"
              onClick={() => {
                setCurrentView('games');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="w-full sm:w-auto px-5 py-3 bg-[#2D4D3D] hover:bg-[#20392C] text-white text-xs sm:text-sm font-semibold rounded-2xl shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <Gamepad2 className="w-4 h-4 text-emerald-200 shrink-0" />
              <span>
                {language === 'ar'
                  ? 'العب لعبة على الموقع'
                  : language === 'fr'
                  ? 'Jouer à un jeu sur le site'
                  : 'Play a game on the website'}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-200 rtl:rotate-180" />
            </button>
          </div>
        </section>

        {/* Reassurance Call-to-Action Section */}
        <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
          <div className="p-7 sm:p-9 rounded-3xl bg-[#EBF2EE] border border-[#D3E3DA] text-center flex flex-col items-center shadow-xs">
            <div className="w-11 h-11 rounded-2xl bg-[#315243] text-white flex items-center justify-center mb-3 shadow-xs">
              <Heart className="w-5 h-5 text-emerald-200 fill-emerald-200/20" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-[#21382D] font-['Lora',serif]">
              {language === 'ar'
                ? 'هل أنت مستعد لأخذ الخطوة الأولى؟'
                : language === 'fr'
                ? 'Prêt(e) à faire le premier pas ?'
                : 'Ready to take the first step?'}
            </h3>
            <p className="text-xs sm:text-sm text-[#4E6156] max-w-md mt-1.5 mb-5 leading-relaxed">
              {language === 'ar'
                ? 'رسالة واحدة تكفي. مستمع متفهم وودود من فريقنا مستعد للتحدث معك في سرية تامة.'
                : language === 'fr' 
                ? 'Un seul message suffit. Un membre bienveillant de notre équipe d\'écoute vous répondra en toute confidentialité.'
                : 'It only takes one message. A caring listener is ready to be with you in our anonymous chat.'}
            </p>
            <button
              id="homepage-start-chat-cta-btn"
              onClick={handleTalkAnonymously}
              className="px-7 py-3.5 bg-[#315243] hover:bg-[#253E32] text-white text-xs sm:text-sm font-semibold rounded-2xl shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center gap-2"
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
      <AnonymousChatWidget
        isOpen={isChatOpen}
        onOpen={() => setIsGenderPreferenceModalOpen(true)}
        onClose={() => setIsChatOpen(false)}
        onOpenSignUp={() => handleOpenAuth('signup')}
        genderPreference={anonGenderPreference}
        onChangeGenderPreference={() => setIsGenderPreferenceModalOpen(true)}
        currentUser={currentUser}
      />

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
