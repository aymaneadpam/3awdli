import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface SiteTimezoneConfig {
  id: string;
  label: string;
  shortLabel: string;
  offsetMinutes: number;
  offsetHours: number;
  isDefault?: boolean;
}

export const TIMEZONE_STORAGE_KEY = '3awdli_site_timezone';
export const DEFAULT_SITE_TIMEZONE_ID = 'GMT+0';

export const AVAILABLE_TIMEZONES: SiteTimezoneConfig[] = [
  { id: 'GMT-12', shortLabel: 'GMT-12', label: 'GMT-12 (Baker Island / IDLW)', offsetMinutes: -720, offsetHours: -12 },
  { id: 'GMT-11', shortLabel: 'GMT-11', label: 'GMT-11 (Midway / Pago Pago / SST)', offsetMinutes: -660, offsetHours: -11 },
  { id: 'GMT-10', shortLabel: 'GMT-10', label: 'GMT-10 (Honolulu / Hawaii / HST)', offsetMinutes: -600, offsetHours: -10 },
  { id: 'GMT-9', shortLabel: 'GMT-9', label: 'GMT-9 (Anchorage / Alaska / AKST)', offsetMinutes: -540, offsetHours: -9 },
  { id: 'GMT-8', shortLabel: 'GMT-8', label: 'GMT-8 (Los Angeles / Vancouver / PST)', offsetMinutes: -480, offsetHours: -8 },
  { id: 'GMT-7', shortLabel: 'GMT-7', label: 'GMT-7 (Denver / Phoenix / MST)', offsetMinutes: -420, offsetHours: -7 },
  { id: 'GMT-6', shortLabel: 'GMT-6', label: 'GMT-6 (Chicago / Mexico City / CST)', offsetMinutes: -360, offsetHours: -6 },
  { id: 'GMT-5', shortLabel: 'GMT-5', label: 'GMT-5 (New York / Toronto / EST / Bogota)', offsetMinutes: -300, offsetHours: -5 },
  { id: 'GMT-4', shortLabel: 'GMT-4', label: 'GMT-4 (Santiago / Caracas / Halifax / AST)', offsetMinutes: -240, offsetHours: -4 },
  { id: 'GMT-3:30', shortLabel: 'GMT-3:30', label: "GMT-3:30 (St. John's / Newfoundland)", offsetMinutes: -210, offsetHours: -3.5 },
  { id: 'GMT-3', shortLabel: 'GMT-3', label: 'GMT-3 (Buenos Aires / São Paulo / ART)', offsetMinutes: -180, offsetHours: -3 },
  { id: 'GMT-2', shortLabel: 'GMT-2', label: 'GMT-2 (South Georgia / Mid-Atlantic)', offsetMinutes: -120, offsetHours: -2 },
  { id: 'GMT-1', shortLabel: 'GMT-1', label: 'GMT-1 (Azores / Cape Verde / CVT)', offsetMinutes: -60, offsetHours: -1 },
  { id: 'GMT+0', shortLabel: 'GMT+0', label: 'GMT+0 (UTC / Morocco Standard / London / WET) — Default', offsetMinutes: 0, offsetHours: 0, isDefault: true },
  { id: 'GMT+1', shortLabel: 'GMT+1', label: 'GMT+1 (Paris / Berlin / Rome / Lagos / CET / Morocco Summer)', offsetMinutes: 60, offsetHours: 1 },
  { id: 'GMT+2', shortLabel: 'GMT+2', label: 'GMT+2 (Cairo / Athens / Johannesburg / Beirut / EET)', offsetMinutes: 120, offsetHours: 2 },
  { id: 'GMT+3', shortLabel: 'GMT+3', label: 'GMT+3 (Riyadh / Doha / Kuwait / Nairobi / Moscow / MSK)', offsetMinutes: 180, offsetHours: 3 },
  { id: 'GMT+3:30', shortLabel: 'GMT+3:30', label: 'GMT+3:30 (Tehran / IRST)', offsetMinutes: 210, offsetHours: 3.5 },
  { id: 'GMT+4', shortLabel: 'GMT+4', label: 'GMT+4 (Dubai / Abu Dhabi / Baku / Muscat / GST)', offsetMinutes: 240, offsetHours: 4 },
  { id: 'GMT+4:30', shortLabel: 'GMT+4:30', label: 'GMT+4:30 (Kabul / AFT)', offsetMinutes: 270, offsetHours: 4.5 },
  { id: 'GMT+5', shortLabel: 'GMT+5', label: 'GMT+5 (Karachi / Tashkent / Islamabad / PKT)', offsetMinutes: 300, offsetHours: 5 },
  { id: 'GMT+5:30', shortLabel: 'GMT+5:30', label: 'GMT+5:30 (New Delhi / Mumbai / Kolkata / IST)', offsetMinutes: 330, offsetHours: 5.5 },
  { id: 'GMT+5:45', shortLabel: 'GMT+5:45', label: 'GMT+5:45 (Kathmandu / NPT)', offsetMinutes: 345, offsetHours: 5.75 },
  { id: 'GMT+6', shortLabel: 'GMT+6', label: 'GMT+6 (Dhaka / Almaty / BST)', offsetMinutes: 360, offsetHours: 6 },
  { id: 'GMT+6:30', shortLabel: 'GMT+6:30', label: 'GMT+6:30 (Yangon / MMT)', offsetMinutes: 390, offsetHours: 6.5 },
  { id: 'GMT+7', shortLabel: 'GMT+7', label: 'GMT+7 (Bangkok / Jakarta / Hanoi / WIB)', offsetMinutes: 420, offsetHours: 7 },
  { id: 'GMT+8', shortLabel: 'GMT+8', label: 'GMT+8 (Singapore / Beijing / Hong Kong / Perth / CST)', offsetMinutes: 480, offsetHours: 8 },
  { id: 'GMT+9', shortLabel: 'GMT+9', label: 'GMT+9 (Tokyo / Seoul / JST / KST)', offsetMinutes: 540, offsetHours: 9 },
  { id: 'GMT+9:30', shortLabel: 'GMT+9:30', label: 'GMT+9:30 (Adelaide / Darwin / ACST)', offsetMinutes: 570, offsetHours: 9.5 },
  { id: 'GMT+10', shortLabel: 'GMT+10', label: 'GMT+10 (Sydney / Melbourne / Brisbane / AEST)', offsetMinutes: 600, offsetHours: 10 },
  { id: 'GMT+11', shortLabel: 'GMT+11', label: 'GMT+11 (Solomon Islands / Noumea / SBT)', offsetMinutes: 660, offsetHours: 11 },
  { id: 'GMT+12', shortLabel: 'GMT+12', label: 'GMT+12 (Auckland / Wellington / Fiji / NZST)', offsetMinutes: 720, offsetHours: 12 },
  { id: 'GMT+13', shortLabel: 'GMT+13', label: 'GMT+13 (Samoa / Tonga / TOT)', offsetMinutes: 780, offsetHours: 13 },
  { id: 'GMT+14', shortLabel: 'GMT+14', label: 'GMT+14 (Line Islands / Kiritimati)', offsetMinutes: 840, offsetHours: 14 },
];

