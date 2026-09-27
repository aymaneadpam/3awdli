import { LoungeArticle, UserAccount } from '../types';
import { formatSiteDateReadable, formatSiteTime } from './timezoneManagement';
import { 
  fetchLoungeArticlesFromFirestore, 
  saveLoungeArticleToFirestore, 
  deleteLoungeArticleFromFirestore, 
  subscribeToLoungeArticles 
} from '../lib/firestoreService';

const LOUNGE_ARTICLES_STORAGE_KEY = '3awdli_lounge_articles';

/**
 * Generate default seed articles written by the Founder.
 * Designed to provide immediate test coverage:
 * 1. Live Countdown: Scheduled today in ~2 hours.
 * 2. Lounge Open Now: Scheduled earlier today (ready to join).
 * 3. Scheduled Date: Scheduled for tomorrow evening.
 */
function createDefaultArticles(): LoungeArticle[] {
  const now = Date.now();
  const twoHoursFromNow = now + 2 * 60 * 60 * 1000 + 14 * 60 * 1000; // ~2h 14m from now
  const thirtyMinsAgo = now - 35 * 60 * 1000; // Open now
  const tomorrowEvening = now + 26 * 60 * 60 * 1000; // Tomorrow

  return [
    {
      id: 'lounge_art_01',
      title: 'The Architecture of Vulnerability: Why Speaking Up Takes Immense Courage',
      content: `In a world that celebrates relentless resilience, we rarely talk about the sheer physical and emotional weight of admitting that we are tired.

When we experience sadness, anxiety, or burnout, the initial instinct is almost universally to withdraw. We convince ourselves that our struggles are a burden, that others have it worse, or that silence is safer than exposure.

Yet in psychological practice, we observe something profound: healing begins not when we find all the answers, but the exact second we allow ourselves to be heard without having to perform strength.

When you join our scheduled circle in The Lounge, the expectation is simple. You do not need to have your thoughts organized. You do not need to arrive with an optimistic resolution. You are invited simply to sit with fellow travelers who understand the unspoken textures of hardship.

Take a deep breath. Look around. You are not alone on this journey.`,
      scheduledOpening: new Date(twoHoursFromNow).toISOString(),
      scheduledOpeningTimestamp: twoHoursFromNow,
      authorId: 'user_admin_01',
      authorName: 'Aymane Oumlala',
      authorEmail: 'aymaneoumlala@gmail.com',
      createdAt: 'Today',
      createdAtTimestamp: now - 3 * 60 * 60 * 1000,
    },
    {
      id: 'lounge_art_02',
      title: 'Silent Companionship: Being Present When Words Aren’t Enough',
      content: `Most people listen with the intent to reply, advise, or fix. But when someone’s spirit is aching, advice often feels like another demand placed on an already exhausted mind.

Silent companionship is the practice of holding space. It is the steady, reassuring presence that says: "I see that you are hurting. I will not rush you out of this feeling. I am right here beside you until you are ready."

In this live session, our virtual lounge doors are now open. Whether you wish to speak or simply remain quiet in a safe, non-judgmental atmosphere, our community welcomes you exactly as you are.`,
      scheduledOpening: new Date(thirtyMinsAgo).toISOString(),
      scheduledOpeningTimestamp: thirtyMinsAgo,
      authorId: 'user_admin_01',
      authorName: 'Aymane Oumlala',
      authorEmail: 'aymaneoumlala@gmail.com',
      createdAt: 'Today',
      createdAtTimestamp: now - 5 * 60 * 60 * 1000,
    },
    {
      id: 'lounge_art_03',
      title: 'Unwinding the Evening Spiral: Navigating Rumination & Mental Fatigue',
      content: `Have you ever noticed how worries swell in magnitude the moment you lay your head down on the pillow?

The day’s distractions fade, the room grows quiet, and the mind attempts to solve tomorrow’s problems with today’s depleted energy reserves. Psychologists refer to this as the 'nocturnal rumination trap'.

To break the spiral, we need deliberate deceleration rituals. In tomorrow’s live session, we will explore the neurobiology of evening anxiety and practice gentle mental release techniques.

Read this article whenever your mind feels crowded, and join us when the countdown concludes tomorrow evening.`,
      scheduledOpening: new Date(tomorrowEvening).toISOString(),
      scheduledOpeningTimestamp: tomorrowEvening,
      durationMinutes: 120,
      authorId: 'user_admin_01',
      authorName: 'Aymane Oumlala',
      authorEmail: 'aymaneoumlala@gmail.com',
      createdAt: 'Yesterday',
      createdAtTimestamp: now - 24 * 60 * 60 * 1000,
    },
    {
      id: 'lounge_art_04',
      title: 'The Courage to Rest: Recovering From Emotional Burnout',
      content: `Rest is not a reward we earn after finishing every task on an infinite to-do list; rest is a fundamental biological and emotional prerequisite for being human.

When burnout takes hold, even simple daily decisions feel insurmountable. In our previous lounge circle, we explored the courage to slow down, disconnect from constant urgency, and honor emotional fatigue without self-reproach.

While this live circle has concluded, the reflections remain here for anyone needing quiet solace and validation.`,
      scheduledOpening: new Date(now - 48 * 60 * 60 * 1000).toISOString(),
      scheduledOpeningTimestamp: now - 48 * 60 * 60 * 1000,
      durationMinutes: 120,
      authorId: 'user_admin_01',
      authorName: 'Aymane Oumlala',
      authorEmail: 'aymaneoumlala@gmail.com',
      createdAt: '3 days ago',
      createdAtTimestamp: now - 52 * 60 * 60 * 1000,
    },
  ];
}

