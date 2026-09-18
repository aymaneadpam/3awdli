import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  DoorOpen,
  Users,
  Bell,
  Clock,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  VolumeX,
  Sparkles,
  Shield,
  LogOut,
  UserPlus,
  LogIn,
  X,
  Play,
  RotateCcw,
  Crown,
  MessageSquare,
  HelpCircle,
} from 'lucide-react';
import { LoungeArticle, UserAccount, LoungeQueueMember } from '../types';
import {
  getStoredQueueState,
  joinLoungeQueue,
  leaveLoungeQueue,
  hostOpenQueue,
  enterLoungeRoom,
  handleCallTimeout,
  hostManualCloseRoom,
  resetLoungeSessionForTest,
  formatOrdinal,
  MAX_QUEUE_ADMISSIONS,
  MAX_ROOM_CAPACITY,
  CALL_TIMEOUT_SECONDS,
} from '../utils/loungeQueueManagement';
import { isLoungeHost } from '../utils/userManagement';
import { playLoungeBellSound } from '../utils/loungeAudio';
import {
  joinLoungeRoom,
  getAvailableColorsForSession,
} from '../utils/loungeChatManagement';
import { LoungeColorSelectModal } from './LoungeColorSelectModal';

interface LoungeQueueScreenProps {
  article: LoungeArticle;
  currentUser?: UserAccount | null;
  onBackToLobby: () => void;
  onBackToArticle: () => void;
  onNavigateSignIn?: () => void;
  onNavigateSignUp?: () => void;
  onLoungeClosed?: () => void;
  onEnterChatRoom?: (colorId?: string) => void;
}