export const DEFAULT_SITE_TIMEZONE = AVAILABLE_TIMEZONES.find((t) => t.id === DEFAULT_SITE_TIMEZONE_ID)!;

let inMemoryTimezoneId: string | null = null;
let isTimezoneSyncInitialized = false;

/**
 * Returns the currently active Site Timezone configuration.
 * Default is explicitly GMT+0.
 */
export function getSiteTimezone(): SiteTimezoneConfig {
  if (inMemoryTimezoneId) {
    const found = AVAILABLE_TIMEZONES.find((t) => t.id === inMemoryTimezoneId);
    if (found) return found;
  }

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(TIMEZONE_STORAGE_KEY);
      if (stored) {
        const found = AVAILABLE_TIMEZONES.find((t) => t.id === stored);
        if (found) {
          inMemoryTimezoneId = found.id;
          return found;
        }
      }
    } catch {
      // Fallback
    }
  }

  inMemoryTimezoneId = DEFAULT_SITE_TIMEZONE.id;
  return DEFAULT_SITE_TIMEZONE;
}

/**
 * Returns the current timezone offset in minutes.
 */
export function getSiteTimezoneOffsetMinutes(): number {
  return getSiteTimezone().offsetMinutes;
}

/**
 * Sets the active Site Timezone (Administrators only).
 * Persists locally, broadcasts real-time events, and syncs to Firestore.
 */
