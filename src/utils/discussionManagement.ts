import { 
  DiscussionConversation, 
  ChatMessage, 
  ListenerGenderPreference,
  DiscussionParticipant,
  DiscussionExcludedListener,
  UserAccount,
  DiscussionReport
} from '../types';
import { Language } from './translations';
import { formatSiteTime } from './timezoneManagement';
import { verifyListenerKeyCode, getStoredUsers, StoredUser, isFakeUser } from './userManagement';
import { getShareRequestsForDiscussion, getStoredShareRequests } from './shareManagement';
import {
  saveDiscussionToFirestore,
  fetchDiscussionsFromFirestore,
  subscribeToDiscussions,
  ensureAnonymousFirebaseAuth,
  getCurrentFirebaseAuthUid
} from '../lib/firestoreService';

export const DISCUSSIONS_STORAGE_KEY = '3awdli_discussions';

export const INITIAL_DISCUSSION_SYSTEM_MESSAGE = "Salam, l'message dialk tsift l team. Chwia w yjawbk chi wa7d";

const SEED_DISCUSSIONS: DiscussionConversation[] = [];

export const FAKE_DISCUSSION_IDS = new Set([
  'disc_anon_101',
  'disc_anon_103',
  'disc_claimed_105',
  'disc_closed_106',
  'disc_reg_102',
  'disc_reg_104',
  'disc_unopened_102',
  'disc_open_102',
  'disc_user_user_sample_02',
  'disc_user_user_sample_06',
  'disc_user_user_sample_07',
  'disc_anon_live_portal',
]);

const SAMPLE_USER_EMAILS = new Set([
  'salma.benali@example.com',
  'dr.youssef@example.com',
  'nadia.cherkaoui@example.com',
  'karim.tazi@example.com',
  'dr.amina@example.com',
  'mehdi.b@example.com',
  'sofia.berrada@example.com',
]);

export function isFakeDiscussion(d: Partial<DiscussionConversation> | null | undefined): boolean {
  if (!d) return true;
  if (d.id && FAKE_DISCUSSION_IDS.has(d.id)) return true;
  if (d.id && d.id.startsWith('disc_sample_')) return true;
  if (d.userId && d.userId.startsWith('user_sample_')) return true;
  if (d.userEmail && SAMPLE_USER_EMAILS.has(d.userEmail.trim().toLowerCase())) return true;
  if (d.userName && (
    d.userName === 'Anonymous Visitor #101' ||
    d.userName === 'Anonymous Visitor #102' ||
    d.userName === 'Anonymous Visitor #103' ||
    d.userName === 'Anonymous Visitor #105' ||
    d.userName === 'Salma Benali' ||
    d.userName === 'Karim Tazi' ||
    d.userName === 'Nadia Cherkaoui'
  )) return true;
  return false;
}

export function getStoredDiscussions(): DiscussionConversation[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(DISCUSSIONS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(DISCUSSIONS_STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    const rawDiscussions: DiscussionConversation[] = JSON.parse(raw);
    if (!Array.isArray(rawDiscussions)) return [];

    // Filter out all fake / demo discussions
    const discussions = rawDiscussions.filter((d) => !isFakeDiscussion(d));

    let hasChanges = discussions.length !== rawDiscussions.length;

    // Ensure all discussions have a valid genderPreference and correct registration status
    const registeredUsers = getStoredUsers();
    discussions.forEach((d) => {
      if (!d.genderPreference) {
        d.genderPreference = 'any';
        hasChanges = true;
      }

      // Check if discussion was created by a registered user
      let matchedUser = d.userId ? registeredUsers.find((u) => u.id === d.userId) : null;
      if (!matchedUser && d.userEmail) {
        matchedUser = registeredUsers.find(
          (u) => u.email.toLowerCase() === d.userEmail?.toLowerCase()
        ) || null;
      }
      if (!matchedUser && d.id.startsWith('disc_reg_')) {
        const parts = d.id.split('_');
        if (parts.length >= 3) {
          const candidateId = parts[2];
          matchedUser = registeredUsers.find((u) => u.id === candidateId) || null;
        }
      }

      if (matchedUser) {
        if (d.type !== 'registered') {
          d.type = 'registered';
          hasChanges = true;
        }
        if (!d.userId) {
          d.userId = matchedUser.id;
          hasChanges = true;
        }
        if (
          !d.userName ||
          d.userName === 'Anonymous Visitor' ||
          d.userName === 'Anonymous User' ||
          d.userName === 'Visiteur Anonyme' ||
          d.userName === 'Registered Member'
        ) {
          d.userName = matchedUser.name;
          hasChanges = true;
        }
        if (!d.userEmail) {
          d.userEmail = matchedUser.email;
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      localStorage.setItem(DISCUSSIONS_STORAGE_KEY, JSON.stringify(discussions));
    }
    return discussions;
  } catch (err) {
    console.error('Failed to parse discussions:', err);
    return [];
  }
}

export function saveStoredDiscussions(
  discussions: DiscussionConversation[],
  changedDiscussion?: DiscussionConversation
): void {
  try {
    const cleanDiscussions = discussions.filter((d) => !isFakeDiscussion(d));
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DISCUSSIONS_STORAGE_KEY, JSON.stringify(cleanDiscussions));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('3awdli_discussion_sync', { detail: { timestamp: Date.now() } }));
    }
    // Only persist single changed discussion to Firestore to prevent quota exhaustion
    if (changedDiscussion && !isFakeDiscussion(changedDiscussion)) {
      saveDiscussionToFirestore(changedDiscussion).catch((e) =>
        console.warn('Firestore single discussion save notice:', e)
      );
    }
  } catch (err) {
    console.error('Failed to save discussions:', err);
  }
}

// Helper to safely merge remote discussions from Firestore with local discussions
export function reconcileDiscussionsWithLocal(
  remoteDiscussions: DiscussionConversation[],
  localDiscussions: DiscussionConversation[]
): DiscussionConversation[] {
  const cleanRemote = remoteDiscussions.filter((d) => !isFakeDiscussion(d));
  const mergedMap = new Map<string, DiscussionConversation>();

  for (const r of cleanRemote) {
    mergedMap.set(r.id, { ...r });
  }

  for (const l of localDiscussions) {
    if (isFakeDiscussion(l)) continue;
    const remote = mergedMap.get(l.id);
    if (!remote) {
      // Local discussion not yet in remote snapshot - preserve it!
      mergedMap.set(l.id, l);
    } else {
      // If locally closed, prevent remote from un-closing it unless explicitly reopened
      if (l.status === 'closed') {
        if (!remote.reopenedAt || remote.status !== 'opened') {
          remote.status = 'closed';
          remote.closedAt = l.closedAt || remote.closedAt;
          remote.closedByRole = l.closedByRole || remote.closedByRole;
          remote.closedByListenerId = l.closedByListenerId || remote.closedByListenerId;
          remote.closedByListenerName = l.closedByListenerName || remote.closedByListenerName;
          remote.closedByUserId = l.closedByUserId || remote.closedByUserId;
          remote.closedByUserName = l.closedByUserName || remote.closedByUserName;
        }
      }
      // Safely merge messages by ID so messages from either side are never dropped
      const messageMap = new Map<string, ChatMessage>();
      (remote.messages || []).forEach((m) => messageMap.set(m.id, m));
      (l.messages || []).forEach((m) => {
        if (!messageMap.has(m.id)) {
          messageMap.set(m.id, m);
        }
      });
      remote.messages = Array.from(messageMap.values()).sort(
        (a, b) => (a.timestampMs || 0) - (b.timestampMs || 0)
      );

      // Preserve newer activeCall state
      if (l.activeCall) {
        if (!remote.activeCall) {
          remote.activeCall = l.activeCall;
        } else if ((l.activeCall.startedAtTimestamp || 0) > (remote.activeCall.startedAtTimestamp || 0)) {
          remote.activeCall = l.activeCall;
        }
      }
    }
  }

  return Array.from(mergedMap.values());
}

let isDiscussionsSyncInitialized = false;

// Initialize real-time Firestore sync for discussions
export function initFirestoreDiscussionsSync(): () => void {
  if (isDiscussionsSyncInitialized) {
    return () => {};
  }
  isDiscussionsSyncInitialized = true;

  // Real-time Firestore subscription handles initial snapshot AND continuous updates
  const unsubscribeFirestore = subscribeToDiscussions((remoteDiscussions) => {
    if (!remoteDiscussions) return;
    const local = getStoredDiscussions();
    const merged = reconcileDiscussionsWithLocal(remoteDiscussions, local);
    const currentRaw = localStorage.getItem(DISCUSSIONS_STORAGE_KEY) || '[]';
    const mergedRaw = JSON.stringify(merged);
    if (currentRaw !== mergedRaw) {
      localStorage.setItem(DISCUSSIONS_STORAGE_KEY, mergedRaw);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('3awdli_discussion_sync', { detail: { timestamp: Date.now() } }));
      }
    }
  });

  return () => {
    isDiscussionsSyncInitialized = false;
    unsubscribeFirestore();
  };
}

