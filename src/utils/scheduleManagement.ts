import { ChatScheduleWindow, ScheduleWindowType } from '../types';
import { 
  fetchChatSchedulesFromFirestore, 
  saveChatScheduleToFirestore, 
  deleteChatScheduleFromFirestore, 
  subscribeToChatSchedules 
} from '../lib/firestoreService';
import { useState, useEffect, useCallback } from 'react';
import { 
  getSiteTimezone, 
  getSiteTimeParts, 
  formatSiteDate, 
  formatSiteTime,
  SiteTimezoneConfig 
} from './timezoneManagement';

export const SCHEDULES_STORAGE_KEY = '3awdli_chat_schedules';

// In-memory cache
let inMemorySchedules: ChatScheduleWindow[] | null = null;
let isSchedulesSyncInitialized = false;

export function getStoredSchedules(): ChatScheduleWindow[] {
  if (inMemorySchedules !== null) {
    return inMemorySchedules;
  }

  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = localStorage.getItem(SCHEDULES_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        inMemorySchedules = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error reading chat schedules from localStorage:', err);
  }

  inMemorySchedules = [];
  return [];
}

export function saveStoredSchedules(schedules: ChatScheduleWindow[]) {
  inMemorySchedules = schedules;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(schedules));
      window.dispatchEvent(new CustomEvent('3awdli_schedules_updated', { detail: { schedules } }));
    } catch (err) {
      console.warn('Error saving chat schedules to localStorage:', err);
    }
  }
}

// Real-time Firestore sync
export function initFirestoreSchedulesSync(): () => void {
  if (isSchedulesSyncInitialized) {
    return () => {};
  }
  isSchedulesSyncInitialized = true;

  const unsubscribe = subscribeToChatSchedules(
    (firestoreSchedules) => {
      // Authoritative remote state: if Firestore has 0 schedules (e.g. admin deleted them all),
      // we strictly keep the list empty. Absolutely NO default data or fallback regeneration.
      const list = Array.isArray(firestoreSchedules) ? firestoreSchedules : [];
      saveStoredSchedules(list);
    },
    (err) => {
      console.warn('Chat schedules sync warning:', err);
    }
  );

  return unsubscribe;
}

