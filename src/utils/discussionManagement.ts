import { 
  DiscussionConversation, 
  ChatMessage, 
  ListenerGenderPreference,
  DiscussionParticipant,
  DiscussionExcludedListener,
  UserAccount
} from '../types';
import { verifyListenerKeyCode, getStoredUsers } from './userManagement';

const DISCUSSIONS_STORAGE_KEY = '3awdli_discussions';

const SEED_DISCUSSIONS: DiscussionConversation[] = [
  {
    id: 'disc_anon_101',
    type: 'anonymous',
    userName: 'Anonymous Visitor #101',
    startedAt: '18 minutes ago',
    startedAtTimestamp: Date.now() - 18 * 60 * 1000,
    status: 'unopened',
    genderPreference: 'female',
    messages: [
      {
        id: 'msg_anon_01_sys',
        sender: 'system',
        text: 'Confidential Session Started. Start talking, a team member will immediately join you.',
        timestamp: '11:42 AM',
      },
      {
        id: 'msg_anon_01_usr',
        sender: 'user',
        text: "I've been carrying immense pressure regarding university graduation and family expectations. I haven't slept properly in three nights and don't know who to speak to safely.",
        timestamp: '11:43 AM',
      },
      {
        id: 'msg_anon_01_tm',
        sender: 'team',
        senderName: 'Listening Team',
        text: "We hear you, and we're here with you. Take all the time you need to express what you're experiencing.",
        timestamp: '11:44 AM',
      },
    ],
  },
  {
    id: 'disc_reg_102',
    type: 'registered',
    userName: 'Nadia Cherkaoui',
    userEmail: 'nadia.cherkaoui@example.com',
    userId: 'user_sample_04',
    startedAt: '45 minutes ago',
    startedAtTimestamp: Date.now() - 45 * 60 * 1000,
    status: 'unopened',
    genderPreference: 'male',
    messages: [
      {
        id: 'msg_reg_02_sys',
        sender: 'system',
        text: 'Confidential Member Session Started. Identity protected according to 3awdli ethics.',
        timestamp: '11:15 AM',
      },
      {
        id: 'msg_reg_02_usr',
        sender: 'user',
        text: 'Salam. Over the past three weeks I have been getting severe panic spikes before leading our project standup calls at work. My heart races and I feel like I will faint.',
        timestamp: '11:16 AM',
      },
    ],
  },
  {
    id: 'disc_anon_103',
    type: 'anonymous',
    userName: 'Anonymous Visitor #103',
    startedAt: '1 hour ago',
    startedAtTimestamp: Date.now() - 60 * 60 * 1000,
    status: 'unopened',
    genderPreference: 'any',
    messages: [
      {
        id: 'msg_anon_03_sys',
        sender: 'system',
        text: 'Confidential Session Started.',
        timestamp: '10:58 AM',
      },
      {
        id: 'msg_anon_03_usr',
        sender: 'user',
        text: 'I just feel terribly lonely and isolated lately. Everyone around me seems to have their lives sorted out, and I feel completely stuck.',
        timestamp: '11:01 AM',
      },
    ],
  },
  {
    id: 'disc_reg_104',
    type: 'registered',
    userName: 'Karim Tazi',
    userEmail: 'karim.tazi@example.com',
    userId: 'user_sample_05',
    startedAt: '2 hours ago',
    startedAtTimestamp: Date.now() - 120 * 60 * 1000,
    status: 'unopened',
    genderPreference: 'male',
    messages: [
      {
        id: 'msg_reg_04_sys',
        sender: 'system',
        text: 'Confidential Member Session Started.',
        timestamp: '09:55 AM',
      },
      {
        id: 'msg_reg_04_usr',
        sender: 'user',
        text: "I recently went through a painful breakup and I'm having trouble focusing during the day. Need some perspective on how to process the grief.",
        timestamp: '09:58 AM',
      },
    ],
  },
  {
    id: 'disc_claimed_105',
    type: 'anonymous',
    userName: 'Anonymous Visitor #105',
    startedAt: '3 hours ago',
    startedAtTimestamp: Date.now() - 180 * 60 * 1000,
    status: 'opened',
    genderPreference: 'female',
    openedByListenerId: 'listener_other_leila',
    openedByListenerName: 'Dr. Leila Senhaji',
    openedAt: 'Today at 09:15 AM',
    messages: [
      {
        id: 'msg_claimed_05_sys',
        sender: 'system',
        text: 'Confidential Session Started.',
        timestamp: '09:05 AM',
      },
      {
        id: 'msg_claimed_05_usr',
        sender: 'user',
        text: 'Struggling with burnout and chronic fatigue from clinical shift rotations.',
        timestamp: '09:08 AM',
      },
      {
        id: 'msg_claimed_05_tm',
        sender: 'team',
        senderName: 'Dr. Leila Senhaji',
        text: 'Hello. I completely understand how grueling shift work can be. Let us unpack what parts are draining your energy most right now.',
        timestamp: '09:16 AM',
      },
    ],
  },
  {
    id: 'disc_closed_106',
    type: 'registered',
    userName: 'Karim Tazi',
    userEmail: 'karim.tazi@example.com',
    userId: 'user_sample_05',
    startedAt: 'Yesterday at 4:30 PM',
    startedAtTimestamp: Date.now() - 24 * 60 * 60 * 1000,
    status: 'closed',
    genderPreference: 'any',
    openedByListenerId: 'user_sample_03',
    openedByListenerName: 'Dr. Youssef El Alami',
    openedAt: 'Yesterday at 4:32 PM',
    closedAt: 'Yesterday at 5:10 PM',
    closedByListenerId: 'user_sample_03',
    closedByListenerName: 'Dr. Youssef El Alami',
    messages: [
      {
        id: 'msg_cl_01',
        sender: 'system',
        text: 'Confidential Member Session Started.',
        timestamp: '04:30 PM',
      },
      {
        id: 'msg_cl_02',
        sender: 'user',
        text: 'I felt overwhelmed by work expectations this week, but talking through step-by-step boundaries helped me calm down.',
        timestamp: '04:35 PM',
      },
      {
        id: 'msg_cl_03',
        sender: 'team',
        senderName: 'Dr. Youssef El Alami',
        text: 'You handled that reflection with great honesty, Karim. Remember that rest is a prerequisite to resilience, not a reward. Reach back out anytime you need.',
        timestamp: '05:05 PM',
      },
      {
        id: 'msg_cl_04',
        sender: 'system',
        text: 'This conversation was ended by the listener.',
        timestamp: '05:10 PM',
      },
    ],
  },
];

