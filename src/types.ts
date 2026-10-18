export interface ChatMessage {
  id: string;
  sender: 'system' | 'user' | 'team';
  senderName?: string;
  senderId?: string;
  text: string;
  timestamp: string;
  timestampMs?: number;
}

export type UserRole = 'admin' | 'administrator' | 'listener' | 'user' | 'host' | 'facilitator' | 'writer';
export type Gender = 'Male' | 'Female';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  role?: UserRole;
  is_host?: boolean;
  is_facilitator?: boolean;
  is_founder?: boolean;
  is_administrator?: boolean;
  is_listener?: boolean;
  isListener?: boolean;
  is_head_of_listeners?: boolean;
  is_writer?: boolean;
  profession?: string;
  gender?: Gender;
  listener_granted_at?: string;
  listener_key_code?: string;
  avatar?: string;
  avatarUrl?: string;
  is_banned?: boolean;
  bannedAt?: string;
  banReason?: string;
  bannedBy?: string;
  warning_count?: number;
  warningsCount?: number;
}

export type User = UserAccount;

export interface ReportSanction {
  id: string;
  reportId: string;
  targetId?: string;
  targetName: string;
  targetEmail?: string;
  targetRole?: string;
  targetType: 'registered' | 'anonymous';
  action: 'warning' | 'ban';
  warningMessage?: string;
  customMessage?: string;
  sanctionedByAdminId: string;
  sanctionedByAdminName: string;
  sanctionedAt: string;
  sanctionedAtTimestamp: number;
  deliveryMethod?: 'mailbox' | 'email' | 'browser_cookie';
}

export interface ConversationShareRequest {
  id: string;
  discussionId: string;
  discussionTitle?: string;
  fromListenerId: string;
  fromListenerName: string;
  fromListenerProfession?: string;
  fromListenerGender?: Gender;
  fromListenerEmail?: string;
  toUserId: string;
  toUserName: string;
  toUserProfession?: string;
  toUserRole?: string;
  toUserGender?: Gender;
  toUserEmail?: string;
  subject: string;
  description: string;
  status: 'pending' | 'accepted' | 'denied';
  createdAt: string;
  createdAtTimestamp: number;
  respondedAt?: string;
  respondedAtTimestamp?: number;
  responseType?: 'joined' | 'takeover' | 'denied';
  denialReason?: string;
}

export type ListenerGenderPreference = 'male' | 'female' | 'any';

export interface DiscussionParticipant {
  id: string;
  name: string;
  role: 'user' | 'listener' | 'head_of_listeners' | 'admin';
  profession?: string;
  gender?: Gender;
  status: 'active' | 'excluded';
  joinedAt?: string;
  excludedAt?: string;
  excludedAtTimestamp?: number;
  isOriginalListener?: boolean;
  isYou?: boolean;
}

export interface DiscussionExcludedListener {
  listenerId: string;
  listenerName: string;
  listenerProfession?: string;
  listenerGender?: Gender;
  excludedAt: string;
  excludedAtTimestamp: number;
  reason?: string;
  newListenerName?: string;
}

export interface DiscussionConversation {
  id: string;
  type: 'anonymous' | 'registered';
  userName?: string;
  userEmail?: string;
  userId?: string;
  creatorId?: string;
  ownerId?: string;
  startedAt: string;
  startedAtTimestamp: number;
  status: 'unopened' | 'opened' | 'closed';
  genderPreference?: ListenerGenderPreference;
  openedByListenerId?: string;
  openedByListenerName?: string;
  openedAt?: string;
  openedAtTimestamp?: number;
  closedAt?: string;
  closedAtTimestamp?: number;
  closedByRole?: 'listener' | 'user';
  closedByUserId?: string;
  closedByUserName?: string;
  closedByListenerId?: string;
  closedByListenerName?: string;
  reopenedAt?: string;
  reopenedAtTimestamp?: number;
  listenerAttentionStatus?: 'reading' | 'typing' | 'idle' | null;
  listenerAttentionTimestamp?: number;
  listenerUnavailable?: boolean;
  allListenersBusyOnCreate?: boolean;
  messages: ChatMessage[];
  participants?: DiscussionParticipant[];
  joinedListenerId?: string;
  joinedListenerName?: string;
  joinedListenerProfession?: string;
  joinedListenerGender?: Gender;
  joinedListenerRole?: string;
  joinedAt?: string;
  excludedListeners?: DiscussionExcludedListener[];
  activeCall?: DiscussionVoiceCall | null;
}

