import { SupportRequest, SupportCategory, UserAccount } from '../types';
import {
  saveSupportRequestToFirestore,
  fetchSupportRequestsFromFirestore,
  subscribeToSupportRequests
} from '../lib/firestoreService';
import { forwardSupportRequestViaSMTP } from './emailService';
import { formatSiteTime, formatSiteDateReadable } from './timezoneManagement';

const SUPPORT_REQUESTS_KEY = '3awdli_support_requests';

const SEED_SUPPORT_REQUESTS: SupportRequest[] = [];

export function isFakeSupportRequest(r: Partial<SupportRequest> | null | undefined): boolean {
  if (!r) return true;
  if (r.id?.startsWith('req_seed_')) return true;
  return false;
}

export function getStoredSupportRequests(): SupportRequest[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SUPPORT_REQUESTS_KEY);
    if (!raw) {
      localStorage.setItem(SUPPORT_REQUESTS_KEY, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const clean = parsed.filter((r) => !isFakeSupportRequest(r));
    if (clean.length !== parsed.length) {
      localStorage.setItem(SUPPORT_REQUESTS_KEY, JSON.stringify(clean));
    }
    return clean;
  } catch (err) {
    console.error('Error reading support requests from storage:', err);
    return [];
  }
}

export function saveStoredSupportRequests(requests: SupportRequest[], changedRequest?: SupportRequest): void {
  if (typeof window === 'undefined') return;
  try {
    const clean = requests.filter((r) => !isFakeSupportRequest(r));
    localStorage.setItem(SUPPORT_REQUESTS_KEY, JSON.stringify(clean));
    window.dispatchEvent(new CustomEvent('3awdli_support_requests_updated'));
    // Persist only changed request to Firestore
    if (changedRequest && !isFakeSupportRequest(changedRequest)) {
      saveSupportRequestToFirestore(changedRequest).catch((e) =>
        console.warn('Firestore support request save notice:', e)
      );
    }
  } catch (err) {
    console.error('Error saving support requests to storage:', err);
  }
}

// Initialize real-time Firestore sync for support requests (Admin & Head of Listeners only)
export function initFirestoreSupportRequestsSync(currentUser?: UserAccount | null): () => void {
  if (!currentUser?.id) {
    return () => {};
  }

  // 1. Initial fetch from Firestore
  fetchSupportRequestsFromFirestore(currentUser)
    .then((remoteReqs) => {
      if (remoteReqs && remoteReqs.length > 0) {
        const cleanRemote = remoteReqs.filter((r) => !isFakeSupportRequest(r));
        const local = getStoredSupportRequests();
        const mergedMap = new Map<string, SupportRequest>();
        local.forEach((r) => mergedMap.set(r.id, r));
        cleanRemote.forEach((r) => {
          const existing = mergedMap.get(r.id);
          mergedMap.set(r.id, { ...existing, ...r });
        });
        const merged = Array.from(mergedMap.values());
        localStorage.setItem(SUPPORT_REQUESTS_KEY, JSON.stringify(merged));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('3awdli_support_requests_updated'));
        }
      }
    })
    .catch(() => {});

  // 2. Real-time Firestore subscription
  const unsubscribeFirestore = subscribeToSupportRequests(
    currentUser,
    (remoteReqs) => {
      if (!remoteReqs) return;
      const cleanRemote = remoteReqs.filter((r) => !isFakeSupportRequest(r));
      const local = getStoredSupportRequests();
      const mergedMap = new Map<string, SupportRequest>();
      local.forEach((r) => mergedMap.set(r.id, r));
      cleanRemote.forEach((r) => {
        const existing = mergedMap.get(r.id);
        mergedMap.set(r.id, { ...existing, ...r });
      });
      const merged = Array.from(mergedMap.values());
      localStorage.setItem(SUPPORT_REQUESTS_KEY, JSON.stringify(merged));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('3awdli_support_requests_updated'));
      }
    },
    () => {}
  );

  return () => {
    unsubscribeFirestore();
  };
}

export const SUPPORT_DESTINATION_EMAIL = 'aymane.habbo@gmail.com';

export function createSupportRequest(data: {
  subject: string;
  message: string;
  email: string;
  category?: SupportCategory;
  reportedListenerOrDiscussion?: string;
  priority?: 'urgent' | 'high' | 'normal';
  destinationEmail?: string;
  userId?: string;
  userName?: string;
}): SupportRequest {
  const current = getStoredSupportRequests();
  const now = new Date();
  const timeFormatted = formatSiteTime(now);
  const dateFormatted = formatSiteDateReadable(now);

  const category = data.category || 'general';
  const priority = data.priority || (category === 'report_listener' ? 'urgent' : 'normal');
  const destinationEmail = data.destinationEmail || SUPPORT_DESTINATION_EMAIL;

  const newRequest: SupportRequest = {
    id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    subject: data.subject.trim(),
    message: data.message.trim(),
    email: data.email.trim().toLowerCase(),
    category,
    reportedListenerOrDiscussion: data.reportedListenerOrDiscussion?.trim(),
    priority,
    destinationEmail,
    userId: data.userId,
    userName: data.userName,
    createdAt: `Today, ${dateFormatted} at ${timeFormatted}`,
    createdAtTimestamp: Date.now(),
    status: 'new',
  };

  const updated = [newRequest, ...current];
  saveStoredSupportRequests(updated, newRequest);

  // Send real email notification via Gmail SMTP if configured
  forwardSupportRequestViaSMTP(newRequest).then((res) => {
    if (res.success) {
      console.log('[SMTP] Support request dispatched to', newRequest.destinationEmail, 'messageId:', res.messageId);
    } else {
      console.log('[SMTP Notice] Email sending notice:', res.error);
    }
  }).catch((err) => {
    console.warn('[SMTP Error] Could not forward support request:', err);
  });

  return newRequest;
}

export function updateSupportRequestStatus(
  id: string,
  status: 'new' | 'in_progress' | 'resolved',
  adminNotes?: string
): SupportRequest | null {
  const current = getStoredSupportRequests();
  const index = current.findIndex((r) => r.id === id);
  if (index === -1) return null;

  const now = new Date();
  const timeFormatted = formatSiteTime(now);

  const existing = current[index];
  const updated: SupportRequest = {
    ...existing,
    status,
    adminNotes: adminNotes !== undefined ? adminNotes : existing.adminNotes,
    resolvedAt: status === 'resolved' ? `Today at ${timeFormatted}` : existing.resolvedAt,
  };

  current[index] = updated;
  saveStoredSupportRequests(current, updated);
  return updated;
}

export function deleteSupportRequest(id: string): boolean {
  const current = getStoredSupportRequests();
  const filtered = current.filter((r) => r.id !== id);
  if (filtered.length === current.length) return false;
  saveStoredSupportRequests(filtered);
  return true;
}