export function getStoredDiscussions(): DiscussionConversation[] {
  try {
    const raw = localStorage.getItem(DISCUSSIONS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(DISCUSSIONS_STORAGE_KEY, JSON.stringify(SEED_DISCUSSIONS));
      return SEED_DISCUSSIONS;
    }
    const discussions: DiscussionConversation[] = JSON.parse(raw);
    // Ensure all discussions have a valid genderPreference
    let hasChanges = false;
    const seedMap: Record<string, ListenerGenderPreference> = {
      disc_anon_101: 'female',
      disc_reg_102: 'male',
      disc_anon_103: 'any',
      disc_reg_104: 'male',
      disc_claimed_105: 'female',
      disc_closed_106: 'any',
    };
    discussions.forEach((d) => {
      if (!d.genderPreference) {
        d.genderPreference = seedMap[d.id] || 'any';
        hasChanges = true;
      }
    });
    if (hasChanges) {
      localStorage.setItem(DISCUSSIONS_STORAGE_KEY, JSON.stringify(discussions));
    }
    return discussions;
  } catch (err) {
    console.error('Failed to parse discussions:', err);
    return SEED_DISCUSSIONS;
  }
}

export function saveStoredDiscussions(discussions: DiscussionConversation[]): void {
  try {
    localStorage.setItem(DISCUSSIONS_STORAGE_KEY, JSON.stringify(discussions));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('3awdli_discussion_sync', { detail: { timestamp: Date.now() } }));
    }
  } catch (err) {
    console.error('Failed to save discussions:', err);
  }
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

  all[index].listenerAttentionStatus = status;
  all[index].listenerAttentionTimestamp = Date.now();
  saveStoredDiscussions(all);
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
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    timestampMs: nowMs,
  };

  disc.messages.push(listenerMsg);
  // Reset attention to reading after sending
  disc.listenerAttentionStatus = 'reading';
  disc.listenerAttentionTimestamp = nowMs;

  saveStoredDiscussions(all);
  return { success: true, message: listenerMsg };
}

