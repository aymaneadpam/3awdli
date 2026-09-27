import {
  LoungeChatMessage,
  LoungeRoomParticipant,
  LoungeRoomData,
  LoungeColorOption,
  UserAccount,
} from '../types';
import { userLeaveLoungeRoom } from './loungeQueueManagement';
import { formatSiteTime } from './timezoneManagement';

const LOUNGE_ROOM_STORAGE_PREFIX = '3awdli_lounge_room_';

/**
 * 10 distinct, calm, sophisticated colors for participants.
 * Each color is clearly distinguished, accessible, and fits the 3awdli aesthetic.
 * Host gold is strictly excluded from this list and reserved exclusively for the Host.
 */
export const LOUNGE_PARTICIPANT_COLORS: LoungeColorOption[] = [
  {
    id: 'terracotta',
    name: 'Terracotta',
    hex: '#C2410C',
    bgClass: 'bg-[#C2410C]',
    borderClass: 'border-[#9A3412]',
    textClass: 'text-white',
  },
  {
    id: 'emerald',
    name: 'Forest Emerald',
    hex: '#047857',
    bgClass: 'bg-[#047857]',
    borderClass: 'border-[#065F46]',
    textClass: 'text-white',
  },
  {
    id: 'teal',
    name: 'Ocean Teal',
    hex: '#0E7490',
    bgClass: 'bg-[#0E7490]',
    borderClass: 'border-[#155E75]',
    textClass: 'text-white',
  },
  {
    id: 'indigo',
    name: 'Royal Indigo',
    hex: '#4338CA',
    bgClass: 'bg-[#4338CA]',
    borderClass: 'border-[#3730A3]',
    textClass: 'text-white',
  },
  {
    id: 'mulberry',
    name: 'Mulberry Plum',
    hex: '#7E22CE',
    bgClass: 'bg-[#7E22CE]',
    borderClass: 'border-[#6B21A8]',
    textClass: 'text-white',
  },
  {
    id: 'rose',
    name: 'Berry Rose',
    hex: '#BE123C',
    bgClass: 'bg-[#BE123C]',
    borderClass: 'border-[#9F1239]',
    textClass: 'text-white',
  },
  {
    id: 'sapphire',
    name: 'Cobalt Sapphire',
    hex: '#1D4ED8',
    bgClass: 'bg-[#1D4ED8]',
    borderClass: 'border-[#1E40AF]',
    textClass: 'text-white',
  },
  {
    id: 'olive',
    name: 'Moss Olive',
    hex: '#4D7C0F',
    bgClass: 'bg-[#4D7C0F]',
    borderClass: 'border-[#3F6212]',
    textClass: 'text-white',
  },
  {
    id: 'cocoa',
    name: 'Warm Cocoa',
    hex: '#78350F',
    bgClass: 'bg-[#78350F]',
    borderClass: 'border-[#5F2B0C]',
    textClass: 'text-white',
  },
  {
    id: 'slate',
    name: 'Graphite Slate',
    hex: '#334155',
    bgClass: 'bg-[#334155]',
    borderClass: 'border-[#1E293B]',
    textClass: 'text-white',
  },
];

/**
 * Facilitator Exclusive Gold Color
 * Always used for Expert Facilitator messages regardless of color selection.
 */
export const HOST_GOLD_COLOR: LoungeColorOption = {
  id: 'host-gold',
  name: 'Expert Facilitator Gold',
  hex: '#D97706',
  bgClass: 'bg-[#D97706]',
  borderClass: 'border-[#B45309]',
  textClass: 'text-white',
};

/**
 * Helper to find a color option by ID or hex
 */
export function getColorById(colorId: string): LoungeColorOption {
  if (colorId === 'host-gold' || colorId === HOST_GOLD_COLOR.hex) {
    return HOST_GOLD_COLOR;
  }
  return (
    LOUNGE_PARTICIPANT_COLORS.find(
      (c) => c.id === colorId || c.hex === colorId
    ) || LOUNGE_PARTICIPANT_COLORS[0]
  );
}