// Get single discussion by ID
export function getDiscussionById(discussionId: string): DiscussionConversation | null {
  const all = getStoredDiscussions();
  return all.find((d) => d.id === discussionId) || null;
}

// Get all unopened conversations that have not been claimed by any listener yet
export function getUnopenedDiscussions(): DiscussionConversation[] {
  const all = getStoredDiscussions();
  return all.filter((d) => d.status === 'unopened');
}

// Live waiting discussions count helper for listeners and administrators
export function getWaitingDiscussionsCount(): number {
  return getUnopenedDiscussions().length;
}

// Check if a listener is currently free (has no active/open conversation of their own)
export function isListenerFree(listenerId?: string | null): boolean {
  if (!listenerId) return false;
  const all = getStoredDiscussions();
  const hasActiveConversation = all.some((d) => {
    if (d.status !== 'opened') return false;
    if (d.excludedListeners?.some((e) => e.listenerId === listenerId)) return false;
    return d.openedByListenerId === listenerId || d.joinedListenerId === listenerId;
  });
  return !hasActiveConversation;
}

/**
 * Retrieves all valid registered listeners and heads of listeners from stored users.
 */
export function getAllPlatformListeners(): StoredUser[] {
  const users = getStoredUsers();
  return users.filter((u) => {
    if (isFakeUser(u)) return false;
    if (u.is_banned) return false;
    return Boolean(u.is_listener || u.isListener || u.role === 'listener' || u.is_head_of_listeners);
  });
}

/**
 * Checks whether there is currently at least one Listener who is free (not in an active 'opened' conversation).
 * If a genderPreference is specified (male or female), checks if at least one listener
 * matching that preference is free (if any exist for that gender), otherwise checks all listeners.
 */
export function hasAtLeastOneFreeListener(genderPreference?: ListenerGenderPreference): boolean {
  const listeners = getAllPlatformListeners();
  if (listeners.length === 0) {
    return false;
  }

  // If a specific gender was chosen, prioritize checking matching listeners if any exist
  if (genderPreference && genderPreference !== 'any') {
    const targetGender = genderPreference === 'female' ? 'Female' : 'Male';
    const matchingListeners = listeners.filter((l) => l.gender?.toLowerCase() === targetGender.toLowerCase());
    if (matchingListeners.length > 0) {
      return matchingListeners.some((l) => isListenerFree(l.id));
    }
  }

  return listeners.some((listener) => isListenerFree(listener.id));
}

export const ALL_LISTENERS_BUSY_MESSAGE: Record<Language, string> = {
  en: "All of our listeners are currently in other conversations. Your message has been received, and someone will join you as soon as they're free. Thank you for your patience.",
  fr: "Tous nos écoutants sont actuellement en conversation. Votre message a bien été reçu et quelqu'un vous rejoindra dès qu'il se libérera. Merci pour votre patience.",
  ar: "جميع مستمعينا منشغلون حالياً في محادثات أخرى. لقد تم استلام رسالتك، وسينضم إليك أحد مستمعينا بمجرد أن يتفرغ. شكراً جزيلاً لصبرك وتفهمك.",
};

export function getAllListenersBusyNotice(language: Language = 'en'): string {
  return ALL_LISTENERS_BUSY_MESSAGE[language] || ALL_LISTENERS_BUSY_MESSAGE.en;
}

export function getCurrentStoredLanguage(): Language {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('app_language');
      if (saved === 'en' || saved === 'fr' || saved === 'ar') {
        return saved;
      }
    }
  } catch {
    // ignore
  }
  return 'en';
}

export interface DiscussionCreatorInfo {
  isRegistered: boolean;
  name: string;
  userId?: string;
  userEmail?: string;
}

// Universal resolver to get discussion creator info and name
export function getDiscussionCreatorInfo(
  disc: DiscussionConversation,
  language: Language = 'en'
): DiscussionCreatorInfo {
  const users = getStoredUsers();

  // Try finding user by disc.userId
  let registeredUser = disc.userId ? users.find((u) => u.id === disc.userId) : null;

  // Try finding user by disc.userEmail
  if (!registeredUser && disc.userEmail) {
    registeredUser = users.find(
      (u) => u.email.toLowerCase() === disc.userEmail?.toLowerCase()
    ) || null;
  }

  // Try checking if disc.id has a userId embedded: e.g. disc_reg_<userId>_...
  if (!registeredUser && disc.id.startsWith('disc_reg_')) {
    const parts = disc.id.split('_');
    if (parts.length >= 3) {
      const candidateId = parts[2];
      registeredUser = users.find((u) => u.id === candidateId) || null;
    }
  }

  const isGenericAnon =
    !disc.userName ||
    disc.userName.toLowerCase() === 'anonymous visitor' ||
    disc.userName.toLowerCase() === 'anonymous user' ||
    disc.userName.toLowerCase() === 'visiteur anonyme' ||
    disc.userName.toLowerCase() === 'utilisateur anonyme' ||
    disc.userName.toLowerCase() === 'anonymous' ||
    disc.userName.toLowerCase() === 'anonyme';

  // If found in registered users list, this user is definitely registered!
  if (registeredUser) {
    return {
      isRegistered: true,
      name: registeredUser.name || (disc.userName && !isGenericAnon ? disc.userName : (language === 'fr' ? 'Membre Inscrit' : language === 'ar' ? 'عضو مسجل' : 'Registered Member')),
      userId: registeredUser.id,
      userEmail: registeredUser.email,
    };
  }

  // Check if disc.type is explicitly 'registered' or if disc has userId/userEmail or a non-generic userName
  if (disc.type === 'registered' || Boolean(disc.userId) || (Boolean(disc.userName) && !isGenericAnon)) {
    if (disc.userName && !isGenericAnon) {
      return {
        isRegistered: true,
        name: disc.userName,
        userId: disc.userId,
        userEmail: disc.userEmail,
      };
    }

    if (disc.userEmail) {
      return {
        isRegistered: true,
        name: disc.userEmail.split('@')[0],
        userId: disc.userId,
        userEmail: disc.userEmail,
      };
    }

    if (disc.type === 'registered') {
      return {
        isRegistered: true,
        name: language === 'fr' ? 'Membre Inscrit' : language === 'ar' ? 'عضو مسجل' : 'Registered Member',
        userId: disc.userId,
      };
    }
  }

  // Genuine anonymous visitor who started chat without an account
  return {
    isRegistered: false,
    name: language === 'fr' ? 'Utilisateur Anonyme' : language === 'ar' ? 'مستخدم مجهول الهوية' : 'Anonymous User',
  };
}

