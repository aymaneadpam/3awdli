import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { 
  Heart, 
  Send, 
  ShieldCheck, 
  LifeBuoy, 
  LogOut, 
  Home, 
  Sparkles, 
  Clock, 
  AlertCircle,
  BookmarkCheck,
  Wind,
  CheckCircle2,
  Lock,
  Star,
  Briefcase,
  ArrowRight,
  Eye,
  RotateCcw,
  ArrowDown
} from 'lucide-react';
import { UserAccount, ChatMessage, DiscussionConversation, ListenerGenderPreference } from '../types';
import { 
  getStoredDiscussions, 
  reopenDiscussionByUser, 
  recordLiveDiscussionMessage,
  updateDiscussionGenderPreference
} from '../utils/discussionManagement';
import { GenderPreferenceModal } from './GenderPreferenceModal';
import { GenderPreferenceTag } from './GenderPreferenceTag';

interface PersonalDashboardProps {
  user: UserAccount;
  onSignOut: () => void;
  onNavigateHome: () => void;
  onOpenEmergencyModal: () => void;
  onNavigateDiscussions?: () => void;
  onNavigateAdmin?: () => void;
}

export const PersonalDashboard = ({
  user,
  onSignOut,
  onNavigateHome,
  onOpenEmergencyModal,
  onNavigateDiscussions,
  onNavigateAdmin,
}: PersonalDashboardProps) => {
  const isListener = Boolean(user.is_listener || user.isListener || user.role === 'listener');
  const isHead = Boolean(user.is_head_of_listeners);
  const isAdmin = user.role === 'admin';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState<'Inhale' | 'Hold' | 'Exhale'>('Inhale');
  const [activeDiscussion, setActiveDiscussion] = useState<DiscussionConversation | null>(null);
  const [listenerAttention, setListenerAttention] = useState<'typing' | 'reading' | null>(null);
  const [activeListenerName, setActiveListenerName] = useState<string | null>(null);
  const [isClosed, setIsClosed] = useState(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [isGenderModalOpen, setIsGenderModalOpen] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isAtBottomRef = useRef(true);
  const prevMessagesCountRef = useRef(0);

  const storageKey = `3awdli_chats_${user.id}`;
  const discId = `disc_user_${user.id}`;

  const handleConfirmGenderPreference = (preference: ListenerGenderPreference) => {
    const targetDiscId = activeDiscussion?.id || discId;
    updateDiscussionGenderPreference(targetDiscId, preference);
    setIsGenderModalOpen(false);
    syncDiscussionState();
  };

  // Sync discussion state with platform discussion management
  const syncDiscussionState = () => {
    const all = getStoredDiscussions();
    // Look for matching user discussion (disc_user_{id} or disc_open_102 if mock user)
    const found = all.find((d) => d.userId === user.id || d.id === discId || (user.id === 'user_102' && d.id === 'disc_open_102'));
    if (found) {
      setActiveDiscussion(found);
      setIsClosed(found.status === 'closed');
      setListenerAttention(found.listenerAttentionStatus || null);
      setActiveListenerName(found.openedByListenerName || null);
      if (found.messages && found.messages.length > 0) {
        setMessages(found.messages);
        localStorage.setItem(storageKey, JSON.stringify(found.messages));
      }
    } else {
      // Load saved conversation history for this specific user
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed: ChatMessage[] = JSON.parse(saved);
          setMessages(parsed);
        } else {
          // Initial welcoming conversation preserved for this user
          const initialMessages: ChatMessage[] = [
            {
              id: `msg_sys_${Date.now()}`,
              sender: 'system',
              text: `Welcome to your personal 3awdli space, ${user.name}. Your discussions are safely preserved here and linked to your account.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
            {
              id: `msg_team_${Date.now()}`,
              sender: 'team',
              senderName: 'Dr. Leila • Clinical Psychologist',
              text: `Salam ${user.name}. I am glad you reached out. This is a protected space where you never have to put on a brave face. Whatever difficulty, worry, or emotion you are holding right now — please take your time and tell me about it. I am listening.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ];
          setMessages(initialMessages);
          localStorage.setItem(storageKey, JSON.stringify(initialMessages));
          // Register in discussions system
          recordLiveDiscussionMessage(discId, initialMessages[0], 'registered', user.name, user.id);
          recordLiveDiscussionMessage(discId, initialMessages[1], 'registered', user.name, user.id);
        }
      } catch {
        // Fallback
      }
    }
  };

  useEffect(() => {
    syncDiscussionState();
    const handleSync = () => syncDiscussionState();
    window.addEventListener('3awdli_discussion_sync', handleSync);
    window.addEventListener('storage', handleSync);
    const interval = setInterval(syncDiscussionState, 1000);

    return () => {
      window.removeEventListener('3awdli_discussion_sync', handleSync);
      window.removeEventListener('storage', handleSync);
      clearInterval(interval);
    };
  }, [user.id, user.name, discId]);

  // Check whether member is already near the bottom (within 70px)
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
    const currentCount = messages?.length || 0;

    // Initial load: jump straight to bottom
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
        // Member is scrolled up reading earlier messages
        setShowScrollBottomBtn(true);
      }
    } else {
      prevMessagesCountRef.current = currentCount;
    }
  }, [messages]);

  // When listener attention or typing updates, only scroll if already at bottom
  useEffect(() => {
    if ((listenerAttention || isTyping) && isAtBottomRef.current) {
      scrollToBottom(true);
    }
  }, [listenerAttention, isTyping]);

  // Gentle breathing exercise loop
  useEffect(() => {
    if (!breathingActive) return;

    const cycle = () => {
      setBreathingPhase('Inhale');
      const t1 = setTimeout(() => {
        setBreathingPhase('Hold');
        const t2 = setTimeout(() => {
          setBreathingPhase('Exhale');
        }, 3000);
        return () => clearTimeout(t2);
      }, 4000);
      return () => clearTimeout(t1);
    };

    cycle();
    const interval = setInterval(cycle, 11000);
    return () => clearInterval(interval);
  }, [breathingActive]);

  const quickPrompts = [
    "I've been feeling burnt out and don't know how to rest.",
    "Lately my anxiety has been waking me up in the middle of the night.",
    "I feel disconnected from everyone around me and very alone.",
    "Can we talk about feeling overwhelmed by expectations?",
  ];

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    const userMessage: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setInputText('');

    // If discussion is currently closed, reopen it
    const targetDiscId = activeDiscussion?.id || discId;
    if (activeDiscussion && activeDiscussion.status === 'closed') {
      const reopenRes = reopenDiscussionByUser(targetDiscId, userMessage);
      syncDiscussionState();
      scrollToBottom(true);
      return;
    }

    // Normal message recording
    recordLiveDiscussionMessage(targetDiscId, userMessage, 'registered', user.name, user.id);
    const updated = [...messages, userMessage];
    setMessages(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    scrollToBottom(true);

    // Also trigger simulated response if no real listener has claimed yet
    if (!activeDiscussion || !activeDiscussion.openedByListenerId) {
      setIsTyping(true);
      const listenerNames = [
        'Dr. Leila • Clinical Psychologist',
        'Youssef • Psychology Resident',
        'Kenza • Mental Health Listener',
      ];
      const randomListener = listenerNames[Math.floor(Math.random() * listenerNames.length)];

      setTimeout(() => {
        setIsTyping(false);

        const empatheticReplies = [
          `Thank you for putting that into words, ${user.name}. It takes vulnerability to articulate this. Notice how your body feels right now as you release that weight — take a slow breath. When did this feeling begin to feel so heavy?`,
          `I hear how deeply this is affecting you, ${user.name}. Please know that what you are feeling is completely valid given everything you've had to navigate. You don't have to figure it all out today. What feels like the hardest part for you right now?`,
          `Thank you for trusting me with this, ${user.name}. Carrying these thoughts alone can feel isolating. We are right here with you. If you could give yourself permission to set aside one expectation today, what would that be?`,
          `I'm listening closely, ${user.name}. You are doing the best you can under challenging circumstances. Let's take it one small step at a time. What would bring you a tiny bit of comfort or relief in this exact moment?`,
        ];

        const chosenReply = empatheticReplies[Math.floor(Math.random() * empatheticReplies.length)];

        const teamMessage: ChatMessage = {
          id: `msg_team_${Date.now()}`,
          sender: 'team',
          senderName: randomListener,
          text: chosenReply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        recordLiveDiscussionMessage(targetDiscId, teamMessage, 'registered', user.name, user.id);
        setMessages((prev) => {
          const next = [...prev, teamMessage];
          localStorage.setItem(storageKey, JSON.stringify(next));
          return next;
        });
      }, 1600);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2C332E] flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-[#E7E2D8]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              id="dashboard-brand-home-btn"
              onClick={onNavigateHome}
              className="flex items-center gap-2.5 text-left cursor-pointer group"
              title="Return to 3awdli Home"
            >
              <div className="w-10 h-10 rounded-2xl bg-[#315243] text-white flex items-center justify-center shadow-xs group-hover:bg-[#264134] transition-colors">
                <Heart className="w-5 h-5 text-emerald-200 fill-emerald-200/20" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold tracking-tight text-[#1F362C] font-['Lora',serif]">
                    3awdli
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E5EEE9] text-[#2F5342] font-semibold border border-[#D0E0D7]">
                    Personal Space
                  </span>
                </div>
                <p className="text-[11px] text-[#607067]">
                  Saved &amp; Protected Sanctuary
                </p>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Listener Discussions Menu Button */}
            {isListener && onNavigateDiscussions && (
              <button
                id="dashboard-discussions-btn"
                onClick={onNavigateDiscussions}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#224433] bg-[#E8F1EC] hover:bg-[#DAE8DF] border border-[#CCDED3] px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
                title="Open Listeners Discussions Workspace"
              >
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Discussions</span>
              </button>
            )}

            {/* Admin Portal Button */}
            {isAdmin && onNavigateAdmin && (
              <button
                id="dashboard-admin-btn"
                onClick={onNavigateAdmin}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#5B3720] bg-[#FBF0E4] hover:bg-[#F3E2D0] border border-[#E8D4C0] px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
                title="Open Admin Role Management Console"
              >
                <ShieldCheck className="w-4 h-4 text-[#8C4E23]" />
                <span className="hidden sm:inline">Admin Console</span>
                <span className="sm:hidden">Admin</span>
              </button>
            )}

            <button
              id="dashboard-emergency-btn"
              onClick={onOpenEmergencyModal}
              className="flex items-center gap-1.5 text-xs text-[#7A5043] hover:text-[#5E3B30] hover:bg-[#F8EFEB] px-3 py-2 rounded-xl transition-colors cursor-pointer"
            >
              <LifeBuoy className="w-3.5 h-3.5 text-[#B65E46]" />
              <span className="hidden sm:inline">Emergency Help</span>
            </button>

            <button
              id="dashboard-home-nav-btn"
              onClick={onNavigateHome}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[#384940] hover:text-[#1F3329] px-3 py-2 rounded-xl hover:bg-[#EFECE5] transition-colors cursor-pointer"
            >
              <Home className="w-4 h-4 text-[#315243]" />
              <span className="hidden sm:inline">Home</span>
            </button>

            <div className="h-5 w-px bg-[#DDD6CA] hidden sm:block"></div>

            <div className="flex items-center gap-2 pl-1">
              <div className="w-8 h-8 rounded-full bg-[#2F5141] text-emerald-100 flex items-center justify-center text-xs font-bold uppercase shadow-2xs">
                {user.name.charAt(0)}
              </div>
              <span className="text-xs font-semibold text-[#25392E] hidden md:inline">
                {user.name}
              </span>
            </div>

            <button
              id="dashboard-signout-btn"
              onClick={onSignOut}
              className="flex items-center gap-1.5 text-xs text-[#6B7971] hover:text-[#B64234] hover:bg-[#FBF0EE] px-2.5 sm:px-3 py-2 rounded-xl transition-colors cursor-pointer ml-1"
              title="Sign out of your space"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Personal Space Dashboard Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Special Role Notification Banner (For Listeners or Admins) */}
        {isListener && (
          <div className="mb-6 p-4 rounded-3xl bg-gradient-to-r from-[#EAF3EE] to-[#FAF8F5] border border-[#CFE1D6] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#294B3A] text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-emerald-200" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-[#1E3F2E]">
                    Verified Listener Badge Active
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-white text-[#294B3A] border border-[#CCDED3] font-medium flex items-center gap-1">
                    <Briefcase className="w-3 h-3 text-[#335B46]" />
                    {user.profession || 'Psychology Support Specialist'}
                  </span>
                  {isHead && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] font-semibold flex items-center gap-1">
                      <Star className="w-3 h-3 fill-amber-500 text-amber-600" />
                      Head of Listeners
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#5D7065] mt-0.5">
                  You have access to the dedicated listeners menu option: <strong>Discussions</strong>.
                </p>
              </div>
            </div>

            {onNavigateDiscussions && (
              <button
                onClick={onNavigateDiscussions}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#284939] hover:bg-[#1E372B] text-white text-xs font-semibold transition-colors cursor-pointer shrink-0 shadow-xs"
              >
                <span>Enter Discussions</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Special Banner for Admin */}
        {isAdmin && (
          <div className="mb-6 p-4 rounded-3xl bg-[#FBF0E4] border border-[#E9D4BF] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#884B20] text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#55321B]">
                  System Administrator Privilege
                </span>
                <p className="text-xs text-[#745037] mt-0.5">
                  You can search/browse all registered accounts, grant Listener badges, designate Head of Listeners, and issue access codes.
                </p>
              </div>
            </div>

            {onNavigateAdmin && (
              <button
                onClick={onNavigateAdmin}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#884B20] hover:bg-[#723E1A] text-white text-xs font-semibold transition-colors cursor-pointer shrink-0 shadow-xs"
              >
                <span>Open Admin Console</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
        {/* Welcome Banner */}
        <div className="bg-white border border-[#E3DDD1] rounded-3xl p-5 sm:p-7 shadow-xs mb-6 sm:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-semibold text-[#2B4E3E] uppercase tracking-wider">
                Saved Personal Session
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-['Lora',serif] text-[#1E2E25]">
              Peace be with you, {user.name}
            </h1>
            <p className="text-xs sm:text-sm text-[#5B6E63] mt-1 max-w-2xl leading-relaxed">
              Your conversations with our psychologists and psychology students are preserved here. You can step away whenever you need and return to read their replies.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-[#FAF8F5] border border-[#E4DFD5] rounded-2xl px-3.5 py-2.5 text-xs text-[#4F5E55]">
              <div className="flex items-center gap-1.5 font-semibold text-[#22392D] mb-0.5">
                <BookmarkCheck className="w-4 h-4 text-emerald-700" />
                <span>Auto-Saved History</span>
              </div>
              <p className="text-[11px] text-[#6F7F76]">
                {messages.filter(m => m.sender !== 'system').length} messages exchanged
              </p>
            </div>

            <div className="bg-[#FAF8F5] border border-[#E4DFD5] rounded-2xl px-3.5 py-2.5 text-xs text-[#4F5E55]">
              <div className="flex items-center gap-1.5 font-semibold text-[#22392D] mb-0.5">
                <Lock className="w-4 h-4 text-emerald-700" />
                <span>Private &amp; Bound</span>
              </div>
              <p className="text-[11px] text-[#6F7F76]">
                Only accessible by you
              </p>
            </div>
          </div>
        </div>

        {/* Dashboard Grid: Chat Window + Companion Shelf */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Column: Chat Feature (Tall, Focused Chat Window) */}
          <div className="lg:col-span-7 xl:col-span-7 flex flex-col items-center lg:items-start w-full">
            <div 
              id="personal-saved-chat-window"
              className="bg-white border border-[#DDD7CB] rounded-3xl shadow-sm overflow-hidden flex flex-col w-full max-w-[520px] h-[780px] min-h-[520px] max-h-[min(90vh,820px)]"
            >
              {/* Chat Header */}
              <header className="bg-[#315243] text-white px-5 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-emerald-200">
                    <Heart className="w-4 h-4 fill-emerald-200/20" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm sm:text-base font-semibold tracking-wide">
                        3awdli Support • Personal Space
                      </h2>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                        Preserved Thread
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-100/80 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-300 shrink-0" />
                      Saved &amp; encrypted &bull; Tied to {user.email}
                    </p>
                  </div>
                </div>

                <div className="text-right hidden sm:block">
                  <span className="text-[10px] text-emerald-200/80 block">Team Status</span>
                  <span className="text-xs font-semibold text-white flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Listeners Active
                  </span>
                </div>
              </header>

              {/* Banner note */}
              <div className="bg-[#F6F4EE] border-b border-[#EAE5DC] px-4 py-2 text-xs text-[#526359] flex items-center justify-between shrink-0">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Your conversation history is preserved across visits.</span>
                </span>
                <span className="text-[11px] text-[#7A8A80]">Confidential support</span>
              </div>

              {/* Listener Preference Banner */}
              <div className="bg-[#FAF7F2] border-b border-[#EAE3D6] px-4 py-2 text-xs text-[#526359] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#718277]">Listener Preference:</span>
                  <GenderPreferenceTag preference={activeDiscussion?.genderPreference || 'any'} />
                </div>
                <button
                  id="change-personal-gender-pref-btn"
                  onClick={() => setIsGenderModalOpen(true)}
                  className="text-[11px] font-semibold text-[#294B39] hover:text-[#183425] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>Change preference</span>
                </button>
              </div>

              {/* Messages Area */}
              <div className="relative flex-1 min-h-0 flex flex-col">
                <div 
                  ref={scrollContainerRef}
                  onScroll={handleScroll}
                  id="personal-chat-messages-area"
                  className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-[#FAF8F5] text-[#2C332F]"
                >
                {messages.map((msg) => {
                  if (msg.sender === 'system') {
                    return (
                      <div key={msg.id} className="flex flex-col items-center my-3">
                        <div className="bg-[#EBF2EE] border border-[#D3E3DA] text-[#28493A] text-xs px-4 py-2.5 rounded-2xl shadow-2xs max-w-[90%] text-center">
                          <div className="flex items-center justify-center gap-1.5 font-semibold mb-0.5 text-emerald-800">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Confidential Space Active</span>
                          </div>
                          <p className="text-[12px] text-[#244234] leading-relaxed">
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
                        <div className="bg-[#EAF4F3] border border-[#BCE1DB] text-[#113B37] text-xs sm:text-sm px-4 py-3 rounded-2xl rounded-tl-xs shadow-2xs leading-relaxed">
                          {msg.text}
                        </div>
                        <span className="text-[10px] text-[#7A8E82] pl-1">{msg.timestamp}</span>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className="flex flex-col items-end space-y-1 ml-auto max-w-[88%]">
                      <div className="flex items-center gap-1 text-[11px] text-[#55695E] font-medium pr-1">
                        <span>{user.name}</span>
                      </div>
                      <div className="bg-[#315243] text-white text-xs sm:text-sm px-4 py-3 rounded-2xl rounded-tr-xs shadow-2xs leading-relaxed">
                        {msg.text}
                      </div>
                      <span className="text-[10px] text-[#869289] pr-1">{msg.timestamp}</span>
                    </div>
                  );
                })}

                {/* Listener Attention Status Indicators */}
                {listenerAttention === 'typing' && !isClosed && (
                  <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-[#EAF4F3] border border-[#BDE0DB] text-[#113B37] w-fit text-xs animate-in fade-in shadow-2xs">
                    <span className="flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce delay-100"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce delay-200"></span>
                    </span>
                    <span className="font-medium text-xs">{activeListenerName || 'Listener'} is typing...</span>
                  </div>
                )}

                {listenerAttention === 'reading' && !isClosed && (
                  <div className="flex items-center gap-1.5 text-[11px] text-[#305748] bg-[#F2F7F4] border border-[#CCE0D6] px-3 py-1.5 rounded-xl w-fit animate-in fade-in">
                    <Eye className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Reading your message</span>
                  </div>
                )}

                {/* Discussion Closed Notification for Registered User */}
                {isClosed && (
                  <div className="bg-[#FAF7F2] border border-[#E5DCD0] rounded-2xl p-4 text-center space-y-2 my-3 shadow-2xs animate-in fade-in">
                    <div className="w-9 h-9 rounded-full bg-[#EAE2D5] text-[#5F4F3D] flex items-center justify-center mx-auto">
                      <BookmarkCheck className="w-4.5 h-4.5 text-[#5F4F3D]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#23382D]">Conversation Saved in History</h4>
                      <p className="text-xs text-[#5C6E64] mt-1 leading-relaxed max-w-md mx-auto">
                        Your conversation has ended for now. You can talk to us again anytime — you&apos;ll find this conversation saved in your discussion history.
                      </p>
                    </div>
                    <div className="text-[11px] text-[#315243] font-medium flex items-center justify-center gap-1">
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Type a message below anytime to reopen and reconnect</span>
                    </div>
                    <button
                      onClick={() => setIsGenderModalOpen(true)}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#315243] hover:bg-[#253E33] text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Start New Conversation / Choose Listener</span>
                    </button>
                  </div>
                )}

                {isTyping && !listenerAttention && (
                  <div className="flex items-center gap-2 text-xs text-[#5F7368] italic p-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce"></span>
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce delay-100"></span>
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce delay-200"></span>
                    <span className="ml-1">A team listener is thoughtfully reading and typing a reply...</span>
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

              {/* Quick Starter Chips */}
              <div className="px-4 py-2.5 bg-[#F6F3ED] border-t border-[#E8E2D7]">
                <p className="text-[11px] font-semibold text-[#617369] mb-1.5">
                  Need an opening reflection? Tap any topic to start:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {quickPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(prompt)}
                      className="text-[11.5px] bg-white hover:bg-[#EBF2EE] text-[#2C4839] border border-[#DDD6CA] hover:border-[#315243]/30 px-3 py-1 rounded-full transition-colors text-left cursor-pointer"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Input Form */}
              <div className="p-4 bg-white border-t border-[#E5DFD3]">
                <label 
                  htmlFor="personal-chat-input"
                  className="block text-xs font-semibold text-[#263E31] mb-1.5 flex items-center justify-between"
                >
                  <span>
                    {isClosed ? 'Reopen conversation with a message:' : `What is on your mind today, ${user.name}?`}
                  </span>
                  <span className="text-[11px] text-[#798A80] font-normal hidden sm:inline">
                    Press Enter to send
                  </span>
                </label>

                <div className="flex items-center gap-2 bg-[#FAF8F5] border-2 border-[#D7D0C2] focus-within:border-[#315243] focus-within:bg-white rounded-2xl px-3.5 py-2.5 transition-all">
                  <input
                    ref={inputRef}
                    id="personal-chat-input"
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      isClosed 
                        ? "Type here to reopen this conversation and message your listener..." 
                        : "Write anything you are carrying or experiencing..."
                    }
                    className="w-full bg-transparent text-xs sm:text-sm text-[#1F2F26] placeholder-[#819086] outline-none font-medium"
                  />
                  <button
                    id="personal-chat-send-btn"
                    onClick={() => handleSendMessage()}
                    disabled={!inputText.trim() || isTyping}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                      inputText.trim() && !isTyping
                        ? 'bg-[#315243] text-white hover:bg-[#253E33] shadow-xs'
                        : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                    }`}
                  >
                    <span>{isClosed ? 'Reopen & Send' : 'Send'}</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#78887F] px-1">
                  <span className="flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    For psychological support and listening. If in immediate physical danger, call emergency services.
                  </span>
                  <span className="text-[10.5px] italic text-[#8B9890] hidden md:inline">
                    Everything auto-saved
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: User Profile Sanctuary & Grounding Companion */}
          <div className="lg:col-span-5 xl:col-span-5 space-y-6 w-full">
            {/* Account Card */}
            <div className="bg-white border border-[#E3DDD1] rounded-3xl p-5 sm:p-6 shadow-xs">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-2xl bg-[#E8F1EC] text-[#2D4D3D] flex items-center justify-center font-bold text-base border border-[#CEE0D6]">
                  {user.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E2E25] font-['Lora',serif]">
                    {user.name}
                  </h3>
                  <p className="text-xs text-[#697B71]">
                    {user.email}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-xs border-t border-[#EBE6DD] pt-3.5 text-[#516358]">
                <div className="flex justify-between">
                  <span className="text-[#78887F]">Space Registered:</span>
                  <span className="font-semibold text-[#293B30]">{user.createdAt}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#78887F]">Data Protection:</span>
                  <span className="font-semibold text-emerald-800">100% Confidential</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#78887F]">Status:</span>
                  <span className="font-semibold text-[#2A4839]">Active Personal Member</span>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-[#EBE6DD]">
                <button
                  onClick={onSignOut}
                  className="w-full py-2 px-3 text-xs font-semibold text-[#8B362A] hover:bg-[#FBF0EE] rounded-xl border border-[#EDD5D0] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out of Personal Space</span>
                </button>
              </div>
            </div>

            {/* Grounding / Breathing Companion */}
            <div className="bg-white border border-[#E3DDD1] rounded-3xl p-5 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#EBF2EE] text-[#315243] flex items-center justify-center">
                    <Wind className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-[#23332A] font-['Lora',serif]">
                    Calm Breathing Space
                  </h3>
                </div>

                <button
                  onClick={() => setBreathingActive(!breathingActive)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                    breathingActive 
                      ? 'bg-[#315243] text-white' 
                      : 'bg-[#F0ECE3] text-[#384B3F] hover:bg-[#E4DFD4]'
                  }`}
                >
                  {breathingActive ? 'Stop' : 'Start'}
                </button>
              </div>

              <p className="text-xs text-[#5D6F64] mb-4 leading-relaxed">
                When thoughts race or emotion feels overwhelming, a simple rhythm helps ground your nervous system.
              </p>

              {breathingActive ? (
                <div className="flex flex-col items-center justify-center py-5 bg-[#FAF8F5] rounded-2xl border border-[#E4DDD0]">
                  <div 
                    className={`w-20 h-20 rounded-full flex items-center justify-center font-bold text-white transition-all duration-1000 shadow-sm ${
                      breathingPhase === 'Inhale' 
                        ? 'scale-110 bg-[#315243]' 
                        : breathingPhase === 'Hold' 
                        ? 'scale-105 bg-[#4A725E]' 
                        : 'scale-90 bg-[#7B9E8B]'
                    }`}
                  >
                    <span className="text-xs tracking-wider uppercase font-semibold">
                      {breathingPhase}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-[#55695E] mt-3 font-medium">
                    {breathingPhase === 'Inhale' && 'Slowly breathe in through your nose...'}
                    {breathingPhase === 'Hold' && 'Gently hold your breath...'}
                    {breathingPhase === 'Exhale' && 'Slowly release through your mouth...'}
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-[#FAF8F5] rounded-2xl border border-[#E8E2D6] text-[11.5px] text-[#5D6F64]">
                  <p className="font-semibold text-[#293F33] mb-1">4-4-4 Grounding Rhythm</p>
                  <p>Tap &quot;Start&quot; above whenever you need a quick 60 seconds to recenter before typing.</p>
                </div>
              )}
            </div>

            {/* Need immediate crisis help? */}
            <div className="bg-[#FAF0ED] border border-[#ECD9D4] rounded-3xl p-5 text-xs text-[#6C3F34]">
              <div className="flex items-center gap-2 font-bold text-[#8C3423] mb-1">
                <LifeBuoy className="w-4 h-4 text-[#B54A34]" />
                <span>Immediate Danger or Crisis?</span>
              </div>
              <p className="text-[11.5px] text-[#7A4B40] leading-relaxed mb-3">
                3awdli provides supportive listening. If you are experiencing severe distress or thoughts of self-harm, please reach out to emergency resources right away.
              </p>
              <button
                onClick={onOpenEmergencyModal}
                className="w-full py-2 bg-[#8C3423] hover:bg-[#722A1C] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                View Emergency Helplines
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Gender Preference Modal */}
      <GenderPreferenceModal
        isOpen={isGenderModalOpen}
        currentPreference={activeDiscussion?.genderPreference || 'any'}
        onClose={() => setIsGenderModalOpen(false)}
        onConfirm={handleConfirmGenderPreference}
      />
    </div>
  );
};