export type CallStatus = 'ringing' | 'active' | 'ended';

export interface DiscussionVoiceCall {
  id: string;
  status: CallStatus;
  callerId: string;
  callerName: string;
  callerRole: 'user' | 'listener';
  receiverId?: string;
  receiverName?: string;
  receiverRole?: 'user' | 'listener';
  startedAtTimestamp: number;
  acceptedAtTimestamp?: number;
  endedAtTimestamp?: number;
  endedByRole?: 'user' | 'listener' | 'timeout';
  isMuted?: {
    user?: boolean;
    listener?: boolean;
  };
}

export type ViewState = 'home' | 'signin' | 'signup' | 'dashboard' | 'admin' | 'member-management' | 'discussions' | 'games' | 'lounge' | 'teen-space' | 'user-mailbox' | 'reports' | 'admin-reports' | 'admin-support' | 'reset-password' | 'rules' | 'valsalva' | 'schedules';
export type AuthMode = 'signin' | 'signup' | null;

export type ScheduleWindowType = 'specific_date' | 'weekly_recurring';

export interface ChatScheduleWindow {
  id: string;
  title?: string;
  type: ScheduleWindowType;
  date?: string; // YYYY-MM-DD
  dates?: string[]; // Multiple specific dates
  dayOfWeek?: number; // 0=Sunday, 1=Monday... 6=Saturday
  daysOfWeek?: number[]; // [1, 3, 5]
  startTime: string; // "HH:mm" (24h)
  endTime: string; // "HH:mm" (24h)
  timezone?: string;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  createdAtTimestamp: number;
  createdBy?: string;
  createdByName?: string;
  updatedAt?: string;
  updatedAtTimestamp?: number;
}

export interface UserMailboxMessage {
  id: string;
  userId: string;
  userEmail?: string;
  senderName: string;
  senderRole?: 'team' | 'admin' | 'moderator' | 'listener';
  subject: string;
  summary?: string;
  content: string;
  createdAt: string;
  createdAtTimestamp: number;
  read: boolean;
  type?: 'report_reply' | 'support_reply' | 'team_notice' | 'general';
  relatedId?: string; // Links to future reports or support tickets
}

export interface DiscussionReportReply {
  id: string;
  reportId: string;
  responderId: string;
  responderName: string;
  responderRole: string; // e.g., 'Head of Listeners' | 'Supervisor'
  content: string;
  createdAt: string;
  createdAtTimestamp: number;
}

export interface AdminReportReply {
  id: string;
  reportId: string;
  adminId: string;
  adminName: string;
  adminEmail?: string;
  content: string;
  createdAt: string;
  createdAtTimestamp: number;
}

export interface DiscussionReport {
  id: string;
  discussionId: string;
  discussionTitle?: string;
  discussionType?: 'anonymous' | 'registered';
  reporterId: string;
  reporterName: string;
  reporterEmail?: string;
  reporterRole?: string;
  reportedMessageIds: string[];
  reportedMessages: ChatMessage[];
  reason: string;
  createdAt: string;
  createdAtTimestamp: number;
  status: 'pending' | 'reviewed' | 'replied';
  replies?: DiscussionReportReply[];
  lastRepliedAt?: string;
  lastRepliedAtTimestamp?: number;
  lastRepliedBy?: string;
  lastRepliedByName?: string;
  // Transfer to Administrator fields
  isTransferredToAdmin?: boolean;
  transferredByHeadId?: string;
  transferredByHeadName?: string;
  transferredByHeadEmail?: string;
  transferredNote?: string;
  transferredAt?: string;
  transferredAtTimestamp?: number;
  transferStatus?: 'pending_admin' | 'replied_by_admin';
  adminReplies?: AdminReportReply[];
  lastAdminRepliedAt?: string;
  lastAdminRepliedAtTimestamp?: number;
  lastAdminRepliedBy?: string;
  lastAdminRepliedByName?: string;
  sanctions?: ReportSanction[];
}