// Get active conversations claimed by a specific listener
export function getMyOpenedDiscussions(listenerId: string): DiscussionConversation[] {
  const all = getStoredDiscussions();
  return all.filter((d) => d.status === 'opened' && d.openedByListenerId === listenerId);
}

// Get closed/history conversations handled by a specific listener
export function getMyClosedDiscussions(listenerId: string): DiscussionConversation[] {
  const all = getStoredDiscussions();
  return all.filter((d) => d.status === 'closed' && (d.openedByListenerId === listenerId || d.closedByListenerId === listenerId));
}

// Get conversations for a specific registered user (both active and closed)
export function getUserDiscussions(userId?: string, userEmail?: string): DiscussionConversation[] {
  const all = getStoredDiscussions();
  if (!userId && !userEmail) return [];
  return all.filter((d) => {
    if (userId && d.userId === userId) return true;
    if (userEmail && d.userEmail && d.userEmail.toLowerCase() === userEmail.toLowerCase()) return true;
    return false;
  });
}

// Get all conversations (for Head of Listeners / Supervisor view)
export function getAllDiscussions(): DiscussionConversation[] {
  return getStoredDiscussions();
}

// Update listener attention / typing status in real time
export function updateListenerAttention(
  discussionId: string,
  status: 'reading' | 'typing' | 'idle' | null
): void {
  const all = getStoredDiscussions();
  const index = all.findIndex((d) => d.id === discussionId);
  if (index === -1) return;

  // If status did not change, ignore to avoid re-triggering loops
  if (all[index].listenerAttentionStatus === status) {
    return;
  }

  all[index].listenerAttentionStatus = status;
  all[index].listenerAttentionTimestamp = Date.now();
  // Attention state is ephemeral - persist locally and broadcast event without re-writing to Firestore
  try {
    const cleanDiscussions = all.filter((d) => !isFakeDiscussion(d));
    localStorage.setItem(DISCUSSIONS_STORAGE_KEY, JSON.stringify(cleanDiscussions));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('3awdli_discussion_sync', { detail: { timestamp: Date.now() } }));
    }
  } catch (err) {
    console.error('Failed to update attention:', err);
  }
}

// Send a message as a listener
export function sendListenerMessage(
  discussionId: string,
  listenerId: string,
  listenerName: string,
  text: string
): { success: boolean; message?: ChatMessage; error?: string } {
  if (!text.trim()) {
    return { success: false, error: 'Message cannot be empty.' };
  }

  const all = getStoredDiscussions();
  const index = all.findIndex((d) => d.id === discussionId);
  if (index === -1) {
    return { success: false, error: 'Discussion not found.' };
  }

  const disc = all[index];
  if (disc.status === 'closed') {
    return { success: false, error: 'This conversation is currently closed.' };
  }

  // Check if listener has been excluded
  if (disc.excludedListeners?.some((e) => e.listenerId === listenerId)) {
    return { 
      success: false, 
      error: 'You have been excluded from this conversation following a handover and cannot send messages.' 
    };
  }

  const nowMs = Date.now();
  const listenerMsg: ChatMessage = {
    id: `msg_tm_${nowMs}`,
    sender: 'team',
    senderName: listenerName,
    senderId: listenerId,
    text: text.trim(),
    timestamp: formatSiteTime(nowMs),
    timestampMs: nowMs,
  };

  disc.messages.push(listenerMsg);
  // Reset attention to reading after sending
  disc.listenerAttentionStatus = 'reading';
  disc.listenerAttentionTimestamp = nowMs;

  saveStoredDiscussions(all, disc);
  return { success: true, message: listenerMsg };
}

// Permanently clear any active discussion reference across all storage keys
export function clearActiveDiscussionReferences(discussionId?: string, userId?: string): void {
  try {
    if (typeof localStorage === 'undefined') return;

    // 1. Clear anonymous pointer if matching or if no specific discussionId
    const activeAnonId = localStorage.getItem('3awdli_active_anon_disc_id');
    if (!discussionId || activeAnonId === discussionId) {
      localStorage.removeItem('3awdli_active_anon_disc_id');
    }

    // 2. Clear user pointer if userId provided
    if (userId) {
      localStorage.removeItem(`3awdli_active_user_disc_${userId}`);
    }

    // 3. Scan all keys in localStorage for any 3awdli_active_user_disc_ that matches discussionId, points to a closed discussion, or full clear
    const all = getStoredDiscussions();
    const closedIds = new Set(all.filter((d) => d.status === 'closed').map((d) => d.id));
    if (discussionId) closedIds.add(discussionId);

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('3awdli_active_user_disc_')) {
        const val = localStorage.getItem(key);
        if (!discussionId && !userId) {
          keysToRemove.push(key);
        } else if (val && (closedIds.has(val) || val === discussionId)) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));

    // 4. Dispatch sync and cleared events
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('3awdli_active_discussion_cleared', { detail: { discussionId, userId, timestamp: Date.now() } }));
      window.dispatchEvent(new CustomEvent('3awdli_discussion_sync', { detail: { timestamp: Date.now() } }));
    }
  } catch (e) {
    console.warn('Error clearing active discussion references:', e);
  }
}

// Close a discussion from listener or user side
export function closeDiscussion(
  discussionId: string,
  closedById: string,
  closedByName: string,
  closedByRole: 'listener' | 'user' = 'listener'
): { success: boolean; discussion?: DiscussionConversation; error?: string } {
  const all = getStoredDiscussions();
  const index = all.findIndex((d) => d.id === discussionId);
  if (index === -1) {
    return { success: false, error: 'Discussion not found.' };
  }

  const disc = all[index];
  const nowFormatted = formatSiteTime();

  disc.status = 'closed';
  disc.closedAt = `Today at ${nowFormatted}`;
  disc.closedByRole = closedByRole;
  if (closedByRole === 'user') {
    disc.closedByUserId = closedById;
    disc.closedByUserName = closedByName;
  } else {
    disc.closedByListenerId = closedById;
    disc.closedByListenerName = closedByName;
  }
  disc.listenerAttentionStatus = null;

  // Clear any active localStorage pointers permanently
  clearActiveDiscussionReferences(discussionId, disc.userId);

  // Add an audit notice message to the conversation
  const closeNotice: ChatMessage = {
    id: `msg_close_${Date.now()}`,
    sender: 'system',
    text: closedByRole === 'user'
      ? 'This conversation was ended by the user.'
      : 'This conversation was ended by the listener.',
    timestamp: nowFormatted,
  };
  disc.messages.push(closeNotice);

  saveStoredDiscussions(all, disc);
  return { success: true, discussion: disc };
}

