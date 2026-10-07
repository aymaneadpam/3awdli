import { DiscussionReport, DiscussionReportReply, AdminReportReply, ReportSanction, ChatMessage, DiscussionConversation, UserAccount } from '../types';
import { getStoredUsers } from './userManagement';
import { addUserMailboxMessage } from './userMailboxManagement';
import { formatSiteTime, formatSiteDateReadable } from './timezoneManagement';
import {
  saveReportToFirestore,
  fetchReportsFromFirestore,
  subscribeToReports,
  deleteReportFromFirestore
} from '../lib/firestoreService';

const REPORTS_STORAGE_KEY = '3awdli_discussion_reports';

const SEED_REPORTS: DiscussionReport[] = [];

const SAMPLE_USER_EMAILS = new Set([
  'salma.benali@example.com',
  'dr.youssef@example.com',
  'nadia.cherkaoui@example.com',
  'karim.tazi@example.com',
  'dr.amina@example.com',
  'mehdi.b@example.com',
  'sofia.berrada@example.com',
]);

export function isFakeReport(r: Partial<DiscussionReport> | null | undefined): boolean {
  if (!r) return true;
  if (r.id?.startsWith('rep_sample_')) return true;
  if (r.discussionId?.startsWith('disc_claimed_105') || r.discussionId?.startsWith('disc_unopened_102')) return true;
  if (r.reporterEmail && SAMPLE_USER_EMAILS.has(r.reporterEmail.trim().toLowerCase())) return true;
  return false;
}

/**
 * Retrieve all discussion reports from localStorage
 */
export function getStoredReports(): DiscussionReport[] {
  try {
    const raw = localStorage.getItem(REPORTS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const clean = parsed.filter((r) => !isFakeReport(r));
    if (clean.length !== parsed.length) {
      localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(clean));
    }
    return clean.sort((a, b) => (b.createdAtTimestamp || 0) - (a.createdAtTimestamp || 0));
  } catch (err) {
    console.warn('Failed to load discussion reports:', err);
    return [];
  }
}

/**
 * Persist reports and broadcast update event.
 * If a changedReport is passed, automatically saves it to Firestore.
 */
export function saveStoredReports(reports: DiscussionReport[], changedReport?: DiscussionReport): void {
  try {
    const clean = reports.filter((r) => !isFakeReport(r));
    localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(clean));
    window.dispatchEvent(new CustomEvent('3awdli_report_updated', { detail: { reports: clean } }));
    window.dispatchEvent(new CustomEvent('3awdli_discussion_sync', {}));

    if (changedReport && !isFakeReport(changedReport)) {
      saveReportToFirestore(changedReport).catch((err) =>
        console.warn('Firestore report save notice:', err)
      );
    }
  } catch (err) {
    console.warn('Failed to save discussion reports:', err);
  }
}

/**
 * Create a new report tied to a discussion.
 * Note: Reports appear in the dedicated "Reports" category for Head of Listeners.
 * No mailbox notification is sent to Head of Listeners upon report creation.
 */
