import { useState, useMemo } from 'react';
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
  LogOut, 
  LifeBuoy, 
  UserPlus, 
  AlertCircle,
  X,
  Edit3,
  RotateCcw
} from 'lucide-react';
import { UserAccount, Gender } from '../types';
import { 
  getStoredUsers, 
  grantListenerBadge, 
  updateListenerProfession, 
  toggleHeadOfListeners, 
  revokeListenerBadge,
  StoredUser 
} from '../utils/userManagement';
import { ListenerGenderIcon } from './ListenerGenderDisplay';

interface AdminRoleManagementProps {
  currentUser: UserAccount;
  onNavigateHome: () => void;
  onNavigateDashboard: () => void;
  onNavigateDiscussions?: () => void;
  onSignOut: () => void;
  onOpenEmergencyModal: () => void;
  onSwitchUser?: (user: UserAccount) => void;
}

const PRESET_PROFESSIONS = [
  'Psychologist',
  'Professor in Psychology',
  'Psychology Student',
  'Clinical Psychiatrist',
  'Mental Health Counselor',
  'Social & Community Worker',
];

export const AdminRoleManagement = ({
  currentUser,
  onNavigateHome,
  onNavigateDashboard,
  onNavigateDiscussions,
  onSignOut,
  onOpenEmergencyModal,
  onSwitchUser,
}: AdminRoleManagementProps) => {
  const [users, setUsers] = useState<StoredUser[]>(() => getStoredUsers());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'listeners' | 'members' | 'heads'>('all');

  // Modal states
  const [grantModalUser, setGrantModalUser] = useState<StoredUser | null>(null);
  const [selectedProfession, setSelectedProfession] = useState('Psychologist');
  const [customProfession, setCustomProfession] = useState('');
  const [grantGender, setGrantGender] = useState<Gender>('Male');
  const [grantIsHead, setGrantIsHead] = useState(false);

  // One-time code modal state (shown strictly once after granting)
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

      const isListener = user.is_listener || user.isListener || user.role === 'listener';
      const isHead = Boolean(user.is_head_of_listeners);

      if (activeFilter === 'listeners') {
        return isListener;
      }
      if (activeFilter === 'members') {
        return !isListener && user.role !== 'admin';
      }
      if (activeFilter === 'heads') {
        return isHead;
      }
      return true;
    });
  }, [users, searchQuery, activeFilter]);

  // Handle open grant badge modal
  const handleOpenGrantModal = (user: StoredUser) => {
    setGrantModalUser(user);
    setSelectedProfession('Psychologist');
    setCustomProfession('');
    setGrantGender(user.gender || 'Male');
    setGrantIsHead(false);
  };

  // Confirm badge grant
  const handleConfirmGrantBadge = () => {
    if (!grantModalUser) return;

    const finalProfession = customProfession.trim() || selectedProfession || 'Psychology Support Specialist';

    try {
      const result = grantListenerBadge(grantModalUser.id, finalProfession, grantIsHead, grantGender);
      refreshUsersList();
      setGrantModalUser(null);

      // Present the one-time access key to the admin immediately
      setOneTimeCodeInfo({
        key: result.oneTimeKey,
        userName: result.updatedUser.name,
        userEmail: result.updatedUser.email,
        profession: result.updatedUser.profession || finalProfession,
        gender: result.updatedUser.gender || grantGender,
        isHead: Boolean(result.updatedUser.is_head_of_listeners),
      });
      setHasCopiedCode(false);
      showToast(`Granted Listener badge to ${result.updatedUser.name}!`);
    } catch (err) {
      console.error(err);
      showToast('Error granting listener badge.');
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
    setEditedProfessionValue(user.profession || 'Psychologist');
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
      showToast('Failed to update listener profile.');
    }
  };

  // Confirm revoke badge
  const handleConfirmRevoke = () => {
    if (!revokeUserTarget) return;
    try {
      revokeListenerBadge(revokeUserTarget.id);
      refreshUsersList();
      showToast(`Revoked listener badge from ${revokeUserTarget.name}`);
      setRevokeUserTarget(null);
    } catch (err) {
      console.error(err);
      showToast('Failed to revoke listener badge.');
    }
  };

  // Count stats
  const totalUsersCount = users.length;
  const listenersCount = users.filter(u => u.is_listener || u.isListener || u.role === 'listener').length;
  const headsCount = users.filter(u => u.is_head_of_listeners).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#2C332E]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1E372C] text-white px-5 py-3 rounded-2xl shadow-lg flex items-center gap-3 border border-[#315745] text-sm animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-[#E9E4DC]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={onNavigateHome}
              className="flex items-center gap-2 cursor-pointer group text-left"
            >
              <div className="w-10 h-10 rounded-2xl bg-[#315243] text-white flex items-center justify-center shadow-xs">
                <Heart className="w-5 h-5 text-emerald-200 fill-emerald-200/20" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold tracking-tight text-[#1F362C] font-['Lora',serif]">
                    3awdli
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#E5EEE9] text-[#2F5342] font-semibold border border-[#D0E0D7]">
                    Admin Portal
                  </span>
                </div>
                <p className="text-[11px] text-[#627068] hidden sm:block">
                  Role & Listener Badge Management
                </p>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              id="emergency-btn-admin"
              onClick={onOpenEmergencyModal}
              className="hidden md:flex items-center gap-1.5 text-xs text-[#7A5043] hover:text-[#5E3B30] hover:bg-[#F8EFEB] px-3 py-2 rounded-xl transition-colors cursor-pointer"
            >
              <LifeBuoy className="w-3.5 h-3.5 text-[#B65E46]" />
              <span>Emergency Help</span>
            </button>

            {onNavigateDiscussions && (
              <button
                id="discussions-nav-btn-from-admin"
                onClick={onNavigateDiscussions}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#274635] bg-[#E8F1EC] hover:bg-[#DAE8DF] border border-[#CCDED3] px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#2E543F]" />
                <span>Discussions</span>
              </button>
            )}

            <button
              id="nav-myspace-admin-btn"
              onClick={onNavigateDashboard}
              className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#224131] bg-[#F1EFE9] hover:bg-[#E7E3DA] border border-[#DDD7CC] px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
            >
              <User className="w-4 h-4 text-[#315243]" />
              <span>My Space</span>
            </button>

            <button
              id="admin-signout-btn"
              onClick={onSignOut}
              className="text-xs text-[#738279] hover:text-[#2C332E] hover:bg-[#EFECE5] p-2 rounded-xl transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
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
              System Admin: {currentUser.name}
            </span>
          </div>
        </div>

        {/* Hero Title & Stats Banner */}
        <div className="bg-white rounded-3xl border border-[#E8E2D7] p-6 sm:p-8 shadow-xs mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#E5EEE9] text-[#284B38] text-xs font-semibold border border-[#CFE1D6]">
                  Admin Workspace
                </span>
                <span className="text-xs text-[#7C8D83]">Primary Account Authority</span>
              </div>
              <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-[#1F362C] font-['Lora',serif]">
                Listeners Team & Role Management
              </h1>
              <p className="mt-2 text-sm text-[#617369] max-w-2xl leading-relaxed">
                Browse registered accounts, grant verified <strong>Listener Badges</strong>, designate supervisory <strong>Head of Listeners</strong>, and automatically issue secure one-time access keys.
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 shrink-0">
              <div className="p-3 sm:p-4 rounded-2xl bg-[#FAF8F5] border border-[#EAE4D9] text-center min-w-[90px]">
                <div className="text-2xl font-bold text-[#1F362C] font-['Lora',serif]">{totalUsersCount}</div>
                <div className="text-[11px] font-medium text-[#7C8D83] mt-0.5">Total Accounts</div>
              </div>
              <div className="p-3 sm:p-4 rounded-2xl bg-[#E8F1EC] border border-[#CCE0D4] text-center min-w-[90px]">
                <div className="text-2xl font-bold text-[#234533] font-['Lora',serif]">{listenersCount}</div>
                <div className="text-[11px] font-semibold text-[#2C523D] mt-0.5">Listeners Team</div>
              </div>
              <div className="p-3 sm:p-4 rounded-2xl bg-[#FEF3C7] border border-[#FDE68A] text-center min-w-[90px]">
                <div className="text-2xl font-bold text-[#92400E] font-['Lora',serif]">{headsCount}</div>
                <div className="text-[11px] font-semibold text-[#B45309] mt-0.5">Head of Listeners</div>
              </div>
            </div>
          </div>
        </div>

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
              All Users ({totalUsersCount})
            </button>
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
              Head of Listeners ({headsCount})
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
              Regular Members ({totalUsersCount - listenersCount})
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
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EAE4D9] bg-[#FAF8F5] text-[11px] font-semibold text-[#5B6D62] uppercase tracking-wider">
                    <th className="py-3.5 px-6">User Account</th>
                    <th className="py-3.5 px-6">Role & Badge</th>
                    <th className="py-3.5 px-6">Profession Label</th>
                    <th className="py-3.5 px-6">Head of Listeners</th>
                    <th className="py-3.5 px-6 text-right">Management Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EBE1] text-xs">
                  {filteredUsers.map((user) => {
                    const isListener = Boolean(user.is_listener || user.isListener || user.role === 'listener');
                    const isHead = Boolean(user.is_head_of_listeners);
                    const isAdmin = user.role === 'admin';
                    const isCurrentAdminRow = user.id === currentUser.id;

                    return (
                      <tr 
                        key={user.id} 
                        className={`hover:bg-[#FAF8F5]/80 transition-colors ${
                          isListener ? 'bg-emerald-50/20' : ''
                        }`}
                      >
                        {/* User Account Info */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                              isAdmin 
                                ? 'bg-[#284939] text-white' 
                                : isListener 
                                ? 'bg-[#E0EDE5] text-[#224433] border border-[#CCDED3]' 
                                : 'bg-[#EFECE6] text-[#4F5E56]'
                            }`}>
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-sm text-[#1F3328] flex items-center gap-1.5">
                                <span>{user.name}</span>
                                {isCurrentAdminRow && (
                                  <span className="text-[10px] px-1.5 py-0.2 bg-[#E2ECE6] text-[#254534] rounded font-mono">You</span>
                                )}
                              </div>
                              <div className="text-[#6D7F75] text-[11px]">{user.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Role & Badge */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isAdmin && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#254233] text-white">
                                Admin
                              </span>
                            )}
                            {isListener ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#E4EFE8] text-[#1E3F2F] border border-[#CCE0D3]">
                                <Sparkles className="w-3 h-3 text-emerald-600" />
                                Listener Team
                              </span>
                            ) : !isAdmin && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#EFECE5] text-[#55645B]">
                                Regular Member
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Profession & Gender Label */}
                        <td className="py-4 px-6">
                          {isListener ? (
                            <div className="flex items-center gap-2">
                              <div className="inline-flex items-center gap-2 font-medium text-[#254233] bg-[#F1F6F3] px-2.5 py-1 rounded-lg border border-[#D9E6DE]">
                                <span>{user.profession || 'Psychologist'}</span>
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

                        {/* Head of Listeners Status */}
                        <td className="py-4 px-6">
                          {isListener ? (
                            <div className="flex items-center gap-2">
                              <button
                                id={`toggle-head-${user.id}`}
                                onClick={() => handleToggleHead(user.id, isHead, user.name)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                                  isHead 
                                    ? 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A] hover:bg-[#FDE68A]' 
                                    : 'bg-[#F2EFE8] text-[#6A7B71] border-[#DDD7CC] hover:bg-[#EAE5DB]'
                                }`}
                                title={isHead ? 'Click to remove Head of Listeners flag' : 'Click to designate as Head of Listeners'}
                              >
                                <Star className={`w-3.5 h-3.5 ${isHead ? 'text-amber-600 fill-amber-500' : 'text-[#85968C]'}`} />
                                <span>{isHead ? 'Head of Listeners' : 'Designate Head'}</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[#96A79E] italic text-[11px]">Requires listener badge</span>
                          )}
                        </td>

                        {/* Management Actions */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!isListener ? (
                              <button
                                id={`grant-badge-btn-${user.id}`}
                                onClick={() => handleOpenGrantModal(user)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#284939] hover:bg-[#1E372B] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>Grant Listener Badge</span>
                              </button>
                            ) : (
                              <>
                                <button
                                  id={`edit-prof-btn-${user.id}`}
                                  onClick={() => handleOpenEditProfession(user)}
                                  className="text-xs font-semibold text-[#2D4E3D] hover:bg-[#EBF2EE] px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer border border-[#CFE1D6]"
                                >
                                  Edit Profession
                                </button>
                                {!isAdmin && (
                                  <button
                                    id={`revoke-badge-btn-${user.id}`}
                                    onClick={() => setRevokeUserTarget(user)}
                                    className="text-xs text-[#9E4D3B] hover:bg-[#FAECE8] px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer"
                                  >
                                    Revoke
                                  </button>
                                )}
                              </>
                            )}

                            {onSwitchUser && !isCurrentAdminRow && (
                              <button
                                id={`switch-user-btn-${user.id}`}
                                onClick={() => onSwitchUser(user)}
                                className="text-[11px] text-[#55695E] hover:text-[#1F3328] hover:bg-[#EFEBE3] px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
                                title="Experience app logged in as this user"
                              >
                                Preview as
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* MODAL 1: Grant Listener Badge Modal */}
      {grantModalUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[min(90vh,760px)] flex flex-col border border-[#E3DDD1] shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
            {/* Fixed Header */}
            <div className="flex items-center justify-between p-5 sm:p-6 pb-3.5 border-b border-[#F0ECE3] shrink-0 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#E8F1EC] text-[#244534] flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#1F362C] font-['Lora',serif]">
                    Grant Listener Badge
                  </h3>
                  <p className="text-xs text-[#6B7C72]">Promote member to Listeners Team</p>
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
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {/* Recipient summary */}
              <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#ECE5DB]">
                <div className="text-xs text-[#7B8B82]">Designating Member:</div>
                <div className="font-semibold text-sm text-[#1E3328] mt-0.5">{grantModalUser.name}</div>
                <div className="text-xs text-[#64756B]">{grantModalUser.email}</div>
              </div>

              {/* Profession Label Setting */}
              <div>
                <label className="block text-xs font-semibold text-[#32493C] mb-2">
                  Select or Set Profession Label:
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {PRESET_PROFESSIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setSelectedProfession(p);
                        setCustomProfession('');
                      }}
                      className={`text-xs px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                        selectedProfession === p && !customProfession
                          ? 'bg-[#284939] text-white border-[#284939]'
                          : 'bg-white text-[#4A5D52] border-[#D9D3C7] hover:bg-[#F2EFE9]'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <div>
                  <input
                    type="text"
                    value={customProfession}
                    onChange={(e) => {
                      setCustomProfession(e.target.value);
                      if (e.target.value) setSelectedProfession('');
                    }}
                    placeholder="Or type a custom profession (e.g. Clinical Psychologist)..."
                    className="w-full px-3.5 py-2.5 text-xs bg-white rounded-xl border border-[#D9D3C7] focus:outline-none focus:ring-2 focus:ring-[#315243] text-[#24352B]"
                  />
                </div>
                <p className="text-[11px] text-[#7A8B81] mt-1.5">
                  This professional label will be displayed alongside this listener in discussions.
                </p>
              </div>

              {/* Gender Selection */}
              <div>
                <label className="block text-xs font-semibold text-[#32493C] mb-2">
                  Listener Gender:
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
                <p className="text-[11px] text-[#7A8B81] mt-1.5">
                  Visualized as a blue man icon/emoji for Male, or pink woman icon/emoji for Female.
                </p>
              </div>

              {/* Head of Listeners Option */}
              <div className="p-3.5 rounded-2xl bg-[#FFFBEB] border border-[#FDE68A]">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={grantIsHead}
                    onChange={(e) => setGrantIsHead(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-[#B45309] focus:ring-[#B45309] border-[#D97706]"
                  />
                  <div>
                    <span className="text-xs font-bold text-[#92400E] flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                      Designate as Head of Listeners
                    </span>
                    <p className="text-[11px] text-[#78350F] mt-0.5 leading-relaxed">
                      Grants supervisory permission (<code className="font-mono text-[10px] bg-amber-200/50 px-1 py-0.2 rounded">is_head_of_listeners: true</code>) to oversee all discussions once enabled.
                    </p>
                  </div>
                </label>
              </div>

              {/* Explanatory note */}
              <div className="text-[11px] text-[#697C71] bg-[#F1EFE9] p-3 rounded-xl leading-relaxed">
                <strong>One-time key notice:</strong> A secure one-time access key code will be automatically generated immediately upon clicking confirm, and presented to you once on screen.
              </div>
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
                Grant Badge & Generate Key
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
                  Edit Listener Profile
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
                  Profession Label:
                </label>
                {/* Preset shortcuts */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PRESET_PROFESSIONS.slice(0, 4).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEditedProfessionValue(p)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        editedProfessionValue === p
                          ? 'bg-[#284939] text-white border-[#284939]'
                          : 'bg-white text-[#4A5D52] border-[#D9D3C7] hover:bg-[#F2EFE9]'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={editedProfessionValue}
                  onChange={(e) => setEditedProfessionValue(e.target.value)}
                  placeholder="e.g. Clinical Psychologist..."
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
                Revoke Listener Badge?
              </h3>
              <p className="text-xs text-[#6B7C72] mt-1.5 leading-relaxed">
                Are you sure you want to remove the Listener badge and any Head of Listeners privileges from <strong>{revokeUserTarget.name}</strong>? They will revert to a regular community member.
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
                Yes, Revoke Badge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
