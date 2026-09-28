import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, 
  Flag, 
  CheckCircle2, 
  Clock, 
  User, 
  UserX,
  Users,
  MessageSquare, 
  ArrowLeft, 
  Send, 
  AlertTriangle, 
  Search, 
  Mail, 
  Sparkles, 
  Lock,
  Calendar,
  AlertCircle,
  Share2,
  ChevronRight,
  ShieldCheck,
  Check,
  RefreshCw,
  ExternalLink,
  Info,
  FileText,
  CornerDownRight,
  BadgeAlert
} from 'lucide-react';
import { 
  DiscussionReport, 
  UserAccount, 
  DiscussionConversation, 
  ChatMessage, 
  AdminReportReply,
  ReportSanction 
} from '../types';
import { 
  getTransferredReports, 
  replyToHeadOfListeners, 
  getPendingTransferredReportsCount 
} from '../utils/reportManagement';
import { 
  getStoredDiscussions, 
  findDiscussionForReport, 
  getAllDiscussionParticipantsForModeration 
} from '../utils/discussionManagement';
import { isAdministrator } from '../utils/userManagement';
import { Navbar } from './Navbar';
import { AdminSanctionModal } from './AdminSanctionModal';

interface AdminReportsPageProps {
  currentUser: UserAccount;
  onNavigateHome: () => void;
  onNavigateDashboard?: () => void;
  onNavigateDiscussions?: (tab?: 'unopened' | 'mailbox' | 'my-conversations' | 'history') => void;
  onNavigateAdmin?: () => void;
  onNavigateReports?: () => void;
  onNavigateMemberManagement?: () => void;
  onNavigateGames?: () => void;
  onNavigateTeenSpace?: () => void;
  onNavigateLounge?: () => void;
  onNavigateRules?: () => void;
  onNavigateMailbox?: () => void;
  onNavigateAdminSupport?: () => void;
  onOpenEmergencyModal?: () => void;
  onOpenContactSupport?: () => void;
  onTalkAnonymously?: () => void;
  onSignOut?: () => void;
  initialReportId?: string | null;
}

