import { ConversationShareRequest, UserAccount } from '../types';
import { joinDiscussion, takeoverDiscussion } from './discussionManagement';
import { getStoredUsers, getCurrentUser, isAdministrator, StoredUser } from './userManagement';
import {
  saveShareRequestToFirestore,
  fetchShareRequestsFromFirestore,
  subscribeToShareRequests
} from '../lib/firestoreService';

const SHARE_REQUESTS_STORAGE_KEY = '3awdli_share_requests';
const ONLINE_USERS_STORAGE_KEY = '3awdli_online_users';

const DEFAULT_ONLINE_USERS: string[] = ['team_listener_amina'];

const DEFAULT_INITIAL_SHARE_REQUESTS: ConversationShareRequest[] = [];

export function isFakeShareRequest(r: Partial<ConversationShareRequest> | null | undefined): boolean {
  if (!r) return true;
  if (r.id?.startsWith('share_req_sample_')) return true;
  if (r.fromListenerEmail?.includes('@example.com') || r.toUserEmail?.includes('@example.com')) return true;
  if (r.fromListenerId?.startsWith('user_sample_') || r.toUserId?.startsWith('user_sample_')) return true;
  return false;
}

export function getOnlineUserIds(): string[] {
  try {
    const raw = localStorage.getItem(ONLINE_USERS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(ONLINE_USERS_STORAGE_KEY, JSON.stringify(DEFAULT_ONLINE_USERS));
      return DEFAULT_ONLINE_USERS;
    }
    const list: string[] = JSON.parse(raw);
    const validList = Array.isArray(list) ? list : DEFAULT_ONLINE_USERS;

    // Always include current active user if logged in
    const currentUser = getCurrentUser();
    if (currentUser?.id && !validList.includes(currentUser.id)) {
      return [...validList, currentUser.id];
    }
    return validList;
  } catch {
    const currentUser = getCurrentUser();
    return currentUser?.id ? [currentUser.id] : DEFAULT_ONLINE_USERS;
  }
}

export function isUserOnline(userId: string): boolean {
  if (!userId) return false;
  const currentUser = getCurrentUser();
  if (currentUser?.id === userId) return true;
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('3awdli_online_users_updated', { detail: { onlineIds: updated } }));
    }
  } catch (err) {
    console.error('Failed to update online status:', err);
  }
}

/**
 * Returns everyone currently connected (online) who has one of the roles:
 * Listener, Head of Listeners, Administrator, or Admin.
 */
export function getConnectedTeamMembers(): StoredUser[] {
  const allUsers = getStoredUsers();
  const onlineIds = new Set(getOnlineUserIds());

  const currentUser = getCurrentUser();
  if (currentUser?.id) {
    onlineIds.add(currentUser.id);
  }

  return allUsers.filter((u) => {
    const isListener = Boolean(u.is_listener || u.isListener || u.role === 'listener');
    const isHead = Boolean(u.is_head_of_listeners);
    const isAdmin = Boolean(
      u.role === 'admin' ||
      u.role === 'administrator' ||
      u.is_administrator ||
      isAdministrator(u)
    );

    if (!isListener && !isHead && !isAdmin) {
      return false;
    }

    return onlineIds.has(u.id);
  });
}

