import { ConversationShareRequest, UserAccount } from '../types';
import { joinDiscussion, takeoverDiscussion } from './discussionManagement';

const SHARE_REQUESTS_STORAGE_KEY = '3awdli_share_requests';
const ONLINE_USERS_STORAGE_KEY = '3awdli_online_users';

// Seed default online users so there are both active online listeners and offline ones
const DEFAULT_ONLINE_USERS = [
  'user_sample_03', // Dr. Youssef El Alami (Head of Listeners)
  'user_sample_06', // Dr. Amina Mansouri
  'user_admin_01',  // Aymane Oumlala (Admin)
];

// Seed initial share request for immediate testing by listeners / supervisors
const DEFAULT_INITIAL_SHARE_REQUESTS: ConversationShareRequest[] = [
  {
    id: 'share_req_sample_01',
    discussionId: 'disc_claimed_105',
    discussionTitle: 'Anonymous Visitor #105 (Healthcare Shift Burnout)',
    fromListenerId: 'listener_other_leila',
    fromListenerName: 'Dr. Leila Senhaji',
    fromListenerProfession: 'Clinical Psychologist',
    fromListenerGender: 'Female',
    toUserId: 'user_sample_03', // Dr. Youssef El Alami (Head of Listeners)
    toUserName: 'Dr. Youssef El Alami',
    toUserProfession: 'Senior Clinical Psychologist & Counselor',
    toUserRole: 'Head of Listeners',
    toUserGender: 'Male',
    subject: 'Case Consultation: High Fatigue & Sleep Deprivation',
    description: 'The visitor is a resident doctor experiencing acute panic episodes before medical rounds. Requesting your clinical oversight or takeover for specialized resilience strategies.',
    status: 'pending',
    createdAt: '12 minutes ago',
    createdAtTimestamp: Date.now() - 12 * 60 * 1000,
  },
];