export async function saveSchedule(
  data: Omit<ChatScheduleWindow, 'id'>, 
  existingId?: string,
  authorName?: string,
  authorId?: string
): Promise<ChatScheduleWindow> {
  const current = getStoredSchedules();
  const id = existingId || `sched_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const nowStr = new Date().toISOString();
  const nowTs = Date.now();

  const newWindow: ChatScheduleWindow = {
    ...data,
    id,
    createdAt: data.createdAt || nowStr,
    createdAtTimestamp: data.createdAtTimestamp || nowTs,
    createdBy: authorId || data.createdBy,
    createdByName: authorName || data.createdByName,
    updatedAt: nowStr,
    updatedAtTimestamp: nowTs,
  };

  const updated = existingId
    ? current.map((s) => (s.id === existingId ? newWindow : s))
    : [newWindow, ...current];

  saveStoredSchedules(updated);

  try {
    await saveChatScheduleToFirestore(newWindow);
  } catch (err) {
    console.error('Failed to save schedule to Firestore:', err);
  }

  return newWindow;
}

export async function deleteSchedule(id: string): Promise<boolean> {
  const current = getStoredSchedules();
  const updated = current.filter((s) => s.id !== id);
  saveStoredSchedules(updated);

  try {
    await deleteChatScheduleFromFirestore(id);
    return true;
  } catch (err) {
    console.error('Failed to delete schedule from Firestore:', err);
    return false;
  }
}

export async function deleteAllSchedules(): Promise<boolean> {
  const current = getStoredSchedules();
  saveStoredSchedules([]);

  try {
    const deletePromises = current.map((s) => deleteChatScheduleFromFirestore(s.id));
    const remote = await fetchChatSchedulesFromFirestore().catch(() => []);
    for (const rem of remote) {
      if (!current.some((c) => c.id === rem.id)) {
        deletePromises.push(deleteChatScheduleFromFirestore(rem.id));
      }
    }
    await Promise.all(deletePromises);
    return true;
  } catch (err) {
    console.error('Failed to delete all schedules from Firestore:', err);
    return false;
  }
}

export async function toggleScheduleActive(id: string, isActive: boolean): Promise<boolean> {
  const current = getStoredSchedules();
  const target = current.find((s) => s.id === id);
  if (!target) return false;

  const updatedWindow: ChatScheduleWindow = {
    ...target,
    isActive,
    updatedAt: new Date().toISOString(),
    updatedAtTimestamp: Date.now()
  };

  const updatedList = current.map((s) => (s.id === id ? updatedWindow : s));
  saveStoredSchedules(updatedList);

  try {
    await saveChatScheduleToFirestore(updatedWindow);
    return true;
  } catch (err) {
    console.error('Failed to update schedule status in Firestore:', err);
    return false;
  }
}

// -------------------------------------------------------------
// REAL-TIME AVAILABILITY CALCULATOR (TIMEZONE AWARE - DEFAULT GMT+0)
// -------------------------------------------------------------

export interface NextWindowInfo {
  window: ChatScheduleWindow;
  dateStr: string; // YYYY-MM-DD
  dayOfWeek: number;
  startDateTime: Date;
  endDateTime: Date;
  formattedDate: string;
  formattedTimeRange: string;
  relativeLabel?: string; // e.g. "Today", "Tomorrow", "Wednesday"
  timezone?: SiteTimezoneConfig;
}

export interface ChatAvailabilityResult {
  isOpen: boolean;
  currentWindow?: ChatScheduleWindow;
  nextWindow?: NextWindowInfo;
  timezone: SiteTimezoneConfig;
  currentSiteTime: string;
  currentSiteDate: string;
}

function getMinutesFromTimeString(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  return h * 60 + m;
}

export function formatLocalDateString(d: Date, customTimezone?: SiteTimezoneConfig): string {
  return formatSiteDate(d, customTimezone);
}

export function isChatCurrentlyOpen(
  schedules?: ChatScheduleWindow[],
  checkDate?: Date,
  customTimezone?: SiteTimezoneConfig
): ChatAvailabilityResult {
  const tz = customTimezone || getSiteTimezone();
  const list = (schedules || getStoredSchedules()).filter((s) => s.isActive !== false);
  const baseMs = checkDate ? checkDate.getTime() : Date.now();
  const siteNow = getSiteTimeParts(baseMs, tz);
  const todayStr = siteNow.dateStr;
  const currentDayOfWeek = siteNow.dayOfWeek; // 0=Sunday, 1=Monday...
  const currentMinutes = siteNow.totalMinutes;

  // 1. Check if ANY schedule window is currently active right now in the site's active timezone (default GMT+0)
  let activeWindow: ChatScheduleWindow | undefined = undefined;

  for (const window of list) {
    let dayMatches = false;

    if (window.type === 'specific_date') {
      if (window.date === todayStr) {
        dayMatches = true;
      } else if (Array.isArray(window.dates) && window.dates.includes(todayStr)) {
        dayMatches = true;
      }
    } else if (window.type === 'weekly_recurring') {
      if (Array.isArray(window.daysOfWeek) && window.daysOfWeek.includes(currentDayOfWeek)) {
        dayMatches = true;
      } else if (window.dayOfWeek === currentDayOfWeek) {
        dayMatches = true;
      }
    }

    if (dayMatches) {
      const startMin = getMinutesFromTimeString(window.startTime);
      const endMin = getMinutesFromTimeString(window.endTime);

      if (startMin <= endMin) {
        // Standard window within same day (e.g. 18:00 - 20:00)
        if (currentMinutes >= startMin && currentMinutes < endMin) {
          activeWindow = window;
          break;
        }
      } else {
        // Overnight window (e.g. 22:00 - 02:00)
        if (currentMinutes >= startMin || currentMinutes < endMin) {
          activeWindow = window;
          break;
        }
      }
    }
  }

  if (activeWindow) {
    return {
      isOpen: true,
      currentWindow: activeWindow,
      timezone: tz,
      currentSiteTime: siteNow.timeStr,
      currentSiteDate: siteNow.dateStr,
    };
  }

  // 2. Chat is closed. Find the earliest NEXT upcoming window across the next 14 days in the site timezone
  let earliestNext: NextWindowInfo | null = null;

  for (let dayOffset = 0; dayOffset <= 14; dayOffset++) {
    const futureMs = baseMs + dayOffset * 24 * 60 * 60 * 1000;
    const candidateParts = getSiteTimeParts(futureMs, tz);
    const candidateDateStr = candidateParts.dateStr;
    const candidateDayOfWeek = candidateParts.dayOfWeek;

    for (const window of list) {
      let appliesToDay = false;

      if (window.type === 'specific_date') {
        if (window.date === candidateDateStr) {
          appliesToDay = true;
        } else if (Array.isArray(window.dates) && window.dates.includes(candidateDateStr)) {
          appliesToDay = true;
        }
      } else if (window.type === 'weekly_recurring') {
        if (Array.isArray(window.daysOfWeek) && window.daysOfWeek.includes(candidateDayOfWeek)) {
          appliesToDay = true;
        } else if (window.dayOfWeek === candidateDayOfWeek) {
          appliesToDay = true;
        }
      }

      if (!appliesToDay) continue;

      const [startH, startM] = window.startTime.split(':').map((v) => parseInt(v, 10));
      const [endH, endM] = window.endTime.split(':').map((v) => parseInt(v, 10));
      const startMin = (startH || 0) * 60 + (startM || 0);

      // If it's today (dayOffset === 0), verify the window hasn't already passed
      if (dayOffset === 0) {
        const endMin = (endH || 0) * 60 + (endM || 0);
        if (startMin <= endMin) {
          if (currentMinutes >= endMin) continue; // Already ended today
        } else {
          // Overnight
          if (currentMinutes >= endMin && currentMinutes < startMin) continue;
        }
      }

      // If it has already started today, skip
      if (dayOffset === 0 && currentMinutes >= startMin) {
        continue;
      }

      const startDateTime = new Date(baseMs + (dayOffset * 24 * 60 + startMin - currentMinutes) * 60 * 1000);
      const endDateTime = new Date(baseMs + (dayOffset * 24 * 60 + ((endH || 0) * 60 + (endM || 0)) - currentMinutes) * 60 * 1000);

      if (!earliestNext || startDateTime.getTime() < earliestNext.startDateTime.getTime()) {
        let relLabel = '';
        if (dayOffset === 0) {
          relLabel = 'Today';
        } else if (dayOffset === 1) {
          relLabel = 'Tomorrow';
        } else {
          relLabel = WEEKDAYS_MAP[candidateDayOfWeek]?.en || 'Upcoming';
        }

        earliestNext = {
          window,
          dateStr: candidateDateStr,
          dayOfWeek: candidateDayOfWeek,
          startDateTime,
          endDateTime,
          formattedDate: candidateDateStr,
          formattedTimeRange: `${window.startTime} – ${window.endTime}`,
          relativeLabel: relLabel,
          timezone: tz,
        };
      }
    }

    // Stop searching once we've found a candidate on an upcoming day
    if (earliestNext && dayOffset > 1) {
      break;
    }
  }

  return {
    isOpen: false,
    nextWindow: earliestNext || undefined,
    timezone: tz,
    currentSiteTime: siteNow.timeStr,
    currentSiteDate: siteNow.dateStr,
  };
}

// -------------------------------------------------------------
// REACT HOOK FOR REACTIVE SCHEDULE STATE
// -------------------------------------------------------------

export function useChatSchedule() {
  const [schedules, setSchedules] = useState<ChatScheduleWindow[]>(() => getStoredSchedules());
  const [status, setStatus] = useState<ChatAvailabilityResult>(() => isChatCurrentlyOpen());

  const refresh = useCallback(() => {
    const list = getStoredSchedules();
    setSchedules(list);
    setStatus(isChatCurrentlyOpen(list));
  }, []);

  useEffect(() => {
    refresh();

    // Re-evaluate every 15 seconds to catch transitions into/out of open windows
    const interval = setInterval(refresh, 15000);

    const handleUpdate = () => refresh();
    window.addEventListener('3awdli_schedules_updated', handleUpdate);
    window.addEventListener('3awdli_timezone_changed', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('3awdli_schedules_updated', handleUpdate);
      window.removeEventListener('3awdli_timezone_changed', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [refresh]);

  return {
    schedules,
    isOpen: status.isOpen,
    currentWindow: status.currentWindow,
    nextWindow: status.nextWindow,
    timezone: status.timezone,
    currentSiteTime: status.currentSiteTime,
    currentSiteDate: status.currentSiteDate,
    refresh,
  };
}

// -------------------------------------------------------------
// LOCALIZATION HELPERS
// -------------------------------------------------------------

export const WEEKDAYS_MAP: Record<number, { en: string; fr: string; ar: string; shortEn: string; shortFr: string; shortAr: string }> = {
  0: { en: 'Sunday', fr: 'Dimanche', ar: 'الأحد', shortEn: 'Sun', shortFr: 'Dim', shortAr: 'أحد' },
  1: { en: 'Monday', fr: 'Lundi', ar: 'الاثنين', shortEn: 'Mon', shortFr: 'Lun', shortAr: 'إثنين' },
  2: { en: 'Tuesday', fr: 'Mardi', ar: 'الثلاثاء', shortEn: 'Tue', shortFr: 'Mar', shortAr: 'ثلاثاء' },
  3: { en: 'Wednesday', fr: 'Mercredi', ar: 'الأربعاء', shortEn: 'Wed', shortFr: 'Mer', shortAr: 'أربعاء' },
  4: { en: 'Thursday', fr: 'Jeudi', ar: 'الخميس', shortEn: 'Thu', shortFr: 'Jeu', shortAr: 'خميس' },
  5: { en: 'Friday', fr: 'Vendredi', ar: 'الجمعة', shortEn: 'Fri', shortFr: 'Ven', shortAr: 'جمعة' },
  6: { en: 'Saturday', fr: 'Samedi', ar: 'السبت', shortEn: 'Sat', shortFr: 'Sam', shortAr: 'سبت' },
};

export function getWeekdayName(dayIndex: number, lang: 'en' | 'fr' | 'ar' = 'en', short = false): string {
  const item = WEEKDAYS_MAP[dayIndex];
  if (!item) return '';
  if (short) {
    if (lang === 'fr') return item.shortFr;
    if (lang === 'ar') return item.shortAr;
    return item.shortEn;
  }
  if (lang === 'fr') return item.fr;
  if (lang === 'ar') return item.ar;
  return item.en;
}

export function formatDaysList(days: number[], lang: 'en' | 'fr' | 'ar' = 'en'): string {
  if (!days || days.length === 0) return '';
  const sorted = [...days].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
  return sorted.map((d) => getWeekdayName(d, lang)).join(', ');
}

export function formatFriendlyNextOpening(next: NextWindowInfo | undefined, lang: 'en' | 'fr' | 'ar' = 'en'): string {
  if (!next) {
    if (lang === 'fr') return 'Bientôt disponible';
    if (lang === 'ar') return 'قريباً إن شاء الله';
    return 'Coming soon';
  }

  const tzSuffix = next.timezone?.shortLabel ? ` (${next.timezone.shortLabel})` : '';
  const timeRange = `${next.window.startTime} – ${next.window.endTime}${tzSuffix}`;
  const dayName = getWeekdayName(next.dayOfWeek, lang);

  const siteNow = getSiteTimeParts();
  const todayStr = siteNow.dateStr;
  const tomorrowParts = getSiteTimeParts(Date.now() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrowParts.dateStr;

  if (next.dateStr === todayStr) {
    if (lang === 'fr') return `Aujourd'hui de ${timeRange}`;
    if (lang === 'ar') return `اليوم من ${timeRange}`;
    return `Today from ${timeRange}`;
  }

  if (next.dateStr === tomorrowStr) {
    if (lang === 'fr') return `Demain (${dayName}) de ${timeRange}`;
    if (lang === 'ar') return `غداً (${dayName}) من ${timeRange}`;
    return `Tomorrow (${dayName}) from ${timeRange}`;
  }

  // Format date
  if (lang === 'fr') {
    return `${dayName} ${next.dateStr} de ${timeRange}`;
  }
  if (lang === 'ar') {
    return `${dayName} ${next.dateStr} من ${timeRange}`;
  }
  return `${dayName} (${next.dateStr}) from ${timeRange}`;
}