export function getStoredShareRequests(): ConversationShareRequest[] {
  try {
    const raw = localStorage.getItem(SHARE_REQUESTS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(SHARE_REQUESTS_STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    const parsed: ConversationShareRequest[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const clean = parsed.filter((r) => !isFakeShareRequest(r));
    if (clean.length !== parsed.length) {
      localStorage.setItem(SHARE_REQUESTS_STORAGE_KEY, JSON.stringify(clean));
    }
    return clean;
  } catch {
    return [];
  }
}

export function saveStoredShareRequests(requests: ConversationShareRequest[], changedRequest?: ConversationShareRequest): void {
  try {
    const clean = requests.filter((r) => !isFakeShareRequest(r));
    localStorage.setItem(SHARE_REQUESTS_STORAGE_KEY, JSON.stringify(clean));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('3awdli_share_request_updated'));
      window.dispatchEvent(new Event('3awdli_share_request_created'));
      window.dispatchEvent(new Event('storage'));
    }
    // Save only changed item to Firestore to prevent quota exhaustion
    if (changedRequest && !isFakeShareRequest(changedRequest)) {
      saveShareRequestToFirestore(changedRequest).catch((e) =>
        console.warn('Firestore share request save notice:', e)
      );
    }
  } catch (err) {
    console.error('Failed to save share requests:', err);
  }
}

let isShareSyncInitialized = false;

// Initialize real-time Firestore sync for share requests
export function initFirestoreShareRequestsSync(): () => void {
  if (isShareSyncInitialized) {
    return () => {};
  }
  isShareSyncInitialized = true;

  // 1. Initial fetch from Firestore
  fetchShareRequestsFromFirestore()
    .then((remoteReqs) => {
      if (remoteReqs && remoteReqs.length > 0) {
        const cleanRemote = remoteReqs.filter((r) => !isFakeShareRequest(r));
        const local = getStoredShareRequests();
        const mergedMap = new Map<string, ConversationShareRequest>();
        local.forEach((r) => mergedMap.set(r.id, r));
        cleanRemote.forEach((r) => {
          const existing = mergedMap.get(r.id);
          mergedMap.set(r.id, { ...existing, ...r });
        });
        const merged = Array.from(mergedMap.values());
        localStorage.setItem(SHARE_REQUESTS_STORAGE_KEY, JSON.stringify(merged));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('3awdli_share_request_updated'));
        }
      }
    })
    .catch((err) => {
      console.warn('Initial Firestore share requests fetch notice:', err);
    });

  // 2. Real-time Firestore subscription
  const unsubscribeFirestore = subscribeToShareRequests((remoteReqs) => {
    if (!remoteReqs) return;
    const cleanRemote = remoteReqs.filter((r) => !isFakeShareRequest(r));
    const local = getStoredShareRequests();
    const mergedMap = new Map<string, ConversationShareRequest>();
    local.forEach((r) => mergedMap.set(r.id, r));
    cleanRemote.forEach((r) => {
      const existing = mergedMap.get(r.id);
      mergedMap.set(r.id, { ...existing, ...r });
    });
    const merged = Array.from(mergedMap.values());
    localStorage.setItem(SHARE_REQUESTS_STORAGE_KEY, JSON.stringify(merged));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('3awdli_share_request_updated'));
    }
  });

  return () => {
    isShareSyncInitialized = false;
    unsubscribeFirestore();
  };
}

export function createShareRequest(data: {
  discussionId: string;
  discussionTitle?: string;
  fromListenerId: string;
  fromListenerName: string;
  fromListenerProfession?: string;
  fromListenerGender?: 'Male' | 'Female';
  fromListenerEmail?: string;
  toUserId: string;
  toUserName: string;
  toUserProfession?: string;
  toUserRole?: string;
  toUserGender?: 'Male' | 'Female';
  toUserEmail?: string;
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
    fromListenerEmail: data.fromListenerEmail,
    toUserId: data.toUserId,
    toUserName: data.toUserName,
    toUserProfession: data.toUserProfession,
    toUserRole: data.toUserRole,
    toUserGender: data.toUserGender,
    toUserEmail: data.toUserEmail,
    subject: data.subject.trim(),
    description: data.description.trim(),
    status: 'pending',
    createdAt: formattedTime,
    createdAtTimestamp: Date.now(),
  };

  const updated = [newRequest, ...allRequests];
  saveStoredShareRequests(updated, newRequest);
  return newRequest;
}

export function getShareRequestsForDiscussion(discussionId: string): ConversationShareRequest[] {
  const all = getStoredShareRequests();
  return all.filter((r) => r.discussionId === discussionId);
}

