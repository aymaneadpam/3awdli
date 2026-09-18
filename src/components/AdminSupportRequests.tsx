import { useState, useMemo, useEffect } from 'react';
import { 
  Inbox, 
  Search, 
  Mail, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ExternalLink, 
  Copy, 
  Check, 
  Trash2, 
  X, 
  FileText,
  User,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  MessageSquare,
  Sparkles,
  ChevronRight,
  Filter,
  Ban,
  Send
} from 'lucide-react';
import { SupportRequest, SupportCategory } from '../types';
import { 
  getStoredSupportRequests, 
  updateSupportRequestStatus, 
  deleteSupportRequest 
} from '../utils/supportRequests';
import { 
  checkEmailConfigStatus, 
  sendEmailViaSMTP, 
  forwardSupportRequestViaSMTP, 
  type EmailConfigStatus 
} from '../utils/emailService';

interface AdminSupportRequestsProps {
  onShowToast: (msg: string) => void;
}

export const AdminSupportRequests = ({ onShowToast }: AdminSupportRequestsProps) => {
  const [requests, setRequests] = useState<SupportRequest[]>(() => getStoredSupportRequests());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'in_progress' | 'resolved'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'report_listener' | 'account_ban' | 'technical' | 'account' | 'feedback'>('all');
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [adminNotesInput, setAdminNotesInput] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [smtpStatus, setSmtpStatus] = useState<EmailConfigStatus | null>(null);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [isForwardingSmtp, setIsForwardingSmtp] = useState(false);

  // Check email config status on mount
  useEffect(() => {
    checkEmailConfigStatus().then(setSmtpStatus);
  }, []);

  // Sync with storage events
  useEffect(() => {
    const handleStorageUpdate = () => {
      setRequests(getStoredSupportRequests());
    };
    window.addEventListener('3awdli_support_requests_updated', handleStorageUpdate);
    return () => window.removeEventListener('3awdli_support_requests_updated', handleStorageUpdate);
  }, []);

  // Update selected request when requests change
  useEffect(() => {
    if (selectedRequest) {
      const found = requests.find((r) => r.id === selectedRequest.id);
      if (found) {
        setSelectedRequest(found);
        setAdminNotesInput(found.adminNotes || '');
      }
    }
  }, [requests]);

  const metrics = useMemo(() => {
    const total = requests.length;
    const newCount = requests.filter((r) => r.status === 'new').length;
    const inProgressCount = requests.filter((r) => r.status === 'in_progress').length;
    const resolvedCount = requests.filter((r) => r.status === 'resolved').length;
    const listenerReportsCount = requests.filter(
      (r) => r.category === 'report_listener' || (r.priority === 'urgent' && r.category !== 'account_ban')
    ).length;
    const accountBanCount = requests.filter((r) => r.category === 'account_ban').length;
    const urgentNewCount = requests.filter(
      (r) => (r.category === 'report_listener' || r.category === 'account_ban' || r.priority === 'urgent') && r.status === 'new'
    ).length;
    return { total, newCount, inProgressCount, resolvedCount, listenerReportsCount, accountBanCount, urgentNewCount };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        r.subject.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.userName && r.userName.toLowerCase().includes(q)) ||
        (r.reportedListenerOrDiscussion && r.reportedListenerOrDiscussion.toLowerCase().includes(q)) ||
        r.message.toLowerCase().includes(q);

      if (!matchesQuery) return false;

      if (statusFilter !== 'all' && r.status !== statusFilter) {
        return false;
      }

      if (categoryFilter === 'report_listener') {
        if (r.category !== 'report_listener' && r.priority !== 'urgent') {
          return false;
        }
      } else if (categoryFilter !== 'all' && r.category !== categoryFilter) {
        return false;
      }

      return true;
    });
  }, [requests, searchQuery, statusFilter, categoryFilter]);

  const handleOpenDetail = (req: SupportRequest) => {
    setSelectedRequest(req);
    setAdminNotesInput(req.adminNotes || '');
  };

  const handleStatusChange = (newStatus: 'new' | 'in_progress' | 'resolved') => {
    if (!selectedRequest) return;
    const updated = updateSupportRequestStatus(selectedRequest.id, newStatus, adminNotesInput);
    if (updated) {
      setSelectedRequest(updated);
      setRequests(getStoredSupportRequests());
      onShowToast(`Request status updated to "${newStatus.replace('_', ' ')}"`);
    }
  };

  const handleSaveNotes = () => {
    if (!selectedRequest) return;
    const updated = updateSupportRequestStatus(selectedRequest.id, selectedRequest.status, adminNotesInput);
    if (updated) {
      setSelectedRequest(updated);
      setRequests(getStoredSupportRequests());
      onShowToast('Internal administrator notes saved');
    }
  };

  const handleCopyEmail = (emailStr: string) => {
    navigator.clipboard.writeText(emailStr);
    setCopiedEmail(true);
    onShowToast(`Copied ${emailStr} to clipboard`);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const handleDelete = (id: string) => {
    const success = deleteSupportRequest(id);
    if (success) {
      if (selectedRequest?.id === id) {
        setSelectedRequest(null);
      }
      setDeleteConfirmId(null);
      setRequests(getStoredSupportRequests());
      onShowToast('Support message deleted');
    }
  };

  const openMailClient = (req: SupportRequest) => {
    const mailtoUrl = `mailto:${encodeURIComponent(req.email)}?subject=${encodeURIComponent(
      `Re: [3awdli Support] ${req.subject}`
    )}`;
    window.open(mailtoUrl, '_blank');
  };

  const handleSendTestEmail = async () => {
    setIsTestingSmtp(true);
    try {
      const res = await sendEmailViaSMTP({
        to: 'aymane.habbo@gmail.com',
        subject: '3awdli - Gmail SMTP Test Confirmation',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; background: #FAF8F5; border: 1px solid #E6E0D6; border-radius: 16px;">
            <div style="border-bottom: 2px solid #315243; padding-bottom: 12px; margin-bottom: 16px;">
              <h2 style="color: #315243; margin: 0 0 6px 0; font-size: 18px;">Gmail SMTP Connected Successfully! 🎉</h2>
              <p style="color: #617068; margin: 0; font-size: 13px;">3awdli Real Email Notification System</p>
            </div>
            <p style="color: #2D3E35; font-size: 14px; line-height: 1.6;">
              This test email confirms that real emails are actively sending from <strong>aymane.habbo@gmail.com</strong> using your Google App Password.
            </p>
            <div style="background: #ffffff; padding: 12px 16px; border-radius: 8px; border: 1px solid #EBE5DC; margin-top: 14px; font-size: 12px; color: #526359;">
              <div><strong>Sender:</strong> aymane.habbo@gmail.com</div>
              <div><strong>Recipient:</strong> aymane.habbo@gmail.com</div>
              <div><strong>Timestamp:</strong> ${new Date().toLocaleString()}</div>
            </div>
          </div>
        `,
      });

      if (res.success) {
        onShowToast('Test email successfully sent to aymane.habbo@gmail.com! Please check your inbox.');
      } else {
        onShowToast(`SMTP Notice: ${res.error || 'Check GMAIL_APP_PASSWORD'}`);
      }
    } catch (err: any) {
      onShowToast(`SMTP Error: ${err.message || 'Failed to send'}`);
    } finally {
      setIsTestingSmtp(false);
      checkEmailConfigStatus().then(setSmtpStatus);
    }
  };

  const handleForwardSelectedViaSmtp = async (req: SupportRequest) => {
    setIsForwardingSmtp(true);
    try {
      const res = await forwardSupportRequestViaSMTP(req);
      if (res.success) {
        onShowToast('Dispatched to aymane.habbo@gmail.com via Gmail SMTP!');
      } else {
        onShowToast(`SMTP Dispatch notice: ${res.error}`);
      }
    } catch (err: any) {
      onShowToast(`Failed to forward: ${err.message}`);
    } finally {
      setIsForwardingSmtp(false);
    }
  };

  const getCategoryBadge = (cat?: SupportCategory, isUrgent?: boolean) => {
    if (cat === 'account_ban') {
      return (
        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-rose-700 text-white flex items-center gap-1 shadow-2xs">
          <Ban className="w-3 h-3" />
          <span>Account Ban Appeal</span>
        </span>
      );
    }
    if (cat === 'report_listener' || isUrgent) {
      return (
        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-red-600 text-white flex items-center gap-1 shadow-2xs">
          <ShieldAlert className="w-3 h-3" />
          <span>High Priority: Listener Report</span>
        </span>
      );
    }
    if (cat === 'technical') {
      return (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#EAE4DA] text-[#3B4D42]">
          Technical Issue
        </span>
      );
    }
    if (cat === 'account') {
      return (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#E8F1EC] text-[#244C36]">
          Account Problem
        </span>
      );
    }
    if (cat === 'feedback') {
      return (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#FEF3C7] text-[#92400E]">
          Site Feedback
        </span>
      );
    }
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#FAF8F5] text-[#55675D] border border-[#E5DFD5]">
        General Inquiry
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Forwarding Destination & Gmail SMTP Notice */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E5DFD5] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#E8F1EC] text-[#294B3A] border border-[#CCE0D4] flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#20362A]">Admin Destination:</span>
              <span className="px-2.5 py-0.5 rounded-md bg-[#F4EFE7] text-[#1E372C] font-mono text-xs font-semibold border border-[#E0D8CB]">
                aymane.habbo@gmail.com
              </span>

              {smtpStatus?.configured ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[11px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                  Gmail SMTP Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-[11px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Awaiting GMAIL_APP_PASSWORD
                </span>
              )}
            </div>
            <p className="text-[12px] text-[#63756B] mt-1 leading-relaxed max-w-2xl">
              {smtpStatus?.configured ? (
                <span>
                  Real email delivery is enabled. Contact requests and urgent reports are immediately forwarded from <strong>aymane.habbo@gmail.com</strong> directly to your inbox.
                </span>
              ) : (
                <span>
                  To start receiving emails directly in your inbox, set your 16-character Google App Password in project <strong>Settings &rarr; Secrets</strong> as <code className="bg-[#FAF8F5] px-1 py-0.5 rounded border border-[#E0D8CB] font-mono text-[11px] text-[#294B3A]">GMAIL_APP_PASSWORD</code>.
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
          <button
            type="button"
            onClick={handleSendTestEmail}
            disabled={isTestingSmtp}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#294B3A] hover:bg-[#1E382A] text-white transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50 shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isTestingSmtp ? 'Sending Test...' : 'Send Test Email'}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#E8E2D7] shadow-2xs">
          <div className="text-2xl font-bold text-[#1F362C] font-['Lora',serif]">
            {metrics.total}
          </div>
          <div className="text-xs font-medium text-[#7A8A80] mt-0.5 flex items-center gap-1.5">
            <Inbox className="w-3.5 h-3.5 text-[#325243]" />
            <span>Total Messages</span>
          </div>
        </div>

        {/* High Priority Flagged Listener Reports */}
        <div 
          onClick={() => setCategoryFilter(categoryFilter === 'report_listener' ? 'all' : 'report_listener')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
            categoryFilter === 'report_listener'
              ? 'bg-red-500 text-white border-red-600 ring-2 ring-red-400'
              : 'bg-red-50/70 border-red-200 hover:bg-red-50'
          }`}
        >
          <div className={`text-2xl font-bold font-['Lora',serif] ${categoryFilter === 'report_listener' ? 'text-white' : 'text-red-700'}`}>
            {metrics.listenerReportsCount}
          </div>
          <div className={`text-xs font-bold mt-0.5 flex items-center gap-1.5 ${categoryFilter === 'report_listener' ? 'text-red-100' : 'text-red-700'}`}>
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
            <span>Listener Reports</span>
            {metrics.urgentNewCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${categoryFilter === 'report_listener' ? 'bg-white text-red-700' : 'bg-red-600 text-white'}`}>
                {metrics.urgentNewCount} new
              </span>
            )}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#FEF3C7]/40 border border-[#FDE68A] shadow-2xs">
          <div className="text-2xl font-bold text-[#92400E] font-['Lora',serif]">
            {metrics.newCount}
          </div>
          <div className="text-xs font-semibold text-[#B45309] mt-0.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            <span>New / Unanswered</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#EBF2EE] border border-[#CCE0D4] shadow-2xs">
          <div className="text-2xl font-bold text-[#234533] font-['Lora',serif]">
            {metrics.inProgressCount}
          </div>
          <div className="text-xs font-semibold text-[#2C523D] mt-0.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#315642]" />
            <span>In Progress</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E8E2D7] shadow-2xs col-span-2 sm:col-span-1">
          <div className="text-2xl font-bold text-[#3B5044] font-['Lora',serif]">
            {metrics.resolvedCount}
          </div>
          <div className="text-xs font-medium text-[#687A70] mt-0.5 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
            <span>Resolved</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-[#E8E2D7] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#8C9C92] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by subject, email, listener, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2 text-xs sm:text-sm bg-[#FAF8F5] border border-[#DDD6CC] rounded-xl text-[#233129] placeholder-[#9BA7A0] focus:outline-hidden focus:ring-2 focus:ring-[#325243]/20 focus:border-[#325243] transition-all"
          />
        </div>

        {/* Category & Status Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {/* Priority filter toggle */}
          <button
            onClick={() => setCategoryFilter(categoryFilter === 'report_listener' ? 'all' : 'report_listener')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              categoryFilter === 'report_listener'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-red-50 text-red-800 border border-red-200 hover:bg-red-100'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Listener Reports ({metrics.listenerReportsCount})</span>
          </button>

          {/* Account Ban filter toggle */}
          <button
            id="admin-filter-ban-appeals"
            onClick={() => setCategoryFilter(categoryFilter === 'account_ban' ? 'all' : 'account_ban')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              categoryFilter === 'account_ban'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            <span>Account Ban ({metrics.accountBanCount})</span>
          </button>

          <span className="h-4 w-[1px] bg-[#DDD6CC] shrink-0"></span>

          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
              statusFilter === 'all'
                ? 'bg-[#294B3A] text-white'
                : 'bg-[#FAF8F5] text-[#55675D] hover:bg-[#EFECE5] border border-[#E5DFD5]'
            }`}
          >
            All ({metrics.total})
          </button>
          <button
            onClick={() => setStatusFilter('new')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'new'
                ? 'bg-[#92400E] text-white'
                : 'bg-[#FAF8F5] text-[#8C531B] hover:bg-[#FEF3C7] border border-[#E5DFD5]'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            New ({metrics.newCount})
          </button>
          <button
            onClick={() => setStatusFilter('in_progress')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
              statusFilter === 'in_progress'
                ? 'bg-[#234533] text-white'
                : 'bg-[#FAF8F5] text-[#42584C] hover:bg-[#EBF2EE] border border-[#E5DFD5]'
            }`}
          >
            In Progress ({metrics.inProgressCount})
          </button>
          <button
            onClick={() => setStatusFilter('resolved')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
              statusFilter === 'resolved'
                ? 'bg-[#4B5E53] text-white'
                : 'bg-[#FAF8F5] text-[#55675D] hover:bg-[#EFECE5] border border-[#E5DFD5]'
            }`}
          >
            Resolved ({metrics.resolvedCount})
          </button>
        </div>
      </div>

      {/* Messages List / Table */}
      <div className="bg-white rounded-3xl border border-[#E8E2D7] overflow-hidden shadow-xs">
        {filteredRequests.length === 0 ? (
          <div className="p-12 text-center">
            <Inbox className="w-10 h-10 text-[#A8B7AF] mx-auto mb-3 opacity-60" />
            <h3 className="text-sm font-bold text-[#233129] font-['Lora',serif]">
              No support messages found
            </h3>
            <p className="text-xs text-[#67776F] mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all'
                ? 'Try adjusting your search query or active filter pills.'
                : 'Any messages sent through "Contact Support" will appear here for administrative direct email response.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#EFEBE3]">
            {filteredRequests.map((req) => {
              const isSelected = selectedRequest?.id === req.id;
              const isUrgentListenerReport =
                req.category === 'report_listener' || req.priority === 'urgent';

              return (
                <div
                  key={req.id}
                  onClick={() => handleOpenDetail(req)}
                  className={`p-4 sm:p-5 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isUrgentListenerReport
                      ? isSelected
                        ? 'bg-[#FDF2F2] border-l-4 border-l-red-600'
                        : 'bg-[#FFF9F9] hover:bg-[#FDF2F2] border-l-4 border-l-red-500'
                      : isSelected
                      ? 'bg-[#F4EFE7]/60'
                      : 'hover:bg-[#FAF8F5]'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    {/* Status Dot / Icon */}
                    <div className="mt-0.5 shrink-0">
                      {isUrgentListenerReport ? (
                        <div className="w-3.5 h-3.5 rounded-full bg-red-600 ring-4 ring-red-100 flex items-center justify-center animate-pulse" title="High Priority Listener Report">
                          <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                        </div>
                      ) : req.status === 'new' ? (
                        <div className="w-3 h-3 rounded-full bg-amber-500 ring-4 ring-amber-100" title="New Message" />
                      ) : req.status === 'in_progress' ? (
                        <div className="w-3 h-3 rounded-full bg-emerald-600 ring-4 ring-emerald-100" title="In Progress" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-gray-400" title="Resolved" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-bold text-[#22352B] truncate max-w-md">
                          {req.subject}
                        </h4>

                        {/* Category & Priority Badge */}
                        {getCategoryBadge(req.category, isUrgentListenerReport)}

                        {req.status === 'new' && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                            New
                          </span>
                        )}
                        {req.status === 'in_progress' && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-[#E8F1EC] text-[#244835] border border-[#CCE0D4]">
                            In Progress
                          </span>
                        )}
                        {req.status === 'resolved' && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-[#F1EFE9] text-[#697A70] border border-[#DDD7CC]">
                            Resolved
                          </span>
                        )}
                      </div>

                      {/* Reported entity callout if listener report */}
                      {req.reportedListenerOrDiscussion && (
                        <div className="mt-1 text-[11px] font-medium text-red-900 bg-red-100/70 border border-red-200/80 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-red-600 shrink-0" />
                          <span>Reported entity: <strong>{req.reportedListenerOrDiscussion}</strong></span>
                        </div>
                      )}

                      <p className="text-xs text-[#5D6F64] mt-1 line-clamp-2 leading-relaxed">
                        {req.message}
                      </p>

                      <div className="mt-2 flex items-center gap-3 text-[11px] text-[#7A8A80] flex-wrap">
                        <span className="flex items-center gap-1 font-medium text-[#384A40]">
                          <Mail className="w-3 h-3 text-[#315243]" />
                          <span>{req.email}</span>
                        </span>
                        {req.userName && (
                          <span className="flex items-center gap-1 text-[#65766C]">
                            <User className="w-3 h-3" />
                            <span>{req.userName}</span>
                          </span>
                        )}
                        <span>&bull;</span>
                        <span>{req.createdAt}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 sm:self-center pl-6 sm:pl-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openMailClient(req);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#FAF8F5] hover:bg-[#EFECE5] text-[#2F4D3C] text-xs font-semibold border border-[#DDD6CC] flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Reply directly via default email client"
                    >
                      <Mail className="w-3.5 h-3.5 text-[#315243]" />
                      <span>Reply by Email</span>
                    </button>

                    <ChevronRight className="w-4 h-4 text-[#A1B0A7]" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Message Details Modal */}
      {selectedRequest && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/40 backdrop-blur-xs overflow-y-auto"
          onClick={() => setSelectedRequest(null)}
        >
          <div 
            className="bg-[#FAF8F5] border border-[#E5DFD5] rounded-3xl max-w-2xl w-full flex flex-col shadow-2xl relative overflow-hidden my-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
            id="admin-support-request-detail"
          >
            {/* Header */}
            <div className="p-5 sm:p-6 pb-4 shrink-0 flex items-start justify-between border-b border-[#EBE6DD]">
              <div className="pr-4">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#63756B]">
                    Support Request Details
                  </span>
                  <span className="text-xs text-[#8A9B91]">&bull;</span>
                  <span className="text-xs text-[#8A9B91]">{selectedRequest.createdAt}</span>
                  {getCategoryBadge(
                    selectedRequest.category,
                    selectedRequest.category === 'report_listener' || selectedRequest.priority === 'urgent'
                  )}
                </div>
                <h3 className="text-lg font-bold text-[#203429] font-['Lora',serif]">
                  {selectedRequest.subject}
                </h3>
              </div>

              <button
                onClick={() => setSelectedRequest(null)}
                className="text-[#75847B] hover:text-[#2A3B31] p-1.5 rounded-xl hover:bg-[#EAE4D9] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
              {/* High Priority Confidential Alert for Listener Reports */}
              {(selectedRequest.category === 'report_listener' || selectedRequest.priority === 'urgent') && (
                <div className="p-4 rounded-2xl bg-[#FFF5F5] border border-red-200 flex items-start gap-3 text-red-950">
                  <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-wider text-red-700">
                        High Priority: Listener Incident Report
                      </span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-red-200 text-red-900">
                        Confidential
                      </span>
                    </div>
                    <p className="text-xs text-red-900 mt-1 leading-relaxed">
                      This report was submitted confidentially by a user regarding a listener on 3awdli. Listeners do not have access to this report. Please review with discretion and follow up appropriately.
                    </p>
                    {selectedRequest.reportedListenerOrDiscussion && (
                      <div className="mt-2.5 p-2.5 rounded-xl bg-white border border-red-200 text-xs">
                        <span className="font-bold text-red-950">Reported Listener or Discussion:</span>{' '}
                        <span className="text-red-900 font-medium">{selectedRequest.reportedListenerOrDiscussion}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sender Info Bar */}
              <div className="p-4 rounded-2xl bg-white border border-[#E7E1D6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] text-[#7A8A80] uppercase font-semibold">
                    Sender Information
                  </div>
                  <div className="text-sm font-bold text-[#23382D] mt-0.5 flex items-center gap-2">
                    <span>{selectedRequest.email}</span>
                    <button
                      onClick={() => handleCopyEmail(selectedRequest.email)}
                      className="p-1 text-[#65766D] hover:text-[#263E32] rounded-md hover:bg-[#EFECE5] cursor-pointer"
                      title="Copy email address"
                    >
                      {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {selectedRequest.userName && (
                    <div className="text-xs text-[#5D6F65] mt-0.5 flex items-center gap-1">
                      <User className="w-3 h-3 text-[#315243]" />
                      <span>Registered User: <strong>{selectedRequest.userName}</strong> (ID: {selectedRequest.userId || 'Linked'})</span>
                    </div>
                  )}
                  {!selectedRequest.userName && (
                    <div className="text-xs text-[#85948B] mt-0.5">
                      Guest / Anonymous visitor inquiry
                    </div>
                  )}
                  <div className="text-[11px] text-[#7A8A80] mt-1.5 flex items-center gap-1">
                    <Mail className="w-3 h-3 text-[#315243]" />
                    <span>Designated Forward: <strong>{selectedRequest.destinationEmail || 'aymane.habbo@gmail.com'}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleForwardSelectedViaSmtp(selectedRequest)}
                    disabled={isForwardingSmtp}
                    className="px-3.5 py-2 bg-white hover:bg-[#F4EFE7] border border-[#D5CEC0] text-[#284937] text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                    title="Dispatch email to aymane.habbo@gmail.com via Gmail SMTP"
                  >
                    <Send className="w-3.5 h-3.5 text-[#284937]" />
                    <span>{isForwardingSmtp ? 'Forwarding...' : 'Dispatch via SMTP'}</span>
                  </button>

                  <button
                    onClick={() => openMailClient(selectedRequest)}
                    className="px-4 py-2 bg-[#284937] hover:bg-[#1E382A] text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Reply via Email</span>
                    <ExternalLink className="w-3 h-3 opacity-80" />
                  </button>
                </div>
              </div>

              {/* Message Content */}
              <div>
                <h4 className="text-xs font-bold text-[#44564C] uppercase tracking-wider mb-2">
                  Message Body
                </h4>
                <div className="p-4 rounded-2xl bg-[#F6F3ED] border border-[#E5DFD5] text-xs sm:text-sm text-[#24372D] leading-relaxed whitespace-pre-wrap">
                  {selectedRequest.message}
                </div>
              </div>

              {/* Status Management */}
              <div>
                <h4 className="text-xs font-bold text-[#44564C] uppercase tracking-wider mb-2">
                  Manage Status
                </h4>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleStatusChange('new')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      selectedRequest.status === 'new'
                        ? 'bg-[#92400E] text-white shadow-2xs'
                        : 'bg-white border border-[#DDD6CC] text-[#784A1A] hover:bg-[#FEF3C7]'
                    }`}
                  >
                    Mark as New
                  </button>
                  <button
                    onClick={() => handleStatusChange('in_progress')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      selectedRequest.status === 'in_progress'
                        ? 'bg-[#234533] text-white shadow-2xs'
                        : 'bg-white border border-[#DDD6CC] text-[#2C523D] hover:bg-[#E8F1EC]'
                    }`}
                  >
                    Mark as In Progress
                  </button>
                  <button
                    onClick={() => handleStatusChange('resolved')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                      selectedRequest.status === 'resolved'
                        ? 'bg-[#2B4B3A] text-white shadow-2xs'
                        : 'bg-white border border-[#DDD6CC] text-[#44574D] hover:bg-[#EFECE5]'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Mark as Resolved</span>
                  </button>
                  {selectedRequest.resolvedAt && (
                    <span className="text-xs text-[#7A8A81] ml-2">
                      Resolved {selectedRequest.resolvedAt}
                    </span>
                  )}
                </div>
              </div>

              {/* Administrator Internal Notes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-[#44564C] uppercase tracking-wider">
                    Internal Admin Notes (Private)
                  </h4>
                  <button
                    onClick={handleSaveNotes}
                    className="text-xs font-semibold text-[#284937] hover:underline cursor-pointer"
                  >
                    Save Notes
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={adminNotesInput}
                  onChange={(e) => setAdminNotesInput(e.target.value)}
                  placeholder="Record internal resolution details, reply summary, or staff notes..."
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-[#DDD7CD] rounded-xl text-[#233129] placeholder-[#9BA7A0] focus:outline-hidden focus:ring-2 focus:ring-[#325243]/20 focus:border-[#325243] transition-all resize-none"
                />
              </div>

              {/* Danger Zone: Delete Message */}
              <div className="pt-4 border-t border-[#EAE4DA] flex items-center justify-between">
                {deleteConfirmId === selectedRequest.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600 font-medium">Delete this message?</span>
                    <button
                      onClick={() => handleDelete(selectedRequest.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 cursor-pointer"
                    >
                      Confirm Delete
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-2.5 py-1 bg-[#EBE5DB] text-[#4C5B52] rounded-lg text-xs font-medium hover:bg-[#DDD6CA] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirmId(selectedRequest.id)}
                    className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1.5 cursor-pointer font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete message</span>
                  </button>
                )}

                <button
                  onClick={() => setSelectedRequest(null)}
                  className="px-4 py-2 bg-[#EAE4DA] hover:bg-[#DDD6C9] text-[#33473C] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