export function createDiscussionReport(params: {
  discussion: DiscussionConversation;
  reportedMessages: ChatMessage[];
  reason: string;
  reporterUser?: { id: string; name: string; email?: string; role?: string; is_listener?: boolean } | null;
}): DiscussionReport {
  const { discussion, reportedMessages, reason, reporterUser } = params;
  const now = new Date();
  const dateStr = formatSiteDateReadable(now);
  const timeStr = formatSiteTime(now);

  const isListenerReporter = reporterUser?.role === 'listener' || 
    reporterUser?.role === 'head_of_listeners' || 
    Boolean(reporterUser?.is_listener);

  const reporterId = reporterUser?.id || discussion.userId || `user_anon_${Date.now()}`;
  const reporterName = reporterUser?.name 
    ? reporterUser.name 
    : (discussion.type === 'anonymous' ? 'Anonymous User' : (discussion.userName || 'Member'));
  const reporterEmail = reporterUser?.email || (discussion.type === 'anonymous' ? undefined : discussion.userEmail);
  const reporterRole = isListenerReporter ? 'listener' : (discussion.type === 'anonymous' ? 'anonymous_user' : 'registered_user');

  const newReport: DiscussionReport = {
    id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    discussionId: discussion.id,
    discussionTitle: discussion.type === 'anonymous'
      ? `Anonymous Discussion #${discussion.id.slice(-6)}`
      : (discussion.userName ? `Discussion with ${discussion.userName}` : `Discussion #${discussion.id}`),
    discussionType: discussion.type,
    reporterId,
    reporterName,
    reporterEmail,
    reporterRole,
    reportedMessageIds: reportedMessages.map((m) => m.id),
    reportedMessages,
    reason: reason.trim(),
    createdAt: `${dateStr} • ${timeStr}`,
    createdAtTimestamp: Date.now(),
    status: 'pending',
    replies: [],
  };

  const existingReports = getStoredReports();
  const updatedReports = [newReport, ...existingReports];
  saveStoredReports(updatedReports, newReport);

  // Broadcast creation so Reports count badges and lists update immediately
  window.dispatchEvent(new CustomEvent('3awdli_report_created', { detail: { report: newReport } }));

  return newReport;
}

/**
 * Reply to a report.
 * Once sent, this reply is delivered to the reporting user's Mailbox so they can read the response there.
 */