export const AdminReportsPage: React.FC<AdminReportsPageProps> = ({
  currentUser,
  onNavigateHome,
  onNavigateDashboard,
  onNavigateDiscussions,
  onNavigateAdmin,
  onNavigateReports,
  onNavigateMemberManagement,
  onNavigateGames,
  onNavigateTeenSpace,
  onNavigateLounge,
  onNavigateRules,
  onNavigateMailbox,
  onNavigateAdminSupport,
  onOpenEmergencyModal,
  onOpenContactSupport,
  onTalkAnonymously,
  onSignOut,
  initialReportId,
}) => {
  const [reports, setReports] = useState<DiscussionReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<DiscussionReport | null>(null);
  const [filter, setFilter] = useState<'all' | 'needs_reply' | 'replied'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Reply form state
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replySuccessNotice, setReplySuccessNotice] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Sanction modal state
  const [isSanctionModalOpen, setIsSanctionModalOpen] = useState(false);
  const [sanctionSuccessNotice, setSanctionSuccessNotice] = useState<string | null>(null);

  const hasAdminAccess = isAdministrator(currentUser) || (currentUser as any)?.role === 'administrator';

  const loadTransferredReports = () => {
    const list = getTransferredReports();
    setReports(list);
    if (selectedReport) {
      const updated = list.find((r) => r.id === selectedReport.id);
      if (updated) setSelectedReport(updated);
    }
  };

  useEffect(() => {
    loadTransferredReports();

    const handleUpdate = () => {
      loadTransferredReports();
    };

    window.addEventListener('3awdli_admin_reports_updated', handleUpdate);
    window.addEventListener('3awdli_report_transferred', handleUpdate);
    window.addEventListener('3awdli_report_updated', handleUpdate);

    return () => {
      window.removeEventListener('3awdli_admin_reports_updated', handleUpdate);
      window.removeEventListener('3awdli_report_transferred', handleUpdate);
      window.removeEventListener('3awdli_report_updated', handleUpdate);
    };
  }, [selectedReport?.id]);

  // Initial report selection if passed
  useEffect(() => {
    if (initialReportId && reports.length > 0) {
      const found = reports.find((r) => r.id === initialReportId);
      if (found) setSelectedReport(found);
    }
  }, [initialReportId, reports]);

  const handleSendReplyToHead = async () => {
    if (!selectedReport) return;
    if (!replyText.trim()) {
      setReplyError('Please write your response before sending to the Head of Listeners.');
      return;
    }

    setIsSendingReply(true);
    setReplyError(null);

    try {
      const res = replyToHeadOfListeners({
        reportId: selectedReport.id,
        replyContent: replyText.trim(),
        adminUser: currentUser,
      });

      if (res.success && res.report) {
        setSelectedReport(res.report);
        setReplyText('');
        setShowReplyBox(false);
        setReplySuccessNotice(
          `Official response delivered to ${res.report.transferredByHeadName || 'Head of Listeners'}'s secure Mailbox.`
        );
        loadTransferredReports();
        setTimeout(() => {
          setReplySuccessNotice(null);
        }, 7000);
      } else {
        setReplyError(res.error || 'Failed to deliver response. Please try again.');
      }
    } catch (err) {
      setReplyError('An unexpected error occurred while delivering the response.');
    } finally {
      setIsSendingReply(false);
    }
  };

  // Find discussion in stored discussions
  const discussions = getStoredDiscussions();
  const currentDiscussion = selectedReport 
    ? findDiscussionForReport(selectedReport, discussions) 
    : null;

  // Resolved list of all participants for moderation
  const moderationParticipants = useMemo(() => {
    if (!selectedReport) return [];
    return getAllDiscussionParticipantsForModeration(selectedReport, currentDiscussion);
  }, [selectedReport, currentDiscussion]);

  // Anonymity-respecting participant resolution
  const getDiscussionParticipants = () => {
    if (!selectedReport) return { visitorName: 'Anonymous User', isAnonymous: true, listenerName: 'Unassigned', joinedListener: null };
    
    const isAnonymous = currentDiscussion?.type === 'anonymous' || 
      selectedReport.discussionType === 'anonymous' || 
      currentDiscussion?.userId === 'anon_portal_visitor' ||
      !currentDiscussion?.userName ||
      currentDiscussion?.userName.toLowerCase().includes('anon');

    const visitorName = isAnonymous 
      ? 'Anonymous User' 
      : (currentDiscussion?.userName || (selectedReport.reporterRole !== 'listener' ? selectedReport.reporterName : 'Registered Member'));

    const listenerName = currentDiscussion?.joinedListenerName || 
      currentDiscussion?.openedByListenerName || 
      (selectedReport.reporterRole === 'listener' ? selectedReport.reporterName : 'Peer Listener');

    return {
      visitorName,
      isAnonymous,
      listenerName,
      joinedListener: currentDiscussion?.joinedListenerName || null,
      listenerProfession: currentDiscussion?.joinedListenerProfession || 'Peer Supporter',
    };
  };

  const participants = getDiscussionParticipants();

  // Full conversation messages
  const fullDiscussionMessages: ChatMessage[] = currentDiscussion?.messages?.length 
    ? currentDiscussion.messages 
    : (selectedReport?.reportedMessages || []);

  const formatSenderLabel = (msg: ChatMessage) => {
    if (msg.sender === 'user') {
      return participants.isAnonymous ? 'Anonymous User' : participants.visitorName;
    }
    return msg.senderName || participants.listenerName || 'Listener';
  };

  // Filtered reports
  const filteredReports = reports.filter((r) => {
    if (filter === 'needs_reply' && r.transferStatus === 'replied_by_admin') return false;
    if (filter === 'replied' && r.transferStatus !== 'replied_by_admin') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = r.discussionTitle?.toLowerCase().includes(q);
      const matchHead = r.transferredByHeadName?.toLowerCase().includes(q);
      const matchNote = r.transferredNote?.toLowerCase().includes(q);
      const matchReason = r.reason.toLowerCase().includes(q);
      const matchReporter = r.reporterName.toLowerCase().includes(q);
      return matchTitle || matchHead || matchNote || matchReason || matchReporter;
    }
    return true;
  });

  const pendingCount = reports.filter((r) => r.transferStatus !== 'replied_by_admin').length;
  const repliedCount = reports.filter((r) => r.transferStatus === 'replied_by_admin').length;

  if (!hasAdminAccess) {
    return (
      <Navbar
        currentUser={currentUser}
        currentView="home"
        onNavigateHome={onNavigateHome}
        onNavigateDashboard={onNavigateDashboard}
        onNavigateDiscussions={onNavigateDiscussions}
        onNavigateAdmin={onNavigateAdmin}
        onNavigateReports={onNavigateReports}
        onNavigateMemberManagement={onNavigateMemberManagement}
        onNavigateGames={onNavigateGames}
        onNavigateTeenSpace={onNavigateTeenSpace}
        onNavigateLounge={onNavigateLounge}
        onNavigateRules={onNavigateRules}
        onNavigateMailbox={onNavigateMailbox}
        onOpenEmergencyModal={onOpenEmergencyModal}
        onOpenContactSupport={onOpenContactSupport}
        onTalkAnonymously={onTalkAnonymously}
        onSignOut={onSignOut}
      >
        <div className="max-w-xl mx-auto py-16 px-4 text-center">
          <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-4 border border-amber-200">
            <Lock className="w-8 h-8 text-amber-700" />
          </div>
          <h2 className="text-xl font-bold text-stone-900 font-['Lora',serif]">
            Administrator Access Required
          </h2>
          <p className="text-sm text-stone-600 mt-2">
            The Transferred Reports console is restricted to platform Administrators and Executive Leadership.
          </p>
          <button
            onClick={onNavigateHome}
            className="mt-6 px-5 py-2.5 bg-[#315243] text-white text-xs font-semibold rounded-2xl hover:bg-[#253E33] transition-colors cursor-pointer"
          >
            Return to Home
          </button>
        </div>
      </Navbar>
    );
  }

  return (
    <Navbar
      currentUser={currentUser}
      currentView="admin-reports"
      onNavigateHome={onNavigateHome}
      onNavigateDashboard={onNavigateDashboard}
      onNavigateDiscussions={onNavigateDiscussions}
      onNavigateAdmin={onNavigateAdmin}
      onNavigateReports={onNavigateReports}
      onNavigateMemberManagement={onNavigateMemberManagement}
      onNavigateAdminReports={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      onNavigateAdminSupport={onNavigateAdminSupport}
      onNavigateGames={onNavigateGames}
      onNavigateTeenSpace={onNavigateTeenSpace}
      onNavigateLounge={onNavigateLounge}
      onNavigateRules={onNavigateRules}
      onNavigateMailbox={onNavigateMailbox}
      onOpenEmergencyModal={onOpenEmergencyModal}
      onOpenContactSupport={onOpenContactSupport}
      onTalkAnonymously={onTalkAnonymously}
      onSignOut={onSignOut}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
        
        {/* Top Header & Context */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#EAE3D7] pb-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100/90 text-rose-900 border border-rose-300 text-xs font-semibold">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-700" />
              <span>Executive Safety Oversight &bull; Administrator Only</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 font-['Lora',serif] tracking-tight">
              Transferred Reports
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 max-w-2xl">
              Reported discussions escalated specifically by a Head of Listeners for administrative investigation, review, and response.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {onNavigateReports && (
              <button
                type="button"
                onClick={onNavigateReports}
                className="px-3.5 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <FileText className="w-3.5 h-3.5 text-stone-500" />
                <span>Head of Listeners Queue</span>
              </button>
            )}

            <button
              type="button"
              onClick={loadTransferredReports}
              className="p-2 text-stone-600 hover:text-stone-900 bg-white hover:bg-stone-50 border border-stone-300 rounded-xl transition-colors cursor-pointer shadow-2xs"
              title="Refresh transferred reports"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {replySuccessNotice && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{replySuccessNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setReplySuccessNotice(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* VIEW 1: LIST OF TRANSFERRED REPORTS */}
        {!selectedReport ? (
          <div className="space-y-6">
            
            {/* Metric Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-[#E3DDD1] rounded-3xl p-5 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0 border border-rose-200">
                  <ShieldAlert className="w-6 h-6 text-rose-600" />
                </div>
                <div>
                  <span className="text-xs font-medium text-stone-500">Transferred Reports</span>
                  <div className="text-2xl font-bold text-stone-900 font-['Lora',serif]">
                    {reports.length}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[#E3DDD1] rounded-3xl p-5 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <span className="text-xs font-medium text-stone-500">Awaiting Admin Reply</span>
                  <div className="text-2xl font-bold text-stone-900 font-['Lora',serif]">
                    {pendingCount}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[#E3DDD1] rounded-3xl p-5 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <span className="text-xs font-medium text-stone-500">Admin Replied</span>
                  <div className="text-2xl font-bold text-stone-900 font-['Lora',serif]">
                    {repliedCount}
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 sm:p-4 rounded-3xl border border-[#E3DDD1] shadow-2xs">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    filter === 'all'
                      ? 'bg-[#315243] text-white shadow-xs'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  All Transferred ({reports.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('needs_reply')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    filter === 'needs_reply'
                      ? 'bg-[#315243] text-white shadow-xs'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <span>Needs Admin Reply</span>
                  {pendingCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-stone-900 font-bold">
                      {pendingCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('replied')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    filter === 'replied'
                      ? 'bg-[#315243] text-white shadow-xs'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  Replied by Admin ({repliedCount})
                </button>
              </div>

              <div className="relative w-full sm:w-auto min-w-0 sm:min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notes, head, discussion..."
                  className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-stone-200 focus:border-[#315243] focus:ring-1 focus:ring-[#315243] outline-hidden text-stone-800"
                />
              </div>
            </div>

            {/* List of Transferred Reports */}
            {filteredReports.length === 0 ? (
              <div className="bg-white rounded-3xl border border-[#E3DDD1] p-12 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-stone-800 font-['Lora',serif]">
                  No Transferred Reports Found
                </h3>
                <p className="text-xs text-stone-500 max-w-md mx-auto">
                  {searchQuery.trim()
                    ? 'No transferred reports match your active search terms.'
                    : 'When a Head of Listeners transfers a report with an explanation note, it will immediately appear here for administrator review.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredReports.map((report) => {
                  const hasReplied = report.transferStatus === 'replied_by_admin';
                  return (
                    <div
                      key={report.id}
                      id={`transferred-report-card-${report.id}`}
                      onClick={() => setSelectedReport(report)}
                      className="bg-white border border-[#E3DDD1] hover:border-amber-400 rounded-3xl p-5 sm:p-6 shadow-xs hover:shadow-md transition-all cursor-pointer group space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-200 flex items-center gap-1">
                            <Flag className="w-3 h-3 text-rose-600" />
                            <span>CASE #{report.id.slice(-6)}</span>
                          </span>

                          <span className="text-xs font-semibold text-stone-900">
                            {report.discussionTitle || 'Discussion Review'}
                          </span>

                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium">
                            {report.discussionType === 'anonymous' ? 'Anonymous Session' : 'Registered Session'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${
                            hasReplied
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-amber-50 text-amber-800 border-amber-300'
                          }`}>
                            {hasReplied ? '✓ Admin Replied' : 'Pending Admin Response'}
                          </span>

                          <span className="text-[11px] text-stone-400 font-mono">
                            {report.transferredAt || report.createdAt}
                          </span>
                        </div>
                      </div>

                      {/* Head of Listeners Transfer Callout */}
                      <div className="bg-amber-50/90 rounded-2xl p-3.5 border border-amber-200/80 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 font-bold text-amber-950">
                            <ShieldAlert className="w-4 h-4 text-amber-700" />
                            <span>Transferred by: {report.transferredByHeadName || 'Head of Listeners'}</span>
                          </div>
                          <span className="text-[10px] text-amber-800 font-medium">
                            Head of Listeners Note
                          </span>
                        </div>
                        <p className="text-xs text-stone-800 italic leading-relaxed bg-white/90 p-2.5 rounded-xl border border-amber-200/60">
                          &ldquo;{report.transferredNote || 'No specific note attached.'}&rdquo;
                        </p>
                      </div>

                      {/* Original Report Reason & Messages count */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs text-stone-600">
                        <div className="truncate max-w-xl">
                          <span className="font-semibold text-stone-700">Original Reason: </span>
                          <span className="italic">&ldquo;{report.reason}&rdquo;</span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                            {report.reportedMessageIds.length} Flagged Message(s)
                          </span>
                          <span className="text-xs font-semibold text-[#315243] group-hover:translate-x-1 transition-transform flex items-center gap-1">
                            <span>Open Investigation</span>
                            <ChevronRight className="w-4 h-4" />
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (

          /* VIEW 2: OPENING A TRANSFERRED REPORT (Administrator view) */
          <div id="transferred-report-detail-view" className="space-y-6 animate-in fade-in">
            
            {/* Back to list & Quick Actions */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                id="back-to-transferred-reports-btn"
                onClick={() => {
                  setSelectedReport(null);
                  setShowReplyBox(false);
                  setReplyError(null);
                }}
                className="inline-flex items-center gap-2 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-white hover:bg-stone-50 border border-stone-300 px-3.5 py-2 rounded-2xl transition-all cursor-pointer shadow-2xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Transferred Reports</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="header-sanction-btn"
                  onClick={() => setIsSanctionModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-2xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Sanction</span>
                </button>

                <span className={`text-xs px-3 py-1 rounded-full font-semibold border ${
                  selectedReport.transferStatus === 'replied_by_admin'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}>
                  {selectedReport.transferStatus === 'replied_by_admin' ? '✓ Administrator Replied' : 'Pending Administrator Response'}
                </span>
              </div>
            </div>

            {/* Sanction Success Notice */}
            {sanctionSuccessNotice && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center justify-between shadow-xs animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="font-semibold">{sanctionSuccessNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSanctionSuccessNotice(null)}
                  className="text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* 1. PROMINENT TRANSFER BLOCK: WHICH HEAD TRANSFERRED IT & THEIR NOTE */}
            <div className="bg-amber-50/95 border-2 border-amber-300 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-200/80 text-amber-900 flex items-center justify-center font-bold text-base shadow-2xs">
                    {selectedReport.transferredByHeadName?.charAt(0) || 'H'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-stone-900">
                        Transferred by: {selectedReport.transferredByHeadName || 'Head of Listeners'}
                      </h3>
                      <span className="text-[10px] bg-amber-200 text-amber-950 px-2 py-0.5 rounded-full font-bold">
                        Head of Listeners
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-600 mt-0.5">
                      {selectedReport.transferredByHeadEmail || 'Supervisory Leadership'} &bull; Transferred on {selectedReport.transferredAt || 'Recently'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="action-sanction-btn"
                    onClick={() => setIsSanctionModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs bg-rose-700 hover:bg-rose-800 text-white"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Sanction</span>
                  </button>

                  <button
                    type="button"
                    id="action-reply-head-btn"
                    onClick={() => {
                      setShowReplyBox((prev) => !prev);
                      setReplyError(null);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 shadow-xs ${
                      showReplyBox
                        ? 'bg-[#253E33] text-white ring-2 ring-[#315243]/30'
                        : 'bg-[#315243] hover:bg-[#253E33] text-white'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Reply to Head of Listeners</span>
                  </button>
                </div>
              </div>

              {/* Head of Listeners' Note */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-800" />
                  <span>Head of Listeners Transfer Note:</span>
                </span>
                <div className="bg-white p-4 rounded-2xl border border-amber-200/80 text-xs sm:text-sm text-stone-900 leading-relaxed font-medium italic shadow-inner">
                  &ldquo;{selectedReport.transferredNote || 'No specific note provided.'}&rdquo;
                </div>
              </div>
            </div>

            {/* REPLY COMPOSER (when Reply to Head of Listeners is toggled) */}
            {showReplyBox && (
              <div 
                id="reply-to-head-composer"
                className="bg-white border-2 border-[#315243]/40 rounded-3xl p-5 sm:p-6 shadow-md space-y-4 animate-in fade-in"
              >
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-[#315243]" />
                    <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                      Compose Reply to {selectedReport.transferredByHeadName || 'Head of Listeners'}
                    </h3>
                  </div>
                  <span className="text-[11px] text-stone-500 bg-stone-100 px-2.5 py-0.5 rounded-full">
                    Delivered to Head of Listeners&apos; Mailbox
                  </span>
                </div>

                <div className="bg-[#FAF8F5] p-3 rounded-2xl border border-stone-200 text-xs text-stone-700">
                  <p>
                    Your official response will be routed directly into{' '}
                    <strong>{selectedReport.transferredByHeadName || 'the Head of Listeners'}</strong>&apos;s personal Mailbox, notifying them of the administrative resolution or next steps.
                  </p>
                </div>

                <textarea
                  id="admin-reply-content-textarea"
                  rows={4}
                  value={replyText}
                  onChange={(e) => {
                    setReplyText(e.target.value);
                    if (replyError) setReplyError(null);
                  }}
                  placeholder="Write your official response, findings, or directives to the Head of Listeners..."
                  className="w-full text-xs p-3.5 rounded-2xl border border-stone-300 focus:border-[#315243] focus:ring-2 focus:ring-[#315243]/20 outline-hidden bg-white text-stone-900 placeholder:text-stone-400 resize-none transition-all shadow-inner"
                />

                {replyError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{replyError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowReplyBox(false);
                      setReplyError(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    id="submit-reply-to-head-btn"
                    onClick={handleSendReplyToHead}
                    disabled={isSendingReply || !replyText.trim()}
                    className="px-4 py-2 bg-[#315243] hover:bg-[#253E33] disabled:bg-stone-300 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1.5 disabled:cursor-not-allowed"
                  >
                    {isSendingReply ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{isSendingReply ? 'Sending...' : 'Send Reply to Mailbox'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* PAST ADMIN REPLIES SECTION */}
            {selectedReport.adminReplies && selectedReport.adminReplies.length > 0 && (
              <div className="bg-white border border-[#E3DDD1] rounded-3xl p-5 sm:p-6 shadow-xs space-y-3">
                <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Administrative Reply Record ({selectedReport.adminReplies.length})</span>
                </h3>
                <div className="space-y-3">
                  {selectedReport.adminReplies.map((reply) => (
                    <div key={reply.id} className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-stone-900">
                          {reply.adminName} (Administrator)
                        </span>
                        <span className="text-[11px] text-stone-400 font-mono">
                          {reply.createdAt}
                        </span>
                      </div>
                      <p className="text-xs text-stone-700 whitespace-pre-wrap leading-relaxed">
                        {reply.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ADMINISTRATIVE SANCTIONS AUDIT RECORD */}
            {selectedReport.sanctions && selectedReport.sanctions.length > 0 && (
              <div id="applied-sanctions-record-card" className="bg-white border-2 border-rose-200/80 rounded-3xl p-5 sm:p-6 shadow-xs space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-rose-100 pb-3">
                  <h3 className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-700" />
                    <span>Administrative Sanctions Applied ({selectedReport.sanctions.length})</span>
                  </h3>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-semibold border border-rose-200">
                    Active Moderation Enforcement
                  </span>
                </div>

                <div className="space-y-3">
                  {selectedReport.sanctions.map((sanc) => (
                    <div
                      key={sanc.id}
                      className="p-4 rounded-2xl bg-rose-50/40 border border-rose-200/90 space-y-2 text-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              sanc.action === 'warning'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-rose-100 text-rose-900 border border-rose-300'
                            }`}
                          >
                            {sanc.action}
                          </span>
                          <span className="font-bold text-[#1E2E25]">Target: {sanc.targetName}</span>
                          {sanc.targetType === 'anonymous' ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 font-medium">
                              Anonymous Session
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                              Registered Account
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-stone-500 font-mono">
                          {sanc.sanctionedAt} &bull; by {sanc.sanctionedByAdminName}
                        </span>
                      </div>

                      {sanc.deliveryMethod && (
                        <div className="text-[11.5px] text-stone-600 flex items-center gap-1.5">
                          <span className="font-semibold text-stone-700">Enforcement:</span>
                          <span>
                            {sanc.deliveryMethod === 'mailbox'
                              ? 'Official warning delivered to private Mailbox'
                              : sanc.deliveryMethod === 'email'
                              ? `Account permanently banned & notice sent to ${sanc.targetEmail || 'registered email'}`
                              : 'Persistent device cookie and browser block applied (soft block)'}
                          </span>
                        </div>
                      )}

                      {sanc.customMessage && (
                        <div className="p-2.5 rounded-xl bg-white border border-rose-100 text-[11.5px] text-stone-800 italic leading-relaxed">
                          &ldquo;{sanc.customMessage}&rdquo;
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. WHO IS IN THE DISCUSSION */}
            <div className="bg-white border border-[#E3DDD1] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-stone-600" />
                  <span>Discussion Participants ({moderationParticipants.length})</span>
                </h3>
                <span className="text-[11px] text-stone-500 font-medium">
                  All parties listed below can be sanctioned via the Sanction action
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {moderationParticipants.map((p) => {
                  const isVisitor = p.participantType === 'visitor';
                  return (
                    <div 
                      key={p.id}
                      className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EAE3D7] flex items-start gap-3 hover:border-amber-200 transition-colors"
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        p.isAnonymous 
                          ? 'bg-stone-100 text-stone-600 border-stone-300' 
                          : isVisitor
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-blue-50 text-blue-800 border-blue-200'
                      }`}>
                        {p.isAnonymous ? (
                          <UserX className="w-4 h-4 text-stone-600" />
                        ) : isVisitor ? (
                          <User className="w-4 h-4 text-emerald-700" />
                        ) : (
                          <Users className="w-4 h-4 text-blue-700" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10.5px] font-semibold text-stone-500 uppercase tracking-wider block truncate">
                          {p.role}
                        </span>
                        <p className="text-xs font-bold text-stone-900 truncate">
                          {p.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            p.isAnonymous 
                              ? 'bg-stone-200/80 text-stone-700' 
                              : isVisitor
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-blue-100 text-blue-900'
                          }`}>
                            {p.isAnonymous ? 'Anonymous User' : (p.hasAccount ? 'Registered Account' : 'Session Participant')}
                          </span>
                          {p.email && (
                            <span className="text-[10px] text-stone-400 font-mono truncate max-w-[130px]">
                              {p.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. ORIGINAL REASON GIVEN */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white border border-[#E3DDD1] space-y-2 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-wider">
                <AlertCircle className="w-4 h-4 text-amber-700" />
                <span>Original Reason Filed in Report:</span>
              </div>
              <p className="text-xs sm:text-sm text-stone-900 font-medium leading-relaxed italic bg-[#FAF8F5] p-3.5 rounded-2xl border border-stone-200">
                &ldquo;{selectedReport.reason}&rdquo;
              </p>
            </div>

            {/* 4. FULL DISCUSSION WITH REPORTED MESSAGES VISUALLY MARKED */}
            <div className="bg-white border border-[#E3DDD1] rounded-3xl shadow-sm overflow-hidden">
              <div className="bg-[#315243] text-white px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold tracking-wide flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-300" />
                    <span>Full Discussion Transcript</span>
                  </h3>
                  <p className="text-[11px] text-emerald-100/80 mt-0.5">
                    Flagged messages are visually marked below with red borders and badges.
                  </p>
                </div>
                <span className="text-xs bg-white/20 px-3 py-1 rounded-full font-medium">
                  {fullDiscussionMessages.length} total messages
                </span>
              </div>

              {/* Conversation Messages Container */}
              <div className="p-5 sm:p-6 space-y-4 bg-[#FAF8F5] max-h-[640px] overflow-y-auto">
                {fullDiscussionMessages.length === 0 ? (
                  <div className="text-center py-10 text-xs text-stone-500">
                    No conversation messages found for this discussion.
                  </div>
                ) : (
                  fullDiscussionMessages.map((msg) => {
                    const isFlagged = selectedReport.reportedMessageIds.includes(msg.id);
                    const isUser = msg.sender === 'user';
                    const senderLabel = formatSenderLabel(msg);

                    return (
                      <div
                        key={msg.id}
                        id={`discussion-msg-${msg.id}`}
                        className={`relative transition-all ${
                          isFlagged
                            ? 'p-4 sm:p-5 rounded-2xl bg-rose-50/95 border-2 border-rose-500 shadow-md ring-4 ring-rose-200/50 my-3.5'
                            : 'p-3.5 rounded-2xl bg-white border border-stone-200'
                        }`}
                      >
                        {/* High-visibility badge on reported messages */}
                        {isFlagged && (
                          <div className="mb-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600 text-white text-[11px] font-bold shadow-xs">
                            <Flag className="w-3.5 h-3.5 fill-white" />
                            <span>REPORTED MESSAGE &bull; Flagged for safety investigation</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs text-stone-500 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold ${
                              isFlagged ? 'text-rose-900 font-bold' : (isUser ? 'text-stone-800' : 'text-[#264433]')
                            }`}>
                              {senderLabel}
                            </span>
                            <span className={`text-[10px] px-2 py-0.2 rounded-full font-medium ${
                              isUser 
                                ? (participants.isAnonymous ? 'bg-stone-100 text-stone-600' : 'bg-blue-50 text-blue-700')
                                : 'bg-[#EAF2ED] text-[#254233]'
                            }`}>
                              {isUser ? (participants.isAnonymous ? 'Anonymous' : 'Member') : 'Listener'}
                            </span>
                          </div>
                          <span className="text-[11px] text-stone-400 font-mono">
                            {msg.timestamp || 'Recorded'}
                          </span>
                        </div>

                        <p className={`text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                          isFlagged ? 'text-rose-950 font-medium' : 'text-stone-800'
                        }`}>
                          {msg.text}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        )}

        {/* Administrator Sanction Modal */}
        {selectedReport && (
          <AdminSanctionModal
            isOpen={isSanctionModalOpen}
            onClose={() => setIsSanctionModalOpen(false)}
            report={selectedReport}
            discussion={currentDiscussion}
            currentUser={currentUser}
            onSanctionApplied={(sanction) => {
              loadTransferredReports();
              setSanctionSuccessNotice(
                `Sanction (${sanction.action.toUpperCase()}) applied to ${sanction.targetName} successfully.`
              );
              setTimeout(() => {
                setSanctionSuccessNotice(null);
              }, 8000);
            }}
          />
        )}

      </div>
    </Navbar>
  );
};
