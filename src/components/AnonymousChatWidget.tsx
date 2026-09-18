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
  ArrowDown,
  Flag,
  X
} from 'lucide-react';
import { ChatMessage, ListenerGenderPreference, DiscussionConversation } from '../types';
import { 
  recordLiveDiscussionMessage, 
  getStoredDiscussions,
  createNewDiscussion,
  getActiveAnonymousDiscussion,
  getActiveAnonymousDiscussionId,
  setActiveAnonymousDiscussionId,
  getActiveUserDiscussion,
  getActiveUserDiscussionId,
  setActiveUserDiscussionId,
  INITIAL_DISCUSSION_SYSTEM_MESSAGE,
  saveStoredDiscussions,
  closeDiscussion,
  clearActiveDiscussionReferences
} from '../utils/discussionManagement';
import { GenderPreferenceTag } from './GenderPreferenceTag';
import { ConversationParticipantBar } from './ConversationParticipantBar';
import { ReportDiscussionModal } from './ReportDiscussionModal';
import { isAnonymousSessionBlocked } from '../utils/anonymousBanManagement';
import { User } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface AnonymousChatWidgetProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose?: () => void; // Reserved for team-side management
  onOpenSignUp?: () => void;
  genderPreference?: ListenerGenderPreference;
  onChangeGenderPreference?: () => void;
  currentUser?: User | null;
}

