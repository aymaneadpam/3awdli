import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Home, 
  User, 
  Users,
  Sparkles, 
  Mail, 
  ShieldCheck, 
  ShieldAlert,
  HelpCircle, 
  LifeBuoy, 
  LogOut, 
  LogIn, 
  UserPlus, 
  ChevronRight,
  ChevronLeft,
  MessageCircleHeart,
  Gamepad2,
  Coffee,
  BookOpen,
  Inbox,
  Globe
} from 'lucide-react';
import { AuthMode, UserAccount, ViewState } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { getUnreadShareNotificationsCount } from '../utils/shareManagement';
import { getUnreadUserMailboxCount } from '../utils/userMailboxManagement';
import { getPendingReportsCount, getPendingTransferredReportsCount } from '../utils/reportManagement';
import { getStoredSupportRequests } from '../utils/supportRequests';
import { isSuperAdmin, isAdministrator } from '../utils/userManagement';
import { getWaitingDiscussionsCount } from '../utils/discussionManagement';
import { ConnectedTeamIndicator } from './ConnectedTeamIndicator';

export interface NavbarProps {
  children?: React.ReactNode;
  currentView?: ViewState;
  activeSubTab?: string;
  currentUser?: UserAccount | null;
  onNavigateHome?: () => void;
  onOpenHome?: () => void;
  onNavigateDashboard?: () => void;
  onOpenDashboard?: () => void;
  onNavigateMailbox?: () => void;
  onOpenMailbox?: () => void;
  onNavigateDiscussions?: (tab?: 'unopened' | 'mailbox') => void;
  onOpenDiscussions?: (tab?: 'unopened' | 'mailbox') => void;
  onNavigateReports?: () => void;
  onOpenReports?: () => void;
  onNavigateAdminReports?: () => void;
  onNavigateAdminSupport?: () => void;
  onOpenAdminSupport?: () => void;
  onNavigateAdmin?: () => void;
  onOpenAdmin?: () => void;
  onNavigateMemberManagement?: () => void;
  onOpenMemberManagement?: () => void;
  onNavigateGames?: () => void;
  onOpenGames?: () => void;
  onNavigateTeenSpace?: () => void;
  onOpenTeenSpace?: () => void;
  onNavigateLounge?: () => void;
  onOpenLounge?: () => void;
  onNavigateRules?: () => void;
  onOpenRules?: () => void;
  onOpenContactSupport?: () => void;
  onOpenEmergencyModal?: () => void;
  onOpenAuth?: (mode: AuthMode) => void;
  onTalkAnonymously?: () => void;
  onSignOut?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  onClick: () => void;
  badge?: number | null;
  isDestructive?: boolean;
}

// Module-level in-memory state:
// Resets on page reload / fresh visit so the starting state is ALWAYS OPEN on desktop screens.
// Retains user preference across in-app client-side navigation between views.
let inMemoryDesktopSidebarOpen: boolean | null = null;

