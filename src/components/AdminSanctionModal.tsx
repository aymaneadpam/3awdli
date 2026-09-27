import React, { useState, useMemo } from 'react';
import {
  X,
  AlertTriangle,
  UserX,
  ShieldAlert,
  User,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Mail,
  Info,
  ShieldCheck,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import {
  DiscussionReport,
  DiscussionConversation,
  UserAccount,
  ReportSanction,
} from '../types';
import { getStoredUsers, banUserAccount, recordUserWarning, StoredUser } from '../utils/userManagement';
import { addUserMailboxMessage } from '../utils/userMailboxManagement';
import { addReportSanction } from '../utils/reportManagement';
import { banAnonymousSession } from '../utils/anonymousBanManagement';
import { getAllDiscussionParticipantsForModeration } from '../utils/discussionManagement';
import { useLanguage } from '../context/LanguageContext';
import { formatSiteDateReadable, formatSiteTime } from '../utils/timezoneManagement';

interface AdminSanctionModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: DiscussionReport;
  discussion: DiscussionConversation | null;
  currentUser: UserAccount;
  onSanctionApplied?: (sanction: ReportSanction) => void;
}

export interface SanctionCandidate {
  id: string;
  name: string;
  email?: string;
  hasAccount: boolean;
  role: string;
  isAnonymous: boolean;
  userAccount?: StoredUser;
  sessionId?: string;
}

