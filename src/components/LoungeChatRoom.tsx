import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Users,
  Shield,
  Sparkles,
  MessageSquare,
  Crown,
  Info,
  Clock,
} from 'lucide-react';
import {
  LoungeArticle,
  UserAccount,
  LoungeChatMessage,
  LoungeRoomParticipant,
  LoungeRoomData,
} from '../types';
import {
  getStoredLoungeRoomData,
  sendLoungeChatMessage,
  leaveLoungeRoom,
  HOST_GOLD_COLOR,
  getColorById,
  LOUNGE_PARTICIPANT_COLORS,
} from '../utils/loungeChatManagement';

interface LoungeChatRoomProps {
  article: LoungeArticle;
  currentUser?: UserAccount | null;
  isHost: boolean;
  onLeaveRoom: () => void;
}

export const LoungeChatRoom: React.FC<LoungeChatRoomProps> = ({
  article,
  currentUser,
  isHost,
  onLeaveRoom,
}) => {
  const [roomData, setRoomData] = useState<LoungeRoomData>(() =>
    getStoredLoungeRoomData(article.id)
  );
  const [inputText, setInputText] = useState('');
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isParticipantsDrawerOpen, setIsParticipantsDrawerOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll on new message
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Sync room data on change
  useEffect(() => {
    const handleUpdate = () => {
      setRoomData(getStoredLoungeRoomData(article.id));
    };

    window.addEventListener(
      `3awdli_lounge_room_updated_${article.id}`,
      handleUpdate
    );
    window.addEventListener('storage', handleUpdate);

    // Initial scroll
    scrollToBottom('auto');

    return () => {
      window.removeEventListener(
        `3awdli_lounge_room_updated_${article.id}`,
        handleUpdate
      );
      window.removeEventListener('storage', handleUpdate);
    };
  }, [article.id]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [roomData.messages.length]);

  // Identify current user's color
  const currentUserColor = isHost
    ? HOST_GOLD_COLOR
    : currentUser
    ? getColorById(roomData.chosenColorIds[currentUser.id] || 'terracotta')
    : LOUNGE_PARTICIPANT_COLORS[0];

  // Handle Send message
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || !currentUser) return;

    try {
      sendLoungeChatMessage(article.id, currentUser, isHost, trimmed);
      setInputText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  // Handle Enter key (send on Enter, newline on Shift+Enter)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle Leave Confirmation
  const handleConfirmLeave = () => {
    if (currentUser) {
      leaveLoungeRoom(article.id, currentUser.id);
    }
    setIsLeaveModalOpen(false);
    onLeaveRoom();
  };

  return (
    <div
      id="lounge-chat-room-container"
      className="max-w-5xl mx-auto flex flex-col h-[calc(100vh-140px)] min-h-[560px] bg-[#FAF7F2] border border-[#E0D8C8] rounded-3xl shadow-lg overflow-hidden"
    >
      {/* ── Room Top Bar ────────────────────────────────────────── */}
      <header className="px-5 sm:px-7 py-4 bg-white/90 backdrop-blur-xs border-b border-[#E2D8C7] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[#EBE3D3] flex items-center justify-center text-[#28493A] shrink-0 shadow-2xs">
            <MessageSquare className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Circle Discussion
              </span>

              <span className="text-[11px] text-[#7A8C81] hidden sm:inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Scheduled Article Session
              </span>
            </div>

            <h1 className="text-base sm:text-lg font-bold text-[#182C22] truncate font-['Lora',serif]">
              {article.title}
            </h1>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Participants toggle pill */}
          <button
            type="button"
            id="toggle-participants-btn"
            onClick={() => setIsParticipantsDrawerOpen(!isParticipantsDrawerOpen)}
            className="px-3 py-1.5 rounded-xl border border-[#DCD3C3] bg-[#F7F3EB] hover:bg-[#EFE9DD] text-[#34483D] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="View participants in this circle"
          >
            <Users className="w-3.5 h-3.5 text-[#5B7164]" />
            <span className="hidden sm:inline">In Room:</span>
            <span className="font-bold text-[#1B3125]">
              {roomData.participants.length}
            </span>
          </button>

          {/* Leave Room 'X' Button */}
          <button
            type="button"
            id="leave-lounge-room-x-btn"
            onClick={() => setIsLeaveModalOpen(true)}
            className="p-2 rounded-xl text-[#6D7F74] hover:text-[#9A3412] hover:bg-[#FBEBE5] border border-transparent hover:border-[#F2C0B0] transition-colors cursor-pointer"
            title="Leave the chat room"
            aria-label="Leave chat room"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── Main Area: Chat stream + Optional Participants drawer ── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Messages List Stream */}
        <div
          id="lounge-chat-messages-stream"
          className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-4"
        >
          {/* Room Welcome Banner */}
          <div className="max-w-md mx-auto p-3.5 rounded-2xl bg-[#F3EFE6] border border-[#DFD6C5] text-center space-y-1">
            <div className="inline-flex items-center justify-center gap-1 text-[11px] font-semibold text-[#506358] uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-amber-600" />
              <span>Circle Opened</span>
            </div>
            <p className="text-xs text-[#63766B] leading-relaxed">
              Messages are displayed in each participant's chosen color. Expert Facilitator messages
              appear in reserved Gold.
            </p>
          </div>

          {/* Chat Messages */}
          {roomData.messages.map((msg) => {
            const isMe = currentUser && msg.userId === currentUser.id;

            return (
              <div
                key={msg.id}
                id={`chat-message-${msg.id}`}
                className={`flex items-start gap-2.5 sm:gap-3 group ${
                  isMe ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar with color ring */}
                <div className="relative shrink-0">
                  {msg.userAvatar ? (
                    <img
                      src={msg.userAvatar}
                      alt={msg.userName}
                      className="w-9 h-9 rounded-full object-cover border-2 shadow-2xs"
                      style={{
                        borderColor: msg.isHost ? HOST_GOLD_COLOR.hex : msg.colorHex,
                      }}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-2xs"
                      style={{
                        backgroundColor: msg.isHost
                          ? HOST_GOLD_COLOR.hex
                          : msg.colorHex,
                      }}
                    >
                      {msg.userName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {msg.isHost && (
                    <span
                      className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-500 border border-white text-white flex items-center justify-center shadow-2xs"
                      title="Expert Facilitator"
                    >
                      <Crown className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>

                {/* Message Body */}
                <div
                  className={`max-w-[82%] sm:max-w-[70%] space-y-1 ${
                    isMe ? 'items-end text-right' : 'items-start text-left'
                  }`}
                >
                  {/* Sender Name & Role & Time */}
                  <div
                    className={`flex items-center gap-1.5 text-xs text-[#708277] ${
                      isMe ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <span className="font-semibold text-[#25392F]">
                      {isMe ? 'You' : msg.userName}
                    </span>

                    {msg.isHost && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-sm bg-amber-100 text-amber-900 text-[10px] font-bold border border-amber-300">
                        <Crown className="w-2.5 h-2.5 text-amber-700" />
                        Expert Facilitator
                      </span>
                    )}

                    {!msg.isHost && msg.colorName && (
                      <span className="text-[10px] text-[#86978C] font-normal hidden sm:inline">
                        • {msg.colorName}
                      </span>
                    )}

                    <span className="text-[11px] text-[#8E9F94]">
                      {msg.formattedTime}
                    </span>
                  </div>

                  {/* Speech Bubble Styled with Chosen Color (Gold for Host) */}
                  <div
                    className={`px-4 py-2.5 rounded-2xl shadow-xs text-xs sm:text-sm leading-relaxed break-words whitespace-pre-wrap ${
                      msg.isHost
                        ? 'border border-amber-400/40 text-white font-medium'
                        : 'text-white'
                    } ${
                      isMe
                        ? 'rounded-tr-xs'
                        : 'rounded-tl-xs'
                    }`}
                    style={{
                      backgroundColor: msg.isHost
                        ? HOST_GOLD_COLOR.hex
                        : msg.colorHex,
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* Participants Slide-over Drawer */}
        {isParticipantsDrawerOpen && (
          <aside
            id="room-participants-drawer"
            className="w-64 sm:w-72 bg-white border-l border-[#E2D9C9] p-4 flex flex-col justify-between shrink-0 shadow-lg animate-in slide-in-from-right duration-150 z-20"
          >
            <div className="space-y-4 overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-[#EFE8DD]">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#28493A]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#182C22]">
                    In Discussion ({roomData.participants.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsParticipantsDrawerOpen(false)}
                  className="p-1 rounded-md text-[#78897E] hover:bg-[#F2ECE1]"
                  aria-label="Close drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Participants Roster */}
              <div className="space-y-2">
                {roomData.participants.map((p) => {
                  const isCurrent = currentUser && p.userId === currentUser.id;
                  return (
                    <div
                      key={p.userId}
                      className="p-2 rounded-xl bg-[#FAF7F2] border border-[#ECE5D8] flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-[11px] shrink-0"
                          style={{
                            backgroundColor: p.isHost
                              ? HOST_GOLD_COLOR.hex
                              : p.colorHex,
                          }}
                        >
                          {p.userName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-[#1B2F24] block truncate">
                            {p.userName} {isCurrent ? '(You)' : ''}
                          </span>
                          <span className="text-[10px] text-[#718579] block">
                            {p.isHost ? 'Expert Facilitator' : p.colorName}
                          </span>
                        </div>
                      </div>

                      {/* Color Swatch Dot */}
                      <div
                        className="w-3.5 h-3.5 rounded-full border border-white/80 shadow-2xs shrink-0"
                        style={{
                          backgroundColor: p.isHost
                            ? HOST_GOLD_COLOR.hex
                            : p.colorHex,
                        }}
                        title={p.isHost ? 'Expert Facilitator Gold' : p.colorName}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-[#EFE8DD] text-[11px] text-[#788B80]">
              Max room capacity: 10 people
            </div>
          </aside>
        )}
      </div>

      {/* ── Chat Composer ────────────────────────────────────────── */}
      <footer className="p-3 sm:p-4 bg-white/95 border-t border-[#E4DCCE] shrink-0 space-y-2">
        {/* Current speaker identity indicator */}
        <div className="flex items-center justify-between text-xs px-1 text-[#6C7E73]">
          <div className="flex items-center gap-2">
            <span className="text-[11px]">Chatting as:</span>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#F3EFE5] border border-[#DFD7C7] text-xs font-semibold text-[#182C22]">
              <span
                className="w-2.5 h-2.5 rounded-full shadow-2xs"
                style={{ backgroundColor: currentUserColor.hex }}
              />
              <span>
                {currentUser?.name || (isHost ? 'Expert Facilitator' : 'You')}
              </span>
              {isHost ? (
                <span className="text-[10px] text-amber-800 font-bold ml-0.5">
                  (Gold Reserved)
                </span>
              ) : (
                <span className="text-[10px] text-[#75887D] font-normal ml-0.5">
                  ({currentUserColor.name})
                </span>
              )}
            </div>
          </div>

          <span className="text-[11px] text-[#8F9E94] hidden sm:inline">
            Press Enter to send, Shift+Enter for new line
          </span>
        </div>

        {/* Input box and Send button */}
        <form
          onSubmit={handleSendMessage}
          className="flex items-end gap-2.5"
        >
          <div className="flex-1 relative">
            <textarea
              id="lounge-chat-input"
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                // auto-grow
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                currentUser
                  ? 'Share your thoughts in the circle...'
                  : 'Please sign in to join the conversation...'
              }
              disabled={!currentUser}
              className="w-full px-4 py-2.5 rounded-2xl border border-[#D5CABB] bg-[#FAF8F4] text-xs sm:text-sm text-[#182C22] placeholder:text-[#8E9F95] focus:outline-none focus:ring-2 focus:ring-[#28493A]/20 focus:border-[#28493A] resize-none max-h-32 transition-colors"
            />
          </div>

          <button
            type="submit"
            id="send-lounge-message-btn"
            disabled={!inputText.trim() || !currentUser}
            className={`px-4 py-2.5 rounded-2xl font-semibold text-xs sm:text-sm text-white shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              inputText.trim() && currentUser
                ? 'bg-[#28493A] hover:bg-[#1C3529] hover:scale-[1.02]'
                : 'bg-[#A8B6AE] cursor-not-allowed opacity-60'
            }`}
            title="Send Message"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </footer>

      {/* ── Leave Room Confirmation Modal ───────────────────────── */}
      {isLeaveModalOpen && (
        <div
          id="leave-room-confirmation-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="bg-[#FAF7F2] border border-[#DDD4C5] rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center shrink-0">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#182C22] font-['Lora',serif]">
                  Leave the Chat Room?
                </h3>
                <p className="text-xs text-[#6B7E73]">
                  Are you sure you want to leave this live circle?
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#4E6155] leading-relaxed">
              If you leave now, you will exit the live discussion and return to the
              Lounge lobby.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                id="cancel-leave-room-btn"
                onClick={() => setIsLeaveModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#D5C9B7] bg-white hover:bg-[#F2EDE4] text-[#4F6257] text-xs font-semibold transition-colors cursor-pointer"
              >
                No, Stay in Room
              </button>

              <button
                type="button"
                id="confirm-leave-room-btn"
                onClick={handleConfirmLeave}
                className="px-5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Yes, Leave Room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