export const Navbar: React.FC<NavbarProps> = ({
  children,
  currentView = 'home',
  activeSubTab,
  currentUser,
  onNavigateHome,
  onOpenHome,
  onNavigateDashboard,
  onOpenDashboard,
  onNavigateMailbox,
  onOpenMailbox,
  onNavigateDiscussions,
  onOpenDiscussions,
  onNavigateReports,
  onOpenReports,
  onNavigateAdminReports,
  onNavigateAdminSupport,
  onOpenAdminSupport,
  onNavigateAdmin,
  onOpenAdmin,
  onNavigateMemberManagement,
  onOpenMemberManagement,
  onNavigateGames,
  onOpenGames,
  onNavigateTeenSpace,
  onOpenTeenSpace,
  onNavigateLounge,
  onOpenLounge,
  onNavigateRules,
  onOpenRules,
  onOpenContactSupport,
  onOpenEmergencyModal,
  onOpenAuth,
  onTalkAnonymously,
  onSignOut,
}) => {
  // Sidebar state: ALWAYS OPEN by default whenever a user visits or reloads the site on desktop screens (>= 1024px)
  // On mobile screens (< 1024px), it is ALWAYS CLOSED by default
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      // Clear any legacy persistent storage so stale values never override the default open state
      try {
        localStorage.removeItem('3awdli_sidebar_open');
      } catch {
        // Safe fallback
      }
      const isDesktop = window.innerWidth >= 1024;
      if (!isDesktop) {
        return false;
      }
      if (inMemoryDesktopSidebarOpen !== null) {
        return inMemoryDesktopSidebarOpen;
      }
      return true;
    }
    return false;
  });

  const isListener = Boolean(currentUser?.is_listener || currentUser?.isListener || currentUser?.role === 'listener');
  const isHeadOfListeners = Boolean(currentUser?.is_head_of_listeners) || (currentUser as any)?.role === 'head_of_listeners';
  const isSuperAdminAccount = isSuperAdmin(currentUser);
  const isAdministratorAccount = isAdministrator(currentUser) && !isSuperAdminAccount;
  const hasAdminAccess = isSuperAdminAccount || isAdministratorAccount;
  const isAdmin = hasAdminAccess;
  const canViewConnectedTeam = isListener || isHeadOfListeners || hasAdminAccess;
  const canSeeDiscussionsQueueBadge = isListener || isHeadOfListeners || hasAdminAccess;

  const { language, setLanguage, strings } = useLanguage();

  // Live waiting discussions count for Listeners, Head of Listeners, and Administrators
  const [waitingDiscussionsCount, setWaitingDiscussionsCount] = useState<number>(() => {
    if (!currentUser) return 0;
    const canSeeQueue = isListener || isHeadOfListeners || hasAdminAccess;
    if (!canSeeQueue) return 0;
    try {
      return getWaitingDiscussionsCount();
    } catch {
      return 0;
    }
  });

  // Live share count for listener/admin mailbox badge
  const [unreadShareCount, setUnreadShareCount] = useState<number>(() => {
    if (!currentUser) return 0;
    try {
      return getUnreadShareNotificationsCount(currentUser);
    } catch {
      return 0;
    }
  });

  // Live unread count for regular user mailbox badge
  const [unreadUserMailboxCount, setUnreadUserMailboxCount] = useState<number>(() => {
    if (!currentUser) return 0;
    try {
      return getUnreadUserMailboxCount(currentUser.id);
    } catch {
      return 0;
    }
  });

  // Live pending reports count for Head of Listeners
  const [pendingReportsCount, setPendingReportsCount] = useState<number>(() => {
    try {
      return getPendingReportsCount();
    } catch {
      return 0;
    }
  });

  // Live transferred reports count for Administrators
  const [pendingTransferredCount, setPendingTransferredCount] = useState<number>(() => {
    try {
      return getPendingTransferredReportsCount();
    } catch {
      return 0;
    }
  });

  // Live new support requests count for Administrators
  const [unreadSupportCount, setUnreadSupportCount] = useState<number>(() => {
    try {
      return getStoredSupportRequests().filter((r) => r.status === 'new').length;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    if (!currentUser) return;
    const updateCount = () => {
      try {
        setUnreadShareCount(getUnreadShareNotificationsCount(currentUser));
        setUnreadUserMailboxCount(getUnreadUserMailboxCount(currentUser.id));
        setPendingReportsCount(getPendingReportsCount());
        setPendingTransferredCount(getPendingTransferredReportsCount());
        setUnreadSupportCount(getStoredSupportRequests().filter((r) => r.status === 'new').length);
        if (canSeeDiscussionsQueueBadge) {
          setWaitingDiscussionsCount(getWaitingDiscussionsCount());
        } else {
          setWaitingDiscussionsCount(0);
        }
      } catch {
        // Safe fallback
      }
    };
    updateCount();

    const handleMailboxUpdate = () => updateCount();
    const handleShareUpdate = () => updateCount();
    const handleReportUpdate = () => updateCount();
    const handleSupportUpdate = () => updateCount();
    const handleDiscussionUpdate = () => updateCount();

    window.addEventListener('3awdli_discussion_sync', handleDiscussionUpdate);
    window.addEventListener('3awdli_user_mailbox_updated', handleMailboxUpdate);
    window.addEventListener('3awdli_share_request_updated', handleShareUpdate);
    window.addEventListener('3awdli_share_request_created', handleShareUpdate);
    window.addEventListener('3awdli_report_created', handleReportUpdate);
    window.addEventListener('3awdli_report_updated', handleReportUpdate);
    window.addEventListener('3awdli_report_transferred', handleReportUpdate);
    window.addEventListener('3awdli_admin_reports_updated', handleReportUpdate);
    window.addEventListener('3awdli_support_requests_updated', handleSupportUpdate);
    window.addEventListener('storage', updateCount);

    return () => {
      window.removeEventListener('3awdli_discussion_sync', handleDiscussionUpdate);
      window.removeEventListener('3awdli_user_mailbox_updated', handleMailboxUpdate);
      window.removeEventListener('3awdli_share_request_updated', handleShareUpdate);
      window.removeEventListener('3awdli_share_request_created', handleShareUpdate);
      window.removeEventListener('3awdli_report_created', handleReportUpdate);
      window.removeEventListener('3awdli_report_updated', handleReportUpdate);
      window.removeEventListener('3awdli_report_transferred', handleReportUpdate);
      window.removeEventListener('3awdli_admin_reports_updated', handleReportUpdate);
      window.removeEventListener('3awdli_support_requests_updated', handleSupportUpdate);
      window.removeEventListener('storage', updateCount);
    };
  }, [currentUser, canSeeDiscussionsQueueBadge]);

  // Toggle sidebar: single click immediately toggles state with zero recursion/race
  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
        inMemoryDesktopSidebarOpen = next;
      }
      return next;
    });
  };

  // Close sidebar on small screens when Escape key is pressed
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSidebarOpen && typeof window !== 'undefined' && window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen]);

  // Helper to auto-close sidebar on mobile/tablet upon navigation
  const closeSidebarOnMobile = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
      inMemoryDesktopSidebarOpen = false;
    }
  };

  // Ensure sidebar automatically closes on mobile upon any view change
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, [currentView, activeSubTab]);

  // Unified navigation handlers that automatically close drawer on small screens
  const handleHome = () => {
    closeSidebarOnMobile();
    if (onNavigateHome) onNavigateHome();
    else if (onOpenHome) onOpenHome();
  };

  const handleDashboard = () => {
    closeSidebarOnMobile();
    if (onNavigateDashboard) onNavigateDashboard();
    else if (onOpenDashboard) onOpenDashboard();
  };

  const handleUserMailbox = () => {
    closeSidebarOnMobile();
    if (onNavigateMailbox) onNavigateMailbox();
    else if (onOpenMailbox) onOpenMailbox();
  };

  const handleDiscussions = (tab?: 'unopened' | 'mailbox') => {
    closeSidebarOnMobile();
    if (onNavigateDiscussions) onNavigateDiscussions(tab);
    else if (onOpenDiscussions) onOpenDiscussions(tab);
  };

  const handleAdmin = () => {
    closeSidebarOnMobile();
    if (onNavigateAdmin) onNavigateAdmin();
    else if (onOpenAdmin) onOpenAdmin();
  };

  const handleMemberManagement = () => {
    closeSidebarOnMobile();
    if (onNavigateMemberManagement) onNavigateMemberManagement();
    else if (onOpenMemberManagement) onOpenMemberManagement();
    else if (onNavigateAdmin) onNavigateAdmin();
  };

  const handleReports = () => {
    closeSidebarOnMobile();
    if (onNavigateReports) onNavigateReports();
    else if (onOpenReports) onOpenReports();
  };

  const handleAdminReports = () => {
    closeSidebarOnMobile();
    if (onNavigateAdminReports) onNavigateAdminReports();
    else if (onNavigateReports) onNavigateReports();
    else if (onOpenReports) onOpenReports();
  };

  const handleAdminSupport = () => {
    closeSidebarOnMobile();
    if (onNavigateAdminSupport) onNavigateAdminSupport();
    else if (onOpenAdminSupport) onOpenAdminSupport();
    else if (onNavigateAdmin) onNavigateAdmin();
  };

  const handleGames = () => {
    closeSidebarOnMobile();
    if (onNavigateGames) onNavigateGames();
    else if (onOpenGames) onOpenGames();
  };

  const handleTeenSpace = () => {
    closeSidebarOnMobile();
    if (onNavigateTeenSpace) onNavigateTeenSpace();
    else if (onOpenTeenSpace) onOpenTeenSpace();
  };

  const handleLounge = () => {
    closeSidebarOnMobile();
    if (onNavigateLounge) onNavigateLounge();
    else if (onOpenLounge) onOpenLounge();
  };

  const handleRules = () => {
    closeSidebarOnMobile();
    if (onNavigateRules) onNavigateRules();
    else if (onOpenRules) onOpenRules();
  };

  const handleSupport = () => {
    closeSidebarOnMobile();
    if (onOpenContactSupport) onOpenContactSupport();
  };

  const handleAuth = (mode: AuthMode) => {
    closeSidebarOnMobile();
    if (onOpenAuth) onOpenAuth(mode);
  };

  const handleEmergency = () => {
    closeSidebarOnMobile();
    if (onOpenEmergencyModal) onOpenEmergencyModal();
  };

  const handleSignOut = () => {
    closeSidebarOnMobile();
    if (onSignOut) onSignOut();
  };

  const handleTalk = () => {
    closeSidebarOnMobile();
    if (onTalkAnonymously) onTalkAnonymously();
  };

  // Build the list of menu items in the EXACT fixed order:
  // 1. Home
  // 2. My Space (if logged in)
  // 3. Discussions (if listener or admin)
  // 4. Mailbox (if listener or admin)
  // 5. Admin Console (if admin)
  // 6. Contact Support (all users)
  // 7. Sign In (if guest)
  // 8. Sign Up (if guest)
  // 9. Emergency Help (all users)
  // 10. Log Out (if logged in)
  const navItems: NavItem[] = [];

  // 1. Home
  navItems.push({
    id: 'sidebar-nav-home',
    label: strings.nav.home,
    description: language === 'fr' 
      ? 'Présentation et sanctuaire 3awdli' 
      : language === 'ar'
      ? 'التعريف بـ 3awdli ومساحة الاستماع الآمنة'
      : '3awdli overview & sanctuary',
    icon: Home,
    isActive: currentView === 'home',
    onClick: handleHome,
  });

  // 2. Personal Space (Logged in users)
  if (currentUser && (onNavigateDashboard || onOpenDashboard)) {
    navItems.push({
      id: 'sidebar-nav-myspace',
      label: strings.nav.personalSpace,
      description: language === 'fr' 
        ? 'Votre sanctuaire intime & notes sécurisées' 
        : language === 'ar'
        ? 'ملاذك الخاص وملاحظاتك الآمنة'
        : 'Your private, confidential sanctuary & notes',
      icon: User,
      isActive: currentView === 'dashboard',
      onClick: handleDashboard,
    });
  }

  // 3. Discussions (All logged-in users: Regular members, Listeners & Admins)
  if (currentUser && (onNavigateDiscussions || onOpenDiscussions)) {
    const showWaitingBadge = canSeeDiscussionsQueueBadge && waitingDiscussionsCount > 0;
    navItems.push({
      id: 'sidebar-nav-discussions',
      label: strings.nav.discussions,
      description: isListener || isAdmin
        ? (language === 'fr' 
            ? 'Conversations de soutien psychologique actives' 
            : language === 'ar'
            ? 'محادثات الدعم النفسي النشطة'
            : 'Active psychological support conversations')
        : (language === 'fr' 
            ? 'Vos discussions privées et historique d\'écoute' 
            : language === 'ar'
            ? 'محادثاتك الخاصة وسجل الاستماع'
            : 'Your private discussions & conversation history'),
      icon: Sparkles,
      isActive: currentView === 'discussions' && activeSubTab !== 'mailbox',
      onClick: () => handleDiscussions('unopened'),
      badge: showWaitingBadge ? waitingDiscussionsCount : null,
    });
  }

  // 4. The Lounge (All logged-in users)
  if (currentUser && (onNavigateLounge || onOpenLounge)) {
    navItems.push({
      id: 'sidebar-nav-lounge',
      label: strings.nav.theLounge,
      description: language === 'fr' 
        ? 'Articles, réflexions & salons d\'échange' 
        : language === 'ar'
        ? 'مقالات داعمة وحلقات حوار ونقاش'
        : 'Articles, reflections & scheduled live sessions',
      icon: Coffee,
      isActive: currentView === 'lounge',
      onClick: handleLounge,
    });
  }

  // 5. Teen Space (All users: logged in or anonymous)
  if (onNavigateTeenSpace || onOpenTeenSpace) {
    navItems.push({
      id: 'sidebar-nav-teen-space',
      label: strings.nav.teenSpace,
      description: language === 'fr' 
        ? 'Articles de bien-être mental & réflexions pour les ados' 
        : language === 'ar'
        ? 'مقالات وخواطر داعمة لليافعين والشباب'
        : 'Mental wellness articles & reflections for youth',
      icon: BookOpen,
      isActive: currentView === 'teen-space',
      onClick: handleTeenSpace,
    });
  }

  // 6. Games (All users: logged in or anonymous)
  if (onNavigateGames || onOpenGames) {
    navItems.push({
      id: 'sidebar-nav-games',
      label: strings.nav.games,
      description: language === 'fr' 
        ? 'Espaces anti-stress apaisants et sans pression' 
        : language === 'ar'
        ? 'مساحات مهدئة لتخفيف التوتر والضغط'
        : 'Calming, zero-pressure anti-stress spaces',
      icon: Gamepad2,
      isActive: currentView === 'games',
      onClick: handleGames,
    });
  }

  // 7. Mailbox (Listeners & Admins OR Regular users)
  if (currentUser && (isListener || isAdmin) && (onNavigateDiscussions || onOpenDiscussions)) {
    navItems.push({
      id: 'sidebar-nav-mailbox',
      label: strings.nav.mailbox,
      description: language === 'fr' 
        ? 'Demandes de consultation & partages' 
        : language === 'ar'
        ? 'طلبات الاستشارة والملفات المشتركة'
        : 'Consultation requests & shared files',
      icon: Mail,
      isActive: currentView === 'discussions' && activeSubTab === 'mailbox',
      onClick: () => handleDiscussions('mailbox'),
      badge: unreadShareCount > 0 ? unreadShareCount : null,
    });
  } else if (currentUser && !isListener && !isAdmin && (onNavigateMailbox || onOpenMailbox)) {
    navItems.push({
      id: 'sidebar-nav-user-mailbox',
      label: strings.nav.mailbox,
      description: language === 'fr' 
        ? 'Réponses aux signalements & avis de l\'équipe' 
        : language === 'ar'
        ? 'الردود على البلاغات وإشعارات الفريق'
        : 'Replies to reports & team updates',
      icon: Mail,
      isActive: currentView === 'user-mailbox',
      onClick: handleUserMailbox,
      badge: unreadUserMailboxCount > 0 ? unreadUserMailboxCount : null,
    });
  }

  // 8. Reports (Administrators only - shows transferred reports escalated by Head of Listeners, or Head of Listeners original reports queue)
  if (currentUser && hasAdminAccess && (onNavigateAdminReports || onNavigateReports || onOpenReports)) {
    navItems.push({
      id: 'sidebar-nav-admin-reports',
      label: strings.nav.reports,
      description: language === 'fr' 
        ? 'Signalements transférés par le Responsable' 
        : language === 'ar'
        ? 'البلاغات المحالة من مسؤول المستمعين'
        : 'Transferred reports escalated by Head of Listeners',
      icon: ShieldAlert,
      isActive: currentView === 'admin-reports',
      onClick: handleAdminReports,
      badge: pendingTransferredCount > 0 ? pendingTransferredCount : null,
    });
  } else if (currentUser && isHeadOfListeners && (onNavigateReports || onOpenReports)) {
    navItems.push({
      id: 'sidebar-nav-reports',
      label: strings.nav.reports,
      description: language === 'fr' 
        ? 'Signalements & examens de sécurité' 
        : language === 'ar'
        ? 'مراجعة البلاغات وفحوصات الأمان'
        : 'Reported discussions & safety investigations',
      icon: ShieldAlert,
      isActive: currentView === 'reports',
      onClick: handleReports,
      badge: pendingReportsCount > 0 ? pendingReportsCount : null,
    });
  }

  // 9. Support (Support Inbox visible to Administrators)
  if (currentUser && hasAdminAccess && (onNavigateAdminSupport || onOpenAdminSupport || onNavigateAdmin || onOpenAdmin)) {
    navItems.push({
      id: 'sidebar-nav-admin-support',
      label: strings.nav.support,
      description: language === 'fr' 
        ? 'Boîte des messages utilisateurs & recours' 
        : language === 'ar'
        ? 'صندوق رسائل المستخدمين والالتماسات'
        : 'Incoming user messages & ban appeals inbox',
      icon: Inbox,
      isActive: currentView === 'admin-support',
      onClick: handleAdminSupport,
      badge: unreadSupportCount > 0 ? unreadSupportCount : null,
    });
  }

  // 10. Member Management (Visible to Administrators and Admin)
  if (currentUser && hasAdminAccess && (onNavigateMemberManagement || onOpenMemberManagement || onNavigateAdmin || onOpenAdmin)) {
    navItems.push({
      id: 'sidebar-nav-member-management',
      label: strings.nav.memberManagement,
      description: language === 'fr' 
        ? 'Attribuer les rôles Écoutant, Responsable, Animateur & Rédacteur' 
        : language === 'ar'
        ? 'تعيين أدوار المستمع، المسؤول، الميسر والمحرر'
        : 'Assign Listener, Head, Facilitator & Writer roles',
      icon: Users,
      isActive: currentView === 'member-management' || currentView === 'admin',
      onClick: handleMemberManagement,
    });
  }

  // 11. Emergency Help
  if (onOpenEmergencyModal) {
    navItems.push({
      id: 'sidebar-nav-emergency',
      label: strings.nav.emergencyHelp,
      description: language === 'fr' 
        ? 'Numéros d\'urgence & assistance immédiate' 
        : language === 'ar'
        ? 'أرقام الطوارئ والمساعدة العاجلة'
        : 'Crisis hotlines & urgent assistance resources',
      icon: LifeBuoy,
      isActive: false,
      onClick: handleEmergency,
    });
  }

  // Rules (Règlement) - Positioned directly before "Contact Support", available to all users (including visitors)
  if (onNavigateRules || onOpenRules) {
    navItems.push({
      id: 'sidebar-nav-rules',
      label: strings.nav.rules || (language === 'fr' ? 'Réglement' : language === 'ar' ? 'القوانين' : 'Rules'),
      description: language === 'fr' 
        ? 'Réglement général & chartes éthiques' 
        : language === 'ar'
        ? 'القوانين والمواثيق الأخلاقية للمنصة'
        : 'General rules & ethical charters',
      icon: ShieldCheck,
      isActive: currentView === 'rules',
      onClick: handleRules,
    });
  }

  // 12. Contact Support (All users)
  if (onOpenContactSupport) {
    navItems.push({
      id: 'sidebar-nav-support',
      label: strings.nav.contactSupport,
      description: language === 'fr' 
        ? 'Assistance technique, de compte ou service membre' 
        : language === 'ar'
        ? 'الدعم الفني، مشاكل الحساب واستفسارات الأعضاء'
        : 'Technical, account or user service help',
      icon: HelpCircle,
      isActive: false,
      onClick: handleSupport,
    });
  }

  // Non-logged-in Auth (Sign In / Sign Up)
  if (!currentUser && onOpenAuth) {
    navItems.push({
      id: 'sidebar-nav-signin',
      label: strings.nav.signIn,
      description: language === 'fr' 
        ? 'Accédez à votre espace sécurisé et vos notes' 
        : language === 'ar'
        ? 'الدخول إلى فضائك الآمن وملاحظاتك'
        : 'Access your saved space and notes',
      icon: LogIn,
      isActive: currentView === 'signin',
      onClick: () => handleAuth('signin'),
    });
    navItems.push({
      id: 'sidebar-nav-signup',
      label: strings.nav.signUp,
      description: language === 'fr' 
        ? 'Créer un compte gratuit et privé' 
        : language === 'ar'
        ? 'إنشاء حساب مجاني وخاص'
        : 'Create a free, private account',
      icon: UserPlus,
      isActive: currentView === 'signup',
      onClick: () => handleAuth('signup'),
    });
  }

  // 13. Log Out
  if (currentUser && onSignOut) {
    navItems.push({
      id: 'sidebar-nav-signout',
      label: strings.nav.logout,
      description: language === 'fr' 
        ? `Connecté en tant que ${currentUser.name}` 
        : language === 'ar'
        ? `مسجل باسم ${currentUser.name}`
        : `Signed in as ${currentUser.name}`,
      icon: LogOut,
      isActive: false,
      onClick: handleSignOut,
      isDestructive: true,
    });
  }

  // Current view friendly label for breadcrumbs
  const getCurrentViewLabel = () => {
    switch (currentView) {
      case 'home':
        return strings.nav.home;
      case 'dashboard':
        return strings.nav.personalSpace;
      case 'user-mailbox':
        return strings.nav.mailbox;
      case 'discussions':
        return activeSubTab === 'mailbox' ? strings.nav.mailbox : strings.nav.discussions;
      case 'admin':
        return language === 'fr' 
          ? 'Console d\'administration' 
          : language === 'ar'
          ? 'لوحة الإدارة'
          : 'Admin Console';
      case 'member-management':
        return strings.nav.memberManagement;
      case 'signin':
        return strings.nav.signIn;
      case 'signup':
        return strings.nav.signUp;
      case 'games':
        return strings.nav.games;
      case 'lounge':
        return strings.nav.theLounge;
      case 'reports':
        return strings.nav.reports;
      case 'rules':
        return strings.nav.rules || (language === 'fr' ? 'Réglement' : language === 'ar' ? 'القوانين' : 'Rules');
      default:
        return null;
    }
  };

  const currentViewLabel = getCurrentViewLabel();

  return (
    <div className="min-h-screen flex bg-[#FAF8F5] text-[#2C332E] relative selection:bg-[#E5EEE9] selection:text-[#183424]">
      {/* Backdrop for mobile/tablet drawer */}
      {isSidebarOpen && (
        <div
          id="sidebar-backdrop"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/45 backdrop-blur-xs z-40 lg:hidden cursor-pointer transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* 
        ========================================================================
        PERSISTENT SIDEBAR (Left in LTR, Right in RTL)
        Takes up the full portion of the screen height (from top to bottom).
        OPEN by default on desktop. Collapsible and re-openable on a single click.
        ========================================================================
      */}
      <aside
        id="app-left-sidebar"
        aria-label="Application Navigation Sidebar"
        className={`fixed top-0 bottom-0 z-50 h-screen w-72 bg-[#FAF8F5] flex flex-col transition-all duration-300 ease-in-out ${
          language === 'ar'
            ? `right-0 border-l border-[#E6E0D6] ${
                isSidebarOpen
                  ? 'translate-x-0 shadow-2xl lg:shadow-none'
                  : 'translate-x-full lg:w-0 lg:overflow-hidden pointer-events-none'
              }`
            : `left-0 border-r border-[#E6E0D6] ${
                isSidebarOpen
                  ? 'translate-x-0 shadow-2xl lg:shadow-none'
                  : '-translate-x-full lg:w-0 lg:overflow-hidden pointer-events-none'
              }`
        }`}
      >
        {/* Sidebar Header: Brand Logo & Simple Arrow Collapse Button */}
        <div className="p-4 sm:p-5 border-b border-[#EAE4DC] flex items-center justify-between bg-[#F4EFE7]/80 shrink-0">
          <button
            id="sidebar-brand-logo-btn"
            onClick={handleHome}
            className="flex items-center gap-3 text-left rtl:text-right group cursor-pointer focus:outline-none min-w-0"
            title="3awdli • Return to Home"
          >
            <div className="w-10 h-10 rounded-2xl bg-[#315243] text-white flex items-center justify-center shadow-xs group-hover:bg-[#244133] transition-colors shrink-0">
              <Heart className="w-5 h-5 text-emerald-200 fill-emerald-200/20" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-[#1F362C] font-['Lora',serif]">
                  3awdli
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E5EEE9] text-[#2F5342] font-semibold border border-[#D0E0D7]">
                  {language === 'ar' ? 'فريق الدعم' : language === 'fr' ? 'Équipe' : 'Team'}
                </span>
              </div>
              <p className="text-[11px] text-[#627068] truncate mt-0.5">
                {language === 'ar' ? 'الدعم النفسي السري والآمن' : 'Confidential Mental Health'}
              </p>
            </div>
          </button>

          {/* Close / Collapse Toggle Button: Simple "<" arrow, NO text label */}
          <button
            type="button"
            id="sidebar-header-collapse-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleSidebar();
            }}
            className="flex items-center justify-center w-8 h-8 rounded-xl text-[#5A6E63] hover:text-[#182C22] hover:bg-[#EAE4DA] transition-colors cursor-pointer shrink-0"
            title={strings.nav.collapseSidebar}
            aria-label={strings.nav.collapseSidebar}
          >
            <ChevronLeft className="w-5 h-5 text-[#315243] rtl:rotate-180" strokeWidth={2.5} />
          </button>
        </div>

        {/* User Status / Account Indicator in Sidebar */}
        <div className="px-4 py-3 bg-[#EFECE4]/75 border-b border-[#EAE4DC] shrink-0">
          {currentUser ? (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#2F5141] text-emerald-100 flex items-center justify-center text-xs font-bold uppercase shadow-2xs shrink-0">
                {currentUser.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs sm:text-sm font-bold text-[#1C3328] truncate">
                    {currentUser.name}
                  </p>
                  {isSuperAdminAccount ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#254233] text-white">
                      {strings.nav.admin}
                    </span>
                  ) : isAdministratorAccount ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-900 border border-purple-300">
                      {strings.nav.administrator}
                    </span>
                  ) : isListener ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#E5F2EB] text-[#225738] border border-[#CDE5D8]">
                      {strings.nav.listener}
                    </span>
                  ) : (
                    <span className="text-[9px] font-medium px-1.5 py-0.2 rounded-full bg-[#EDE8DE] text-[#4A5D52]">
                      {strings.nav.member}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#63756C] truncate mt-0.5">
                  {currentUser.email}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-[#253E32]">
                  {strings.nav.anonymousVisitor}
                </p>
                <p className="text-[10.5px] text-[#697970] mt-0.5">
                  {strings.nav.safeAndConfidential}
                </p>
              </div>
              {onOpenAuth && (
                <button
                  id="sidebar-quick-signin-btn"
                  onClick={() => handleAuth('signin')}
                  className="text-xs font-semibold text-[#294B3A] hover:underline cursor-pointer"
                >
                  {strings.nav.signIn}
                </button>
              )}
            </div>
          )}

          {/* Language Switcher near user name / profile area */}
          <div className="mt-3 pt-2.5 border-t border-[#E3DDD2] flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-[#52645A] font-medium">
              <Globe className="w-3.5 h-3.5 text-[#305241]" />
              <span>{strings.common.language}</span>
            </div>
            <div className="inline-flex rounded-lg bg-[#E2DBD0] p-0.5 border border-[#D3CBBF] shadow-2xs">
              <button
                type="button"
                id="sidebar-language-en-btn"
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-0.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  language === 'en'
                    ? 'bg-[#315243] text-white shadow-2xs font-bold'
                    : 'text-[#4D6054] hover:text-[#1F3327]'
                }`}
                title="English"
              >
                EN
              </button>
              <button
                type="button"
                id="sidebar-language-fr-btn"
                onClick={() => setLanguage('fr')}
                className={`px-2.5 py-0.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  language === 'fr'
                    ? 'bg-[#315243] text-white shadow-2xs font-bold'
                    : 'text-[#4D6054] hover:text-[#1F3327]'
                }`}
                title="Français"
              >
                FR
              </button>
              <button
                type="button"
                id="sidebar-language-ar-btn"
                onClick={() => setLanguage('ar')}
                className={`px-2.5 py-0.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  language === 'ar'
                    ? 'bg-[#315243] text-white shadow-2xs font-bold'
                    : 'text-[#4D6054] hover:text-[#1F3327]'
                }`}
                title="العربية"
              >
                AR
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Nav Items List (fixed order, scrollable if height constrained) */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          <div className="px-2 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-[#798880]">
            {strings.nav.menu}
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                id={item.id}
                onClick={() => {
                  closeSidebarOnMobile();
                  item.onClick();
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left rtl:text-right transition-all cursor-pointer group ${
                  item.isActive
                    ? 'bg-[#264634] text-white shadow-xs'
                    : item.isDestructive
                    ? 'text-[#A84032] hover:bg-[#FBF0EE]'
                    : 'text-[#30463B] hover:bg-[#EFECE5]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      item.isActive
                        ? 'bg-[#183424] text-emerald-200'
                        : item.isDestructive
                        ? 'bg-[#FBEBE8] text-[#A84032]'
                        : 'bg-[#EAE4DA] text-[#315243] group-hover:bg-[#DFD8CC]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs sm:text-sm ${
                          item.isActive ? 'font-bold text-white' : 'font-semibold'
                        }`}
                      >
                        {item.label}
                      </span>
                      {item.badge ? (
                        <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-bold animate-pulse">
                          {item.badge}
                        </span>
                      ) : null}
                    </div>
                    {item.description && (
                      <p
                        className={`text-[11px] truncate mt-0.5 ${
                          item.isActive ? 'text-emerald-100/80' : 'text-[#6D7D74]'
                        }`}
                      >
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 pl-2 rtl:pl-0 rtl:pr-2">
                  {item.isActive ? (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#183424] text-emerald-200 border border-emerald-500/20">
                      {strings.common.active}
                    </span>
                  ) : (
                    <ChevronRight
                      className={`w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 rtl:rotate-180 transition-all ${
                        item.isDestructive ? 'text-[#A84032]' : 'text-[#506358]'
                      }`}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Bottom Footer */}
        <div className="px-4 py-3 border-t border-[#EAE4DC] bg-[#F7F4EE] flex items-center justify-between text-[11px] text-[#718077] shrink-0">
          <span className="font-medium">3awdli Community</span>
          <button
            type="button"
            id="sidebar-bottom-collapse-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleSidebar();
            }}
            className="p-1 rounded-lg text-[#315243] hover:bg-[#EAE4DA] transition-colors cursor-pointer"
            title={strings.nav.collapseSidebar}
            aria-label={strings.nav.collapseSidebar}
          >
            <ChevronLeft className="w-4 h-4 text-[#315243] rtl:rotate-180" strokeWidth={2.5} />
          </button>
        </div>
      </aside>

      {/* 
        ========================================================================
        MAIN PAGE WRAPPER
        Shifts to sit in the remaining space on desktop.
        ========================================================================
      */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          language === 'ar'
            ? isSidebarOpen ? 'lg:pr-72 lg:pl-0' : 'lg:pr-0 lg:pl-0'
            : isSidebarOpen ? 'lg:pl-72 lg:pr-0' : 'lg:pl-0 lg:pr-0'
        }`}
      >
        {/* 
          ========================================================================
          STICKY TOP BAR
          Stays sticky at the top of the screen at all times while user scrolls.
          Contains:
            - Left: Single-click toggle button (flips < and > with NO text)
            - Right: "Talk" / "Talk Anonymously" and "Emergency Help" (STICKY)
          ========================================================================
        */}
        <header
          id="sticky-top-navbar"
          className="sticky top-0 z-30 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-[#E9E4DC] shadow-2xs h-16 sm:h-20 flex items-center justify-between px-3 sm:px-6 lg:px-8 gap-2 sm:gap-3"
        >
          {/* Left area: Menu toggle icon button on mobile and desktop */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            {/* Sidebar Toggle Button: Visible on both mobile and desktop screens */}
            <button
              type="button"
              id="sidebar-toggle-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleSidebar();
              }}
              className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#F0EDE5] hover:bg-[#E7E2D7] text-[#1E362A] border border-[#DDD6C7] transition-all cursor-pointer shadow-2xs group shrink-0"
              title={isSidebarOpen ? strings.nav.collapseSidebar : strings.nav.openSidebar}
              aria-label={isSidebarOpen ? strings.nav.collapseSidebar : strings.nav.openSidebar}
            >
              {isSidebarOpen ? (
                <ChevronLeft className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#315243] rtl:rotate-180 group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5 transition-transform" strokeWidth={2.5} />
              ) : (
                <ChevronRight className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#315243] rtl:rotate-180 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform" strokeWidth={2.5} />
              )}
              {unreadShareCount > 0 && !isSidebarOpen && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
              )}
            </button>

            {/* Desktop Logo in top bar when sidebar is collapsed on desktop */}
            {!isSidebarOpen && (
              <button
                type="button"
                id="topbar-brand-logo-btn"
                onClick={handleHome}
                className="hidden lg:flex items-center gap-2 cursor-pointer group focus:outline-none shrink-0"
                title="Return to 3awdli Home"
              >
                <div className="w-8 h-8 rounded-xl bg-[#315243] text-white flex items-center justify-center shadow-xs group-hover:bg-[#244133] transition-colors">
                  <Heart className="w-4 h-4 text-emerald-200 fill-emerald-200/20" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base sm:text-lg font-bold tracking-tight text-[#1F362C] font-['Lora',serif]">
                    3awdli
                  </span>
                  <span className="inline-block text-[10px] px-1.5 py-0.2 rounded-full bg-[#E5EEE9] text-[#2F5342] font-semibold border border-[#D0E0D7]">
                    {language === 'ar' ? 'فريق الدعم' : language === 'fr' ? 'Équipe' : 'Team'}
                  </span>
                </div>
              </button>
            )}

            {/* Current View Indicator Tag: Hidden on mobile to keep top bar strictly minimal */}
            {currentViewLabel && (
              <div className="hidden lg:flex items-center gap-2 text-xs text-[#67776F] shrink-0">
                {!isSidebarOpen && <span className="text-[#A5B2AA]">•</span>}
                <span className="font-semibold text-[#274636] px-2.5 py-1 rounded-lg bg-[#ECE8E0]/90 border border-[#DDD6C8] text-xs">
                  {currentViewLabel}
                </span>
              </div>
            )}
          </div>

          {/* 
            ====================================================================
            TOP RIGHT (STICKY):
            On Mobile: Shows ONLY "Talk Openly" / "Talk Anonymously" and "Emergency Help".
            On Desktop: Shows "Sign In", "Sign Up", ConnectedTeamIndicator, 
                        "Talk Openly" / "Talk Anonymously", and "Emergency Help".
            ====================================================================
          */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 ml-auto rtl:mr-auto rtl:ml-0">
            {/* Desktop only: "Sign In" and "Sign Up" in top bar (on mobile they reside in the sidebar menu) */}
            {!currentUser && onOpenAuth && (
              <div className="hidden lg:flex items-center gap-1.5 sm:gap-2.5">
                <button
                  type="button"
                  id="topbar-signin-btn"
                  onClick={() => handleAuth('signin')}
                  className={`flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl transition-all cursor-pointer shrink-0 ${
                    currentView === 'signin'
                      ? 'bg-[#E7E1D6] text-[#1B3426]'
                      : 'text-[#2D4D3D] hover:text-[#182C22] hover:bg-[#EAE4DA]/75'
                  }`}
                  title="Sign In to your account"
                >
                  <LogIn className="w-3.5 h-3.5 text-[#355B47]" />
                  <span>{strings.nav.signIn}</span>
                </button>

                <button
                  type="button"
                  id="topbar-signup-btn"
                  onClick={() => handleAuth('signup')}
                  className={`flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl transition-all shadow-2xs hover:shadow-xs cursor-pointer shrink-0 border ${
                    currentView === 'signup'
                      ? 'bg-[#264634] text-white border-[#264634]'
                      : 'text-[#244534] bg-[#EAF2ED] hover:bg-[#DDEAE2] border-[#CFE1D6]'
                  }`}
                  title={language === 'fr' ? 'Créer un compte gratuit' : 'Create a free account'}
                >
                  <UserPlus className="w-3.5 h-3.5 text-[#2B523E]" />
                  <span>{strings.nav.signUp}</span>
                </button>
              </div>
            )}

            {/* Desktop only: Connected Team Members Indicator */}
            {canViewConnectedTeam && (
              <div className="hidden lg:block">
                <ConnectedTeamIndicator
                  currentUser={currentUser}
                  language={language}
                />
              </div>
            )}

            {/* 1. "Talk Openly" (logged-in) or "Talk Anonymously" (anonymous visitors) */}
            {onTalkAnonymously && (
              <button
                id="nav-talk-anonymously-btn"
                onClick={handleTalk}
                className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold text-white bg-[#264634] hover:bg-[#1E3729] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-all shadow-xs hover:shadow-sm cursor-pointer shrink-0 whitespace-nowrap"
                title={currentUser ? (language === 'fr' ? 'Démarrer une conversation ouvertement' : 'Start a conversation openly') : (language === 'fr' ? 'Démarrer une conversation anonyme gratuite' : 'Start a free, anonymous conversation')}
              >
                <MessageCircleHeart className="w-4 h-4 text-emerald-200 shrink-0" />
                <span>{currentUser ? strings.common.talkOpenly : strings.common.talkAnonymously}</span>
              </button>
            )}

            {/* 2. "Emergency Help" Button */}
            {onOpenEmergencyModal && (
              <button
                id="nav-emergency-help-btn"
                onClick={handleEmergency}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#9E3624] bg-[#FFF2EE] hover:bg-[#FDE7E1] border border-[#F5C4B7] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-all shadow-2xs hover:shadow-xs cursor-pointer shrink-0 ring-1 ring-[#E85D45]/20 hover:ring-[#E85D45]/30 whitespace-nowrap"
                title={language === 'fr' ? 'Numéros d\'urgence & ressources de crise' : 'Emergency Hotline & Crisis Resources'}
              >
                <LifeBuoy className="w-4 h-4 text-[#C24127] shrink-0" />
                <span>{strings.nav.emergencyHelp}</span>
              </button>
            )}
          </div>
        </header>

        {/* Page Content passed as children */}
        {children ? (
          <div className="flex-1 flex flex-col min-w-0">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
};
