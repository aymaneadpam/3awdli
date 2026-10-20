import { useState, useMemo, useEffect } from 'react';
import { 
  Heart, 
  Search, 
  Sparkles, 
  Star, 
  Briefcase, 
  Check, 
  Copy, 
  ArrowLeft, 
  User, 
  Users,
  Lock,
  LogOut, 
  LifeBuoy, 
  UserPlus, 
  AlertCircle,
  X,
  Edit3,
  RotateCcw,
  Inbox,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Coffee,
  PenTool,
  Ban,
  AlertTriangle,
  Globe,
  Clock
} from 'lucide-react';
import { UserAccount, Gender, SupportRequest } from '../types';
import { useSiteTimezone } from '../utils/timezoneManagement';
import { 
  getStoredUsers, 
  grantListenerBadge, 
  updateListenerProfession, 
  toggleHeadOfListeners, 
  revokeListenerBadge,
  assignRoleToUser,
  revokeExpertFacilitatorRole,
  revokeWriterRole,
  assignAdministratorRole,
  revokeAdministratorRole,
  isExpertFacilitator,
  isSuperAdmin,
  isAdministrator,
  getUserWarningCount,
  isUserAccountBanned,
  ADMIN_EMAIL,
  AssignableUnifiedRole,
  StoredUser 
} from '../utils/userManagement';
import { getStoredSupportRequests } from '../utils/supportRequests';
import { ListenerGenderIcon } from './ListenerGenderDisplay';
import { AdminSupportRequests } from './AdminSupportRequests';
import { Navbar } from './Navbar';
import { useLanguage } from '../context/LanguageContext';

interface AdminRoleManagementProps {
  currentUser: UserAccount;
  mode?: 'admin' | 'member-management' | 'admin-support';
  initialTab?: 'users' | 'support_requests';
  onNavigateHome: () => void;
  onNavigateDashboard: () => void;
  onNavigateDiscussions?: (tab?: 'unopened' | 'mailbox') => void;
  onNavigateGames?: () => void;
  onNavigateTeenSpace?: () => void;
  onNavigateLounge?: () => void;
  onNavigateRules?: () => void;
  onNavigateSchedules?: () => void;
  onNavigateAdmin?: () => void;
  onNavigateMemberManagement?: () => void;
  onNavigateAdminReports?: () => void;
  onNavigateAdminSupport?: () => void;
  onSignOut: () => void;
  onOpenEmergencyModal: () => void;
  onOpenContactSupport?: () => void;
  onSwitchUser?: (user: UserAccount) => void;
  onTalkAnonymously?: () => void;
}

