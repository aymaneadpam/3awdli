export interface ChatMessage {
  id: string;
  sender: 'system' | 'user' | 'team';
  senderName?: string;
  senderId?: string;
  text: string;
  timestamp: string;
  timestampMs?: number;
}

export type UserRole = 'admin' | 'listener' | 'user';
export type Gender = 'Male' | 'Female';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  role?: UserRole;
  is_listener?: boolean;
  isListener?: boolean;
  is_head_of_listeners?: boolean;
  profession?: string;
  gender?: Gender;
  listener_granted_at?: string;
  listener_key_code?: string;
}

export interface ConversationShareRequest {
  id: string;
  discussionId: string;
  discussionTitle?: string;
  fromListenerId: string;
  fromListenerName: string;
  fromListenerProfession?: string;
  fromListenerGender?: Gender;
  toUserId: string;
  toUserName: string;
  toUserProfession?: string;
  toUserRole?: string;
  toUserGender?: Gender;
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
  startedAt: string;
  startedAtTimestamp: number;
  status: 'unopened' | 'opened' | 'closed';
  genderPreference?: ListenerGenderPreference;
  openedByListenerId?: string;
  openedByListenerName?: string;
  openedAt?: string;
  closedAt?: string;
  closedByListenerId?: string;
  closedByListenerName?: string;
  reopenedAt?: string;
  listenerAttentionStatus?: 'reading' | 'typing' | 'idle' | null;
  listenerAttentionTimestamp?: number;
  listenerUnavailable?: boolean;
  messages: ChatMessage[];
  participants?: DiscussionParticipant[];
  joinedListenerId?: string;
  joinedListenerName?: string;
  joinedListenerProfession?: string;
  joinedListenerGender?: Gender;
  joinedListenerRole?: string;
  joinedAt?: string;
  excludedListeners?: DiscussionExcludedListener[];
}

export type ViewState = 'home' | 'signin' | 'signup' | 'dashboard' | 'admin' | 'discussions';
export type AuthMode = 'signin' | 'signup' | null;