export function replyToDiscussionReport(
  reportId: string,
  replyContent: string,
  responder: UserAccount
): { success: boolean; report?: DiscussionReport; error?: string } {
  if (!replyContent.trim()) {
    return { success: false, error: 'Reply text cannot be empty.' };
  }

  const reports = getStoredReports();
  const index = reports.findIndex((r) => r.id === reportId);
  if (index === -1) {
    return { success: false, error: 'Report not found.' };
  }

  const report = reports[index];
  const now = new Date();
  const dateStr = formatSiteDateReadable(now);
  const timeStr = formatSiteTime(now);
  const formattedTime = `${dateStr} • ${timeStr}`;

  const newReply: DiscussionReportReply = {
    id: `rep_rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    reportId,
    responderId: responder.id,
    responderName: responder.name,
    responderRole: responder.is_head_of_listeners
      ? 'Head of Listeners'
      : responder.role === 'admin'
      ? 'Administrator'
      : 'Supervisor',
    content: replyContent.trim(),
    createdAt: formattedTime,
    createdAtTimestamp: Date.now(),
  };

  const existingReplies = report.replies || [];
  const updatedReport: DiscussionReport = {
    ...report,
    status: 'replied',
    replies: [...existingReplies, newReply],
    lastRepliedAt: formattedTime,
    lastRepliedAtTimestamp: Date.now(),
    lastRepliedBy: responder.id,
    lastRepliedByName: responder.name,
  };

  reports[index] = updatedReport;
  saveStoredReports(reports, updatedReport);

  // Deliver reply to the reporting user's Mailbox
  addUserMailboxMessage(report.reporterId, {
    userEmail: report.reporterEmail,
    senderName: `${responder.name} • Head of Listeners`,
    senderRole: 'listener',
    subject: `Regarding your report on: ${report.discussionTitle || 'Discussion'}`,
    summary: replyContent.trim().length > 85 ? `${replyContent.trim().substring(0, 85)}...` : replyContent.trim(),
    content: `Dear ${report.reporterName},

Our Head of Listeners has reviewed your report regarding the conversation "${report.discussionTitle || 'Discussion'}".

Official Response from ${responder.name}:
--------------------------------------------------
${replyContent.trim()}
--------------------------------------------------

Your feedback and psychological safety are our highest priorities. If you need any further assistance, you can submit an inquiry or reach out to our listening team anytime.

Warmly,
The 3awdli Listening Leadership`,
    type: 'report_reply',
    relatedId: report.id,
  });

  window.dispatchEvent(new CustomEvent('3awdli_user_mailbox_updated', { detail: { userId: report.reporterId } }));
  window.dispatchEvent(new CustomEvent('3awdli_report_updated', { detail: { report: updatedReport } }));

  return { success: true, report: updatedReport };
}

/**
 * Get pending reports count (for Head of Listeners)
 */
export function getPendingReportsCount(): number {
  const reports = getStoredReports();
  // Count reports that are pending and not yet transferred
  return reports.filter((r) => r.status === 'pending' && !r.isTransferredToAdmin).length;
}

/**
 * Transfer a report to Administrator review.
 * Invoked by Head of Listeners with a mandatory description / explanation note.
 */
export function transferReportToAdministrator(params: {
  reportId: string;
  transferNote: string;
  headUser: UserAccount;
}): { success: boolean; report?: DiscussionReport; error?: string } {
  const { reportId, transferNote, headUser } = params;
  if (!transferNote.trim()) {
    return { success: false, error: 'Please provide a short explanation note explaining why you are transferring this report.' };
  }

  const reports = getStoredReports();
  const index = reports.findIndex((r) => r.id === reportId);
  if (index === -1) {
    return { success: false, error: 'Report not found.' };
  }

  const report = reports[index];
  const now = new Date();
  const dateStr = formatSiteDateReadable(now);
  const timeStr = formatSiteTime(now);
  const formattedTime = `${dateStr} • ${timeStr}`;

  const updatedReport: DiscussionReport = {
    ...report,
    isTransferredToAdmin: true,
    transferredByHeadId: headUser.id,
    transferredByHeadName: headUser.name,
    transferredByHeadEmail: headUser.email,
    transferredNote: transferNote.trim(),
    transferredAt: formattedTime,
    transferredAtTimestamp: Date.now(),
    transferStatus: 'pending_admin',
    adminReplies: report.adminReplies || [],
  };

  reports[index] = updatedReport;
  saveStoredReports(reports, updatedReport);

  // Notify UI
  window.dispatchEvent(new CustomEvent('3awdli_report_transferred', { detail: { report: updatedReport } }));
  window.dispatchEvent(new CustomEvent('3awdli_admin_reports_updated', { detail: { report: updatedReport } }));
  window.dispatchEvent(new CustomEvent('3awdli_report_updated', { detail: { report: updatedReport } }));

  return { success: true, report: updatedReport };
}

/**
 * Get all reports transferred to Administrator
 */
export function getTransferredReports(): DiscussionReport[] {
  const reports = getStoredReports();
  return reports
    .filter((r) => Boolean(r.isTransferredToAdmin))
    .sort((a, b) => (b.transferredAtTimestamp || b.createdAtTimestamp || 0) - (a.transferredAtTimestamp || a.createdAtTimestamp || 0));
}

/**
 * Get count of transferred reports requiring Administrator review / reply
 */
export function getPendingTransferredReportsCount(): number {
  const reports = getTransferredReports();
  return reports.filter((r) => r.transferStatus !== 'replied_by_admin').length;
}

/**
 * Administrator replies to the Head of Listeners who transferred the report.
 * Once sent, this reply is delivered to that Head of Listeners' Mailbox (via userMailboxManagement).
 */
export function replyToHeadOfListeners(params: {
  reportId: string;
  replyContent: string;
  adminUser: UserAccount;
}): { success: boolean; report?: DiscussionReport; error?: string } {
  const { reportId, replyContent, adminUser } = params;
  if (!replyContent.trim()) {
    return { success: false, error: 'Reply text cannot be empty.' };
  }

  const reports = getStoredReports();
  const index = reports.findIndex((r) => r.id === reportId);
  if (index === -1) {
    return { success: false, error: 'Report not found.' };
  }

  const report = reports[index];
  if (!report.isTransferredToAdmin || !report.transferredByHeadId) {
    return { success: false, error: 'This report has not been transferred by a Head of Listeners.' };
  }

  const now = new Date();
  const dateStr = formatSiteDateReadable(now);
  const timeStr = formatSiteTime(now);
  const formattedTime = `${dateStr} • ${timeStr}`;

  const adminReply: AdminReportReply = {
    id: `adm_rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    reportId,
    adminId: adminUser.id,
    adminName: adminUser.name,
    adminEmail: adminUser.email,
    content: replyContent.trim(),
    createdAt: formattedTime,
    createdAtTimestamp: Date.now(),
  };

  const existingReplies = report.adminReplies || [];
  const updatedReport: DiscussionReport = {
    ...report,
    transferStatus: 'replied_by_admin',
    adminReplies: [...existingReplies, adminReply],
    lastAdminRepliedAt: formattedTime,
    lastAdminRepliedAtTimestamp: Date.now(),
    lastAdminRepliedBy: adminUser.id,
    lastAdminRepliedByName: adminUser.name,
  };

  reports[index] = updatedReport;
  saveStoredReports(reports, updatedReport);

  // Deliver response to Head of Listeners' Mailbox
  addUserMailboxMessage(report.transferredByHeadId, {
    userEmail: report.transferredByHeadEmail,
    senderName: `${adminUser.name} • Platform Administrator`,
    senderRole: 'admin',
    subject: `[Admin Response] Transferred Report #${report.id.slice(-6)}: ${report.discussionTitle || 'Discussion Review'}`,
    summary: replyContent.trim().length > 90 ? `${replyContent.trim().substring(0, 90)}...` : replyContent.trim(),
    content: `Dear ${report.transferredByHeadName || 'Head of Listeners'},

Regarding the report you transferred to Administrator leadership:
Case ID: #${report.id.slice(-6)}
Discussion: ${report.discussionTitle || report.discussionId}

Your Escalation Note:
"${report.transferredNote || 'N/A'}"

Official Administrator Response from ${adminUser.name}:
--------------------------------------------------
${replyContent.trim()}
--------------------------------------------------

This decision and record have been filed in administrative records. Thank you for your continued leadership and oversight in upholding platform safety standards.

Sincerely,
${adminUser.name}
Administrator Leadership & Executive Oversight`,
    type: 'report_reply',
    relatedId: report.id,
  });

  window.dispatchEvent(new CustomEvent('3awdli_user_mailbox_updated', { detail: { userId: report.transferredByHeadId } }));
  window.dispatchEvent(new CustomEvent('3awdli_admin_reports_updated', { detail: { report: updatedReport } }));
  window.dispatchEvent(new CustomEvent('3awdli_report_updated', { detail: { report: updatedReport } }));

  return { success: true, report: updatedReport };
}

