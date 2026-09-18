import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  X, 
  Check, 
  AlertTriangle, 
  MessageSquare, 
  ChevronRight, 
  ArrowLeft, 
  Send, 
  CheckCircle2, 
  HelpCircle,
  Flag,
  Lock
} from 'lucide-react';
import { ChatMessage, DiscussionConversation, UserAccount, DiscussionReport } from '../types';
import { createDiscussionReport } from '../utils/reportManagement';

interface ReportDiscussionModalProps {
  isOpen: boolean;
  onClose: () => void;
  discussion: DiscussionConversation | null;
  messages: ChatMessage[];
  currentUser?: UserAccount | null;
  preSelectedMessageId?: string | null;
  onReportSubmitted?: (report: DiscussionReport) => void;
}

export const ReportDiscussionModal: React.FC<ReportDiscussionModalProps> = ({
  isOpen,
  onClose,
  discussion,
  messages,
  currentUser,
  preSelectedMessageId,
  onReportSubmitted,
}) => {
  const [step, setStep] = useState<'select' | 'reason' | 'success'>('select');
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdReport, setCreatedReport] = useState<DiscussionReport | null>(null);

  // Filter out system messages so user focuses on conversational dialogue, or include all
  const selectableMessages = messages.filter((m) => m.text && m.text.trim().length > 0);

  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setReason('');
      setError(null);
      setIsSubmitting(false);
      setCreatedReport(null);

      if (preSelectedMessageId) {
        setSelectedMessageIds([preSelectedMessageId]);
      } else {
        setSelectedMessageIds([]);
      }
    }
  }, [isOpen, preSelectedMessageId]);

  if (!isOpen || !discussion) return null;

  const toggleMessage = (id: string) => {
    setError(null);
    setSelectedMessageIds((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedMessageIds(selectableMessages.map((m) => m.id));
  };

  const handleClearSelection = () => {
    setSelectedMessageIds([]);
  };

  const handleProceedToReason = () => {
    if (selectedMessageIds.length === 0) {
      setError('Please select at least one message to include in your report.');
      return;
    }
    setError(null);
    setStep('reason');
  };

  const handleSubmit = () => {
    if (!reason.trim()) {
      setError('Please explain why you are reporting this discussion.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const flaggedMessages = selectableMessages.filter((m) =>
        selectedMessageIds.includes(m.id)
      );

      const report = createDiscussionReport({
        discussion,
        reportedMessages: flaggedMessages,
        reason: reason.trim(),
        reporterUser: currentUser ? {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
        } : null,
      });

      setCreatedReport(report);
      setStep('success');
      if (onReportSubmitted) {
        onReportSubmitted(report);
      }
    } catch (err) {
      console.error('Failed to submit report:', err);
      setError('An unexpected error occurred while saving your report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedMessagesList = selectableMessages.filter((m) =>
    selectedMessageIds.includes(m.id)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        id="report-discussion-modal"
        className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="bg-[#FAF7F2] border-b border-[#EAE3D6] px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 font-['Lora',serif]">
                Report Discussion
              </h3>
              <p className="text-xs text-stone-600 flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-stone-500" />
                <span>Confidential review by Head of Listeners</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress step indicator */}
        {step !== 'success' && (
          <div className="bg-[#F6F2EA] px-5 py-2.5 border-b border-[#E8E0D2] flex items-center justify-between text-xs text-stone-600">
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                step === 'select' ? 'bg-[#315243] text-white' : 'bg-emerald-700 text-white'
              }`}>
                {step === 'reason' ? <Check className="w-3 h-3" /> : '1'}
              </span>
              <span className={`font-semibold ${step === 'select' ? 'text-stone-900' : 'text-stone-600'}`}>
                1. Select Messages ({selectedMessageIds.length})
              </span>
            </div>

            <ChevronRight className="w-4 h-4 text-stone-400" />

            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                step === 'reason' ? 'bg-[#315243] text-white' : 'bg-stone-200 text-stone-500'
              }`}>
                2
              </span>
              <span className={`font-semibold ${step === 'reason' ? 'text-stone-900' : 'text-stone-500'}`}>
                2. Explain Reason
              </span>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="mx-5 mt-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* STEP 1: SELECT MESSAGES */}
          {step === 'select' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-stone-900">
                    Which message(s) are you reporting?
                  </h4>
                  <p className="text-xs text-stone-600 mt-0.5">
                    Click any message to check or uncheck it.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-[11px] font-semibold text-[#315243] hover:underline px-2 py-1 rounded bg-[#EBF2EE] cursor-pointer"
                  >
                    Select All
                  </button>
                  {selectedMessageIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="text-[11px] font-semibold text-stone-500 hover:text-stone-700 px-2 py-1 rounded bg-stone-100 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {selectableMessages.length === 0 ? (
                <div className="text-center py-8 text-xs text-stone-500 bg-stone-50 rounded-2xl border border-stone-200">
                  <MessageSquare className="w-6 h-6 text-stone-400 mx-auto mb-2" />
                  No messages found in this discussion to select.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {selectableMessages.map((msg) => {
                    const isSelected = selectedMessageIds.includes(msg.id);
                    const isUser = msg.sender === 'user';
                    const isTeam = msg.sender === 'team';

                    return (
                      <div
                        key={msg.id}
                        id={`report-msg-item-${msg.id}`}
                        onClick={() => toggleMessage(msg.id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                          isSelected
                            ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-400/30 shadow-xs'
                            : 'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50/80'
                        }`}
                      >
                        <div className="pt-0.5 shrink-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by parent div onClick
                            className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-stone-300 cursor-pointer"
                          />
                        </div>

                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              isUser 
                                ? 'bg-stone-200 text-stone-800' 
                                : isTeam 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {isUser ? 'You' : (msg.senderName || 'Listening Team')}
                            </span>
                            <span className="text-[10px] text-stone-400">
                              {msg.timestamp}
                            </span>
                          </div>

                          <p className="text-xs text-stone-800 leading-relaxed break-words">
                            {msg.text}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: REASON FOR REPORT */}
          {step === 'reason' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-stone-900">
                  Why are you reporting this discussion?
                </h4>
                <p className="text-xs text-stone-600 mt-0.5">
                  Explain the issue clearly. This helps our Head of Listeners investigate and respond appropriately.
                </p>
              </div>

              {/* Selected messages preview banner */}
              <div className="p-3 bg-rose-50/80 rounded-2xl border border-rose-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-rose-900 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Flag className="w-3.5 h-3.5 text-rose-600" />
                    <span>{selectedMessagesList.length} message(s) included in this report</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep('select')}
                    className="text-[11px] text-rose-700 hover:underline cursor-pointer"
                  >
                    Edit messages
                  </button>
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                  {selectedMessagesList.map((m) => (
                    <div key={m.id} className="text-[11px] text-stone-700 truncate bg-white/70 px-2 py-1 rounded border border-rose-100">
                      <span className="font-semibold text-rose-800">{m.sender === 'user' ? 'You' : (m.senderName || 'Team')}:</span> {m.text}
                    </div>
                  ))}
                </div>
              </div>

              {/* Textarea */}
              <div className="space-y-1">
                <label 
                  htmlFor="report-reason-input"
                  className="block text-xs font-semibold text-stone-800"
                >
                  Reason for reporting:
                </label>
                <textarea
                  id="report-reason-input"
                  rows={4}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Please describe why you are reporting this discussion in your own words..."
                  className="w-full text-xs sm:text-sm p-3 rounded-2xl border border-stone-300 focus:border-[#315243] focus:ring-2 focus:ring-[#315243]/20 outline-none text-stone-900 placeholder:text-stone-400 bg-[#FAF9F6]"
                />
              </div>

              <div className="text-[11px] text-stone-500 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>Our Head of Listeners will reply directly to your 3awdli Mailbox.</span>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS */}
          {step === 'success' && (
            <div className="py-6 text-center space-y-4 animate-in zoom-in-95">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8 text-emerald-700" />
              </div>

              <div>
                <h4 className="text-base font-bold text-stone-900 font-['Lora',serif]">
                  Report Submitted to Head of Listeners
                </h4>
                <p className="text-xs text-stone-600 mt-2 max-w-md mx-auto leading-relaxed">
                  Thank you for keeping 3awdli safe. Your report, along with the {createdReport?.reportedMessageIds.length || 0} flagged message(s) and your reason, has been delivered to every Head of Listeners account.
                </p>
              </div>

              <div className="bg-[#FAF7F2] border border-[#EAE3D6] rounded-2xl p-4 text-xs text-stone-700 max-w-md mx-auto text-left space-y-1.5">
                <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>Next Steps:</span>
                </div>
                <p className="text-[11px] text-stone-600 leading-relaxed">
                  Our clinical supervisors will review the entire conversation with your selected messages highlighted. When they write a reply, it will be delivered directly to your personal <strong>Mailbox</strong>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-[#FAF7F2] border-t border-[#EAE3D6] px-5 py-3.5 flex items-center justify-between shrink-0">
          {step === 'select' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                id="report-proceed-to-reason-btn"
                onClick={handleProceedToReason}
                disabled={selectedMessageIds.length === 0}
                className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                  selectedMessageIds.length > 0
                    ? 'bg-[#315243] text-white hover:bg-[#253E33]'
                    : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                }`}
              >
                <span>Continue ({selectedMessageIds.length} selected)</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {step === 'reason' && (
            <>
              <button
                type="button"
                onClick={() => setStep('select')}
                className="px-3.5 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                type="button"
                id="submit-discussion-report-btn"
                onClick={handleSubmit}
                disabled={isSubmitting || !reason.trim()}
                className={`px-5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                  reason.trim() && !isSubmitting
                    ? 'bg-rose-700 text-white hover:bg-rose-800'
                    : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit Report'}</span>
              </button>
            </>
          )}

          {step === 'success' && (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 text-xs font-semibold rounded-xl bg-[#315243] text-white hover:bg-[#253E33] transition-colors cursor-pointer"
            >
              Close &amp; Return
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
