import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Heart, 
  MessageSquare, 
  History, 
  Sparkles, 
  Send, 
  ArrowLeft, 
  Clock, 
  CheckCircle2, 
  ShieldCheck, 
  Flag, 
  RotateCcw, 
  User, 
  AlertCircle,
  MessageCircle,
  Plus
} from 'lucide-react';
import { 
  UserAccount, 
  DiscussionConversation, 
  ChatMessage, 
  ListenerGenderPreference 
} from '../types';
import { 
  getStoredDiscussions, 
  createNewDiscussion, 
  getActiveUserDiscussion, 
  getActiveUserDiscussionId, 
  setActiveUserDiscussionId, 
  recordLiveDiscussionMessage,
  updateDiscussionGenderPreference,
  closeDiscussion,
  isFakeDiscussion,
  reconcileDiscussionsWithLocal,
  DISCUSSIONS_STORAGE_KEY,
  getDiscussionClosedMs,
  formatDiscussionClosedDate
} from '../utils/discussionManagement';
import { 
  fetchDiscussionsFromFirestore, 
  subscribeToDiscussions 
} from '../lib/firestoreService';
import { Navbar } from './Navbar';
import { ConversationParticipantBar } from './ConversationParticipantBar';
import { GenderPreferenceTag } from './GenderPreferenceTag';
import { GenderPreferenceModal } from './GenderPreferenceModal';
import { formatDiscussionDateTime, extractTimestampMs } from '../utils/timezoneManagement';
import { ReportDiscussionModal } from './ReportDiscussionModal';
import { VoiceCallOverlay, CallButton } from './VoiceCallOverlay';
import { useLanguage } from '../context/LanguageContext';
import { formatSiteTime } from '../utils/timezoneManagement';

interface MemberDiscussionsPageProps {
  user: UserAccount;
  initialTab?: 'active' | 'history';
  onNavigateHome: () => void;
  onNavigateDashboard: () => void;
  onNavigateAdmin?: () => void;
  onNavigateMemberManagement?: () => void;
  onNavigateGames?: () => void;
  onNavigateTeenSpace?: () => void;
  onNavigateLounge?: () => void;
  onNavigateRules?: () => void;
  onNavigateSchedules?: () => void;
  onNavigateReports?: () => void;
  onNavigateAdminReports?: () => void;
  onNavigateAdminSupport?: () => void;
  onSignOut: () => void;
  onOpenEmergencyModal: () => void;
  onOpenContactSupport?: () => void;
  onTalkAnonymously?: () => void;
}

