import { LoungeQueueMember, LoungeQueueState, UserAccount, LoungeArticle } from '../types';
import { updateLoungeArticle, getStoredLoungeArticles } from './loungeManagement';
import { playLoungeBellSound } from './loungeAudio';
import { formatSiteTime } from './timezoneManagement';

const QUEUE_STORAGE_PREFIX = '3awdli_lounge_queue_';
export const MAX_QUEUE_ADMISSIONS = 8;
export const MAX_ROOM_CAPACITY = 10;
export const CALL_TIMEOUT_SECONDS = 60; // 1 minute per person

/**
 * Convert number into ordinal string (1 -> 1st, 2 -> 2nd, 3 -> 3rd, 4 -> 4th, etc.)
 */
export function formatOrdinal(n: number): string {
  const pr = new Intl.PluralRules('en-US', { type: 'ordinal' });
  const suffixes: Record<string, string> = {
    one: 'st',
    two: 'nd',
    few: 'rd',
    other: 'th',
  };
  return `${n}${suffixes[pr.select(n)] || 'th'}`;
}

/**
 * Default sample users for quick testing and queue demonstration
 */
export const SAMPLE_QUEUE_USERS = [
  { name: 'Salma Benali', email: 'salma.b@example.com', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80' },
  { name: 'Mehdi Benjelloun', email: 'mehdi.b@example.com', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
  { name: 'Leila Mansouri', email: 'leila.m@example.com', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' },
  { name: 'Youssef El Alami', email: 'youssef.e@example.com', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80' },
  { name: 'Nadia Cherkaoui', email: 'nadia.c@example.com', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80' },
  { name: 'Karim Tazi', email: 'karim.t@example.com', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80' },
  { name: 'Sara Amrani', email: 'sara.a@example.com', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80' },
  { name: 'Omar Berrada', email: 'omar.b@example.com', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80' },
  { name: 'Zineb Alaoui', email: 'zineb.a@example.com', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80' },
];

/**
 * Retrieve current queue state for an article from localStorage
 */
export function getStoredQueueState(articleId: string): LoungeQueueState {
  const key = `${QUEUE_STORAGE_PREFIX}${articleId}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed: LoungeQueueState = JSON.parse(raw);
      // Ensure default fields exist
      if (typeof parsed.admittedCount !== 'number') parsed.admittedCount = 0;
      if (typeof parsed.roomParticipantsCount !== 'number') parsed.roomParticipantsCount = 1; // Host
      if (!Array.isArray(parsed.members)) parsed.members = [];
      return parsed;
    }
  } catch (err) {
    console.error('Error reading stored queue state:', err);
  }

  // Initial fresh state
  const fresh: LoungeQueueState = {
    articleId,
    isQueueOpen: false,
    openedAtTimestamp: null,
    currentCalledMemberId: null,
    currentCalledQueueNumber: null,
    currentCalledUserName: null,
    callStartedAtTimestamp: null,
    callExpiresAtTimestamp: null,
    admittedCount: 0,
    roomParticipantsCount: 1, // Host is initially in the room
    isRoomClosed: false,
    closedAtTimestamp: null,
    closedReason: null,
    members: [],
  };
  localStorage.setItem(key, JSON.stringify(fresh));
  return fresh;
}

/**
 * Save queue state and dispatch storage & custom update events
 */
export function saveQueueState(state: LoungeQueueState): void {
  const key = `${QUEUE_STORAGE_PREFIX}${state.articleId}`;
  localStorage.setItem(key, JSON.stringify(state));
  window.dispatchEvent(
    new CustomEvent(`3awdli_lounge_queue_updated_${state.articleId}`, {
      detail: state,
    })
  );
}

/**
 * Check if the room should automatically close based on rules:
 * 1. 8 people have successfully joined the room from the queue, OR
 * 2. The chat room reaches 10 people total (Host + participants).
 */
export function checkQueueClosingConditions(state: LoungeQueueState): boolean {
  if (state.isRoomClosed) return true;
  return (
    state.admittedCount >= MAX_QUEUE_ADMISSIONS ||
    state.roomParticipantsCount >= MAX_ROOM_CAPACITY
  );
}

/**
 * Call the next waiting person in line
 */
export function advanceToNextInQueue(
  state: LoungeQueueState,
  playChime: boolean = true
): LoungeQueueState {
  // If closing conditions are met, close the room immediately
  if (checkQueueClosingConditions(state)) {
    return closeLoungeSessionInternal(state, 'capacity_reached');
  }

  // Find next waiting member
  const nextMember = state.members.find((m) => m.status === 'waiting');

  if (!nextMember) {
    // No more people in queue waiting right now
    const updated: LoungeQueueState = {
      ...state,
      currentCalledMemberId: null,
      currentCalledQueueNumber: null,
      currentCalledUserName: null,
      callStartedAtTimestamp: null,
      callExpiresAtTimestamp: null,
    };
    saveQueueState(updated);
    return updated;
  }

  const now = Date.now();
  const expiresAt = now + CALL_TIMEOUT_SECONDS * 1000;

  const updatedMembers = state.members.map((m) => {
    if (m.id === nextMember.id) {
      return {
        ...m,
        status: 'called' as const,
        calledAtTimestamp: now,
      };
    }
    return m;
  });

  const updated: LoungeQueueState = {
    ...state,
    members: updatedMembers,
    currentCalledMemberId: nextMember.id,
    currentCalledQueueNumber: nextMember.queueNumber,
    currentCalledUserName: nextMember.userName,
    callStartedAtTimestamp: now,
    callExpiresAtTimestamp: expiresAt,
  };

  saveQueueState(updated);

  if (playChime) {
    playLoungeBellSound();
  }

  return updated;
}

/**
 * Host opens the queue:
 * - Plays bell sound
 * - Announces front-of-queue person
 * - Starts 1-minute timer
 */
export function hostOpenQueue(
  articleId: string,
  user: UserAccount
): LoungeQueueState {
  const current = getStoredQueueState(articleId);

  // If already closed, cannot reopen directly without reset
  if (current.isRoomClosed) return current;

  const now = Date.now();
  const openState: LoungeQueueState = {
    ...current,
    isQueueOpen: true,
    openedAtTimestamp: now,
    roomParticipantsCount: Math.max(1, current.roomParticipantsCount), // Host is present
  };

  // If there are waiting members, advance to the first one immediately with chime
  return advanceToNextInQueue(openState, true);
}

/**
 * User joins the queue
 */
export function joinLoungeQueue(
  articleId: string,
  user: UserAccount
): { success: boolean; message?: string; state: LoungeQueueState } {
  const current = getStoredQueueState(articleId);

  if (current.isRoomClosed) {
    return {
      success: false,
      message: 'This lounge session is already closed.',
      state: current,
    };
  }

  // Check if user is already in queue
  const existingIndex = current.members.findIndex((m) => m.userId === user.id);
  if (existingIndex !== -1) {
    const existing = current.members[existingIndex];
    if (existing.status === 'waiting' || existing.status === 'called') {
      return {
        success: false,
        message: `You are already in the queue at position #${existing.queueNumber}.`,
        state: current,
      };
    }
    if (existing.status === 'admitted') {
      return {
        success: false,
        message: 'You have already entered this lounge session.',
        state: current,
      };
    }
  }

  // Assign sequential queue number based on all-time joined count in this queue
  const nextQueueNumber = current.members.length + 1;
  const newMember: LoungeQueueMember = {
    id: `queue_mbr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    userId: user.id,
    userName: user.name || 'Community Member',
    userEmail: user.email,
    avatarUrl: user.avatarUrl,
    queueNumber: nextQueueNumber,
    joinedAt: formatSiteTime(),
    joinedAtTimestamp: Date.now(),
    status: 'waiting',
  };

  const updatedMembers = [...current.members, newMember];
  let updatedState: LoungeQueueState = {
    ...current,
    members: updatedMembers,
  };

  // If queue is already open and no one is currently called, immediately call this new member!
  if (updatedState.isQueueOpen && !updatedState.currentCalledMemberId) {
    updatedState = advanceToNextInQueue(updatedState, true);
  } else {
    saveQueueState(updatedState);
  }

  return {
    success: true,
    state: updatedState,
  };
}

/**
 * User leaves the queue
 * - Removes user from the queue
 * - Adjusts everyone else's queue numbers accordingly
 */
export function leaveLoungeQueue(
  articleId: string,
  userId: string
): LoungeQueueState {
  const current = getStoredQueueState(articleId);
  const target = current.members.find((m) => m.userId === userId);

  if (!target) return current;

  const targetQueueNumber = target.queueNumber;

  // Remove target from members, and adjust everyone behind them by shifting queue numbers down by 1
  const remaining = current.members.filter((m) => m.userId !== userId);
  const updatedMembers = remaining.map((m) => {
    if (m.queueNumber > targetQueueNumber) {
      return {
        ...m,
        queueNumber: m.queueNumber - 1,
      };
    }
    return m;
  });

  let updatedState: LoungeQueueState = {
    ...current,
    members: updatedMembers,
  };

  // If the leaving user was the one currently called, advance immediately to next
  if (current.currentCalledMemberId === target.id) {
    updatedState = advanceToNextInQueue(updatedState, true);
  } else {
    // If someone else is called, keep their queue number in sync with any shift
    if (updatedState.currentCalledMemberId) {
      const called = updatedMembers.find((m) => m.id === updatedState.currentCalledMemberId);
      if (called) {
        updatedState.currentCalledQueueNumber = called.queueNumber;
      }
    }
    saveQueueState(updatedState);
  }

  return updatedState;
}

/**
 * Handle user leaving the chat room
 * - Decrements room participant count
 */
export function userLeaveLoungeRoom(
  articleId: string,
  userId: string
): LoungeQueueState {
  const current = getStoredQueueState(articleId);
  const newCount = Math.max(1, current.roomParticipantsCount - 1);
  
  // Mark member as 'left' if they were in the queue list
  const updatedMembers = current.members.map((m) => {
    if (m.userId === userId && m.status === 'admitted') {
      return { ...m, status: 'left' as const };
    }
    return m;
  });

  const updated: LoungeQueueState = {
    ...current,
    roomParticipantsCount: newCount,
    members: updatedMembers,
  };

  saveQueueState(updated);
  return updated;
}

/**
 * The currently called person clicks "Enter" to join the room
 */
export function enterLoungeRoom(
  articleId: string,
  memberId: string
): { success: boolean; state: LoungeQueueState; wasClosed: boolean } {
  const current = getStoredQueueState(articleId);

  if (current.isRoomClosed) {
    return { success: false, state: current, wasClosed: true };
  }

  const memberIndex = current.members.findIndex((m) => m.id === memberId);
  if (memberIndex === -1) {
    return { success: false, state: current, wasClosed: false };
  }

  const member = current.members[memberIndex];
  const newAdmittedCount = current.admittedCount + 1;
  const newRoomParticipants = current.roomParticipantsCount + 1;

  const updatedMembers = current.members.map((m) => {
    if (m.id === memberId) {
      return {
        ...m,
        status: 'admitted' as const,
        admittedAtTimestamp: Date.now(),
      };
    }
    return m;
  });

  const stateWithAdmission: LoungeQueueState = {
    ...current,
    members: updatedMembers,
    admittedCount: newAdmittedCount,
    roomParticipantsCount: newRoomParticipants,
    currentCalledMemberId: null,
    currentCalledQueueNumber: null,
    currentCalledUserName: null,
    callStartedAtTimestamp: null,
    callExpiresAtTimestamp: null,
  };

  // Check closing conditions:
  // - 8 people have entered from queue, OR
  // - room reaches 10 people total
  if (
    newAdmittedCount >= MAX_QUEUE_ADMISSIONS ||
    newRoomParticipants >= MAX_ROOM_CAPACITY
  ) {
    const closedState = closeLoungeSessionInternal(
      stateWithAdmission,
      'capacity_reached'
    );
    return { success: true, state: closedState, wasClosed: true };
  }

  // Otherwise, advance to the next person in line!
  const nextState = advanceToNextInQueue(stateWithAdmission, true);
  return { success: true, state: nextState, wasClosed: false };
}

/**
 * 1-minute timeout expired for the currently called person:
 * - Remove them from the queue entirely
 * - Move on to announce the next person in line the same way (bell, message, 1-minute timer)
 */
export function handleCallTimeout(
  articleId: string,
  timedOutMemberId: string
): LoungeQueueState {
  const current = getStoredQueueState(articleId);

  if (current.isRoomClosed) return current;

  // Verify that this member is still the one called
  if (current.currentCalledMemberId !== timedOutMemberId) {
    return current;
  }

  const timedOutMember = current.members.find((m) => m.id === timedOutMemberId);
  const timedOutQueueNumber = timedOutMember ? timedOutMember.queueNumber : 0;

  // Remove them from the queue entirely and adjust queue numbers for members behind them
  const remaining = current.members.filter((m) => m.id !== timedOutMemberId);
  const updatedMembers = remaining.map((m) => {
    if (m.queueNumber > timedOutQueueNumber) {
      return {
        ...m,
        queueNumber: m.queueNumber - 1,
      };
    }
    return m;
  });

  const stateWithoutMember: LoungeQueueState = {
    ...current,
    members: updatedMembers,
    currentCalledMemberId: null,
    currentCalledQueueNumber: null,
    currentCalledUserName: null,
    callStartedAtTimestamp: null,
    callExpiresAtTimestamp: null,
  };

  // Immediately announce the next person in line with bell sound and 1-min timer
  return advanceToNextInQueue(stateWithoutMember, true);
}

/**
 * Internal session closer that updates the Lounge Article to closed/past
 */
function closeLoungeSessionInternal(
  state: LoungeQueueState,
  reason: 'capacity_reached' | 'host_manual'
): LoungeQueueState {
  const now = Date.now();
  const closedState: LoungeQueueState = {
    ...state,
    isQueueOpen: false,
    isRoomClosed: true,
    closedAtTimestamp: now,
    closedReason: reason,
    currentCalledMemberId: null,
    currentCalledQueueNumber: null,
    currentCalledUserName: null,
    callStartedAtTimestamp: null,
    callExpiresAtTimestamp: null,
  };

  saveQueueState(closedState);

  // Mark article as closed in storage and Firestore immediately
  updateLoungeArticle(state.articleId, {
    isClosed: true,
    closedAt: new Date(now).toISOString(),
  }).catch((err) => {
    console.error('Error updating closed lounge article:', err);
  });

  return closedState;
}

/**
 * Host manual close:
 * - Confirmed via Host "Close Room" button
 * - Stops accepting calls immediately
 * - Lounge is marked as closed right away, regardless of how many people had joined
 */
export function hostManualCloseRoom(articleId: string): LoungeQueueState {
  const current = getStoredQueueState(articleId);
  return closeLoungeSessionInternal(current, 'host_manual');
}

/**
 * Populate sample queue users to enable effortless 1-click testing
 */
export function seedSampleQueueMembers(articleId: string): LoungeQueueState {
  const current = getStoredQueueState(articleId);
  if (current.isRoomClosed) return current;

  let nextNumber = current.members.length + 1;
  const newMembers: LoungeQueueMember[] = [];

  SAMPLE_QUEUE_USERS.forEach((usr, idx) => {
    // Avoid duplicates by email
    if (!current.members.some((m) => m.userEmail === usr.email)) {
      newMembers.push({
        id: `sample_mbr_${Date.now()}_${idx}`,
        userId: `sample_usr_${idx}`,
        userName: usr.name,
        userEmail: usr.email,
        avatarUrl: usr.avatar,
        queueNumber: nextNumber++,
        joinedAt: formatSiteTime(Date.now() - (10 - idx) * 45 * 1000),
        joinedAtTimestamp: Date.now() - (10 - idx) * 45 * 1000,
        status: 'waiting',
      });
    }
  });

  let updatedState: LoungeQueueState = {
    ...current,
    members: [...current.members, ...newMembers],
  };

  if (updatedState.isQueueOpen && !updatedState.currentCalledMemberId) {
    updatedState = advanceToNextInQueue(updatedState, true);
  } else {
    saveQueueState(updatedState);
  }

  return updatedState;
}

/**
 * Reset a closed session for testing purposes (Host convenience)
 */
export function resetLoungeSessionForTest(articleId: string): LoungeQueueState {
  const key = `${QUEUE_STORAGE_PREFIX}${articleId}`;
  localStorage.removeItem(key);

  updateLoungeArticle(articleId, {
    isClosed: false,
    closedAt: undefined,
  }).catch(() => {});

  const fresh = getStoredQueueState(articleId);
  saveQueueState(fresh);
  return fresh;
}