/**
 * Retrieve all lounge articles from storage (or seed defaults)
 */
export function getStoredLoungeArticles(): LoungeArticle[] {
  try {
    const raw = localStorage.getItem(LOUNGE_ARTICLES_STORAGE_KEY);
    if (!raw) {
      const initial = createDefaultArticles();
      localStorage.setItem(LOUNGE_ARTICLES_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const list: LoungeArticle[] = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) {
      const initial = createDefaultArticles();
      localStorage.setItem(LOUNGE_ARTICLES_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return list;
  } catch (err) {
    console.error('Error reading stored lounge articles:', err);
    return createDefaultArticles();
  }
}

/**
 * Get a single article by ID
 */
export function getLoungeArticleById(id: string): LoungeArticle | undefined {
  const articles = getStoredLoungeArticles();
  return articles.find((a) => a.id === id);
}

/**
 * Create a new article (Founder side)
 */
export async function createLoungeArticle(
  data: {
    title: string;
    content: string;
    scheduledOpening: string;
    scheduledOpeningTimestamp: number;
  },
  author: UserAccount
): Promise<LoungeArticle> {
  const now = Date.now();
  const newArticle: LoungeArticle = {
    id: `lounge_art_${now}_${Math.random().toString(36).substring(2, 7)}`,
    title: data.title.trim(),
    content: data.content.trim(),
    scheduledOpening: data.scheduledOpening,
    scheduledOpeningTimestamp: data.scheduledOpeningTimestamp,
    authorId: author.id,
    authorName: author.name || 'Administrator',
    authorEmail: author.email,
    createdAt: formatSiteDateReadable(now),
    createdAtTimestamp: now,
  };

  const current = getStoredLoungeArticles();
  const updated = [newArticle, ...current];
  localStorage.setItem(LOUNGE_ARTICLES_STORAGE_KEY, JSON.stringify(updated));

  // Save to Firestore
  try {
    await saveLoungeArticleToFirestore(newArticle);
  } catch (err) {
    console.warn('Could not save lounge article to Firestore immediately, cached locally:', err);
  }

  // Dispatch local event
  window.dispatchEvent(new CustomEvent('3awdli_lounge_articles_updated'));
  return newArticle;
}

/**
 * Update an existing article
 */
export async function updateLoungeArticle(
  id: string,
  updates: Partial<LoungeArticle>
): Promise<LoungeArticle | null> {
  const current = getStoredLoungeArticles();
  const index = current.findIndex((a) => a.id === id);
  if (index === -1) return null;

  const updatedItem: LoungeArticle = {
    ...current[index],
    ...updates,
    updatedAt: formatSiteDateReadable(Date.now()),
    updatedAtTimestamp: Date.now(),
  };

  current[index] = updatedItem;
  localStorage.setItem(LOUNGE_ARTICLES_STORAGE_KEY, JSON.stringify(current));

  try {
    await saveLoungeArticleToFirestore(updatedItem);
  } catch (err) {
    console.warn('Firestore update error for article:', err);
  }

  window.dispatchEvent(new CustomEvent('3awdli_lounge_articles_updated'));
  return updatedItem;
}

/**
 * Hide an article (Founder delete action).
 * Instead of permanently erasing the record, it moves to the Hidden Articles section
 * and disappears completely from what normal users see in the public Lobby list.
 */
export async function hideLoungeArticle(
  id: string,
  hiddenByUserId?: string
): Promise<boolean> {
  const current = getStoredLoungeArticles();
  const index = current.findIndex((a) => a.id === id);
  if (index === -1) return false;

  const now = Date.now();
  const hiddenArticle: LoungeArticle = {
    ...current[index],
    is_hidden: true,
    hiddenAt: formatSiteDateReadable(now),
    hiddenAtTimestamp: now,
    hiddenBy: hiddenByUserId,
  };

  current[index] = hiddenArticle;
  localStorage.setItem(LOUNGE_ARTICLES_STORAGE_KEY, JSON.stringify(current));

  try {
    await saveLoungeArticleToFirestore(hiddenArticle);
  } catch (err) {
    console.warn('Firestore update error for hidden article:', err);
  }

  window.dispatchEvent(new CustomEvent('3awdli_lounge_articles_updated'));
  return true;
}

/**
 * Re-publish a hidden article back to the public Lobby list.
 * Sets is_hidden to false so it immediately behaves exactly like a normal article again
 * (reorderable by date, eligible to open countdown or live session, etc.)
 */
export async function republishLoungeArticle(id: string): Promise<LoungeArticle | null> {
  const current = getStoredLoungeArticles();
  const index = current.findIndex((a) => a.id === id);
  if (index === -1) return null;

  const now = Date.now();
  const republishedArticle: LoungeArticle = {
    ...current[index],
    is_hidden: false,
    hiddenAt: undefined,
    hiddenAtTimestamp: undefined,
    hiddenBy: undefined,
    updatedAt: formatSiteDateReadable(now),
    updatedAtTimestamp: now,
  };

  current[index] = republishedArticle;
  localStorage.setItem(LOUNGE_ARTICLES_STORAGE_KEY, JSON.stringify(current));

  try {
    await saveLoungeArticleToFirestore(republishedArticle);
  } catch (err) {
    console.warn('Firestore republish error for article:', err);
  }

  window.dispatchEvent(new CustomEvent('3awdli_lounge_articles_updated'));
  return republishedArticle;
}

/**
 * Delete an article (aliased to hideLoungeArticle for safe preservation in Hidden Articles)
 */
export async function deleteLoungeArticle(
  id: string,
  hiddenByUserId?: string
): Promise<boolean> {
  return hideLoungeArticle(id, hiddenByUserId);
}

/**
 * Filter helpers for Public Lobby vs Hidden Articles
 */
export function getPublicLoungeArticles(articles: LoungeArticle[]): LoungeArticle[] {
  return articles.filter((a) => !a.is_hidden);
}

export function getHiddenLoungeArticles(articles: LoungeArticle[]): LoungeArticle[] {
  return articles.filter((a) => Boolean(a.is_hidden));
}

/**
 * Initialize Firestore real-time synchronization for Lounge Articles
 */
export function initFirestoreLoungeArticlesSync(): () => void {
  fetchLoungeArticlesFromFirestore().then((serverArticles) => {
    if (serverArticles && serverArticles.length > 0) {
      const local = getStoredLoungeArticles();
      // Merge unique articles
      const map = new Map<string, LoungeArticle>();
      local.forEach((a) => map.set(a.id, a));
      serverArticles.forEach((a) => map.set(a.id, a));
      const merged = Array.from(map.values());
      localStorage.setItem(LOUNGE_ARTICLES_STORAGE_KEY, JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent('3awdli_lounge_articles_updated'));
    }
  }).catch(() => {});

  return subscribeToLoungeArticles((serverArticles) => {
    if (serverArticles && serverArticles.length > 0) {
      localStorage.setItem(LOUNGE_ARTICLES_STORAGE_KEY, JSON.stringify(serverArticles));
      window.dispatchEvent(new CustomEvent('3awdli_lounge_articles_updated'));
    }
  });
}

/**
 * Format scheduled opening date & time nicely
 */
export function formatScheduledDateTime(timestamp: number): string {
  const d = new Date(timestamp);
  const now = new Date();
  
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate();

  const timeStr = formatSiteTime(d);

  if (isToday) {
    return `Today at ${timeStr}`;
  }
  if (isTomorrow) {
    return `Tomorrow at ${timeStr}`;
  }

  const dateStr = formatSiteDateReadable(d);
  return `${dateStr}, ${timeStr}`;
}

/**
 * Check whether the scheduled opening date is today or has already arrived
 */
export function isScheduledForTodayOrPast(targetTimestamp: number, currentTimestamp: number): boolean {
  if (targetTimestamp <= currentTimestamp) return true;
  
  const targetDate = new Date(targetTimestamp);
  const currentDate = new Date(currentTimestamp);

  return (
    targetDate.getFullYear() === currentDate.getFullYear() &&
    targetDate.getMonth() === currentDate.getMonth() &&
    targetDate.getDate() === currentDate.getDate()
  );
}

export type LoungeScheduleStatusType = 'open' | 'countdown' | 'scheduled' | 'past';

export interface LoungeScheduleStatus {
  status: LoungeScheduleStatusType;
  isOpen: boolean;
  isToday: boolean;
  isPast: boolean;
  countdownText: string;
  formattedSchedule: string;
  timeRemainingMs: number;
}

export const DEFAULT_LOUNGE_DURATION_MINUTES = 120; // 2 hours

/**
 * Calculate the live schedule status for a lounge session:
 * - 'open': When scheduled time has arrived and is within open window (or not manually closed)
 * - 'countdown': On the day the scheduled date/time arrives (or < 24h away)
 * - 'scheduled': Future date (> 24h away)
 * - 'past': Concluded / session ended
 */
export function getLoungeScheduleStatus(
  targetTimestamp: number,
  currentTimestamp: number = Date.now(),
  durationMinutes: number = DEFAULT_LOUNGE_DURATION_MINUTES,
  isClosed?: boolean
): LoungeScheduleStatus {
  const formattedSchedule = formatScheduledDateTime(targetTimestamp);
  const targetDate = new Date(targetTimestamp);
  const currentDate = new Date(currentTimestamp);

  const isToday =
    targetDate.getFullYear() === currentDate.getFullYear() &&
    targetDate.getMonth() === currentDate.getMonth() &&
    targetDate.getDate() === currentDate.getDate();

  const durationMs = (durationMinutes || DEFAULT_LOUNGE_DURATION_MINUTES) * 60 * 1000;
  const closingTimestamp = targetTimestamp + durationMs;

  // 1. Manually closed or duration window expired -> PAST
  if (isClosed || currentTimestamp >= closingTimestamp) {
    return {
      status: 'past',
      isOpen: false,
      isToday,
      isPast: true,
      countdownText: 'Session Concluded',
      formattedSchedule,
      timeRemainingMs: 0,
    };
  }

  // 2. Scheduled time has arrived and within open window -> OPEN
  if (currentTimestamp >= targetTimestamp && currentTimestamp < closingTimestamp) {
    return {
      status: 'open',
      isOpen: true,
      isToday,
      isPast: false,
      countdownText: 'Lounge is Open',
      formattedSchedule,
      timeRemainingMs: closingTimestamp - currentTimestamp,
    };
  }

  // 3. Upcoming session
  const diff = targetTimestamp - currentTimestamp;

  // If today or within 24 hours -> Countdown active
  if (isToday || diff <= 24 * 60 * 60 * 1000) {
    const totalSeconds = Math.max(0, Math.floor(diff / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n: number) => n.toString().padStart(2, '0');
    const countdownText = `Opens in: ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

    return {
      status: 'countdown',
      isOpen: false,
      isToday: true,
      isPast: false,
      countdownText,
      formattedSchedule,
      timeRemainingMs: diff,
    };
  }

  // 4. Future scheduled date (> 24 hours away)
  return {
    status: 'scheduled',
    isOpen: false,
    isToday: false,
    isPast: false,
    countdownText: `Scheduled: ${formattedSchedule}`,
    formattedSchedule,
    timeRemainingMs: diff,
  };
}

/**
 * Helper to check if an article's lounge session is currently open
 */
export function isLoungeArticleOpen(
  article: LoungeArticle,
  currentTimestamp: number = Date.now()
): boolean {
  return getLoungeScheduleStatus(
    article.scheduledOpeningTimestamp,
    currentTimestamp,
    article.durationMinutes,
    article.isClosed
  ).isOpen;
}

/**
 * Sort Lounge Articles according to rules:
 * 1. WHEN A LOUNGE IS CURRENTLY OPEN:
 *    That article moves to the VERY TOP of the list, above all others, regardless of original position.
 * 2. UPCOMING / FUTURE-SCHEDULED articles:
 *    Appear next, with the soonest scheduled article closest to the top.
 * 3. PAST / OLDER articles:
 *    Appear toward the bottom of the list.
 */
export function sortLoungeArticles(
  articles: LoungeArticle[],
  currentTimestamp: number = Date.now()
): LoungeArticle[] {
  return [...articles].sort((a, b) => {
    const statusA = getLoungeScheduleStatus(
      a.scheduledOpeningTimestamp,
      currentTimestamp,
      a.durationMinutes,
      a.isClosed
    );
    const statusB = getLoungeScheduleStatus(
      b.scheduledOpeningTimestamp,
      currentTimestamp,
      b.durationMinutes,
      b.isClosed
    );

    // Rank 0: Currently OPEN
    // Rank 1: UPCOMING
    // Rank 2: PAST / CONCLUDED
    const rankA = statusA.isOpen ? 0 : statusA.isPast ? 2 : 1;
    const rankB = statusB.isOpen ? 0 : statusB.isPast ? 2 : 1;

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    // Among currently OPEN articles: soonest scheduled first
    if (rankA === 0) {
      return a.scheduledOpeningTimestamp - b.scheduledOpeningTimestamp;
    }

    // Among UPCOMING articles: soonest one closest to top (ascending scheduled timestamp)
    if (rankA === 1) {
      return a.scheduledOpeningTimestamp - b.scheduledOpeningTimestamp;
    }

    // Among PAST articles: most recent past first (descending scheduled timestamp)
    return b.scheduledOpeningTimestamp - a.scheduledOpeningTimestamp;
  });
}
