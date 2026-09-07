import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { 
  Heart, 
  ShieldCheck, 
  LifeBuoy, 
  ArrowLeft, 
  User, 
  UserX,
  LogOut, 
  Sparkles, 
  Star, 
  Briefcase, 
  Clock, 
  CheckCircle2, 
  Lock,
  Unlock,
  KeyRound,
  AlertCircle,
  Copy,
  Check,
  Eye,
  MessageSquare,
  ShieldAlert,
  Inbox,
  FolderLock,
  Archive,
  Mail
} from 'lucide-react';
import { UserAccount, DiscussionConversation } from '../types';
import { 
  getStoredDiscussions, 
  openDiscussionWithKey,
  sendListenerMessage,
  closeDiscussion,
  updateListenerAttention,
  getDiscussionById,
  isListenerExcludedFromDiscussion
} from '../utils/discussionManagement';
import { 
  getUserShareNotifications, 
  getUnreadShareNotificationsCount 
} from '../utils/shareManagement';
import { getListenerKeyCode } from '../utils/userManagement';
import { ListenerChatInterface } from './ListenerChatInterface';
import { ListenerGenderIcon } from './ListenerGenderDisplay';
import { GenderPreferenceTag } from './GenderPreferenceTag';
import { ShareRequestsMailbox } from './ShareRequestsMailbox';

interface DiscussionsPageProps {
  user: UserAccount;
  onNavigateHome: () => void;
  onNavigateDashboard: () => void;
  onNavigateAdmin?: () => void;
  onSignOut: () => void;
  onOpenEmergencyModal: () => void;
}