/**
 * Retrieve current lounge room data (participants, chosen colors, messages)
 */
export function getStoredLoungeRoomData(articleId: string): LoungeRoomData {
  const key = `${LOUNGE_ROOM_STORAGE_PREFIX}${articleId}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed: LoungeRoomData = JSON.parse(raw);
      if (!Array.isArray(parsed.participants)) parsed.participants = [];
      if (!Array.isArray(parsed.messages)) parsed.messages = [];
      if (!parsed.chosenColorIds || typeof parsed.chosenColorIds !== 'object') {
        parsed.chosenColorIds = {};
      }
      return parsed;
    }
  } catch (err) {
    console.error('Error reading lounge room data:', err);
  }

  // Initial fresh state with an initial welcome message from the circle host
  const fresh: LoungeRoomData = {
    articleId,
    participants: [],
    chosenColorIds: {},
    messages: [
      {
        id: `msg_welcome_${Date.now()}`,
        articleId,
        userId: 'host_welcome',
        userName: 'Expert Facilitator',
        isHost: true,
        colorHex: HOST_GOLD_COLOR.hex,
        colorName: HOST_GOLD_COLOR.name,
        text: 'Welcome to this live circle session! Glad to have you here. Please feel free to share your reflections and join the conversation.',
        timestamp: Date.now() - 60000,
        formattedTime: formatSiteTime(Date.now() - 60000),
      },
    ],
  };

  localStorage.setItem(key, JSON.stringify(fresh));
  return fresh;
}

/**
 * Save lounge room data and trigger sync events
 */
export function saveLoungeRoomData(articleId: string, data: LoungeRoomData): void {
  const key = `${LOUNGE_ROOM_STORAGE_PREFIX}${articleId}`;
  localStorage.setItem(key, JSON.stringify(data));
  window.dispatchEvent(
    new CustomEvent(`3awdli_lounge_room_updated_${articleId}`, {
      detail: data,
    })
  );
}

/**
 * Get available participant colors for a given lounge session.
 * RULE: Once a color is chosen by someone, remove it from the list so no one else can pick the same one for that session.
 * If currentUserId already chose a color, their current color can be optionally included or inspected.
 */
export function getAvailableColorsForSession(
  articleId: string,
  currentUserId?: string
): LoungeColorOption[] {
  const data = getStoredLoungeRoomData(articleId);
  const chosenColorIds = new Set<string>();

  // Collect color IDs currently assigned to active participants or recorded in chosenColorIds
  Object.entries(data.chosenColorIds).forEach(([userId, colorId]) => {
    // If the current user has already picked this color, allow them to keep it
    if (userId !== currentUserId) {
      chosenColorIds.add(colorId);
    }
  });

  data.participants.forEach((p) => {
    if (p.userId !== currentUserId && !p.isHost) {
      const option = LOUNGE_PARTICIPANT_COLORS.find((c) => c.hex === p.colorHex);
      if (option) {
        chosenColorIds.add(option.id);
      }
    }
  });

  // Filter out any chosen colors
  return LOUNGE_PARTICIPANT_COLORS.filter((color) => !chosenColorIds.has(color.id));
}

/**
 * Assign a color and add/update participant in the lounge chat room.
 * - If user is Host, they are assigned HOST_GOLD_COLOR directly (Host doesn't pick).
 * - If user is participant, chosen color is validated and reserved.
 */
export function joinLoungeRoom(
  articleId: string,
  user: UserAccount,
  colorId: string,
  isHost: boolean
): { success: boolean; data: LoungeRoomData; error?: string } {
  const current = getStoredLoungeRoomData(articleId);

  let assignedColor: LoungeColorOption;

  if (isHost) {
    assignedColor = HOST_GOLD_COLOR;
  } else {
    // Validate that color is available
    const available = getAvailableColorsForSession(articleId, user.id);
    const chosen = available.find((c) => c.id === colorId);
    if (!chosen) {
      // If user had previously selected this color in this session, let them reuse it
      const previousColorId = current.chosenColorIds[user.id];
      if (previousColorId === colorId) {
        assignedColor = getColorById(colorId);
      } else {
        return {
          success: false,
          data: current,
          error: 'This color has already been chosen by another participant. Please pick an available color.',
        };
      }
    } else {
      assignedColor = chosen;
    }
  }

  // Update chosenColorIds
  const updatedChosenColorIds = {
    ...current.chosenColorIds,
    [user.id]: assignedColor.id,
  };

  // Add or update participant
  const existingParticipantIdx = current.participants.findIndex(
    (p) => p.userId === user.id
  );

  const participantRecord: LoungeRoomParticipant = {
    userId: user.id,
    userName: user.name || 'Member',
    userAvatar: user.avatarUrl,
    isHost,
    colorHex: assignedColor.hex,
    colorName: assignedColor.name,
    joinedAtTimestamp: Date.now(),
  };

  let updatedParticipants = [...current.participants];
  if (existingParticipantIdx !== -1) {
    updatedParticipants[existingParticipantIdx] = participantRecord;
  } else {
    updatedParticipants.push(participantRecord);
  }

  const updated: LoungeRoomData = {
    ...current,
    chosenColorIds: updatedChosenColorIds,
    participants: updatedParticipants,
  };

  saveLoungeRoomData(articleId, updated);

  return {
    success: true,
    data: updated,
  };
}

/**
 * Leave the lounge chat room:
 * - Removes user from active room participants
 * - Decrements room capacity count
 */
export function leaveLoungeRoom(
  articleId: string,
  userId: string
): LoungeRoomData {
  const current = getStoredLoungeRoomData(articleId);

  const updatedParticipants = current.participants.filter(
    (p) => p.userId !== userId
  );

  const updated: LoungeRoomData = {
    ...current,
    participants: updatedParticipants,
  };

  saveLoungeRoomData(articleId, updated);

  // Also decrement participant count in lounge queue state
  userLeaveLoungeRoom(articleId, userId);

  return updated;
}

/**
 * Send a chat message into the shared live room
 */
export function sendLoungeChatMessage(
  articleId: string,
  user: UserAccount,
  isHost: boolean,
  text: string
): LoungeChatMessage {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Message cannot be empty');
  }

  const roomData = getStoredLoungeRoomData(articleId);

  // Determine user's color
  let colorHex: string;
  let colorName: string;

  if (isHost) {
    colorHex = HOST_GOLD_COLOR.hex;
    colorName = HOST_GOLD_COLOR.name;
  } else {
    const userParticipant = roomData.participants.find((p) => p.userId === user.id);
    if (userParticipant) {
      colorHex = userParticipant.colorHex;
      colorName = userParticipant.colorName;
    } else {
      const colorId = roomData.chosenColorIds[user.id];
      const colorOption = colorId ? getColorById(colorId) : LOUNGE_PARTICIPANT_COLORS[0];
      colorHex = colorOption.hex;
      colorName = colorOption.name;
    }
  }

  const now = Date.now();
  const newMessage: LoungeChatMessage = {
    id: `msg_${now}_${Math.random().toString(36).substring(2, 7)}`,
    articleId,
    userId: user.id,
    userName: user.name || (isHost ? 'Host' : 'Member'),
    userAvatar: user.avatarUrl,
    isHost,
    colorHex,
    colorName,
    text: trimmed,
    timestamp: now,
    formattedTime: formatSiteTime(now),
  };

  const updated: LoungeRoomData = {
    ...roomData,
    messages: [...roomData.messages, newMessage],
  };

  saveLoungeRoomData(articleId, updated);
  return newMessage;
}