/**
 * Helper to determine which listeners currently have active access to a discussion.
 * A listener currently has active access IF:
 * 1. They are tied to this conversation (as primary opened listener, joined listener, or takeover recipient).
 * 2. They have NOT been excluded (e.g. via takeover handover).
 * 3. They still hold an active listener badge/role on the platform.
 */
export function getActiveListenersForDiscussion(disc: DiscussionConversation): {
  activePrimaryListener: UserAccount | null;
  activeJoinedListener: UserAccount | null;
  allActiveListeners: UserAccount[];
} {
  const users = getStoredUsers();

  const isUserActiveListener = (user: UserAccount | undefined): boolean => {
    if (!user) return false;
    return Boolean(user.is_listener || user.isListener || user.role === 'listener');
  };

  const isListenerIdExcluded = (listenerId: string | undefined): boolean => {
    if (!listenerId) return false;
    return Boolean(disc.excludedListeners?.some((e) => e.listenerId === listenerId));
  };

  let activePrimary: UserAccount | null = null;
  let activeJoined: UserAccount | null = null;

  // 1. Check primary listener (disc.openedByListenerId)
  if (disc.openedByListenerId && !isListenerIdExcluded(disc.openedByListenerId)) {
    const user = users.find((u) => u.id === disc.openedByListenerId);
    if (isUserActiveListener(user)) {
      activePrimary = user!;
    }
  }

  // 2. Check joined listener (disc.joinedListenerId)
  if (
    disc.joinedListenerId &&
    disc.joinedListenerId !== disc.openedByListenerId &&
    !isListenerIdExcluded(disc.joinedListenerId)
  ) {
    const user = users.find((u) => u.id === disc.joinedListenerId);
    if (isUserActiveListener(user)) {
      activeJoined = user!;
    }
  }

  // 3. If primary is not active (e.g. was excluded via takeover, lost badge, or left),
  // check if a takeover occurred that specified a new listener who currently holds access
  if (!activePrimary) {
    // Check disc.excludedListeners for takeover metadata (newListenerName)
    if (disc.excludedListeners && disc.excludedListeners.length > 0) {
      for (const ex of disc.excludedListeners) {
        if (ex.newListenerName) {
          const takeoverUser = users.find(
            (u) =>
              u.name.trim().toLowerCase() === ex.newListenerName!.trim().toLowerCase() &&
              isUserActiveListener(u)
          );
          if (takeoverUser && !isListenerIdExcluded(takeoverUser.id)) {
            activePrimary = takeoverUser;
            break;
          }
        }
      }
    }

    // Check share requests for accepted takeover
    if (!activePrimary) {
      try {
        const shareRequests = getShareRequestsForDiscussion(disc.id);
        const acceptedTakeover = shareRequests.find(
          (r) => r.status === 'accepted' && r.responseType === 'takeover'
        );
        if (acceptedTakeover && acceptedTakeover.toUserId && !isListenerIdExcluded(acceptedTakeover.toUserId)) {
          const takeoverUser = users.find((u) => u.id === acceptedTakeover.toUserId);
          if (isUserActiveListener(takeoverUser)) {
            activePrimary = takeoverUser!;
          }
        }
      } catch {
        // Fallback
      }
    }

    // If still no primary, but joined listener is active, promote joined to primary
    if (!activePrimary && activeJoined) {
      activePrimary = activeJoined;
      activeJoined = null;
    }
  }

  const allActiveListeners: UserAccount[] = [];
  if (activePrimary) allActiveListeners.push(activePrimary);
  if (activeJoined && activeJoined.id !== activePrimary?.id) allActiveListeners.push(activeJoined);

  return {
    activePrimaryListener: activePrimary,
    activeJoinedListener: activeJoined,
    allActiveListeners,
  };
}

// Reopen a discussion by a registered user sending a new message
export function reopenDiscussionByUser(
  discussionId: string,
  userMessage: ChatMessage
): { success: boolean; discussion?: DiscussionConversation; listenerUnavailable?: boolean } {
  const all = getStoredDiscussions();
  const index = all.findIndex((d) => d.id === discussionId);
  if (index === -1) {
    return { success: false };
  }

  const disc = all[index];
  const nowFormatted = formatSiteTime();
  const nowMs = Date.now();

  const userMsgWithMs: ChatMessage = {
    ...userMessage,
    timestampMs: userMessage.timestampMs || nowMs,
  };

  // Determine which listener(s) currently have active access
  const { activePrimaryListener, activeJoinedListener, allActiveListeners } = getActiveListenersForDiscussion(disc);

  // SCENARIO 4: No listener currently has access at all
  // (e.g. only listener with access lost badge, left team, or was excluded with no replacement)
  if (allActiveListeners.length === 0) {
    disc.status = 'unopened'; // Place back into shared "Discussions" queue for any listener to pick up
    disc.openedByListenerId = undefined;
    disc.openedByListenerName = undefined;
    disc.openedAt = undefined;
    disc.joinedListenerId = undefined;
    disc.joinedListenerName = undefined;
    disc.joinedListenerProfession = undefined;
    disc.joinedListenerGender = undefined;
    disc.joinedListenerRole = undefined;
    disc.joinedAt = undefined;
    disc.listenerAttentionStatus = null;
    disc.listenerUnavailable = true;
    disc.reopenedAt = `Today at ${nowFormatted}`;

    disc.messages.push(userMsgWithMs);
    disc.messages.push({
      id: `msg_unavail_sys_${nowMs}`,
      sender: 'system',
      text: 'Your message has been safely received. Your previous listener is currently unavailable, and our team will follow up with you soon.',
      timestamp: nowFormatted,
      timestampMs: nowMs,
    });

    all[index] = disc;
    saveStoredDiscussions(all, disc);
    return { success: true, discussion: disc, listenerUnavailable: true };
  }

  // SCENARIO 3: A share happened and both listeners are still JOINED (no exclusion) -> route to both
  if (activePrimaryListener && activeJoinedListener) {
    disc.status = 'opened';
    disc.openedByListenerId = activePrimaryListener.id;
    disc.openedByListenerName = activePrimaryListener.name;
    disc.joinedListenerId = activeJoinedListener.id;
    disc.joinedListenerName = activeJoinedListener.name;
    disc.joinedListenerProfession = activeJoinedListener.profession || 'Support Specialist';
    disc.joinedListenerGender = activeJoinedListener.gender;
    disc.reopenedAt = `Today at ${nowFormatted}`;
    disc.listenerUnavailable = false;

    disc.messages.push(userMsgWithMs);
    disc.messages.push({
      id: `msg_reopen_sys_${nowMs}`,
      sender: 'system',
      text: `Conversation resumed by member. Re-routed to your listeners (${activePrimaryListener.name} & ${activeJoinedListener.name}).`,
      timestamp: nowFormatted,
      timestampMs: nowMs,
    });

    all[index] = disc;
    saveStoredDiscussions(all, disc);
    return { success: true, discussion: disc, listenerUnavailable: false };
  }

  // SCENARIO 1 & 2: A single listener holds active access
  // - Scenario 1: Original listener still holds access (no takeover / exclusion)
  // - Scenario 2: Takeover occurred and original listener was excluded -> route to takeover listener
  const activeListener = activePrimaryListener || allActiveListeners[0];
  const hasExclusion = Boolean(disc.excludedListeners && disc.excludedListeners.length > 0);

  disc.status = 'opened';
  disc.openedByListenerId = activeListener.id;
  disc.openedByListenerName = activeListener.name;
  // Clear any inactive or obsolete joined listener
  disc.joinedListenerId = undefined;
  disc.joinedListenerName = undefined;
  disc.joinedListenerProfession = undefined;
  disc.joinedListenerGender = undefined;
  disc.joinedListenerRole = undefined;
  disc.joinedAt = undefined;

  disc.reopenedAt = `Today at ${nowFormatted}`;
  disc.listenerUnavailable = false;

  disc.messages.push(userMsgWithMs);

  const routingText = hasExclusion
    ? `Conversation resumed by member. Re-routed to your listener (${activeListener.name}).`
    : `Conversation resumed by member. Re-routed to your previous listener (${activeListener.name}).`;

  disc.messages.push({
    id: `msg_reopen_sys_${nowMs}`,
    sender: 'system',
    text: routingText,
    timestamp: nowFormatted,
    timestampMs: nowMs,
  });

  all[index] = disc;
  saveStoredDiscussions(all, disc);
  return { success: true, discussion: disc, listenerUnavailable: false };
}