export async function setSiteTimezone(timezoneId: string): Promise<boolean> {
  const target = AVAILABLE_TIMEZONES.find((t) => t.id === timezoneId);
  if (!target) return false;

  inMemoryTimezoneId = target.id;

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(TIMEZONE_STORAGE_KEY, target.id);
      window.dispatchEvent(new CustomEvent('3awdli_timezone_changed', { detail: { timezone: target } }));
      window.dispatchEvent(new CustomEvent('3awdli_schedules_updated', { detail: { timezone: target } }));
    } catch (err) {
      console.warn('Error saving timezone to localStorage:', err);
    }
  }

  // Persist to Firestore document so all sessions/devices share the admin's chosen timezone
  try {
    const settingsDoc = doc(db, 'chat_schedules', 'site_timezone_config');
    await setDoc(settingsDoc, {
      timezoneId: target.id,
      label: target.label,
      offsetMinutes: target.offsetMinutes,
      updatedAt: new Date().toISOString(),
      updatedAtTimestamp: Date.now(),
    }, { merge: true });
  } catch (err) {
    console.warn('Firestore timezone sync notice:', err);
  }

  return true;
}

/**
 * Real-time listener for Firestore timezone changes.
 */
export function initFirestoreTimezoneSync(): () => void {
  if (isTimezoneSyncInitialized) {
    return () => {};
  }
  isTimezoneSyncInitialized = true;

  try {
    const settingsDoc = doc(db, 'chat_schedules', 'site_timezone_config');
    const unsubscribe = onSnapshot(settingsDoc, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data && typeof data.timezoneId === 'string') {
          const found = AVAILABLE_TIMEZONES.find((t) => t.id === data.timezoneId);
          if (found && found.id !== inMemoryTimezoneId) {
            inMemoryTimezoneId = found.id;
            try {
              localStorage.setItem(TIMEZONE_STORAGE_KEY, found.id);
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('3awdli_timezone_changed', { detail: { timezone: found } }));
                window.dispatchEvent(new CustomEvent('3awdli_schedules_updated', { detail: { timezone: found } }));
              }
            } catch {
              // Ignore
            }
          }
        }
      }
    }, (err) => {
      console.warn('Timezone config subscription notice:', err);
    });

    return unsubscribe;
  } catch {
    return () => {};
  }
}

/**
 * Returns date & time components calculated strictly in the Site Timezone.
 */
export interface SiteTimeParts {
  year: number;
  month: number; // 0-11
  date: number; // 1-31
  dayOfWeek: number; // 0=Sunday, 1=Monday...
  hours: number; // 0-23
  minutes: number; // 0-59
  seconds: number; // 0-59
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm (24-hour)
  time12Str: string; // hh:mm AM/PM
  totalMinutes: number; // hours * 60 + minutes
  timezone: SiteTimezoneConfig;
}

