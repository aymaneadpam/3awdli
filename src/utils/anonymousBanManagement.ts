/**
 * Anonymous Session & Device Ban Management
 * 
 * Provides browser-based persistent markers (cookie + local device flag)
 * to mark an anonymous visitor's browser as blocked from starting new
 * anonymous conversations going forward.
 * 
 * Note: As documented across the platform, this is a soft/best-effort block
 * (bypassable by clearing browser data, cookies, or using a different device/browser).
 */

export const ANON_BAN_COOKIE_NAME = '3awdli_anon_blocked';
export const ANON_BAN_STORAGE_KEY = '3awdli_anon_blocked';
export const ANON_BLOCKED_SESSIONS_KEY = '3awdli_anon_blocked_sessions';

export interface AnonBanDetails {
  isBlocked: boolean;
  blockedAt?: string;
  reason?: string;
  adminName?: string;
  sessionId?: string;
}

/**
 * Check if the current browser environment is flagged as banned from anonymous conversations.
 */
export function isAnonymousSessionBlocked(sessionId?: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    // 1. Check local device storage flag
    const localFlag = localStorage.getItem(ANON_BAN_STORAGE_KEY);
    if (localFlag === 'true') {
      return true;
    }

    // 2. Check persistent cookie marker
    if (typeof document !== 'undefined' && document.cookie) {
      const cookies = document.cookie.split(';').map((c) => c.trim());
      const hasCookie = cookies.some((c) => c.startsWith(`${ANON_BAN_COOKIE_NAME}=true`));
      if (hasCookie) {
        // Sync back to localStorage if was cleared
        localStorage.setItem(ANON_BAN_STORAGE_KEY, 'true');
        return true;
      }
    }

    // 3. Check specific session ID blocklist
    if (sessionId) {
      const rawSessions = localStorage.getItem(ANON_BLOCKED_SESSIONS_KEY);
      if (rawSessions) {
        const sessions: string[] = JSON.parse(rawSessions);
        if (Array.isArray(sessions) && sessions.includes(sessionId)) {
          return true;
        }
      }
    }

    return false;
  } catch (err) {
    console.warn('Error checking anonymous session ban state:', err);
    return false;
  }
}

/**
 * Apply the browser-based persistent marker to block this device from anonymous conversations.
 */
export function banAnonymousSession(options?: {
  sessionId?: string;
  discussionId?: string;
  reason?: string;
  adminName?: string;
}): { success: boolean; markerApplied: boolean } {
  if (typeof window === 'undefined') return { success: false, markerApplied: false };

  try {
    const timestamp = new Date().toISOString();
    const reasonText = options?.reason?.trim() || 'Community standards violation';
    const adminLabel = options?.adminName?.trim() || 'Administrator';

    // 1. Set 1-year persistent cookie
    const oneYearSeconds = 365 * 24 * 60 * 60;
    document.cookie = `${ANON_BAN_COOKIE_NAME}=true; path=/; max-age=${oneYearSeconds}; SameSite=Lax`;

    // 2. Set localStorage device markers
    localStorage.setItem(ANON_BAN_STORAGE_KEY, 'true');
    localStorage.setItem('3awdli_anon_blocked_at', timestamp);
    localStorage.setItem('3awdli_anon_blocked_reason', reasonText);
    localStorage.setItem('3awdli_anon_blocked_by', adminLabel);

    // 3. Add session / discussion IDs to blocked session registry
    const idToAdd = options?.sessionId || options?.discussionId;
    if (idToAdd) {
      const rawSessions = localStorage.getItem(ANON_BLOCKED_SESSIONS_KEY);
      const list: string[] = rawSessions ? JSON.parse(rawSessions) : [];
      if (!list.includes(idToAdd)) {
        list.push(idToAdd);
        localStorage.setItem(ANON_BLOCKED_SESSIONS_KEY, JSON.stringify(list));
      }
    }

    // 4. Dispatch browser event
    window.dispatchEvent(
      new CustomEvent('3awdli_anon_blocked_status_changed', {
        detail: { blocked: true, timestamp, reason: reasonText },
      })
    );

    return { success: true, markerApplied: true };
  } catch (err) {
    console.error('Failed to set anonymous device ban marker:', err);
    return { success: false, markerApplied: false };
  }
}

/**
 * Remove device ban marker (for administrative resets or tests).
 */
export function unbanAnonymousSession(): void {
  if (typeof window === 'undefined') return;

  try {
    document.cookie = `${ANON_BAN_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    localStorage.removeItem(ANON_BAN_STORAGE_KEY);
    localStorage.removeItem('3awdli_anon_blocked_at');
    localStorage.removeItem('3awdli_anon_blocked_reason');
    localStorage.removeItem('3awdli_anon_blocked_by');

    window.dispatchEvent(
      new CustomEvent('3awdli_anon_blocked_status_changed', {
        detail: { blocked: false },
      })
    );
  } catch (err) {
    console.warn('Failed to unban anonymous session:', err);
  }
}

/**
 * Retrieve current ban details for UI presentation.
 */
export function getAnonymousBanDetails(): AnonBanDetails {
  const isBlocked = isAnonymousSessionBlocked();
  if (!isBlocked) return { isBlocked: false };

  try {
    return {
      isBlocked: true,
      blockedAt: localStorage.getItem('3awdli_anon_blocked_at') || undefined,
      reason: localStorage.getItem('3awdli_anon_blocked_reason') || undefined,
      adminName: localStorage.getItem('3awdli_anon_blocked_by') || undefined,
    };
  } catch {
    return { isBlocked: true };
  }
}