// Attempt to open a discussion by verifying listener's personal key code
export function openDiscussionWithKey(
  discussionId: string,
  listenerId: string,
  listenerName: string,
  enteredKey: string
): { success: boolean; discussion?: DiscussionConversation; error?: string } {
  // Validate key code using userManagement verification
  const isKeyValid = verifyListenerKeyCode(listenerId, enteredKey);
  if (!isKeyValid) {
    return {
      success: false,
      error: 'Invalid Key Code. Access denied. Please enter the personal one-time key code issued when your Listener badge was granted.',
    };
  }

  const all = getStoredDiscussions();
  const index = all.findIndex((d) => d.id === discussionId);

  if (index === -1) {
    return {
      success: false,
      error: 'Discussion not found. It may have been closed or already archived.',
    };
  }

  const currentDisc = all[index];

  // If already opened by someone else and this listener is not head, reject
  if (currentDisc.status === 'opened' && currentDisc.openedByListenerId && currentDisc.openedByListenerId !== listenerId) {
    return {
      success: false,
      error: `This discussion has already been opened by another listener (${currentDisc.openedByListenerName || 'another counselor'}).`,
    };
  }

  const nowFormatted = formatSiteTime();
  const nowMs = Date.now();

  const isReopenedFromUnavail = Boolean(currentDisc.listenerUnavailable);

  const updatedMessages = [...currentDisc.messages];
  if (isReopenedFromUnavail) {
    updatedMessages.push({
      id: `msg_pickup_${nowMs}`,
      sender: 'system',
      text: `${listenerName} has opened this conversation to support you.`,
      timestamp: nowFormatted,
      timestampMs: nowMs,
    });
  }

  const updatedDisc: DiscussionConversation = {
    ...currentDisc,
    status: 'opened',
    openedByListenerId: listenerId,
    openedByListenerName: listenerName,
    openedAt: `Today at ${nowFormatted}`,
    listenerAttentionStatus: 'reading',
    listenerAttentionTimestamp: nowMs,
    listenerUnavailable: false,
    messages: updatedMessages,
    // Clean up exclusion for the claiming listener if they are claiming the open conversation
    excludedListeners: (currentDisc.excludedListeners || []).filter((e) => e.listenerId !== listenerId),
  };

  all[index] = updatedDisc;
  saveStoredDiscussions(all, updatedDisc);

  return {
    success: true,
    discussion: updatedDisc,
  };
}

// Helper to record a live message from anonymous or registered users into the shared discussions pool
export function recordLiveDiscussionMessage(
  discussionId: string,
  message: ChatMessage,
  type: 'anonymous' | 'registered',
  userName?: string,
  userEmail?: string,
  userId?: string,
  genderPreference?: ListenerGenderPreference
): void {
  const all = getStoredDiscussions();
  const index = all.findIndex((d) => d.id === discussionId);

  const messageWithMs: ChatMessage = {
    ...message,
    timestampMs: message.timestampMs || Date.now(),
  };

  if (index !== -1) {
    const disc = all[index];
    if (disc.status === 'closed') {
      console.warn('Cannot append message to closed discussion:', discussionId);
      return;
    }
    disc.messages = [...disc.messages, messageWithMs];
    if (genderPreference && (!disc.genderPreference || disc.genderPreference === 'any')) {
      disc.genderPreference = genderPreference;
    }
    if (type === 'registered') {
      disc.type = 'registered';
      if (userId) disc.userId = userId;
      if (
        userName &&
        userName !== 'Anonymous Visitor' &&
        userName !== 'Anonymous User' &&
        userName !== 'Visiteur Anonyme'
      ) {
        disc.userName = userName;
      }
      if (userEmail) disc.userEmail = userEmail;
    }
    saveStoredDiscussions(all, disc);
  } else {
    const newDisc: DiscussionConversation = {
      id: discussionId,
      type,
      userName: userName || (type === 'anonymous' ? 'Anonymous Visitor' : 'Registered Member'),
      userEmail,
      userId,
      startedAt: 'Just now',
      startedAtTimestamp: Date.now(),
      status: 'unopened',
      genderPreference: genderPreference || 'any',
      messages: [messageWithMs],
    };
    all.unshift(newDisc);
    saveStoredDiscussions(all, newDisc);
  }
}