export const AdminSanctionModal: React.FC<AdminSanctionModalProps> = ({
  isOpen,
  onClose,
  report,
  discussion,
  currentUser,
  onSanctionApplied,
}) => {
  const { language } = useLanguage();
  // Step flow: 'select_person' -> 'choose_action' -> 'confirm' -> 'completed'
  const [step, setStep] = useState<'select_person' | 'choose_action' | 'confirm' | 'completed'>('select_person');
  
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'warning' | 'ban' | null>(null);
  
  // Custom message options
  const [wantsCustomMessage, setWantsCustomMessage] = useState<boolean>(false);
  const [customMessage, setCustomMessage] = useState<string>('');
  
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [appliedSanction, setAppliedSanction] = useState<ReportSanction | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Discover and deduplicate all participants in the reported discussion
  const candidates = useMemo<SanctionCandidate[]>(() => {
    return getAllDiscussionParticipantsForModeration(report, discussion);
  }, [discussion, report]);

  const selectedCandidate = candidates.find((c) => c.id === selectedCandidateId) || null;

  const discussionRefLabel = report.discussionTitle
    ? `"${report.discussionTitle}" (ID: #${report.discussionId || report.id.slice(-6)})`
    : `Discussion #${report.discussionId || report.id.slice(-6)}`;

  const baseWarningMessage = language === 'fr'
    ? `Vous avez reçu un avertissement officiel d'un modérateur suite à la discussion suivante : ${discussionRefLabel}.`
    : `You have been warned by a moderator due to this discussion: ${discussionRefLabel}.`;

  const resetModal = () => {
    setStep('select_person');
    setSelectedCandidateId(null);
    setActionType(null);
    setWantsCustomMessage(false);
    setCustomMessage('');
    setIsApplying(false);
    setAppliedSanction(null);
    setErrorMessage(null);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!isOpen) return null;

  const handleProceedToActions = () => {
    if (!selectedCandidate) return;
    setErrorMessage(null);
    // If anonymous, warning is not possible per spec; pre-select ban or null
    if (!selectedCandidate.hasAccount) {
      setActionType('ban');
    } else {
      setActionType(null);
    }
    setStep('choose_action');
  };

  const handleProceedToConfirm = () => {
    if (!selectedCandidate || !actionType) return;
    setErrorMessage(null);
    setStep('confirm');
  };

  const handleExecuteSanction = async () => {
    if (!selectedCandidate || !actionType) return;

    setIsApplying(true);
    setErrorMessage(null);

    try {
      const now = new Date();
      const dateStr = formatSiteDateReadable(now);
      const timeStr = formatSiteTime(now);
      const formattedTimestamp = `${dateStr} • ${timeStr}`;
      const targetUserId = selectedCandidate.userAccount?.id || selectedCandidate.id;

      if (selectedCandidate.hasAccount && actionType === 'warning') {
        // --- 1. REGISTERED USER: WARNING ---
        // Construct full warning content
        let fullContent = baseWarningMessage;
        if (wantsCustomMessage && customMessage.trim()) {
          fullContent += `\n\nAdditional message from moderator:\n"${customMessage.trim()}"`;
        }
        fullContent += `\n\nPlease ensure your conduct in peer discussions complies with 3awdli safety policies and community guidelines. Further violations may lead to account restrictions or permanent suspension.`;

        // Send to their Mailbox
        addUserMailboxMessage(targetUserId, {
          userEmail: selectedCandidate.email,
          senderName: `${currentUser.name} (Platform Administrator)`,
          senderRole: 'admin',
          subject: `Official Moderator Warning — Regarding Discussion #${report.discussionId || report.id.slice(-6)}`,
          summary: `Warning regarding your conduct in ${report.discussionTitle || 'a peer discussion'}.`,
          content: fullContent,
          type: 'team_notice',
          relatedId: report.discussionId || report.id,
        });

        // Track and increment official warning count per member
        recordUserWarning(targetUserId, fullContent, currentUser);

        // Record on report
        const res = addReportSanction(report.id, {
          reportId: report.id,
          targetId: targetUserId,
          targetName: selectedCandidate.name,
          targetEmail: selectedCandidate.email,
          targetRole: selectedCandidate.role,
          targetType: 'registered',
          action: 'warning',
          warningMessage: baseWarningMessage,
          customMessage: wantsCustomMessage && customMessage.trim() ? customMessage.trim() : undefined,
          sanctionedByAdminId: currentUser.id,
          sanctionedByAdminName: currentUser.name,
          deliveryMethod: 'mailbox',
        });

        if (!res.success) {
          throw new Error(res.error || 'Failed to file sanction audit record');
        }

        setAppliedSanction(res.sanction || null);
        if (res.sanction && onSanctionApplied) {
          onSanctionApplied(res.sanction);
        }
        setStep('completed');
      } else if (selectedCandidate.hasAccount && actionType === 'ban') {
        // --- 2. REGISTERED USER: BAN ---
        const banNote = wantsCustomMessage && customMessage.trim()
          ? customMessage.trim()
          : `Permanently disabled following administrative review of Discussion #${report.discussionId || report.id.slice(-6)}.`;

        const banResult = banUserAccount(
          targetUserId,
          `Administrative ban on Discussion #${report.discussionId || report.id.slice(-6)}`,
          banNote,
          currentUser
        );

        if (!banResult.success) {
          throw new Error(banResult.error || 'Failed to ban user account.');
        }

        // Record sanction on report (note: direct email delivery)
        const res = addReportSanction(report.id, {
          reportId: report.id,
          targetId: targetUserId,
          targetName: selectedCandidate.name,
          targetEmail: selectedCandidate.email,
          targetRole: selectedCandidate.role,
          targetType: 'registered',
          action: 'ban',
          customMessage: wantsCustomMessage && customMessage.trim() ? customMessage.trim() : undefined,
          sanctionedByAdminId: currentUser.id,
          sanctionedByAdminName: currentUser.name,
          deliveryMethod: 'email',
        });

        if (!res.success) {
          throw new Error(res.error || 'Failed to file sanction audit record');
        }

        setAppliedSanction(res.sanction || null);
        if (res.sanction && onSanctionApplied) {
          onSanctionApplied(res.sanction);
        }
        setStep('completed');
      } else if (!selectedCandidate.hasAccount && actionType === 'ban') {
        // --- 3. ANONYMOUS USER: BROWSER DEVICE BAN ---
        const banNote = wantsCustomMessage && customMessage.trim()
          ? customMessage.trim()
          : `Anonymous device blocked after review of Discussion #${report.discussionId || report.id.slice(-6)}.`;

        const markerResult = banAnonymousSession({
          sessionId: selectedCandidate.sessionId,
          discussionId: report.discussionId,
          reason: banNote,
          adminName: currentUser.name,
        });

        if (!markerResult.success) {
          throw new Error('Failed to set persistent device marker.');
        }

        const res = addReportSanction(report.id, {
          reportId: report.id,
          targetId: selectedCandidate.sessionId || 'anon_session',
          targetName: 'Anonymous User',
          targetRole: 'Anonymous Session',
          targetType: 'anonymous',
          action: 'ban',
          customMessage: wantsCustomMessage && customMessage.trim() ? customMessage.trim() : undefined,
          sanctionedByAdminId: currentUser.id,
          sanctionedByAdminName: currentUser.name,
          deliveryMethod: 'browser_cookie',
        });

        if (!res.success) {
          throw new Error(res.error || 'Failed to file sanction audit record');
        }

        setAppliedSanction(res.sanction || null);
        if (res.sanction && onSanctionApplied) {
          onSanctionApplied(res.sanction);
        }
        setStep('completed');
      }
    } catch (err: any) {
      console.error('Failed to apply sanction:', err);
      setErrorMessage(err.message || 'An error occurred while executing the sanction.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sanction-modal-title"
    >
      <div className="bg-white rounded-3xl border border-[#DCD6CA] shadow-2xl max-w-xl w-full overflow-hidden transition-all my-8">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#EAE5DC] bg-[#FAF8F5] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 id="sanction-modal-title" className="text-base font-bold text-[#1E2E25]">
                {language === 'fr' ? 'Sanction de modération administrateur' : 'Administrator Moderation Sanction'}
              </h2>
              <p className="text-xs text-[#6F7F75] mt-0.5">
                {language === 'fr' ? 'Rapport' : 'Report'} #{report.id.slice(-6)} • {report.discussionTitle || (language === 'fr' ? 'Examen de la discussion' : 'Discussion Review')}
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-sanction-modal-btn"
            onClick={handleClose}
            className="p-1.5 rounded-xl border border-[#DCD6CA] text-[#6F7F75] hover:text-[#1E2E25] hover:bg-[#F2ECE1] transition-colors cursor-pointer"
            aria-label="Close sanction dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Progress Indicator */}
        <div className="px-6 pt-4 pb-2 bg-[#FAF8F5]/50 border-b border-[#F0EBE1] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                step === 'select_person'
                  ? 'bg-[#2E5A44] text-white'
                  : 'bg-[#D8E6DE] text-[#2E5A44]'
              }`}
            >
              1
            </span>
            <span className={step === 'select_person' ? 'font-bold text-[#1E2E25]' : 'text-[#6F7F75]'}>
              {language === 'fr' ? 'Sélectionner la personne' : 'Select Person'}
            </span>
          </div>

          <div className="h-0.5 w-8 bg-[#E5DFC4]" />

          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                step === 'choose_action'
                  ? 'bg-[#2E5A44] text-white'
                  : step === 'confirm' || step === 'completed'
                  ? 'bg-[#D8E6DE] text-[#2E5A44]'
                  : 'bg-[#ECE7DC] text-[#86958C]'
              }`}
            >
              2
            </span>
            <span className={step === 'choose_action' ? 'font-bold text-[#1E2E25]' : 'text-[#6F7F75]'}>
              {language === 'fr' ? 'Option de sanction' : 'Sanction Option'}
            </span>
          </div>

          <div className="h-0.5 w-8 bg-[#E5DFC4]" />

          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                step === 'confirm' || step === 'completed'
                  ? 'bg-[#2E5A44] text-white'
                  : 'bg-[#ECE7DC] text-[#86958C]'
              }`}
            >
              3
            </span>
            <span className={step === 'confirm' ? 'font-bold text-[#1E2E25]' : 'text-[#6F7F75]'}>
              {language === 'fr' ? 'Confirmation' : 'Confirmation'}
            </span>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: SELECT PERSON */}
          {step === 'select_person' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#1E2E25]">
                  {language === 'fr' ? 'Choisissez qui sanctionner dans cette discussion :' : 'Choose who in this discussion you want to sanction:'}
                </h3>
                <p className="text-xs text-[#5F6F65] mt-1">
                  {language === 'fr'
                    ? 'Liste des participants reconnus. Les membres inscrits possèdent des comptes pouvant être avertis ou désactivés.'
                    : 'List of recognized discussion participants. Registered members have accounts that can be warned or disabled.'}
                </p>
              </div>

              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {candidates.map((cand) => {
                  const isSelected = selectedCandidateId === cand.id;
                  return (
                    <button
                      key={cand.id}
                      type="button"
                      id={`candidate-btn-${cand.id}`}
                      onClick={() => setSelectedCandidateId(cand.id)}
                      className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-[#2E5A44] bg-[#F3F8F5] ring-2 ring-[#2E5A44]/15 shadow-xs'
                          : 'border-[#E0D9CB] bg-white hover:bg-[#FAF8F4]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                            cand.isAnonymous
                              ? 'bg-[#F2ECE1] border-[#DDD5C5] text-[#7A887E]'
                              : 'bg-[#EAF3EE] border-[#CDE1D6] text-[#2E5A44]'
                          }`}
                        >
                          {cand.isAnonymous ? <UserX className="w-5 h-5" /> : <User className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-[#1E2E25]">{cand.name}</span>
                            {cand.isAnonymous ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EAE4D7] text-[#69786E] font-semibold border border-[#DCD5C5]">
                                {language === 'fr' ? 'Utilisateur anonyme' : 'Anonymous User'}
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E8F1EC] text-[#2C4A3C] font-semibold border border-[#D0E2D8]">
                                {language === 'fr' ? 'Compte enregistré' : 'Registered Account'}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#6F7F75] mt-0.5">
                            {cand.role}
                            {cand.email && ` • ${cand.email}`}
                          </div>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-[#2E5A44] bg-[#2E5A44] text-white'
                            : 'border-[#CCC4B4] bg-white'
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-[#EAE5DC]">
                <button
                  type="button"
                  id="sanction-step1-cancel-btn"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#5A685F] hover:text-[#1E2E25] hover:bg-[#F2ECE1] transition-colors cursor-pointer"
                >
                  {language === 'fr' ? 'Annuler' : 'Cancel'}
                </button>
                <button
                  type="button"
                  id="sanction-step1-continue-btn"
                  disabled={!selectedCandidateId}
                  onClick={handleProceedToActions}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    selectedCandidateId
                      ? 'bg-[#2E5A44] hover:bg-[#244735] text-white shadow-xs'
                      : 'bg-[#E6E1D5] text-[#9A978E] cursor-not-allowed'
                  }`}
                >
                  <span>{language === 'fr' ? 'Continuer' : 'Continue'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: CHOOSE ACTION */}
          {step === 'choose_action' && selectedCandidate && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EAE5DC] flex items-center justify-between text-xs">
                <div>
                  <span className="text-[#6F7F75]">{language === 'fr' ? 'Participant cible : ' : 'Target Participant: '}</span>
                  <span className="font-bold text-[#1E2E25] ml-1">{selectedCandidate.name}</span>
                  {selectedCandidate.email && (
                    <span className="text-[#6F7F75] ml-1">({selectedCandidate.email})</span>
                  )}
                </div>
                <button
                  type="button"
                  id="sanction-change-participant-btn"
                  onClick={() => setStep('select_person')}
                  className="text-[#2E5A44] font-semibold hover:underline cursor-pointer"
                >
                  {language === 'fr' ? 'Modifier' : 'Change'}
                </button>
              </div>

              {/* REGISTERED USER OPTIONS */}
              {selectedCandidate.hasAccount ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-[#1E2E25]">
                    {language === 'fr' ? "Choisir l'action de sanction :" : 'Choose sanction action:'}
                  </h3>

                  {/* Option A: Send a Warning */}
                  <div
                    onClick={() => setActionType('warning')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      actionType === 'warning'
                        ? 'border-amber-500 bg-amber-50/40 ring-2 ring-amber-500/15 shadow-xs'
                        : 'border-[#E0D9CB] bg-white hover:bg-[#FAF8F4]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-[#1E2E25]">
                            {language === 'fr' ? 'Envoyer un avertissement' : 'Send a Warning'}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200 font-semibold">
                            {language === 'fr' ? 'Envoyé dans la boîte aux lettres' : 'Delivered to Mailbox'}
                          </span>
                        </div>
                        <p className="text-xs text-[#5C6E64] mt-1 leading-relaxed">
                          {language === 'fr'
                            ? 'Envoie une notification officielle directement dans sa boîte aux lettres privée :'
                            : 'Sends an official notification directly to their private Mailbox:'}
                        </p>
                        <div className="mt-2 p-2.5 rounded-xl bg-white border border-amber-200/80 text-[11.5px] text-[#29382F] italic">
                          &quot;{baseWarningMessage}&quot;
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Option B: Ban */}
                  <div
                    onClick={() => setActionType('ban')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      actionType === 'ban'
                        ? 'border-rose-600 bg-rose-50/40 ring-2 ring-rose-600/15 shadow-xs'
                        : 'border-[#E0D9CB] bg-white hover:bg-[#FAF8F4]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-800 border border-rose-300 flex items-center justify-center shrink-0 mt-0.5">
                        <UserX className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-[#1E2E25]">
                            {language === 'fr' ? 'Bannir le compte' : 'Ban Account'}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 border border-rose-200 font-semibold">
                            {language === 'fr' ? 'Désactiver définitivement' : 'Permanently Disable'}
                          </span>
                        </div>
                        <p className="text-xs text-[#5C6E64] mt-1 leading-relaxed">
                          {language === 'fr'
                            ? 'Désactive définitivement le compte, révoquant les sessions actives et bloquant les connexions futures.'
                            : 'Permanently disables their account, revoking active sessions and blocking login going forward.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Custom Message Field */}
                  {actionType && (
                    <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E4DDCF] space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          id="sanction-custom-msg-checkbox"
                          checked={wantsCustomMessage}
                          onChange={(e) => setWantsCustomMessage(e.target.checked)}
                          className="w-4 h-4 rounded text-[#2E5A44] focus:ring-[#2E5A44] border-gray-300"
                        />
                        <span className="text-xs font-semibold text-[#1E2E25]">
                          {actionType === 'warning'
                            ? (language === 'fr' ? 'Inclure un message personnalisé supplémentaire avec l’avertissement' : 'Include an additional custom message alongside the warning')
                            : (language === 'fr' ? 'Envoyer une explication personnalisée supplémentaire par e-mail' : 'Send an additional custom explanation message to their email')}
                        </span>
                      </label>

                      {wantsCustomMessage && (
                        <div className="space-y-1.5 pt-1">
                          <p className="text-[11px] text-[#69796E]">
                            {actionType === 'warning'
                              ? (language === 'fr' ? 'Cette note apparaîtra dans le message d’avertissement envoyé dans sa boîte aux lettres.' : 'This note will appear inside the warning message sent to their Mailbox.')
                              : (language === 'fr'
                                  ? `Le compte et la boîte aux lettres n’étant plus accessibles après le bannissement, cette note sera envoyée directement par e-mail (${selectedCandidate.email || 'adresse enregistrée'}).`
                                  : `Since their account and mailbox will no longer be accessible after the ban, this note will be sent directly to their email (${selectedCandidate.email || 'registered address'}).`)}
                          </p>
                          <textarea
                            id="sanction-custom-message-input"
                            rows={3}
                            value={customMessage}
                            onChange={(e) => setCustomMessage(e.target.value)}
                            placeholder={
                              actionType === 'warning'
                                ? (language === 'fr' ? 'Ajouter des précisions ou des consignes pour cet avertissement...' : 'Add specific guidance or context for this warning...')
                                : (language === 'fr' ? 'Expliquer la raison de ce bannissement de compte...' : 'Explain the reason for this account ban...')
                            }
                            className="w-full text-xs p-3 rounded-xl border border-[#D5CEC0] bg-white focus:border-[#2E5A44] outline-none text-[#1E2E25] placeholder-[#8A988F]"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* ANONYMOUS USER OPTIONS */
                <div className="space-y-4">
                  {/* Warning: Explicitly not applicable per requirements */}
                  <div className="p-4 rounded-2xl bg-[#F6F3EC] border border-[#E3DDD1] text-xs text-[#5A685F] space-y-2">
                    <div className="flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-[#7A8A7F] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-[#2A3930]">
                          {language === 'fr' ? 'Option d’avertissement non applicable :' : 'Warning Option Not Applicable:'}
                        </span>
                        <p className="mt-0.5 text-amber-900 font-medium">
                          {language === 'fr'
                            ? '« Cette personne n’a pas de compte, un avertissement direct ne peut pas être délivré. »'
                            : '“This person has no account, a direct warning cannot be delivered.”'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Ban Option for Anonymous */}
                  <div
                    onClick={() => setActionType('ban')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      actionType === 'ban'
                        ? 'border-rose-600 bg-rose-50/40 ring-2 ring-rose-600/15 shadow-xs'
                        : 'border-[#E0D9CB] bg-white hover:bg-[#FAF8F4]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-800 border border-rose-300 flex items-center justify-center shrink-0 mt-0.5">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-[#1E2E25]">
                            {language === 'fr' ? 'Bloquer l’appareil anonyme (marqueur navigateur)' : 'Ban Anonymous Device (Browser Marker)'}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 border border-rose-200 font-semibold">
                            {language === 'fr' ? 'Blocage d’appareil' : 'Device Block'}
                          </span>
                        </div>
                        <p className="text-xs text-[#5C6E64] mt-1.5 leading-relaxed">
                          {language === 'fr'
                            ? 'Applique un marqueur dans le navigateur (cookie persistant et marqueur local) pour cette session anonyme, bloquant ainsi le démarrage de nouvelles conversations.'
                            : 'Apply a browser-based marker (a persistent cookie and local device flag) to that anonymous session, marking this browser as blocked from starting new anonymous conversations going forward.'}
                        </p>

                        {/* Explicit specification requirement: Note soft/best-effort block */}
                        <div className="mt-3 p-3 rounded-xl bg-amber-50/80 border border-amber-200/90 text-[11.5px] text-amber-950 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">{language === 'fr' ? 'Avis aux administrateurs :' : 'Notice for Administrators:'}</span>{' '}
                            {language === 'fr'
                              ? <>Il s’agit d’un <span className="font-semibold underline">blocage partiel/au mieux</span> (contournable en effaçant les données du navigateur ou en changeant d’appareil), non garanti.</>
                              : <>This is a <span className="font-semibold underline">soft/best-effort block</span> (bypassable by clearing browser data or using a different device/browser), not a guaranteed one.</>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Optional explanation note */}
                  <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E4DDCF] space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        id="sanction-anon-custom-msg-checkbox"
                        checked={wantsCustomMessage}
                        onChange={(e) => setWantsCustomMessage(e.target.checked)}
                        className="w-4 h-4 rounded text-[#2E5A44] focus:ring-[#2E5A44] border-gray-300"
                      />
                      <span className="text-xs font-semibold text-[#1E2E25]">
                        {language === 'fr' ? 'Enregistrer un motif administratif pour ce blocage d’appareil' : 'Record an administrative reason for this device block'}
                      </span>
                    </label>

                    {wantsCustomMessage && (
                      <textarea
                        id="sanction-anon-custom-message-input"
                        rows={2}
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        placeholder={language === 'fr' ? 'Motif du blocage de cette session d’appareil anonyme...' : 'Reason for blocking this anonymous device session...'}
                        className="w-full text-xs p-3 rounded-xl border border-[#D5CEC0] bg-white focus:border-[#2E5A44] outline-none text-[#1E2E25] placeholder-[#8A988F]"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-between border-t border-[#EAE5DC]">
                <button
                  type="button"
                  id="sanction-step2-back-btn"
                  onClick={() => setStep('select_person')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#5A685F] hover:text-[#1E2E25] hover:bg-[#F2ECE1] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{language === 'fr' ? 'Retour' : 'Back'}</span>
                </button>
                <button
                  type="button"
                  id="sanction-step2-continue-btn"
                  disabled={!actionType}
                  onClick={handleProceedToConfirm}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    actionType
                      ? 'bg-[#2E5A44] hover:bg-[#244735] text-white shadow-xs'
                      : 'bg-[#E6E1D5] text-[#9A978E] cursor-not-allowed'
                  }`}
                >
                  <span>{language === 'fr' ? 'Vérifier la confirmation' : 'Review Confirmation'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: FINAL CONFIRMATION */}
          {step === 'confirm' && selectedCandidate && actionType && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    {/* Explicit user requirement: "Are you sure you want to [warn/ban] this person?" */}
                    <h3 className="text-sm font-bold text-rose-950">
                      {language === 'fr'
                        ? `Êtes-vous sûr de vouloir ${actionType === 'warning' ? 'avertir' : 'bannir'} cette personne ?`
                        : `Are you sure you want to ${actionType === 'warning' ? 'warn' : 'ban'} this person?`}
                    </h3>
                    <p className="text-xs text-rose-800/90 mt-1">
                      {language === 'fr'
                        ? 'Veuillez confirmer cette action de modération. Elle sera enregistrée dans le journal d’audit de ce rapport.'
                        : 'Please confirm this moderation action. It will be recorded in the audit trail of this report.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Sanction Summary Card */}
              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E3DDD1] space-y-3 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-[#EAE5DC]">
                  <span className="text-[#6F7F75]">{language === 'fr' ? 'Personne ciblée :' : 'Target Individual:'}</span>
                  <span className="font-bold text-[#1E2E25]">
                    {selectedCandidate.name} {selectedCandidate.email ? `(${selectedCandidate.email})` : ''}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-[#EAE5DC]">
                  <span className="text-[#6F7F75]">{language === 'fr' ? 'Action :' : 'Action:'}</span>
                  <span
                    className={`font-bold uppercase px-2 py-0.5 rounded text-[11px] ${
                      actionType === 'warning'
                        ? 'bg-amber-100 text-amber-900 border border-amber-200'
                        : 'bg-rose-100 text-rose-900 border border-rose-200'
                    }`}
                  >
                    {actionType === 'warning' ? (language === 'fr' ? 'Avertissement' : 'Warning') : (language === 'fr' ? 'Bannissement' : 'Ban')}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-[#EAE5DC]">
                  <span className="text-[#6F7F75]">{language === 'fr' ? 'Distribution / Mécanisme :' : 'Delivery / Mechanism:'}</span>
                  <span className="font-semibold text-[#1E2E25]">
                    {selectedCandidate.hasAccount
                      ? actionType === 'warning'
                        ? (language === 'fr' ? 'Envoyé dans la boîte aux lettres du membre' : "Delivered directly to Member's Mailbox")
                        : (language === 'fr' ? 'Désactivation du compte + explication par e-mail' : 'Disables Account + Email Explanation')
                      : (language === 'fr' ? 'Cookie persistant & marqueur local' : 'Browser Persistent Cookie & Local Device Flag')}
                  </span>
                </div>

                {actionType === 'warning' && (
                  <div className="py-1">
                    <span className="text-[#6F7F75] block mb-1">{language === 'fr' ? 'Message qui sera délivré :' : 'Message to be delivered:'}</span>
                    <div className="p-2.5 rounded-xl bg-white border border-[#DDD5C5] text-[11.5px] text-[#24332A] whitespace-pre-wrap">
                      {baseWarningMessage}
                      {wantsCustomMessage && customMessage.trim() && (
                        <>
                          {'\n\n'}
                          <span className="font-semibold text-[#1E2E25]">{language === 'fr' ? 'Note supplémentaire du modérateur :' : 'Additional moderator note:'}</span>
                          {'\n'}
                          &quot;{customMessage.trim()}&quot;
                        </>
                      )}
                    </div>
                  </div>
                )}

                {actionType === 'ban' && wantsCustomMessage && customMessage.trim() && (
                  <div className="py-1">
                    <span className="text-[#6F7F75] block mb-1">{language === 'fr' ? 'Explication personnalisée :' : 'Custom explanation:'}</span>
                    <div className="p-2.5 rounded-xl bg-white border border-[#DDD5C5] text-[11.5px] text-[#24332A]">
                      &quot;{customMessage.trim()}&quot;
                    </div>
                  </div>
                )}

                {!selectedCandidate.hasAccount && (
                  <div className="p-2.5 rounded-xl bg-[#F4EFE6] border border-[#DDD5C5] text-[11px] text-[#55645A]">
                    <span className="font-bold">{language === 'fr' ? 'Rappel :' : 'Reminder:'}</span>{' '}
                    {language === 'fr'
                      ? 'Les marqueurs d’appareils sont des blocages au mieux qui peuvent être effacés si l’utilisateur vide le cache de son navigateur.'
                      : 'Device markers are soft/best-effort blocks and can be cleared if the user wipes browser cookies and local cache.'}
                  </div>
                )}
              </div>

              {/* Final Confirm Buttons */}
              <div className="pt-3 flex items-center justify-between border-t border-[#EAE5DC]">
                <button
                  type="button"
                  id="sanction-step3-back-btn"
                  disabled={isApplying}
                  onClick={() => setStep('choose_action')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#5A685F] hover:text-[#1E2E25] hover:bg-[#F2ECE1] transition-colors cursor-pointer"
                >
                  {language === 'fr' ? 'Retour' : 'Back'}
                </button>
                <button
                  type="button"
                  id="sanction-step3-confirm-btn"
                  disabled={isApplying}
                  onClick={handleExecuteSanction}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer ${
                    actionType === 'warning'
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-rose-700 hover:bg-rose-800 text-white'
                  } ${isApplying ? 'opacity-70 cursor-wait' : ''}`}
                >
                  {isApplying ? (
                    <span>{language === 'fr' ? 'Application de la sanction...' : 'Applying Sanction...'}</span>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>{language === 'fr' ? `Confirmer ${actionType === 'warning' ? "l'avertissement" : 'le bannissement'}` : `Confirm ${actionType === 'warning' ? 'Warning' : 'Ban'}`}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: COMPLETED */}
          {step === 'completed' && appliedSanction && (
            <div className="text-center py-5 space-y-4">
              <div className="w-14 h-14 rounded-3xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-base font-bold text-[#1E2E25]">
                  {language === 'fr' ? 'Sanction appliquée avec succès' : 'Sanction Applied Successfully'}
                </h3>
                <p className="text-xs text-[#5F6F65] mt-1 max-w-sm mx-auto">
                  {appliedSanction.action === 'warning'
                    ? (language === 'fr' ? `Un avertissement formel a été envoyé dans la boîte aux lettres de ${appliedSanction.targetName}.` : `A formal warning has been delivered to ${appliedSanction.targetName}'s Mailbox.`)
                    : appliedSanction.targetType === 'registered'
                    ? (language === 'fr' ? `Le compte de ${appliedSanction.targetName} a été définitivement désactivé.` : `${appliedSanction.targetName}'s account has been permanently disabled.`)
                    : (language === 'fr' ? 'La session de navigation anonyme a été marquée et bloquée.' : 'The anonymous browser session has been flagged and blocked from starting new conversations.')}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E3DDD1] text-xs text-left max-w-md mx-auto space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#6F7F75]">{language === 'fr' ? 'ID de sanction :' : 'Sanction ID:'}</span>
                  <span className="font-mono text-[11px] text-[#1E2E25]">{appliedSanction.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6F7F75]">{language === 'fr' ? 'Cible :' : 'Target:'}</span>
                  <span className="font-bold text-[#1E2E25]">{appliedSanction.targetName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6F7F75]">{language === 'fr' ? 'Action :' : 'Action:'}</span>
                  <span className="font-bold uppercase text-[#1E2E25]">{appliedSanction.action === 'warning' && language === 'fr' ? 'AVERTISSEMENT' : appliedSanction.action === 'ban' && language === 'fr' ? 'BANNISSEMENT' : appliedSanction.action}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6F7F75]">{language === 'fr' ? 'Horodatage :' : 'Timestamp:'}</span>
                  <span className="text-[#1E2E25]">{appliedSanction.sanctionedAt}</span>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  id="sanction-completed-done-btn"
                  onClick={handleClose}
                  className="px-6 py-2.5 rounded-xl bg-[#2E5A44] hover:bg-[#244735] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  {language === 'fr' ? 'Terminé & Retourner au rapport' : 'Done & Return to Report'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
