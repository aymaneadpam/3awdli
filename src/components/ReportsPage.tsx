import React, { useState, useEffect } from 'react';
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
  Info
} from 'lucide-react';
import { 
  DiscussionReport, 
  UserAccount, 
  DiscussionConversation, 
  ChatMessage 
} from '../types';
import { 
  getStoredReports, 
  replyToDiscussionReport,
  transferReportToAdministrator,
  getPendingReportsCount 
} from '../utils/reportManagement';
import { getStoredDiscussions } from '../utils/discussionManagement';
import { isAdministrator } from '../utils/userManagement';
import { createSupportRequest } from '../utils/supportRequests';
import { Navbar } from './Navbar';

interface ReportsPageProps {
  currentUser: UserAccount;
  onNavigateHome: () => void;
  onNavigateDashboard?: () => void;
  onNavigateDiscussions?: (tab?: 'unopened' | 'mailbox' | 'my-conversations' | 'history') => void;
  onNavigateAdmin?: () => void;
  onNavigateAdminReports?: () => void;
  onNavigateMemberManagement?: () => void;
  onNavigateGames?: () => void;
  onNavigateTeenSpace?: () => void;
  onNavigateLounge?: () => void;
  onNavigateRules?: () => void;
  onNavigateMailbox?: () => void;
  onOpenEmergencyModal?: () => void;
  onOpenContactSupport?: () => void;
  onTalkAnonymously?: () => void;
  onSignOut?: () => void;
  initialReportId?: string | null;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  currentUser,
  onNavigateHome,
  onNavigateDashboard,
  onNavigateDiscussions,
  onNavigateAdmin,
  onNavigateAdminReports,
  onNavigateMemberManagement,
  onNavigateGames,
  onNavigateTeenSpace,
  onNavigateLounge,
  onNavigateRules,
  onNavigateMailbox,
  onOpenEmergencyModal,
  onOpenContactSupport,
  onTalkAnonymously,
  onSignOut,
  initialReportId,
}) => {
  const [reports, setReports] = useState<DiscussionReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<DiscussionReport | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'replied'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Reply form state
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replySuccessMsg, setReplySuccessMsg] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Transfer to Administrator state
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferNote, setTransferNote] = useState('');
  const [transferError, setTransferError] = useState<string | null>(null);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [transferSuccessNotice, setTransferSuccessNotice] = useState<string | null>(null);

  const isHead = Boolean(currentUser?.is_head_of_listeners) || (currentUser as any)?.role === 'head_of_listeners';

  const loadReports = () => {
    const list = getStoredReports();
    setReports(list);
    if (selectedReport) {
      const updated = list.find((r) => r.id === selectedReport.id);
      if (updated) setSelectedReport(updated);
    }
  };

  useEffect(() => {
    loadReports();

    const handleUpdate = () => {
      loadReports();
    };

    window.addEventListener('3awdli_report_updated', handleUpdate);
    window.addEventListener('3awdli_report_created', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('3awdli_report_updated', handleUpdate);
      window.removeEventListener('3awdli_report_created', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Handle initialReportId if supplied
  useEffect(() => {
    if (initialReportId && reports.length > 0) {
      const match = reports.find((r) => r.id === initialReportId);
      if (match) {
        setSelectedReport(match);
      }
    }
  }, [initialReportId, reports]);

  const filteredReports = reports.filter((r) => {
    if (filter === 'pending' && r.status !== 'pending') return false;
    if (filter === 'replied' && r.status !== 'replied') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchReporter = r.reporterName.toLowerCase().includes(q) || (r.reporterEmail && r.reporterEmail.toLowerCase().includes(q));
      const matchReason = r.reason.toLowerCase().includes(q);
      const matchTitle = (r.discussionTitle || '').toLowerCase().includes(q);
      return matchReporter || matchReason || matchTitle;
    }
    return true;
  });

  const pendingCount = reports.filter((r) => r.status === 'pending').length;
  const repliedCount = reports.filter((r) => r.status === 'replied').length;

  // Retrieve the full discussion for the selected report
  const currentDiscussion: DiscussionConversation | undefined = selectedReport 
    ? getStoredDiscussions().find((d) => d.id === selectedReport.discussionId)
    : undefined;

  // Compile all messages: prefer the live discussion messages, fallback to snapshot
  const fullDiscussionMessages: ChatMessage[] = currentDiscussion?.messages && currentDiscussion.messages.length > 0
    ? currentDiscussion.messages
    : (selectedReport?.reportedMessages || []);

  const handleSendReply = () => {
    if (!selectedReport) return;
    if (!replyText.trim()) {
      setReplyError('Please write a reply before submitting.');
      return;
    }

    setIsSendingReply(true);
    setReplyError(null);
    setReplySuccessMsg(null);

    try {
      const result = replyToDiscussionReport(selectedReport.id, replyText.trim(), currentUser);
      if (result.success && result.report) {
        setSelectedReport(result.report);
        const destination = selectedReport.reporterRole === 'listener' ? "Reporter's Listener Mailbox" : "Reporter's User Mailbox";
        setReplySuccessMsg(`Official response delivered to ${selectedReport.reporterName}'s ${destination}.`);
        setReplyText('');
        loadReports();
      } else {
        setReplyError('Failed to send reply. Please try again.');
      }
    } catch (err) {
      setReplyError('An unexpected error occurred while sending the reply.');
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleTransferToAdminClick = () => {
    setTransferNote('');
    setTransferError(null);
    setIsTransferModalOpen(true);
  };

  const handleConfirmTransfer = () => {
    if (!selectedReport) return;
    if (!transferNote.trim()) {
      setTransferError('Please provide a short note/description explaining why you are transferring this report to Administrators.');
      return;
    }

    setIsSubmittingTransfer(true);
    setTransferError(null);

    try {
      const res = transferReportToAdministrator({
        reportId: selectedReport.id,
        transferNote: transferNote.trim(),
        headUser: currentUser,
      });

      if (res.success && res.report) {
        setSelectedReport(res.report);
        setIsTransferModalOpen(false);
        setTransferNote('');
        setTransferSuccessNotice(`Report #${selectedReport.id.slice(-6)} has been officially transferred to Administrator review with your note.`);
        loadReports();
        setTimeout(() => {
          setTransferSuccessNotice(null);
        }, 7000);
      } else {
        setTransferError(res.error || 'Failed to transfer report. Please try again.');
      }
    } catch (err) {
      setTransferError('An unexpected error occurred while transferring the report.');
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  // Determine participant info safely respecting anonymity rules
  const getDiscussionParticipants = () => {
    if (!selectedReport) return { visitorName: 'Anonymous User', isAnonymous: true, listenerName: 'Unassigned', joinedListener: null };
    
    const isAnonymous = currentDiscussion?.type === 'anonymous' || 
      selectedReport.discussionType === 'anonymous' || 
      currentDiscussion?.userId === 'anon_portal_visitor' ||
      !currentDiscussion?.userName ||
      currentDiscussion?.userName.toLowerCase().includes('anon');

    const visitorName = isAnonymous 
      ? 'Anonymous User' 
      : (currentDiscussion?.userName || (selectedReport.reporterRole !== 'listener' ? selectedReport.reporterName : 'Registered User'));

    const listenerName = currentDiscussion?.openedByListenerName || (currentDiscussion as any)?.listenerName || 'Assigned Listener';
    const joinedListener = currentDiscussion?.joinedListenerName || null;

    return {
      visitorName,
      isAnonymous,
      listenerName,
      joinedListener,
    };
  };

  const participants = getDiscussionParticipants();

  // Helper to format sender label in message thread respecting anonymity
  const formatSenderLabel = (msg: ChatMessage) => {
    if (msg.sender === 'user') {
      if (participants.isAnonymous) {
        return 'Anonymous User';
      }
      return currentDiscussion?.userName || (selectedReport?.reporterRole !== 'listener' ? selectedReport?.reporterName : 'User');
    }
    return msg.senderName || currentDiscussion?.openedByListenerName || (currentDiscussion as any)?.listenerName || 'Listener';
  };

  return (
    <Navbar
      currentView="reports"
      currentUser={currentUser}
      onNavigateHome={onNavigateHome}
      onNavigateDashboard={onNavigateDashboard}
      onNavigateDiscussions={onNavigateDiscussions}
      onNavigateAdmin={isAdministrator(currentUser) ? onNavigateAdmin : undefined}
      onNavigateAdminReports={onNavigateAdminReports}
      onNavigateMemberManagement={isAdministrator(currentUser) ? onNavigateMemberManagement : undefined}
      onNavigateGames={onNavigateGames}
      onNavigateTeenSpace={onNavigateTeenSpace}
      onNavigateLounge={onNavigateLounge}
      onNavigateRules={onNavigateRules}
      onNavigateMailbox={onNavigateMailbox}
      onNavigateReports={() => {
        setSelectedReport(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
      onOpenEmergencyModal={onOpenEmergencyModal}
      onOpenContactSupport={onOpenContactSupport}
      onTalkAnonymously={onTalkAnonymously}
      onSignOut={onSignOut}
    >
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        
        {/* Access check notice if non-head */}
        {!isHead && !isAdministrator(currentUser) && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-700 shrink-0" />
            <span>This dedicated moderation space is reserved for Head of Listeners and Supervisory team accounts.</span>
          </div>
        )}

        {!selectedReport ? (
          /* ========================================================================= */
          /* VIEW A: REPORTS LIST (All submitted reports from users and listeners)      */
          /* ========================================================================= */
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-white border border-[#E3DDD1] rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center font-bold shrink-0 shadow-2xs">
                  <ShieldAlert className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-bold text-[#1E2E25] font-['Lora',serif] tracking-tight">
                      Reports
                    </h1>
                    <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      Head of Listeners
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#5D6F64] mt-1.5 leading-relaxed max-w-2xl">
                    Dedicated supervisory moderation ledger. Review reported discussions submitted by users or peer listeners, investigate flagged messages, and deliver official responses to reporter mailboxes.
                  </p>
                </div>
              </div>

              {/* Statistics Counters */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0 self-start md:self-auto w-full md:w-auto">
                <div className="bg-[#FAF8F5] border border-[#DDD7CB] rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 text-center flex-1 sm:flex-initial min-w-[75px] sm:min-w-[95px]">
                  <span className="block text-sm font-bold text-rose-700">{pendingCount}</span>
                  <span className="text-[10px] sm:text-[11px] font-medium text-stone-500 whitespace-nowrap">Pending</span>
                </div>
                <div className="bg-[#FAF8F5] border border-[#DDD7CB] rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 text-center flex-1 sm:flex-initial min-w-[75px] sm:min-w-[95px]">
                  <span className="block text-sm font-bold text-emerald-700">{repliedCount}</span>
                  <span className="text-[10px] sm:text-[11px] font-medium text-stone-500 whitespace-nowrap">Replied</span>
                </div>
                <div className="bg-[#FAF8F5] border border-[#DDD7CB] rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 text-center flex-1 sm:flex-initial min-w-[75px] sm:min-w-[95px]">
                  <span className="block text-sm font-bold text-[#2A4736]">{reports.length}</span>
                  <span className="text-[10px] sm:text-[11px] font-medium text-stone-500 whitespace-nowrap">Total Reports</span>
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 p-1 bg-[#F2ECE3] rounded-2xl border border-[#E3DCD0] overflow-x-auto">
                <button
                  id="filter-reports-all"
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    filter === 'all'
                      ? 'bg-white text-[#21382C] shadow-2xs'
                      : 'text-[#5A6E62] hover:text-[#21382C]'
                  }`}
                >
                  All Reports ({reports.length})
                </button>
                <button
                  id="filter-reports-pending"
                  onClick={() => setFilter('pending')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    filter === 'pending'
                      ? 'bg-white text-rose-800 shadow-2xs font-bold'
                      : 'text-[#5A6E62] hover:text-[#21382C]'
                  }`}
                >
                  <span>Pending Review</span>
                  {pendingCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                  )}
                </button>
                <button
                  id="filter-reports-replied"
                  onClick={() => setFilter('replied')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    filter === 'replied'
                      ? 'bg-white text-emerald-800 shadow-2xs'
                      : 'text-[#5A6E62] hover:text-[#21382C]'
                  }`}
                >
                  Replied ({repliedCount})
                </button>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by title, reporter, or reason..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-[#DDD6C8] rounded-2xl pl-10 pr-4 py-2 text-xs text-stone-800 placeholder-stone-400 outline-none focus:border-[#315243] focus:ring-1 focus:ring-[#315243]"
                />
              </div>
            </div>

            {/* Reports List Cards */}
            {filteredReports.length === 0 ? (
              <div className="text-center py-16 bg-white border border-[#E3DDD1] rounded-3xl p-8 shadow-xs">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto mb-3.5">
                  <CheckCircle2 className="w-7 h-7 text-emerald-700" />
                </div>
                <h3 className="text-base font-bold text-stone-800 font-['Lora',serif]">
                  No reports in this view
                </h3>
                <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto leading-relaxed">
                  {filter === 'pending'
                    ? 'All reports submitted by users and listeners have been resolved or replied to.'
                    : 'No discussion reports matching your filter or search query.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredReports.map((report) => {
                  const isPending = report.status === 'pending';
                  const isListenerReporter = report.reporterRole === 'listener';
                  const isAnonReporter = report.reporterRole === 'anonymous_user' || report.reporterName.toLowerCase().includes('anon');

                  return (
                    <div
                      key={report.id}
                      id={`report-row-${report.id}`}
                      className={`bg-white border rounded-3xl p-5 sm:p-6 shadow-xs transition-all hover:shadow-md ${
                        isPending ? 'border-rose-200 ring-1 ring-rose-100/80' : 'border-[#E3DDD1]'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3.5">
                        <div className="flex items-start gap-3.5">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold shrink-0 ${
                            isPending ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isPending ? <Flag className="w-5 h-5 text-rose-600" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-bold text-stone-900 font-['Lora',serif]">
                                {report.discussionTitle || `Discussion #${report.discussionId.slice(-6)}`}
                              </h3>
                              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                isPending
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}>
                                {isPending ? 'Pending Review' : 'Replied'}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 text-stone-700">
                                {report.reportedMessageIds.length} flagged message(s)
                              </span>
                              {isListenerReporter && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#EAF2ED] text-[#244233] border border-[#D2E2D8]">
                                  Submitted by Listener
                                </span>
                              )}
                              {!isListenerReporter && !isAnonReporter && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                                  Submitted by User
                                </span>
                              )}
                              {isAnonReporter && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                                  Submitted Anonymously
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-stone-500 mt-1.5 flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-stone-700">Reported by:</span>
                              <span className="font-medium text-stone-900">
                                {isAnonReporter ? 'Anonymous User' : report.reporterName}
                              </span>
                              {!isAnonReporter && report.reporterEmail && (
                                <span className="text-stone-400">({report.reporterEmail})</span>
                              )}
                              <span className="text-stone-300">&bull;</span>
                              <span className="flex items-center gap-1 text-[11px] text-stone-400">
                                <Clock className="w-3 h-3" />
                                {report.createdAt}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          id={`open-report-btn-${report.id}`}
                          onClick={() => {
                            setSelectedReport(report);
                            setShowReplyBox(false);
                            setReplySuccessMsg(null);
                            setReplyError(null);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="px-4 py-2.5 bg-[#315243] hover:bg-[#233C30] text-white text-xs font-semibold rounded-2xl transition-all cursor-pointer shrink-0 shadow-2xs flex items-center justify-center gap-2"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Open Report</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Reason preview */}
                      <div className="mt-3 p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EBE4D8] text-xs text-stone-700">
                        <div className="font-semibold text-stone-900 mb-1 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          <span>Report Reason:</span>
                        </div>
                        <p className="italic text-stone-800 leading-relaxed pl-1">
                          &ldquo;{report.reason}&rdquo;
                        </p>
                      </div>

                      {/* Last Reply Info */}
                      {report.status === 'replied' && report.lastRepliedAt && (
                        <div className="mt-2.5 text-[11.5px] text-emerald-800 font-medium flex items-center gap-1.5 px-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Official response delivered to reporter&apos;s mailbox on {report.lastRepliedAt}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ========================================================================= */
          /* VIEW B: OPENED REPORT DETAILS                                             */
          /* ========================================================================= */
          <div className="space-y-6">
            {/* Top Navigation & Status Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#E3DDD1] rounded-3xl p-4 sm:p-5 shadow-xs">
              <button
                id="back-to-reports-list-btn"
                onClick={() => {
                  setSelectedReport(null);
                  setShowReplyBox(false);
                  setReplySuccessMsg(null);
                  setReplyError(null);
                  loadReports();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-700 hover:text-stone-900 hover:bg-[#F2ECE3] transition-colors flex items-center gap-2 cursor-pointer self-start sm:self-auto"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Reports List</span>
              </button>

              <div className="flex items-center gap-2.5">
                <span className="text-xs text-stone-500 font-mono hidden sm:inline">
                  Report #{selectedReport.id.slice(-8)}
                </span>
                <span className={`px-3.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                  selectedReport.status === 'pending'
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}>
                  {selectedReport.status === 'pending' ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Pending Review</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Replied</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Notification notices */}
            {transferSuccessNotice && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-medium text-amber-900 flex items-center gap-2.5 animate-in fade-in">
                <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                <span>{transferSuccessNotice}</span>
              </div>
            )}

            {replySuccessMsg && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900 flex items-center gap-2.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{replySuccessMsg}</span>
              </div>
            )}

            {/* 1. WHO IS IN THAT DISCUSSION (PARTICIPANTS CARD) */}
            <div className="bg-white border border-[#E3DDD1] rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#EAE3D7] pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#315243]" />
                  <h2 className="text-sm font-bold text-stone-900 font-['Lora',serif]">
                    Who is in this discussion
                  </h2>
                </div>
                <span className="text-[11.5px] text-stone-400">
                  Discussion #{selectedReport.discussionId.slice(-6)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {/* Person 1: User / Visitor */}
                <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EAE3D7] flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    participants.isAnonymous ? 'bg-stone-200 text-stone-700' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {participants.isAnonymous ? <UserX className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10.5px] font-semibold text-stone-500 uppercase tracking-wider block">
                      Visitor / Member
                    </span>
                    <p className="text-xs font-bold text-stone-900 truncate">
                      {participants.visitorName}
                    </p>
                    <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      participants.isAnonymous 
                        ? 'bg-stone-200 text-stone-700' 
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}>
                      {participants.isAnonymous ? 'Anonymous User' : 'Registered Member'}
                    </span>
                  </div>
                </div>

                {/* Person 2: Assigned Primary Listener */}
                <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EAE3D7] flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#EAF2ED] text-[#274635] flex items-center justify-center shrink-0 border border-[#D2E2D8]">
                    <User className="w-4 h-4 text-[#315243]" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10.5px] font-semibold text-stone-500 uppercase tracking-wider block">
                      Assigned Listener
                    </span>
                    <p className="text-xs font-bold text-stone-900 truncate">
                      {participants.listenerName}
                    </p>
                    <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-[#EAF2ED] text-[#244334] border border-[#D2E2D8]">
                      Peer Listener
                    </span>
                  </div>
                </div>

                {/* Person 3: Joined Listener (if any) or Discussion Context */}
                <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EAE3D7] flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-800 flex items-center justify-center shrink-0 border border-purple-200">
                    <Users className="w-4 h-4 text-purple-700" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10.5px] font-semibold text-stone-500 uppercase tracking-wider block">
                      {participants.joinedListener ? 'Joined Co-Listener' : 'Report Filed By'}
                    </span>
                    <p className="text-xs font-bold text-stone-900 truncate">
                      {participants.joinedListener || selectedReport.reporterName}
                    </p>
                    <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                      {participants.joinedListener 
                        ? 'Secondary Listener' 
                        : (selectedReport.reporterRole === 'listener' ? 'Listener Reporter' : (participants.isAnonymous ? 'Anonymous Reporter' : 'Member Reporter'))}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. REASON GIVEN FOR THE REPORT */}
            <div className="p-5 sm:p-6 rounded-3xl bg-amber-50/90 border border-amber-200 space-y-2 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
                <AlertCircle className="w-4 h-4 text-amber-700" />
                <span>Reason Given for the Report:</span>
              </div>
              <p className="text-sm sm:text-base text-stone-900 font-medium leading-relaxed italic bg-white/85 p-4 rounded-2xl border border-amber-200/80">
                &ldquo;{selectedReport.reason}&rdquo;
              </p>
              <div className="text-xs text-amber-900/80 font-medium flex items-center gap-1.5 pt-1">
                <Flag className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>
                  The reporter specifically flagged <strong>{selectedReport.reportedMessageIds.length}</strong> message(s) in the conversation below.
                </span>
              </div>
            </div>

            {/* 3. THE TWO REQUIRED ACTIONS ON A REPORT */}
            <div className="bg-white border border-[#E3DDD1] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
              <div>
                <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Report Actions
                </h3>
                <p className="text-xs text-stone-600 mt-0.5">
                  Take supervisory action on this reported conversation:
                </p>
              </div>

              {/* Transferred to Admin Notice if already transferred */}
              {selectedReport.isTransferredToAdmin && (
                <div id="transferred-report-head-callout" className="p-4 rounded-2xl bg-amber-50/90 border border-amber-300/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                      <ShieldAlert className="w-4 h-4 text-amber-700" />
                      <span>Transferred to Administrator Leadership</span>
                    </div>
                    <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                      selectedReport.transferStatus === 'replied_by_admin'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-200/80 text-amber-900 border border-amber-300'
                    }`}>
                      {selectedReport.transferStatus === 'replied_by_admin' ? 'Admin Replied' : 'Pending Admin Review'}
                    </span>
                  </div>
                  <p className="text-xs text-stone-700">
                    Transferred on <span className="font-semibold">{selectedReport.transferredAt}</span> by{' '}
                    <span className="font-semibold">{selectedReport.transferredByHeadName || 'Head of Listeners'}</span>
                  </p>
                  <div className="bg-white/90 p-3 rounded-xl border border-amber-200 text-xs text-stone-800 italic">
                    &ldquo;{selectedReport.transferredNote}&rdquo;
                  </div>
                  {selectedReport.adminReplies && selectedReport.adminReplies.length > 0 && (
                    <div className="text-[11px] text-emerald-800 font-medium flex items-center gap-1.5 pt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Administrator response received in your Mailbox.</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                {/* ACTION 1: Reply to Reporter */}
                <button
                  id="action-reply-to-reporter-btn"
                  onClick={() => {
                    setShowReplyBox((prev) => !prev);
                    setReplyError(null);
                  }}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 shadow-2xs ${
                    showReplyBox
                      ? 'bg-[#264134] text-white ring-2 ring-[#315243]/30'
                      : 'bg-[#315243] hover:bg-[#264134] text-white'
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  <span>Reply to Reporter</span>
                </button>

                {/* ACTION 2: Transfer to Administrator */}
                <button
                  id="action-transfer-to-admin-btn"
                  onClick={handleTransferToAdminClick}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 shadow-2xs ${
                    selectedReport.isTransferredToAdmin
                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                      : 'bg-[#FAF8F5] hover:bg-[#F2ECE3] text-stone-800 border border-[#DBD2C3]'
                  }`}
                >
                  <ShieldCheck className={`w-4 h-4 ${selectedReport.isTransferredToAdmin ? 'text-amber-800' : 'text-[#315243]'}`} />
                  <span>
                    {selectedReport.isTransferredToAdmin ? 'Transferred to Administrator (Update Note)' : 'Transfer to Administrator'}
                  </span>
                </button>
              </div>

              {/* REPLY FORM (Opens when "Reply to Reporter" is active) */}
              {showReplyBox && (
                <div 
                  id="reply-to-reporter-box"
                  className="mt-4 pt-4 border-t border-[#EAE3D7] space-y-3.5 animate-in fade-in"
                >
                  <div className="bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#EAE3D7] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-stone-700">
                      <Send className="w-3.5 h-3.5 text-[#315243]" />
                      <span>
                        Response will be delivered to: <strong>{selectedReport.reporterName}</strong>&apos;s{' '}
                        <span className="font-semibold text-[#274534]">
                          {selectedReport.reporterRole === 'listener' ? 'Listener Mailbox' : 'User Mailbox'}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Reply Error Banner */}
                  {replyError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>{replyError}</span>
                    </div>
                  )}

                  {/* Textarea */}
                  <div className="space-y-1.5">
                    <textarea
                      id="head-reporter-reply-textarea"
                      rows={4}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write your response to the reporter here. This message will be delivered directly to their Mailbox..."
                      className="w-full text-xs sm:text-sm p-3.5 rounded-2xl border border-stone-300 focus:border-[#315243] focus:ring-2 focus:ring-[#315243]/20 outline-none text-stone-900 placeholder:text-stone-400 bg-white"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-stone-500 flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-stone-400" />
                      <span>Delivered securely to reporter&apos;s mailbox</span>
                    </span>

                    <button
                      type="button"
                      id="submit-reply-to-reporter-btn"
                      onClick={handleSendReply}
                      disabled={isSendingReply || !replyText.trim()}
                      className={`px-5 py-2.5 text-xs font-semibold rounded-2xl transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
                        replyText.trim() && !isSendingReply
                          ? 'bg-[#315243] text-white hover:bg-[#253E33]'
                          : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSendingReply ? 'Sending Reply...' : 'Send Reply to Mailbox'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* History of Previous Replies */}
              {selectedReport.replies && selectedReport.replies.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[#EAE3D7] space-y-3">
                  <h4 className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Previous Replies Delivered to Reporter:</span>
                  </h4>
                  <div className="space-y-2.5">
                    {selectedReport.replies.map((reply) => (
                      <div key={reply.id} className="bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#EAE3D7] space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-stone-500">
                          <span className="font-semibold text-[#274635]">
                            {reply.responderName} ({reply.responderRole})
                          </span>
                          <span>{reply.createdAt}</span>
                        </div>
                        <p className="text-xs text-stone-800 leading-relaxed whitespace-pre-wrap">
                          {reply.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 4. FULL DISCUSSION WITH SPECIFICALLY REPORTED MESSAGES VISUALLY MARKED */}
            <div className="bg-white border border-[#E3DDD1] rounded-3xl shadow-sm overflow-hidden">
              <div className="bg-[#315243] text-white px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold tracking-wide flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-300" />
                    <span>Full Discussion History</span>
                  </h3>
                  <p className="text-[11px] text-emerald-100/80 mt-0.5">
                    Reported messages are visually marked below with colored borders and highlighted backgrounds.
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
                            <span>REPORTED MESSAGE &bull; Flagged in this report</span>
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
                              {isUser ? (participants.isAnonymous ? 'Anonymous' : 'User') : 'Listener'}
                            </span>
                          </div>
                          <span className="text-[11px] text-stone-400 font-mono">
                            {msg.timestamp || 'Recorded'}
                          </span>
                        </div>

                        <p className={`text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                          isFlagged ? 'text-stone-900 font-medium' : 'text-stone-800'
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

        {/* Transfer to Administrator Confirmation Modal */}
        {isTransferModalOpen && selectedReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs">
            <div 
              id="transfer-to-admin-modal"
              className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-[#E3DDD1] space-y-4 animate-in fade-in zoom-in-95"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900 font-['Lora',serif]">
                    Transfer to Administrator
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Escalate case #{selectedReport.id.slice(-6)} to executive administrative review.
                  </p>
                </div>
              </div>

              {/* Case Context Summary */}
              <div className="bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#EBE4D8] text-xs text-stone-700 space-y-1.5">
                <div className="flex items-center justify-between font-semibold text-stone-900">
                  <span>Reported Reason:</span>
                  <span className="text-[11px] text-stone-500 font-normal">
                    {selectedReport.reportedMessageIds.length} message(s) flagged
                  </span>
                </div>
                <p className="italic text-stone-600 bg-white p-2.5 rounded-xl border border-stone-200">
                  &ldquo;{selectedReport.reason}&rdquo;
                </p>
                <div className="text-[11px] text-stone-500 pt-0.5 flex items-center justify-between">
                  <span>Discussion: {selectedReport.discussionTitle || selectedReport.discussionId}</span>
                  <span>Reporter: {selectedReport.reporterName}</span>
                </div>
              </div>

              {/* Mandatory Transfer Note / Description */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="transfer-report-note" className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <span>Explanation Note for Administrators</span>
                    <span className="text-rose-600">*</span>
                  </label>
                  <span className="text-[10px] text-stone-400">Required</span>
                </div>

                <p className="text-[11px] text-stone-500 leading-relaxed">
                  Explain why you are transferring this report to Administrator oversight (e.g., policy breach, pattern of harassment, request for sanction review).
                </p>

                <textarea
                  id="transfer-report-note"
                  rows={3}
                  value={transferNote}
                  onChange={(e) => {
                    setTransferNote(e.target.value);
                    if (transferError) setTransferError(null);
                  }}
                  placeholder="e.g., Escalating due to repeated harassment and deliberate rule circumvention. Please review and consider administrative sanctions."
                  className="w-full text-xs p-3.5 rounded-2xl border border-[#D5CDC0] focus:border-[#315243] focus:ring-2 focus:ring-[#315243]/20 outline-hidden bg-white text-stone-900 placeholder:text-stone-400 resize-none transition-all shadow-inner"
                />

                {transferError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{transferError}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsTransferModalOpen(false);
                    setTransferError(null);
                  }}
                  disabled={isSubmittingTransfer}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="confirm-transfer-to-admin-btn"
                  onClick={handleConfirmTransfer}
                  disabled={isSubmittingTransfer || !transferNote.trim()}
                  className="px-4 py-2.5 bg-[#315243] hover:bg-[#253E33] disabled:bg-stone-300 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1.5 disabled:cursor-not-allowed"
                >
                  {isSubmittingTransfer ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  )}
                  <span>{isSubmittingTransfer ? 'Transferring...' : 'Submit & Transfer to Administrator'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </Navbar>
  );
};