// Persistent client anonymous UID fallback if offline or before initial sign-in resolves
export function getOrCreateClientAnonUid(): string {
  try {
    const existing = localStorage.getItem('3awdli_anon_firebase_uid');
    if (existing) return existing;
    const fallback = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('3awdli_anon_firebase_uid', fallback);
    return fallback;
  } catch {
    return `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Create a brand new isolated discussion initialized with system opening message(s)
export function createNewDiscussion(
  type: 'anonymous' | 'registered',
  params?: {
    userId?: string;
    creatorId?: string;
    ownerId?: string;
    userName?: string;
    userEmail?: string;
    genderPreference?: ListenerGenderPreference;
    language?: Language;
  }
): DiscussionConversation {
  // Clear any existing active references before registering brand new discussion
  clearActiveDiscussionReferences(undefined, params?.userId);

  const nowMs = Date.now();
  const nowFormatted = formatSiteTime(nowMs);

  // For anonymous conversations, tie to the real Firebase Auth UID (owner/creator ID)
  let ownerCreatorId = params?.userId || params?.creatorId || params?.ownerId;
  if (!ownerCreatorId && type === 'anonymous') {
    ownerCreatorId = getCurrentFirebaseAuthUid() || getOrCreateClientAnonUid();
  }

  const uniqueId = type === 'anonymous'
    ? `disc_anon_${nowMs}_${Math.random().toString(36).substring(2, 7)}`
    : `disc_reg_${ownerCreatorId || 'user'}_${nowMs}_${Math.random().toString(36).substring(2, 5)}`;

  const initialSystemMsg: ChatMessage = {
    id: `msg_sys_${nowMs}`,
    sender: 'system',
    text: INITIAL_DISCUSSION_SYSTEM_MESSAGE,
    timestamp: nowFormatted,
    timestampMs: nowMs,
  };

  const initialMessages: ChatMessage[] = [initialSystemMsg];

  // Check whether there is currently at least one Listener who is free (not in an active conversation)
  const isAnyListenerAvailable = hasAtLeastOneFreeListener(params?.genderPreference);
  if (!isAnyListenerAvailable) {
    const lang = params?.language || getCurrentStoredLanguage();
    const busyNoticeText = getAllListenersBusyNotice(lang);
    initialMessages.push({
      id: `msg_sys_busy_${nowMs + 1}`,
      sender: 'system',
      text: busyNoticeText,
      timestamp: nowFormatted,
      timestampMs: nowMs + 1,
    });
  }

  const newDisc: DiscussionConversation = {
    id: uniqueId,
    type,
    userId: ownerCreatorId,
    creatorId: ownerCreatorId,
    ownerId: ownerCreatorId,
    userName: params?.userName || (type === 'anonymous' ? 'Anonymous Visitor' : 'Registered Member'),
    userEmail: params?.userEmail,
    startedAt: 'Just now',
    startedAtTimestamp: nowMs,
    status: 'unopened',
    genderPreference: params?.genderPreference || 'any',
    allListenersBusyOnCreate: !isAnyListenerAvailable,
    messages: initialMessages,
  };

  const all = getStoredDiscussions();
  all.unshift(newDisc);
  saveStoredDiscussions(all, newDisc);
  // Ensure discussion is immediately saved to Firestore with real Firebase UID
  saveDiscussionToFirestore(newDisc).catch((err) => {
    console.warn('Firestore new discussion initial save notice:', err);
  });

  if (type === 'anonymous') {
    setActiveAnonymousDiscussionId(uniqueId);
    // Automatically ensure Firebase Anonymous Authentication behind the scenes.
    // If the real Firebase Auth UID resolves and differs from initial holder, update owner/creator ID!
    ensureAnonymousFirebaseAuth().then((fbUser) => {
      if (fbUser?.uid && newDisc.userId !== fbUser.uid) {
        newDisc.userId = fbUser.uid;
        newDisc.creatorId = fbUser.uid;
        newDisc.ownerId = fbUser.uid;
        const currentList = getStoredDiscussions().map((d) =>
          d.id === newDisc.id ? { ...d, userId: fbUser.uid, creatorId: fbUser.uid, ownerId: fbUser.uid } : d
        );
        saveStoredDiscussions(currentList, newDisc);
        saveDiscussionToFirestore(newDisc).catch(() => {});
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('3awdli_discussion_sync', { detail: { discussionId: newDisc.id } }));
        }
      }
    }).catch(() => {});
  } else if (params?.userId) {
    setActiveUserDiscussionId(params.userId, uniqueId);
  }

  return newDisc;
}

export function getActiveAnonymousDiscussionId(): string | null {
  try {
    const id = localStorage.getItem('3awdli_active_anon_disc_id');
    if (!id) return null;
    const all = getStoredDiscussions();
    const found = all.find((d) => d.id === id);
    if (!found || found.status === 'closed') {
      localStorage.removeItem('3awdli_active_anon_disc_id');
      return null;
    }
    return id;
  } catch {
    return null;
  }
}

export function setActiveAnonymousDiscussionId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem('3awdli_active_anon_disc_id', id);
    } else {
      localStorage.removeItem('3awdli_active_anon_disc_id');
    }
  } catch {
    // fallback
  }
}

export function getActiveAnonymousDiscussion(): DiscussionConversation | null {
  const activeId = getActiveAnonymousDiscussionId();
  if (!activeId) return null;
  const all = getStoredDiscussions();
  const found = all.find((d) => d.id === activeId);
  if (found && found.status !== 'closed') {
    return found;
  }
  return null;
}

export function getActiveUserDiscussionId(userId: string): string | null {
  try {
    const id = localStorage.getItem(`3awdli_active_user_disc_${userId}`);
    if (!id) return null;
    const all = getStoredDiscussions();
    const found = all.find((d) => d.id === id);
    if (!found || found.status === 'closed') {
      localStorage.removeItem(`3awdli_active_user_disc_${userId}`);
      return null;
    }
    return id;
  } catch {
    return null;
  }
}

export function setActiveUserDiscussionId(userId: string, id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(`3awdli_active_user_disc_${userId}`, id);
    } else {
      localStorage.removeItem(`3awdli_active_user_disc_${userId}`);
    }
  } catch {
    // fallback
  }
}

export function getActiveUserDiscussion(userId: string): DiscussionConversation | null {
  const activeId = getActiveUserDiscussionId(userId);
  if (!activeId) return null;
  const all = getStoredDiscussions();
  const found = all.find((d) => d.id === activeId);
  if (found && found.status !== 'closed') {
    return found;
  }
  // Clear stale pointer if discussion is closed or missing
  setActiveUserDiscussionId(userId, null);
  return null;
}

// Update gender preference for an existing discussion
export function updateDiscussionGenderPreference(
  discussionId: string,
  genderPreference: ListenerGenderPreference
): void {
  const all = getStoredDiscussions();
  const index = all.findIndex((d) => d.id === discussionId);
  if (index !== -1) {
    all[index].genderPreference = genderPreference;
    saveStoredDiscussions(all, all[index]);
  }
}

// Join conversation alongside original listener
export function joinDiscussion(
  discussionId: string,
  newListener: UserAccount
): { success: boolean; discussion?: DiscussionConversation; error?: string } {
  const all = getStoredDiscussions();
  const index = all.findIndex((d) => d.id === discussionId);
  if (index === -1) {
    return { success: false, error: 'Discussion not found.' };
  }

  const disc = all[index];
  const nowMs = Date.now();
  const nowFormatted = formatSiteTime(nowMs);

  disc.joinedListenerId = newListener.id;
  disc.joinedListenerName = newListener.name;
  disc.joinedListenerProfession = newListener.profession || 'Support Specialist';
  disc.joinedListenerGender = newListener.gender;
  disc.joinedListenerRole = newListener.is_head_of_listeners
    ? 'Head of Listeners'
    : newListener.role === 'admin'
    ? 'Administrator'
    : 'Listener';
  disc.joinedAt = `Today at ${nowFormatted}`;

  const joinNotice: ChatMessage = {
    id: `msg_join_${nowMs}`,
    sender: 'system',
    text: `${newListener.name} joined the conversation to assist alongside ${disc.openedByListenerName || 'the listener'}.`,
    timestamp: nowFormatted,
    timestampMs: nowMs,
  };

  disc.messages.push(joinNotice);
  all[index] = disc;
  saveStoredDiscussions(all, disc);

  return { success: true, discussion: disc };
}

// Take over conversation and exclude original listener
export function takeoverDiscussion(
  discussionId: string,
  newListener: UserAccount,
  originalListenerId: string,
  originalListenerName: string
): { success: boolean; discussion?: DiscussionConversation; error?: string } {
  const all = getStoredDiscussions();
  const index = all.findIndex((d) => d.id === discussionId);
  if (index === -1) {
    return { success: false, error: 'Discussion not found.' };
  }

  const disc = all[index];
  const nowMs = Date.now();
  const nowFormatted = formatSiteTime(nowMs);

  // Locate details of original listener if available
  const allUsers = getStoredUsers();
  const origUser = allUsers.find((u) => u.id === originalListenerId);

  const excludedEntry: DiscussionExcludedListener = {
    listenerId: originalListenerId,
    listenerName: originalListenerName,
    listenerProfession: origUser?.profession || 'Support Specialist',
    listenerGender: origUser?.gender,
    excludedAt: `Today at ${nowFormatted}`,
    excludedAtTimestamp: nowMs,
    reason: `Handover taken over by ${newListener.name}`,
    newListenerName: newListener.name,
  };

  disc.excludedListeners = [...(disc.excludedListeners || []), excludedEntry];

  // Set new active primary listener
  disc.openedByListenerId = newListener.id;
  disc.openedByListenerName = newListener.name;

  // Clear joinedListenerId if it pointed to either new listener or original listener
  if (disc.joinedListenerId === newListener.id || disc.joinedListenerId === originalListenerId) {
    disc.joinedListenerId = undefined;
    disc.joinedListenerName = undefined;
    disc.joinedListenerProfession = undefined;
    disc.joinedListenerGender = undefined;
    disc.joinedListenerRole = undefined;
    disc.joinedAt = undefined;
  }

  const handoverNotice: ChatMessage = {
    id: `msg_takeover_${nowMs}`,
    sender: 'system',
    text: `${newListener.name} took over this conversation. ${originalListenerName} has been excluded from new messages for privacy.`,
    timestamp: nowFormatted,
    timestampMs: nowMs,
  };

  disc.messages.push(handoverNotice);
  all[index] = disc;
  saveStoredDiscussions(all, disc);

  return { success: true, discussion: disc };
}

// Check if a specific listener was excluded from this conversation
export function isListenerExcludedFromDiscussion(
  discussion: DiscussionConversation,
  listenerId: string
): DiscussionExcludedListener | null {
  if (!discussion.excludedListeners || discussion.excludedListeners.length === 0) {
    return null;
  }
  return discussion.excludedListeners.find((e) => e.listenerId === listenerId) || null;
}

// Get visible messages for a listener (filters out messages after exclusion timestamp if excluded)
export function getVisibleMessagesForListener(
  discussion: DiscussionConversation,
  listenerId: string
): ChatMessage[] {
  const exclusion = isListenerExcludedFromDiscussion(discussion, listenerId);
  if (!exclusion) {
    return discussion.messages;
  }

  // Filter messages up to the exclusion moment
  return discussion.messages.filter((msg) => {
    // If msg has timestampMs, compare strictly
    if (msg.timestampMs) {
      return msg.timestampMs <= exclusion.excludedAtTimestamp;
    }
    // If msg is the exclusion handover notice itself or older, consider visible
    return true;
  });
}

// Get active and excluded participants for the user-facing participant bar
export function getDiscussionParticipants(discussion: DiscussionConversation): DiscussionParticipant[] {
  const participants: DiscussionParticipant[] = [];
  const users = getStoredUsers();

  const isUserActiveListener = (userId: string | undefined): boolean => {
    if (!userId) return false;
    const u = users.find((user) => user.id === userId);
    return Boolean(u && (u.is_listener || u.isListener || u.role === 'listener'));
  };

  // 1. User
  participants.push({
    id: discussion.userId || (discussion.type === 'anonymous' ? 'visitor' : 'user'),
    name: discussion.type === 'anonymous' ? 'You (Anonymous Visitor)' : (discussion.userName ? `You (${discussion.userName})` : 'You (Member)'),
    role: 'user',
    status: 'active',
  });

  // 2. Primary listener
  if (discussion.openedByListenerId) {
    const isExcluded = discussion.excludedListeners?.some((e) => e.listenerId === discussion.openedByListenerId);
    if (!isExcluded && isUserActiveListener(discussion.openedByListenerId)) {
      participants.push({
        id: discussion.openedByListenerId,
        name: discussion.openedByListenerName || 'Assigned Listener',
        role: 'listener',
        status: 'active',
        isOriginalListener: true,
      });
    }
  }

  // 3. Joined listener (if active)
  if (discussion.joinedListenerId) {
    const isExcluded = discussion.excludedListeners?.some((e) => e.listenerId === discussion.joinedListenerId);
    if (!isExcluded && isUserActiveListener(discussion.joinedListenerId)) {
      participants.push({
        id: discussion.joinedListenerId,
        name: discussion.joinedListenerName || 'Joined Listener',
        profession: discussion.joinedListenerProfession,
        gender: discussion.joinedListenerGender,
        role: 'listener',
        status: 'active',
      });
    }
  }

  // 4. Excluded listeners (mark visibly as excluded)
  if (discussion.excludedListeners && discussion.excludedListeners.length > 0) {
    discussion.excludedListeners.forEach((ex) => {
      if (!participants.some((p) => p.id === ex.listenerId)) {
        participants.push({
          id: ex.listenerId,
          name: ex.listenerName,
          profession: ex.listenerProfession,
          gender: ex.listenerGender,
          role: 'listener',
          status: 'excluded',
          excludedAt: ex.excludedAt,
          excludedAtTimestamp: ex.excludedAtTimestamp,
        });
      }
    });
  }

  return participants;
}

/**
 * Robustly find a discussion for a given report by ID, partial numeric ID, or title
 */
export function findDiscussionForReport(
  report: DiscussionReport | null | undefined,
  allDiscussions?: DiscussionConversation[]
): DiscussionConversation | null {
  if (!report) return null;
  const list = allDiscussions || getStoredDiscussions();
  if (report.discussionId) {
    const exact = list.find((d) => d.id === report.discussionId);
    if (exact) return exact;

    // Check partial/numeric matching (e.g., '102' matches 'disc_reg_102' or 'disc_unopened_102')
    const num = report.discussionId.match(/\d+/)?.[0];
    if (num) {
      const matchNum = list.find((d) => d.id.includes(num));
      if (matchNum) return matchNum;
    }
  }

  if (report.discussionTitle) {
    const lowerTitle = report.discussionTitle.toLowerCase();
    const matchTitle = list.find((d) =>
      (d.userName && lowerTitle.includes(d.userName.toLowerCase())) ||
      (d.id && lowerTitle.includes(d.id.toLowerCase()))
    );
    if (matchTitle) return matchTitle;
  }

  return null;
}

export interface ModerationParticipant {
  id: string;
  name: string;
  email?: string;
  role: string;
  hasAccount: boolean;
  isAnonymous: boolean;
  sessionId?: string;
  userAccount?: StoredUser;
  participantType?: 'visitor' | 'listener' | 'co_listener' | 'handed_off_listener' | 'reporter';
}

/**
 * Get ALL participants tied to a specific discussion for moderation and sanctioning.
 * Pulls the original visitor/member, primary listener, joined listeners,
 * handed-off listeners, and referral listeners from shares and message history.
 */
export function getAllDiscussionParticipantsForModeration(
  report?: DiscussionReport | null,
  discussion?: DiscussionConversation | null
): ModerationParticipant[] {
  const list: ModerationParticipant[] = [];
  const addedIds = new Set<string>();
  const addedEmails = new Set<string>();

  const allDiscussions = getStoredDiscussions();
  const allUsers = getStoredUsers();
  const allShares = getStoredShareRequests();

  // Find discussion if not provided directly
  let disc = discussion;
  if (!disc && report) {
    disc = findDiscussionForReport(report, allDiscussions);
  }

  const addCandidate = (candidate: ModerationParticipant) => {
    if (!candidate || !candidate.id) return;
    if (addedIds.has(candidate.id)) return;
    if (candidate.email) {
      const lowerEmail = candidate.email.toLowerCase();
      if (addedEmails.has(lowerEmail)) return;
      addedEmails.add(lowerEmail);
    }
    addedIds.add(candidate.id);
    list.push(candidate);
  };

  // 1. RESOLVE USER / VISITOR (THE ORIGINAL PARTICIPANT)
  const isAnon =
    disc?.type === 'anonymous' ||
    report?.discussionType === 'anonymous' ||
    disc?.userId === 'anon_portal_visitor' ||
    (disc?.userName && disc.userName.toLowerCase().includes('anon')) ||
    (!disc?.userId && report?.reporterRole !== 'registered_user');

  if (isAnon) {
    const sessionId = disc?.userId || report?.discussionId || 'anon_portal_visitor';
    addCandidate({
      id: `candidate_anon_${sessionId}`,
      name: 'Anonymous User',
      hasAccount: false,
      role: 'Visitor (Anonymous User)',
      isAnonymous: true,
      sessionId,
      participantType: 'visitor',
    });
  } else {
    // Registered user
    const regUserId = disc?.userId || (report && report.reporterRole !== 'listener' && report.reporterRole !== 'head_of_listeners' ? report.reporterId : undefined);
    const regUserEmail = disc?.userEmail || (report && report.reporterRole !== 'listener' ? report.reporterEmail : undefined);
    const regUserName = disc?.userName || (report && report.reporterRole !== 'listener' ? report.reporterName : 'Registered Member');

    const matchedUser = allUsers.find(
      (u) =>
        (regUserId && u.id === regUserId) ||
        (regUserEmail && u.email.toLowerCase() === regUserEmail.toLowerCase()) ||
        (regUserName && u.name.toLowerCase() === regUserName.toLowerCase())
    );

    if (matchedUser) {
      addCandidate({
        id: matchedUser.id,
        name: matchedUser.name,
        email: matchedUser.email,
        hasAccount: true,
        role: 'Visitor (Registered Member)',
        isAnonymous: false,
        userAccount: matchedUser,
        participantType: 'visitor',
      });
    } else {
      addCandidate({
        id: regUserId || `candidate_reg_${Date.now()}`,
        name: regUserName,
        email: regUserEmail,
        hasAccount: true,
        role: 'Visitor (Registered Member)',
        isAnonymous: false,
        participantType: 'visitor',
      });
    }
  }

  // 2. RESOLVE ALL LISTENERS (PRIMARY, JOINED, HANDED-OFF, REFERRALS, REPORTERS)
  const registerListener = (
    listenerId?: string,
    listenerName?: string,
    specificRole = 'Assigned Listener',
    email?: string,
    participantType: ModerationParticipant['participantType'] = 'listener'
  ) => {
    if (!listenerId && !listenerName) return;

    // Search user accounts
    const matched = allUsers.find(
      (u) =>
        (listenerId && u.id === listenerId) ||
        (email && u.email.toLowerCase() === email.toLowerCase()) ||
        (listenerName && u.name.toLowerCase() === listenerName.toLowerCase())
    );

    if (matched) {
      addCandidate({
        id: matched.id,
        name: matched.name,
        email: matched.email,
        hasAccount: true,
        role: specificRole,
        isAnonymous: false,
        userAccount: matched,
        participantType,
      });
    } else if (listenerName && !listenerName.toLowerCase().includes('system') && !listenerName.toLowerCase().includes('listening team')) {
      addCandidate({
        id: listenerId || `candidate_listener_${listenerName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        name: listenerName,
        email: email || `${listenerName.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.com`,
        hasAccount: true,
        role: specificRole,
        isAnonymous: false,
        participantType,
      });
    }
  };

  // 2A. Primary / Opened-By Listener
  if (disc?.openedByListenerId || disc?.openedByListenerName) {
    registerListener(
      disc.openedByListenerId,
      disc.openedByListenerName,
      'Primary Listener',
      undefined,
      'listener'
    );
  }

  // 2B. Joined Listener (Co-Listener)
  if (disc?.joinedListenerId || disc?.joinedListenerName) {
    registerListener(
      disc.joinedListenerId,
      disc.joinedListenerName,
      'Joined Listener (Co-Listener)',
      undefined,
      'co_listener'
    );
  }

  // 2C. Closed-By Listener
  if (disc?.closedByListenerId || disc?.closedByListenerName) {
    registerListener(
      disc.closedByListenerId,
      disc.closedByListenerName,
      'Assigned Listener (Closed Session)',
      undefined,
      'listener'
    );
  }

  // 2D. Excluded / Handed-Off Listeners
  if (disc?.excludedListeners && disc.excludedListeners.length > 0) {
    disc.excludedListeners.forEach((ex) => {
      registerListener(
        ex.listenerId,
        ex.listenerName,
        'Previous Listener (Handed Off)',
        undefined,
        'handed_off_listener'
      );
    });
  }

  // 2E. Structured participants list in discussion (if populated)
  if (disc?.participants && disc.participants.length > 0) {
    disc.participants.forEach((p) => {
      if (p.role === 'listener' || p.role === 'head_of_listeners') {
        registerListener(
          p.id,
          p.name,
          p.status === 'excluded'
            ? 'Previous Listener (Handed Off)'
            : (p.isOriginalListener ? 'Primary Listener' : 'Joined Listener (Co-Listener)'),
          undefined,
          p.status === 'excluded' ? 'handed_off_listener' : 'listener'
        );
      }
    });
  }

  // 2F. Share Requests tied to this discussion
  const targetDiscId = disc?.id || report?.discussionId;
  if (targetDiscId) {
    const relatedShares = allShares.filter((s) => s.discussionId === targetDiscId);
    relatedShares.forEach((share) => {
      // The referring listener
      registerListener(
        share.fromListenerId,
        share.fromListenerName,
        'Listener (Referred / Shared)',
        share.fromListenerEmail,
        'listener'
      );
      // The recipient listener if accepted, takeover, or joined
      if (share.status === 'accepted' || share.responseType === 'joined' || share.responseType === 'takeover') {
        registerListener(
          share.toUserId,
          share.toUserName,
          share.responseType === 'takeover' ? 'Assigned Listener (Takeover)' : 'Joined Listener (from Hand-off)',
          share.toUserEmail,
          'co_listener'
        );
      }
    });
  }

  // 2G. Messages in discussion or reported messages from listeners
  const allMessages = [
    ...(disc?.messages || []),
    ...(report?.reportedMessages || [])
  ];

  allMessages.forEach((msg) => {
    if (msg.sender === 'team' || (msg.sender as string) === 'listener') {
      if (msg.senderName && !msg.senderName.toLowerCase().includes('listening team') && !msg.senderName.toLowerCase().includes('system')) {
        registerListener(undefined, msg.senderName, 'Active Listener in Discussion', undefined, 'listener');
      }
    }
  });

  // 2H. Reporting Listener (if report was submitted by a listener)
  if (report && (report.reporterRole === 'listener' || report.reporterRole === 'head_of_listeners')) {
    registerListener(
      report.reporterId,
      report.reporterName,
      'Reporting Listener',
      report.reporterEmail,
      'reporter'
    );
  }

  // 3. GUARANTEE: Ensure at least one listener option is present so Administrator can choose either party
  const hasListener = list.some(
    (c) => !c.isAnonymous && c.participantType !== 'visitor'
  );

  if (!hasListener) {
    if (report?.reporterName && report.reporterRole === 'listener') {
      registerListener(report.reporterId, report.reporterName, 'Assigned Listener', report.reporterEmail);
    } else {
      const defaultListener = allUsers.find((u) => u.role === 'listener' || u.is_listener || u.isListener);
      if (defaultListener) {
        registerListener(defaultListener.id, defaultListener.name, 'Peer Listener (Assigned)', defaultListener.email);
      }
    }
  }

  return list;
}

