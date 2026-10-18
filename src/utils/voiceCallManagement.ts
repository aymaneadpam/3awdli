// Voice Call State Management for Discussions
// Handles initiating, accepting, declining, muting, timing out, and ending voice calls

import { DiscussionConversation, DiscussionVoiceCall, ChatMessage, UserAccount } from '../types';
import { getStoredDiscussions, saveStoredDiscussions } from './discussionManagement';
import { saveDiscussionToFirestore } from '../lib/firestoreService';
import { formatSiteTime } from './timezoneManagement';

export const CALL_RINGING_TIMEOUT_MS = 30000; // ~30 seconds timeout

/**
 * Check if voice call is permitted for a given discussion
 * Only allowed for active (opened) discussions with registered users (not anonymous)
 */
export function canStartVoiceCall(
  discussion: DiscussionConversation | null | undefined
): boolean {
  if (!discussion) return false;
  // Must not be closed or unopened
  if (discussion.status !== 'opened') return false;
  // Must be a registered user (anonymous users cannot be reached or called back)
  const isRegisteredUser = discussion.type === 'registered' || Boolean(discussion.userId);
  if (!isRegisteredUser) return false;

  return true;
}

/**
 * Format duration in seconds to MM:SS
 */
export function formatCallDuration(seconds: number): string {
  const safeSec = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSec / 60);
  const remSec = safeSec % 60;
  return `${mins.toString().padStart(2, '0')}:${remSec.toString().padStart(2, '0')}`;
}

/**
 * Initiate a voice call
 */
export function initiateVoiceCall(
  discussionId: string,
  caller: { id: string; name: string },
  callerRole: 'user' | 'listener'
): DiscussionConversation | null {
  const discussions = getStoredDiscussions();
  const index = discussions.findIndex((d) => d.id === discussionId);
  if (index === -1) return null;

  const discussion = { ...discussions[index] };
  if (!canStartVoiceCall(discussion)) return null;

  // If already in an active or ringing call, do not initiate another
  if (discussion.activeCall && discussion.activeCall.status !== 'ended') {
    return discussion;
  }

  const receiverRole: 'user' | 'listener' = callerRole === 'listener' ? 'user' : 'listener';
  const receiverId = callerRole === 'listener' 
    ? (discussion.userId || '') 
    : (discussion.openedByListenerId || discussion.joinedListenerId || '');
  const receiverName = callerRole === 'listener' 
    ? (discussion.userName || 'Member') 
    : (discussion.openedByListenerName || discussion.joinedListenerName || 'Listener');

  const newCall: DiscussionVoiceCall = {
    id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    status: 'ringing',
    callerId: caller.id,
    callerName: caller.name,
    callerRole,
    receiverId,
    receiverName,
    receiverRole,
    startedAtTimestamp: Date.now(),
    isMuted: {
      user: false,
      listener: false,
    },
  };

  discussion.activeCall = newCall;
  discussions[index] = discussion;

  saveStoredDiscussions(discussions, discussion);
  return discussion;
}

/**
 * Accept an incoming call
 */
export function acceptVoiceCall(
  discussionId: string,
  receiverRole: 'user' | 'listener'
): DiscussionConversation | null {
  const discussions = getStoredDiscussions();
  const index = discussions.findIndex((d) => d.id === discussionId);
  if (index === -1) return null;

  const discussion = { ...discussions[index] };
  if (!discussion.activeCall || discussion.activeCall.status !== 'ringing') {
    return null;
  }

  const now = Date.now();
  discussion.activeCall = {
    ...discussion.activeCall,
    status: 'active',
    acceptedAtTimestamp: now,
  };

  // Add system notification in chat history
  const systemMsg: ChatMessage = {
    id: `call_msg_start_${now}`,
    sender: 'system',
    text: `📞 Voice call connected • ${formatSiteTime(now)}`,
    timestamp: formatSiteTime(now),
    timestampMs: now,
  };
  discussion.messages = [...(discussion.messages || []), systemMsg];

  discussions[index] = discussion;
  saveStoredDiscussions(discussions, discussion);
  return discussion;
}