// Close a discussion from listener side
export function closeDiscussion(
  discussionId: string,
  listenerId: string,
  listenerName: string
): { success: boolean; discussion?: DiscussionConversation; error?: string } {
  const all = getStoredDiscussions();
  const index = all.findIndex((d) => d.id === discussionId);
  if (index === -1) {
    return { success: false, error: 'Discussion not found.' };
  }

  const disc = all[index];
  const nowFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  disc.status = 'closed';
  disc.closedAt = `Today at ${nowFormatted}`;
  disc.closedByListenerId = listenerId;
  disc.closedByListenerName = listenerName;
  disc.listenerAttentionStatus = null;

  // Add an audit notice message to the conversation
  const closeNotice: ChatMessage = {
    id: `msg_close_${Date.now()}`,
    sender: 'system',
    text: 'This conversation was ended by the listener.',
    timestamp: nowFormatted,
  };
  disc.messages.push(closeNotice);

  saveStoredDiscussions(all);
  return { success: true, discussion: disc };
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
  const originalListenerId = disc.openedByListenerId;

  // Verify whether the original listener still has an active listener badge/role
  let isListenerStillAvailable = false;
  if (originalListenerId) {
    try {
      const users = getStoredUsers();
      const listenerUser = users.find((u) => u.id === originalListenerId);
      if (listenerUser && (listenerUser.is_listener || listenerUser.isListener || listenerUser.role === 'listener')) {
        isListenerStillAvailable = true;
      }
    } catch {
      // Fallback
      isListenerStillAvailable = Boolean(disc.openedByListenerId);
    }
  }

  const nowFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isListenerStillAvailable) {
    // Route back to the exact same listener!
    disc.status = 'opened';
    disc.reopenedAt = `Today at ${nowFormatted}`;
    disc.listenerUnavailable = false;
    disc.messages.push(userMessage);
    disc.messages.push({
      id: `msg_reopen_sys_${Date.now()}`,
      sender: 'system',
      text: `Conversation resumed by member. Re-routed to your previous listener (${disc.openedByListenerName || 'Assigned Listener'}).`,
      timestamp: nowFormatted,
    });
    saveStoredDiscussions(all);
    return { success: true, discussion: disc, listenerUnavailable: false };
  } else {
    // Original listener is no longer available
    disc.status = 'unopened'; // Available for team coverage
    disc.listenerUnavailable = true;
    disc.messages.push(userMessage);
    disc.messages.push({
      id: `msg_unavail_sys_${Date.now()}`,
      sender: 'system',
      text: 'Your previous listener is currently unavailable. Your message has been safely received and will be seen by the team soon.',
      timestamp: nowFormatted,
    });
    saveStoredDiscussions(all);
    return { success: true, discussion: disc, listenerUnavailable: true };
  }
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

  const nowFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const updatedDisc: DiscussionConversation = {
    ...currentDisc,
    status: 'opened',
    openedByListenerId: listenerId,
    openedByListenerName: listenerName,
    openedAt: `Today at ${nowFormatted}`,
    listenerAttentionStatus: 'reading',
    listenerAttentionTimestamp: Date.now(),
  };

  all[index] = updatedDisc;
  saveStoredDiscussions(all);

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
    disc.messages = [...disc.messages, messageWithMs];
    if (genderPreference && (!disc.genderPreference || disc.genderPreference === 'any')) {
      disc.genderPreference = genderPreference;
    }
    saveStoredDiscussions(all);
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
    saveStoredDiscussions(all);
  }
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
    saveStoredDiscussions(all);
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
  const nowFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
  saveStoredDiscussions(all);

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
  const nowFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
  saveStoredDiscussions(all);

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
    if (!isExcluded) {
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
    if (!isExcluded) {
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