export const MemberDiscussionsPage: React.FC<MemberDiscussionsPageProps> = ({
  user,
  initialTab = 'active',
  onNavigateHome,
  onNavigateDashboard,
  onNavigateAdmin,
  onNavigateMemberManagement,
  onNavigateGames,
  onNavigateTeenSpace,
  onNavigateLounge,
  onNavigateRules,
  onNavigateSchedules,
  onNavigateReports,
  onNavigateAdminReports,
  onNavigateAdminSupport,
  onSignOut,
  onOpenEmergencyModal,
  onOpenContactSupport,
  onTalkAnonymously,
}) => {
  const { language } = useLanguage();

  // Navigation tab inside discussions: 'active' or 'history'
  const [activeTab, setActiveTab] = useState<'active' | 'history'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [allDiscussions, setAllDiscussions] = useState<DiscussionConversation[]>([]);
  const [activeDiscussion, setActiveDiscussion] = useState<DiscussionConversation | null>(null);
  const [selectedHistoryDiscussion, setSelectedHistoryDiscussion] = useState<DiscussionConversation | null>(null);

  // Modals state
  const [isGenderModalOpen, setIsGenderModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportTargetDiscussion, setReportTargetDiscussion] = useState<DiscussionConversation | null>(null);

  // Chat message input
  const [messageText, setMessageText] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // Sync discussions strictly filtered for this user only
  const syncDiscussions = () => {
    const list = getStoredDiscussions();
    setAllDiscussions((prev) => {
      if (
        prev.length === list.length &&
        prev.every((p, i) => p.id === list[i]?.id && p.status === list[i]?.status && p.messages?.length === list[i]?.messages?.length)
      ) {
        return prev;
      }
      return list;
    });

    // Active discussion resolution - ONLY check explicitly stored activeId
    const activeId = getActiveUserDiscussionId(user.id);
    let foundActive: DiscussionConversation | undefined;

    if (activeId) {
      foundActive = list.find((d) => d.id === activeId && d.status !== 'closed');
      if (!foundActive) {
        setActiveUserDiscussionId(user.id, null);
      }
    }

    setActiveDiscussion((prev) => {
      if (!prev && !foundActive) return null;
      if (
        prev &&
        foundActive &&
        prev.id === foundActive.id &&
        prev.status === foundActive.status &&
        prev.messages?.length === foundActive.messages?.length &&
        JSON.stringify(prev.activeCall) === JSON.stringify(foundActive.activeCall)
      ) {
        return prev;
      }
      return foundActive || null;
    });

    // Update selected history if open
    setSelectedHistoryDiscussion((prev) => {
      if (!prev) return null;
      const updated = list.find((d) => d.id === prev.id);
      if (!updated) return null;
      if (
        prev.status === updated.status &&
        prev.messages?.length === updated.messages?.length
      ) {
        return prev;
      }
      return updated;
    });
  };

  useEffect(() => {
    syncDiscussions();

    // Fetch directly from Firestore on mount
    fetchDiscussionsFromFirestore()
      .then((remote) => {
        if (remote && remote.length > 0) {
          const clean = remote.filter((d) => !isFakeDiscussion(d));
          const local = getStoredDiscussions();
          const merged = reconcileDiscussionsWithLocal(clean, local);
          localStorage.setItem(DISCUSSIONS_STORAGE_KEY, JSON.stringify(merged));
          syncDiscussions();
        }
      })
      .catch((err) => console.warn('MemberDiscussionsPage direct fetch notice:', err));

    // Real-time Firestore subscription for instantaneous cross-device sync
    const unsubFirestore = subscribeToDiscussions((remote) => {
      if (!remote) return;
      const clean = remote.filter((d) => !isFakeDiscussion(d));
      const local = getStoredDiscussions();
      const merged = reconcileDiscussionsWithLocal(clean, local);
      localStorage.setItem(DISCUSSIONS_STORAGE_KEY, JSON.stringify(merged));
      syncDiscussions();
    });

    const handleSync = () => syncDiscussions();
    window.addEventListener('3awdli_discussion_sync', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      unsubFirestore();
      window.removeEventListener('3awdli_discussion_sync', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [user.id, user.email]);

  const prevMessagesCountRef = useRef(0);
  // Scroll to bottom when new messages arrive (guard against continuous re-triggering)
  useEffect(() => {
    if (activeTab !== 'active' || !activeDiscussion) return;
    const currentCount = activeDiscussion.messages?.length || 0;
    if (currentCount > prevMessagesCountRef.current) {
      prevMessagesCountRef.current = currentCount;
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (prevMessagesCountRef.current === 0 && currentCount > 0) {
      prevMessagesCountRef.current = currentCount;
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [activeDiscussion?.messages?.length, activeTab]);

  // User's own discussions (Past and Current)
  const myDiscussions = useMemo(() => {
    return allDiscussions
      .filter((d) => {
        if (d.userId && d.userId === user.id) return true;
        if (d.userEmail && user.email && d.userEmail.trim().toLowerCase() === user.email.trim().toLowerCase()) return true;
        return false;
      })
      .sort((a, b) => {
        const timeA = getDiscussionClosedMs(a) || extractTimestampMs(a.startedAtTimestamp) || extractTimestampMs(a.startedAt) || 0;
        const timeB = getDiscussionClosedMs(b) || extractTimestampMs(b.startedAtTimestamp) || extractTimestampMs(b.startedAt) || 0;
        return timeB - timeA;
      });
  }, [allDiscussions, user.id, user.email]);

  // Past discussions for history list (closed discussions or non-active discussions)
  const pastDiscussions = useMemo(() => {
    return myDiscussions.filter((d) => d.id !== activeDiscussion?.id);
  }, [myDiscussions, activeDiscussion?.id]);

  // Handle starting a new discussion
  const handleStartNewDiscussionClick = () => {
    setIsGenderModalOpen(true);
  };

  const handleConfirmStartNew = (preference: ListenerGenderPreference) => {
    setIsGenderModalOpen(false);
    const newDisc = createNewDiscussion('registered', {
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      genderPreference: preference,
      language,
    });
    setActiveUserDiscussionId(user.id, newDisc.id);
    setActiveDiscussion(newDisc);
    setActiveTab('active');
    setSelectedHistoryDiscussion(null);
    showToast(
      language === 'fr'
        ? 'Nouvelle discussion démarrée. Un écoutant va bientôt vous répondre.'
        : 'New discussion created. A listener will be with you shortly.'
    );
  };

  // Handle sending a message in active discussion
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = messageText.trim();
    if (!trimmed) return;

    const now = new Date();
    const timeFormatted = formatSiteTime(now);

    const userMsg: ChatMessage = {
      id: `msg_usr_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      sender: 'user',
      text: trimmed,
      timestamp: timeFormatted,
      timestampMs: Date.now(),
    };

    let targetDiscussion = activeDiscussion;

    if (!targetDiscussion || targetDiscussion.status === 'closed') {
      targetDiscussion = createNewDiscussion('registered', {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        genderPreference: 'any',
        language,
      });
      setActiveUserDiscussionId(user.id, targetDiscussion.id);
      setActiveDiscussion(targetDiscussion);
    }

    recordLiveDiscussionMessage(
      targetDiscussion.id,
      userMsg,
      'registered',
      user.name,
      user.email,
      user.id
    );

    setMessageText('');
    syncDiscussions();
  };

  // Handle closing the active discussion
  const handleEndDiscussion = () => {
    if (!activeDiscussion) return;
    const confirmMsg =
      language === 'fr'
        ? 'Êtes-vous sûr de vouloir terminer cette conversation ? Elle sera conservée dans votre historique.'
        : 'Are you sure you want to end this conversation? It will be safely saved in your history.';
    if (window.confirm(confirmMsg)) {
      closeDiscussion(activeDiscussion.id, user.id, user.name, 'user');
      setActiveUserDiscussionId(user.id, null);
      setActiveDiscussion(null);
      syncDiscussions();
      setActiveTab('history');
      showToast(
        language === 'fr'
          ? 'Discussion terminée et archivée dans votre historique.'
          : 'Discussion ended and archived in your history.'
      );
    }
  };

  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <div 
          id="member-disc-toast"
          className="fixed top-4 right-4 z-50 bg-[#28493A] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs sm:text-sm animate-in fade-in slide-in-from-top-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Persistent Left Sidebar + Sticky Top Bar Layout */}
      <Navbar
        currentView="discussions"
        currentUser={user}
        onNavigateHome={onNavigateHome}
        onNavigateDashboard={onNavigateDashboard}
        onNavigateDiscussions={() => {
          setSelectedHistoryDiscussion(null);
          setActiveTab('active');
        }}
        onNavigateAdmin={onNavigateAdmin}
        onNavigateMemberManagement={onNavigateMemberManagement}
        onNavigateGames={onNavigateGames}
        onNavigateTeenSpace={onNavigateTeenSpace}
        onNavigateLounge={onNavigateLounge}
        onNavigateRules={onNavigateRules}
        onNavigateSchedules={onNavigateSchedules}
        onNavigateReports={onNavigateReports}
        onNavigateAdminReports={onNavigateAdminReports}
        onNavigateAdminSupport={onNavigateAdminSupport}
        onOpenContactSupport={onOpenContactSupport}
        onOpenEmergencyModal={onOpenEmergencyModal}
        onTalkAnonymously={onTalkAnonymously}
        onSignOut={onSignOut}
      >
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
          {/* Breadcrumb Navigation */}
          <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
            <button
              id="return-to-personal-space-btn"
              onClick={onNavigateDashboard}
              className="inline-flex items-center gap-2 text-sm text-[#5B6D62] hover:text-[#21372C] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>
                {language === 'fr' ? 'Retour à mon Espace Personnel' : 'Return to My Personal Space'}
              </span>
            </button>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E4EFE8] text-[#224634] border border-[#CCE0D3]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                {language === 'fr' ? 'Espace Sécurisé & Confidentiel' : 'Secure & Confidential'}
              </span>
            </div>
          </div>

          {/* Page Hero Header */}
          <div className="bg-white rounded-3xl border border-[#E8E2D7] p-6 sm:p-8 shadow-xs mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-[#E8F1EC] text-[#2A4B3A] flex items-center justify-center">
                    <Heart className="w-4.5 h-4.5 text-emerald-700 fill-emerald-700/20" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#1C3227] font-['Lora',serif]">
                    {language === 'fr' ? 'Mes Discussions' : 'Discussions'}
                  </h1>
                </div>
                <p className="text-xs sm:text-sm text-[#53655A] max-w-2xl leading-relaxed">
                  {language === 'fr'
                    ? 'Un sanctuaire privé et confidentiel pour parler à cœur ouvert avec nos écoutants bienveillants et consulter l\'historique complet de vos échanges.'
                    : 'A private, confidential sanctuary to talk openly with compassionate listeners and review the complete history of your conversations.'}
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                <button
                  id="member-start-new-discussion-btn"
                  onClick={handleStartNewDiscussionClick}
                  className="px-4 py-2.5 bg-[#315243] hover:bg-[#253E32] text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs hover:shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-emerald-200" />
                  <span>
                    {language === 'fr' ? 'Nouvelle discussion' : 'Start New Discussion'}
                  </span>
                </button>

                {onTalkAnonymously && (
                  <button
                    id="member-talk-openly-btn"
                    onClick={onTalkAnonymously}
                    className="px-3.5 py-2.5 bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#2F5342] border border-[#D5CDBD] rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                    title={language === 'fr' ? 'Ouvrir le chat instantané' : 'Open live chat modal'}
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-700" />
                    <span>{language === 'fr' ? 'Parler à cœur ouvert' : 'Talk Openly'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Navigation Tabs (Active Discussion vs History) */}
            <div className="flex items-center gap-2 border-b border-[#EAE4D9] mt-6 pt-2">
              <button
                id="member-tab-active-btn"
                onClick={() => {
                  setActiveTab('active');
                  setSelectedHistoryDiscussion(null);
                }}
                className={`pb-3 px-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'active'
                    ? 'border-[#2F5342] text-[#2F5342]'
                    : 'border-transparent text-[#67776E] hover:text-[#21382D]'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>
                  {language === 'fr' ? 'Discussion en cours' : 'Active Discussion'}
                </span>
                {activeDiscussion && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                )}
              </button>

              <button
                id="member-tab-history-btn"
                onClick={() => setActiveTab('history')}
                className={`pb-3 px-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'history'
                    ? 'border-[#2F5342] text-[#2F5342]'
                    : 'border-transparent text-[#67776E] hover:text-[#21382D]'
                }`}
              >
                <History className="w-4 h-4" />
                <span>
                  {language === 'fr' ? 'Historique de mes discussions' : 'Discussion History'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-[#EAE5DA] text-[#4E5F54] font-bold">
                  {pastDiscussions.length}
                </span>
              </button>
            </div>
          </div>

          {/* TAB 1: ACTIVE DISCUSSION VIEW */}
          {activeTab === 'active' && (
            <div className="bg-white rounded-3xl border border-[#E8E2D7] overflow-hidden shadow-xs">
              {activeDiscussion ? (
                <div className="flex flex-col h-[760px] min-h-[560px] max-h-[min(90vh,820px)]">
                  {/* Chat Header */}
                  <div className="px-5 py-3.5 bg-[#315243] text-white flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-700/40 border border-emerald-500/30 flex items-center justify-center text-emerald-200">
                        <User className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm sm:text-base font-semibold leading-tight">
                            {activeDiscussion.openedByListenerName
                              ? activeDiscussion.openedByListenerName
                              : language === 'fr'
                              ? 'Écoutant bienveillant'
                              : 'Caring Listener'}
                          </h3>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600/50 text-emerald-100 font-medium">
                            {activeDiscussion.status === 'opened'
                              ? language === 'fr'
                                ? 'En ligne'
                                : 'Listening Now'
                              : language === 'fr'
                              ? 'En attente d\'un écoutant'
                              : 'Waiting for Listener'}
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-200/80">
                          {language === 'fr'
                            ? 'Échange 100% confidentiel et sans jugement'
                            : '100% confidential & judgment-free'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <CallButton
                        discussion={activeDiscussion}
                        currentRole="user"
                        currentUserId={user.id}
                        currentUserName={user.name}
                      />

                      <button
                        id="member-report-active-disc-btn"
                        onClick={() => {
                          setReportTargetDiscussion(activeDiscussion);
                          setIsReportModalOpen(true);
                        }}
                        className="h-8 sm:h-9 px-2 sm:px-2.5 md:px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 border border-rose-300/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 active:scale-95"
                        title="Report this discussion"
                      >
                        <Flag className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                        <span className="hidden md:inline">
                          {language === 'fr' ? 'Signaler' : 'Report'}
                        </span>
                      </button>

                      <button
                        id="member-end-active-disc-btn"
                        onClick={handleEndDiscussion}
                        className="h-8 sm:h-9 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 active:scale-95"
                        title="Conclude discussion"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
                        <span className="hidden sm:inline">{language === 'fr' ? 'Terminer' : 'End Discussion'}</span>
                        <span className="sm:hidden">{language === 'fr' ? 'Fin' : 'End'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Real-time Voice Call Overlay (Incoming Modal / Ringing Banner / Active In-Call Screen) */}
                  <VoiceCallOverlay
                    discussion={activeDiscussion}
                    currentRole="user"
                    currentUserId={user.id}
                    currentUserName={user.name}
                  />

                  {/* Participant & Preference Sub-bar */}
                  <div className="bg-[#FAF7F2] border-b border-[#EAE4D9] px-4 py-2 text-xs flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2 overflow-x-auto">
                      <span className="text-[#59695F]">
                        {language === 'fr' ? 'Préférence d\'écoutant :' : 'Listener preference:'}
                      </span>
                      <GenderPreferenceTag preference={activeDiscussion.genderPreference || 'any'} />
                    </div>
                    <span className="text-[11px] text-[#69796F] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#2F5342]" />
                      {activeDiscussion.startedAt}
                    </span>
                  </div>

                  {/* Compact Participant Transparency */}
                  <ConversationParticipantBar discussion={activeDiscussion} isCompact={true} viewerId={user.id} />

                  {/* Message History Feed */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-[#FAF8F5]">
                    {activeDiscussion.messages && activeDiscussion.messages.length > 0 ? (
                      activeDiscussion.messages.map((msg, idx) => {
                        const isUser = msg.sender === 'user';
                        const isSystem = msg.sender === 'system';

                        if (isSystem) {
                          return (
                            <div key={msg.id || idx} className="flex justify-center my-2">
                              <div className="bg-[#ECE7DE] border border-[#DDD6CA] text-[#46574D] px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2.5 max-w-lg text-center shadow-2xs leading-relaxed">
                                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 self-center" />
                                <span>{msg.text}</span>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={msg.id || idx}
                            className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                          >
                            <span className="text-[10.5px] text-[#718277] mb-1 px-1">
                              {isUser ? user.name : activeDiscussion.openedByListenerName || 'Listener'} • {msg.timestamp}
                            </span>
                            <div
                              className={`max-w-[82%] sm:max-w-md px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs ${
                                isUser
                                  ? 'bg-[#315243] text-white rounded-br-xs'
                                  : 'bg-white text-[#21382C] border border-[#E3DDD1] rounded-bl-xs'
                              }`}
                            >
                              <p className="whitespace-pre-wrap">{msg.text}</p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6">
                        <MessageSquare className="w-8 h-8 text-[#A8B7AE] mb-2" />
                        <p className="text-xs text-[#6A7B70]">
                          {language === 'fr'
                            ? 'Aucun message pour le moment. Exprimez-vous librement ci-dessous.'
                            : 'No messages yet. Feel free to type anything on your mind below.'}
                        </p>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input Box */}
                  <form
                    onSubmit={handleSendMessage}
                    className="p-3.5 bg-white border-t border-[#EAE3D6] flex items-center gap-2 shrink-0"
                  >
                    <input
                      id="member-disc-message-input"
                      type="text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder={
                        language === 'fr'
                          ? 'Écrivez votre message ici... Prenez votre temps.'
                          : "Type what's on your mind... Take your time."
                      }
                      className="flex-1 px-4 py-2.5 bg-[#FAF8F5] border border-[#DCD5C7] rounded-xl text-xs sm:text-sm text-[#22392E] placeholder-[#8A9B90] focus:outline-none focus:ring-2 focus:ring-[#315243]/30"
                    />
                    <button
                      id="member-disc-send-message-btn"
                      type="submit"
                      disabled={!messageText.trim()}
                      className="px-4 py-2.5 bg-[#315243] hover:bg-[#253E32] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">
                        {language === 'fr' ? 'Envoyer' : 'Send'}
                      </span>
                    </button>
                  </form>
                </div>
              ) : (
                /* Empty Active State */
                <div className="p-8 sm:p-12 text-center flex flex-col items-center">
                  <div className="w-16 h-16 rounded-3xl bg-[#E8F1EC] text-[#2A4B3A] flex items-center justify-center mb-4 shadow-xs">
                    <Heart className="w-8 h-8 text-emerald-700 fill-emerald-700/20" />
                  </div>
                  <h3 className="text-xl font-bold text-[#1C3227] font-['Lora',serif] mb-2">
                    {language === 'fr' ? 'Aucune discussion active en ce moment' : 'No Active Discussion Right Now'}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#54655B] max-w-md mb-6 leading-relaxed">
                    {language === 'fr'
                      ? 'Dès que vous ressentez le besoin de vous confier, d\'être écouté(e) ou simplement de poser vos pensées, nos écoutants formés sont là pour vous.'
                      : 'Whenever you feel the need to open up, share your burdens, or simply have someone listen with compassion, our listeners are ready for you.'}
                  </p>
                  <button
                    id="start-first-discussion-cta"
                    onClick={handleStartNewDiscussionClick}
                    className="px-6 py-3 bg-[#315243] hover:bg-[#253E32] text-white rounded-2xl text-xs sm:text-sm font-semibold shadow-xs hover:shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-emerald-200" />
                    <span>
                      {language === 'fr' ? 'Démarrer une discussion' : 'Start a New Discussion'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DISCUSSION HISTORY VIEW */}
          {activeTab === 'history' && (
            <div className="bg-white rounded-3xl border border-[#E8E2D7] p-6 sm:p-8 shadow-xs">
              {selectedHistoryDiscussion ? (
                /* Selected Past Discussion Transcript View */
                <div>
                  <div className="flex items-center justify-between flex-wrap gap-3 pb-4 mb-4 border-b border-[#ECE5D9]">
                    <button
                      id="member-history-back-btn"
                      onClick={() => setSelectedHistoryDiscussion(null)}
                      className="inline-flex items-center gap-2 text-xs sm:text-sm text-[#5B6D62] hover:text-[#21372C] transition-colors cursor-pointer font-medium"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>
                        {language === 'fr' ? 'Retour à la liste des sessions' : 'Back to All Past Sessions'}
                      </span>
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2.5 py-1 rounded-full bg-[#ECE5D9] text-[#4E5F54] font-medium">
                        {language === 'fr' ? 'Session archivée' : 'Archived Session'}
                      </span>
                      <button
                        id="member-report-history-disc-btn"
                        onClick={() => {
                          setReportTargetDiscussion(selectedHistoryDiscussion);
                          setIsReportModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Flag className="w-3.5 h-3.5 text-rose-600" />
                        <span>{language === 'fr' ? 'Signaler cette session' : 'Report Session'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Transcript Header Info */}
                  <div className="bg-[#FAF7F2] border border-[#EBE3D5] rounded-2xl p-4 mb-5 text-xs text-[#526359] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-[#1C3227]">
                        {language === 'fr' ? 'Session démarrée :' : 'Session started:'}
                      </span>{' '}
                      {formatDiscussionDateTime(selectedHistoryDiscussion.startedAtTimestamp || selectedHistoryDiscussion.startedAt)}
                      {selectedHistoryDiscussion.status === 'closed' && (
                        <span className="ml-2 text-stone-700">
                          • {language === 'fr' ? 'Clôturée :' : 'Closed:'} {formatDiscussionClosedDate(selectedHistoryDiscussion)}
                        </span>
                      )}
                      {selectedHistoryDiscussion.openedByListenerName && (
                        <span className="ml-2 text-[#315243]">
                          • {language === 'fr' ? 'Écoutant :' : 'Listener:'} {selectedHistoryDiscussion.openedByListenerName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span>{selectedHistoryDiscussion.messages?.length || 0} {language === 'fr' ? 'messages' : 'messages'}</span>
                    </div>
                  </div>

                  {/* Messages Feed in Read-Only Mode */}
                  <div className="border border-[#EAE3D6] rounded-2xl p-4 sm:p-5 space-y-3.5 bg-[#FAF8F5] max-h-[500px] overflow-y-auto">
                    {selectedHistoryDiscussion.messages && selectedHistoryDiscussion.messages.length > 0 ? (
                      selectedHistoryDiscussion.messages.map((msg, idx) => {
                        const isUser = msg.sender === 'user';
                        const isSystem = msg.sender === 'system';

                        if (isSystem) {
                          return (
                            <div key={msg.id || idx} className="flex justify-center my-2">
                              <div className="bg-[#ECE7DE] border border-[#DDD6CA] text-[#46574D] px-4 py-2 rounded-2xl text-[11.5px] flex items-center gap-2.5 max-w-md text-center leading-relaxed">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0 self-center" />
                                <span>{msg.text}</span>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={msg.id || idx}
                            className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                          >
                            <span className="text-[10px] text-[#788A7E] mb-0.5 px-1">
                              {isUser ? user.name : selectedHistoryDiscussion.openedByListenerName || 'Listener'} • {msg.timestamp}
                            </span>
                            <div
                              className={`max-w-[85%] sm:max-w-md px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                                isUser
                                  ? 'bg-[#315243] text-white rounded-br-xs'
                                  : 'bg-white text-[#21382C] border border-[#E3DDD1] rounded-bl-xs'
                              }`}
                            >
                              <p className="whitespace-pre-wrap">{msg.text}</p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-6 text-xs text-[#788A7E]">
                        {language === 'fr' ? 'Aucun message enregistré.' : 'No recorded messages.'}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* List of All Past Conversations */
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="text-lg font-bold text-[#1C3227] font-['Lora',serif]">
                        {language === 'fr' ? 'Historique de vos échanges' : 'Your Conversation History'}
                      </h2>
                      <p className="text-xs text-[#63746B]">
                        {language === 'fr'
                          ? 'Seules vos propres conversations sont répertoriées ici en toute intimité.'
                          : 'Only conversations personally started by you are listed here in complete privacy.'}
                      </p>
                    </div>
                  </div>

                  {pastDiscussions.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-[#DCD5C8] rounded-2xl bg-[#FAF8F5]">
                      <History className="w-8 h-8 text-[#A6B5AC] mx-auto mb-2" />
                      <p className="text-xs sm:text-sm font-semibold text-[#2C4437] mb-1">
                        {language === 'fr' ? 'Aucune conversation pour l\'instant' : 'No conversations yet'}
                      </p>
                      <p className="text-xs text-[#6D7D73] max-w-sm mx-auto">
                        {language === 'fr'
                          ? 'Lorsque vous terminerez des conversations avec nos écoutants, elles apparaîtront ici pour consultation future.'
                          : 'When you conclude discussions with our listeners, they will be preserved here for your review.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pastDiscussions.map((disc) => {
                        const lastMsg = disc.messages && disc.messages.length > 0 
                          ? disc.messages[disc.messages.length - 1] 
                          : null;

                        return (
                          <div
                            key={disc.id}
                            className="p-4 sm:p-5 rounded-2xl border border-[#E6E0D4] bg-[#FAF8F5] hover:bg-white hover:border-[#CFE2D7] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-xs font-semibold text-[#1F362A]">
                                  Started: {formatDiscussionDateTime(disc.startedAtTimestamp || disc.startedAt)}
                                </span>
                                {disc.status === 'closed' && (
                                  <span className="text-xs text-stone-600">
                                    • Closed: {formatDiscussionClosedDate(disc)}
                                  </span>
                                )}
                                <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-[#EAE5DB] text-[#4D5E53] font-medium">
                                  {disc.status === 'closed'
                                    ? language === 'fr' ? 'Terminée' : 'Concluded'
                                    : language === 'fr' ? 'Enregistrée' : 'Recorded'}
                                </span>
                                {disc.openedByListenerName && (
                                  <span className="text-[11px] text-[#315243] font-medium">
                                    • {language === 'fr' ? 'Écoutant :' : 'Listener:'} {disc.openedByListenerName}
                                  </span>
                                )}
                              </div>

                              {lastMsg && (
                                <p className="text-xs text-[#5D6F64] line-clamp-1 italic mt-1">
                                  "{lastMsg.text}"
                                </p>
                              )}

                              <div className="flex items-center gap-3 text-[11px] text-[#77887E] mt-2">
                                <span>{disc.messages?.length || 0} {language === 'fr' ? 'messages' : 'messages'}</span>
                                <span>•</span>
                                <GenderPreferenceTag preference={disc.genderPreference || 'any'} />
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                id={`view-disc-history-${disc.id}`}
                                onClick={() => setSelectedHistoryDiscussion(disc)}
                                className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#E8F1EC] text-[#2F5342] border border-[#D8D2C5] hover:border-[#CFE2D7] text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                              >
                                {language === 'fr' ? 'Consulter l\'échange' : 'View Conversation'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </Navbar>

      {/* Listener Gender Preference Modal */}
      <GenderPreferenceModal
        isOpen={isGenderModalOpen}
        onClose={() => setIsGenderModalOpen(false)}
        onConfirm={handleConfirmStartNew}
        title={language === 'fr' ? 'Démarrer une nouvelle discussion' : 'Start a New Discussion'}
        subtitle={
          language === 'fr'
            ? 'Choisissez votre préférence d\'écoutant(e) pour être mis en relation avec la personne la plus adaptée.'
            : 'Select your preferred listener gender to be matched with the most comfortable presence.'
        }
        confirmButtonText={language === 'fr' ? 'Commencer la discussion' : 'Start Conversation'}
      />

      {/* Report Discussion Modal */}
      <ReportDiscussionModal
        isOpen={isReportModalOpen}
        onClose={() => {
          setIsReportModalOpen(false);
          setReportTargetDiscussion(null);
        }}
        discussion={reportTargetDiscussion}
        messages={reportTargetDiscussion?.messages || []}
        currentUser={user}
        onReportSubmitted={() => {
          showToast(
            language === 'fr'
              ? 'Votre signalement a été transmis en toute confidentialité au Responsable des Écoutants.'
              : 'Your report has been securely submitted to the Head of Listeners.'
          );
        }}
      />
    </>
  );
};
