import { useState, useEffect, useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { 
  MessageCircle, 
  Send, 
  ShieldCheck, 
  Sparkles, 
  AlertCircle,
  Clock,
  HeartHandshake,
  GripHorizontal,
  Lock,
  Eye,
  UserPlus,
  ArrowDown
} from 'lucide-react';
import { ChatMessage, ListenerGenderPreference, DiscussionConversation } from '../types';
import { recordLiveDiscussionMessage, getStoredDiscussions } from '../utils/discussionManagement';
import { GenderPreferenceTag } from './GenderPreferenceTag';
import { ConversationParticipantBar } from './ConversationParticipantBar';

interface AnonymousChatWidgetProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose?: () => void; // Reserved for team-side management
  onOpenSignUp?: () => void;
  genderPreference?: ListenerGenderPreference;
  onChangeGenderPreference?: () => void;
}

export const AnonymousChatWidget = ({
  isOpen,
  onOpen,
  onOpenSignUp,
  genderPreference = 'any',
  onChangeGenderPreference,
}: AnonymousChatWidgetProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [hasInitialized, setHasInitialized] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [attentionStatus, setAttentionStatus] = useState<'reading' | 'typing' | null>(null);
  const [activeListenerName, setActiveListenerName] = useState<string | null>(null);
  const [currentDiscussion, setCurrentDiscussion] = useState<DiscussionConversation | null>(null);
  const [isClosed, setIsClosed] = useState(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  const widgetRef = useRef<HTMLElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isAtBottomRef = useRef(true);
  const prevMessagesCountRef = useRef(0);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; posX: number; posY: number }>({
    pointerX: 0,
    pointerY: 0,
    posX: 0,
    posY: 0,
  });

  // Set default initial position with proper viewport bounds and comfortable margins
  useEffect(() => {
    if (isOpen && position === null) {
      const updateInitialPosition = () => {
        const estimatedWidth = Math.min(400, window.innerWidth - 24);
        const estimatedHeight = Math.min(540, window.innerHeight - 32);
        const margin = 16;
        const initialX = Math.max(margin, window.innerWidth - estimatedWidth - margin);
        const initialY = Math.max(margin, window.innerHeight - estimatedHeight - margin);
        setPosition({ x: initialX, y: initialY });
      };

      // Slight timeout to allow DOM to measure real rendered size if available
      const timer = setTimeout(() => {
        if (widgetRef.current) {
          const width = widgetRef.current.offsetWidth;
          const height = widgetRef.current.offsetHeight;
          const margin = 16;
          const initialX = Math.max(margin, window.innerWidth - width - margin);
          const initialY = Math.max(margin, window.innerHeight - height - margin);
          setPosition({ x: initialX, y: initialY });
        } else {
          updateInitialPosition();
        }
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [isOpen, position]);

  // Keep widget strictly within visible screen area on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        if (!prev) return prev;
        const widget = widgetRef.current;
        const width = widget ? widget.offsetWidth : 380;
        const height = widget ? widget.offsetHeight : 520;
        const margin = 12;
        const maxX = Math.max(margin, window.innerWidth - width - margin);
        const maxY = Math.max(margin, window.innerHeight - height - margin);
        return {
          x: Math.min(Math.max(margin, prev.x), maxX),
          y: Math.min(Math.max(margin, prev.y), maxY),
        };
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize opening message when opened for the first time
  useEffect(() => {
    if (isOpen && !hasInitialized) {
      setHasInitialized(true);
      const initialSystemMsg: ChatMessage = {
        id: 'init-msg',
        sender: 'system',
        text: 'Start talking, a team member will immediately join you.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([initialSystemMsg]);
      recordLiveDiscussionMessage(
        'disc_anon_live_portal',
        initialSystemMsg,
        'anonymous',
        'Anonymous Live Visitor',
        undefined,
        undefined,
        genderPreference
      );
    }
  }, [isOpen, hasInitialized]);

  // Check whether user/visitor is already near the bottom (within 70px)
  const checkIfAtBottom = () => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distanceFromBottom <= 70;
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

  // Smart auto-scroll: Only scroll down if already near bottom or self-sent message
  useEffect(() => {
    if (!isOpen) return;
    const currentCount = messages?.length || 0;

    // Initial load / opening: jump straight to bottom
    if (prevMessagesCountRef.current === 0 && currentCount > 0) {
      prevMessagesCountRef.current = currentCount;
      scrollToBottom(false);
      return;
    }

    if (currentCount > prevMessagesCountRef.current) {
      prevMessagesCountRef.current = currentCount;
      const lastMessage = messages[currentCount - 1];
      const isSentBySelf = lastMessage?.sender === 'user';

      if (isSentBySelf || isAtBottomRef.current) {
        scrollToBottom(true);
      } else {
        // Visitor is scrolled up reading earlier messages
        setShowScrollBottomBtn(true);
      }
    } else {
      prevMessagesCountRef.current = currentCount;
    }
  }, [messages, isOpen]);

  // When attention status updates, scroll if at bottom
  useEffect(() => {
    if (attentionStatus && isAtBottomRef.current) {
      scrollToBottom(true);
    }
  }, [attentionStatus]);

  // Synchronize discussion state in real-time with listener actions
  useEffect(() => {
    const syncFromStorage = () => {
      const all = getStoredDiscussions();
      const portalDisc = all.find((d) => d.id === 'disc_anon_live_portal');
      if (portalDisc) {
        setCurrentDiscussion(portalDisc);
        if (portalDisc.messages && portalDisc.messages.length > 0) {
          setMessages(portalDisc.messages);
        }
        setIsClosed(portalDisc.status === 'closed');
        setAttentionStatus(portalDisc.listenerAttentionStatus || null);
        setActiveListenerName(portalDisc.openedByListenerName || null);
      } else {
        // Provide a default active state representation if not yet registered in stored discussions
        setCurrentDiscussion({
          id: 'disc_anon_live_portal',
          userId: 'anon_live_visitor',
          userName: 'Anonymous Visitor',
          startedAt: 'Just now',
          type: 'anonymous',
          status: 'unopened',
          messages: messages,
          genderPreference: genderPreference,
        });
      }
    };

    syncFromStorage();
    const handleSync = () => syncFromStorage();
    window.addEventListener('3awdli_discussion_sync', handleSync);
    window.addEventListener('storage', handleSync);
    const interval = setInterval(syncFromStorage, 1000);

    return () => {
      window.removeEventListener('3awdli_discussion_sync', handleSync);
      window.removeEventListener('storage', handleSync);
      clearInterval(interval);
    };
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isClosed) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, isClosed]);

  // Draggable header logic using Pointer Events with viewport bounds clamping
  const handleHeaderPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return; // Only primary mouse button or touch
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, a')) return;

    const widget = widgetRef.current;
    if (!widget) return;

    const currentRect = widget.getBoundingClientRect();
    const currentX = position ? position.x : currentRect.left;
    const currentY = position ? position.y : currentRect.top;

    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      posX: currentX,
      posY: currentY,
    };

    setIsDragging(true);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - dragStartRef.current.pointerX;
      const deltaY = moveEvent.clientY - dragStartRef.current.pointerY;

      const width = widget.offsetWidth;
      const height = widget.offsetHeight;
      const margin = 12;

      const maxX = Math.max(margin, window.innerWidth - width - margin);
      const maxY = Math.max(margin, window.innerHeight - height - margin);

      const targetX = dragStartRef.current.posX + deltaX;
      const targetY = dragStartRef.current.posY + deltaY;

      const clampedX = Math.min(Math.max(margin, targetX), maxX);
      const clampedY = Math.min(Math.max(margin, targetY), maxY);

      setPosition({ x: clampedX, y: clampedY });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    recordLiveDiscussionMessage(
      'disc_anon_live_portal',
      userMessage,
      'anonymous',
      'Anonymous Live Visitor',
      undefined,
      undefined,
      genderPreference
    );
    scrollToBottom(true);

    // Gentle listener acknowledgement after user's first message
    const hasPriorUserMsg = messages.some((m) => m.sender === 'user');
    if (!hasPriorUserMsg) {
      setTimeout(() => {
        const teamResponse: ChatMessage = {
          id: `team-${Date.now()}`,
          sender: 'team',
          senderName: 'Listening Team',
          text: "We hear you, and we're here with you. Take all the time you need to express what you're experiencing.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, teamResponse]);
        recordLiveDiscussionMessage('disc_anon_live_portal', teamResponse, 'anonymous', 'Anonymous Live Visitor');
      }, 2500);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickPrompts = [
    "I'm feeling overwhelmed today",
    "I just need someone to listen",
    "Struggling with stress & anxiety",
    "Having a hard time with a relationship",
  ];

  if (!isOpen) {
    return (
      <aside
        id="talk-anonymously-launcher"
        aria-label="Anonymous mental health support chat"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3"
      >
        <button
          onClick={onOpen}
          className="group flex items-center gap-3 px-5 py-3.5 bg-[#315243] hover:bg-[#274236] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#315243]/20 cursor-pointer"
          id="floating-chat-trigger"
          title="Talk Anonymously with 3awdli"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
          </span>
          <MessageCircle className="w-5 h-5 transition-transform group-hover:scale-110" />
          <span className="font-medium text-sm tracking-wide">Talk Anonymously</span>
        </button>
      </aside>
    );
  }

  return (
    <aside
      ref={widgetRef}
      id="anonymous-chat-window"
      aria-label="Anonymous mental health support chat"
      style={
        position
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
              bottom: 'auto',
              right: 'auto',
            }
          : undefined
      }
      className={`fixed z-50 w-[calc(100vw-1.5rem)] sm:w-[380px] max-w-[400px] h-[780px] min-h-[500px] max-h-[min(90vh,820px)] flex flex-col transition-shadow duration-200 ${
        isDragging ? 'shadow-2xl opacity-95' : 'shadow-2xl'
      } ${position ? '' : 'bottom-6 right-4 sm:bottom-8 sm:right-6'}`}
    >
      <div className="bg-[#FAF8F5] border border-[#E0D9CD] rounded-2xl overflow-hidden flex flex-col h-full shadow-xl">
        {/* DRAGGABLE HEADER: User can click & drag anywhere on this bar to reposition */}
        <header
          id="chat-header-drag-handle"
          onPointerDown={handleHeaderPointerDown}
          style={{ touchAction: 'none' }}
          className={`bg-[#315243] text-white px-4 py-3 shrink-0 flex items-center justify-between select-none transition-colors ${
            isDragging ? 'cursor-grabbing bg-[#294639]' : 'cursor-grab hover:bg-[#2d4b3d]'
          }`}
          title="Click and drag to move chat window"
        >
          <div className="flex items-center gap-2.5 pointer-events-none">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-emerald-200 shrink-0">
              <HeartHandshake className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs sm:text-sm font-semibold tracking-wide">3awdli Anonymous Ear</h3>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9.5px] font-medium bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  Active
                </span>
              </div>
              <p className="text-[10.5px] text-emerald-100/80 flex items-center gap-1 leading-tight">
                <ShieldCheck className="w-3 h-3 text-emerald-300 shrink-0" />
                100% Confidential
              </p>
            </div>
          </div>

          {/* Right Header Status & Drag Cue (NO close button for users) */}
          <div className="flex items-center gap-2">
            <div 
              className="flex items-center gap-1 bg-black/15 text-emerald-200/90 px-2 py-1 rounded-lg text-[10.5px] border border-white/10 font-medium select-none pointer-events-none"
              title="Only a 3awdli team member can conclude this conversation"
            >
              <Lock className="w-3 h-3 text-emerald-300" />
              <span className="hidden sm:inline">Team Active</span>
            </div>
            <div 
              className="flex items-center gap-1 text-emerald-200/70 p-1 rounded hover:text-white"
              title="Click and drag header to move"
            >
              <GripHorizontal className="w-4 h-4" />
            </div>
          </div>
        </header>

        {/* Dynamic Participants Bar (User, Active Listener, Co-Listener, Excluded Profile) */}
        {currentDiscussion && (
          <ConversationParticipantBar discussion={currentDiscussion} />
        )}

        {/* Disclaimer & team standby banner - Fixed below header */}
        <div className="bg-[#F1EFEA] border-b border-[#E6E1D8] px-3.5 py-1.5 text-[11px] text-[#556059] flex items-center justify-between shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Psychologists &amp; Students on standby
          </span>
          <span className="text-[10px] text-[#7A867E]">Identity masked</span>
        </div>

        {/* Visitor Listener Preference Tag & Change Control */}
        <div className="bg-[#FAF7F2] border-b border-[#EAE3D6] px-3.5 py-1.5 text-[11px] text-[#556059] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10.5px] text-[#76877E]">Preference:</span>
            <GenderPreferenceTag preference={genderPreference} />
          </div>
          {onChangeGenderPreference && (
            <button
              id="change-anon-gender-pref-btn"
              type="button"
              onClick={onChangeGenderPreference}
              className="text-[10.5px] font-semibold text-[#294B39] hover:text-[#183425] hover:underline cursor-pointer"
            >
              Change
            </button>
          )}
        </div>

        {/* Scrollable Middle Area: Messages + Quick Starter Chips */}
        <div className="relative flex-1 min-h-0 flex flex-col">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-[#FAF8F5] text-[#2C332F]"
          >
            {messages.map((msg) => {
            if (msg.sender === 'system') {
              return (
                <div key={msg.id} className="flex flex-col items-center my-2">
                  <div className="bg-[#EBF2EE] border border-[#D3E3DA] text-[#28493A] text-xs px-3.5 py-2.5 rounded-xl shadow-2xs max-w-[95%] text-center">
                    <div className="flex items-center justify-center gap-1.5 font-medium mb-0.5 text-emerald-800">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Confidential Session Started</span>
                    </div>
                    <p className="text-[12.5px] leading-relaxed text-[#233E32] font-normal">
                      {msg.text}
                    </p>
                  </div>
                  <span className="text-[10px] text-[#869289] mt-1 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {msg.timestamp}
                  </span>
                </div>
              );
            }

            if (msg.sender === 'team') {
              return (
                <div key={msg.id} className="flex flex-col items-start space-y-1 max-w-[88%]">
                  <div className="flex items-center gap-1.5 text-[11px] text-[#2C5645] font-semibold pl-1">
                    <span>{msg.senderName || activeListenerName || '3awdli Team Listener'}</span>
                  </div>
                  <div className="bg-[#EAF4F3] border border-[#BCE1DB] text-[#113B37] text-xs px-3.5 py-2.5 rounded-2xl rounded-tl-xs shadow-2xs leading-relaxed">
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-[#7A8E82] pl-1">{msg.timestamp}</span>
                </div>
              );
            }

            return (
              <div key={msg.id} className="flex flex-col items-end space-y-1 ml-auto max-w-[88%]">
                <div className="bg-[#315243] text-white text-xs px-3.5 py-2.5 rounded-2xl rounded-tr-xs shadow-2xs leading-relaxed">
                  {msg.text}
                </div>
                <span className="text-[10px] text-[#869289] pr-1">{msg.timestamp}</span>
              </div>
            );
          })}

          {/* Attention Status Indicators */}
          {attentionStatus === 'typing' && !isClosed && (
            <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-[#EAF4F3] border border-[#BDE0DB] text-[#113B37] w-fit text-xs animate-in fade-in shadow-2xs">
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce delay-100"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce delay-200"></span>
              </span>
              <span className="font-medium text-xs">{activeListenerName || 'Listener'} is typing...</span>
            </div>
          )}

          {attentionStatus === 'reading' && !isClosed && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#305748] bg-[#F2F7F4] border border-[#CCE0D6] px-3 py-1.5 rounded-xl w-fit animate-in fade-in">
              <Eye className="w-3.5 h-3.5 text-emerald-600" />
              <span>Reading your message</span>
            </div>
          )}

          {/* Closed Conversation Notification */}
          {isClosed && (
            <div className="bg-[#FAF6F0] border border-[#E5DCD0] rounded-2xl p-4 text-center space-y-2.5 my-2.5 shadow-2xs animate-in fade-in">
              <div className="w-9 h-9 rounded-full bg-[#EAE2D5] text-[#5F4F3D] flex items-center justify-center mx-auto">
                <HeartHandshake className="w-4.5 h-4.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#23382D]">This conversation has ended</h4>
                <p className="text-xs text-[#5C6E64] mt-1 leading-relaxed">
                  This conversation has ended. If you&apos;d like to keep talking whenever you need to, you can create a free account to save your conversations.
                </p>
              </div>
              {onOpenSignUp && (
                <button
                  id="chat-closed-create-account-btn"
                  onClick={onOpenSignUp}
                  className="px-4 py-2 bg-[#315243] hover:bg-[#253E33] text-white text-xs font-semibold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create a Free Account</span>
                </button>
              )}
            </div>
          )}

          {/* Quick starter chips (if only system message is present and not closed) inside scroll area */}
          {messages.length <= 1 && !isClosed && (
            <div className="pt-2">
              <p className="text-[11px] text-[#69756E] mb-1.5 font-medium">Not sure how to begin? Tap an idea:</p>
              <div className="flex flex-wrap gap-1.5">
                {quickPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    id={`chat-prompt-chip-${idx}`}
                    onClick={() => handleSendMessage(prompt)}
                    className="text-[11px] bg-white hover:bg-[#E9F0EB] text-[#344E41] border border-[#DDD7CC] hover:border-[#315243]/30 px-2.5 py-1 rounded-full transition-colors text-left cursor-pointer"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Floating "New messages below" indicator when scrolled up */}
        {showScrollBottomBtn && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 bg-[#315243] hover:bg-[#253E33] text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg border border-white/20 flex items-center gap-1.5 cursor-pointer animate-in fade-in slide-in-from-bottom-2 transition-transform hover:scale-105"
          >
            <span>New messages below</span>
            <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
          </button>
        )}
      </div>

        {/* Input Footer - ALWAYS VISIBLE, FIXED AT BOTTOM */}
        <div className="p-3 sm:p-3.5 bg-white border-t border-[#E3DDD1] shadow-2xs shrink-0">
          {isClosed ? (
            <div className="space-y-2 py-1">
              <div className="bg-[#FAF7F2] border border-[#E9E2D5] rounded-xl p-2.5 text-xs text-[#56685D] text-center leading-relaxed">
                This conversation is concluded. Sign up for a free account to start and preserve new conversations anytime.
              </div>
              {onOpenSignUp && (
                <button
                  onClick={onOpenSignUp}
                  className="w-full py-2.5 px-4 bg-[#315243] hover:bg-[#253E33] text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create a Free Account</span>
                </button>
              )}
            </div>
          ) : (
            <>
              <label
                htmlFor="chat-message-input"
                className="block text-[11px] font-semibold text-[#2D4537] mb-1.5 flex items-center justify-between"
              >
                <span>Describe your problem or what you&apos;re going through:</span>
                <span className="text-[10px] text-[#78887F] font-normal hidden sm:inline">Press Enter to send</span>
              </label>
              <div className="flex items-center gap-2 bg-[#F8F6F1] border-2 border-[#D5CFC3] focus-within:border-[#315243] focus-within:bg-white rounded-xl px-3 py-1.5 sm:py-2 transition-all">
                <input
                  ref={inputRef}
                  id="chat-message-input"
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message here..."
                  className="w-full bg-transparent text-xs sm:text-sm text-[#1E2B23] placeholder-[#818E85] outline-none font-medium"
                />
                <button
                  id="chat-send-btn"
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim()}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    inputText.trim()
                      ? 'bg-[#315243] text-white hover:bg-[#253F33] shadow-2xs'
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  }`}
                  aria-label="Send message"
                >
                  <span>Send</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}

          {/* Safety & Team Session notice */}
          <div className="mt-2 space-y-1">
            <div className="text-[10px] text-[#78847C] flex items-center justify-between px-0.5 leading-tight">
              <span className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                Not for emergencies. In danger, call emergency services.
              </span>
            </div>
            <div className="text-[9.5px] text-[#8C9890] flex items-center justify-between px-0.5 border-t border-[#F2EEE8] pt-1">
              <span>Drag top bar to reposition</span>
              <span className="italic">Session managed by 3awdli team</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