// Robust recipient matching function
export function isShareRequestForUser(
  req: ConversationShareRequest,
  userOrId: string | UserAccount
): boolean {
  if (!req || !userOrId) return false;

  const userId = typeof userOrId === 'string' ? userOrId : userOrId.id;
  const userEmail = typeof userOrId === 'object' && userOrId.email ? userOrId.email.trim().toLowerCase() : null;
  const userName = typeof userOrId === 'object' && userOrId.name ? userOrId.name.trim().toLowerCase() : null;

  // 1. Exact ID match
  if (req.toUserId && req.toUserId === userId) return true;

  // 2. Exact email match
  if (userEmail && req.toUserEmail && req.toUserEmail.trim().toLowerCase() === userEmail) return true;

  // 3. User ID is the email address
  if (userEmail && req.toUserId && req.toUserId.trim().toLowerCase() === userEmail) return true;

  // 4. Stored user lookup when user was passed as a string ID
  if (typeof userOrId === 'string') {
    const storedUsers = getStoredUsers();
    const targetUser = storedUsers.find(
      (u) => u.id === userId || (u.email && u.email.toLowerCase() === userId.toLowerCase())
    );
    if (targetUser) {
      if (req.toUserId === targetUser.id) return true;
      if (targetUser.email && req.toUserEmail && req.toUserEmail.trim().toLowerCase() === targetUser.email.trim().toLowerCase()) return true;
      if (targetUser.email && req.toUserId.trim().toLowerCase() === targetUser.email.trim().toLowerCase()) return true;
      if (targetUser.name && req.toUserName && req.toUserName.trim().toLowerCase() === targetUser.name.trim().toLowerCase()) return true;
    }
  }

  // 5. Name match fallback
  if (userName && req.toUserName && req.toUserName.trim().toLowerCase() === userName) return true;

  return false;
}

// Robust sender matching function
export function isShareRequestFromUser(
  req: ConversationShareRequest,
  userOrId: string | UserAccount
): boolean {
  if (!req || !userOrId) return false;

  const userId = typeof userOrId === 'string' ? userOrId : userOrId.id;
  const userEmail = typeof userOrId === 'object' && userOrId.email ? userOrId.email.trim().toLowerCase() : null;
  const userName = typeof userOrId === 'object' && userOrId.name ? userOrId.name.trim().toLowerCase() : null;

  // 1. Exact ID match
  if (req.fromListenerId && req.fromListenerId === userId) return true;

  // 2. Exact email match
  if (userEmail && req.fromListenerEmail && req.fromListenerEmail.trim().toLowerCase() === userEmail) return true;

  // 3. Stored user lookup
  if (typeof userOrId === 'string') {
    const storedUsers = getStoredUsers();
    const targetUser = storedUsers.find(
      (u) => u.id === userId || (u.email && u.email.toLowerCase() === userId.toLowerCase())
    );
    if (targetUser) {
      if (req.fromListenerId === targetUser.id) return true;
      if (targetUser.email && req.fromListenerEmail && req.fromListenerEmail.trim().toLowerCase() === targetUser.email.trim().toLowerCase()) return true;
      if (targetUser.name && req.fromListenerName && req.fromListenerName.trim().toLowerCase() === targetUser.name.trim().toLowerCase()) return true;
    }
  }

  // 4. Name match fallback
  if (userName && req.fromListenerName && req.fromListenerName.trim().toLowerCase() === userName) return true;

  return false;
}

// Get incoming share requests targeted to a specific listener
export function getIncomingShareRequests(userOrId: string | UserAccount): ConversationShareRequest[] {
  const all = getStoredShareRequests();
  return all.filter((r) => isShareRequestForUser(r, userOrId));
}

// Get pending incoming share requests
export function getPendingIncomingShareRequests(userOrId: string | UserAccount): ConversationShareRequest[] {
  const incoming = getIncomingShareRequests(userOrId);
  return incoming.filter((r) => r.status === 'pending');
}

// Get outgoing share requests sent by this listener
export function getSentShareRequests(userOrId: string | UserAccount): ConversationShareRequest[] {
  const all = getStoredShareRequests();
  return all.filter((r) => isShareRequestFromUser(r, userOrId));
}

// Get unread/active notifications count for a user (pending incoming requests)
// Guaranteed to read from the exact same incoming requests list!
export function getUnreadShareNotificationsCount(userOrId: string | UserAccount): number {
  const pendingIncoming = getPendingIncomingShareRequests(userOrId);
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
  saveStoredShareRequests(all, req);

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
  saveStoredShareRequests(all, req);

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
  saveStoredShareRequests(all, req);

  return { success: true, request: req };
}

