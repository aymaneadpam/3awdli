import { UserMailboxMessage } from '../types';

const STORAGE_KEY_PREFIX = '3awdli_user_mailbox_';

export function getUserMailboxStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
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
    // Sort descending by timestamp (newest first)
    return parsed.sort((a, b) => (b.createdAtTimestamp || 0) - (a.createdAtTimestamp || 0));
  } catch (err) {
    console.warn('Failed to load user mailbox messages:', err);
    return [];
  }
}

/**
 * Persist mailbox messages for a user and notify UI listeners.
 */
export function saveUserMailboxMessages(userId: string, messages: UserMailboxMessage[]): void {
  if (!userId) return;
  try {
    localStorage.setItem(getUserMailboxStorageKey(userId), JSON.stringify(messages));
    window.dispatchEvent(new CustomEvent('3awdli_user_mailbox_updated', { detail: { userId } }));
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
  const updated = messages.map((m) => {
    if (m.id === messageId && !m.read) {
      changed = true;
      return { ...m, read: true };
    }
    return m;
  });

  if (changed) {
    saveUserMailboxMessages(userId, updated);
  }
}

/**
 * Mark a single message as unread.
 */
export function markUserMailboxMessageAsUnread(userId: string, messageId: string): void {
  const messages = getStoredUserMailboxMessages(userId);
  let changed = false;
  const updated = messages.map((m) => {
    if (m.id === messageId && m.read) {
      changed = true;
      return { ...m, read: false };
    }
    return m;
  });

  if (changed) {
    saveUserMailboxMessages(userId, updated);
  }
}

/**
 * Mark all messages in user mailbox as read.
 */
export function markAllUserMailboxMessagesAsRead(userId: string): void {
  const messages = getStoredUserMailboxMessages(userId);
  const updated = messages.map((m) => ({ ...m, read: true }));
  saveUserMailboxMessages(userId, updated);
}

/**
 * Delete a message from the mailbox.
 */
export function deleteUserMailboxMessage(userId: string, messageId: string): void {
  const messages = getStoredUserMailboxMessages(userId);
  const updated = messages.filter((m) => m.id !== messageId);
  saveUserMailboxMessages(userId, updated);
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
  const dateStr = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
  saveUserMailboxMessages(userId, [newMessage, ...existing]);
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