export interface TeenSpaceArticle {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  authorId: string;
  authorName: string;
  authorEmail?: string;
  authorProfession?: string;
  authorGender?: Gender;
  createdAt: string;
  createdAtTimestamp: number;
  updatedAt?: string;
  updatedAtTimestamp?: number;
  is_hidden?: boolean;
  hiddenAt?: string;
  hiddenAtTimestamp?: number;
  hiddenBy?: string;
}

export interface LoungeArticle {
  id: string;
  title: string;
  content: string;
  scheduledOpening: string;
  scheduledOpeningTimestamp: number;
  durationMinutes?: number;
  isClosed?: boolean;
  closedAt?: string;
  authorId: string;
  authorName: string;
  authorEmail?: string;
  createdAt: string;
  createdAtTimestamp: number;
  updatedAt?: string;
  updatedAtTimestamp?: number;
  is_hidden?: boolean;
  hiddenAt?: string;
  hiddenAtTimestamp?: number;
  hiddenBy?: string;
}

export type SupportCategory = 
  | 'technical'
  | 'account'
  | 'feedback'
  | 'report_listener'
  | 'account_ban'
  | 'general';

export interface SupportRequest {
  id: string;
  subject: string;
  message: string;
  email: string;
  category?: SupportCategory;
  reportedListenerOrDiscussion?: string;
  priority?: 'urgent' | 'high' | 'normal';
  destinationEmail?: string;
  userId?: string;
  userName?: string;
  createdAt: string;
  createdAtTimestamp: number;
  status: 'new' | 'in_progress' | 'resolved';
  resolvedAt?: string;
  adminNotes?: string;
}

export type LoungeQueueMemberStatus = 'waiting' | 'called' | 'admitted' | 'missed' | 'left';

export interface LoungeQueueMember {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  avatarUrl?: string;
  queueNumber: number; // 1, 2, 3...
  joinedAt: string;
  joinedAtTimestamp: number;
  status: LoungeQueueMemberStatus;
  admittedAtTimestamp?: number;
  calledAtTimestamp?: number;
  missedAtTimestamp?: number;
}

export interface LoungeQueueState {
  articleId: string;
  isQueueOpen: boolean; // Set to true when Host opens the queue
  openedAtTimestamp?: number | null;
  currentCalledMemberId?: string | null;
  currentCalledQueueNumber?: number | null;
  currentCalledUserName?: string | null;
  callStartedAtTimestamp?: number | null;
  callExpiresAtTimestamp?: number | null; // 1 minute after call started
  admittedCount: number; // Max 8 from queue
  roomParticipantsCount: number; // Max 10 total (Host + initial + admitted)
  isRoomClosed: boolean;
  closedAtTimestamp?: number | null;
  closedReason?: 'capacity_reached' | 'host_manual' | 'time_expired' | null;
  members: LoungeQueueMember[];
}

export interface LoungeColorOption {
  id: string;
  name: string;
  hex: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
}

export interface LoungeChatMessage {
  id: string;
  articleId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  isHost: boolean;
  colorHex: string;
  colorName?: string;
  text: string;
  timestamp: number;
  formattedTime: string;
}

export interface LoungeRoomParticipant {
  userId: string;
  userName: string;
  userAvatar?: string;
  isHost: boolean;
  colorHex: string;
  colorName: string;
  joinedAtTimestamp: number;
}

export interface LoungeRoomData {
  articleId: string;
  participants: LoungeRoomParticipant[];
  chosenColorIds: Record<string, string>; // userId -> colorId
  messages: LoungeChatMessage[];
}

export type RuleVisibilityRole = 'all' | 'listeners' | 'head_of_listeners' | 'administrators';

export interface LocalizedRuleField {
  en: string;
  fr: string;
  ar: string;
}

export interface RuleCategory {
  id: string;
  systemKey?: 'general' | 'listeners' | 'head_of_listeners' | 'administrators';
  title: LocalizedRuleField;
  content: LocalizedRuleField;
  targetRole: RuleVisibilityRole;
  isCustom?: boolean;
  order: number;
  createdAt?: string;
  createdAtTimestamp?: number;
  updatedAt?: string;
  updatedAtTimestamp?: number;
  updatedBy?: string;
}