/**
 * Decline an incoming call
 */
export function declineVoiceCall(
  discussionId: string,
  role: 'user' | 'listener'
): DiscussionConversation | null {
  const discussions = getStoredDiscussions();
  const index = discussions.findIndex((d) => d.id === discussionId);
  if (index === -1) return null;

  const discussion = { ...discussions[index] };
  if (!discussion.activeCall || discussion.activeCall.status === 'ended') {
    return null;
  }

  const now = Date.now();
  discussion.activeCall = {
    ...discussion.activeCall,
    status: 'ended',
    endedAtTimestamp: now,
    endedByRole: role,
  };

  discussions[index] = discussion;
  saveStoredDiscussions(discussions, discussion);
  return discussion;
}

/**
 * Hang up an active or ringing call
 */
export function hangUpVoiceCall(
  discussionId: string,
  role: 'user' | 'listener'
): DiscussionConversation | null {
  const discussions = getStoredDiscussions();
  const index = discussions.findIndex((d) => d.id === discussionId);
  if (index === -1) return null;

  const discussion = { ...discussions[index] };
  if (!discussion.activeCall || discussion.activeCall.status === 'ended') {
    return null;
  }

  const now = Date.now();
  const wasActive = discussion.activeCall.status === 'active';
  const durationSec = discussion.activeCall.acceptedAtTimestamp
    ? Math.max(0, Math.floor((now - discussion.activeCall.acceptedAtTimestamp) / 1000))
    : 0;

  discussion.activeCall = {
    ...discussion.activeCall,
    status: 'ended',
    endedAtTimestamp: now,
    endedByRole: role,
  };

  // If the call was active, record system notification with duration
  if (wasActive) {
    const durationFormatted = formatCallDuration(durationSec);
    const systemMsg: ChatMessage = {
      id: `call_msg_end_${now}`,
      sender: 'system',
      text: `📞 Voice call ended • Duration: ${durationFormatted}`,
      timestamp: formatSiteTime(now),
      timestampMs: now,
    };
    discussion.messages = [...(discussion.messages || []), systemMsg];
  }

  discussions[index] = discussion;
  saveStoredDiscussions(discussions, discussion);
  return discussion;
}

/**
 * Toggle mute state for local participant
 */
export function toggleMuteVoiceCall(
  discussionId: string,
  role: 'user' | 'listener'
): DiscussionConversation | null {
  const discussions = getStoredDiscussions();
  const index = discussions.findIndex((d) => d.id === discussionId);
  if (index === -1) return null;

  const discussion = { ...discussions[index] };
  if (!discussion.activeCall || discussion.activeCall.status !== 'active') {
    return null;
  }

  const currentMuted = Boolean(discussion.activeCall.isMuted?.[role]);
  discussion.activeCall = {
    ...discussion.activeCall,
    isMuted: {
      ...discussion.activeCall.isMuted,
      [role]: !currentMuted,
    },
  };

  discussions[index] = discussion;
  saveStoredDiscussions(discussions, discussion);
  return discussion;
}

/**
 * Check if the ringing call has timed out (~30s without answer)
 * Returns true if timed out and updated
 */
export function checkCallTimeout(discussionId: string): boolean {
  const discussions = getStoredDiscussions();
  const index = discussions.findIndex((d) => d.id === discussionId);
  if (index === -1) return false;

  const discussion = { ...discussions[index] };
  if (!discussion.activeCall || discussion.activeCall.status !== 'ringing') {
    return false;
  }

  const now = Date.now();
  if (now - discussion.activeCall.startedAtTimestamp >= CALL_RINGING_TIMEOUT_MS) {
    discussion.activeCall = {
      ...discussion.activeCall,
      status: 'ended',
      endedAtTimestamp: now,
      endedByRole: 'timeout',
    };

    discussions[index] = discussion;
    saveStoredDiscussions(discussions, discussion);
    return true;
  }

  return false;
}