export function getOnlineUserIds(): string[] {
  try {
    const raw = localStorage.getItem(ONLINE_USERS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(ONLINE_USERS_STORAGE_KEY, JSON.stringify(DEFAULT_ONLINE_USERS));
      return DEFAULT_ONLINE_USERS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_ONLINE_USERS;
  }
}

export function isUserOnline(userId: string): boolean {
  const onlineIds = getOnlineUserIds();
  return onlineIds.includes(userId);
}

export function setUserOnlineStatus(userId: string, isOnline: boolean): void {
  try {
    const current = getOnlineUserIds();
    let updated: string[];
    if (isOnline) {
      updated = Array.from(new Set([...current, userId]));
    } else {
      updated = current.filter((id) => id !== userId);
    }
    localStorage.setItem(ONLINE_USERS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to update online status:', err);
  }
}

export function getStoredShareRequests(): ConversationShareRequest[] {
  try {
    const raw = localStorage.getItem(SHARE_REQUESTS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(SHARE_REQUESTS_STORAGE_KEY, JSON.stringify(DEFAULT_INITIAL_SHARE_REQUESTS));
      return DEFAULT_INITIAL_SHARE_REQUESTS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_INITIAL_SHARE_REQUESTS;
  }
}

export function saveStoredShareRequests(requests: ConversationShareRequest[]): void {
  try {
    localStorage.setItem(SHARE_REQUESTS_STORAGE_KEY, JSON.stringify(requests));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('3awdli_share_request_updated'));
      window.dispatchEvent(new Event('storage'));
    }
  } catch (err) {
    console.error('Failed to save share requests:', err);
  }
}

export function createShareRequest(data: {
  discussionId: string;
  discussionTitle?: string;
  fromListenerId: string;
  fromListenerName: string;
  fromListenerProfession?: string;
  fromListenerGender?: 'Male' | 'Female';
  toUserId: string;
  toUserName: string;
  toUserProfession?: string;
  toUserRole?: string;
  toUserGender?: 'Male' | 'Female';
  subject: string;
  description: string;
}): ConversationShareRequest {
  const allRequests = getStoredShareRequests();
  const now = new Date();
  const formattedTime = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const newRequest: ConversationShareRequest = {
    id: `share_req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    discussionId: data.discussionId,
    discussionTitle: data.discussionTitle,
    fromListenerId: data.fromListenerId,
    fromListenerName: data.fromListenerName,
    fromListenerProfession: data.fromListenerProfession,
    fromListenerGender: data.fromListenerGender,
    toUserId: data.toUserId,
    toUserName: data.toUserName,
    toUserProfession: data.toUserProfession,
    toUserRole: data.toUserRole,
    toUserGender: data.toUserGender,
    subject: data.subject.trim(),
    description: data.description.trim(),
    status: 'pending',
    createdAt: formattedTime,
    createdAtTimestamp: Date.now(),
  };

  const updated = [newRequest, ...allRequests];
  saveStoredShareRequests(updated);
  return newRequest;
}

export function getShareRequestsForDiscussion(discussionId: string): ConversationShareRequest[] {
  const all = getStoredShareRequests();
  return all.filter((r) => r.discussionId === discussionId);
}

// Get incoming share requests targeted to a specific listener
export function getIncomingShareRequests(userId: string): ConversationShareRequest[] {
  const all = getStoredShareRequests();
  return all.filter((r) => r.toUserId === userId);
}

// Get pending incoming share requests
export function getPendingIncomingShareRequests(userId: string): ConversationShareRequest[] {
  const all = getStoredShareRequests();
  return all.filter((r) => r.toUserId === userId && r.status === 'pending');
}

// Get outgoing share requests sent by this listener
export function getSentShareRequests(userId: string): ConversationShareRequest[] {
  const all = getStoredShareRequests();
  return all.filter((r) => r.fromListenerId === userId);
}

// Get unread/active notifications count for a user (pending incoming requests + unacknowledged updates)
export function getUnreadShareNotificationsCount(userId: string): number {
  const pendingIncoming = getPendingIncomingShareRequests(userId);
  return pendingIncoming.length;
}

// DENY a share request with reason sent back to the requester
export function denyShareRequest(
  requestId: string,
  denialReason: string,
  recipientUser: UserAccount
): { success: boolean; request?: ConversationShareRequest; error?: string } {
  const all = getStoredShareRequests();
  const index = all.findIndex((r) => r.id === requestId);
  if (index === -1) {
    return { success: false, error: 'Share request not found.' };
  }

  const req = all[index];
  if (req.status !== 'pending') {
    return { success: false, error: 'This request has already been responded to.' };
  }

  const nowFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  req.status = 'denied';
  req.responseType = 'denied';
  req.denialReason = denialReason.trim() || 'Unavailable at this time';
  req.respondedAt = `Today at ${nowFormatted}`;
  req.respondedAtTimestamp = Date.now();

  all[index] = req;
  saveStoredShareRequests(all);

  return { success: true, request: req };
}

// ACCEPT a share request: OPTION A (Join alongside original listener)
export function acceptShareRequestJoin(
  requestId: string,
  recipientUser: UserAccount
): { success: boolean; request?: ConversationShareRequest; error?: string } {
  const all = getStoredShareRequests();
  const index = all.findIndex((r) => r.id === requestId);
  if (index === -1) {
    return { success: false, error: 'Share request not found.' };
  }

  const req = all[index];
  if (req.status !== 'pending') {
    return { success: false, error: 'This request has already been responded to.' };
  }

  const nowFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Update discussion to add recipient as joined listener
  const joinRes = joinDiscussion(req.discussionId, recipientUser);
  if (!joinRes.success) {
    return { success: false, error: joinRes.error || 'Failed to join conversation.' };
  }

  req.status = 'accepted';
  req.responseType = 'joined';
  req.respondedAt = `Today at ${nowFormatted}`;
  req.respondedAtTimestamp = Date.now();

  all[index] = req;
  saveStoredShareRequests(all);

  return { success: true, request: req };
}

// ACCEPT a share request: OPTION B (Take over conversation & exclude original listener)
export function acceptShareRequestTakeover(
  requestId: string,
  recipientUser: UserAccount
): { success: boolean; request?: ConversationShareRequest; error?: string } {
  const all = getStoredShareRequests();
  const index = all.findIndex((r) => r.id === requestId);
  if (index === -1) {
    return { success: false, error: 'Share request not found.' };
  }

  const req = all[index];
  if (req.status !== 'pending') {
    return { success: false, error: 'This request has already been responded to.' };
  }

  const nowFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Take over discussion and exclude original listener
  const takeoverRes = takeoverDiscussion(
    req.discussionId,
    recipientUser,
    req.fromListenerId,
    req.fromListenerName
  );
  if (!takeoverRes.success) {
    return { success: false, error: takeoverRes.error || 'Failed to take over conversation.' };
  }

  req.status = 'accepted';
  req.responseType = 'takeover';
  req.respondedAt = `Today at ${nowFormatted}`;
  req.respondedAtTimestamp = Date.now();

  all[index] = req;
  saveStoredShareRequests(all);

  return { success: true, request: req };
}

