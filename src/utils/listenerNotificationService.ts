// Listener Browser Notification Service
// Handles browser Notification permissions, prompt once logic, and alerts when new discussions arrive while free

import { getUnopenedDiscussions, isListenerFree } from './discussionManagement';

export type NotificationPermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported';

const PROMPT_STORAGE_KEY = '3awdli_listener_notif_prompted';

let lastKnownWaitingIds: Set<string> | null = null;
let isTrackerInitialized = false;

/**
 * Check if the browser supports the Notification API
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Get current browser notification permission
 */
export function getNotificationPermission(): NotificationPermissionStatus {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission as NotificationPermissionStatus;
}

/**
 * Check if user has already been asked for permission on this device
 */
export function hasBeenPromptedForNotification(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(PROMPT_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark that the permission prompt was shown
 */
export function markPromptedForNotification(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROMPT_STORAGE_KEY, 'true');
  } catch {
    // Ignore storage issues
  }
}

/**
 * Request notification permission from the listener.
 * Can be triggered automatically on first visit or via UI button.
 */
export async function requestListenerNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }

  markPromptedForNotification();

  try {
    const permission = await Notification.requestPermission();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('3awdli_notification_permission_changed', { detail: { permission } }));
    }
    return permission as NotificationPermissionStatus;
  } catch (err) {
    console.warn('[Notification] Error requesting permission:', err);
    return getNotificationPermission();
  }
}

/**
 * On first visit to the Discussions page, request permission once.
 * If user previously dismissed or denied, do not repeatedly re-ask!
 */
export async function autoPromptNotificationOnFirstVisit(): Promise<void> {
  if (!isNotificationSupported()) return;

  // Only auto-prompt if current permission is 'default' (not yet answered) and not prompted before
  if (Notification.permission === 'default' && !hasBeenPromptedForNotification()) {
    await requestListenerNotificationPermission();
  }
}

/**
 * Play a gentle, compassionate web audio chime
 */
export function playNotificationChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // First note: C5 (523.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Second note: E5 (659.25 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.12);
    gain2.gain.setValueAtTime(0.09, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);
  } catch {
    // AudioContext failure is non-blocking
  }
}

/**
 * Send a browser desktop notification to a free listener when a discussion arrives
 */
export function sendDiscussionWaitingNotification(
  waitingCount: number,
  category?: string
): boolean {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    playNotificationChime();

    const title = waitingCount > 1 
      ? `3awdli • ${waitingCount} Discussions Waiting`
      : '3awdli • New Discussion Waiting';

    const categoryText = category && category !== 'General' ? ` (${category})` : '';
    const body = waitingCount > 1
      ? `${waitingCount} visitors are currently waiting in the queue. You are free to pick one up.`
      : `A visitor is waiting in the queue${categoryText}. You are currently free to connect.`;

    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: '3awdli-discussion-waiting', // Keeps notifications neat by replacing previous alert
      requireInteraction: false,
    });

    notification.onclick = () => {
      try {
        window.focus();
        notification.close();
      } catch {}
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('3awdli_open_unopened_discussions', {}));
      }
    };

    return true;
  } catch (err) {
    console.warn('[Notification] Failed to display notification:', err);
    return false;
  }
}

/**
 * Check for newly arrived waiting discussions and notify the listener if they are free.
 * - Only alerts if permission is granted.
 * - Only alerts if this listener currently has zero open/active conversations (isListenerFree).
 * - Avoids re-alerting for existing queue items.
 */
export function checkAndNotifyWaitingDiscussions(listenerId?: string | null): void {
  if (!listenerId) return;
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;

  try {
    const unopened = getUnopenedDiscussions();
    const currentIds = new Set(unopened.map((d) => d.id));

    // First time encountering the list during this session
    if (!isTrackerInitialized || lastKnownWaitingIds === null) {
      lastKnownWaitingIds = currentIds;
      isTrackerInitialized = true;
      return;
    }

    // Identify discussions that appeared since the previous check
    const newlyWaiting = unopened.filter((d) => !lastKnownWaitingIds?.has(d.id));

    if (newlyWaiting.length > 0) {
      // Check if listener is free (no active/open conversations)
      if (isListenerFree(listenerId)) {
        const first = newlyWaiting[0];
        sendDiscussionWaitingNotification(
          unopened.length,
          first?.category || (first as any)?.primaryTopic
        );
      }
    }

    lastKnownWaitingIds = currentIds;
  } catch (err) {
    console.warn('[Notification] Error evaluating waiting notifications:', err);
  }
}