export const DiscussionsPage = ({
  user,
  onNavigateHome,
  onNavigateDashboard,
  onNavigateAdmin,
  onSignOut,
  onOpenEmergencyModal,
}: DiscussionsPageProps) => {
  const isHead = Boolean(user.is_head_of_listeners);
  const isAdmin = user.role === 'admin';

  // State
  const [activeTab, setActiveTab] = useState<'unopened' | 'myConversations' | 'history' | 'allConversations' | 'mailbox'>('unopened');
  const [discussions, setDiscussions] = useState<DiscussionConversation[]>([]);
  const [selectedDiscussion, setSelectedDiscussion] = useState<DiscussionConversation | null>(null);
  const [unreadShareCount, setUnreadShareCount] = useState(() => getUnreadShareNotificationsCount(user.id));

  // Key verification modal state
  const [verifyingDiscussion, setVerifyingDiscussion] = useState<DiscussionConversation | null>(null);
  const [inputKeyCode, setInputKeyCode] = useState('');
  const [keyCodeError, setKeyCodeError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hasCopiedUserKey, setHasCopiedUserKey] = useState(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);

  // Retrieve this listener's personal key code
  const listenerKeyCode = useMemo(() => {
    return getListenerKeyCode(user.id) || user.listener_key_code || '3AW-LISTEN-7X4K-9M2Q';
  }, [user.id, user.listener_key_code]);

  // Load discussions
  const refreshDiscussions = () => {
    const list = getStoredDiscussions();
    setDiscussions(list);
    return list;
  };

  useEffect(() => {
    refreshDiscussions();

    // Listen for discussion updates across tabs and events
    const handleSync = () => {
      const list = getStoredDiscussions();
      setDiscussions(list);
      setSelectedDiscussion((prev) => {
        if (!prev) return null;
        const updated = list.find((d) => d.id === prev.id);
        return updated || prev;
      });
      setUnreadShareCount(getUnreadShareNotificationsCount(user.id));
    };

    window.addEventListener('3awdli_discussion_sync', handleSync);
    window.addEventListener('3awdli_share_request_created', handleSync);
    window.addEventListener('3awdli_share_request_updated', handleSync);
    window.addEventListener('storage', handleSync);
    const interval = setInterval(handleSync, 1000);

    return () => {
      window.removeEventListener('3awdli_discussion_sync', handleSync);
      window.removeEventListener('3awdli_share_request_created', handleSync);
      window.removeEventListener('3awdli_share_request_updated', handleSync);
      window.removeEventListener('storage', handleSync);
      clearInterval(interval);
    };
  }, [user.id]);

  // Filtered lists
  const unopenedList = useMemo(() => {
    return discussions.filter((d) => d.status === 'unopened');
  }, [discussions]);

  const myList = useMemo(() => {
    return discussions.filter((d) => {
      if (d.status !== 'opened') return false;
      // If listener is excluded from this conversation, it has been handed over!
      if (d.excludedListeners?.some((e) => e.listenerId === user.id)) return false;
      return d.openedByListenerId === user.id || d.joinedListenerId === user.id;
    });
  }, [discussions, user.id]);

  // Closed discussions handled by this listener OR conversations handed over where this listener was excluded
  const historyList = useMemo(() => {
    return discussions.filter((d) => {
      // 1. Concluded conversation where listener was opener, closer, joined, or excluded
      if (d.status === 'closed') {
        return (
          d.openedByListenerId === user.id ||
          d.closedByListenerId === user.id ||
          d.joinedListenerId === user.id ||
          d.excludedListeners?.some((e) => e.listenerId === user.id)
        );
      }
      // 2. Active conversation from which this listener was excluded (takeover handover)
      if (d.excludedListeners?.some((e) => e.listenerId === user.id)) {
        return true;
      }
      return false;
    });
  }, [discussions, user.id]);

  const allList = useMemo(() => {
    return discussions;
  }, [discussions]);

  // Handle toast notifications
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // Chat Interface Handlers
  const handleSendMessage = (text: string) => {
    if (!selectedDiscussion) return;
    const res = sendListenerMessage(selectedDiscussion.id, user.id, user.name, text);
    if (res.success) {
      const updatedList = refreshDiscussions();
      const updated = updatedList.find((d) => d.id === selectedDiscussion.id);
      if (updated) setSelectedDiscussion(updated);
    } else if (res.error) {
      showToast(res.error);
    }
  };

  const handleCloseDiscussion = (discussionId: string) => {
    const res = closeDiscussion(discussionId, user.id, user.name);
    if (res.success) {
      showToast('Conversation ended. Moved to Closed / History.');
      const updatedList = refreshDiscussions();
      const updated = updatedList.find((d) => d.id === discussionId);
      if (updated) setSelectedDiscussion(updated);
      setActiveTab('history');
    } else if (res.error) {
      showToast(res.error);
    }
  };

  const handleUpdateAttention = (status: 'reading' | 'typing' | 'idle') => {
    if (!selectedDiscussion) return;
    updateListenerAttention(selectedDiscussion.id, status);
  };

  // Copy listener key
  const handleCopyListenerKey = () => {
    if (listenerKeyCode) {
      navigator.clipboard.writeText(listenerKeyCode);
      setHasCopiedUserKey(true);
      setTimeout(() => setHasCopiedUserKey(false), 2500);
    }
  };

  // Open the key code verification modal for an unopened discussion
  const handleInitiateOpenDiscussion = (discussion: DiscussionConversation) => {
    setVerifyingDiscussion(discussion);
    setInputKeyCode('');
    setKeyCodeError(null);
  };

  // Submit the key code to open a discussion
  const handleSubmitKeyCode = (e: FormEvent) => {
    e.preventDefault();
    if (!verifyingDiscussion) return;

    if (!inputKeyCode.trim()) {
      setKeyCodeError('Please enter your personal one-time listener key code.');
      return;
    }

    const result = openDiscussionWithKey(
      verifyingDiscussion.id,
      user.id,
      user.name,
      inputKeyCode
    );

    if (result.success && result.discussion) {
      setVerifyingDiscussion(null);
      setInputKeyCode('');
      setKeyCodeError(null);
      refreshDiscussions();
      setSelectedDiscussion(result.discussion);
      showToast('Key verified! Conversation claimed and added to your personal list.');
    } else {
      setKeyCodeError(
        result.error ||
          'Invalid Key Code. Access denied. Please enter the personal one-time key code issued when your Listener badge was granted.'
      );
    }
  };

  // View an already opened discussion
  const handleViewDiscussion = (discussion: DiscussionConversation) => {
    // Check ownership rules:
    // Regular listeners can view conversations they personally opened, joined, or were previously involved with before exclusion.
    // Head of Listeners and Admin can view ALL conversations.
    const isOwner = discussion.openedByListenerId === user.id;
    const isJoined = discussion.joinedListenerId === user.id;
    const isExcluded = discussion.excludedListeners?.some((e) => e.listenerId === user.id);
    const canSupervise = isHead || isAdmin;

    if (!isOwner && !isJoined && !isExcluded && !canSupervise) {
      setAccessDeniedMessage(
        `Access Denied: This conversation is confidential and was claimed by ${
          discussion.openedByListenerName || 'another listener'
        }. As a regular listener, you can only view discussions you are assigned to or have past records with.`
      );
      setTimeout(() => setAccessDeniedMessage(null), 5000);
      return;
    }

    setSelectedDiscussion(discussion);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#2C332E]">
      {/* Toast Notification */}
      {toastMessage && (
        <div 
          id="discussion-toast"
          className="fixed top-4 right-4 z-50 bg-[#28493A] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs sm:text-sm animate-in fade-in slide-in-from-top-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Access Denied Banner */}
      {accessDeniedMessage && (
        <div 
          id="access-denied-alert"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-rose-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 text-xs sm:text-sm max-w-lg w-[90%]"
        >
          <ShieldAlert className="w-5 h-5 text-rose-300 shrink-0" />
          <div className="flex-1">
            <div className="font-semibold">Confidentiality Rule Enforced</div>
            <div className="text-[11px] text-rose-200 mt-0.5">{accessDeniedMessage}</div>
          </div>
          <button 
            onClick={() => setAccessDeniedMessage(null)}
            className="text-xs bg-rose-800 hover:bg-rose-700 px-2 py-1 rounded-lg cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Navigation Header */}
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
                    Discussions Workspace
                  </span>
                </div>
                <p className="text-[11px] text-[#627068] hidden sm:block">
                  Confidential Psychological Support Workspace
                </p>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              id="emergency-btn-discussions"
              onClick={onOpenEmergencyModal}
              className="hidden md:flex items-center gap-1.5 text-xs text-[#7A5043] hover:text-[#5E3B30] hover:bg-[#F8EFEB] px-3 py-2 rounded-xl transition-colors cursor-pointer"
            >
              <LifeBuoy className="w-3.5 h-3.5 text-[#B65E46]" />
              <span>Emergency Help</span>
            </button>

            {isAdmin && onNavigateAdmin && (
              <button
                id="admin-console-discussions-btn"
                onClick={onNavigateAdmin}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#6C442A] bg-[#F9EFE6] hover:bg-[#F2E3D4] border border-[#E9D5C3] px-3 py-2 rounded-xl transition-colors cursor-pointer"
              >
                <span>Admin Console</span>
              </button>
            )}

            <button
              id="nav-mailbox-btn"
              onClick={() => {
                setSelectedDiscussion(null);
                setActiveTab('mailbox');
              }}
              className={`relative flex items-center gap-2 text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl border transition-colors cursor-pointer ${
                activeTab === 'mailbox'
                  ? 'bg-[#315243] text-white border-[#254235]'
                  : 'bg-white text-[#2C4537] hover:bg-[#F2ECE3] border-[#E8E2D7]'
              }`}
              title="Incoming consultations & mailbox"
            >
              <Mail className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">Mailbox</span>
              {unreadShareCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold animate-pulse">
                  {unreadShareCount}
                </span>
              )}
            </button>

            <button
              id="nav-myspace-discussions-btn"
              onClick={onNavigateDashboard}
              className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#224131] bg-[#E8F1EC] hover:bg-[#DAE8DF] border border-[#CCDED3] px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
            >
              <User className="w-4 h-4 text-[#315243]" />
              <span>My Space</span>
            </button>

            <button
              id="discussions-signout-btn"
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
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <button
            id="back-to-dashboard-btn"
            onClick={onNavigateDashboard}
            className="inline-flex items-center gap-2 text-sm text-[#5B6D62] hover:text-[#21372C] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to My Personal Space</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E4EFE8] text-[#224634] border border-[#CCE0D3]">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Verified Listener
            </span>
            {isHead && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                <Star className="w-3.5 h-3.5 text-amber-600 fill-amber-500/20" />
                Head of Listeners
              </span>
            )}
          </div>
        </div>

        {/* Listener Profile & Key Banner */}
        <div className="bg-white rounded-3xl border border-[#E8E2D7] p-6 sm:p-7 shadow-xs mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-13 h-13 rounded-2xl bg-[#E8F1EC] border border-[#CFE2D7] flex items-center justify-center text-[#2A4B3A] shrink-0">
                <User className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-[#1C3227] font-['Lora',serif]">
                    {user.name}
                  </h1>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#EBF3EF] text-[#2A4F3C] font-medium border border-[#D5E5DC]">
                    {user.email}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs sm:text-sm text-[#617469]">
                  <Briefcase className="w-3.5 h-3.5 text-[#3C6450]" />
                  <span className="font-medium text-[#2E483A]">
                    Profession: {user.profession || 'Psychology Support Specialist'}
                  </span>
                  <ListenerGenderIcon gender={user.gender || 'Male'} />
                </div>
              </div>
            </div>

            {/* Listener Key Code Box for Easy Testing & Reference */}
            <div className="bg-[#FAF7F2] border border-[#E4DDD2] rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#EDE6DA] text-[#345242] flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] text-[#697A70] font-medium">My Listener Key Code:</div>
                  <div className="font-mono text-xs font-bold text-[#1D3227]">
                    {listenerKeyCode}
                  </div>
                </div>
              </div>

              <button
                id="copy-my-listener-key-btn"
                onClick={handleCopyListenerKey}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EBE4D8] hover:bg-[#DDD3C4] text-[#2C4638] text-xs font-semibold transition-colors cursor-pointer"
                title="Copy my one-time key code"
              >
                {hasCopiedUserKey ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {isHead && (
            <div className="mt-4 p-3.5 rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] flex items-start gap-2.5">
              <Star className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 fill-amber-500/20" />
              <div className="text-xs text-[#78350F] leading-relaxed">
                <strong className="font-semibold text-[#92400E]">Head of Listeners Privilege Active:</strong>{' '}
                As Head of Listeners, you can view all conversations across every listener (including those opened by other peers or waiting in the general queue).
              </div>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* CONDITIONAL RENDER: CHAT WORKSPACE (ONCE DISCUSSION OPENED)    */}
        {/* ------------------------------------------------------------- */}
        {selectedDiscussion ? (
          <div className="flex justify-center w-full pb-8">
            <div className="w-full max-w-[500px]">
              <ListenerChatInterface
                discussion={selectedDiscussion}
                currentListener={user}
                onBack={() => {
                  setSelectedDiscussion(null);
                  refreshDiscussions();
                }}
                onSendMessage={handleSendMessage}
                onCloseDiscussion={handleCloseDiscussion}
                onUpdateAttention={handleUpdateAttention}
              />
            </div>
          </div>
        ) : (
          /* ------------------------------------------------------------- */
          /* DISCUSSIONS TABS & LIST VIEW                                  */
          /* ------------------------------------------------------------- */
          <div className="space-y-6">
            {/* View Tabs */}
            <div className="flex items-center gap-2 border-b border-[#E5DFD5] pb-3 overflow-x-auto">
              <button
                id="tab-unopened-discussions"
                onClick={() => setActiveTab('unopened')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'unopened'
                    ? 'bg-[#315243] text-white shadow-xs'
                    : 'bg-white text-[#56685D] hover:bg-[#F2ECE3] border border-[#E8E2D7]'
                }`}
              >
                <Inbox className="w-4 h-4" />
                <span>Available Discussions</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  activeTab === 'unopened'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#EBF1ED] text-[#264434]'
                }`}>
                  {unopenedList.length}
                </span>
              </button>

              <button
                id="tab-my-conversations"
                onClick={() => setActiveTab('myConversations')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'myConversations'
                    ? 'bg-[#315243] text-white shadow-xs'
                    : 'bg-white text-[#56685D] hover:bg-[#F2ECE3] border border-[#E8E2D7]'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>My Conversations</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  activeTab === 'myConversations'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#EBF1ED] text-[#264434]'
                }`}>
                  {myList.length}
                </span>
              </button>

              <button
                id="tab-history-discussions"
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-[#315243] text-white shadow-xs'
                    : 'bg-white text-[#56685D] hover:bg-[#F2ECE3] border border-[#E8E2D7]'
                }`}
              >
                <Archive className="w-4 h-4" />
                <span>Closed / History</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  activeTab === 'history'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#EBF1ED] text-[#264434]'
                }`}>
                  {historyList.length}
                </span>
              </button>

              <button
                id="tab-mailbox"
                onClick={() => setActiveTab('mailbox')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'mailbox'
                    ? 'bg-[#315243] text-white shadow-xs'
                    : 'bg-white text-[#56685D] hover:bg-[#F2ECE3] border border-[#E8E2D7]'
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>Mailbox</span>
                {unreadShareCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-rose-500 text-white font-bold animate-pulse">
                    {unreadShareCount}
                  </span>
                ) : (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    activeTab === 'mailbox'
                      ? 'bg-white/20 text-white'
                      : 'bg-[#EBF1ED] text-[#264434]'
                  }`}>
                    0
                  </span>
                )}
              </button>

              {(isHead || isAdmin) && (
                <button
                  id="tab-all-conversations-supervisor"
                  onClick={() => setActiveTab('allConversations')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    activeTab === 'allConversations'
                      ? 'bg-[#92400E] text-white shadow-xs'
                      : 'bg-[#FFFBEB] text-[#92400E] hover:bg-[#FEF3C7] border border-[#FDE68A]'
                  }`}
                >
                  <Star className="w-4 h-4" />
                  <span>Supervisor View (All)</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    activeTab === 'allConversations'
                      ? 'bg-white/20 text-white'
                      : 'bg-amber-100 text-amber-900'
                  }`}>
                    {allList.length}
                  </span>
                </button>
              )}
            </div>

            {/* TAB 1: UNOPENED DISCUSSIONS (WAITING FOR ANY LISTENER) */}
            {activeTab === 'unopened' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#1C3227] font-['Lora',serif]">
                      Unopened Conversations Queue
                    </h2>
                    <p className="text-xs text-[#66776E]">
                      Conversations initiated by visitors that have not yet been opened by any listener. Basic non-sensitive details are shown below. Message content remains confidential until claimed.
                    </p>
                  </div>
                  <div className="text-xs text-[#7B8B82] bg-white px-3 py-1.5 rounded-xl border border-[#E8E2D7] shrink-0 self-start sm:self-auto">
                    Waiting: <strong className="text-[#203D2E]">{unopenedList.length}</strong>
                  </div>
                </div>

                {unopenedList.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-[#E8E2D7] p-10 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#F0F5F2] text-[#2F5342] flex items-center justify-center mx-auto mb-3">
                      <Inbox className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-[#23382D]">No Unopened Discussions</h3>
                    <p className="text-xs text-[#6C7D73] mt-1 max-w-sm mx-auto">
                      All incoming conversations have currently been picked up. Check your &quot;My Conversations&quot; tab for active sessions.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {unopenedList.map((disc) => (
                      <div
                        key={disc.id}
                        className="bg-white rounded-3xl border border-[#E8E2D7] p-5 shadow-xs hover:border-[#D0C7B8] transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              {disc.type === 'anonymous' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#EEF2FF] text-[#4338CA] border border-[#D5DCFC]">
                                  <UserX className="w-3.5 h-3.5" />
                                  Anonymous Visitor
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD]">
                                  <User className="w-3.5 h-3.5" />
                                  Registered Member
                                </span>
                              )}
                              <GenderPreferenceTag preference={disc.genderPreference} />
                            </div>
                            <span className="text-[11px] font-mono text-[#8C9C92] bg-[#F7F4EE] px-2 py-0.5 rounded-lg border border-[#E8E1D5]">
                              #{disc.id}
                            </span>
                          </div>

                          <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 text-xs text-[#5D6F64]">
                              <Clock className="w-3.5 h-3.5 text-[#798E82]" />
                              <span>Session Started: <strong>{disc.startedAt}</strong></span>
                            </div>

                            <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#ECE5DB] flex items-start gap-2 text-xs text-[#6B7C72]">
                              <Lock className="w-3.5 h-3.5 text-[#305241] shrink-0 mt-0.5" />
                              <span>
                                <strong>Confidentiality Protection:</strong> Actual message contents are locked and encrypted until claimed with your verified key code.
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          id={`open-disc-btn-${disc.id}`}
                          onClick={() => handleInitiateOpenDiscussion(disc)}
                          className="w-full py-2.5 px-4 bg-[#315243] hover:bg-[#253E33] text-white text-xs sm:text-sm font-semibold rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs group"
                        >
                          <KeyRound className="w-4 h-4 transition-transform group-hover:scale-110" />
                          <span>Open Discussion (Verify Key)</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: MY CONVERSATIONS (ONLY PERSONALLY OPENED BY THIS LISTENER) */}
            {activeTab === 'myConversations' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#1C3227] font-['Lora',serif]">
                      My Active Conversations
                    </h2>
                    <p className="text-xs text-[#66776E]">
                      Discussions you have personally claimed and unlocked using your Listener Key Code. These conversations are linked to your listener account.
                    </p>
                  </div>
                  <div className="text-xs text-[#7B8B82] bg-white px-3 py-1.5 rounded-xl border border-[#E8E2D7] shrink-0 self-start sm:self-auto">
                    Active Sessions: <strong className="text-[#203D2E]">{myList.length}</strong>
                  </div>
                </div>

                {myList.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-[#E8E2D7] p-10 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#FAF6F0] text-[#7A6953] flex items-center justify-center mx-auto mb-3">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-[#23382D]">No Active Conversations Yet</h3>
                    <p className="text-xs text-[#6C7D73] mt-1 max-w-sm mx-auto mb-4">
                      You have no currently active discussions. Check the Available Discussions tab to claim an incoming request with your key code.
                    </p>
                    <button
                      onClick={() => setActiveTab('unopened')}
                      className="px-4 py-2 bg-[#315243] hover:bg-[#253E33] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                    >
                      View Available Queue
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {myList.map((disc) => (
                      <div
                        key={disc.id}
                        className="bg-white rounded-3xl border border-[#E8E2D7] p-5 shadow-xs hover:border-[#D0C7B8] transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              {disc.type === 'anonymous' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#EEF2FF] text-[#4338CA] border border-[#D5DCFC]">
                                  <UserX className="w-3.5 h-3.5" />
                                  Anonymous Visitor
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD]">
                                  <User className="w-3.5 h-3.5" />
                                  Member: {disc.userName || 'Registered'}
                                </span>
                              )}
                              <GenderPreferenceTag preference={disc.genderPreference} />
                            </div>
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#254636] font-semibold bg-[#E7F2EB] px-2.5 py-0.5 rounded-full border border-[#D2E4D8]">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Active Session
                            </span>
                          </div>

                          <div className="space-y-1.5 text-xs text-[#5D6F64] mb-4">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-[#798E82]" />
                              <span>Started: {disc.startedAt}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[#244333] font-medium">
                              <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{disc.openedAt || 'Claimed with your key'}</span>
                            </div>
                            <div className="text-[11px] text-[#7A8C81] pt-1">
                              Total message exchanges: <strong>{disc.messages.length}</strong>
                            </div>
                          </div>
                        </div>

                        <button
                          id={`view-my-disc-btn-${disc.id}`}
                          onClick={() => handleViewDiscussion(disc)}
                          className="w-full py-2.5 px-4 bg-[#315243] hover:bg-[#253E33] text-white text-xs sm:text-sm font-semibold rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>Open Chat Workspace</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: CLOSED / HISTORY (CONVERSATIONS HANDLED PREVIOUSLY) */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#1C3227] font-['Lora',serif]">
                      Closed Discussions &amp; Session History
                    </h2>
                    <p className="text-xs text-[#66776E]">
                      Conversations you previously opened and concluded. Registered members can reopen a closed session at any time, which automatically routes it back to you.
                    </p>
                  </div>
                  <div className="text-xs text-[#7B8B82] bg-white px-3 py-1.5 rounded-xl border border-[#E8E2D7] shrink-0 self-start sm:self-auto">
                    Archived: <strong className="text-[#203D2E]">{historyList.length}</strong>
                  </div>
                </div>

                {historyList.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-[#E8E2D7] p-10 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#F7F4EE] text-[#786C5A] flex items-center justify-center mx-auto mb-3">
                      <Archive className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-[#23382D]">No Closed Discussions in History</h3>
                    <p className="text-xs text-[#6C7D73] mt-1 max-w-sm mx-auto">
                      Conversations you end with the &quot;X&quot; icon will be preserved safely here for reference and audit history.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {historyList.map((disc) => (
                      <div
                        key={disc.id}
                        className="bg-white rounded-3xl border border-[#E8E2D7] p-5 shadow-xs hover:border-[#D0C7B8] transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              {disc.type === 'anonymous' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-300">
                                  <UserX className="w-3.5 h-3.5" />
                                  Anonymous Visitor
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#EAF4F3] text-[#164E49] border border-[#C2E4DF]">
                                  <User className="w-3.5 h-3.5" />
                                  Member: {disc.userName || 'Registered'}
                                </span>
                              )}
                              <GenderPreferenceTag preference={disc.genderPreference} />
                            </div>
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#697A71] font-semibold bg-[#F5F2EC] px-2.5 py-0.5 rounded-full border border-[#E2DDD5]">
                              <Archive className="w-3 h-3 text-stone-500" />
                              Concluded
                            </span>
                          </div>

                          <div className="space-y-1.5 text-xs text-[#5D6F64] mb-4">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-[#798E82]" />
                              <span>Started: {disc.startedAt}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-stone-600">
                              <span>Concluded: <strong>{disc.closedAt || 'Recorded'}</strong></span>
                            </div>
                            <div className="text-[11px] text-[#7A8C81] pt-1">
                              Total message exchanges: <strong>{disc.messages.length}</strong>
                            </div>
                            {disc.type === 'registered' && (
                              <div className="text-[11px] text-teal-800 bg-[#F0F7F5] border border-[#D5EAE3] p-2 rounded-xl mt-2">
                                &bull; Registered session: if member sends a new reflection, it reactivates here automatically.
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          id={`view-history-disc-btn-${disc.id}`}
                          onClick={() => handleViewDiscussion(disc)}
                          className="w-full py-2.5 px-4 bg-[#F2EDE4] hover:bg-[#E7E1D6] text-[#283C30] text-xs sm:text-sm font-semibold rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-[#DBD3C5]"
                        >
                          <Eye className="w-4 h-4 text-[#315243]" />
                          <span>Review Chat History</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: SUPERVISOR VIEW (HEAD OF LISTENERS / ADMIN ONLY) */}
            {(isHead || isAdmin) && activeTab === 'allConversations' && (
              <div className="space-y-4">
                <div className="p-4 rounded-3xl bg-[#FFFBEB] border border-[#FDE68A] flex items-start gap-3">
                  <Star className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 fill-amber-500/20" />
                  <div className="text-xs text-[#78350F] leading-relaxed">
                    <strong className="font-semibold text-[#92400E]">Head of Listeners Supervisory View:</strong>{' '}
                    You have complete oversight privileges across the entire 3awdli listener collective. Below is every conversation in the platform, whether unclaimed, active, or closed.
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-[#E8E2D7] overflow-hidden shadow-xs">
                  <div className="p-4 sm:p-5 bg-[#FAF7F2] border-b border-[#E8E2D7] flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[#1C3227] font-['Lora',serif]">
                      Complete System Discussion Ledger ({allList.length} total)
                    </h3>
                    <span className="text-xs text-[#7B8B82]">
                      Supervisory Access Enabled
                    </span>
                  </div>

                  <div className="divide-y divide-[#EFEBE4]">
                    {allList.map((disc) => (
                      <div 
                        key={disc.id}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FAF8F5] transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-[#233A2E]">
                              #{disc.id}
                            </span>

                            {disc.type === 'anonymous' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#EEF2FF] text-[#4338CA]">
                                <UserX className="w-3 h-3" />
                                Anonymous Visitor
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#E0F2FE] text-[#0369A1]">
                                <User className="w-3 h-3" />
                                Member ({disc.userName || 'Registered'})
                              </span>
                            )}

                            <GenderPreferenceTag preference={disc.genderPreference} />

                            {disc.status === 'unopened' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#FEF3C7] text-[#92400E]">
                                <Clock className="w-3 h-3" />
                                Unclaimed / In Queue
                              </span>
                            )}

                            {disc.status === 'opened' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#E4EFE8] text-[#204030]">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Opened by {disc.openedByListenerName || 'Listener'}
                              </span>
                            )}

                            {disc.status === 'closed' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-stone-100 text-stone-700 border border-stone-300">
                                <Archive className="w-3 h-3 text-stone-500" />
                                Concluded ({disc.closedAt || 'Closed'})
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-[#6B7D72] flex items-center gap-3 flex-wrap">
                            <span>Started: {disc.startedAt}</span>
                            {disc.openedAt && <span>Claimed: {disc.openedAt}</span>}
                            <span>Messages: {disc.messages.length}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {disc.status === 'unopened' ? (
                            <button
                              onClick={() => handleInitiateOpenDiscussion(disc)}
                              className="px-3.5 py-2 rounded-xl bg-[#315243] hover:bg-[#253E33] text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Claim with Key</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleViewDiscussion(disc)}
                              className="px-3.5 py-2 rounded-xl bg-[#EFECE5] hover:bg-[#E2DDD3] text-[#2F4438] text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{disc.status === 'closed' ? 'Review History' : 'Open Workspace'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: ONE-TIME KEY CODE VERIFICATION TO OPEN DISCUSSION       */}
      {/* ------------------------------------------------------------- */}
      {verifyingDiscussion && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/40 backdrop-blur-xs overflow-hidden animate-in fade-in"
          onClick={() => {
            setVerifyingDiscussion(null);
            setKeyCodeError(null);
          }}
        >
          <div 
            className="bg-[#FAF8F5] border border-[#E5DFD5] rounded-3xl max-w-lg w-full max-h-[min(90vh,620px)] flex flex-col shadow-2xl relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 sm:p-6 pb-4 shrink-0 flex items-start justify-between border-b border-[#EBE6DD]">
              <div className="flex items-center gap-3 pr-6">
                <div className="w-10 h-10 rounded-2xl bg-[#E8F1EC] text-[#315243] flex items-center justify-center border border-[#D0E0D6] shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1C3227] font-['Lora',serif]">
                    Listener Authorization Required
                  </h3>
                  <p className="text-xs text-[#68766E]">
                    Enter your personal key code to claim and open discussion #{verifyingDiscussion.id}
                  </p>
                </div>
              </div>

              <button
                id="close-key-modal-btn"
                onClick={() => {
                  setVerifyingDiscussion(null);
                  setKeyCodeError(null);
                }}
                className="p-2 text-[#7C8780] hover:text-[#2C332F] hover:bg-[#EFECE5] rounded-xl transition-colors cursor-pointer shrink-0"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {/* Target Discussion Non-Sensitive Summary */}
              <div className="p-3.5 bg-white border border-[#E5DFD5] rounded-2xl space-y-1.5">
                <div className="text-xs font-semibold text-[#3D4F43] flex items-center justify-between">
                  <span>Target Discussion:</span>
                  <span className="font-mono text-[11px] text-[#697B70]">#{verifyingDiscussion.id}</span>
                </div>
                <div className="text-xs text-[#5D6F64] flex items-center justify-between">
                  <span>Visitor Category:</span>
                  <span className="font-medium text-[#203D2E]">
                    {verifyingDiscussion.type === 'anonymous' ? 'Anonymous Visitor' : 'Registered Member'}
                  </span>
                </div>
                <div className="text-xs text-[#5D6F64] flex items-center justify-between">
                  <span>Gender Preference:</span>
                  <GenderPreferenceTag preference={verifyingDiscussion.genderPreference} />
                </div>
                <div className="text-xs text-[#5D6F64] flex items-center justify-between">
                  <span>Started:</span>
                  <span>{verifyingDiscussion.startedAt}</span>
                </div>
              </div>

              {/* Security Rule Notice */}
              <div className="p-3 bg-[#F4EFE7] rounded-2xl border border-[#DFD6C8] flex items-start gap-2.5 text-xs text-[#67776F]">
                <FolderLock className="w-4 h-4 text-[#315243] shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="text-[#20382B]">Ownership Policy:</strong> Once verified, this conversation will be permanently assigned to your personal list (<strong>My Conversations</strong>) and removed from the shared open queue.
                </div>
              </div>

              {/* Error Message */}
              {keyCodeError && (
                <div 
                  id="keycode-error-banner"
                  className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2.5 leading-relaxed"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{keyCodeError}</span>
                </div>
              )}

              {/* Key Code Input Form */}
              <form onSubmit={handleSubmitKeyCode} id="verify-key-code-form" className="space-y-4">
                <div>
                  <label 
                    htmlFor="listener-key-input"
                    className="block text-xs font-semibold text-[#293B30] mb-1.5"
                  >
                    Your Personal Listener Key Code
                  </label>
                  <div className="relative">
                    <input
                      id="listener-key-input"
                      type="text"
                      required
                      value={inputKeyCode}
                      onChange={(e) => {
                        setInputKeyCode(e.target.value.toUpperCase());
                        setKeyCodeError(null);
                      }}
                      placeholder="e.g. 3AW-LISTEN-7X4K-9M2Q"
                      className="w-full bg-white border border-[#D5CEC0] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono tracking-wider text-[#233129] outline-none focus:border-[#315243] uppercase"
                    />
                  </div>
                </div>

                {/* Developer/Testing Helper Assist Box */}
                <div className="p-3 bg-[#EBF2EE] border border-[#CCE0D3] rounded-xl flex items-center justify-between gap-2 text-xs">
                  <div className="text-[11px] text-[#335343] leading-tight">
                    <span className="font-semibold">Testing helper:</span> Your key is <code className="font-mono font-bold">{listenerKeyCode}</code>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setInputKeyCode(listenerKeyCode);
                      setKeyCodeError(null);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#315243] hover:bg-[#253E33] text-white text-[11px] font-semibold transition-colors cursor-pointer shrink-0"
                  >
                    Auto-Fill
                  </button>
                </div>
              </form>
            </div>

            {/* Fixed Footer with Action Controls */}
            <div className="p-4 sm:p-5 border-t border-[#EBE6DD] bg-[#FAF7F2] flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setVerifyingDiscussion(null);
                  setKeyCodeError(null);
                }}
                className="py-2.5 px-4 rounded-xl bg-[#EFECE5] hover:bg-[#E4DFD4] text-[#3B4C41] text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                form="verify-key-code-form"
                id="submit-key-code-btn"
                className="py-2.5 px-5 rounded-xl bg-[#315243] hover:bg-[#253E33] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                <Unlock className="w-4 h-4" />
                <span>Verify Key &amp; Open Discussion</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
