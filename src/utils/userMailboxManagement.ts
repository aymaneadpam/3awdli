import { UserMailboxMessage, UserAccount } from '../types';
import { formatSiteDateReadable, formatSiteTime } from './timezoneManagement';
import {
  saveUserMailboxMessageToFirestore,
  fetchUserMailboxMessagesFromFirestore,
  subscribeToUserMailboxMessages,
  deleteUserMailboxMessageFromFirestore
} from '../lib/firestoreService';

const STORAGE_KEY_PREFIX = '3awdli_user_mailbox_';

export function getUserMailboxStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

export function isFakeMailboxMessage(msg: Partial<UserMailboxMessage> | null | undefined): boolean {
  if (!msg) return true;
  if (msg.id?.startsWith('msg_sample_')) return true;
  return false;
}

/**
 * Retrieve all mailbox messages for a specific user.
 */
export function getStoredUserMailboxMessages(userId: string): UserMailboxMessage[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(getUserMailboxStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const clean = parsed.filter((m) => !isFakeMailboxMessage(m));
    // Sort descending by timestamp (newest first)
    return clean.sort((a, b) => (b.createdAtTimestamp || 0) - (a.createdAtTimestamp || 0));
  } catch (err) {
    console.warn('Failed to load user mailbox messages:', err);
    return [];
  }
}

/**
 * Persist mailbox messages for a user and notify UI listeners.
 * If changedMessage is supplied, automatically saves it to Firestore.
 */
export function saveUserMailboxMessages(
  userId: string,
  messages: UserMailboxMessage[],
  changedMessage?: UserMailboxMessage
): void {
  if (!userId) return;
  try {
    const clean = messages.filter((m) => !isFakeMailboxMessage(m));
    localStorage.setItem(getUserMailboxStorageKey(userId), JSON.stringify(clean));
    window.dispatchEvent(new CustomEvent('3awdli_user_mailbox_updated', { detail: { userId } }));

    if (changedMessage && !isFakeMailboxMessage(changedMessage)) {
      saveUserMailboxMessageToFirestore(changedMessage).catch((err) =>
        console.warn('Firestore mailbox message save notice:', err)
      );
    }
  } catch (err) {
    console.warn('Failed to save user mailbox messages:', err);
  }
}

/**
 * Count unread messages in user's mailbox.
 */
export function getUnreadUserMailboxCount(userId: string): number {
  if (!userId) return 0;
  const messages = getStoredUserMailboxMessages(userId);
  return messages.filter((m) => !m.read).length;
}

/**
 * Mark a single message as read.
 */
export function markUserMailboxMessageAsRead(userId: string, messageId: string): void {
  const messages = getStoredUserMailboxMessages(userId);
  let changed = false;
  let updatedMsg: UserMailboxMessage | undefined;

  const updated = messages.map((m) => {
    if (m.id === messageId && !m.read) {
      changed = true;
      updatedMsg = { ...m, read: true };
      return updatedMsg;
    }
    return m;
  });

  if (changed && updatedMsg) {
    saveUserMailboxMessages(userId, updated, updatedMsg);
  }
}

/**
 * Mark a single message as unread.
 */
export function markUserMailboxMessageAsUnread(userId: string, messageId: string): void {
  const messages = getStoredUserMailboxMessages(userId);
  let changed = false;
  let updatedMsg: UserMailboxMessage | undefined;

  const updated = messages.map((m) => {
    if (m.id === messageId && m.read) {
      changed = true;
      updatedMsg = { ...m, read: false };
      return updatedMsg;
    }
    return m;
  });

  if (changed && updatedMsg) {
    saveUserMailboxMessages(userId, updated, updatedMsg);
  }
}

/**
 * Mark all messages in user mailbox as read.
 */
export function markAllUserMailboxMessagesAsRead(userId: string): void {
  const messages = getStoredUserMailboxMessages(userId);
  const updated = messages.map((m) => ({ ...m, read: true }));
  localStorage.setItem(getUserMailboxStorageKey(userId), JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('3awdli_user_mailbox_updated', { detail: { userId } }));

  messages.forEach((m) => {
    if (!m.read) {
      saveUserMailboxMessageToFirestore({ ...m, read: true }).catch((err) =>
        console.warn('Firestore mailbox mark all read notice:', err)
      );
    }
  });
}

/**
 * Delete a message from the mailbox and remove from Firestore.
 */
export function deleteUserMailboxMessage(userId: string, messageId: string): void {
  const messages = getStoredUserMailboxMessages(userId);
  const updated = messages.filter((m) => m.id !== messageId);
  try {
    localStorage.setItem(getUserMailboxStorageKey(userId), JSON.stringify(updated));
    deleteUserMailboxMessageFromFirestore(messageId).catch((err) =>
      console.warn('Firestore delete mailbox message notice:', err)
    );
    window.dispatchEvent(new CustomEvent('3awdli_user_mailbox_updated', { detail: { userId } }));
  } catch (err) {
    console.warn('Failed to delete mailbox message:', err);
  }
}