export const AdminRoleManagement = ({
  currentUser,
  mode = 'admin',
  initialTab,
  onNavigateHome,
  onNavigateDashboard,
  onNavigateDiscussions,
  onNavigateGames,
  onNavigateTeenSpace,
  onNavigateLounge,
  onNavigateRules,
  onNavigateSchedules,
  onNavigateAdmin,
  onNavigateMemberManagement,
  onNavigateAdminReports,
  onNavigateAdminSupport,
  onSignOut,
  onOpenEmergencyModal,
  onOpenContactSupport,
  onSwitchUser,
  onTalkAnonymously,
}: AdminRoleManagementProps) => {
  const isSuperAdminUser = isSuperAdmin(currentUser);
  const isSupportOnlyMode = mode === 'admin-support';
  const isMemberManagementView = mode === 'member-management' && !isSupportOnlyMode;
  const [users, setUsers] = useState<StoredUser[]>(() => getStoredUsers());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'administrators' | 'listeners' | 'heads' | 'facilitators' | 'writers' | 'members'>('all');

  // Unified Role Assignment Modal states
  const [grantModalUser, setGrantModalUser] = useState<StoredUser | null>(null);
  const [selectedTargetRole, setSelectedTargetRole] = useState<AssignableUnifiedRole>('listener');
  const [selectedProfession, setSelectedProfession] = useState('Psychologist');
  const [customProfession, setCustomProfession] = useState('');
  const [grantGender, setGrantGender] = useState<Gender>('Male');

  // One-time code modal state (shown strictly once after granting listener / head)
  const [oneTimeCodeInfo, setOneTimeCodeInfo] = useState<{
    key: string;
    userName: string;
    userEmail: string;
    profession: string;
    gender?: Gender;
    isHead: boolean;
  } | null>(null);
  const [hasCopiedCode, setHasCopiedCode] = useState(false);

  // Edit profession modal state
  const [editProfessionUser, setEditProfessionUser] = useState<StoredUser | null>(null);
  const [editedProfessionValue, setEditedProfessionValue] = useState('');
  const [editedGenderValue, setEditedGenderValue] = useState<Gender>('Male');

  // Revoke confirmation modal state
  const [revokeUserTarget, setRevokeUserTarget] = useState<StoredUser | null>(null);

  // Feedback toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Top level workspace tab: 'users' | 'support_requests' | 'settings'
  const [adminActiveTab, setAdminActiveTab] = useState<'users' | 'support_requests' | 'settings'>(() => {
    if (initialTab) return initialTab;
    if (mode === 'admin-support') return 'support_requests';
    return 'users';
  });
  const { timezone, setTimezone, availableTimezones, currentSiteTime } = useSiteTimezone();
  const [isUpdatingTz, setIsUpdatingTz] = useState(false);
  const [supportRequestsList, setSupportRequestsList] = useState<SupportRequest[]>(() => getStoredSupportRequests());

  // Listen to support requests storage events
  useEffect(() => {
    const handleStorageUpdate = () => {
      setSupportRequestsList(getStoredSupportRequests());
    };
    window.addEventListener('3awdli_support_requests_updated', handleStorageUpdate);
    return () => window.removeEventListener('3awdli_support_requests_updated', handleStorageUpdate);
  }, []);

  const newSupportCount = useMemo(
    () => supportRequestsList.filter((r) => r.status === 'new').length,
    [supportRequestsList]
  );

  const urgentReportsCount = useMemo(
    () => supportRequestsList.filter((r) => (r.category === 'report_listener' || r.priority === 'urgent') && r.status !== 'resolved').length,
    [supportRequestsList]
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const refreshUsersList = () => {
    setUsers(getStoredUsers());
  };

  // Filter and search
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || 
        user.name.toLowerCase().includes(q) || 
        user.email.toLowerCase().includes(q) ||
        (user.profession && user.profession.toLowerCase().includes(q));

      if (!matchesQuery) return false;

      const isSuperAdminRow = user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() || user.role === 'admin';
      const isAdministratorRow = !isSuperAdminRow && (user.role === 'administrator' || Boolean(user.is_administrator) || Boolean(user.is_founder));
      const isListener = Boolean(user.is_listener || user.isListener || user.role === 'listener');
      const isHead = Boolean(user.is_head_of_listeners);
      const isFacilitator = Boolean(user.is_facilitator || user.is_host || user.role === 'facilitator');
      const isWriter = Boolean(user.is_writer || user.role === 'writer');

      if (activeFilter === 'administrators') {
        return !isMemberManagementView && isAdministratorRow;
      }
      if (activeFilter === 'listeners') {
        return isListener;
      }
      if (activeFilter === 'heads') {
        return isHead;
      }
      if (activeFilter === 'facilitators') {
        return isFacilitator;
      }
      if (activeFilter === 'writers') {
        return isWriter;
      }
      if (activeFilter === 'members') {
        if (isMemberManagementView) {
          return !isListener && !isFacilitator && !isWriter && !isSuperAdminRow;
        }
        return !isListener && !isFacilitator && !isWriter && !isAdministratorRow && !isSuperAdminRow;
      }
      return true;
    });
  }, [users, searchQuery, activeFilter, isMemberManagementView]);

  // Handle open unified role assignment modal
  const handleOpenGrantModal = (user: StoredUser) => {
    // Extra safety: cannot grant/change roles on super-admin
    if (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() || user.role === 'admin') {
      showToast('The Admin super-account is protected and cannot be modified.');
      return;
    }

    setGrantModalUser(user);
    if (!isMemberManagementView && (user.role === 'administrator' || user.is_administrator || user.is_founder)) {
      setSelectedTargetRole('administrator');
      setSelectedProfession(user.profession || 'Platform Administrator');
    } else if (user.is_head_of_listeners) {
      setSelectedTargetRole('head_of_listeners');
      setSelectedProfession(user.profession || 'Clinical Psychologist & Consultant');
    } else if (user.is_listener || user.isListener || user.role === 'listener') {
      setSelectedTargetRole('listener');
      setSelectedProfession(user.profession || 'Psychologist');
    } else if (user.is_facilitator || user.is_host || user.role === 'facilitator') {
      setSelectedTargetRole('facilitator');
      setSelectedProfession(user.profession || 'Expert Facilitator');
    } else if (user.is_writer || user.role === 'writer') {
      setSelectedTargetRole('writer');
      setSelectedProfession(user.profession || 'Psychologist');
    } else {
      setSelectedTargetRole((!isMemberManagementView && isSuperAdminUser) ? 'administrator' : 'listener');
      setSelectedProfession((!isMemberManagementView && isSuperAdminUser) ? 'Platform Administrator' : 'Psychologist');
    }
    setCustomProfession('');
    setGrantGender(user.gender || 'Male');
  };

  // Confirm role assignment
  const handleConfirmGrantBadge = () => {
    if (!grantModalUser) return;

    if (selectedTargetRole === 'administrator' && !isSuperAdminUser) {
      showToast('Only the Admin super-account (aymaneoumlala@gmail.com) can grant Administrator role.');
      return;
    }

    const defaultProf = selectedTargetRole === 'administrator'
      ? 'Platform Administrator'
      : selectedTargetRole === 'facilitator' 
      ? 'Expert Facilitator' 
      : selectedTargetRole === 'head_of_listeners' 
      ? 'Clinical Psychologist & Consultant' 
      : selectedTargetRole === 'writer'
      ? 'Psychologist'
      : 'Psychologist';

    const finalProfession = customProfession.trim() || selectedProfession || defaultProf;

    try {
      const result = assignRoleToUser(
        grantModalUser.id,
        selectedTargetRole,
        finalProfession,
        grantGender
      );
      refreshUsersList();
      setGrantModalUser(null);

      // Present the one-time access key to the admin if one was generated
      if (result.oneTimeKey) {
        setOneTimeCodeInfo({
          key: result.oneTimeKey,
          userName: result.updatedUser.name,
          userEmail: result.updatedUser.email,
          profession: result.updatedUser.profession || finalProfession,
          gender: result.updatedUser.gender || grantGender,
          isHead: Boolean(result.updatedUser.is_head_of_listeners),
        });
        setHasCopiedCode(false);
      }

      if (selectedTargetRole === 'administrator') {
        showToast(`Granted Administrator role to ${result.updatedUser.name}!`);
      } else if (selectedTargetRole === 'head_of_listeners') {
        showToast(`Assigned Head of Listeners role to ${result.updatedUser.name}!`);
      } else if (selectedTargetRole === 'listener') {
        showToast(`Granted Listener badge to ${result.updatedUser.name}!`);
      } else if (selectedTargetRole === 'facilitator') {
        showToast(`Assigned Expert Facilitator role to ${result.updatedUser.name}!`);
      } else if (selectedTargetRole === 'writer') {
        showToast(`Assigned Writer role to ${result.updatedUser.name}!`);
      } else {
        showToast(`Reverted ${result.updatedUser.name} to Regular Member.`);
      }
    } catch (err) {
      console.error(err);
      showToast('Error updating member role.');
    }
  };

  // Copy one-time key
  const handleCopyOneTimeKey = async () => {
    if (!oneTimeCodeInfo) return;
    try {
      await navigator.clipboard.writeText(oneTimeCodeInfo.key);
      setHasCopiedCode(true);
      setTimeout(() => setHasCopiedCode(false), 3000);
    } catch {
      // Fallback
      setHasCopiedCode(true);
    }
  };

  // Toggle head of listeners
  const handleToggleHead = (userId: string, currentHeadStatus: boolean, userName: string) => {
    try {
      const newStatus = !currentHeadStatus;
      toggleHeadOfListeners(userId, newStatus);
      refreshUsersList();
      showToast(newStatus ? `Designated ${userName} as Head of Listeners` : `Removed Head of Listeners role from ${userName}`);
    } catch (err) {
      console.error(err);
      showToast('Failed to update Head of Listeners status.');
    }
  };

  // Open edit profession modal
  const handleOpenEditProfession = (user: StoredUser) => {
    setEditProfessionUser(user);
    setEditedProfessionValue(user.profession || (user.is_writer ? 'Psychologist' : user.is_facilitator ? 'Expert Facilitator' : 'Psychologist'));
    setEditedGenderValue(user.gender || 'Male');
  };

  // Save edited profession
  const handleSaveProfession = () => {
    if (!editProfessionUser) return;
    try {
      updateListenerProfession(editProfessionUser.id, editedProfessionValue, editedGenderValue);
      refreshUsersList();
      setEditProfessionUser(null);
      showToast(`Updated profile for ${editProfessionUser.name}`);
    } catch (err) {
      console.error(err);
      showToast('Failed to update member profile.');
    }
  };

  // Confirm revoke badge / role
  const handleConfirmRevoke = () => {
    if (!revokeUserTarget) return;
    const isTargetAdmin = revokeUserTarget.role === 'administrator' || revokeUserTarget.is_administrator;
    if (isTargetAdmin && !isSuperAdminUser) {
      // In Member Management, an Administrator can only revoke peer roles (Listener / Facilitator / Writer)
      try {
        revokeListenerBadge(revokeUserTarget.id);
        revokeExpertFacilitatorRole(revokeUserTarget.id);
        revokeWriterRole(revokeUserTarget.id);
        refreshUsersList();
        showToast(`Revoked community role from ${revokeUserTarget.name}`);
        setRevokeUserTarget(null);
      } catch (err) {
        console.error(err);
        showToast('Failed to revoke role.');
      }
      return;
    }
    try {
      revokeListenerBadge(revokeUserTarget.id);
      revokeExpertFacilitatorRole(revokeUserTarget.id);
      revokeWriterRole(revokeUserTarget.id);
      if (isSuperAdminUser && !isMemberManagementView) {
        revokeAdministratorRole(revokeUserTarget.id);
      }
      refreshUsersList();
      showToast(`Revoked elevated role from ${revokeUserTarget.name}`);
      setRevokeUserTarget(null);
    } catch (err) {
      console.error(err);
      showToast('Failed to revoke role.');
    }
  };

  // Count stats
  const totalUsersCount = users.length;
  const administratorsCount = users.filter(u => !isSuperAdmin(u) && (u.role === 'administrator' || u.is_administrator || u.is_founder)).length;
  const listenersCount = users.filter(u => u.is_listener || u.isListener || u.role === 'listener').length;
  const headsCount = users.filter(u => u.is_head_of_listeners).length;
  const facilitatorsCount = users.filter(u => u.is_facilitator || u.is_host || u.role === 'facilitator').length;
  const writersCount = users.filter(u => Boolean(u.is_writer || u.role === 'writer')).length;
  const regularMembersCount = users.filter(u => !u.is_listener && !u.isListener && u.role !== 'listener' && !u.is_facilitator && !u.is_host && u.role !== 'facilitator' && !u.is_writer && u.role !== 'writer' && u.role !== 'admin' && u.role !== 'administrator' && !u.is_administrator).length;

  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1E372C] text-white px-5 py-3 rounded-2xl shadow-lg flex items-center gap-3 border border-[#315745] text-sm animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Persistent Left Sidebar + Sticky Top Bar Layout */}
      <Navbar
        currentView={mode === 'admin-support' || adminActiveTab === 'support_requests' ? 'admin-support' : (isMemberManagementView ? 'member-management' : 'admin')}
        currentUser={currentUser}
        onNavigateHome={onNavigateHome}
        onNavigateDashboard={onNavigateDashboard}
        onNavigateDiscussions={onNavigateDiscussions}
        onNavigateAdmin={isSuperAdminUser ? (onNavigateAdmin || (() => window.scrollTo({ top: 0, behavior: 'smooth' }))) : undefined}
        onNavigateMemberManagement={onNavigateMemberManagement || (() => window.scrollTo({ top: 0, behavior: 'smooth' }))}
        onNavigateAdminReports={onNavigateAdminReports}
        onNavigateAdminSupport={onNavigateAdminSupport || (() => {
          setAdminActiveTab('support_requests');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        })}
        onNavigateGames={onNavigateGames}
        onNavigateTeenSpace={onNavigateTeenSpace}
        onNavigateLounge={onNavigateLounge}
        onNavigateRules={onNavigateRules}
        onNavigateSchedules={onNavigateSchedules}
        onOpenContactSupport={onOpenContactSupport}
        onOpenEmergencyModal={onOpenEmergencyModal}
        onTalkAnonymously={onTalkAnonymously}
        onSignOut={onSignOut}
      >
        {/* Main Container - wide layout comfortable on all screens without horizontal scrolling */}
        <main className="flex-1 w-full max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <button
            id="admin-back-btn"
            onClick={onNavigateDashboard}
            className="inline-flex items-center gap-2 text-sm text-[#5B6D62] hover:text-[#21372C] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to My Personal Space</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#264434] text-white">
              {adminActiveTab === 'support_requests'
                ? `Administrator Support: ${currentUser.name}`
                : isMemberManagementView
                  ? (isSuperAdminUser ? `Admin (Member Management): ${currentUser.name}` : `Administrator: ${currentUser.name}`)
                  : `System Admin: ${currentUser.name}`}
            </span>
          </div>
        </div>

        {/* Primary Workspace Sections Navigation */}
        {mode !== 'member-management' && (
          <div className="mb-8 flex items-center gap-3 border-b border-[#E5DFD5] pb-4">
            <button
              id="admin-tab-users"
              onClick={() => setAdminActiveTab('users')}
              className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2.5 ${
                adminActiveTab === 'users'
                  ? 'bg-[#294B3A] text-white shadow-xs'
                  : 'bg-white text-[#526359] border border-[#DDD7CD] hover:bg-[#F4EFE7]'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Members &amp; Roles</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-medium ${
                  adminActiveTab === 'users'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#EAE4D9] text-[#4E5E54]'
                }`}
              >
                {totalUsersCount}
              </span>
            </button>

            <button
              id="admin-tab-support"
              onClick={() => setAdminActiveTab('support_requests')}
              className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2.5 ${
                adminActiveTab === 'support_requests'
                  ? 'bg-[#294B3A] text-white shadow-xs'
                  : 'bg-white text-[#526359] border border-[#DDD7CD] hover:bg-[#F4EFE7]'
              }`}
            >
              <Inbox className="w-4 h-4" />
              <span>Support Requests &amp; Inquiries</span>
              {urgentReportsCount > 0 && (
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-red-600 text-white flex items-center gap-1 animate-pulse shadow-2xs">
                  <ShieldAlert className="w-3 h-3" />
                  <span>{urgentReportsCount} {urgentReportsCount === 1 ? 'Report' : 'Reports'}</span>
                </span>
              )}
              {newSupportCount > 0 ? (
                <span className="text-[10.5px] px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-bold animate-pulse">
                  {newSupportCount} new
                </span>
              ) : (
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-medium ${
                    adminActiveTab === 'support_requests'
                      ? 'bg-white/20 text-white'
                      : 'bg-[#EAE4D9] text-[#4E5E54]'
                  }`}
                >
                  {supportRequestsList.length}
                </span>
              )}
            </button>

            <button
              id="admin-tab-settings"
              onClick={() => setAdminActiveTab('settings')}
              className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2.5 ${
                adminActiveTab === 'settings'
                  ? 'bg-[#294B3A] text-white shadow-xs'
                  : 'bg-white text-[#526359] border border-[#DDD7CD] hover:bg-[#F4EFE7]'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>Site Timezone &amp; Settings</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                adminActiveTab === 'settings'
                  ? 'bg-white/20 text-white'
                  : 'bg-purple-100 text-purple-900 border border-purple-200'
              }`}>
                {timezone.shortLabel}
              </span>
            </button>
          </div>
        )}

        {adminActiveTab === 'settings' ? (
          <div className="space-y-6">
            {/* Settings Hero Banner */}
            <div className="bg-white rounded-3xl border border-[#E8E2D7] p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 text-xs font-semibold border border-purple-200">
                      System Settings
                    </span>
                    <span className="text-xs text-[#7C8D83]">Platform Operations &amp; Time Baseline</span>
                  </div>
                  <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-[#1F362C] font-['Lora',serif]">
                    Site Timezone &amp; Operational Clock
                  </h1>
                  <p className="mt-2 text-sm text-[#617369] max-w-2xl leading-relaxed">
                    Configure the active global timezone reference for 3awdli. This baseline determines chat availability, schedules open/closed evaluations, and all timestamp displays across the platform.
                  </p>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-2xl bg-purple-50/80 border border-purple-200 self-start lg:self-auto">
                  <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Clock className="w-5 h-5 text-purple-100" />
                  </div>
                  <div>
                    <span className="text-xs text-purple-800/80 font-medium block">Active Site Time</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-purple-950 font-mono">{currentSiteTime}</span>
                      <span className="text-xs font-bold text-purple-700 bg-purple-200/80 px-2 py-0.5 rounded-full">
                        {timezone.shortLabel}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timezone Configuration Card */}
            <div className="bg-white rounded-3xl border border-[#E8E2D7] p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center shrink-0">
                  <Globe className="w-6 h-6 text-purple-700" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#1F362A]">Timezone Reference Offset</h2>
                  <p className="text-xs sm:text-sm text-[#5D6F64] mt-1 leading-relaxed">
                    By default, 3awdli uses <strong>GMT+0 (UTC / Morocco Standard / London)</strong> as its universal baseline. Choosing a different offset will immediately update schedule evaluations and timestamps site-wide.
                  </p>
                </div>
              </div>

              <div className="pt-2 max-w-xl space-y-3">
                <label htmlFor="admin-timezone-select" className="block text-xs font-bold text-[#2A4B3A] uppercase tracking-wider">
                  Select Timezone
                </label>
                <select
                  id="admin-timezone-select"
                  value={timezone.id}
                  disabled={isUpdatingTz}
                  onChange={async (e) => {
                    setIsUpdatingTz(true);
                    try {
                      const ok = await setTimezone(e.target.value);
                      if (ok) {
                        showToast(`Site timezone successfully updated to ${e.target.value}!`);
                      }
                    } finally {
                      setIsUpdatingTz(false);
                    }
                  }}
                  className="w-full px-4 py-3 rounded-2xl bg-[#FAF8F5] border border-[#DDD6C8] text-sm font-semibold text-[#1F362C] focus:outline-none focus:ring-2 focus:ring-[#2C4E3A] cursor-pointer"
                >
                  {availableTimezones.map((tz) => (
                    <option key={tz.id} value={tz.id}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Presets */}
              <div className="pt-2">
                <span className="text-xs font-bold text-[#2A4B3A] uppercase tracking-wider block mb-2">
                  Quick Presets
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {['GMT+0', 'GMT+1', 'GMT+2', 'GMT+3', 'GMT-5'].map((tzId) => {
                    const isSelected = timezone.id === tzId;
                    return (
                      <button
                        key={tzId}
                        type="button"
                        disabled={isUpdatingTz}
                        onClick={async () => {
                          setIsUpdatingTz(true);
                          try {
                            const ok = await setTimezone(tzId);
                            if (ok) {
                              showToast(`Site timezone set to ${tzId}!`);
                            }
                          } finally {
                            setIsUpdatingTz(false);
                          }
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#284938] text-white shadow-xs'
                            : 'bg-[#FAF8F5] text-[#334D3F] border border-[#DDD6C8] hover:bg-[#F2ECE2]'
                        }`}
                      >
                        {tzId === 'GMT+0' ? 'GMT+0 (Default Baseline)' : tzId}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : adminActiveTab === 'support_requests' ? (
          <div>
            {/* Dedicated Support Hero Banner */}
            <div className="bg-white rounded-3xl border border-[#E8E2D7] p-6 sm:p-8 shadow-xs mb-8">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#E5EEE9] text-[#284B38] text-xs font-semibold border border-[#CFE1D6]">
                      Administrator Support Desk
                    </span>
                    <span className="text-xs text-[#7C8D83]">Direct Site Inquiries &amp; Ban Appeals</span>
                  </div>
                  <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-[#1F362C] font-['Lora',serif]">
                    Support Requests &amp; Contact Messages
                  </h1>
                  <p className="mt-2 text-sm text-[#617369] max-w-2xl leading-relaxed">
                    Messages submitted by users and guests via <strong>&quot;Contact Support&quot;</strong>, including account assistance, ban appeals, technical issues, and feedback.
                  </p>
                </div>
              </div>
            </div>

            {/* Support Requests Management Component */}
            <AdminSupportRequests onShowToast={showToast} />
          </div>
        ) : (
          <div>
            {/* Hero Title & Stats Banner */}
            {isMemberManagementView ? (
              <div className="bg-white rounded-3xl border border-[#E8E2D7] p-6 sm:p-8 shadow-xs mb-8">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#E5EEE9] text-[#284B38] text-xs font-semibold border border-[#CFE1D6]">
                        Member Management
                      </span>
                      <span className="text-xs text-[#7C8D83]">
                        Community Peer Roles Directory
                      </span>
                    </div>
                    <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-[#1F362C] font-['Lora',serif] flex items-center gap-2.5">
                      <Users className="w-7 h-7 text-[#254233]" />
                      <span>Member Management</span>
                    </h1>
                    <p className="mt-2 text-sm text-[#617369] max-w-2xl leading-relaxed">
                      Directory of registered members. As an Administrator, you can view member roles, designate supervisory <strong>Head of Listeners</strong>, grant verified <strong>Listener Badges</strong>, assign <strong>Expert Facilitator</strong> privileges for The Lounge, or grant <strong>Writer</strong> roles for Teen Space.
                    </p>
                  </div>

                  {/* Quick Metrics (Member Management: 5 cards) */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 shrink-0">
                    <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#EAE4D9] text-center min-w-[75px]">
                      <div className="text-xl sm:text-2xl font-bold text-[#1F362C] font-['Lora',serif]">{totalUsersCount}</div>
                      <div className="text-[10px] font-medium text-[#7C8D83] mt-0.5">Total Members</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#E8F1EC] border border-[#CCE0D4] text-center min-w-[75px]">
                      <div className="text-xl sm:text-2xl font-bold text-[#234533] font-['Lora',serif]">{listenersCount}</div>
                      <div className="text-[10px] font-semibold text-[#2C523D] mt-0.5">Listeners Team</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#FEF3C7] border border-[#FDE68A] text-center min-w-[75px]">
                      <div className="text-xl sm:text-2xl font-bold text-[#92400E] font-['Lora',serif]">{headsCount}</div>
                      <div className="text-[10px] font-semibold text-[#B45309] mt-0.5">Head Listeners</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA] text-center min-w-[75px]">
                      <div className="text-xl sm:text-2xl font-bold text-[#C2410C] font-['Lora',serif]">{facilitatorsCount}</div>
                      <div className="text-[10px] font-semibold text-[#EA580C] mt-0.5">Facilitators</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] text-center min-w-[75px]">
                      <div className="text-xl sm:text-2xl font-bold text-[#1D4ED8] font-['Lora',serif]">{writersCount}</div>
                      <div className="text-[10px] font-semibold text-[#1E40AF] mt-0.5">Writers</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-[#E8E2D7] p-6 sm:p-8 shadow-xs mb-8">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#E5EEE9] text-[#284B38] text-xs font-semibold border border-[#CFE1D6]">
                        Super Admin Console
                      </span>
                      <span className="text-xs text-[#7C8D83]">
                        Platform Super-Account Authority
                      </span>
                    </div>
                    <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-[#1F362C] font-['Lora',serif]">
                      Members &amp; Role Management
                    </h1>
                    <p className="mt-2 text-sm text-[#617369] max-w-2xl leading-relaxed">
                      Browse all registered members and manage elevated roles: grant or revoke assignable Administrator privileges, designate supervisory <strong>Head of Listeners</strong>, grant verified <strong>Listener Badges</strong>, assign <strong>Expert Facilitator</strong> privileges for The Lounge, or grant <strong>Writer</strong> roles for Teen Space.
                    </p>
                  </div>

                  {/* Quick Metrics (Super Admin: 6 cards including Administrators & Writers) */}
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 shrink-0">
                    <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#EAE4D9] text-center min-w-[75px]">
                      <div className="text-xl sm:text-2xl font-bold text-[#1F362C] font-['Lora',serif]">{totalUsersCount}</div>
                      <div className="text-[10px] font-medium text-[#7C8D83] mt-0.5">Total Members</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#F5F3FF] border border-[#DDD6FE] text-center min-w-[75px]">
                      <div className="text-xl sm:text-2xl font-bold text-[#6D28D9] font-['Lora',serif]">{administratorsCount}</div>
                      <div className="text-[10px] font-semibold text-[#7C3AED] mt-0.5">Admins</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#E8F1EC] border border-[#CCE0D4] text-center min-w-[75px]">
                      <div className="text-xl sm:text-2xl font-bold text-[#234533] font-['Lora',serif]">{listenersCount}</div>
                      <div className="text-[10px] font-semibold text-[#2C523D] mt-0.5">Listeners</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#FEF3C7] border border-[#FDE68A] text-center min-w-[75px]">
                      <div className="text-xl sm:text-2xl font-bold text-[#92400E] font-['Lora',serif]">{headsCount}</div>
                      <div className="text-[10px] font-semibold text-[#B45309] mt-0.5">Head Listeners</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA] text-center min-w-[75px]">
                      <div className="text-xl sm:text-2xl font-bold text-[#C2410C] font-['Lora',serif]">{facilitatorsCount}</div>
                      <div className="text-[10px] font-semibold text-[#EA580C] mt-0.5">Facilitators</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] text-center min-w-[75px]">
                      <div className="text-xl sm:text-2xl font-bold text-[#1D4ED8] font-['Lora',serif]">{writersCount}</div>
                      <div className="text-[10px] font-semibold text-[#1E40AF] mt-0.5">Writers</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

        {/* Toolbar: Search and Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#819288] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="admin-user-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or profession..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white rounded-2xl border border-[#D9D3C7] focus:outline-none focus:ring-2 focus:ring-[#315243] focus:border-transparent text-[#26352C] placeholder-[#9EAEA4]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#889B90] hover:text-[#284939] cursor-pointer p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              id="filter-all-btn"
              onClick={() => setActiveFilter('all')}
              className={`text-xs font-semibold px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeFilter === 'all'
                  ? 'bg-[#284939] text-white shadow-xs'
                  : 'bg-white text-[#5E7065] border border-[#DDD6CB] hover:bg-[#F2EFE9]'
              }`}
            >
              All ({totalUsersCount})
            </button>
            {!isMemberManagementView && (
              <button
                id="filter-administrators-btn"
                onClick={() => setActiveFilter('administrators')}
                className={`text-xs font-semibold px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeFilter === 'administrators'
                    ? 'bg-[#6D28D9] text-white shadow-xs'
                    : 'bg-white text-[#5E7065] border border-[#DDD6CB] hover:bg-[#F2EFE9]'
                }`}
              >
                <ShieldCheck className="w-3 h-3" />
                Administrators ({administratorsCount})
              </button>
            )}
            <button
              id="filter-listeners-btn"
              onClick={() => setActiveFilter('listeners')}
              className={`text-xs font-semibold px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeFilter === 'listeners'
                  ? 'bg-[#284939] text-white shadow-xs'
                  : 'bg-white text-[#5E7065] border border-[#DDD6CB] hover:bg-[#F2EFE9]'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              Listeners ({listenersCount})
            </button>
            <button
              id="filter-heads-btn"
              onClick={() => setActiveFilter('heads')}
              className={`text-xs font-semibold px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeFilter === 'heads'
                  ? 'bg-[#B45309] text-white shadow-xs'
                  : 'bg-white text-[#5E7065] border border-[#DDD6CB] hover:bg-[#F2EFE9]'
              }`}
            >
              <Star className="w-3 h-3" />
              Head Listeners ({headsCount})
            </button>
            <button
              id="filter-facilitators-btn"
              onClick={() => setActiveFilter('facilitators')}
              className={`text-xs font-semibold px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeFilter === 'facilitators'
                  ? 'bg-[#C2410C] text-white shadow-xs'
                  : 'bg-white text-[#5E7065] border border-[#DDD6CB] hover:bg-[#F2EFE9]'
              }`}
            >
              <ShieldCheck className="w-3 h-3" />
              Expert Facilitators ({facilitatorsCount})
            </button>
            <button
              id="filter-writers-btn"
              onClick={() => setActiveFilter('writers')}
              className={`text-xs font-semibold px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeFilter === 'writers'
                  ? 'bg-[#1D4ED8] text-white shadow-xs'
                  : 'bg-white text-[#5E7065] border border-[#DDD6CB] hover:bg-[#F2EFE9]'
              }`}
            >
              <PenTool className="w-3 h-3" />
              Writers ({writersCount})
            </button>
            <button
              id="filter-members-btn"
              onClick={() => setActiveFilter('members')}
              className={`text-xs font-semibold px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeFilter === 'members'
                  ? 'bg-[#284939] text-white shadow-xs'
                  : 'bg-white text-[#5E7065] border border-[#DDD6CB] hover:bg-[#F2EFE9]'
              }`}
            >
              Regular Members ({regularMembersCount})
            </button>
          </div>
        </div>

        {/* Users Table / Directory */}
        <div className="bg-white rounded-3xl border border-[#E8E2D7] overflow-hidden shadow-xs">
          {filteredUsers.length === 0 ? (
            <div className="p-12 text-center">
              <Search className="w-8 h-8 text-[#98A89F] mx-auto mb-3" />
              <p className="text-sm font-semibold text-[#2F4438]">No matching users found</p>
              <p className="text-xs text-[#7B8B82] mt-1">Try refining your search query or filter selection</p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-3 text-xs font-semibold text-[#294B3A] underline cursor-pointer"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-auto">
                <thead>
                  <tr className="border-b border-[#EAE4D9] bg-[#FAF8F5] text-[11px] font-semibold text-[#5B6D62] uppercase tracking-wider">
                    <th className="py-3.5 px-4 lg:px-6">User Full Name</th>
                    <th className="py-3.5 px-4 lg:px-6">Profession</th>
                    <th className="py-3.5 px-4 lg:px-6">Role</th>
                    <th className="py-3.5 px-4 lg:px-6">Edit Role</th>
                    {isSuperAdminUser && <th className="py-3.5 px-4 lg:px-6 text-right">Preview As</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EBE1] text-xs">
                  {filteredUsers.map((user) => {
                    const isSuperAccount = user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() || user.role === 'admin';
                    const isAdministratorUser = !isSuperAccount && (user.role === 'administrator' || Boolean(user.is_administrator) || Boolean(user.is_founder));
                    const isListener = Boolean(user.is_listener || user.isListener || user.role === 'listener');
                    const isHead = Boolean(user.is_head_of_listeners);
                    const isFacilitator = Boolean(user.is_facilitator || user.is_host || user.role === 'facilitator');
                    const isWriter = Boolean(user.is_writer || user.role === 'writer');
                    const isCurrentAdminRow = user.id === currentUser.id;
                    const isBanned = Boolean(user.is_banned || isUserAccountBanned(user.id));
                    const warningCount = getUserWarningCount(user);

                    return (
                      <tr 
                        key={user.id} 
                        className={`hover:bg-[#FAF8F5]/80 transition-colors ${
                          isSuperAccount
                            ? 'bg-emerald-50/20'
                            : isAdministratorUser
                            ? 'bg-purple-50/20'
                            : isHead 
                            ? 'bg-amber-50/20' 
                            : isListener 
                            ? 'bg-emerald-50/20' 
                            : isFacilitator 
                            ? 'bg-orange-50/20' 
                            : isWriter
                            ? 'bg-blue-50/20'
                            : ''
                        }`}
                      >
                        {/* User Account Info */}
                        <td className="py-4 px-4 lg:px-6">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                              isSuperAccount 
                                ? 'bg-[#284939] text-white shadow-xs' 
                                : !isMemberManagementView && isAdministratorUser
                                ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                : isHead
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : isListener 
                                ? 'bg-[#E0EDE5] text-[#224433] border border-[#CCDED3]' 
                                : isFacilitator
                                ? 'bg-orange-100 text-orange-900 border border-orange-300'
                                : isWriter
                                ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                : 'bg-[#EFECE6] text-[#4F5E56]'
                            }`}>
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-sm text-[#1F3328] flex items-center gap-1.5 flex-wrap">
                                <span>{user.name}</span>

                                {/* Sanction Status Label: Banned or Warned (N) */}
                                {isBanned ? (
                                  <span
                                    id={`member-status-banned-${user.id}`}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white shadow-2xs shrink-0"
                                    title={user.banReason ? `Banned: ${user.banReason}` : 'Account is banned from logging in'}
                                  >
                                    <Ban className="w-3 h-3" />
                                    <span>Banned</span>
                                  </span>
                                ) : warningCount > 0 ? (
                                  <span
                                    id={`member-status-warned-${user.id}`}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-2xs shrink-0"
                                    title={`Member has received ${warningCount} official warning${warningCount > 1 ? 's' : ''}`}
                                  >
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>Warned ({warningCount})</span>
                                  </span>
                                ) : null}

                                {isCurrentAdminRow && (
                                  <span className="text-[10px] px-1.5 py-0.2 bg-[#E2ECE6] text-[#254534] rounded font-mono">
                                    You {isMemberManagementView ? '' : `(${isSuperAdminUser ? 'Admin' : 'Administrator'})`}
                                  </span>
                                )}
                              </div>
                              <div className="text-[#6D7F75] text-[11px]">{user.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Profession Column */}
                        <td className="py-4 px-4 lg:px-6">
                          {!isMemberManagementView && isAdministratorUser ? (
                            <div className="flex items-center gap-2">
                              <div className="inline-flex items-center gap-2 font-medium text-purple-900 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                                <span>{user.profession || 'Platform Administrator'}</span>
                                <ListenerGenderIcon gender={user.gender || 'Male'} />
                              </div>
                              {isSuperAdminUser && (
                                <button
                                  id={`edit-profession-${user.id}`}
                                  onClick={() => handleOpenEditProfession(user)}
                                  className="p-1 text-[#65766C] hover:text-[#254534] hover:bg-[#EAE5DC] rounded-lg transition-colors cursor-pointer"
                                  title="Edit Profession & Gender"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ) : isListener || isFacilitator || isWriter ? (
                            <div className="flex items-center gap-2">
                              <div className="inline-flex items-center gap-2 font-medium text-[#254233] bg-[#F1F6F3] px-2.5 py-1 rounded-lg border border-[#D9E6DE]">
                                <span>{user.profession || (isWriter ? 'Psychologist' : isFacilitator ? 'Expert Facilitator' : 'Psychologist')}</span>
                                <ListenerGenderIcon gender={user.gender || 'Male'} />
                              </div>
                              <button
                                id={`edit-profession-${user.id}`}
                                onClick={() => handleOpenEditProfession(user)}
                                className="p-1 text-[#65766C] hover:text-[#254534] hover:bg-[#EAE5DC] rounded-lg transition-colors cursor-pointer"
                                title="Edit Profession & Gender"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[#96A79E] italic text-[11px]">—</span>
                          )}
                        </td>

                        {/* 3. Role Column */}
                        <td className="py-4 px-4 lg:px-6">
                          <div className="flex flex-col gap-1 items-start">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isSuperAccount && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#254233] text-white">
                                  {isMemberManagementView ? (
                                    <>
                                      <Lock className="w-3 h-3 text-emerald-300" />
                                      Admin (Protected • Not Editable)
                                    </>
                                  ) : (
                                    <>
                                      <ShieldAlert className="w-3 h-3 text-emerald-300" />
                                      Admin (Super-Account)
                                    </>
                                  )}
                                </span>
                              )}
                              {!isMemberManagementView && isAdministratorUser && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-900 border border-purple-300">
                                  <ShieldCheck className="w-3 h-3 text-purple-700" />
                                  Administrator
                                </span>
                              )}
                              {isHead && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                                  <Star className="w-3 h-3 text-amber-600 fill-amber-500" />
                                  Head of Listeners
                                </span>
                              )}
                              {!isHead && isListener && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#E4EFE8] text-[#1E3F2F] border border-[#CCE0D3]">
                                  <Sparkles className="w-3 h-3 text-emerald-600" />
                                  Listener Team
                                </span>
                              )}
                              {isFacilitator && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA]">
                                  <ShieldCheck className="w-3 h-3 text-orange-600" />
                                  Expert Facilitator
                                </span>
                              )}
                              {isWriter && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                                  <PenTool className="w-3 h-3 text-blue-600" />
                                  Writer
                                </span>
                              )}
                              {!isSuperAccount && (!isAdministratorUser || isMemberManagementView) && !isListener && !isFacilitator && !isWriter && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#EFECE5] text-[#55645B]">
                                  Regular Member
                                </span>
                              )}
                            </div>

                            {/* Designation as Head for Listeners */}
                            {isListener && !isSuperAccount && (
                              <button
                                id={`toggle-head-${user.id}`}
                                onClick={() => handleToggleHead(user.id, isHead, user.name)}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer border mt-0.5 ${
                                  isHead 
                                    ? 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A] hover:bg-[#FDE68A]' 
                                    : 'bg-[#F2EFE8] text-[#6A7B71] border-[#DDD7CC] hover:bg-[#EAE5DB]'
                                }`}
                                title={isHead ? 'Click to remove Head of Listeners flag' : 'Click to designate as Head of Listeners'}
                              >
                                <Star className={`w-3.5 h-3.5 ${isHead ? 'text-amber-600 fill-amber-500' : 'text-[#85968C]'}`} />
                                <span>{isHead ? 'Head of Listeners' : 'Set as Head'}</span>
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 4. Edit Role Column */}
                        <td className="py-4 px-4 lg:px-6">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isSuperAccount ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-[#6E7F75] font-medium bg-[#F1EDE5] px-2.5 py-1 rounded-xl border border-[#DED7CA]">
                                <Lock className="w-3 h-3 text-[#5A6D61]" />
                                Protected
                              </span>
                            ) : isCurrentAdminRow ? (
                              <span className="text-[11px] text-[#86978E] italic font-medium">Your Account</span>
                            ) : (
                              <>
                                {/* Unified Assign Role Button */}
                                <button
                                  id={`assign-role-btn-${user.id}`}
                                  onClick={() => handleOpenGrantModal(user)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                                    isListener || isFacilitator || isWriter || (!isMemberManagementView && isAdministratorUser)
                                      ? 'bg-white border border-[#CFE1D6] text-[#244534] hover:bg-[#EBF2EE]'
                                      : 'bg-[#284939] hover:bg-[#1E372B] text-white'
                                  }`}
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                  <span>{isListener || isFacilitator || isWriter || (!isMemberManagementView && isAdministratorUser) ? 'Change Role' : 'Assign Role'}</span>
                                </button>

                                {(isListener || isFacilitator || isWriter || (!isMemberManagementView && isAdministratorUser && isSuperAdminUser)) && (
                                  <button
                                    id={`revoke-badge-btn-${user.id}`}
                                    onClick={() => setRevokeUserTarget(user)}
                                    className="text-xs text-[#9E4D3B] hover:bg-[#FAECE8] px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-red-200"
                                    title="Revoke role back to regular member"
                                  >
                                    Revoke
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>

                        {/* 5. Preview As Column (visible only to Admin) */}
                        {isSuperAdminUser && (
                          <td className="py-4 px-4 lg:px-6 text-right">
                            {onSwitchUser && !isCurrentAdminRow && !isSuperAccount ? (
                              <button
                                id={`switch-user-btn-${user.id}`}
                                onClick={() => onSwitchUser(user)}
                                className="inline-flex items-center gap-1 text-xs text-[#2A4B3A] font-semibold bg-[#EBF2EE] hover:bg-[#DDE9E2] border border-[#CFDFD5] px-2.5 py-1.5 rounded-xl transition-all shadow-2xs cursor-pointer"
                                title="Experience app logged in as this user"
                              >
                                <span>Preview as</span>
                              </button>
                            ) : (
                              <span className="text-[#96A79E] italic text-[11px]">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      )}
      </main>
      </Navbar>

      {/* MODAL 1: Unified Role Assignment Modal */}
      {grantModalUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[min(92vh,800px)] flex flex-col border border-[#E3DDD1] shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
            {/* Fixed Header */}
            <div className="flex items-center justify-between p-5 sm:p-6 pb-3.5 border-b border-[#F0ECE3] shrink-0 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#E8F1EC] text-[#244534] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#1F362C] font-['Lora',serif]">
                    Assign Role &amp; Permissions
                  </h3>
                  <p className="text-xs text-[#6B7C72]">Unified role management for {grantModalUser.name}</p>
                </div>
              </div>
              <button
                onClick={() => setGrantModalUser(null)}
                className="text-[#788A80] hover:text-[#21352A] p-2 rounded-xl transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
              {/* Recipient summary */}
              <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#ECE5DB] flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] text-[#7B8B82] uppercase tracking-wider font-semibold">Designating Member</div>
                  <div className="font-bold text-sm text-[#1E3328] mt-0.5">{grantModalUser.name}</div>
                  <div className="text-xs text-[#64756B]">{grantModalUser.email}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-[#7B8B82] uppercase font-semibold">Current Status</div>
                  <div className="mt-1">
                    {grantModalUser.role === 'administrator' || grantModalUser.is_administrator || grantModalUser.is_founder ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
                        <ShieldCheck className="w-2.5 h-2.5 text-purple-700" />
                        Administrator
                      </span>
                    ) : grantModalUser.is_head_of_listeners ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                        <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                        Head of Listeners
                      </span>
                    ) : grantModalUser.is_listener || grantModalUser.isListener || grantModalUser.role === 'listener' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E4EFE8] text-[#1E3F2F] border border-[#CCE0D3]">
                        <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                        Listener
                      </span>
                    ) : grantModalUser.is_facilitator || grantModalUser.is_host || grantModalUser.role === 'facilitator' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA]">
                        <ShieldCheck className="w-2.5 h-2.5 text-orange-600" />
                        Expert Facilitator
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EFECE5] text-[#55645B]">
                        Regular Member
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Role Selection Options */}
              <div>
                <label className="block text-xs font-bold text-[#2A4335] mb-2.5 uppercase tracking-wide">
                  Choose Target Role:
                </label>
                <div className="space-y-2.5">
                  {/* Option 0: Administrator (Admin Super-Account only) */}
                  <div
                    onClick={() => {
                      if (isSuperAdminUser) {
                        setSelectedTargetRole('administrator');
                        if (!customProfession && !selectedProfession) setSelectedProfession('Platform Administrator');
                      }
                    }}
                    className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                      !isSuperAdminUser
                        ? 'opacity-65 bg-gray-50 border-gray-200 cursor-not-allowed'
                        : selectedTargetRole === 'administrator'
                        ? 'bg-purple-50/80 border-purple-500 ring-2 ring-purple-500/30 shadow-xs cursor-pointer'
                        : 'bg-white border-[#E5DFD5] hover:bg-[#FAF8F5] cursor-pointer'
                    }`}
                  >
                    <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      selectedTargetRole === 'administrator' && isSuperAdminUser
                        ? 'bg-purple-100 text-purple-900'
                        : 'bg-[#F2EFE9] text-[#718278]'
                    }`}>
                      <ShieldCheck className="w-4 h-4 text-purple-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[#1E3428]">Administrator</span>
                          <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-purple-100 text-purple-800">
                            Admin-Granted Role
                          </span>
                        </div>
                        <input
                          type="radio"
                          name="target_role"
                          disabled={!isSuperAdminUser}
                          checked={selectedTargetRole === 'administrator'}
                          onChange={() => {
                            if (isSuperAdminUser) {
                              setSelectedTargetRole('administrator');
                              if (!customProfession && !selectedProfession) setSelectedProfession('Platform Administrator');
                            }
                          }}
                          className="text-purple-600 focus:ring-purple-600 disabled:opacity-40"
                        />
                      </div>
                      <p className="text-[11px] text-[#6D7D74] mt-0.5 leading-relaxed">
                        Full access across The Lounge (write, edit, and delete articles, open/close live sessions, and manage queues) and assigns member roles (Listeners, Heads, Facilitators).
                        {!isSuperAdminUser && (
                          <span className="block text-amber-700 font-semibold mt-1">
                            🔒 Only the Admin super-account ({ADMIN_EMAIL}) can grant or revoke the Administrator role.
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Option 1: Head of Listeners */}
                  <div
                    onClick={() => {
                      setSelectedTargetRole('head_of_listeners');
                      if (!customProfession && !selectedProfession) setSelectedProfession('Clinical Psychologist & Consultant');
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                      selectedTargetRole === 'head_of_listeners'
                        ? 'bg-[#FEF3C7]/40 border-amber-400 ring-2 ring-amber-400/40 shadow-xs'
                        : 'bg-white border-[#E5DFD5] hover:bg-[#FAF8F5]'
                    }`}
                  >
                    <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      selectedTargetRole === 'head_of_listeners'
                        ? 'bg-[#FEF3C7] text-[#92400E]'
                        : 'bg-[#F2EFE9] text-[#718278]'
                    }`}>
                      <Star className="w-4 h-4 fill-amber-500 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#1E3428]">Head of Listeners</span>
                        <input
                          type="radio"
                          name="target_role"
                          checked={selectedTargetRole === 'head_of_listeners'}
                          onChange={() => setSelectedTargetRole('head_of_listeners')}
                          className="text-[#B45309] focus:ring-[#B45309]"
                        />
                      </div>
                      <p className="text-[11px] text-[#6D7D74] mt-0.5 leading-relaxed">
                        Supervisory listener role with access to oversee discussion queues, unassigned threads, and guide the listeners team. Generates a one-time access key code.
                      </p>
                    </div>
                  </div>

                  {/* Option 2: Listener */}
                  <div
                    onClick={() => {
                      setSelectedTargetRole('listener');
                      if (!customProfession && !selectedProfession) setSelectedProfession('Psychologist');
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                      selectedTargetRole === 'listener'
                        ? 'bg-emerald-50/60 border-emerald-500 ring-2 ring-emerald-500/30 shadow-xs'
                        : 'bg-white border-[#E5DFD5] hover:bg-[#FAF8F5]'
                    }`}
                  >
                    <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      selectedTargetRole === 'listener'
                        ? 'bg-[#E4EFE8] text-[#1E3F2F]'
                        : 'bg-[#F2EFE9] text-[#718278]'
                    }`}>
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#1E3428]">Listener</span>
                        <input
                          type="radio"
                          name="target_role"
                          checked={selectedTargetRole === 'listener'}
                          onChange={() => setSelectedTargetRole('listener')}
                          className="text-emerald-600 focus:ring-emerald-600"
                        />
                      </div>
                      <p className="text-[11px] text-[#6D7D74] mt-0.5 leading-relaxed">
                        Certified listener badge for providing empathetic 1-on-1 private discussion support. Generates a personal one-time access key code.
                      </p>
                    </div>
                  </div>

                  {/* Option 3: Expert Facilitator */}
                  <div
                    onClick={() => {
                      setSelectedTargetRole('facilitator');
                      if (!customProfession) setSelectedProfession('Expert Facilitator');
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                      selectedTargetRole === 'facilitator'
                        ? 'bg-orange-50/60 border-orange-400 ring-2 ring-orange-400/30 shadow-xs'
                        : 'bg-white border-[#E5DFD5] hover:bg-[#FAF8F5]'
                    }`}
                  >
                    <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      selectedTargetRole === 'facilitator'
                        ? 'bg-[#FFF7ED] text-[#C2410C]'
                        : 'bg-[#F2EFE9] text-[#718278]'
                    }`}>
                      <ShieldCheck className="w-4 h-4 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#1E3428]">Expert Facilitator</span>
                        <input
                          type="radio"
                          name="target_role"
                          checked={selectedTargetRole === 'facilitator'}
                          onChange={() => setSelectedTargetRole('facilitator')}
                          className="text-orange-600 focus:ring-orange-600"
                        />
                      </div>
                      <p className="text-[11px] text-[#6D7D74] mt-0.5 leading-relaxed">
                        Full access inside <strong>The Lounge</strong>: write, edit, and delete articles, host live audio/chat circles, open/close sessions, and manage speaker queues.
                      </p>
                    </div>
                  </div>

                  {/* Option 4: Writer */}
                  <div
                    onClick={() => {
                      setSelectedTargetRole('writer');
                      if (!customProfession && !selectedProfession) setSelectedProfession('Psychologist');
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                      selectedTargetRole === 'writer'
                        ? 'bg-blue-50/60 border-blue-500 ring-2 ring-blue-500/30 shadow-xs'
                        : 'bg-white border-[#E5DFD5] hover:bg-[#FAF8F5]'
                    }`}
                  >
                    <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      selectedTargetRole === 'writer'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-[#F2EFE9] text-[#718278]'
                    }`}>
                      <PenTool className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#1E3428]">Writer</span>
                        <input
                          type="radio"
                          name="target_role"
                          checked={selectedTargetRole === 'writer'}
                          onChange={() => setSelectedTargetRole('writer')}
                          className="text-blue-600 focus:ring-blue-600"
                        />
                      </div>
                      <p className="text-[11px] text-[#6D7D74] mt-0.5 leading-relaxed">
                        Author articles for <strong>Teen Space</strong> with custom title, written content, and cover imagery. Can delete and hide Teen Space articles.
                      </p>
                    </div>
                  </div>

                  {/* Option 5: Regular Member (if elevated) */}
                  {(grantModalUser.is_listener || grantModalUser.isListener || grantModalUser.role === 'listener' || grantModalUser.is_facilitator || grantModalUser.is_host || grantModalUser.role === 'facilitator' || grantModalUser.is_head_of_listeners || grantModalUser.role === 'administrator' || grantModalUser.is_administrator || grantModalUser.is_founder || grantModalUser.is_writer || grantModalUser.role === 'writer') && (
                    <div
                      onClick={() => {
                        if (grantModalUser.role === 'administrator' || grantModalUser.is_administrator) {
                          if (!isSuperAdminUser) return;
                        }
                        setSelectedTargetRole('member');
                      }}
                      className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                        (grantModalUser.role === 'administrator' || grantModalUser.is_administrator) && !isSuperAdminUser
                          ? 'opacity-65 bg-gray-50 border-gray-200 cursor-not-allowed'
                          : selectedTargetRole === 'member'
                          ? 'bg-red-50/60 border-red-400 ring-2 ring-red-400/30 shadow-xs cursor-pointer'
                          : 'bg-white border-[#E5DFD5] hover:bg-[#FAF8F5] cursor-pointer'
                      }`}
                    >
                      <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        selectedTargetRole === 'member'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-[#F2EFE9] text-[#718278]'
                      }`}>
                        <User className="w-4 h-4 text-[#718278]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#1E3428]">Regular Member</span>
                          <input
                            type="radio"
                            name="target_role"
                            disabled={(grantModalUser.role === 'administrator' || grantModalUser.is_administrator) && !isSuperAdminUser}
                            checked={selectedTargetRole === 'member'}
                            onChange={() => {
                              if (grantModalUser.role === 'administrator' || grantModalUser.is_administrator) {
                                if (!isSuperAdminUser) return;
                              }
                              setSelectedTargetRole('member');
                            }}
                            className="text-red-600 focus:ring-red-600"
                          />
                        </div>
                        <p className="text-[11px] text-[#6D7D74] mt-0.5 leading-relaxed">
                          Revert elevated roles and permissions. Returns the account to a standard community member.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Dynamic Inputs Based on Selected Role */}
              {selectedTargetRole !== 'member' ? (
                <>
                  {/* Profession Label Setting */}
                  <div>
                    <label className="block text-xs font-semibold text-[#32493C] mb-2">
                      {selectedTargetRole === 'administrator'
                        ? 'Administrator Title / Designation:'
                        : selectedTargetRole === 'facilitator'
                        ? 'Facilitator Title / Specialty:'
                        : 'Profession Label:'}
                    </label>

                    <div>
                      <input
                        type="text"
                        value={customProfession}
                        onChange={(e) => {
                          setCustomProfession(e.target.value);
                          if (e.target.value) setSelectedProfession('');
                        }}
                        placeholder={
                          selectedTargetRole === 'administrator'
                            ? 'Enter administrator title (e.g. Platform Administrator)...'
                            : selectedTargetRole === 'facilitator'
                            ? 'Enter title (e.g. Lead Facilitator & Clinical Psychologist)...'
                            : 'Enter profession (e.g. Clinical Psychologist)...'
                        }
                        className="w-full px-3.5 py-2.5 text-xs bg-white rounded-xl border border-[#D9D3C7] focus:outline-none focus:ring-2 focus:ring-[#315243] text-[#24352B]"
                      />
                    </div>
                    <p className="text-[11px] text-[#7A8B81] mt-1.5">
                      {selectedTargetRole === 'administrator'
                        ? 'This title is displayed with the Administrator badge across the platform.'
                        : selectedTargetRole === 'facilitator'
                        ? 'This title is displayed with the Facilitator badge across Lounge circles and discussions.'
                        : 'This professional label will be displayed alongside this listener in discussions.'}
                    </p>
                  </div>

                  {/* Gender Selection */}
                  <div>
                    <label className="block text-xs font-semibold text-[#32493C] mb-2">
                      Gender Icon:
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        id="grant-gender-male-btn"
                        onClick={() => setGrantGender('Male')}
                        className={`flex items-center justify-center gap-2.5 py-2.5 px-3.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          grantGender === 'Male'
                            ? 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-400/30 shadow-xs'
                            : 'bg-white border-[#D9D3C7] text-[#55695E] hover:bg-[#F6F4EE]'
                        }`}
                      >
                        <span className="text-lg">👨</span>
                        <span>Male</span>
                      </button>
                      <button
                        type="button"
                        id="grant-gender-female-btn"
                        onClick={() => setGrantGender('Female')}
                        className={`flex items-center justify-center gap-2.5 py-2.5 px-3.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          grantGender === 'Female'
                            ? 'bg-pink-50 border-pink-400 text-pink-800 ring-2 ring-pink-400/30 shadow-xs'
                            : 'bg-white border-[#D9D3C7] text-[#55695E] hover:bg-[#F6F4EE]'
                        }`}
                      >
                        <span className="text-lg">👩</span>
                        <span>Female</span>
                      </button>
                    </div>
                  </div>

                  {/* Explanatory note */}
                  <div className="text-[11px] text-[#56685E] bg-[#F1EFE9] p-3.5 rounded-2xl leading-relaxed">
                    {selectedTargetRole === 'administrator' ? (
                      <div>
                        <strong>Administrator Privileges:</strong> Anyone assigned <strong>Administrator</strong> gains full access across The Lounge (writing, editing, and deleting articles, opening/closing live sessions, and managing speaker queues) and can assign Listener, Head of Listeners, Expert Facilitator, and Writer roles to members. Administrators cannot grant or revoke the Administrator role itself.
                      </div>
                    ) : selectedTargetRole === 'facilitator' ? (
                      <div>
                        <strong>Lounge Privileges:</strong> Anyone assigned <strong>Expert Facilitator</strong> gains full access to everything administrators can do inside The Lounge specifically (writing/editing/deleting articles, opening/closing live sessions, and managing the queue) — but does NOT gain admin or role management capabilities outside of The Lounge.
                      </div>
                    ) : selectedTargetRole === 'writer' ? (
                      <div>
                        <strong>Teen Space Author Privileges:</strong> Anyone assigned <strong>Writer</strong> can author and publish articles in Teen Space with custom imagery, title, and body text, and can delete and hide Teen Space articles.
                      </div>
                    ) : (
                      <div>
                        <strong>One-time key notice:</strong> A secure personal one-time access key code will be automatically generated upon clicking confirm, and presented to you immediately on screen.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
                  <strong>Notice:</strong> This action will revoke all elevated badges and permissions for <strong>{grantModalUser.name}</strong>.
                </div>
              )}
            </div>

            {/* Fixed Footer with Action Buttons */}
            <div className="flex items-center justify-end gap-3 p-4 sm:p-5 border-t border-[#F0ECE3] bg-[#FAF8F5] shrink-0">
              <button
                type="button"
                onClick={() => setGrantModalUser(null)}
                className="px-4 py-2.5 rounded-xl border border-[#D7D1C5] text-xs font-semibold text-[#5A6C62] hover:bg-[#F2EFE8] cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-grant-badge-btn"
                type="button"
                onClick={handleConfirmGrantBadge}
                className="px-5 py-2.5 rounded-xl bg-[#284939] hover:bg-[#1E372B] text-white text-xs font-semibold transition-all cursor-pointer shadow-xs"
              >
                {selectedTargetRole === 'member'
                  ? 'Revert to Regular Member'
                  : selectedTargetRole === 'administrator'
                  ? 'Assign Administrator Role'
                  : selectedTargetRole === 'facilitator'
                  ? 'Assign Expert Facilitator Role'
                  : 'Assign Role & Generate Key'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: One-Time Access Key Display (SHOWN ONLY ONCE) */}
      {oneTimeCodeInfo && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[min(90vh,700px)] flex flex-col border-2 border-[#D97706] shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
            {/* Fixed Header */}
            <div className="flex items-center gap-3 p-5 sm:p-6 pb-3.5 border-b border-[#F5EFE6] shrink-0 bg-white">
              <div className="w-11 h-11 rounded-2xl bg-[#FEF3C7] border border-[#FDE68A] text-[#B45309] flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-[#B45309]">
                  Shown Only Once • Non-Retrievable
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-[#1F362C] font-['Lora',serif]">
                  One-Time Listener Access Key
                </h3>
              </div>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
              <p className="text-xs text-[#5D6F64] leading-relaxed flex items-center gap-1.5 flex-wrap">
                <span>The listener badge was granted to <strong>{oneTimeCodeInfo.userName}</strong> ({oneTimeCodeInfo.userEmail}) as <strong>{oneTimeCodeInfo.profession}</strong></span>
                {oneTimeCodeInfo.gender && <ListenerGenderIcon gender={oneTimeCodeInfo.gender} />}
                <span>. Below is their unique one-time access key.</span>
              </p>

              {/* High-visibility key display box */}
              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E0D8CA]">
                <div className="text-[11px] font-semibold text-[#76877D] mb-1">
                  ONE-TIME LISTENER ACCESS CODE:
                </div>
                <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#D5CEC0]">
                  <span className="font-mono text-base sm:text-lg font-bold text-[#1E372B] tracking-wider select-all">
                    {oneTimeCodeInfo.key}
                  </span>
                  <button
                    id="copy-onetime-key-btn"
                    onClick={handleCopyOneTimeKey}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      hasCopiedCode 
                        ? 'bg-[#E4EFE8] text-[#1E3F2F] border border-[#CCE0D3]' 
                        : 'bg-[#284939] text-white hover:bg-[#1E372B]'
                    }`}
                  >
                    {hasCopiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Key</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Security Warning */}
              <div className="p-3.5 rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#78350F] leading-relaxed">
                <strong className="text-[#92400E]">Important Security Policy:</strong> This key is displayed <strong>strictly once</strong> at this moment. It cannot be retrieved again from the system interface after you close this modal. Please copy and record it or transmit it to the listener now.
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="p-4 sm:p-5 border-t border-[#F5EFE6] bg-[#FAF8F5] shrink-0">
              <button
                id="dismiss-onetime-modal-btn"
                onClick={() => {
                  setOneTimeCodeInfo(null);
                  setHasCopiedCode(false);
                }}
                className="w-full py-3 px-4 rounded-xl bg-[#284939] hover:bg-[#1E372B] text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer text-center shadow-xs"
              >
                I Have Recorded This Code / Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Edit Profession Modal */}
      {editProfessionUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[min(90vh,600px)] flex flex-col border border-[#E3DDD1] shadow-xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
            {/* Fixed Header */}
            <div className="flex items-center justify-between p-5 pb-3.5 border-b border-[#F0ECE3] shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-[#E8F1EC] text-[#244534] flex items-center justify-center">
                  <Briefcase className="w-4 h-4 text-[#2C523D]" />
                </div>
                <h3 className="text-base font-bold text-[#1F362C] font-['Lora',serif]">
                  {editProfessionUser.role === 'administrator' || editProfessionUser.is_administrator
                    ? 'Edit Administrator Profile'
                    : 'Edit Listener Profile'}
                </h3>
              </div>
              <button
                onClick={() => setEditProfessionUser(null)}
                className="text-[#788A80] hover:text-[#21352A] p-1.5 rounded-lg cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <p className="text-xs text-[#63756A]">
                Update the professional credentials and gender for <strong>{editProfessionUser.name}</strong>:
              </p>

              {/* Profession Setting */}
              <div>
                <label className="block text-xs font-semibold text-[#32493C] mb-1.5">
                  Profession / Title Label:
                </label>

                <input
                  type="text"
                  value={editedProfessionValue}
                  onChange={(e) => setEditedProfessionValue(e.target.value)}
                  placeholder="e.g. Platform Administrator or Psychologist..."
                  className="w-full px-3.5 py-2 text-xs bg-white rounded-xl border border-[#D9D3C7] focus:outline-none focus:ring-2 focus:ring-[#315243] text-[#24352B]"
                />
              </div>

              {/* Gender Setting */}
              <div>
                <label className="block text-xs font-semibold text-[#32493C] mb-1.5">
                  Gender:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    id="edit-gender-male-btn"
                    onClick={() => setEditedGenderValue('Male')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      editedGenderValue === 'Male'
                        ? 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-400/30 shadow-xs'
                        : 'bg-white border-[#D9D3C7] text-[#55695E] hover:bg-[#F6F4EE]'
                    }`}
                  >
                    <span className="text-base">👨</span>
                    <span>Male</span>
                  </button>
                  <button
                    type="button"
                    id="edit-gender-female-btn"
                    onClick={() => setEditedGenderValue('Female')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      editedGenderValue === 'Female'
                        ? 'bg-pink-50 border-pink-400 text-pink-800 ring-2 ring-pink-400/30 shadow-xs'
                        : 'bg-white border-[#D9D3C7] text-[#55695E] hover:bg-[#F6F4EE]'
                    }`}
                  >
                    <span className="text-base">👩</span>
                    <span>Female</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-[#F0ECE3] bg-[#FAF8F5] shrink-0">
              <button
                type="button"
                onClick={() => setEditProfessionUser(null)}
                className="px-3.5 py-2 rounded-xl border border-[#D7D1C5] text-xs font-semibold text-[#5A6C62] hover:bg-[#F2EFE8] cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="save-edited-profession-btn"
                type="button"
                onClick={handleSaveProfession}
                className="px-4 py-2 rounded-xl bg-[#284939] hover:bg-[#1E372B] text-white text-xs font-semibold cursor-pointer shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Revoke Confirmation */}
      {revokeUserTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
          <div className="bg-white rounded-3xl w-full max-w-sm max-h-[min(90vh,450px)] flex flex-col border border-[#E3DDD1] shadow-xl overflow-hidden text-center">
            {/* Scrollable Content Body */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="w-12 h-12 rounded-2xl bg-[#FDF0EC] text-[#B65E46] flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#1F362C]">
                Revoke Elevated Role?
              </h3>
              <p className="text-xs text-[#6B7C72] mt-1.5 leading-relaxed">
                Are you sure you want to remove the elevated role ({revokeUserTarget.role === 'administrator' || revokeUserTarget.is_administrator ? 'Administrator' : 'Listener, Head of Listeners, Expert Facilitator, or Writer'}) from <strong>{revokeUserTarget.name}</strong>? They will revert to a regular community member.
              </p>
            </div>

            {/* Fixed Footer */}
            <div className="flex items-center justify-center gap-2.5 p-4 border-t border-[#F0ECE3] bg-[#FAF8F5] shrink-0">
              <button
                onClick={() => setRevokeUserTarget(null)}
                className="px-4 py-2 rounded-xl border border-[#D7D1C5] text-xs font-semibold text-[#5A6C62] hover:bg-[#F2EFE8] cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-revoke-btn"
                onClick={handleConfirmRevoke}
                className="px-4 py-2 rounded-xl bg-[#B65E46] hover:bg-[#9B4B36] text-white text-xs font-semibold cursor-pointer"
              >
                Yes, Revoke Role
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
