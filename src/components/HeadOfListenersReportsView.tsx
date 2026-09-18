import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Flag, 
  CheckCircle2, 
  Clock, 
  User, 
  MessageSquare, 
  ArrowLeft, 
  Send, 
  AlertTriangle, 
  Search, 
  Mail, 
  Sparkles, 
  Lock,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { DiscussionReport, UserAccount, DiscussionConversation, ChatMessage } from '../types';
import { getStoredReports, replyToDiscussionReport } from '../utils/reportManagement';
import { getStoredDiscussions } from '../utils/discussionManagement';

interface HeadOfListenersReportsViewProps {
  currentUser: UserAccount;
  onOpenDiscussion?: (discussionId: string) => void;
  className?: string;
}

export const HeadOfListenersReportsView: React.FC<HeadOfListenersReportsViewProps> = ({
  currentUser,
  className = '',
}) => {
  const [reports, setReports] = useState<DiscussionReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<DiscussionReport | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'replied'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Reply form state
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replySuccessMsg, setReplySuccessMsg] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);

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
      const res = replyToDiscussionReport(selectedReport.id, replyText, currentUser);
      if (res.success && res.report) {
        setSelectedReport(res.report);
        setReplyText('');
        setReplySuccessMsg('Reply has been delivered directly to the reporting user\'s Mailbox.');
        loadReports();
      } else {
        setReplyError(res.error || 'Failed to send reply.');
      }
    } catch (err) {
      console.error('Error sending reply to report:', err);
      setReplyError('An unexpected error occurred while sending the reply.');
    } finally {
      setIsSendingReply(false);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* ------------------------------------------------------------- */}
      {/* VIEW A: REPORTS LIST                                          */}
      {/* ------------------------------------------------------------- */}
      {!selectedReport ? (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-[#FAF7F2] border border-[#E5DFD5] rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center font-bold shadow-2xs">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-[#1E2E25] font-['Lora',serif]">
                    Discussion Reports &amp; Moderation
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                    Head of Listeners Only
                  </span>
                </div>
                <p className="text-xs text-[#5D6F64] mt-1 leading-relaxed">
                  Review reported conversations, investigate flagged messages, and send official supervisor responses to user mailboxes.
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="bg-white border border-[#DDD7CB] rounded-2xl px-3.5 py-2 text-center min-w-[85px]">
                <span className="block text-xs font-bold text-rose-700">{pendingCount}</span>
                <span className="text-[10.5px] text-stone-500">Pending</span>
              </div>
              <div className="bg-white border border-[#DDD7CB] rounded-2xl px-3.5 py-2 text-center min-w-[85px]">
                <span className="block text-xs font-bold text-emerald-700">{repliedCount}</span>
                <span className="text-[10.5px] text-stone-500">Replied</span>
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-[#F2ECE3] rounded-2xl border border-[#E3DCD0] w-full sm:w-auto">
              <button
                id="filter-reports-all"
                onClick={() => setFilter('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
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
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
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
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  filter === 'replied'
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'text-[#5A6E62] hover:text-[#21382C]'
                }`}
              >
                Replied ({repliedCount})
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search reporter or reason..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-[#DDD6C8] rounded-xl pl-9 pr-3 py-1.5 text-xs text-stone-800 placeholder-stone-400 outline-none focus:border-[#315243]"
              />
            </div>
          </div>

          {/* Reports Grid / Cards */}
          {filteredReports.length === 0 ? (
            <div className="text-center py-16 bg-white border border-[#E3DDD1] rounded-3xl p-8 shadow-xs">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-700" />
              </div>
              <h4 className="text-sm font-bold text-stone-800 font-['Lora',serif]">
                No reports matching this view
              </h4>
              <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                {filter === 'pending'
                  ? 'All submitted reports have been reviewed and replied to.'
                  : 'No discussion reports currently on file.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredReports.map((report) => {
                const isPending = report.status === 'pending';
                return (
                  <div
                    key={report.id}
                    id={`report-card-${report.id}`}
                    className={`bg-white border rounded-3xl p-5 shadow-xs transition-all hover:shadow-md ${
                      isPending ? 'border-rose-200 ring-1 ring-rose-100' : 'border-[#E3DDD1]'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shrink-0 ${
                          isPending ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isPending ? <Flag className="w-5 h-5 text-rose-600" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-stone-900 font-['Lora',serif]">
                              {report.discussionTitle || `Discussion #${report.discussionId}`}
                            </h4>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
                              isPending
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}>
                              {isPending ? 'Pending Review' : 'Replied'}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-stone-100 text-stone-600">
                              {report.reportedMessageIds.length} flagged message(s)
                            </span>
                          </div>

                          <p className="text-xs text-stone-500 mt-1 flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-stone-700">Reported by:</span>
                            <span>{report.reporterName}</span>
                            {report.reporterEmail && (
                              <span className="text-stone-400">({report.reporterEmail})</span>
                            )}
                            <span className="text-stone-300">&bull;</span>
                            <span className="flex items-center gap-1 text-[11px] text-stone-400">
                              <Clock className="w-3 h-3" />
                              {report.createdAt}
                            </span>
                          </p>
                        </div>
                      </div>

                      <button
                        id={`open-report-btn-${report.id}`}
                        onClick={() => {
                          setSelectedReport(report);
                          setReplySuccessMsg(null);
                          setReplyError(null);
                        }}
                        className="px-4 py-2 bg-[#315243] hover:bg-[#233C30] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shrink-0 shadow-2xs flex items-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Review Report &amp; Discussion</span>
                      </button>
                    </div>

                    {/* Reported Reason preview */}
                    <div className="mt-3 p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EBE4D8] text-xs text-stone-700">
                      <div className="font-semibold text-stone-900 mb-1 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Reason provided by user:</span>
                      </div>
                      <p className="italic text-stone-800 leading-relaxed pl-1">
                        &ldquo;{report.reason}&rdquo;
                      </p>
                    </div>

                    {/* Last Reply Info if already replied */}
                    {report.status === 'replied' && report.lastRepliedAt && (
                      <div className="mt-2 text-[11px] text-emerald-800 font-medium flex items-center gap-1.5 px-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Replied by {report.lastRepliedByName || 'Head of Listeners'} on {report.lastRepliedAt}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ------------------------------------------------------------- */
        /* VIEW B: OPENED REPORT DETAILS WITH HIGHLIGHTED MESSAGES        */
        /* ------------------------------------------------------------- */
        <div className="space-y-6">
          {/* Top navigation back bar */}
          <div className="flex items-center justify-between bg-white border border-[#E3DDD1] rounded-2xl p-4 shadow-xs">
            <button
              id="back-to-reports-list-btn"
              onClick={() => {
                setSelectedReport(null);
                setReplySuccessMsg(null);
                setReplyError(null);
                loadReports();
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-stone-700 hover:text-stone-900 hover:bg-stone-100 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Reports List</span>
            </button>

            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                selectedReport.status === 'pending'
                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}>
                {selectedReport.status === 'pending' ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Pending Head Review</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Replied to User</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Report Summary Card */}
          <div className="bg-[#FAF7F2] border border-[#E5DFD5] rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#E8E1D5] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  <h3 className="text-lg font-bold text-stone-900 font-['Lora',serif]">
                    {selectedReport.discussionTitle || `Discussion #${selectedReport.discussionId}`}
                  </h3>
                </div>
                <p className="text-xs text-stone-500 mt-1">
                  Report ID: <span className="font-mono text-stone-600">{selectedReport.id}</span> &bull; Submitted on {selectedReport.createdAt}
                </p>
              </div>

              <div className="text-right text-xs text-stone-600">
                <span className="font-semibold text-stone-800 block">Reported By:</span>
                <span>{selectedReport.reporterName}</span>
                {selectedReport.reporterEmail && (
                  <span className="block text-[11px] text-stone-400">{selectedReport.reporterEmail}</span>
                )}
              </div>
            </div>

            {/* The Reason the user gave for reporting (HIGHLIGHTED) */}
            <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
                <AlertCircle className="w-4 h-4 text-amber-700" />
                <span>Reason Given by User:</span>
              </div>
              <p className="text-sm text-stone-800 font-medium leading-relaxed italic bg-white/70 p-3.5 rounded-xl border border-amber-200/60">
                &ldquo;{selectedReport.reason}&rdquo;
              </p>
              <div className="text-[11px] text-amber-800 font-medium flex items-center gap-1.5 pt-1">
                <Flag className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>
                  The user specifically selected <strong>{selectedReport.reportedMessageIds.length}</strong> message(s) to highlight below.
                </span>
              </div>
            </div>
          </div>

          {/* Full Discussion with Highlighted Messages */}
          <div className="bg-white border border-[#E3DDD1] rounded-3xl shadow-sm overflow-hidden">
            <div className="bg-[#315243] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold tracking-wide flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-300" />
                  <span>Full Discussion History</span>
                </h4>
                <p className="text-[11px] text-emerald-100/80 mt-0.5">
                  Reported messages are prominently flagged with colored badges and rose borders.
                </p>
              </div>
              <span className="text-xs bg-white/20 px-3 py-1 rounded-full font-medium">
                {fullDiscussionMessages.length} total messages
              </span>
            </div>

            {/* Conversation Messages Container */}
            <div className="p-5 sm:p-6 space-y-4 bg-[#FAF8F5] max-h-[580px] overflow-y-auto">
              {fullDiscussionMessages.length === 0 ? (
                <div className="text-center py-10 text-xs text-stone-500">
                  No conversation messages available.
                </div>
              ) : (
                fullDiscussionMessages.map((msg) => {
                  const isFlagged = selectedReport.reportedMessageIds.includes(msg.id);
                  const isUser = msg.sender === 'user';
                  const isTeam = msg.sender === 'team';

                  return (
                    <div
                      key={msg.id}
                      id={`discussion-msg-${msg.id}`}
                      className={`relative transition-all ${
                        isFlagged
                          ? 'p-4 rounded-2xl bg-rose-50/95 border-2 border-rose-500 shadow-md ring-4 ring-rose-200/50 my-3'
                          : 'p-3 rounded-2xl bg-white border border-stone-200'
                      }`}
                    >
                      {/* Flagged Banner if reported */}
                      {isFlagged && (
                        <div className="mb-2.5 flex items-center justify-between pb-2 border-b border-rose-200/80">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-600 text-white shadow-2xs">
                            <Flag className="w-3 h-3 fill-white" />
                            <span>REPORTED MESSAGE FLAGGED BY USER</span>
                          </span>
                          <span className="text-[11px] font-semibold text-rose-800">
                            Included in report evidence
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            isUser
                              ? 'bg-stone-200 text-stone-800'
                              : isTeam
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {isUser ? (selectedReport.reporterName || 'Visitor / User') : (msg.senderName || 'Listening Team')}
                          </span>
                          {isFlagged && (
                            <span className="text-[11px] font-bold text-rose-700">
                              (Flagged)
                            </span>
                          )}
                        </div>

                        <span className="text-[10.5px] text-stone-400">
                          {msg.timestamp}
                        </span>
                      </div>

                      <p className={`text-xs sm:text-sm leading-relaxed ${
                        isFlagged ? 'text-stone-950 font-medium' : 'text-stone-800'
                      }`}>
                        {msg.text}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Reply Section for Head of Listeners */}
          <div className="bg-white border border-[#E3DDD1] rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#EAE3D6] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[#EBF2EE] text-[#315243] flex items-center justify-center font-bold">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-stone-900 font-['Lora',serif]">
                    Reply to User&apos;s Report
                  </h4>
                  <p className="text-xs text-stone-500">
                    This reply will be delivered directly to <strong>{selectedReport.reporterName}&apos;s Mailbox</strong>.
                  </p>
                </div>
              </div>

              <span className="text-xs text-stone-400">
                Logged in as Head: {currentUser.name}
              </span>
            </div>

            {/* Existing replies thread if any */}
            {selectedReport.replies && selectedReport.replies.length > 0 && (
              <div className="space-y-3 bg-[#FAF8F5] p-4 rounded-2xl border border-[#E8E2D7]">
                <h5 className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Previous Replies Delivered to User&apos;s Mailbox:</span>
                </h5>
                <div className="space-y-2.5">
                  {selectedReport.replies.map((reply) => (
                    <div key={reply.id} className="bg-white p-3.5 rounded-xl border border-stone-200 space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-stone-500">
                        <span className="font-semibold text-emerald-900">
                          {reply.responderName} ({reply.responderRole})
                        </span>
                        <span>{reply.createdAt}</span>
                      </div>
                      <p className="text-xs text-stone-800 leading-relaxed">
                        {reply.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notification messages */}
            {replySuccessMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <p className="font-semibold">{replySuccessMsg}</p>
              </div>
            )}

            {replyError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <p>{replyError}</p>
              </div>
            )}

            {/* Reply Textarea */}
            <div className="space-y-1.5">
              <label 
                htmlFor="head-reply-textarea"
                className="block text-xs font-semibold text-stone-800"
              >
                Write Response to User:
              </label>
              <textarea
                id="head-reply-textarea"
                rows={4}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write your thoughtful reply to the user. This message will appear in their personal 3awdli Mailbox..."
                className="w-full text-xs sm:text-sm p-3.5 rounded-2xl border border-stone-300 focus:border-[#315243] focus:ring-2 focus:ring-[#315243]/20 outline-none text-stone-900 placeholder:text-stone-400 bg-[#FAF9F6]"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-stone-500 flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-stone-400" />
                <span>Delivered securely via user mailbox persistence</span>
              </span>

              <button
                type="button"
                id="send-report-reply-btn"
                onClick={handleSendReply}
                disabled={isSendingReply || !replyText.trim()}
                className={`px-5 py-2.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
                  replyText.trim() && !isSendingReply
                    ? 'bg-[#315243] text-white hover:bg-[#253E33]'
                    : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingReply ? 'Sending Reply...' : 'Send Reply to User\'s Mailbox'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