/**
 * Add a new message to the user's mailbox.
 * Ready for receiving replies to reports or team notifications.
 */
export function addUserMailboxMessage(
  userId: string,
  data: {
    userEmail?: string;
    senderName: string;
    senderRole?: 'team' | 'admin' | 'moderator' | 'listener';
    subject: string;
    summary?: string;
    content: string;
    type?: 'report_reply' | 'support_reply' | 'team_notice' | 'general';
    relatedId?: string;
  }
): UserMailboxMessage {
  const now = new Date();
  const dateStr = formatSiteDateReadable(now);
  const timeStr = formatSiteTime(now);

  const newMessage: UserMailboxMessage = {
    id: `msg_ubox_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    userEmail: data.userEmail,
    senderName: data.senderName || '3awdli Team',
    senderRole: data.senderRole || 'team',
    subject: data.subject,
    summary: data.summary || (data.content.length > 90 ? `${data.content.substring(0, 90)}...` : data.content),
    content: data.content,
    createdAt: `${dateStr} • ${timeStr}`,
    createdAtTimestamp: Date.now(),
    read: false,
    type: data.type || 'general',
    relatedId: data.relatedId,
  };

  const existing = getStoredUserMailboxMessages(userId);
  saveUserMailboxMessages(userId, [newMessage, ...existing], newMessage);
  return newMessage;
}

/**
 * Creates a sample welcome message to allow immediate user verification of mailbox reading.
 */
export function createSampleWelcomeMessage(userId: string, userName?: string): UserMailboxMessage {
  return addUserMailboxMessage(userId, {
    senderName: '3awdli Safety & Support Team',
    senderRole: 'team',
    subject: 'Welcome to your 3awdli Mailbox',
    summary: 'A secure place where replies to your reports and official team updates will arrive.',
    type: 'team_notice',
    content: `Hello ${userName || 'there'},

Welcome to your personal 3awdli Mailbox.

This space is dedicated to receiving official communications from our clinical moderators and support team. When you submit a report regarding an interaction, report a concern, or request safety assistance, our replies and status updates will be delivered directly here.

Each message is private, confidential, and linked only to your secure account.

Warmly,
The 3awdli Care & Community Team`,
  });
}

let isUserMailboxSyncInitialized = false;

// Helper to merge remote messages into local mailboxes grouped by userId
function mergeRemoteMailboxMessages(remoteMessages: UserMailboxMessage[]) {
  if (!remoteMessages || !Array.isArray(remoteMessages)) return;
  const cleanRemote = remoteMessages.filter((m) => !isFakeMailboxMessage(m));

  // Group messages by userId
  const byUser = new Map<string, UserMailboxMessage[]>();
  cleanRemote.forEach((m) => {
    if (!m.userId) return;
    const existing = byUser.get(m.userId) || [];
    existing.push(m);
    byUser.set(m.userId, existing);
  });

  byUser.forEach((remoteList, targetUserId) => {
    const local = getStoredUserMailboxMessages(targetUserId);
    const mergedMap = new Map<string, UserMailboxMessage>();
    local.forEach((m) => mergedMap.set(m.id, m));
    remoteList.forEach((m) => {
      const existing = mergedMap.get(m.id);
      mergedMap.set(m.id, { ...existing, ...m });
    });
    const merged = Array.from(mergedMap.values()).sort(
      (a, b) => (b.createdAtTimestamp || 0) - (a.createdAtTimestamp || 0)
    );
    try {
      localStorage.setItem(getUserMailboxStorageKey(targetUserId), JSON.stringify(merged));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('3awdli_user_mailbox_updated', { detail: { userId: targetUserId } }));
      }
    } catch (err) {
      console.warn('Failed to persist merged mailbox messages for user:', targetUserId, err);
    }
  });
}

/**
 * Initialize real-time synchronization between Firestore and local storage for user mailbox messages.
 */
export function initFirestoreUserMailboxSync(currentUser?: UserAccount | null): () => void {
  if (!currentUser?.id) {
    return () => {};
  }

  // 1. Initial fetch from Firestore
  fetchUserMailboxMessagesFromFirestore(currentUser)
    .then((remoteMessages) => {
      if (remoteMessages && remoteMessages.length > 0) {
        mergeRemoteMailboxMessages(remoteMessages);
      }
    })
    .catch(() => {});

  // 2. Real-time Firestore subscription
  const unsubscribeFirestore = subscribeToUserMailboxMessages(
    currentUser,
    (remoteMessages) => {
      if (!remoteMessages) return;
      mergeRemoteMailboxMessages(remoteMessages);
    },
    () => {}
  );

  return () => {
    unsubscribeFirestore();
  };
}