export const LoungeQueueScreen: React.FC<LoungeQueueScreenProps> = ({
  article,
  currentUser,
  onBackToLobby,
  onBackToArticle,
  onNavigateSignIn,
  onNavigateSignUp,
  onLoungeClosed,
  onEnterChatRoom,
}) => {
  const [queueState, setQueueState] = useState(() => getStoredQueueState(article.id));
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [soundMuted, setSoundMuted] = useState<boolean>(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState<boolean>(false);
  const [isLeaveQueueModalOpen, setIsLeaveQueueModalOpen] = useState<boolean>(false);
  const [isColorModalOpen, setIsColorModalOpen] = useState<boolean>(false);
  const [showAnonymousAuthPrompt, setShowAnonymousAuthPrompt] = useState<boolean>(false);

  const isHost = useMemo(
    () => isLoungeHost(currentUser, article),
    [currentUser, article]
  );

  // Sync state whenever storage or custom update event triggers
  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.articleId === article.id) {
        setQueueState(customEvent.detail);
      } else {
        setQueueState(getStoredQueueState(article.id));
      }
    };

    const eventKey = `3awdli_lounge_queue_updated_${article.id}`;
    window.addEventListener(eventKey, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(eventKey, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [article.id]);

  // Real-time ticking interval for the 1-minute timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Check 1-minute timeout for currently called member
  const lastTimedOutRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      queueState.isQueueOpen &&
      !queueState.isRoomClosed &&
      queueState.currentCalledMemberId &&
      queueState.callExpiresAtTimestamp
    ) {
      if (currentTime >= queueState.callExpiresAtTimestamp) {
        if (lastTimedOutRef.current !== queueState.currentCalledMemberId) {
          lastTimedOutRef.current = queueState.currentCalledMemberId;
          const updated = handleCallTimeout(article.id, queueState.currentCalledMemberId);
          setQueueState(updated);
        }
      }
    }
  }, [currentTime, queueState, article.id]);

  // When room is closed, notify parent component if needed
  useEffect(() => {
    if (queueState.isRoomClosed && onLoungeClosed) {
      onLoungeClosed();
    }
  }, [queueState.isRoomClosed, onLoungeClosed]);

  // Calculate remaining seconds for the currently called turn
  const secondsRemaining = useMemo(() => {
    if (!queueState.callExpiresAtTimestamp) return 0;
    const diff = Math.max(
      0,
      Math.ceil((queueState.callExpiresAtTimestamp - currentTime) / 1000)
    );
    return Math.min(CALL_TIMEOUT_SECONDS, diff);
  }, [queueState.callExpiresAtTimestamp, currentTime]);

  // Check if current user is in queue and their status
  const currentUserQueueMember = useMemo(() => {
    if (!currentUser) return null;
    return queueState.members.find((m) => m.userId === currentUser.id) || null;
  }, [currentUser, queueState.members]);

  const isCurrentUsersTurn = useMemo(() => {
    if (!currentUserQueueMember) return false;
    return queueState.currentCalledMemberId === currentUserQueueMember.id;
  }, [currentUserQueueMember, queueState.currentCalledMemberId]);

  // Sort queue members:
  // Active waiting / called members first in order of queue number, then admitted
  const sortedMembers = useMemo(() => {
    return [...queueState.members].sort((a, b) => {
      if (a.status === 'called' && b.status !== 'called') return -1;
      if (b.status === 'called' && a.status !== 'called') return 1;
      if (a.status === 'waiting' && b.status === 'admitted') return -1;
      if (a.status === 'admitted' && b.status === 'waiting') return 1;
      return a.queueNumber - b.queueNumber;
    });
  }, [queueState.members]);

  const waitingCount = useMemo(
    () => queueState.members.filter((m) => m.status === 'waiting' || m.status === 'called').length,
    [queueState.members]
  );

  // Handlers
  const handleHostOpenQueue = () => {
    if (!currentUser) return;
    const updated = hostOpenQueue(article.id, currentUser);
    setQueueState(updated);
    if (!soundMuted) {
      playLoungeBellSound();
    }
  };

  const handleJoinQueueClick = () => {
    if (!currentUser) {
      setShowAnonymousAuthPrompt(true);
      return;
    }
    const result = joinLoungeQueue(article.id, currentUser);
    setQueueState(result.state);
  };

  const handleLeaveQueueClick = () => {
    setIsLeaveQueueModalOpen(true);
  };

  const handleConfirmLeaveQueue = () => {
    if (!currentUser) return;
    const updated = leaveLoungeQueue(article.id, currentUser.id);
    setQueueState(updated);
    setIsLeaveQueueModalOpen(false);
  };

  const handleEnterClick = () => {
    if (isHost) {
      if (currentUser) {
        joinLoungeRoom(article.id, currentUser, 'host-gold', true);
      }
      if (queueState.currentCalledMemberId) {
        const result = enterLoungeRoom(article.id, queueState.currentCalledMemberId);
        setQueueState(result.state);
      }
      onEnterChatRoom?.('host-gold');
      return;
    }

    // Participants select a personal color first
    setIsColorModalOpen(true);
  };

  const handleConfirmColorSelection = (chosenColorId: string) => {
    if (!currentUser || !queueState.currentCalledMemberId) return;

    // Join room data with chosen color
    joinLoungeRoom(article.id, currentUser, chosenColorId, false);

    // Enter room in queue management
    const result = enterLoungeRoom(article.id, queueState.currentCalledMemberId);
    setQueueState(result.state);
    setIsColorModalOpen(false);

    // Transition to chat room
    onEnterChatRoom?.(chosenColorId);
  };

  const handleSimulateEnter = () => {
    if (!queueState.currentCalledMemberId) return;
    const calledMember = queueState.members.find(
      (m) => m.id === queueState.currentCalledMemberId
    );
    if (calledMember) {
      const available = getAvailableColorsForSession(article.id);
      const assignedColorId = available.length > 0 ? available[0].id : 'terracotta';
      joinLoungeRoom(
        article.id,
        {
          id: calledMember.userId,
          name: calledMember.userName,
          email: calledMember.userEmail,
          role: 'listener',
          createdAt: new Date().toISOString(),
        },
        assignedColorId,
        false
      );
    }
    const result = enterLoungeRoom(article.id, queueState.currentCalledMemberId);
    setQueueState(result.state);
  };

  const handleConfirmCloseRoom = () => {
    const updated = hostManualCloseRoom(article.id);
    setQueueState(updated);
    setIsCloseModalOpen(false);
    if (onLoungeClosed) {
      onLoungeClosed();
    }
  };

  const handleResetForTest = () => {
    const updated = resetLoungeSessionForTest(article.id);
    setQueueState(updated);
  };

  return (
    <div className="w-full max-w-4xl mx-auto pb-16 animate-in fade-in duration-300">
      {/* Navigation & Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="back-to-lobby-btn"
            onClick={onBackToLobby}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-[#495C51] hover:text-[#182C22] hover:bg-[#EAE4D9] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>The Lounge Lobby</span>
          </button>
          <span className="text-[#C6BAA8]">/</span>
          <button
            type="button"
            id="back-to-article-btn"
            onClick={onBackToArticle}
            className="text-xs sm:text-sm text-[#495C51] hover:text-[#182C22] truncate max-w-[200px] sm:max-w-xs transition-colors cursor-pointer"
            title={article.title}
          >
            {article.title}
          </button>
        </div>

        {/* Audio notification toggle */}
        <button
          type="button"
          id="queue-sound-toggle-btn"
          onClick={() => setSoundMuted(!soundMuted)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#DDD4C5] bg-[#FDFBF7] text-[#55695E] hover:text-[#1F372B] hover:bg-[#F2EDE4] text-xs font-medium transition-colors cursor-pointer"
          title={soundMuted ? 'Turn turn notification sound on' : 'Mute turn notification chime'}
        >
          {soundMuted ? (
            <>
              <VolumeX className="w-3.5 h-3.5 text-[#A56740]" />
              <span>Chime Muted</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5 text-[#2E6B4B]" />
              <span>Chime Active</span>
            </>
          )}
        </button>
      </div>

      {/* Top Banner Requirement: "8 people enter from the queue each session." */}
      <div
        id="queue-top-stat-banner"
        className="relative overflow-hidden rounded-3xl bg-linear-to-r from-[#213F32] via-[#2A4C3D] to-[#1D382B] text-white p-6 sm:p-8 shadow-md mb-6"
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-200 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>The Lounge Queue Room</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight font-['Lora',serif]">
              {article.title}
            </h1>
            {/* MANDATORY PROMPT TEXT */}
            <p className="text-base sm:text-lg font-medium text-emerald-100/90 pt-1">
              8 people enter from the queue each session.
            </p>
            <p className="text-xs sm:text-sm text-emerald-200/70">
              When your turn is announced, you will have 1 minute to click Enter and join the circle.
            </p>
          </div>

          {/* Quick Capacity Metrics */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 shrink-0">
            <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-2xl p-3.5 text-center min-w-[120px]">
              <span className="text-xs text-emerald-200/80 block mb-1">Queue Admitted</span>
              <span className="text-2xl font-bold tracking-tight text-white">
                {queueState.admittedCount}
                <span className="text-xs font-normal text-emerald-300 ml-1">/ {MAX_QUEUE_ADMISSIONS}</span>
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-2xl p-3.5 text-center min-w-[120px]">
              <span className="text-xs text-emerald-200/80 block mb-1">Room Total</span>
              <span className="text-2xl font-bold tracking-tight text-white">
                {queueState.roomParticipantsCount}
                <span className="text-xs font-normal text-emerald-300 ml-1">/ {MAX_ROOM_CAPACITY}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Host Controls Panel (Shown only to Host / Founder) */}
      {isHost && (
        <div
          id="host-control-panel"
          className="bg-[#F8F4EC] border-2 border-[#E1D4C0] rounded-3xl p-5 sm:p-6 mb-6 shadow-2xs space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-[#874116] text-white text-[11px] font-bold tracking-wider uppercase inline-flex items-center gap-1.5">
                <Shield className="w-3 h-3" />
                Expert Facilitator Controls
              </span>
              <span className="text-xs text-[#55695E] font-medium">
                Logged in as Expert Facilitator: {currentUser?.name}
              </span>
            </div>

            {/* Manual Close Room Button */}
            {!queueState.isRoomClosed && (
              <button
                type="button"
                id="host-close-room-btn"
                onClick={() => setIsCloseModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#874116] hover:bg-[#6E3310] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-2xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Close Room</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {/* Host Open Queue Button */}
            {!queueState.isQueueOpen && !queueState.isRoomClosed && (
              <button
                type="button"
                id="host-open-queue-btn"
                onClick={handleHostOpenQueue}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#28493A] hover:bg-[#1E372B] text-white text-sm font-semibold transition-all shadow-sm cursor-pointer hover:scale-[1.01]"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Open the Queue Now</span>
              </button>
            )}

            {queueState.isQueueOpen && !queueState.isRoomClosed && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 text-xs font-semibold border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                <span>Queue is Live & Active</span>
              </div>
            )}

            {/* Test Reset Button if room was closed */}
            {queueState.isRoomClosed && (
              <button
                type="button"
                id="host-reset-room-test-btn"
                onClick={handleResetForTest}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#D5C9B7] text-[#4A5D52] hover:bg-[#EFE7DA] text-xs font-medium transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Lounge Session (Test)</span>
              </button>
            )}

            {/* Host Enter Chat Room Button */}
            <button
              type="button"
              id="host-enter-chat-room-btn"
              onClick={() => {
                if (currentUser) {
                  joinLoungeRoom(article.id, currentUser, 'host-gold', true);
                }
                onEnterChatRoom?.('host-gold');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-2xs"
            >
              <Crown className="w-3.5 h-3.5 text-amber-100" />
              <span>Enter Chat Room (Expert Facilitator)</span>
            </button>
          </div>
        </div>
      )}

      {/* Turn-by-Turn Calling Announcement Display */}
      {queueState.isRoomClosed ? (
        <div
          id="lounge-closed-notice"
          className="bg-[#F6F2EB] border border-[#DDD3C3] rounded-3xl p-6 sm:p-8 text-center space-y-3 mb-6"
        >
          <div className="w-12 h-12 rounded-full bg-[#E5DFD4] text-[#697B70] mx-auto flex items-center justify-center">
            <DoorOpen className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-[#182C22] font-['Lora',serif]">
            This Lounge Room is Closed
          </h2>
          <p className="text-sm text-[#55695E] max-w-md mx-auto">
            {queueState.closedReason === 'capacity_reached'
              ? 'The session has reached its capacity of admitted members for today.'
              : 'The Expert Facilitator has concluded this live circle session.'}
          </p>
          <div className="pt-2">
            <button
              type="button"
              id="return-to-lobby-after-close-btn"
              onClick={onBackToLobby}
              className="px-5 py-2 rounded-xl bg-[#28493A] text-white text-xs sm:text-sm font-semibold hover:bg-[#1E372B] transition-colors cursor-pointer"
            >
              Return to Lobby
            </button>
          </div>
        </div>
      ) : queueState.isQueueOpen ? (
        queueState.currentCalledMemberId ? (
          <div
            id="active-call-turn-card"
            className={`rounded-3xl p-6 sm:p-8 mb-6 border-2 transition-all shadow-md ${
              isCurrentUsersTurn
                ? 'bg-[#FBF6EE] border-[#874116] ring-4 ring-[#874116]/15'
                : 'bg-white border-[#C9D9CE]'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-[#FBF1E6] text-[#874116] flex items-center justify-center animate-bounce">
                    <Bell className="w-4 h-4 fill-current" />
                  </span>
                  <span className="text-xs font-bold tracking-wider text-[#874116] uppercase">
                    Currently Calling
                  </span>
                </div>

                {/* EXACT SPEC MESSAGE: "Person number X's turn in the queue" */}
                <h2 className="text-xl sm:text-2xl font-bold text-[#182C22] font-['Lora',serif]">
                  Person number {queueState.currentCalledQueueNumber}'s turn in the queue
                </h2>

                <p className="text-sm text-[#4E6256]">
                  {isCurrentUsersTurn ? (
                    <span className="font-semibold text-[#874116]">
                      It's your turn! Click the Enter button below to join the room.
                    </span>
                  ) : (
                    <span>
                      Calling <strong className="text-[#182C22]">{queueState.currentCalledUserName}</strong> to step into the circle.
                    </span>
                  )}
                </p>
              </div>

              {/* 1-Minute Live Timer & Enter Action */}
              <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0">
                {/* Timer Display */}
                <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#F3EEE5] border border-[#DDD3C4]">
                  <Clock className="w-4 h-4 text-[#874116] animate-pulse" />
                  <div className="text-right">
                    <span className="text-[11px] block uppercase font-bold text-[#72857A]">
                      Time to Join
                    </span>
                    <span
                      id="turn-countdown-timer"
                      className={`text-lg sm:text-xl font-mono font-bold ${
                        secondsRemaining <= 15 ? 'text-rose-600 animate-pulse' : 'text-[#182C22]'
                      }`}
                    >
                      00:{secondsRemaining.toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>

                {/* Clear "Enter" Button for the called person */}
                {isCurrentUsersTurn ? (
                  <button
                    type="button"
                    id="lounge-queue-enter-btn"
                    onClick={handleEnterClick}
                    className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#28493A] hover:bg-[#1C3529] text-white text-sm sm:text-base font-bold shadow-lg shadow-[#28493A]/25 transition-transform hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2 animate-pulse"
                  >
                    <DoorOpen className="w-5 h-5" />
                    <span>Enter Room Now</span>
                  </button>
                ) : isHost ? (
                  /* Facilitator convenience button to test enter without needing multiple tabs */
                  <button
                    type="button"
                    id="host-simulate-enter-btn"
                    onClick={handleSimulateEnter}
                    className="px-3.5 py-2 rounded-xl bg-white border border-[#D5C9B7] text-[#4A5D52] hover:bg-[#EFE7DA] text-xs font-semibold cursor-pointer"
                    title="Simulate this person clicking Enter (Expert Facilitator test tool)"
                  >
                    Simulate Enter ({queueState.currentCalledUserName})
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div
            id="queue-waiting-for-members-card"
            className="bg-white border border-[#DDD3C3] rounded-3xl p-6 sm:p-8 text-center space-y-2 mb-6"
          >
            <div className="w-10 h-10 rounded-full bg-[#EBF3EE] text-[#28493A] mx-auto flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-[#182C22] font-['Lora',serif]">
              Queue is Open and Waiting
            </h3>
            <p className="text-xs sm:text-sm text-[#55695E]">
              No participants are waiting in line right now. Join the queue below to be called first!
            </p>
          </div>
        )
      ) : (
        <div
          id="queue-not-opened-card"
          className="bg-white border border-[#DDD3C3] rounded-3xl p-6 sm:p-8 text-center space-y-2 mb-6"
        >
          <div className="w-10 h-10 rounded-full bg-[#F3EEE5] text-[#874116] mx-auto flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-semibold text-[#182C22] font-['Lora',serif]">
            Queue Registration is Open
          </h3>
          <p className="text-xs sm:text-sm text-[#55695E]">
            {isHost
              ? 'Click "Open the Queue Now" above to begin admitting members into the session.'
              : 'The Expert Facilitator will open entry shortly. You can reserve your spot in line below!'}
          </p>
        </div>
      )}

      {/* User Join / Leave Queue Action Bar */}
      <div className="bg-white border border-[#DDD4C5] rounded-3xl p-5 sm:p-6 mb-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-[#182C22]">
              {currentUserQueueMember
                ? currentUserQueueMember.status === 'admitted'
                  ? 'You have entered the session'
                  : `You are in line: ${formatOrdinal(currentUserQueueMember.queueNumber)} in queue`
                : 'Join This Live Session'}
            </h3>
            <p className="text-xs text-[#55695E] mt-0.5">
              {currentUserQueueMember
                ? currentUserQueueMember.status === 'admitted'
                  ? 'Welcome to the circle. Please step into the live chat room to participate.'
                  : currentUserQueueMember.status === 'called'
                  ? 'Your turn is currently active! Click Enter above to pick your color.'
                  : 'You will hear a bell chime and have 1 minute to enter when your turn arrives.'
                : 'Only logged-in members can take a seat in the queue.'}
            </p>
          </div>

          <div className="shrink-0 w-full sm:w-auto">
            {!currentUser ? (
              <button
                type="button"
                id="anonymous-join-prompt-btn"
                onClick={() => setShowAnonymousAuthPrompt(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#28493A] hover:bg-[#1E372B] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In to Join Queue</span>
              </button>
            ) : currentUserQueueMember ? (
              (currentUserQueueMember.status === 'waiting' || currentUserQueueMember.status === 'called') ? (
                <button
                  type="button"
                  id="leave-queue-btn"
                  onClick={handleLeaveQueueClick}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[#D5C9B7] hover:bg-[#F2ECE1] text-[#718579] hover:text-[#182C22] text-xs font-semibold transition-colors cursor-pointer"
                  title="Leave the queue and give up your spot"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Leave Queue</span>
                </button>
              ) : currentUserQueueMember.status === 'admitted' ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Admitted Inside</span>
                  </div>
                  <button
                    type="button"
                    id="go-to-chat-room-btn"
                    onClick={() => onEnterChatRoom?.()}
                    className="px-4 py-2 rounded-xl bg-[#28493A] hover:bg-[#1E372B] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Go to Chat Room</span>
                  </button>
                </div>
              ) : null
            ) : !queueState.isRoomClosed ? (
              <button
                type="button"
                id="join-lounge-queue-btn"
                onClick={handleJoinQueueClick}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#28493A] hover:bg-[#1E372B] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-sm"
              >
                <DoorOpen className="w-4 h-4" />
                <span>Join the Queue</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Queue Screen Member List */}
      <div className="bg-white border border-[#DDD4C5] rounded-3xl p-5 sm:p-7 shadow-2xs">
        <div className="flex items-center justify-between border-b border-[#EAE4D9] pb-4 mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#28493A]" />
            <h2 className="text-lg font-bold text-[#182C22] font-['Lora',serif]">
              People in Queue
            </h2>
          </div>
          <span className="text-xs font-medium text-[#55695E] bg-[#F4EFE6] px-3 py-1 rounded-full">
            {waitingCount} {waitingCount === 1 ? 'person' : 'people'} in line
          </span>
        </div>

        {sortedMembers.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <p className="text-sm text-[#72857A]">
              The queue is currently empty.
            </p>
            <p className="text-xs text-[#90A196]">
              Be the first to join and reserve your seat in this session!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#F2ECE1]">
            {sortedMembers.map((member) => {
              const isUser = currentUser && member.userId === currentUser.id;
              const isCalled = member.status === 'called';
              const isAdmitted = member.status === 'admitted';

              return (
                <div
                  key={member.id}
                  id={`queue-member-${member.id}`}
                  className={`py-3.5 px-3 rounded-2xl flex items-center justify-between gap-3 transition-colors ${
                    isCalled
                      ? 'bg-[#FBF1E6] border border-[#ECD1BA]'
                      : isUser
                      ? 'bg-[#F6F2EB]'
                      : 'hover:bg-[#FCFAF7]'
                  }`}
                >
                  {/* Avatar & Name */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Ordinal Rank: 1st, 2nd, 3rd... */}
                    <span
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        isCalled
                          ? 'bg-[#874116] text-white animate-pulse'
                          : isAdmitted
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-[#EAE4D9] text-[#28493A]'
                      }`}
                    >
                      {formatOrdinal(member.queueNumber)}
                    </span>

                    {/* Avatar photo or initials */}
                    {member.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        alt={member.userName}
                        className="w-9 h-9 rounded-full object-cover border border-[#DDD4C5] shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[#E5DFD4] text-[#1E372B] font-semibold text-xs flex items-center justify-center shrink-0 border border-[#D5C9B7]">
                        {member.userName.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[#182C22] truncate">
                          {member.userName}
                        </p>
                        {isUser && (
                          <span className="px-2 py-0.5 rounded-full bg-[#28493A] text-white text-[10px] font-bold">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#718579]">
                        Joined at {member.joinedAt}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0 text-right">
                    {isCalled ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#874116] text-white text-xs font-semibold shadow-2xs animate-pulse">
                        <Bell className="w-3.5 h-3.5 fill-current" />
                        <span>Turn to Enter</span>
                      </span>
                    ) : isAdmitted ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Admitted ({member.queueNumber}/8)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#EAE4D9] text-[#4E6256] text-xs font-medium">
                        <span>Waiting in line</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Modal for Host "Close Room" */}
      {isCloseModalOpen && (
        <div
          id="confirm-close-room-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="bg-white border border-[#DDD4C5] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => setIsCloseModalOpen(false)}
                className="p-1.5 rounded-lg text-[#75867D] hover:bg-[#F2EDE4] transition-colors cursor-pointer"
                aria-label="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h3 className="text-xl font-bold text-[#182C22] font-['Lora',serif]">
                Close this room?
              </h3>
              <p className="text-xs sm:text-sm text-[#506358] mt-2 leading-relaxed">
                Are you sure you want to close this room? This ends the session for everyone.
                The queue will stop accepting new calls immediately, and the lounge will be marked as closed.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                id="cancel-close-room-btn"
                onClick={() => setIsCloseModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#D5C9B7] text-[#4E6256] hover:bg-[#F2ECE1] text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-close-room-btn"
                onClick={handleConfirmCloseRoom}
                className="px-5 py-2 rounded-xl bg-[#874116] hover:bg-[#6E3310] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-sm"
              >
                Yes, Close Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Anonymous Sign In / Sign Up Prompt Modal */}
      {showAnonymousAuthPrompt && (
        <div
          id="anonymous-queue-auth-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="bg-white border border-[#DDD4C5] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-[#E6F3EC] text-[#226744] flex items-center justify-center">
                <DoorOpen className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => setShowAnonymousAuthPrompt(false)}
                className="p-1.5 rounded-lg text-[#75867D] hover:bg-[#F2EDE4] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h3 className="text-xl font-bold text-[#182C22] font-['Lora',serif]">
                Sign In Required to Join
              </h3>
              <p className="text-xs sm:text-sm text-[#506358] mt-2 leading-relaxed">
                Only logged-in users with an account can join the queue and take part in live lounge sessions.
                Please sign in or create a free account to enter.
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                id="auth-modal-signin-btn"
                onClick={() => {
                  setShowAnonymousAuthPrompt(false);
                  if (onNavigateSignIn) onNavigateSignIn();
                }}
                className="w-full py-2.5 rounded-xl bg-[#28493A] hover:bg-[#1E372B] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In to Your Account</span>
              </button>

              <button
                type="button"
                id="auth-modal-signup-btn"
                onClick={() => {
                  setShowAnonymousAuthPrompt(false);
                  if (onNavigateSignUp) onNavigateSignUp();
                }}
                className="w-full py-2.5 rounded-xl border border-[#D5C9B7] bg-white hover:bg-[#F2ECE1] text-[#28493A] text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create a Free Account</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave the Queue Confirmation Modal */}
      {isLeaveQueueModalOpen && (
        <div
          id="leave-queue-confirm-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="bg-white border border-[#DDD4C5] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center border border-amber-200">
                <HelpCircle className="w-5 h-5 text-amber-700" />
              </div>
              <button
                type="button"
                id="close-leave-queue-modal-btn"
                onClick={() => setIsLeaveQueueModalOpen(false)}
                className="p-1.5 rounded-lg text-[#75867D] hover:bg-[#F2EDE4] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h3 className="text-xl font-bold text-[#182C22] font-['Lora',serif]">
                Leave the Queue?
              </h3>
              {/* EXACT SPEC QUESTION: "Are you sure you want to leave the queue?" */}
              <p className="text-sm text-[#4A5D52] mt-2 font-medium">
                Are you sure you want to leave the queue?
              </p>
              <p className="text-xs text-[#718579] mt-1 leading-relaxed">
                If you leave, your spot in line will be forfeited and subsequent members in the queue will move up in order.
              </p>
            </div>

            {/* Clear Yes/No confirmation buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                id="cancel-leave-queue-btn"
                onClick={() => setIsLeaveQueueModalOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-[#D5C9B7] text-[#4E6256] hover:bg-[#F2ECE1] text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                No
              </button>
              <button
                type="button"
                id="confirm-leave-queue-btn"
                onClick={handleConfirmLeaveQueue}
                className="px-5 py-2.5 rounded-xl bg-[#874116] hover:bg-[#6E3310] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-sm"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10-Color Selection Modal shown prior to room entry */}
      <LoungeColorSelectModal
        isOpen={isColorModalOpen}
        articleId={article.id}
        currentUserId={currentUser?.id}
        userName={currentUser?.name}
        onClose={() => setIsColorModalOpen(false)}
        onConfirmColor={handleConfirmColorSelection}
      />
    </div>
  );
};