/**
 * Record a moderation sanction (warning or ban) on a transferred report.
 */
export function addReportSanction(
  reportId: string,
  sanctionData: Omit<ReportSanction, 'id' | 'sanctionedAt' | 'sanctionedAtTimestamp'>
): { success: boolean; report?: DiscussionReport; sanction?: ReportSanction; error?: string } {
  const reports = getStoredReports();
  const index = reports.findIndex((r) => r.id === reportId);
  if (index === -1) {
    return { success: false, error: 'Report not found.' };
  }

  const report = reports[index];
  const now = new Date();
  const dateStr = formatSiteDateReadable(now);
  const timeStr = formatSiteTime(now);
  const formattedTime = `${dateStr} • ${timeStr}`;

  const newSanction: ReportSanction = {
    ...sanctionData,
    id: `sanc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    sanctionedAt: formattedTime,
    sanctionedAtTimestamp: Date.now(),
  };

  const existingSanctions = report.sanctions || [];
  const updatedReport: DiscussionReport = {
    ...report,
    sanctions: [...existingSanctions, newSanction],
  };

  reports[index] = updatedReport;
  saveStoredReports(reports, updatedReport);

  window.dispatchEvent(new CustomEvent('3awdli_admin_reports_updated', { detail: { report: updatedReport } }));
  window.dispatchEvent(new CustomEvent('3awdli_report_updated', { detail: { report: updatedReport } }));

  return { success: true, report: updatedReport, sanction: newSanction };
}

/**
 * Delete a report from local storage and Firestore
 */
export function deleteDiscussionReport(reportId: string): void {
  const reports = getStoredReports().filter((r) => r.id !== reportId);
  try {
    localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(reports));
    deleteReportFromFirestore(reportId).catch((err) => console.warn('Firestore report delete notice:', err));
    window.dispatchEvent(new CustomEvent('3awdli_report_updated', { detail: { reports } }));
    window.dispatchEvent(new CustomEvent('3awdli_discussion_sync', {}));
  } catch (err) {
    console.warn('Failed to delete report:', err);
  }
}

let isReportsSyncInitialized = false;

/**
 * Initialize real-time synchronization between Firestore and local storage for discussion reports.
 */
export function initFirestoreReportsSync(): () => void {
  if (isReportsSyncInitialized) {
    return () => {};
  }
  isReportsSyncInitialized = true;

  // 1. Initial fetch from Firestore
  fetchReportsFromFirestore()
    .then((remoteReports) => {
      if (remoteReports && remoteReports.length > 0) {
        const cleanRemote = remoteReports.filter((r) => !isFakeReport(r));
        const local = getStoredReports();
        const mergedMap = new Map<string, DiscussionReport>();
        // First set local
        local.forEach((r) => mergedMap.set(r.id, r));
        // Then merge remote
        cleanRemote.forEach((r) => {
          const existing = mergedMap.get(r.id);
          mergedMap.set(r.id, { ...existing, ...r });
        });
        const merged = Array.from(mergedMap.values()).sort(
          (a, b) => (b.createdAtTimestamp || 0) - (a.createdAtTimestamp || 0)
        );
        localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(merged));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('3awdli_report_updated', { detail: { reports: merged } }));
          window.dispatchEvent(new CustomEvent('3awdli_discussion_sync', {}));
        }

        // Migrate any pre-existing local reports to Firestore if missing remotely
        const remoteIds = new Set(cleanRemote.map((r) => r.id));
        local.forEach((localReport) => {
          if (!remoteIds.has(localReport.id) && !isFakeReport(localReport)) {
            saveReportToFirestore(localReport).catch((e) =>
              console.warn('Syncing local report to Firestore notice:', e)
            );
          }
        });
      } else {
        // If Firestore had no reports yet, push any local non-sample reports to Firestore
        const local = getStoredReports();
        local.forEach((localReport) => {
          if (!isFakeReport(localReport)) {
            saveReportToFirestore(localReport).catch((e) =>
              console.warn('Migrating local report to Firestore notice:', e)
            );
          }
        });
      }
    })
    .catch((err) => {
      console.warn('Initial Firestore reports fetch notice:', err);
    });

  // 2. Real-time Firestore subscription
  const unsubscribeFirestore = subscribeToReports((remoteReports) => {
    if (!remoteReports) return;
    const cleanRemote = remoteReports.filter((r) => !isFakeReport(r));
    const local = getStoredReports();
    const mergedMap = new Map<string, DiscussionReport>();
    local.forEach((r) => mergedMap.set(r.id, r));
    cleanRemote.forEach((r) => {
      const existing = mergedMap.get(r.id);
      mergedMap.set(r.id, { ...existing, ...r });
    });
    const merged = Array.from(mergedMap.values()).sort(
      (a, b) => (b.createdAtTimestamp || 0) - (a.createdAtTimestamp || 0)
    );
    localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(merged));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('3awdli_report_updated', { detail: { reports: merged } }));
      window.dispatchEvent(new CustomEvent('3awdli_discussion_sync', {}));
    }
  });

  return () => {
    isReportsSyncInitialized = false;
    unsubscribeFirestore();
  };
}

