import React, { useState, useEffect } from 'react';
import { 
  Inbox, 
  Send, 
  CheckCircle, 
  XCircle, 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  MessageSquare, 
  AlertCircle, 
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  Lock,
  CornerDownRight,
  Filter,
  RefreshCw,
  ShieldAlert
} from 'lucide-react';
import { ConversationShareRequest, UserAccount } from '../types';
import { 
  getStoredShareRequests, 
  denyShareRequest, 
  acceptShareRequestJoin, 
  acceptShareRequestTakeover,
  getIncomingShareRequests,
  getSentShareRequests
} from '../utils/shareManagement';
import { getStoredDiscussions } from '../utils/discussionManagement';
import { getPendingReportsCount } from '../utils/reportManagement';
import { ListenerGenderIcon } from './ListenerGenderDisplay';

interface ShareRequestsMailboxProps {
  currentUser: UserAccount;
  onOpenDiscussion?: (discussionId: string) => void;
  onSwitchToReports?: () => void;
  className?: string;
}

export const ShareRequestsMailbox: React.FC<ShareRequestsMailboxProps> = ({
  currentUser,
  onOpenDiscussion,
  onSwitchToReports,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'incoming' | 'sent'>('incoming');
  const [incomingRequests, setIncomingRequests] = useState<ConversationShareRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<ConversationShareRequest[]>([]);
  
  // Modals state
  const [acceptingRequest, setAcceptingRequest] = useState<ConversationShareRequest | null>(null);
  const [acceptChoice, setAcceptChoice] = useState<'join' | 'takeover'>('join');
  const [acceptLoading, setAcceptLoading] = useState(false);
  const [acceptSuccessMsg, setAcceptSuccessMsg] = useState<{ text: string; discussionId: string } | null>(null);

  const [denyingRequest, setDenyingRequest] = useState<ConversationShareRequest | null>(null);
  const [denyReason, setDenyReason] = useState('');
  const [denyLoading, setDenyLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadRequests = () => {
    const inc = getIncomingShareRequests(currentUser);
    const snt = getSentShareRequests(currentUser);
    setIncomingRequests(inc);
    setSentRequests(snt);
  };

  useEffect(() => {
    loadRequests();

    const handleUpdate = () => {
      loadRequests();
    };

    window.addEventListener('3awdli_share_request_updated', handleUpdate);
    window.addEventListener('3awdli_share_request_created', handleUpdate);
    window.addEventListener('3awdli_discussion_sync', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('3awdli_share_request_updated', handleUpdate);
      window.removeEventListener('3awdli_share_request_created', handleUpdate);
      window.removeEventListener('3awdli_discussion_sync', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [currentUser.id, currentUser.email]);

  const pendingIncoming = incomingRequests.filter((r) => r.status === 'pending');

  // Find discussion context snippet
  const getDiscussionContext = (discId: string) => {
    const discussions = getStoredDiscussions();
    const disc = discussions.find((d) => d.id === discId);
    if (!disc) return null;
    const lastUserMsg = [...disc.messages].reverse().find((m) => m.sender === 'user');
    return {
      type: disc.type,
      userName: disc.userName,
      genderPreference: disc.genderPreference,
      lastUserSnippet: lastUserMsg ? lastUserMsg.text : 'Discussion initiated',
    };
  };

  // Handle Accept Confirmation
  const handleConfirmAccept = () => {
    if (!acceptingRequest) return;
    setAcceptLoading(true);
    setActionError(null);

    let res;
    if (acceptChoice === 'join') {
      res = acceptShareRequestJoin(acceptingRequest.id, currentUser);
    } else {
      res = acceptShareRequestTakeover(acceptingRequest.id, currentUser);
    }

    setAcceptLoading(false);
    if (res.success) {
      loadRequests();
      const discId = acceptingRequest.discussionId;
      setAcceptSuccessMsg({
        text: acceptChoice === 'join' 
          ? `You have joined the conversation alongside ${acceptingRequest.fromListenerName}. Both of you can now respond.`
          : `You have taken over the conversation. ${acceptingRequest.fromListenerName} has been excluded from new messages.`,
        discussionId: discId,
      });
      setAcceptingRequest(null);
    } else {
      setActionError(res.error || 'Failed to accept share request.');
    }
  };

  // Handle Deny Confirmation
  const handleConfirmDeny = () => {
    if (!denyingRequest) return;
    if (!denyReason.trim()) {
      setActionError('Please provide a brief reason so the requesting listener knows why.');
      return;
    }

    setDenyLoading(true);
    setActionError(null);

    const res = denyShareRequest(denyingRequest.id, denyReason, currentUser);
    setDenyLoading(false);

    if (res.success) {
      loadRequests();
      setDenyingRequest(null);
      setDenyReason('');
    } else {
      setActionError(res.error || 'Failed to decline share request.');
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Tabs & Counters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#E7DFC6] pb-4">
        <div>
          <h2 className="text-xl font-bold text-[#1F3025] flex items-center gap-2 font-serif">
            <Inbox className="w-5 h-5 text-[#2E5040]" />
            <span>Consultations &amp; Shared Mailbox</span>
          </h2>
          <p className="text-xs text-[#526357] mt-0.5">
            Review case consultations, takeover requests, and peer handover notes.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-[#F4EFE6] p-1 rounded-xl border border-[#DFD6C2] self-stretch sm:self-auto">
          <button
            onClick={() => setActiveTab('incoming')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'incoming'
                ? 'bg-[#2E5040] text-white shadow-sm'
                : 'text-[#4A5D51] hover:text-[#1F3025] hover:bg-[#EAE2D2]'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Incoming</span>
            {pendingIncoming.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'incoming' ? 'bg-amber-400 text-[#1F3025]' : 'bg-[#2E5040] text-white'
              }`}>
                {pendingIncoming.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('sent')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'sent'
                ? 'bg-[#2E5040] text-white shadow-sm'
                : 'text-[#4A5D51] hover:text-[#1F3025] hover:bg-[#EAE2D2]'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Sent Requests</span>
            <span className="text-[10px] opacity-80">({sentRequests.length})</span>
          </button>

          {Boolean(currentUser.is_head_of_listeners) && (
            <button
              id="mailbox-reports-notification-btn"
              onClick={() => {
                if (onSwitchToReports) {
                  onSwitchToReports();
                }
              }}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer"
              title="Jump to Reports Category"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              <span>Reports</span>
              {getPendingReportsCount() > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-600 text-white animate-pulse">
                  {getPendingReportsCount()}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Alert */}
      {acceptSuccessMsg && (
        <div className="p-4 rounded-xl bg-[#EDF7F1] border border-[#BDE0CE] text-[#1D4A32] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-start gap-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold">{acceptSuccessMsg.text}</p>
              <p className="text-[11px] text-[#3D6B51] mt-0.5">
                The conversation state and participants have been updated in real-time.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {onOpenDiscussion && (
              <button
                onClick={() => {
                  onOpenDiscussion(acceptSuccessMsg.discussionId);
                  setAcceptSuccessMsg(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#24533B] text-white text-xs font-semibold hover:bg-[#1A3F2C] transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <span>Open Conversation</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setAcceptSuccessMsg(null)}
              className="p-1.5 text-[#4D6D5C] hover:text-[#1D4A32] rounded-md hover:bg-[#DDF0E5]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: INCOMING REQUESTS */}
      {activeTab === 'incoming' && (
        <div className="space-y-4">
          {incomingRequests.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-[#DFD6C2] bg-[#FAF7F2]">
              <Inbox className="w-10 h-10 text-[#8C9B90] mx-auto mb-2 opacity-60" />
              <h3 className="text-sm font-semibold text-[#3B4C41]">No incoming requests</h3>
              <p className="text-xs text-[#6B7B71] max-w-sm mx-auto mt-1">
                When other listeners or supervisors send you a case consultation or handover request, it will arrive here.
              </p>
            </div>
          ) : (
            incomingRequests.map((req) => {
              const ctx = getDiscussionContext(req.discussionId);
              const isPending = req.status === 'pending';

              return (
                <div
                  key={req.id}
                  className={`rounded-2xl border transition-all p-5 shadow-xs ${
                    isPending
                      ? 'bg-white border-[#2E5040]/30 ring-1 ring-[#2E5040]/10'
                      : req.status === 'accepted'
                      ? 'bg-[#FAF7F2] border-[#D4E8DC]'
                      : 'bg-[#FAF7F2] border-[#EADFD0] opacity-80'
                  }`}
                >
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-[#F0EBE0] pb-3">
                    {/* From Listener Badge */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#E5EFE9] text-[#24533B] flex items-center justify-center font-bold text-xs border border-[#C2DDCD]">
                        {req.fromListenerName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-[#1B2E23]">{req.fromListenerName}</span>
                          {req.fromListenerProfession && (
                            <span className="text-[11px] px-2 py-0.2 rounded-full bg-[#EBF2EE] text-[#24533B] border border-[#D1E3D8] font-medium">
                              {req.fromListenerProfession}
                            </span>
                          )}
                          {req.fromListenerGender && (
                            <ListenerGenderIcon gender={req.fromListenerGender} />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-[#637469] mt-0.5">
                          <Clock className="w-3 h-3 text-[#7B8B80]" />
                          <span>Sent {req.createdAt}</span>
                          <span>•</span>
                          <span className="font-mono text-[10.5px]">Ref: #{req.discussionId}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isPending ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-xs font-semibold">
                          <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                          <span>Awaiting your response</span>
                        </span>
                      ) : req.status === 'accepted' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>
                            {req.responseType === 'takeover' ? 'Accepted (Took Over)' : 'Accepted (Joined)'}
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 text-stone-700 border border-stone-200 text-xs font-semibold">
                          <XCircle className="w-3.5 h-3.5 text-stone-500" />
                          <span>Declined</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="py-3.5 space-y-2.5">
                    <div>
                      <h4 className="text-sm font-semibold text-[#1F3327] flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-[#2E5040]" />
                        <span>{req.subject}</span>
                      </h4>
                      <p className="text-xs text-[#45574D] mt-1 bg-[#F7F3EB] p-3 rounded-xl border border-[#E9E1D2] leading-relaxed">
                        "{req.description}"
                      </p>
                    </div>

                    {/* Discussion preview info */}
                    {ctx && (
                      <div className="text-[11px] text-[#55665D] bg-[#F1EDE4] px-3 py-2 rounded-lg border border-[#E2DAD0] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#274032]">Member:</span>
                          <span>{ctx.userName || (ctx.type === 'anonymous' ? 'Anonymous Visitor' : 'Member')}</span>
                          {ctx.genderPreference && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-white text-[#384F42] border border-[#DDD5C7]">
                              Prefers: {ctx.genderPreference}
                            </span>
                          )}
                        </div>
                        <div className="italic text-[#68786F] truncate max-w-xs">
                          Last note: "{ctx.lastUserSnippet}"
                        </div>
                      </div>
                    )}

                    {/* Denial Reason display if declined */}
                    {req.status === 'denied' && req.denialReason && (
                      <div className="text-xs text-[#70584D] bg-[#F8EFE9] border border-[#ECD9CE] p-2.5 rounded-lg flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-[#A8583B] shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">Reason provided: </span>
                          <span>{req.denialReason}</span>
                          <span className="text-[10.5px] text-[#8C766C] block mt-0.5">
                            Responded: {req.respondedAt}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#F0EBE0]">
                    {isPending ? (
                      <div className="flex items-center gap-2.5 w-full sm:w-auto">
                        <button
                          onClick={() => {
                            setActionError(null);
                            setAcceptingRequest(req);
                            setAcceptChoice('join');
                          }}
                          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#254C37] text-white text-xs font-semibold hover:bg-[#1C3A2A] transition-colors cursor-pointer shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Accept Request</span>
                        </button>

                        <button
                          onClick={() => {
                            setActionError(null);
                            setDenyingRequest(req);
                            setDenyReason('');
                          }}
                          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#D9D0C1] text-[#6A473E] text-xs font-medium hover:bg-[#FBEBE6] hover:border-[#E8C2B7] transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Decline</span>
                        </button>
                      </div>
                    ) : (
                      <div className="text-[11px] text-[#697970] italic">
                        Resolved {req.respondedAt || 'previously'}
                      </div>
                    )}

                    {onOpenDiscussion && (
                      <button
                        onClick={() => onOpenDiscussion(req.discussionId)}
                        className="inline-flex items-center gap-1 text-xs text-[#29543E] hover:text-[#183929] font-medium hover:underline cursor-pointer ml-auto"
                      >
                        <span>View Discussion</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: SENT REQUESTS (Requester View) */}
      {activeTab === 'sent' && (
        <div className="space-y-4">
          {sentRequests.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-[#DFD6C2] bg-[#FAF7F2]">
              <Send className="w-10 h-10 text-[#8C9B90] mx-auto mb-2 opacity-60" />
              <h3 className="text-sm font-semibold text-[#3B4C41]">No sent share requests</h3>
              <p className="text-xs text-[#6B7B71] max-w-sm mx-auto mt-1">
                You have not shared any conversations yet. When handling an active discussion, click "Share Conversation" to consult or handover.
              </p>
            </div>
          ) : (
            sentRequests.map((req) => {
              const isPending = req.status === 'pending';

              return (
                <div
                  key={req.id}
                  className="rounded-2xl border border-[#DFD6C2] bg-white p-5 shadow-xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#F0EBE0] pb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-[#617367]">Sent to:</span>
                      <span className="text-sm font-bold text-[#1E3125]">{req.toUserName}</span>
                      {req.toUserRole && (
                        <span className="text-[10.5px] px-2 py-0.2 rounded-full bg-[#EBF2EE] text-[#24533B] border border-[#D1E3D8]">
                          {req.toUserRole}
                        </span>
                      )}
                      {req.toUserGender && <ListenerGenderIcon gender={req.toUserGender} />}
                    </div>

                    <div>
                      {isPending ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium">
                          <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                          <span>Pending response</span>
                        </span>
                      ) : req.status === 'accepted' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          <span>
                            {req.responseType === 'takeover' ? 'Accepted & Took Over' : 'Accepted & Joined'}
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[11px] font-semibold">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          <span>Declined</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Subject & Description */}
                  <div>
                    <h4 className="text-xs font-bold text-[#1D3124]">{req.subject}</h4>
                    <p className="text-xs text-[#506155] mt-1 bg-[#F9F6F0] p-2.5 rounded-lg border border-[#EDE5D6]">
                      "{req.description}"
                    </p>
                  </div>

                  {/* Feedback / Outcome */}
                  {req.status === 'denied' && (
                    <div className="p-3 rounded-xl bg-[#FAF0EC] border border-[#ECD1C5] text-xs text-[#6F4739] flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-[#B85739] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Declined by {req.toUserName}:</span>
                        <p className="mt-0.5 text-[#5C3B30] font-medium">"{req.denialReason || 'Unavailable'}"</p>
                        <span className="text-[10px] text-[#8E7166] mt-1 block">
                          Responded: {req.respondedAt || 'Earlier'}
                        </span>
                      </div>
                    </div>
                  )}

                  {req.status === 'accepted' && req.responseType === 'takeover' && (
                    <div className="p-3 rounded-xl bg-[#EFF7F2] border border-[#CDE5D6] text-xs text-[#1F4633] flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">{req.toUserName} took over this conversation.</span>
                        <p className="mt-0.5 text-[11px] text-[#345946]">
                          To protect member privacy, your access was handed over. You can still review past messages in your conversation history up to your exclusion moment.
                        </p>
                      </div>
                    </div>
                  )}

                  {req.status === 'accepted' && req.responseType === 'joined' && (
                    <div className="p-3 rounded-xl bg-[#EFF7F2] border border-[#CDE5D6] text-xs text-[#1F4633] flex items-start gap-2">
                      <Users className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">{req.toUserName} joined alongside you.</span>
                        <p className="mt-0.5 text-[11px] text-[#345946]">
                          Both of you now share active access and can respond simultaneously to this case.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-[#6E7E73] pt-1">
                    <span>Requested on {req.createdAt}</span>
                    {onOpenDiscussion && (
                      <button
                        onClick={() => onOpenDiscussion(req.discussionId)}
                        className="text-[#264D39] hover:underline font-medium cursor-pointer"
                      >
                        View Conversation
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODAL 1: ACCEPT CHOICE (JOIN vs TAKEOVER) */}
      {acceptingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-[#D9D0C1] shadow-2xl overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="bg-[#FAF7F2] px-6 py-4 border-b border-[#EAE2D2] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#E5EFE9] text-[#24533B] flex items-center justify-center font-bold">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1D3226]">Accept Conversation Request</h3>
                  <p className="text-xs text-[#5D6F63]">
                    From: {acceptingRequest.fromListenerName} (#{acceptingRequest.discussionId})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAcceptingRequest(null)}
                className="text-[#7A8A7F] hover:text-[#1D3226] p-1.5 rounded-lg hover:bg-[#EAE2D2] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="p-3 bg-[#F6F2E9] rounded-xl border border-[#E4DCCE] text-xs text-[#4E5E53]">
                <span className="font-semibold text-[#1C3225]">Request: </span>
                <span>{acceptingRequest.subject}</span>
                <p className="italic text-[#617167] mt-1">"{acceptingRequest.description}"</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E3225] mb-2 uppercase tracking-wider">
                  Select how you wish to take this conversation:
                </label>

                <div className="space-y-3">
                  {/* Option A: Join */}
                  <label
                    onClick={() => setAcceptChoice('join')}
                    className={`block p-4 rounded-xl border cursor-pointer transition-all ${
                      acceptChoice === 'join'
                        ? 'border-[#2E5040] bg-[#EFF6F2] ring-2 ring-[#2E5040]/15'
                        : 'border-[#DDD5C7] bg-[#FAF8F4] hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="acceptChoice"
                        checked={acceptChoice === 'join'}
                        onChange={() => setAcceptChoice('join')}
                        className="mt-1 text-[#2E5040] focus:ring-[#2E5040]"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-xs text-[#1D3226]">
                          <Users className="w-3.5 h-3.5 text-[#2E5040]" />
                          <span>Join the conversation alongside {acceptingRequest.fromListenerName}</span>
                        </div>
                        <p className="text-[11px] text-[#4E6155] mt-1 leading-relaxed">
                          Both of you remain active in this conversation. Both listeners can read new incoming messages and respond together to support the member.
                        </p>
                        <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-[#28523C] bg-[#DDEEE4] px-2 py-0.5 rounded font-semibold">
                          <Check className="w-2.5 h-2.5" />
                          Co-presence • Collaborative consultation
                        </div>
                      </div>
                    </div>
                  </label>

                  {/* Option B: Takeover & Exclude */}
                  <label
                    onClick={() => setAcceptChoice('takeover')}
                    className={`block p-4 rounded-xl border cursor-pointer transition-all ${
                      acceptChoice === 'takeover'
                        ? 'border-[#7E4334] bg-[#FBF2EF] ring-2 ring-[#7E4334]/15'
                        : 'border-[#DDD5C7] bg-[#FAF8F4] hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="acceptChoice"
                        checked={acceptChoice === 'takeover'}
                        onChange={() => setAcceptChoice('takeover')}
                        className="mt-1 text-[#7E4334] focus:ring-[#7E4334]"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-xs text-[#4F2B22]">
                          <UserCheck className="w-3.5 h-3.5 text-[#884232]" />
                          <span>Take over the conversation and exclude {acceptingRequest.fromListenerName}</span>
                        </div>
                        <p className="text-[11px] text-[#694F47] mt-1 leading-relaxed">
                          You become the sole active listener. {acceptingRequest.fromListenerName} will lose access to any new messages going forward. Their past record of messages prior to this moment remains preserved in their history.
                        </p>
                        <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-[#864332] bg-[#F5DFD9] px-2 py-0.5 rounded font-semibold">
                          <Lock className="w-2.5 h-2.5" />
                          Sole listener handover • Member privacy protection
                        </div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {actionError && (
                <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200">
                  {actionError}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-[#FAF7F2] px-6 py-3.5 border-t border-[#EAE2D2] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setAcceptingRequest(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[#55665B] hover:text-[#1E3125] hover:bg-[#EAE3D4] transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={acceptLoading}
                onClick={handleConfirmAccept}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#254C37] text-white text-xs font-semibold hover:bg-[#1B3828] transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                {acceptLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm {acceptChoice === 'join' ? 'Join' : 'Takeover'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: DENIAL FORM (Reason required) */}
      {denyingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full border border-[#D9D0C1] shadow-2xl overflow-hidden animate-scaleUp">
            {/* Header */}
            <div className="bg-[#FAF7F2] px-6 py-4 border-b border-[#EAE2D2] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#FAECE8] text-[#863C29] flex items-center justify-center">
                  <X className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#2A1D1A]">Decline Share Request</h3>
                  <p className="text-xs text-[#6A5A55]">From: {denyingRequest.fromListenerName}</p>
                </div>
              </div>
              <button
                onClick={() => setDenyingRequest(null)}
                className="text-[#7A8A7F] hover:text-[#1D3226] p-1.5 rounded-lg hover:bg-[#EAE2D2]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-[#4F5F55] leading-relaxed">
                Please provide a brief reason so <span className="font-semibold text-[#1C2F23]">{denyingRequest.fromListenerName}</span> understands why you are unable to take this request:
              </p>

              {/* Custom Reason Textarea */}
              <div>
                <label className="block text-xs font-semibold text-[#25392D] mb-1">
                  Reason or specific note:
                </label>
                <textarea
                  value={denyReason}
                  onChange={(e) => setDenyReason(e.target.value)}
                  placeholder="e.g., I have back-to-back consultations this afternoon, but Dr. Amina may be available."
                  rows={3}
                  className="w-full text-xs p-3 rounded-xl border border-[#D6CDBC] bg-[#FAF8F4] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#2E5040]/30 text-[#1D3226]"
                />
              </div>

              {actionError && (
                <div className="p-2.5 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200">
                  {actionError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-[#FAF7F2] px-6 py-3.5 border-t border-[#EAE2D2] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDenyingRequest(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[#5B6C61] hover:text-[#1F3327] hover:bg-[#EAE3D4]"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={denyLoading || !denyReason.trim()}
                onClick={handleConfirmDeny}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#853C2D] text-white text-xs font-semibold hover:bg-[#6D2E21] transition-colors cursor-pointer disabled:opacity-50"
              >
                {denyLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <X className="w-3.5 h-3.5" />
                    <span>Send Reason &amp; Decline</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
