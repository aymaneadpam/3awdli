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
  Share2
} from 'lucide-react';
import { DiscussionConversation, UserAccount, ChatMessage } from '../types';
import { ShareConversationModal } from './ShareConversationModal';
import { ListenerGenderIcon } from './ListenerGenderDisplay';
import { GenderPreferenceTag } from './GenderPreferenceTag';
import { ConversationParticipantBar } from './ConversationParticipantBar';
import { getShareRequestsForDiscussion } from '../utils/shareManagement';
import { 
  getVisibleMessagesForListener, 
  isListenerExcludedFromDiscussion 
} from '../utils/discussionManagement';

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
  const [inputText, setInputText] = useState('');
  const [isConfirmCloseModalOpen, setIsConfirmCloseModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareRequestsCount, setShareRequestsCount] = useState(() => getShareRequestsForDiscussion(discussion.id).length);
  const [isTypingLocally, setIsTypingLocally] = useState(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

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

  // Inform backend/storage that listener is currently reading this discussion
  useEffect(() => {
    if (!isClosed) {
      onUpdateAttention('reading');
    }

    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
      onUpdateAttention('idle');
    };
  }, [discussion.id, isClosed, onUpdateAttention]);

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
  }, [discussion.messages]);

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

  // Empathetic opening / response chips for listener
  const supportivePrompts = [
    "I am here and I'm listening closely. Take all the time you need.",
    "What you're feeling right now is completely understandable.",
    "You don't have to carry this all alone. Would it help to tell me more about it?",
    "Let's pause together for a moment and take a calm, deep breath."
  ];

  return (
    <div className="bg-white border border-[#DDD7CB] rounded-3xl shadow-lg overflow-hidden flex flex-col w-full h-[820px] min-h-[580px] max-h-[min(90vh,860px)]">
      {/* Header */}
      <header className="bg-[#264134] text-white px-4 sm:px-5 py-3.5 flex items-center justify-between border-b border-[#1E352A] shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            id="listener-back-to-list-btn"
            onClick={onBack}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-100 transition-colors cursor-pointer shrink-0"
            title="Return to discussions list"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-sm sm:text-base tracking-tight font-['Lora',serif] truncate">
                {discussion.type === 'anonymous' ? 'Anonymous Visitor Support' : `Discussion with ${discussion.userName || 'Member'}`}
              </span>
              {discussion.type === 'anonymous' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-900/60 text-indigo-200 border border-indigo-400/30 shrink-0">
                  <UserX className="w-3 h-3" />
                  Anonymous
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-900/60 text-sky-200 border border-sky-400/30 shrink-0">
                  <User className="w-3 h-3" />
                  Registered
                </span>
              )}
              {isClosed && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-700/80 text-stone-200 border border-stone-500/30 shrink-0">
                  <Archive className="w-3 h-3" />
                  Closed Session
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[10.5px] text-emerald-100/75 mt-0.5 truncate">
              <span className="flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3 text-emerald-300" />
                Started: {discussion.startedAt}
              </span>
              {discussion.userEmail && (
                <span className="hidden sm:inline text-emerald-200/90 truncate">&bull; {discussion.userEmail}</span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls: Share Conversation + End Discussion */}
        <div className="flex items-center gap-2 shrink-0">
          {!isExcluded && (
            <button
              id="listener-share-conversation-btn"
              onClick={() => setIsShareModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-100 hover:text-white border border-white/20 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="Share this conversation with colleagues or supervisors"
            >
              <Share2 className="w-3.5 h-3.5 text-emerald-300" />
              <span className="hidden sm:inline">Share</span>
              {shareRequestsCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-emerald-400 text-[#132A1F] text-[10px] font-bold flex items-center justify-center">
                  {shareRequestsCount}
                </span>
              )}
            </button>
          )}

          {!isClosed && !isExcluded && (
            <button
              id="listener-end-discussion-x-btn"
              onClick={() => setIsConfirmCloseModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-red-900/30 hover:bg-red-800/50 text-red-200 hover:text-white border border-red-500/30 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="End this conversation"
            >
              <X className="w-3.5 h-3.5 text-red-300" />
              <span className="hidden sm:inline">End Discussion</span>
            </button>
          )}

          {isExcluded && (
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-900/40 text-amber-200 border border-amber-500/30 text-xs font-medium">
              <Lock className="w-3 h-3 text-amber-300" />
              <span>Handover (Past Record)</span>
            </div>
          )}
        </div>
      </header>

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
                <div key={msg.id} className="flex flex-col items-start max-w-[88%] space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#445E50] pl-1">
                    {discussion.type === 'anonymous' ? (
                      <span className="flex items-center gap-1 text-indigo-700">
                        <UserX className="w-3 h-3" />
                        Anonymous Visitor
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-teal-800">
                        <User className="w-3 h-3" />
                        {discussion.userName || 'Registered Member'}
                      </span>
                    )}
                  </div>
                  <div className="bg-[#F6F2E9] border border-[#DDD3C2] text-[#1E2E25] text-xs sm:text-sm px-4 py-2.5 rounded-2xl rounded-tl-xs shadow-2xs leading-relaxed">
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-[#86958B] pl-1">{msg.timestamp}</span>
                </div>
              );
            }

            // Listener's sent message
            return (
              <div key={msg.id} className="flex flex-col items-end ml-auto max-w-[88%] space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#184844] pr-1">
                  <span className="flex items-center gap-1">
                    <Heart className="w-3 h-3 text-emerald-700 fill-emerald-600/20" />
                    {msg.senderName || currentListener.name}
                    {msg.senderName === currentListener.name && ' (You)'}
                  </span>
                </div>
                <div className="bg-[#EAF4F3] border border-[#BDE0DC] text-[#113B37] text-xs sm:text-sm px-4 py-2.5 rounded-2xl rounded-tr-xs shadow-2xs leading-relaxed font-medium">
                  {msg.text}
                </div>
                <span className="text-[10px] text-[#86958B] pr-1">{msg.timestamp}</span>
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
                  <span>You are typing a reply (visitor is notified)...</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[11px] text-[#55695E] bg-[#FAF7F0] border border-[#EBE4D8] rounded-xl px-2.5 py-1 w-fit">
                  <Eye className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Visitor sees: <em>&quot;Reading your message&quot;</em></span>
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

      {/* Empathetic Prompt Chips for Listener - Compact single horizontal row */}
      {!isClosed && !isExcluded && (
        <div className="px-3.5 py-2 bg-[#F7F4EE] border-t border-[#E8E1D5] shrink-0">
          <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-[#5A6D62] mb-1">
            <Sparkles className="w-3 h-3 text-emerald-700" />
            <span>Supportive opening phrases (tap to insert):</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {supportivePrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setInputText(prompt)}
                className="text-[10.5px] bg-white hover:bg-[#EAF3EE] text-[#294636] border border-[#DCD5C8] hover:border-[#264134]/30 px-2.5 py-1 rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-2xs"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

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
              <span>This discussion was completed and moved to archives.</span>
            </div>
            <p className="text-[11px] text-[#718278]">
              Read-only view. The user will be re-routed to active listeners if they send a new message.
            </p>
          </div>
        ) : (
          <div>
            <label htmlFor="listener-chat-textarea" className="sr-only">
              Reply to visitor
            </label>
            <div className="flex items-end gap-2 bg-[#F7F5F0] border border-[#DDD5C7] rounded-2xl p-2.5 focus-within:border-[#264134] focus-within:ring-2 focus-within:ring-[#264134]/20 transition-all">
              <textarea
                id="listener-chat-textarea"
                ref={inputRef}
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder="Write your empathetic response here... (Enter to send, Shift+Enter for new line)"
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
                title="Send reply"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-1 text-[10.5px] text-[#7E8E84] px-1">
              <span>Press <strong>Enter</strong> to send</span>
              <span className="italic">Confidential support session</span>
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
                  End Conversation
                </h3>
              </div>
              <button
                onClick={() => setIsConfirmCloseModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content - Scrollable if needed */}
            <div className="p-6 overflow-y-auto space-y-3.5 text-xs sm:text-sm text-[#46574E]">
              <p className="font-semibold text-[#1C2C24] text-sm sm:text-base">
                Are you sure you want to end this conversation?
              </p>
              <p className="leading-relaxed">
                Ending this discussion will conclude the active session and move it into your <strong>Closed / History</strong> section.
              </p>

              {discussion.type === 'anonymous' ? (
                <div className="p-3.5 rounded-2xl bg-[#EEF2FF] border border-[#D5DCFC] text-[#3730A3] space-y-1 text-xs">
                  <span className="font-semibold block">Visitor Notice (Anonymous):</span>
                  <p className="leading-relaxed text-[#4338CA]">
                    The visitor will be gently invited to create a free account if they wish to keep and continue their conversations in the future.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-[#EAF4F3] border border-[#C2E4DF] text-[#13423E] space-y-1 text-xs">
                  <span className="font-semibold block">Member Notice (Registered):</span>
                  <p className="leading-relaxed text-[#164E49]">
                    The member will see a reassuring note that their discussion is saved in their personal history. If they reply to it later, it will automatically route back to you.
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
                Cancel
              </button>
              <button
                type="button"
                id="confirm-end-discussion-btn"
                onClick={handleConfirmClose}
                className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Yes, End Conversation</span>
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
    </div>
  );
};