export const AnonymousChatWidget = ({
  isOpen,
  onOpen,
  onClose,
  onOpenSignUp,
  genderPreference = 'any',
  onChangeGenderPreference,
  currentUser,
}: AnonymousChatWidgetProps) => {
  const { language } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [attentionStatus, setAttentionStatus] = useState<'reading' | 'typing' | null>(null);
  const [activeListenerName, setActiveListenerName] = useState<string | null>(null);
  const [currentDiscussion, setCurrentDiscussion] = useState<DiscussionConversation | null>(null);
  const [isClosed, setIsClosed] = useState(false);
  const [isDeviceBlocked, setIsDeviceBlocked] = useState(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportPreselectedMsgId, setReportPreselectedMsgId] = useState<string | null>(null);
  const [isConfirmCloseModalOpen, setIsConfirmCloseModalOpen] = useState(false);

  // Mobile Viewport & Virtual Keyboard Detection
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 640;
    }
    return false;
  });

  const [viewportHeight, setViewportHeight] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return window.visualViewport ? window.visualViewport.height : window.innerHeight;
    }
    return 700;
  });

  const [viewportOffsetTop, setViewportOffsetTop] = useState<number>(0);
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);

  const widgetRef = useRef<HTMLElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isAtBottomRef = useRef(true);
  const prevMessagesCountRef = useRef(0);
  const currentDiscussionRef = useRef<DiscussionConversation | null>(null);
  const currentUserRef = useRef<User | null | undefined>(currentUser);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; posX: number; posY: number }>({
    pointerX: 0,
    pointerY: 0,
    posX: 0,
    posY: 0,
  });

  useEffect(() => {
    currentDiscussionRef.current = currentDiscussion;
  }, [currentDiscussion]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Set default initial position with proper viewport bounds and comfortable margins
  useEffect(() => {
    if (isOpen && position === null) {
      const updateInitialPosition = () => {
        // On mobile (< 640px), let CSS provide a dedicated tall smartphone messaging layout
        if (typeof window !== 'undefined' && window.innerWidth < 640) {
          setPosition(null);
          return;
        }
        const estimatedWidth = Math.min(380, window.innerWidth - 24);
        const estimatedHeight = Math.min(840, window.innerHeight - 32);
        const margin = 16;
        const initialX = Math.max(margin, window.innerWidth - estimatedWidth - margin);
        const initialY = Math.max(margin, window.innerHeight - estimatedHeight - margin);
        setPosition({ x: initialX, y: initialY });
      };

      // Slight timeout to allow DOM to measure real rendered size if available
      const timer = setTimeout(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 640) {
          setPosition(null);
          return;
        }
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

  // Listen for window resize, orientation change, and mobile visualViewport changes (keyboard open/close)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleViewportChange = () => {
      const mobile = window.innerWidth < 640;
      setIsMobile(mobile);

      if (mobile) {
        setPosition(null);
      }

      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
        setViewportOffsetTop(window.visualViewport.offsetTop);
      } else {
        setViewportHeight(window.innerHeight);
        setViewportOffsetTop(0);
      }

      if (!mobile) {
        setPosition((prev) => {
          if (!prev) return prev;
          const widget = widgetRef.current;
          const width = widget ? widget.offsetWidth : 375;
          const height = widget ? widget.offsetHeight : 840;
          const margin = 16;
          const maxX = Math.max(margin, window.innerWidth - width - margin);
          const maxY = Math.max(margin, window.innerHeight - height - margin);
          return {
            x: Math.min(Math.max(margin, prev.x), maxX),
            y: Math.min(Math.max(margin, prev.y), maxY),
          };
        });
      }
    };

    handleViewportChange();

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    }
    window.addEventListener('resize', handleViewportChange);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      }
      window.removeEventListener('resize', handleViewportChange);
    };
  }, []);

  // Determine if keyboard is open on mobile: input is focused or visual viewport shrunk significantly
  const isKeyboardOpen = isMobile && (
    isInputFocused ||
    (typeof window !== 'undefined' && window.visualViewport && window.visualViewport.height < window.innerHeight * 0.78)
  );

  // When keyboard opens or viewport shrinks, auto-scroll to bottom so the latest messages remain fully in view
  useEffect(() => {
    if (isKeyboardOpen) {
      scrollToBottom(true);
      const t1 = setTimeout(() => scrollToBottom(true), 120);
      const t2 = setTimeout(() => scrollToBottom(true), 300);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [isKeyboardOpen, viewportHeight]);

  // Check device block status on mount and on ban events
  useEffect(() => {
    const checkBan = () => {
      setIsDeviceBlocked(isAnonymousSessionBlocked());
    };
    checkBan();
    window.addEventListener('3awdli_anon_blocked_status_changed', checkBan);
    return () => window.removeEventListener('3awdli_anon_blocked_status_changed', checkBan);
  }, []);

  // Close conversation voluntarily from regular user side
  const handleConfirmUserClose = () => {
    setIsConfirmCloseModalOpen(false);
    if (!currentDiscussion) return;

    const res = closeDiscussion(
      currentDiscussion.id,
      currentUser?.id || 'anon_visitor',
      currentUser?.name || (currentUser ? 'User' : 'Anonymous Visitor'),
      'user'
    );

    if (res.success && res.discussion) {
      setCurrentDiscussion(res.discussion);
      setMessages(res.discussion.messages || []);
      setIsClosed(true);
      setAttentionStatus(null);
      setActiveListenerName(null);
    } else {
      setIsClosed(true);
      setAttentionStatus(null);
    }
  };

  // Dismiss / close chat widget from user side (only available once conversation is concluded)
  const handleCloseWidget = () => {
    if (onClose) {
      onClose();
    }
    // Clean up active discussion pointers for this closed discussion permanently
    if (currentDiscussion) {
      clearActiveDiscussionReferences(currentDiscussion.id, currentDiscussion.userId);
    } else {
      clearActiveDiscussionReferences();
    }
    // Reset local state so next opening is completely clean
    setCurrentDiscussion(null);
    setMessages([
      {
        id: `msg_sys_init_${Date.now()}`,
        sender: 'system',
        text: INITIAL_DISCUSSION_SYSTEM_MESSAGE,
        timestamp: 'Just now',
        timestampMs: Date.now(),
      },
    ]);
    setIsClosed(false);
    setAttentionStatus(null);
    setActiveListenerName(null);
    setInputText('');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('3awdli_discussion_sync', { detail: { timestamp: Date.now() } }));
    }
  };

  // Initialize or load the active isolated discussion (registered if logged in, otherwise anonymous)
  const initOrLoadDiscussion = () => {
    const existing = currentUser
      ? getActiveUserDiscussion(currentUser.id)
      : getActiveAnonymousDiscussion();
    if (existing && existing.status !== 'closed') {
      if (currentUser && (existing.type !== 'registered' || !existing.userId || existing.userName === 'Anonymous Visitor' || existing.userName === 'Anonymous User')) {
        existing.type = 'registered';
        existing.userId = currentUser.id;
        existing.userName = currentUser.name;
        existing.userEmail = currentUser.email;
        saveStoredDiscussions([existing], existing);
      }
      setCurrentDiscussion(existing);
      setMessages(existing.messages || []);
      setIsClosed(false);
      setAttentionStatus(existing.listenerAttentionStatus || null);
      setActiveListenerName(existing.openedByListenerName || null);
      return existing;
    }

    // Previous discussion was closed or no active discussion exists:
    // Create a completely fresh, separate discussion record in the database,
    // starting with ONLY the single opening system message
    let newDisc: DiscussionConversation;
    if (currentUser) {
      newDisc = createNewDiscussion('registered', {
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        genderPreference,
      });
    } else {
      newDisc = createNewDiscussion('anonymous', { genderPreference });
    }
    setCurrentDiscussion(newDisc);
    setMessages(newDisc.messages || [
      {
        id: `msg_sys_welcome_${Date.now()}`,
        sender: 'system',
        text: INITIAL_DISCUSSION_SYSTEM_MESSAGE,
        timestamp: 'Just now',
        timestampMs: Date.now(),
      },
    ]);
    setIsClosed(false);
    setAttentionStatus(null);
    setActiveListenerName(null);
    return newDisc;
  };

  useEffect(() => {
    if (isOpen) {
      initOrLoadDiscussion();
    }
  }, [isOpen]);

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
  }, [messages?.length, isOpen]);

  // When attention status updates, scroll if at bottom
  useEffect(() => {
    if (attentionStatus === 'typing' && isAtBottomRef.current) {
      scrollToBottom(true);
    }
  }, [attentionStatus]);

  // Synchronize discussion state in real-time with listener actions for this specific discussion
  useEffect(() => {
    const syncFromStorage = () => {
      const curDisc = currentDiscussionRef.current;
      const curUser = currentUserRef.current;
      const targetId = curDisc?.id || (curUser ? getActiveUserDiscussionId(curUser.id) : getActiveAnonymousDiscussionId());
      if (!targetId) return;
      const all = getStoredDiscussions();
      const disc = all.find((d) => d.id === targetId);
      if (disc) {
        const newlyClosed = disc.status === 'closed';
        setIsClosed(newlyClosed);
        if (newlyClosed) {
          setAttentionStatus(null);
        } else {
          setAttentionStatus(disc.listenerAttentionStatus || null);
          setActiveListenerName(disc.openedByListenerName || null);
        }

        setCurrentDiscussion((prev) => {
          if (!prev) return disc;
          if (
            prev.id === disc.id &&
            prev.status === disc.status &&
            prev.messages?.length === disc.messages?.length &&
            prev.listenerAttentionStatus === disc.listenerAttentionStatus &&
            prev.openedByListenerName === disc.openedByListenerName
          ) {
            return prev;
          }
          return disc;
        });

        if (disc.messages && disc.messages.length > 0) {
          setMessages((prev) => {
            if (
              prev.length === disc.messages.length &&
              prev[prev.length - 1]?.id === disc.messages[disc.messages.length - 1]?.id
            ) {
              return prev;
            }
            return disc.messages;
          });
        }
      }
    };

    syncFromStorage();
    const handleSync = () => syncFromStorage();
    window.addEventListener('3awdli_discussion_sync', handleSync);
    window.addEventListener('storage', handleSync);

    const handleOpenNew = (e: Event) => {
      const customEvt = e as CustomEvent<{ discussion: DiscussionConversation }>;
      if (customEvt.detail?.discussion) {
        const disc = customEvt.detail.discussion;
        setCurrentDiscussion(disc);
        setMessages(disc.messages || []);
        setIsClosed(false);
        setAttentionStatus(null);
        setActiveListenerName(null);
        setInputText('');
        scrollToBottom(false);
      }
    };
    window.addEventListener('3awdli_open_new_discussion', handleOpenNew);

    const interval = setInterval(syncFromStorage, 1000);

    return () => {
      window.removeEventListener('3awdli_discussion_sync', handleSync);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('3awdli_open_new_discussion', handleOpenNew);
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
    if (typeof window !== 'undefined' && window.innerWidth < 640) return; // Dedicated mobile full-height layout, do not drag
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

    // Ensure we have an active discussion; if previous was closed, start a new one
    let targetDisc = currentDiscussion;
    if (!targetDisc || targetDisc.status === 'closed' || isClosed) {
      if (currentUser) {
        targetDisc = createNewDiscussion('registered', {
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email,
          genderPreference,
        });
      } else {
        targetDisc = createNewDiscussion('anonymous', { genderPreference });
      }
      setCurrentDiscussion(targetDisc);
      setMessages(targetDisc.messages);
      setIsClosed(false);
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestampMs: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    recordLiveDiscussionMessage(
      targetDisc.id,
      userMessage,
      currentUser ? 'registered' : 'anonymous',
      currentUser ? currentUser.name : 'Anonymous User',
      currentUser?.email,
      currentUser?.id,
      genderPreference
    );
    scrollToBottom(true);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

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
          title={currentUser ? "Talk Openly with 3awdli" : "Talk Anonymously with 3awdli"}
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
          </span>
          <MessageCircle className="w-5 h-5 transition-transform group-hover:scale-110" />
          <span className="font-medium text-sm tracking-wide">{currentUser ? 'Talk Openly' : 'Talk Anonymously'}</span>
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
        isMobile
          ? isKeyboardOpen
            ? {
                top: `${Math.max(0, viewportOffsetTop)}px`,
                height: `${viewportHeight}px`,
                maxHeight: `${viewportHeight}px`,
                bottom: 'auto',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 'calc(100vw - 8px)',
                maxWidth: '440px',
                margin: 0,
              }
            : {
                top: '10px',
                bottom: '10px',
                height: `${Math.min(viewportHeight - 20, 780)}px`,
                maxHeight: 'calc(100dvh - 1.25rem)',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 'calc(100vw - 20px)',
                maxWidth: '380px',
              }
          : position
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
              bottom: 'auto',
              right: 'auto',
            }
          : undefined
      }
      className={`fixed z-50 sm:top-auto sm:bottom-auto sm:inset-x-auto sm:mx-0 sm:w-[370px] sm:max-w-[380px] sm:h-[840px] sm:min-h-[520px] sm:max-h-[min(92vh,860px)] flex flex-col transition-shadow duration-200 ${
        isDragging ? 'shadow-2xl opacity-95' : 'shadow-2xl'
      } ${position ? '' : 'sm:bottom-6 sm:end-6'}`}
    >
      <div className="bg-[#FAF8F5] border border-[#E0D9CD] rounded-2xl overflow-hidden flex flex-col h-full shadow-xl">
        {/* DRAGGABLE HEADER: User can click & drag anywhere on this bar on desktop to reposition */}
        <header
          id="chat-header-drag-handle"
          onPointerDown={handleHeaderPointerDown}
          style={{ touchAction: 'none' }}
          className={`bg-[#315243] text-white shrink-0 flex items-center justify-between select-none transition-all ${
            isKeyboardOpen ? 'px-3 py-1.5' : 'px-3.5 py-2.5 sm:px-4 sm:py-3'
          } ${
            isDragging ? 'cursor-grabbing bg-[#294639]' : 'sm:cursor-grab sm:hover:bg-[#2d4b3d]'
          }`}
          title={language === 'ar' ? 'انقر واسحب لتحريك نافذة المحادثة' : language === 'fr' ? 'Cliquez et glissez pour déplacer la fenêtre' : 'Click and drag to move chat window'}
        >
          <div className="flex items-center gap-2 sm:gap-2.5 pointer-events-none">
            <div className={`${isKeyboardOpen ? 'w-5 h-5' : 'w-7 h-7 sm:w-8 sm:h-8'} rounded-full bg-white/10 flex items-center justify-center text-emerald-200 shrink-0`}>
              <HeartHandshake className={`${isKeyboardOpen ? 'w-3 h-3' : 'w-3.5 h-3.5 sm:w-4 sm:h-4'}`} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className={`${isKeyboardOpen ? 'text-xs' : 'text-xs sm:text-sm'} font-semibold tracking-wide`}>
                  {currentUser 
                    ? (language === 'ar' ? 'عاودلي - أذن صاغية' : language === 'fr' ? '3awdli Oreille attentive' : '3awdli Open Ear')
                    : (language === 'ar' ? 'عاودلي - محادثة مجهولة' : language === 'fr' ? '3awdli Écoute anonyme' : '3awdli Anonymous Ear')}
                </h3>
                <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9.5px] font-medium border ${
                  isClosed
                    ? 'bg-amber-500/20 text-amber-200 border-amber-400/30'
                    : 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
                }`}>
                  {isClosed 
                    ? (language === 'ar' ? 'منتهية' : language === 'fr' ? 'Terminée' : 'Concluded')
                    : (language === 'ar' ? 'نشطة' : language === 'fr' ? 'Active' : 'Active')}
                </span>
              </div>
              {!isKeyboardOpen && (
                <p className="text-[10px] sm:text-[10.5px] text-emerald-100/80 flex items-center gap-1 leading-tight">
                  <ShieldCheck className="w-3 h-3 text-emerald-300 shrink-0" />
                  {language === 'ar' ? 'سرية 100%' : language === 'fr' ? '100% Confidentiel' : '100% Confidential'}
                </p>
              )}
            </div>
          </div>

          {/* Right Header Status & Drag Cue: Users can close when active or dismiss when closed */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {isClosed ? (
              <button
                id="chat-header-close-dismiss-btn"
                type="button"
                onClick={handleCloseWidget}
                className="px-2.5 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs border border-white/30"
                title={language === 'ar' ? 'إغلاق وإخفاء النافذة' : language === 'fr' ? 'Fermer la fenêtre' : 'Close and dismiss chat window'}
                aria-label="Close and dismiss chat window"
              >
                <X className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'إغلاق' : language === 'fr' ? 'Fermer' : 'Close'}</span>
              </button>
            ) : (
              <>
                <button
                  id="anon-report-discussion-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setReportPreselectedMsgId(null);
                    setIsReportModalOpen(true);
                  }}
                  className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 border border-rose-300/30 text-[10.5px] sm:text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title={language === 'ar' ? 'إبلاغ مسؤول المستمعين عن هذه المحادثة' : language === 'fr' ? 'Signaler cette discussion' : 'Report this discussion to Head of Listeners'}
                >
                  <Flag className="w-3 h-3 text-rose-300" />
                  <span>{language === 'ar' ? 'إبلاغ' : language === 'fr' ? 'Signaler' : 'Report'}</span>
                </button>

                <button
                  id="user-close-chat-btn"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsConfirmCloseModalOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-white/15 hover:bg-rose-600/80 text-white text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs border border-white/20"
                  title={language === 'ar' ? 'إغلاق وإنهاء هذه المحادثة' : language === 'fr' ? 'Fermer cette conversation' : 'Close and finish this conversation'}
                  aria-label="Close and finish this conversation"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'إغلاق' : language === 'fr' ? 'Fermer' : 'Close'}</span>
                </button>
              </>
            )}
            <div 
              className="hidden sm:flex items-center gap-1 text-emerald-200/70 p-1 rounded hover:text-white"
              title={language === 'ar' ? 'اسحب الشريط للتحريك' : language === 'fr' ? 'Glissez pour déplacer' : 'Click and drag header to move'}
            >
              <GripHorizontal className="w-4 h-4" />
            </div>
          </div>
        </header>

        {/* Dynamic Participants Bar (User, Active Listener, Co-Listener, Excluded Profile) - Hidden when keyboard is open on mobile */}
        {currentDiscussion && !isKeyboardOpen && (
          <ConversationParticipantBar discussion={currentDiscussion} />
        )}

        {/* Disclaimer & team standby banner - Hidden when keyboard is open on mobile to maximize chat space */}
        {!isKeyboardOpen && (
          <div className="bg-[#F1EFEA] border-b border-[#E6E1D8] px-3 py-1 sm:px-3.5 sm:py-1.5 text-[10.5px] sm:text-[11px] text-[#556059] flex items-center justify-between shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {language === 'ar' ? 'أخصائيون ومستمعون متأهبون' : language === 'fr' ? 'Psychologues & Écoutants en attente' : 'Psychologists & Students on standby'}
            </span>
            <span className="text-[10px] text-[#7A867E]">
              {language === 'ar' ? 'الهوية محجوبة' : language === 'fr' ? 'Identité masquée' : 'Identity masked'}
            </span>
          </div>
        )}

        {/* Visitor Listener Preference Tag & Change Control - Hidden when keyboard is open on mobile to maximize chat space */}
        {!isKeyboardOpen && (
          <div className="bg-[#FAF7F2] border-b border-[#EAE3D6] px-3 py-1 sm:px-3.5 sm:py-1.5 text-[10.5px] sm:text-[11px] text-[#556059] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] sm:text-[10.5px] text-[#76877E]">
                {language === 'ar' ? 'التفضيل:' : language === 'fr' ? 'Préférence :' : 'Preference:'}
              </span>
              <GenderPreferenceTag preference={genderPreference} />
            </div>
            {onChangeGenderPreference && (
              <button
                id="change-anon-gender-pref-btn"
                type="button"
                onClick={onChangeGenderPreference}
                className="text-[10px] sm:text-[10.5px] font-semibold text-[#294B39] hover:text-[#183425] hover:underline cursor-pointer"
              >
                {language === 'ar' ? 'تغيير' : language === 'fr' ? 'Modifier' : 'Change'}
              </button>
            )}
          </div>
        )}

        {/* Scrollable Middle Area: Messages */}
        <div className="relative flex-1 min-h-0 flex flex-col">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className={`flex-1 overflow-y-auto bg-[#FAF8F5] text-[#2C332F] ${
              isKeyboardOpen ? 'p-2 space-y-2' : 'p-3 sm:p-3.5 space-y-2.5 sm:space-y-3'
            }`}
          >
            {messages.map((msg) => {
            if (msg.sender === 'system') {
              return (
                <div key={msg.id} className="flex flex-col items-center my-2">
                  <div className="bg-[#EBF2EE] border border-[#D3E3DA] text-[#28493A] text-xs px-3.5 py-2.5 rounded-xl shadow-2xs max-w-[95%] text-center">
                    <div className="flex items-center justify-center gap-1.5 font-medium mb-0.5 text-emerald-800">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{language === 'ar' ? 'فريق 3awdli' : language === 'fr' ? 'Équipe 3awdli' : '3awdli Team'}</span>
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
                <div key={msg.id} className="group flex flex-col items-start space-y-1 max-w-[85%] sm:max-w-[88%]">
                  <div className="flex items-center justify-between w-full ps-1">
                    <span className="text-[10.5px] sm:text-[11px] text-[#2C5645] font-semibold">
                      {msg.senderName || activeListenerName || (language === 'ar' ? 'مستمع فريق 3awdli' : language === 'fr' ? 'Écoutant 3awdli' : '3awdli Team Listener')}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setReportPreselectedMsgId(msg.id);
                        setIsReportModalOpen(true);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-rose-600 transition-opacity p-0.5 rounded cursor-pointer"
                      title={language === 'ar' ? 'إبلاغ عن هذه الرسالة' : language === 'fr' ? 'Signaler ce message' : 'Report this message to Head of Listeners'}
                    >
                      <Flag className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="bg-[#EAF4F3] border border-[#BCE1DB] text-[#113B37] text-xs px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-2xl rounded-ts-xs shadow-2xs leading-relaxed">
                    {msg.text}
                  </div>
                  <span className="text-[9.5px] sm:text-[10px] text-[#7A8E82] ps-1">{msg.timestamp}</span>
                </div>
              );
            }

            return (
              <div key={msg.id} className="group flex flex-col items-end space-y-1 ms-auto max-w-[85%] sm:max-w-[88%]">
                <div className="flex items-center justify-between w-full pe-1">
                  <button
                    type="button"
                    onClick={() => {
                      setReportPreselectedMsgId(msg.id);
                      setIsReportModalOpen(true);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-rose-600 transition-opacity p-0.5 rounded cursor-pointer me-auto"
                    title={language === 'ar' ? 'إبلاغ عن هذه الرسالة' : language === 'fr' ? 'Signaler ce message' : 'Report this message to Head of Listeners'}
                  >
                    <Flag className="w-3 h-3" />
                  </button>
                  <span className="text-[10px] sm:text-[10.5px] text-[#55695E]">
                    {language === 'ar' ? 'أنت' : language === 'fr' ? 'Vous' : 'You'}
                  </span>
                </div>
                <div className="bg-[#315243] text-white text-xs px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-2xl rounded-te-xs shadow-2xs leading-relaxed">
                  {msg.text}
                </div>
                <span className="text-[9.5px] sm:text-[10px] text-[#869289] pe-1">{msg.timestamp}</span>
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
              <span className="font-medium text-xs">
                {activeListenerName || (language === 'ar' ? 'المستمع' : language === 'fr' ? 'L\'écoutant' : 'Listener')} {language === 'ar' ? 'يكتب الآن...' : language === 'fr' ? 'écrit...' : 'is typing...'}
              </span>
            </div>
          )}

          {attentionStatus === 'reading' && !isClosed && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#305748] bg-[#F2F7F4] border border-[#CCE0D6] px-3 py-1.5 rounded-xl w-fit animate-in fade-in">
              <Eye className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {language === 'ar' ? 'يقرأ رسالتك الآن' : language === 'fr' ? 'Lit votre message' : 'Reading your message'}
              </span>
            </div>
          )}

          {/* Closed Conversation Notification */}
          {isClosed && (
            <div className="bg-[#FAF6F0] border border-[#E5DCD0] rounded-2xl p-4 text-center space-y-2.5 my-2.5 shadow-2xs animate-in fade-in">
              <div className="w-9 h-9 rounded-full bg-[#EAE2D5] text-[#5F4F3D] flex items-center justify-center mx-auto">
                <HeartHandshake className="w-4.5 h-4.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#23382D]">
                  {language === 'ar' ? 'تم إنهاء هذه المحادثة' : language === 'fr' ? 'Cette conversation est terminée' : 'This conversation has ended'}
                </h4>
                <p className="text-xs text-[#5C6E64] mt-1 leading-relaxed">
                  {currentUser || currentDiscussion?.type === 'registered' ? (
                    <span>
                      {language === 'ar' ? (
                        <>تم إنهاء هذه المحادثة. تم حفظها في <strong>سجل محادثاتك</strong> لتتمكن من مراجعتها في أي وقت.</>
                      ) : language === 'fr' ? (
                        <>Cette conversation a pris fin. Elle est conservée dans votre <strong>historique des discussions</strong>.</>
                      ) : (
                        <>This conversation has ended. It is safely preserved in your <strong>Discussions History</strong> so you can review it anytime.</>
                      )}
                    </span>
                  ) : (
                    <span>
                      {language === 'ar' ? (
                        <>تم إنهاء هذه المحادثة. أنشئ حساباً لتتمكن من الوصول إلى سجل محادثاتك مستقبلاً.</>
                      ) : language === 'fr' ? (
                        <>Cette conversation a pris fin. Créez un compte pour accéder à votre historique de discussions ultérieurement.</>
                      ) : (
                        <>This conversation has ended. Create an account to access your Discussions History going forward.</>
                      )}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  id="chat-closed-dismiss-btn"
                  onClick={handleCloseWidget}
                  className="px-3.5 py-2 bg-[#EDE7DE] hover:bg-[#E1D9CD] text-[#2C4134] text-xs font-semibold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs border border-[#D5CDBD]"
                  title={language === 'ar' ? 'إغلاق النافذة' : language === 'fr' ? 'Fermer la fenêtre' : 'Close Window'}
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'إغلاق النافذة' : language === 'fr' ? 'Fermer la fenêtre' : 'Close Window'}</span>
                </button>
                {(!currentUser && currentDiscussion?.type !== 'registered' && onOpenSignUp) && (
                  <button
                    id="chat-closed-create-account-btn"
                    onClick={onOpenSignUp}
                    className="px-3.5 py-2 bg-[#315243] hover:bg-[#253E33] text-white text-xs font-semibold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'إنشاء حساب' : language === 'fr' ? 'Créer un compte' : 'Create an Account'}</span>
                  </button>
                )}
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
            <span>{language === 'ar' ? 'رسائل جديدة بالأسفل' : language === 'fr' ? 'Nouveaux messages en bas' : 'New messages below'}</span>
            <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
          </button>
        )}
      </div>

        {/* Input Footer - ALWAYS VISIBLE, FIXED AT BOTTOM */}
        <div className={`bg-white border-t border-[#E3DDD1] shadow-2xs shrink-0 ${
          isKeyboardOpen ? 'p-1.5' : 'p-2.5 sm:p-3.5'
        }`}>
          {isClosed ? (
            <div className="space-y-2 py-1">
              <div className="bg-[#FAF7F2] border border-[#E9E2D5] rounded-xl p-2.5 text-xs text-[#56685D] text-center leading-relaxed">
                {currentUser || currentDiscussion?.type === 'registered' ? (
                  <span>
                    {language === 'ar' ? (
                      <>تم حفظ هذه المحادثة في <strong>سجل محادثاتك</strong>.</>
                    ) : language === 'fr' ? (
                      <>Cette conversation est enregistrée dans votre <strong>Historique</strong>.</>
                    ) : (
                      <>This conversation is saved in your <strong>Discussions History</strong>.</>
                    )}
                  </span>
                ) : (
                  <span>
                    {language === 'ar' ? (
                      <>أنشئ حساباً للوصول إلى سجل محادثاتك لاحقاً.</>
                    ) : language === 'fr' ? (
                      <>Créez un compte pour accéder à votre historique de discussions ultérieurement.</>
                    ) : (
                      <>Create an account to access your Discussions History going forward.</>
                    )}
                  </span>
                )}
              </div>
              {currentUser || currentDiscussion?.type === 'registered' ? (
                <button
                  id="chat-footer-close-btn"
                  type="button"
                  onClick={handleCloseWidget}
                  className="w-full py-2.5 px-3 bg-[#EDE8E0] hover:bg-[#E2DDD3] text-[#283C30] text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-[#DDD5C7]"
                  title={language === 'ar' ? 'إغلاق النافذة' : language === 'fr' ? 'Fermer la fenêtre' : 'Close Window'}
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'إغلاق النافذة' : language === 'fr' ? 'Fermer la fenêtre' : 'Close Window'}</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    id="chat-footer-close-btn"
                    type="button"
                    onClick={handleCloseWidget}
                    className="flex-1 py-2.5 px-3 bg-[#EDE8E0] hover:bg-[#E2DDD3] text-[#283C30] text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-[#DDD5C7]"
                    title={language === 'ar' ? 'إغلاق النافذة' : language === 'fr' ? 'Fermer la fenêtre' : 'Close Window'}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'إغلاق النافذة' : language === 'fr' ? 'Fermer la fenêtre' : 'Close Window'}</span>
                  </button>
                  {onOpenSignUp && (
                    <button
                      id="chat-footer-create-account-btn"
                      type="button"
                      onClick={onOpenSignUp}
                      className="flex-1 py-2.5 px-3 bg-[#315243] hover:bg-[#253E33] text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'إنشاء حساب' : language === 'fr' ? 'Créer un compte' : 'Create an Account'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : isDeviceBlocked ? (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-2 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-rose-900">
                <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                <span>
                  {language === 'ar' ? 'تم تقييد الوصول المجهول' : language === 'fr' ? 'Accès anonyme restreint' : 'Anonymous Access Restricted'}
                </span>
              </div>
              <p className="text-[11.5px] text-rose-800 leading-relaxed">
                {language === 'ar'
                  ? 'تم تقييد هذا المتصفح من المحادثات المجهولة بناءً على إجراء إشرافي وإداري.'
                  : language === 'fr'
                  ? 'Ce navigateur a été restreint suite à une décision de modération.'
                  : 'This browser has been restricted from anonymous chats following an administrative moderation decision.'}
              </p>
              <p className="text-[10.5px] text-stone-500 italic">
                {language === 'ar'
                  ? '(ملاحظة: يمكنك تسجيل الدخول بحساب عادي لاستعادة إمكانية المحادثة.)'
                  : language === 'fr'
                  ? '(Note : connectez-vous avec un compte pour restaurer l\'accès.)'
                  : '(Note: Clearing browser cookies or signing in with a standard account will restore access.)'}
              </p>
            </div>
          ) : (
            <>
              {!isKeyboardOpen && (
                <label
                  htmlFor="chat-message-input"
                  className="block text-[11px] font-semibold text-[#2D4537] mb-1.5 flex items-center justify-between"
                >
                  <span>
                    {language === 'ar'
                      ? 'صف مشكلتك أو ما تمر به الآن:'
                      : language === 'fr'
                      ? 'Décrivez votre problème ou ce que vous traversez :'
                      : 'Describe your problem or what you\'re going through:'}
                  </span>
                  <span className="text-[10px] text-[#78887F] font-normal hidden sm:inline">
                    {language === 'ar' ? 'اضغط Enter للإرسال' : language === 'fr' ? 'Appuyez sur Entrée' : 'Press Enter to send'}
                  </span>
                </label>
              )}
              <div className="flex items-center gap-2 bg-[#F8F6F1] border-2 border-[#D5CFC3] focus-within:border-[#315243] focus-within:bg-white rounded-xl px-2.5 py-1.5 transition-all">
                <input
                  ref={inputRef}
                  id="chat-message-input"
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onFocus={() => {
                    setIsInputFocused(true);
                    setTimeout(() => scrollToBottom(true), 120);
                  }}
                  onBlur={() => {
                    setIsInputFocused(false);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={language === 'ar' ? 'اكتب رسالتك هنا...' : language === 'fr' ? 'Écrivez votre message ici...' : 'Type your message here...'}
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
                  <span>{language === 'ar' ? 'إرسال' : language === 'fr' ? 'Envoyer' : 'Send'}</span>
                  <Send className="w-3.5 h-3.5 rtl:rotate-180" />
                </button>
              </div>
            </>
          )}

          {/* Safety & Team Session notice - Hidden when keyboard is open on mobile to maximize chat space */}
          {!isKeyboardOpen && (
            <div className="mt-2 space-y-1">
              <div className="text-[10px] text-[#78847C] flex items-center justify-between px-0.5 leading-tight">
                <span className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                  {language === 'ar'
                    ? 'ليس لحالات الطوارئ القصوى. في حال الخطر اتصل بالطوارئ فوراً.'
                    : language === 'fr'
                    ? 'Pas pour les urgences vitales. En cas de danger, appelez les secours.'
                    : 'Not for emergencies. In danger, call emergency services.'}
                </span>
              </div>
              <div className="text-[9.5px] text-[#8C9890] flex items-center justify-between px-0.5 border-t border-[#F2EEE8] pt-1">
                <span>{language === 'ar' ? 'اسحب الشريط العلوي لتغيير الموضع' : language === 'fr' ? 'Glissez la barre pour déplacer' : 'Drag top bar to reposition'}</span>
                <span className="italic">{language === 'ar' ? 'جلسة مدارة من فريق عاودلي' : language === 'fr' ? 'Session gérée par l\'équipe 3awdli' : 'Session managed by 3awdli team'}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Report Discussion Modal for Anonymous visitor */}
      <ReportDiscussionModal
        isOpen={isReportModalOpen}
        onClose={() => {
          setIsReportModalOpen(false);
          setReportPreselectedMsgId(null);
        }}
        discussion={currentDiscussion || {
          id: getActiveAnonymousDiscussionId() || `disc_anon_${Date.now()}`,
          userId: 'anon_portal_visitor',
          userName: 'Anonymous Live Visitor',
          type: 'anonymous',
          status: isClosed ? 'closed' : 'open',
          messages,
        } as DiscussionConversation}
        messages={messages}
        preSelectedMessageId={reportPreselectedMsgId}
        onReportSubmitted={() => {
          // Report logged
        }}
      />

      {/* User Close Confirmation Dialog */}
      {isConfirmCloseModalOpen && (
        <div 
          id="confirm-close-chat-overlay"
          className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div 
            id="confirm-close-chat-dialog"
            className="bg-white rounded-2xl p-5 max-w-xs w-full shadow-2xl border border-[#E0D7C9] text-center space-y-3.5 animate-in fade-in zoom-in-95"
          >
            <div className="w-11 h-11 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#1E3025]">
                {language === 'ar' ? 'إغلاق هذه المحادثة؟' : language === 'fr' ? 'Fermer cette conversation ?' : 'Close this conversation?'}
              </h4>
              <p className="text-xs text-[#5C6E64] mt-1.5 leading-relaxed">
                {language === 'ar'
                  ? 'هل أنت متأكد من رغبتك في إغلاق هذه المحادثة؟ سيتم إنهاؤها وأرشفتها بأمان في سجلك.'
                  : language === 'fr'
                  ? 'Êtes-vous sûr de vouloir fermer cette conversation ? Elle sera marquée comme terminée et archivée.'
                  : 'Are you sure you want to close this conversation? It will be safely marked as finished and archived in your history.'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                id="cancel-user-close-btn"
                type="button"
                onClick={() => setIsConfirmCloseModalOpen(false)}
                className="flex-1 py-2 px-3 text-xs font-semibold text-[#44584C] bg-[#EFEAE1] hover:bg-[#E3DDD1] rounded-xl transition-colors cursor-pointer"
              >
                {language === 'ar' ? 'لا، الاستمرار في المحادثة' : language === 'fr' ? 'Non, continuer' : 'No, keep chatting'}
              </button>
              <button
                id="confirm-user-close-btn"
                type="button"
                onClick={handleConfirmUserClose}
                className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                {language === 'ar' ? 'نعم، إغلاق' : language === 'fr' ? 'Oui, fermer' : 'Yes, close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