export function getSiteTimeParts(
  inputTime?: number | Date,
  customTimezone?: SiteTimezoneConfig
): SiteTimeParts {
  const tz = customTimezone || getSiteTimezone();
  const baseMs = inputTime instanceof Date 
    ? inputTime.getTime() 
    : typeof inputTime === 'number' 
    ? inputTime 
    : Date.now();

  const shiftedMs = baseMs + tz.offsetMinutes * 60 * 1000;
  const d = new Date(shiftedMs);

  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const date = d.getUTCDate();
  const dayOfWeek = d.getUTCDay();
  const hours = d.getUTCHours();
  const minutes = d.getUTCMinutes();
  const seconds = d.getUTCSeconds();

  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${year}-${pad(month + 1)}-${pad(date)}`;
  const timeStr = `${pad(hours)}:${pad(minutes)}`;

  const h12 = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const time12Str = `${pad(h12)}:${pad(minutes)} ${ampm}`;

  return {
    year,
    month,
    date,
    dayOfWeek,
    hours,
    minutes,
    seconds,
    dateStr,
    timeStr,
    time12Str,
    totalMinutes: hours * 60 + minutes,
    timezone: tz,
  };
}

/**
 * Formats a timestamp into "HH:mm" in the Site's active timezone.
 */
export function formatSiteTime(inputTime?: number | Date, customTimezone?: SiteTimezoneConfig): string {
  return getSiteTimeParts(inputTime, customTimezone).timeStr;
}

/**
 * Formats a timestamp into "YYYY-MM-DD" in the Site's active timezone.
 */
export function formatSiteDate(inputTime?: number | Date, customTimezone?: SiteTimezoneConfig): string {
  return getSiteTimeParts(inputTime, customTimezone).dateStr;
}

/**
 * Formats a timestamp into a readable date string in the Site's active timezone (e.g. "Sep 25, 2026").
 */
export function formatSiteDateReadable(
  inputTime?: number | Date,
  lang: 'en' | 'fr' | 'ar' = 'en',
  customTimezone?: SiteTimezoneConfig
): string {
  const parts = getSiteTimeParts(inputTime, customTimezone);
  const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthsFr = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  let monthName = monthsEn[parts.month];
  if (lang === 'fr') monthName = monthsFr[parts.month];
  if (lang === 'ar') monthName = monthsAr[parts.month];

  if (lang === 'ar') {
    return `${parts.date} ${monthName} ${parts.year}`;
  }
  if (lang === 'fr') {
    return `${parts.date} ${monthName} ${parts.year}`;
  }
  return `${monthName} ${parts.date}, ${parts.year}`;
}

/**
 * Formats a date into a localized readable string in the Site's active timezone.
 * e.g. "Sep 25, 2026, 14:05 (GMT+0)"
 */
export function formatSiteDateTime(
  inputTime?: number | Date, 
  lang: 'en' | 'fr' | 'ar' = 'en',
  customTimezone?: SiteTimezoneConfig
): string {
  const parts = getSiteTimeParts(inputTime, customTimezone);
  const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthsFr = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  let monthName = monthsEn[parts.month];
  if (lang === 'fr') monthName = monthsFr[parts.month];
  if (lang === 'ar') monthName = monthsAr[parts.month];

  if (lang === 'ar') {
    return `${parts.date} ${monthName} ${parts.year}، ${parts.timeStr} (${parts.timezone.shortLabel})`;
  }
  if (lang === 'fr') {
    return `${parts.date} ${monthName} ${parts.year} à ${parts.timeStr} (${parts.timezone.shortLabel})`;
  }
  return `${monthName} ${parts.date}, ${parts.year}, ${parts.timeStr} (${parts.timezone.shortLabel})`;
}

/**
 * React hook to listen for site timezone changes and re-render components reactively.
 */
export function useSiteTimezone(): {
  timezone: SiteTimezoneConfig;
  setTimezone: (id: string) => Promise<boolean>;
  availableTimezones: SiteTimezoneConfig[];
  currentSiteTime: string;
} {
  const [timezone, setTimezoneState] = useState<SiteTimezoneConfig>(() => getSiteTimezone());
  const [currentSiteTime, setCurrentSiteTime] = useState<string>(() => formatSiteTime());

  useEffect(() => {
    const handleUpdate = () => {
      const tz = getSiteTimezone();
      setTimezoneState(tz);
      setCurrentSiteTime(formatSiteTime(undefined, tz));
    };

    handleUpdate();

    // Live clock tick every 5 seconds
    const interval = setInterval(() => {
      setCurrentSiteTime(formatSiteTime(undefined, getSiteTimezone()));
    }, 5000);

    window.addEventListener('3awdli_timezone_changed', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('3awdli_timezone_changed', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  return {
    timezone,
    setTimezone: setSiteTimezone,
    availableTimezones: AVAILABLE_TIMEZONES,
    currentSiteTime,
  };
}
