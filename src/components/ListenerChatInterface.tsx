import { useState, useEffect, useRef, KeyboardEvent, ChangeEvent } from 'react';
import {
  ArrowLeft,
  ArrowDown,
  X,
  Send,
  User,
  UserX,
  Clock,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Eye,
  Heart,
  MessageSquare,
  Lock,
  RefreshCw,
  Archive,
  Share2,
  Flag,
  MoreVertical
} from 'lucide-react';
import { DiscussionConversation, UserAccount, ChatMessage } from '../types';
import { ShareConversationModal } from './ShareConversationModal';
import { ReportDiscussionModal } from './ReportDiscussionModal';
import { ListenerGenderIcon } from './ListenerGenderDisplay';
import { GenderPreferenceTag } from './GenderPreferenceTag';
import { ConversationParticipantBar } from './ConversationParticipantBar';
import { VoiceCallOverlay, CallButton } from './VoiceCallOverlay';
import { getShareRequestsForDiscussion } from '../utils/shareManagement';
import { 
  getVisibleMessagesForListener, 
  isListenerExcludedFromDiscussion 
} from '../utils/discussionManagement';
import { useLanguage } from '../context/LanguageContext';

interface ListenerChatInterfaceProps {
  discussion: DiscussionConversation;
  currentListener: UserAccount;
  onBack: () => void;
  onSendMessage: (text: string) => void;
  onCloseDiscussion: (discussionId: string) => void;
  onUpdateAttention: (status: 'reading' | 'typing' | 'idle') => void;
}

