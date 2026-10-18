import { useState, useEffect, useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';
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
  X,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut
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
  clearActiveDiscussionReferences,
  getOrCreateClientAnonUid
} from '../utils/discussionManagement';
import { 
  ensureAnonymousFirebaseAuth, 
  getCurrentFirebaseAuthUid 
} from '../lib/firestoreService';
import { GenderPreferenceTag } from './GenderPreferenceTag';
import { formatSiteTime } from '../utils/timezoneManagement';
import { ConversationParticipantBar } from './ConversationParticipantBar';
import { ReportDiscussionModal } from './ReportDiscussionModal';
import { VoiceCallOverlay, CallButton } from './VoiceCallOverlay';
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
  onRequestTalkOpenly?: () => void;
  onAutoOpenCall?: () => void;
}

export const AnonymousChatWidget = ({
  isOpen,
  onOpen,
  onClose,
  onOpenSignUp,
  genderPreference = 'any',
  onChangeGenderPreference,
  currentUser,
  onRequestTalkOpenly,
  onAutoOpenCall,
}: AnonymousChatWidgetProps) => {
  const { language, strings } = useLanguage();
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

  // User-adjustable Widget Dimensions (Width & Height)
  const [customSize, setCustomSize] = useState<{ width: number; height: number }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('3awdli_chat_widget_size');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.width === 'number' && typeof parsed.height === 'number') {
            const w = Math.max(340, Math.min(parsed.width, window.innerWidth - 20));
            const h = Math.max(480, Math.min(parsed.height, window.innerHeight - 20));
            return { width: w, height: h };
          }
        }
      } catch {}
      const defW = Math.min(420, Math.max(360, window.innerWidth - 32));
      const defH = Math.min(760, Math.max(540, window.innerHeight - 40));
      return { width: defW, height: defH };
    }
    return { width: 420, height: 740 };
  });

  const [isResizing, setIsResizing] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const sizeBeforeMaximizeRef = useRef<{ width: number; height: number }>({ width: 420, height: 740 });

  const resizeStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    startWidth: number;
    startHeight: number;
    startPosX: number;
    startPosY: number;
    handle: 'top-left' | 'bottom-left' | 'bottom-right' | 'top' | 'left';
  }>({
    pointerX: 0,
    pointerY: 0,
    startWidth: 420,
    startHeight: 740,
    startPosX: 0,
    startPosY: 0,
    handle: 'top-left',
  });

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
        const estimatedWidth = Math.min(customSize.width, window.innerWidth - 24);
        const estimatedHeight = Math.min(customSize.height, window.innerHeight - 32);
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
          const width = widget ? widget.offsetWidth : 365;
          const height = widget ? widget.offsetHeight : 880;
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

    const userOrAnonId = currentUser?.id || currentDiscussion.userId || getCurrentFirebaseAuthUid() || getOrCreateClientAnonUid();
    const userOrAnonName = currentUser?.name || (currentDiscussion.type === 'anonymous' ? 'Anonymous User' : 'Member');
    const res = closeDiscussion(
      currentDiscussion.id,
      userOrAnonId,
      userOrAnonName,
      'user'
    );

    // Thoroughly clear active discussion references immediately
    clearActiveDiscussionReferences(currentDiscussion.id, currentDiscussion.userId || currentUser?.id);

    if (res.success && res.discussion) {
      currentDiscussionRef.current = res.discussion;
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

  // Start a fresh new discussion unconditionally from within the widget
  const handleStartNewDiscussion = () => {
    // Thoroughly clear all references to the closed discussion
    clearActiveDiscussionReferences(currentDiscussion?.id, currentDiscussion?.userId || currentUser?.id);
    setCurrentDiscussion(null);
    currentDiscussionRef.current = null;
    setIsClosed(false);
    setAttentionStatus(null);
    setActiveListenerName(null);
    setInputText('');

    if (onRequestTalkOpenly) {
      onRequestTalkOpenly();
    } else {
      // Direct unconditional creation of a brand new discussion
      let newDisc: DiscussionConversation;
      if (currentUser) {
        newDisc = createNewDiscussion('registered', {
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email,
          genderPreference,
          language,
        });
      } else {
        const anonUid = getCurrentFirebaseAuthUid() || getOrCreateClientAnonUid();
        newDisc = createNewDiscussion('anonymous', {
          userId: anonUid,
          creatorId: anonUid,
          ownerId: anonUid,
          genderPreference,
          language,
        });
        ensureAnonymousFirebaseAuth().catch(() => {});
      }
      currentDiscussionRef.current = newDisc;
      setCurrentDiscussion(newDisc);
      setMessages(newDisc.messages || [
        {
          id: `msg_sys_welcome_${Date.now()}`,
          sender: 'system',
          text: INITIAL_DISCUSSION_SYSTEM_MESSAGE,
          timestamp: formatSiteTime(Date.now()),
          timestampMs: Date.now(),
        },
      ]);
      setIsClosed(false);
      setAttentionStatus(null);
      setActiveListenerName(null);
    }
  };

  // Dismiss / close chat widget from user side (only available once conversation is concluded)
  const handleCloseWidget = () => {
    if (currentDiscussion && currentDiscussion.status !== 'closed') {
      const userOrAnonId = currentUser?.id || currentDiscussion.userId || getCurrentFirebaseAuthUid() || getOrCreateClientAnonUid();
      const userOrAnonName = currentUser?.name || (currentDiscussion.type === 'anonymous' ? 'Anonymous User' : 'Member');
      closeDiscussion(currentDiscussion.id, userOrAnonId, userOrAnonName, 'user');
    }
    if (onClose) {
      onClose();
    }
    // Clean up active discussion pointers for this closed discussion permanently
    clearActiveDiscussionReferences(currentDiscussion?.id, currentDiscussion?.userId || currentUser?.id);

    // Reset local state so next opening is completely clean
    setCurrentDiscussion(null);
    currentDiscussionRef.current = null;
    setMessages([
      {
        id: `msg_sys_init_${Date.now()}`,
        sender: 'system',
        text: INITIAL_DISCUSSION_SYSTEM_MESSAGE,
        timestamp: formatSiteTime(Date.now()),
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
      currentDiscussionRef.current = existing;
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
    clearActiveDiscussionReferences(undefined, currentUser?.id);
    let newDisc: DiscussionConversation;
    if (currentUser) {
      newDisc = createNewDiscussion('registered', {
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        genderPreference,
        language,
      });
    } else {
      const anonUid = getCurrentFirebaseAuthUid() || getOrCreateClientAnonUid();
      newDisc = createNewDiscussion('anonymous', {
        userId: anonUid,
        creatorId: anonUid,
        ownerId: anonUid,
        genderPreference,
        language,
      });
      ensureAnonymousFirebaseAuth().catch(() => {});
    }
    currentDiscussionRef.current = newDisc;
    setCurrentDiscussion(newDisc);
    setMessages(newDisc.messages || [
      {
        id: `msg_sys_welcome_${Date.now()}`,
        sender: 'system',
        text: INITIAL_DISCUSSION_SYSTEM_MESSAGE,
        timestamp: formatSiteTime(Date.now()),
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

      // CRITICAL: If the current discussion is already closed, do NOT re-fetch it from storage
      // and do NOT re-lock the widget onto it!
      if (curDisc && curDisc.status === 'closed') {
        return;
      }

      const activeId = curDisc?.id || (curUser ? getActiveUserDiscussionId(curUser.id) : getActiveAnonymousDiscussionId());
      if (!activeId) return;
      const all = getStoredDiscussions();
      const disc = all.find((d) => d.id === activeId);
      if (disc) {
        const newlyClosed = disc.status === 'closed';
        setIsClosed(newlyClosed);
        if (newlyClosed) {
          setAttentionStatus(null);
          // When a discussion is detected as closed, clear its storage pointers immediately
          clearActiveDiscussionReferences(disc.id, disc.userId || curUser?.id);
        } else {
          setAttentionStatus(disc.listenerAttentionStatus || null);
          setActiveListenerName(disc.openedByListenerName || null);
        }

        // If an incoming call arrives for a registered user while chat is closed, open the widget
        if (disc.activeCall?.status === 'ringing' && disc.activeCall?.callerRole === 'listener' && !isOpen) {
          if (onAutoOpenCall) {
            onAutoOpenCall();
          } else {
            onOpen();
          }
        }

        setCurrentDiscussion((prev) => {
          if (!prev) return disc;
          if (
            prev.id === disc.id &&
            prev.status === disc.status &&
            prev.messages?.length === disc.messages?.length &&
            prev.listenerAttentionStatus === disc.listenerAttentionStatus &&
            prev.openedByListenerName === disc.openedByListenerName &&
            JSON.stringify(prev.activeCall) === JSON.stringify(disc.activeCall)
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
        currentDiscussionRef.current = disc;
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

    const handleCleared = () => {
      if (currentDiscussionRef.current?.status === 'closed') {
        currentDiscussionRef.current = null;
        setCurrentDiscussion(null);
        setIsClosed(false);
      }
    };
    window.addEventListener('3awdli_active_discussion_cleared', handleCleared);

    const interval = setInterval(syncFromStorage, 1000);

    return () => {
      window.removeEventListener('3awdli_discussion_sync', handleSync);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('3awdli_open_new_discussion', handleOpenNew);
      window.removeEventListener('3awdli_active_discussion_cleared', handleCleared);
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

  // Quick size stepping (increase / decrease by discrete steps)
  const handleStepSize = (e: ReactMouseEvent, direction: 'increase' | 'decrease') => {
    e.stopPropagation();
    setCustomSize((prev) => {
      const minW = 340;
      const maxW = Math.max(minW, window.innerWidth - 24);
      const minH = 480;
      const maxH = Math.max(minH, window.innerHeight - 24);

      const stepW = 45;
      const stepH = 60;

      const newW = direction === 'increase'
        ? Math.min(maxW, prev.width + stepW)
        : Math.max(minW, prev.width - stepW);

      const newH = direction === 'increase'
        ? Math.min(maxH, prev.height + stepH)
        : Math.max(minH, prev.height - stepH);

      const updated = { width: Math.round(newW), height: Math.round(newH) };
      try {
        localStorage.setItem('3awdli_chat_widget_size', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (isMaximized) setIsMaximized(false);
  };

  // Toggle maximize / normal size
  const handleToggleMaximize = (e: ReactMouseEvent) => {
    e.stopPropagation();
    if (isMaximized) {
      const restored = sizeBeforeMaximizeRef.current;
      setCustomSize(restored);
      setIsMaximized(false);
      try {
        localStorage.setItem('3awdli_chat_widget_size', JSON.stringify(restored));
      } catch {}
    } else {
      sizeBeforeMaximizeRef.current = customSize;
      const maxW = Math.min(720, Math.max(420, window.innerWidth - 32));
      const maxH = Math.min(940, Math.max(580, window.innerHeight - 32));
      const maxed = { width: maxW, height: maxH };
      setCustomSize(maxed);
      setIsMaximized(true);
      try {
        localStorage.setItem('3awdli_chat_widget_size', JSON.stringify(maxed));
      } catch {}
    }
  };

  // Drag-to-resize pointer handler
  const handleResizePointerDown = (
    e: ReactPointerEvent<HTMLElement>,
    handle: 'top-left' | 'bottom-left' | 'bottom-right' | 'top' | 'left'
  ) => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const widget = widgetRef.current;
    if (!widget) return;

    const currentRect = widget.getBoundingClientRect();
    const currentX = position ? position.x : currentRect.left;
    const currentY = position ? position.y : currentRect.top;

    resizeStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      startWidth: customSize.width,
      startHeight: customSize.height,
      startPosX: currentX,
      startPosY: currentY,
      handle,
    };

    setIsResizing(true);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - resizeStartRef.current.pointerX;
      const deltaY = moveEvent.clientY - resizeStartRef.current.pointerY;

      const minW = 340;
      const maxW = Math.max(minW, window.innerWidth - 24);
      const minH = 480;
      const maxH = Math.max(minH, window.innerHeight - 24);

      let newWidth = resizeStartRef.current.startWidth;
      let newHeight = resizeStartRef.current.startHeight;

      if (handle === 'top-left') {
        newWidth = Math.min(Math.max(minW, resizeStartRef.current.startWidth - deltaX), maxW);
        newHeight = Math.min(Math.max(minH, resizeStartRef.current.startHeight - deltaY), maxH);
        if (position) {
          const appliedDeltaX = resizeStartRef.current.startWidth - newWidth;
          const appliedDeltaY = resizeStartRef.current.startHeight - newHeight;
          setPosition({
            x: resizeStartRef.current.startPosX + appliedDeltaX,
            y: resizeStartRef.current.startPosY + appliedDeltaY,
          });
        }
      } else if (handle === 'bottom-left') {
        newWidth = Math.min(Math.max(minW, resizeStartRef.current.startWidth - deltaX), maxW);
        newHeight = Math.min(Math.max(minH, resizeStartRef.current.startHeight + deltaY), maxH);
        if (position) {
          const appliedDeltaX = resizeStartRef.current.startWidth - newWidth;
          setPosition((prev) => prev ? { x: resizeStartRef.current.startPosX + appliedDeltaX, y: prev.y } : null);
        }
      } else if (handle === 'bottom-right') {
        newWidth = Math.min(Math.max(minW, resizeStartRef.current.startWidth + deltaX), maxW);
        newHeight = Math.min(Math.max(minH, resizeStartRef.current.startHeight + deltaY), maxH);
      } else if (handle === 'left') {
        newWidth = Math.min(Math.max(minW, resizeStartRef.current.startWidth - deltaX), maxW);
        if (position) {
          const appliedDeltaX = resizeStartRef.current.startWidth - newWidth;
          setPosition((prev) => prev ? { x: resizeStartRef.current.startPosX + appliedDeltaX, y: prev.y } : null);
        }
      } else if (handle === 'top') {
        newHeight = Math.min(Math.max(minH, resizeStartRef.current.startHeight - deltaY), maxH);
        if (position) {
          const appliedDeltaY = resizeStartRef.current.startHeight - newHeight;
          setPosition((prev) => prev ? { x: prev.x, y: resizeStartRef.current.startPosY + appliedDeltaY } : null);
        }
      }

      setCustomSize({ width: Math.round(newWidth), height: Math.round(newHeight) });
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);

      setCustomSize((current) => {
        try {
          localStorage.setItem('3awdli_chat_widget_size', JSON.stringify(current));
        } catch {}
        return current;
      });
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
          language,
        });
      } else {
        const anonUid = getCurrentFirebaseAuthUid() || getOrCreateClientAnonUid();
        targetDisc = createNewDiscussion('anonymous', {
          userId: anonUid,
          creatorId: anonUid,
          ownerId: anonUid,
          genderPreference,
          language,
        });
        ensureAnonymousFirebaseAuth().catch(() => {});
      }
      setCurrentDiscussion(targetDisc);
      setMessages(targetDisc.messages);
      setIsClosed(false);
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: formatSiteTime(),
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
        className="fixed bottom-4 sm:bottom-6 end-4 sm:end-6 z-50 flex items-center gap-3 max-w-[calc(100vw-2rem)]"
      >
        <button
          onClick={onRequestTalkOpenly || onOpen}
          className="group flex items-center gap-2.5 sm:gap-3 px-4 sm:px-5 py-3 sm:py-3.5 bg-[#315243] hover:bg-[#274236] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#315243]/20 cursor-pointer max-w-full"
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
              width: `${customSize.width}px`,
              height: `${customSize.height}px`,
              maxWidth: 'calc(100vw - 20px)',
              maxHeight: 'calc(100vh - 20px)',
              bottom: 'auto',
              right: 'auto',
            }
          : {
              width: `${customSize.width}px`,
              height: `${customSize.height}px`,
              maxWidth: 'calc(100vw - 20px)',
              maxHeight: 'calc(100vh - 20px)',
            }
      }
      className={`fixed z-50 sm:top-auto sm:bottom-auto sm:inset-x-auto sm:mx-0 flex flex-col transition-shadow duration-200 ${
        isDragging || isResizing ? 'shadow-2xl opacity-95 select-none' : 'shadow-2xl'
      } ${position ? '' : 'sm:bottom-6 sm:end-6'}`}
    >
      {/* Desktop Drag-to-Resize Handles */}
      <div
        onPointerDown={(e) => handleResizePointerDown(e, 'top-left')}
        className="hidden sm:flex items-center justify-center absolute -top-1.5 -left-1.5 w-6 h-6 rounded-tl-xl cursor-nwse-resize z-50 group pointer-events-auto"
        title={language === 'ar' ? 'اسحب من الزاوية لتغيير حجم النافذة' : language === 'fr' ? "Glissez l'angle pour redimensionner la fenêtre" : 'Drag corner to resize window'}
      >
        <div className="w-2.5 h-2.5 border-t-2 border-l-2 border-emerald-400/80 group-hover:border-emerald-300 transition-colors" />
      </div>

      <div
        onPointerDown={(e) => handleResizePointerDown(e, 'bottom-left')}
        className="hidden sm:flex items-center justify-center absolute -bottom-1.5 -left-1.5 w-6 h-6 rounded-bl-xl cursor-nesw-resize z-50 group pointer-events-auto"
        title={language === 'ar' ? 'اسحب من الزاوية لتغيير حجم النافذة' : language === 'fr' ? "Glissez l'angle pour redimensionner la fenêtre" : 'Drag corner to resize window'}
      >
        <div className="w-2.5 h-2.5 border-b-2 border-l-2 border-emerald-600/80 group-hover:border-emerald-400 transition-colors" />
      </div>

      <div
        onPointerDown={(e) => handleResizePointerDown(e, 'left')}
        className="hidden sm:block absolute top-10 bottom-10 -left-1 w-2 cursor-ew-resize z-40 hover:bg-emerald-500/30 transition-colors pointer-events-auto"
        title={language === 'ar' ? 'اسحب لتغيير العرض' : language === 'fr' ? 'Glissez pour modifier la largeur' : 'Drag to adjust width'}
      />

      <div
        onPointerDown={(e) => handleResizePointerDown(e, 'top')}
        className="hidden sm:block absolute -top-1 left-10 right-10 h-2 cursor-ns-resize z-40 hover:bg-emerald-500/30 transition-colors pointer-events-auto"
        title={language === 'ar' ? 'اسحب لتغيير الارتفاع' : language === 'fr' ? 'Glissez pour modifier la hauteur' : 'Drag to adjust height'}
      />

      {position && (
        <div
          onPointerDown={(e) => handleResizePointerDown(e, 'bottom-right')}
          className="hidden sm:flex items-center justify-center absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-br-xl cursor-nwse-resize z-50 group pointer-events-auto"
          title={language === 'ar' ? 'اسحب من الزاوية لتغيير حجم النافذة' : language === 'fr' ? "Glissez l'angle pour redimensionner" : 'Drag to resize'}
        >
          <div className="w-2.5 h-2.5 border-b-2 border-r-2 border-emerald-600/80 group-hover:border-emerald-400 transition-colors" />
        </div>
      )}

      <div className="bg-[#FAF8F5] border border-[#E0D9CD] rounded-2xl overflow-hidden flex flex-col h-full shadow-xl">
        {/* DRAGGABLE HEADER: User can click & drag anywhere on this bar on desktop to reposition */}
        <header
          id="chat-header-drag-handle"
          onPointerDown={handleHeaderPointerDown}
          style={{ touchAction: 'none' }}
          className={`bg-[#315243] text-white shrink-0 flex items-center justify-between select-none transition-all px-3 py-2 sm:px-3.5 sm:py-2.5 ${
            isDragging ? 'cursor-grabbing bg-[#294639]' : 'sm:cursor-grab sm:hover:bg-[#2d4b3d]'
          }`}
          title={language === 'ar' ? 'انقر واسحب لتحريك نافذة المحادثة' : language === 'fr' ? 'Cliquez et glissez pour déplacer la fenêtre' : 'Click and drag to move chat window'}
        >
          {/* Left: Icon + Multiline Title + Sizing Quick Buttons */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 pr-1.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 flex items-center justify-center text-emerald-200 shrink-0 pointer-events-none">
              <HeartHandshake className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="min-w-0 flex-1 pointer-events-none">
              <h3 className="text-xs sm:text-[13px] font-semibold tracking-tight leading-tight text-white break-words min-w-0">
                {currentUser 
                  ? (language === 'ar' ? 'عاودلي - أذن صاغية' : language === 'fr' ? '3awdli Oreille attentive' : '3awdli Open Ear')
                  : (language === 'ar' ? 'عاودلي - محادثة مجهولة' : language === 'fr' ? '3awdli Écoute anonyme' : '3awdli Anonymous Ear')}
              </h3>
            </div>

            {/* Desktop Window Sizing Controls */}
            <div 
              className="hidden sm:flex items-center gap-0.5 bg-black/20 rounded-lg p-0.5 border border-white/10 shrink-0 pointer-events-auto"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                id="widget-shrink-size-btn"
                type="button"
                onClick={(e) => handleStepSize(e, 'decrease')}
                className="w-5 h-5 rounded flex items-center justify-center text-emerald-100 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
                title={language === 'ar' ? 'تصغير حجم النافذة' : language === 'fr' ? 'Réduire la taille' : 'Make smaller'}
                aria-label="Make smaller"
              >
                <ZoomOut className="w-3 h-3" />
              </button>
              <button
                id="widget-enlarge-size-btn"
                type="button"
                onClick={(e) => handleStepSize(e, 'increase')}
                className="w-5 h-5 rounded flex items-center justify-center text-emerald-100 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
                title={language === 'ar' ? 'تكبير حجم النافذة' : language === 'fr' ? 'Agrandir la taille' : 'Make bigger'}
                aria-label="Make bigger"
              >
                <ZoomIn className="w-3 h-3" />
              </button>
              <button
                id="widget-toggle-maximize-btn"
                type="button"
                onClick={handleToggleMaximize}
                className="w-5 h-5 rounded flex items-center justify-center text-emerald-100 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
                title={
                  isMaximized
                    ? (language === 'ar' ? 'استعادة الحجم الطبيعي' : language === 'fr' ? 'Restaurer la taille' : 'Restore normal size')
                    : (language === 'ar' ? 'تكبير كامل' : language === 'fr' ? 'Maximiser la fenêtre' : 'Maximize window')
                }
                aria-label="Toggle window size"
              >
                {isMaximized ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Right Header Status & Action Controls: Column with Top Row (Status + Call + Report) and Bottom Row (Close Discussion) */}
          <div 
            className="flex flex-col items-end gap-1.5 shrink-0 pointer-events-auto"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* Top row: [Active/Terminée] status pill + [Call 📞] + [Signaler ⚑] */}
            <div className="flex items-center gap-1.5">
              <span className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 whitespace-nowrap ${
                isClosed
                  ? 'bg-amber-500/20 text-amber-200 border-amber-400/30'
                  : 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
              }`}>
                {isClosed 
                  ? (language === 'ar' ? 'منتهية' : language === 'fr' ? 'Terminée' : 'Concluded')
                  : (language === 'ar' ? 'نشطة' : language === 'fr' ? 'Active' : 'Active')}
              </span>

              {!isClosed && (
                <>
                  {currentDiscussion && currentUser && (
                    <CallButton
                      discussion={currentDiscussion}
                      currentRole="user"
                      currentUserId={currentUser.id}
                      currentUserName={currentUser.name}
                      iconOnly={true}
                    />
                  )}

                  <button
                    id="anon-report-discussion-btn"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setReportPreselectedMsgId(null);
                      setIsReportModalOpen(true);
                    }}
                    className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 border border-rose-300/30 text-[10.5px] sm:text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                    title={language === 'ar' ? 'إبلاغ مسؤول المستمعين عن هذه المحادثة' : language === 'fr' ? 'Signaler cette discussion' : 'Report this discussion to Head of Listeners'}
                  >
                    <Flag className="w-3 h-3 text-rose-300" />
                    <span>{language === 'ar' ? 'إبلاغ' : language === 'fr' ? 'Signaler' : 'Report'}</span>
                  </button>
                </>
              )}
            </div>

            {/* Bottom row: The Close Discussion button placed DIRECTLY UNDER the Call and Report buttons */}
            {isClosed ? (
              <button
                id="chat-header-close-dismiss-btn"
                type="button"
                onClick={handleCloseWidget}
                className="w-full flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[11px] font-semibold transition-all cursor-pointer shadow-xs border border-white/30 shrink-0 whitespace-nowrap active:scale-95"
                title={language === 'ar' ? 'إغلاق وإخفاء النافذة' : language === 'fr' ? 'Fermer la fenêtre' : 'Close and dismiss chat window'}
                aria-label="Close and dismiss chat window"
              >
                <X className="w-3 h-3" />
                <span>{language === 'ar' ? 'إغلاق النافذة' : language === 'fr' ? 'Fermer la fenêtre' : 'Close window'}</span>
              </button>
            ) : (
              <button
                id="user-close-chat-btn"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsConfirmCloseModalOpen(true);
                }}
                className="w-full flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600/90 text-rose-100 hover:text-white text-[11px] font-semibold transition-all cursor-pointer shadow-xs border border-rose-400/40 shrink-0 whitespace-nowrap active:scale-95"
                title={language === 'ar' ? 'إغلاق وإنهاء هذه المحادثة' : language === 'fr' ? 'Fermer cette discussion' : 'Close and finish this discussion'}
                aria-label="Close and finish this conversation"
              >
                <X className="w-3 h-3 text-rose-200" />
                <span>{language === 'ar' ? 'إغلاق المحادثة' : language === 'fr' ? 'Fermer la discussion' : 'Close discussion'}</span>
              </button>
            )}
          </div>
        </header>

        {/* Real-time Voice Call Overlay (Incoming Modal / Ringing Banner / Active In-Call Screen) */}
        {currentDiscussion && (
          <VoiceCallOverlay
            discussion={currentDiscussion}
            currentRole="user"
            currentUserId={currentUser?.id || currentDiscussion.userId || 'anonymous_user'}
            currentUserName={currentUser?.name || currentDiscussion.userName || 'Anonymous Visitor'}
          />
        )}

        {/* Dynamic Participants Bar (User, Active Listener, Co-Listener, Excluded Profile) - Hidden when keyboard is open on mobile */}
        {currentDiscussion && !isKeyboardOpen && (
          <ConversationParticipantBar
            discussion={currentDiscussion}
            viewerId={currentUser?.id || currentDiscussion.userId || getCurrentFirebaseAuthUid() || getOrCreateClientAnonUid()}
          />
        )}

        {/* Disclaimer & team standby banner - Hidden when keyboard is open on mobile to maximize chat space */}
        {!isKeyboardOpen && (
          <div className={`border-b px-3 py-1 sm:px-3.5 sm:py-1.5 text-[10.5px] sm:text-[11px] flex items-center justify-between shrink-0 transition-colors ${
            currentDiscussion?.allListenersBusyOnCreate && currentDiscussion?.status === 'unopened'
              ? 'bg-[#FFF7ED] border-[#FED7AA] text-[#9A3412]'
              : 'bg-[#F1EFEA] border-[#E6E1D8] text-[#556059]'
          }`}>
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${
                currentDiscussion?.allListenersBusyOnCreate && currentDiscussion?.status === 'unopened'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-emerald-500'
              }`}></span>
              {currentDiscussion?.allListenersBusyOnCreate && currentDiscussion?.status === 'unopened'
                ? (strings.discussions.allListenersBusyBanner || 'All listeners in other conversations • Message queued')
                : (language === 'ar' ? 'مستمعون مدربون متأهبون' : language === 'fr' ? 'Écoutants formés en attente' : 'Trained listeners on standby')}
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
                  id="chat-closed-start-new-btn"
                  onClick={handleStartNewDiscussion}
                  className="px-3.5 py-2 bg-[#315243] hover:bg-[#253E33] text-white text-xs font-semibold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                  title={currentUser ? "Talk Openly Again" : "Start New Discussion"}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{currentUser ? (language === 'ar' ? 'محادثة جديدة' : language === 'fr' ? 'Parler à cœur ouvert' : 'Talk Openly Again') : (language === 'ar' ? 'بدء محادثة جديدة' : language === 'fr' ? 'Démarrer une nouvelle discussion' : 'Start New Discussion')}</span>
                </button>
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
                <div className="flex items-center gap-2">
                  <button
                    id="chat-footer-start-new-btn"
                    type="button"
                    onClick={handleStartNewDiscussion}
                    className="flex-1 py-2.5 px-3 bg-[#315243] hover:bg-[#253E33] text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    title={currentUser ? "Talk Openly Again" : "Start New Discussion"}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{currentUser ? (language === 'ar' ? 'محادثة جديدة' : language === 'fr' ? 'Parler à cœur ouvert' : 'Talk Openly Again') : (language === 'ar' ? 'بدء محادثة جديدة' : language === 'fr' ? 'Démarrer une nouvelle discussion' : 'Start New Discussion')}</span>
                  </button>
                  <button
                    id="chat-footer-close-btn"
                    type="button"
                    onClick={handleCloseWidget}
                    className="py-2.5 px-3 bg-[#EDE8E0] hover:bg-[#E2DDD3] text-[#283C30] text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-[#DDD5C7]"
                    title={language === 'ar' ? 'إغلاق النافذة' : language === 'fr' ? 'Fermer la fenêtre' : 'Close Window'}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'إغلاق' : language === 'fr' ? 'Fermer' : 'Close'}</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    id="chat-footer-start-new-btn"
                    type="button"
                    onClick={handleStartNewDiscussion}
                    className="flex-1 py-2.5 px-3 bg-[#315243] hover:bg-[#253E33] text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    title="Start New Discussion"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'بدء محادثة جديدة' : language === 'fr' ? 'Démarrer une nouvelle discussion' : 'Start New Discussion'}</span>
                  </button>
                  <button
                    id="chat-footer-close-btn"
                    type="button"
                    onClick={handleCloseWidget}
                    className="py-2.5 px-3 bg-[#EDE8E0] hover:bg-[#E2DDD3] text-[#283C30] text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-[#DDD5C7]"
                    title={language === 'ar' ? 'إغلاق النافذة' : language === 'fr' ? 'Fermer la fenêtre' : 'Close Window'}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'إغلاق' : language === 'fr' ? 'Fermer' : 'Close'}</span>
                  </button>
                  {onOpenSignUp && (
                    <button
                      id="chat-footer-create-account-btn"
                      type="button"
                      onClick={onOpenSignUp}
                      className="py-2.5 px-3 bg-[#EDE8E0] hover:bg-[#E2DDD3] text-[#283C30] text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-[#DDD5C7]"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'حساب' : language === 'fr' ? 'Compte' : 'Sign Up'}</span>
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