export const ListenerChatInterface = ({
  discussion,
  currentListener,
  onBack,
  onSendMessage,
  onCloseDiscussion,
  onUpdateAttention,
}: ListenerChatInterfaceProps) => {
  const { language } = useLanguage();
  const [inputText, setInputText] = useState('');
  const [isConfirmCloseModalOpen, setIsConfirmCloseModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareRequestsCount, setShareRequestsCount] = useState(() => getShareRequestsForDiscussion(discussion.id).length);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportPreselectedMsgId, setReportPreselectedMsgId] = useState<string | null>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isTypingLocally, setIsTypingLocally] = useState(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close more menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    if (isMoreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMoreMenuOpen]);

  // Check exclusion status for current listener
  const exclusionRecord = isListenerExcludedFromDiscussion(discussion, currentListener.id);
  const isExcluded = Boolean(exclusionRecord);

  // Visible messages filtered by exclusion timestamp
  const visibleMessages = getVisibleMessagesForListener(discussion, currentListener.id);

  // Sync share requests count
  useEffect(() => {
    const updateCount = () => {
      setShareRequestsCount(getShareRequestsForDiscussion(discussion.id).length);
    };
    updateCount();
    window.addEventListener('3awdli_share_request_created', updateCount);
    window.addEventListener('3awdli_share_request_updated', updateCount);
    window.addEventListener('storage', updateCount);
    return () => {
      window.removeEventListener('3awdli_share_request_created', updateCount);
      window.removeEventListener('3awdli_share_request_updated', updateCount);
      window.removeEventListener('storage', updateCount);
    };
  }, [discussion.id]);

  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isAtBottomRef = useRef(true);
  const prevMessagesCountRef = useRef(0);

  const isClosed = discussion.status === 'closed';

  const onUpdateAttentionRef = useRef(onUpdateAttention);
  useEffect(() => {
    onUpdateAttentionRef.current = onUpdateAttention;
  }, [onUpdateAttention]);

  // Inform backend/storage that listener is currently reading this discussion
  useEffect(() => {
    if (!isClosed) {
      onUpdateAttentionRef.current('reading');
    }

    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
      onUpdateAttentionRef.current('idle');
    };
  }, [discussion.id, isClosed]);

  // Check whether listener is already near the bottom (within 80px)
  const checkIfAtBottom = () => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distanceFromBottom <= 80;
  };

  const handleScroll = () => {
    const atBottom = checkIfAtBottom();
    isAtBottomRef.current = atBottom;
    if (atBottom) {
      setShowScrollBottomBtn(false);
    }
  };

  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
      isAtBottomRef.current = true;
      setShowScrollBottomBtn(false);
    }
  };

  // Smart auto scroll: Only scroll down if listener was already near bottom or sent a message
  useEffect(() => {
    const currentCount = discussion.messages?.length || 0;

    // Initial mount / discussion load: jump straight to the bottom
    if (prevMessagesCountRef.current === 0 && currentCount > 0) {
      prevMessagesCountRef.current = currentCount;
      scrollToBottom(false);
      return;
    }

    if (currentCount > prevMessagesCountRef.current) {
      prevMessagesCountRef.current = currentCount;
      const lastMessage = discussion.messages[currentCount - 1];
      const isSentBySelf = lastMessage?.sender === 'team';

      if (isSentBySelf || isAtBottomRef.current) {
        scrollToBottom(true);
      } else {
        // Scrolled up reading earlier history: preserve position and show jump button
        setShowScrollBottomBtn(true);
      }
    } else {
      prevMessagesCountRef.current = currentCount;
    }
  }, [discussion.messages?.length]);

  // Handle typing detection
  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (isClosed) return;

    if (!isTypingLocally && val.trim().length > 0) {
      setIsTypingLocally(true);
      onUpdateAttention('typing');
    }

    // Reset typing debounce
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = setTimeout(() => {
      setIsTypingLocally(false);
      onUpdateAttention('reading');
    }, 2200);
  };

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed || isClosed) return;

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    setIsTypingLocally(false);
    onUpdateAttention('reading');

    onSendMessage(trimmed);
    setInputText('');
    scrollToBottom(true);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleConfirmClose = () => {
    setIsConfirmCloseModalOpen(false);
    onCloseDiscussion(discussion.id);
  };

  return (
    <div className="bg-white border border-[#DDD7CB] rounded-3xl shadow-xl overflow-hidden flex flex-col w-full h-[88vh] min-h-[720px] max-h-[1050px]">
      {/* Header */}
      <header className="bg-[#264134] text-white px-3 sm:px-4 md:px-5 py-2 flex items-center justify-between border-b border-[#1E352A] shrink-0 gap-2 sm:gap-3 relative box-border">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 mr-1 rtl:mr-0 rtl:ml-1">
          <button
            id="listener-back-to-list-btn"
            onClick={onBack}
            className="h-7 w-7 rounded-lg bg-white/10 hover:bg-white/20 text-emerald-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title={language === 'ar' ? 'العودة إلى المحادثات' : language === 'fr' ? 'Retour aux discussions' : 'Return to Discussions'}
          >
            <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-nowrap">
              <span className="font-semibold text-xs sm:text-sm tracking-tight font-['Lora',serif] truncate max-w-[120px] xs:max-w-[180px] sm:max-w-[280px] md:max-w-[400px] lg:max-w-[550px]">
                {discussion.type === 'anonymous' 
                  ? (language === 'ar' ? 'دعم زائر مجهول الهوية' : language === 'fr' ? 'Soutien visiteur anonyme' : 'Anonymous Visitor Support') 
                  : (language === 'ar' ? `محادثة مع ${discussion.userName || 'عضو'}` : language === 'fr' ? `Discussion avec ${discussion.userName || 'Membre'}` : `Discussion with ${discussion.userName || 'Member'}`)}
              </span>
              {discussion.type === 'anonymous' ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-900/60 text-indigo-200 border border-indigo-400/30 shrink-0">
                  <UserX className="w-2.5 h-2.5" />
                  {language === 'ar' ? 'مجهول' : language === 'fr' ? 'Anonyme' : 'Anonymous'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-900/60 text-sky-200 border border-sky-400/30 shrink-0">
                  <User className="w-2.5 h-2.5" />
                  {language === 'ar' ? 'مسجل' : language === 'fr' ? 'Inscrit' : 'Registered'}
                </span>
              )}
              {isClosed && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-stone-700/80 text-stone-200 border border-stone-500/30 shrink-0">
                  <Archive className="w-2.5 h-2.5" />
                  {language === 'ar' ? 'جلسة مغلقة' : language === 'fr' ? 'Session fermée' : 'Closed Session'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[10px] text-emerald-100/75 mt-0.5 truncate">
              <span className="flex items-center gap-1 shrink-0">
                <Clock className="w-2.5 h-2.5 text-emerald-300" />
                {language === 'ar' ? 'بدأت:' : language === 'fr' ? 'Début :' : 'Started:'} {discussion.startedAt}
              </span>
              {discussion.userEmail && (
                <span className="hidden sm:inline text-emerald-200/90 truncate">&bull; {discussion.userEmail}</span>
              )}
            </div>
          </div>
        </div>

        {/* Action Toolbar: Call + Share + Report + End Discussion + More (⋮) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 justify-end ml-auto">
          {!isClosed && !isExcluded && (
            <CallButton
              discussion={discussion}
              currentRole="listener"
              currentUserId={currentListener.id}
              currentUserName={currentListener.name}
              compact={true}
            />
          )}

          {!isExcluded && (
            <button
              id="listener-share-conversation-btn"
              onClick={() => setIsShareModalOpen(true)}
              className="relative h-7 w-7 rounded-lg bg-white/10 hover:bg-white/20 text-emerald-100 hover:text-white border border-white/20 transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
              title={language === 'ar' ? 'مشاركة هذه المحادثة مع الزملاء أو المشرفين' : language === 'fr' ? 'Partager cette discussion' : 'Share this conversation with colleagues or supervisors'}
            >
              <Share2 className="w-3 h-3 text-emerald-300 shrink-0" />
              {shareRequestsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 text-[#132A1F] text-[9px] font-bold flex items-center justify-center shrink-0">
                  {shareRequestsCount}
                </span>
              )}
            </button>
          )}

          {/* Quick Direct Report Button on Desktop */}
          <button
            id="listener-header-report-btn"
            type="button"
            onClick={() => {
              setReportPreselectedMsgId(null);
              setIsReportModalOpen(true);
            }}
            className="h-7 px-2 py-0.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 hover:text-white border border-amber-400/30 transition-all cursor-pointer flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap shrink-0 active:scale-95"
            title={language === 'ar' ? 'إبلاغ مسؤول المستمعين' : language === 'fr' ? 'Signaler cette discussion' : 'Report to Head of Listeners'}
          >
            <Flag className="w-3 h-3 text-amber-300 shrink-0" />
            <span className="hidden sm:inline">{language === 'ar' ? 'إبلاغ' : language === 'fr' ? 'Signaler' : 'Report'}</span>
          </button>

          {!isClosed && !isExcluded && (
            <button
              id="listener-end-discussion-x-btn"
              onClick={() => setIsConfirmCloseModalOpen(true)}
              className="h-7 w-7 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 hover:text-white border border-rose-400/30 transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
              title={language === 'ar' ? 'إنهاء هذه المحادثة' : language === 'fr' ? 'Terminer cette discussion' : 'End this conversation'}
            >
              <X className="w-3 h-3 text-rose-300 shrink-0" />
            </button>
          )}

          {/* More Options Menu (⋮) */}
          <div className="relative" ref={moreMenuRef}>
            <button
              id="listener-more-options-btn"
              type="button"
              onClick={() => setIsMoreMenuOpen((prev) => !prev)}
              className={`h-7 w-7 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0 border ${
                isMoreMenuOpen
                  ? 'bg-white/25 text-white border-white/40 shadow-xs'
                  : 'bg-white/10 hover:bg-white/20 text-emerald-100 hover:text-white border-white/20 active:scale-95'
              }`}
              title={language === 'ar' ? 'خيارات إضافية' : language === 'fr' ? 'Plus d\'options' : 'More options'}
              aria-label="More options"
              aria-expanded={isMoreMenuOpen}
            >
              <MoreVertical className="w-3 h-3" />
            </button>

            {isMoreMenuOpen && (
              <div 
                id="listener-more-options-dropdown"
                className="absolute right-0 rtl:right-auto rtl:left-0 top-full mt-2 w-56 sm:w-60 bg-white text-[#1C3227] rounded-2xl shadow-xl border border-[#E3DDD1] py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
              >
                <button
                  id="listener-more-report-btn"
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    setReportPreselectedMsgId(null);
                    setIsReportModalOpen(true);
                  }}
                  className="w-full px-3.5 py-2.5 text-start flex items-center gap-2.5 hover:bg-rose-50 text-xs font-semibold text-rose-700 transition-colors cursor-pointer"
                >
                  <Flag className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>
                    {language === 'ar' 
                      ? 'إبلاغ مسؤول المستمعين' 
                      : language === 'fr' 
                      ? 'Signaler cette discussion' 
                      : 'Report to Head of Listeners'}
                  </span>
                </button>

                {!isExcluded && (
                  <button
                    id="listener-more-share-btn"
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      setIsShareModalOpen(true);
                    }}
                    className="w-full px-3.5 py-2.5 text-start flex items-center gap-2.5 hover:bg-[#F2ECE3] text-xs font-medium text-[#2E4A3A] transition-colors cursor-pointer sm:hidden"
                  >
                    <Share2 className="w-4 h-4 text-[#3C6450] shrink-0" />
                    <span>
                      {language === 'ar' 
                        ? 'مشاركة المحادثة' 
                        : language === 'fr' 
                        ? 'Partager la discussion' 
                        : 'Share Conversation'}
                    </span>
                  </button>
                )}

                {isClosed && (
                  <div className="px-3.5 py-2 text-[11px] text-[#69796F] border-t border-[#EAE4D9]">
                    {language === 'ar' ? 'تم إغلاق هذه الجلسة وأرشفتها.' : language === 'fr' ? 'Cette session est fermée et archivée.' : 'This session is closed and archived.'}
                  </div>
                )}
              </div>
            )}
          </div>

          {isExcluded && (
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-900/40 text-amber-200 border border-amber-500/30 text-xs font-medium shrink-0">
              <Lock className="w-3 h-3 text-amber-300" />
              <span>{language === 'ar' ? 'تم التحويل' : language === 'fr' ? 'Transfert' : 'Handover'}</span>
            </div>
          )}
        </div>
      </header>

      {/* Real-time Voice Call Overlay (Incoming Modal / Ringing Banner / Active In-Call Screen) */}
      <VoiceCallOverlay
        discussion={discussion}
        currentRole="listener"
        currentUserId={currentListener.id}
        currentUserName={currentListener.name}
      />

      {/* Participant transparency bar */}
      <ConversationParticipantBar discussion={discussion} />

      {/* Sub-header Banner: Listener Identity, Profession, Gender & Visitor Preference */}
      <div className="bg-[#FAF7F2] border-b border-[#EAE3D6] px-4 py-2 flex items-center justify-between text-xs text-[#526359] shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-2 truncate">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <div className="flex items-center gap-1.5 truncate">
            <span className="truncate">
              Responding as <strong className="text-[#203D2E]">{currentListener.name}</strong> ({currentListener.profession || 'Listener Team'})
            </span>
            <ListenerGenderIcon gender={currentListener.gender || 'Male'} />
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[#76877E] shrink-0">
          <GenderPreferenceTag preference={discussion.genderPreference} />
          <span className="hidden sm:inline-flex items-center gap-1 text-[#76877E]">
            <Heart className="w-3 h-3 text-rose-500 fill-rose-500/20" />
            Confidential
          </span>
        </div>
      </div>

      {/* Messages Scroll Area with Smart Auto-Scroll and Floating Jump Button */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          id="listener-chat-messages-scroll"
          className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-[#FDFCFA]"
        >
          {/* Exclusion Notice Banner at top of chat if this listener was handed over */}
          {isExcluded && (
            <div className="p-4 rounded-2xl bg-[#FBF3EE] border border-[#ECD3C8] text-xs text-[#673F33] flex items-start gap-3 shadow-2xs">
              <Lock className="w-4 h-4 text-[#A84934] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-[#572E24]">
                  Handover Completed &bull; Privacy Protection Active
                </span>
                <p className="mt-0.5 text-[11.5px] text-[#694236] leading-relaxed">
                  This conversation was transferred to <strong>{exclusionRecord?.newListenerName || 'another listener'}</strong> on {exclusionRecord?.excludedAt}. 
                  To preserve user privacy going forward, you can review the messages recorded prior to your handover, but you cannot view subsequent new replies or send messages.
                </p>
              </div>
            </div>
          )}

          {visibleMessages.map((msg) => {
            if (msg.sender === 'system') {
              return (
                <div key={msg.id} className="flex flex-col items-center my-2">
                  <div className="bg-[#F2ECE1] border border-[#E0D7C9] text-[#3D4C44] text-xs px-3.5 py-2 rounded-2xl max-w-[90%] text-center shadow-2xs">
                    <div className="flex items-center justify-center gap-1.5 font-semibold text-[#294235] mb-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                      <span>System Session Update</span>
                    </div>
                    <p className="text-[11.5px] leading-relaxed text-[#35483E]">{msg.text}</p>
                  </div>
                  <span className="text-[10px] text-[#8C9890] mt-1 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {msg.timestamp}
                  </span>
                </div>
              );
            }

            if (msg.sender === 'user') {
              // Visitor / User message bubble
              return (
                <div key={msg.id} className="group flex flex-col items-start max-w-[88%] space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#445E50] ps-1">
                    {discussion.type === 'anonymous' ? (
                      <span className="flex items-center gap-1 text-indigo-700">
                        <UserX className="w-3 h-3" />
                        {language === 'ar' ? 'زائر مجهول الهوية' : language === 'fr' ? 'Visiteur anonyme' : 'Anonymous Visitor'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-teal-800">
                        <User className="w-3 h-3" />
                        {discussion.userName || (language === 'ar' ? 'عضو مسجل' : language === 'fr' ? 'Membre inscrit' : 'Registered Member')}
                      </span>
                    )}
                  </div>
                  <div className="bg-[#F6F2E9] border border-[#DDD3C2] text-[#1E2E25] text-xs sm:text-sm px-4 py-2.5 rounded-2xl rtl:rounded-tr-xs ltr:rounded-tl-xs shadow-2xs leading-relaxed">
                    {msg.text}
                  </div>
                  <div className="flex items-center gap-2 ps-1">
                    <span className="text-[10px] text-[#86958B]">{msg.timestamp}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setReportPreselectedMsgId(msg.id);
                        setIsReportModalOpen(true);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-stone-400 hover:text-rose-600 flex items-center gap-0.5 cursor-pointer"
                      title={language === 'ar' ? 'إبلاغ مسؤول المستمعين عن هذه الرسالة' : language === 'fr' ? 'Signaler ce message' : 'Report this message to Head of Listeners'}
                    >
                      <Flag className="w-2.5 h-2.5" />
                      <span>{language === 'ar' ? 'إبلاغ' : language === 'fr' ? 'Signaler' : 'Report'}</span>
                    </button>
                  </div>
                </div>
              );
            }

            // Listener's sent message
            return (
              <div key={msg.id} className="group flex flex-col items-end ms-auto max-w-[88%] space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#184844] pe-1">
                  <span className="flex items-center gap-1">
                    <Heart className="w-3 h-3 text-emerald-700 fill-emerald-600/20" />
                    {msg.senderName || currentListener.name}
                    {msg.senderName === currentListener.name && (language === 'ar' ? ' (أنت)' : language === 'fr' ? ' (Vous)' : ' (You)')}
                  </span>
                </div>
                <div className="bg-[#EAF4F3] border border-[#BDE0DC] text-[#113B37] text-xs sm:text-sm px-4 py-2.5 rounded-2xl rtl:rounded-tl-xs ltr:rounded-tr-xs shadow-2xs leading-relaxed font-medium">
                  {msg.text}
                </div>
                <div className="flex items-center gap-2 pe-1">
                  <button
                    type="button"
                    onClick={() => {
                      setReportPreselectedMsgId(msg.id);
                      setIsReportModalOpen(true);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-stone-400 hover:text-rose-600 flex items-center gap-0.5 cursor-pointer"
                    title={language === 'ar' ? 'إبلاغ مسؤول المستمعين عن هذه الرسالة' : language === 'fr' ? 'Signaler ce message' : 'Report this message to Head of Listeners'}
                  >
                    <Flag className="w-2.5 h-2.5" />
                    <span>{language === 'ar' ? 'إبلاغ' : language === 'fr' ? 'Signaler' : 'Report'}</span>
                  </button>
                  <span className="text-[10px] text-[#86958B]">{msg.timestamp}</span>
                </div>
              </div>
            );
          })}

          {/* Live Typing / Attention Preview */}
          {!isClosed && (
            <div className="pt-1">
              {isTypingLocally ? (
                <div className="flex items-center gap-2 text-xs text-[#2A523E] italic bg-[#EBF5EF] border border-[#D2E7DB] rounded-xl p-2 max-w-sm">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce delay-100"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce delay-200"></span>
                  </span>
                  <span>{language === 'ar' ? 'أنت تكتب رداً (يتم إشعار الزائر)...' : language === 'fr' ? 'Vous écrivez une réponse...' : 'You are typing a reply (visitor is notified)...'}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[11px] text-[#55695E] bg-[#FAF7F0] border border-[#EBE4D8] rounded-xl px-2.5 py-1 w-fit">
                  <Eye className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{language === 'ar' ? 'الزائر يرى: ' : language === 'fr' ? 'Le visiteur voit : ' : 'Visitor sees: '}<em>{language === 'ar' ? '«يقرأ رسالتك»' : language === 'fr' ? '« Lit votre message »' : '«Reading your message»'}</em></span>
                </div>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Floating "New message" jump button when scrolled up */}
        {showScrollBottomBtn && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 bg-[#264134] hover:bg-[#1C3227] text-white text-xs font-semibold px-3.5 py-1.5 rounded-full shadow-lg border border-white/20 flex items-center gap-1.5 cursor-pointer animate-in fade-in slide-in-from-bottom-2 transition-transform hover:scale-105"
          >
            <span>New messages below</span>
            <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
          </button>
        )}
      </div>

      {/* Input or Closed Notice Footer */}
      <div className="p-3 sm:p-3.5 bg-white border-t border-[#E3DDD1] shrink-0">
        {isExcluded ? (
          <div className="p-3.5 rounded-2xl bg-[#FAF5F0] border border-[#ECDCCF] text-center space-y-1">
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#6D3425]">
              <Lock className="w-3.5 h-3.5 text-[#8D3B28]" />
              <span>Handover Completed &bull; Read-Only Past Record</span>
            </div>
            <p className="text-[11px] text-[#714E45] leading-relaxed">
              You were excluded from new messages following handover to <strong>{exclusionRecord?.newListenerName || 'the new listener'}</strong>. 
              Only messages sent prior to your handover remain accessible to preserve member confidentiality.
            </p>
          </div>
        ) : isClosed ? (
          <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E5DFD5] text-center space-y-1">
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#32493C]">
              <Archive className="w-3.5 h-3.5 text-stone-600" />
              <span>{language === 'ar' ? 'اكتملت هذه المحادثة ونُقلت إلى الأرشيف.' : language === 'fr' ? 'Cette discussion est terminée et archivée.' : 'This discussion was completed and moved to archives.'}</span>
            </div>
            <p className="text-[11px] text-[#718278]">
              {language === 'ar' ? 'عرض للقراءة فقط. سيتم إعادة توجيه المستخدم إلى مستمع نشط إذا أرسل رسالة جديدة.' : language === 'fr' ? 'Lecture seule. L’utilisateur sera redirigé vers des écoutants actifs s’il renvoie un message.' : 'Read-only view. The user will be re-routed to active listeners if they send a new message.'}
            </p>
          </div>
        ) : (
          <div>
            <label htmlFor="listener-chat-textarea" className="sr-only">
              {language === 'ar' ? 'الرد على الزائر' : language === 'fr' ? 'Répondre au visiteur' : 'Reply to visitor'}
            </label>
            <div className="flex items-end gap-2 bg-[#F7F5F0] border border-[#DDD5C7] rounded-2xl p-2.5 focus-within:border-[#264134] focus-within:ring-2 focus-within:ring-[#264134]/20 transition-all">
              <textarea
                id="listener-chat-textarea"
                ref={inputRef}
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder={language === 'ar' ? 'اكتب ردك المتفهم هنا... (اضغط Enter للإرسال، Shift+Enter لسطر جديد)' : language === 'fr' ? 'Écrivez votre réponse empathique ici... (Entrée pour envoyer, Maj+Entrée pour saut de ligne)' : 'Write your empathetic response here... (Enter to send, Shift+Enter for new line)'}
                className="w-full bg-transparent text-xs sm:text-sm text-[#1F2F26] placeholder-[#87968D] outline-none resize-none"
              />
              <button
                id="listener-chat-send-btn"
                onClick={handleSend}
                disabled={!inputText.trim()}
                className={`p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer shrink-0 ${
                  inputText.trim()
                    ? 'bg-[#264134] text-white hover:bg-[#1E352A] shadow-xs'
                    : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                }`}
                title={language === 'ar' ? 'إرسال الرد' : language === 'fr' ? 'Envoyer la réponse' : 'Send reply'}
              >
                <Send className="w-4 h-4 rtl:rotate-180" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-1 text-[10.5px] text-[#7E8E84] px-1">
              <span>{language === 'ar' ? 'اضغط Enter للإرسال' : language === 'fr' ? 'Appuyez sur Entrée pour envoyer' : 'Press Enter to send'}</span>
              <span className="italic">{language === 'ar' ? 'جلسة دعم سرية' : language === 'fr' ? 'Session de soutien confidentielle' : 'Confidential support session'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal to End/Close Discussion */}
      {isConfirmCloseModalOpen && (
        <div 
          id="confirm-close-discussion-modal"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-[#DDD7CB] rounded-3xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header - Fixed */}
            <div className="px-6 py-4 bg-[#FAF7F2] border-b border-[#EAE3D6] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-[#23382D] font-['Lora',serif]">
                  {language === 'ar' ? 'إنهاء المحادثة' : language === 'fr' ? 'Terminer la conversation' : 'End Conversation'}
                </h3>
              </div>
              <button
                onClick={() => setIsConfirmCloseModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                title={language === 'ar' ? 'إلغاء' : language === 'fr' ? 'Annuler' : 'Cancel'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content - Scrollable if needed */}
            <div className="p-6 overflow-y-auto space-y-3.5 text-xs sm:text-sm text-[#46574E]">
              <p className="font-semibold text-[#1C2C24] text-sm sm:text-base">
                {language === 'ar' ? 'هل أنت متأكد من رغبتك في إنهاء هذه المحادثة؟' : language === 'fr' ? 'Êtes-vous sûr de vouloir terminer cette conversation ?' : 'Are you sure you want to end this conversation?'}
              </p>
              <p className="leading-relaxed">
                {language === 'ar' ? 'سيؤدي إنهاء هذه المحادثة إلى اختتام الجلسة النشطة ونقلها إلى قسم المغلقة / السجل الخاص بك.' : language === 'fr' ? 'Mettre fin à cette discussion clôturera la session active et la déplacera dans vos discussions fermées / historiques.' : 'Ending this discussion will conclude the active session and move it into your Closed / History section.'}
              </p>

              {discussion.type === 'anonymous' ? (
                <div className="p-3.5 rounded-2xl bg-[#EEF2FF] border border-[#D5DCFC] text-[#3730A3] space-y-1 text-xs">
                  <span className="font-semibold block">{language === 'ar' ? 'إشعار الزائر (مجهول الهوية):' : language === 'fr' ? 'Avis visiteur (Anonyme) :' : 'Visitor Notice (Anonymous):'}</span>
                  <p className="leading-relaxed text-[#4338CA]">
                    {language === 'ar' ? 'ستتم دعوة الزائر بلطف لإنشاء حساب مجاني إذا كان يرغب في الاحتفاظ بمحادثاته ومتابعتها مستقبلاً.' : language === 'fr' ? 'Le visiteur sera gentiment invité à créer un compte gratuit s’il souhaite conserver ses conversations futures.' : 'The visitor will be gently invited to create a free account if they wish to keep and continue their conversations in the future.'}
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-[#EAF4F3] border border-[#C2E4DF] text-[#13423E] space-y-1 text-xs">
                  <span className="font-semibold block">{language === 'ar' ? 'إشعار العضو (مسجل):' : language === 'fr' ? 'Avis membre (Inscrit) :' : 'Member Notice (Registered):'}</span>
                  <p className="leading-relaxed text-[#164E49]">
                    {language === 'ar' ? 'سيرى العضو ملاحظة مطمئنة بأن محادثته محفوظة في سجله الشخصي. وإذا رد عليها لاحقاً فستعود إليك تلقائياً.' : language === 'fr' ? 'Le membre verra une note rassurante indiquant que sa discussion est enregistrée dans son historique personnel.' : 'The member will see a reassuring note that their discussion is saved in their personal history. If they reply to it later, it will automatically route back to you.'}
                  </p>
                </div>
              )}
            </div>

            {/* Footer - Fixed */}
            <div className="px-6 py-4 bg-[#FAF7F2] border-t border-[#EAE3D6] flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsConfirmCloseModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء' : language === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button
                type="button"
                id="confirm-end-discussion-btn"
                onClick={handleConfirmClose}
                className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'نعم، إنهاء المحادثة' : language === 'fr' ? 'Oui, terminer la conversation' : 'Yes, End Conversation'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Conversation Modal */}
      <ShareConversationModal
        isOpen={isShareModalOpen}
        onClose={() => {
          setIsShareModalOpen(false);
          setShareRequestsCount(getShareRequestsForDiscussion(discussion.id).length);
        }}
        discussion={discussion}
        currentListener={currentListener}
      />

      {/* Report Discussion Modal for Listeners */}
      <ReportDiscussionModal
        isOpen={isReportModalOpen}
        onClose={() => {
          setIsReportModalOpen(false);
          setReportPreselectedMsgId(null);
        }}
        discussion={discussion}
        messages={visibleMessages}
        currentUser={currentListener}
        preSelectedMessageId={reportPreselectedMsgId}
        onReportSubmitted={() => {
          setIsReportModalOpen(false);
          setReportPreselectedMsgId(null);
        }}
      />
    </div>
  );
};
