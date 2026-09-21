import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, 
  PhoneCall, 
  PhoneOff, 
  PhoneIncoming, 
  PhoneForwarded, 
  Mic, 
  MicOff, 
  Clock, 
  Volume2, 
  VolumeX, 
  User, 
  Check, 
  X, 
  Sparkles,
  AlertCircle,
  Activity,
  Sliders,
  RefreshCw,
  Radio,
  ShieldCheck,
  Server,
  Headphones
} from 'lucide-react';
import { DiscussionConversation, DiscussionVoiceCall } from '../types';
import { 
  initiateVoiceCall, 
  acceptVoiceCall, 
  declineVoiceCall, 
  hangUpVoiceCall, 
  toggleMuteVoiceCall, 
  checkCallTimeout, 
  formatCallDuration, 
  canStartVoiceCall,
  CALL_RINGING_TIMEOUT_MS 
} from '../utils/voiceCallManagement';
import { 
  startIncomingRingtone, 
  startOutgoingRingback, 
  stopAllCallSounds, 
  playCallConnectedChime, 
  playCallEndedChime 
} from '../utils/callSoundService';
import { 
  startCallerWebRTC, 
  startReceiverWebRTC, 
  setMicrophoneMuted, 
  endWebRTC, 
  subscribeToWebRTCStatus, 
  getCurrentWebRTCStatus, 
  runAudioDiagnosticTest, 
  WebRTCStatus, 
  AudioDiagnosticResult,
  RTC_ICE_SERVERS
} from '../utils/webrtcCallService';
import { useLanguage } from '../context/LanguageContext';

export interface VoiceCallOverlayProps {
  discussion: DiscussionConversation;
  currentRole: 'user' | 'listener';
  currentUserId: string;
  currentUserName: string;
}

export const VoiceCallOverlay: React.FC<VoiceCallOverlayProps> = ({
  discussion,
  currentRole,
  currentUserId,
  currentUserName,
}) => {
  const { language } = useLanguage();
  const activeCall = discussion.activeCall;

  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [recentlyEndedNotice, setRecentlyEndedNotice] = useState<string | null>(null);
  const [webrtcStatus, setWebrtcStatus] = useState<WebRTCStatus>(getCurrentWebRTCStatus());
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);
  const [diagnosticTesting, setDiagnosticTesting] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<AudioDiagnosticResult | null>(null);
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const [isLocallyMuted, setIsLocallyMuted] = useState(false);

  const prevStatusRef = useRef<string | null>(null);
  const initializedCallerForCallId = useRef<string | null>(null);
  const initializedReceiverForCallId = useRef<string | null>(null);

  const isCaller = Boolean(
    activeCall && (activeCall.callerId === currentUserId || activeCall.callerRole === currentRole)
  );
  const isReceiver = Boolean(activeCall && !isCaller);

  // Subscribe to WebRTC status changes
  useEffect(() => {
    const unsub = subscribeToWebRTCStatus((status) => {
      setWebrtcStatus(status);
    });
    return unsub;
  }, []);

  // Sync Hardware Mute state whenever activeCall.isMuted changes
  useEffect(() => {
    if (activeCall?.status === 'active') {
      const isMutedInCall = Boolean(activeCall.isMuted?.[currentRole]);
      setIsLocallyMuted(isMutedInCall);
      setMicrophoneMuted(isMutedInCall);
    } else {
      setIsLocallyMuted(false);
      setMicrophoneMuted(false);
    }
  }, [activeCall?.isMuted?.[currentRole], activeCall?.status, currentRole]);

  // Manage Sound Ringtones based on Call Status
  useEffect(() => {
    if (!activeCall) {
      stopAllCallSounds();
      prevStatusRef.current = null;
      initializedCallerForCallId.current = null;
      initializedReceiverForCallId.current = null;
      setIsLocallyMuted(false);
      endWebRTC(false);
      return;
    }

    const currentStatus = activeCall.status;
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = currentStatus;

    if (currentStatus === 'ringing') {
      if (isReceiver) {
        startIncomingRingtone();
      } else {
        startOutgoingRingback();
      }
    } else if (currentStatus === 'active') {
      stopAllCallSounds();
      if (prevStatus === 'ringing') {
        playCallConnectedChime();
      }
    } else if (currentStatus === 'ended') {
      stopAllCallSounds();
      endWebRTC(false);
      initializedCallerForCallId.current = null;

      if (prevStatus === 'active' || prevStatus === 'ringing') {
        playCallEndedChime();
      }

      // Show brief ended notice
      if (activeCall.endedByRole === 'timeout') {
        setRecentlyEndedNotice(
          language === 'fr' 
            ? 'Appel sans réponse (délai dépassé)' 
            : language === 'ar'
            ? 'لم يتم الرد على المكالمة (انتهت المهلة)'
            : 'Call timed out (no answer)'
        );
      } else if (activeCall.acceptedAtTimestamp) {
        const sec = Math.max(0, Math.floor(((activeCall.endedAtTimestamp || Date.now()) - activeCall.acceptedAtTimestamp) / 1000));
        setRecentlyEndedNotice(
          language === 'fr'
            ? `Appel terminé • Durée : ${formatCallDuration(sec)}`
            : language === 'ar'
            ? `انتهت المكالمة • المدة: ${formatCallDuration(sec)}`
            : `Call ended • Duration: ${formatCallDuration(sec)}`
        );
      } else {
        setRecentlyEndedNotice(
          language === 'fr' 
            ? 'Appel refusé ou annulé' 
            : language === 'ar'
            ? 'تم رفض المكالمة أو إلغاؤها'
            : 'Call declined or cancelled'
        );
      }

      const timer = setTimeout(() => {
        setRecentlyEndedNotice(null);
      }, 4500);
      return () => clearTimeout(timer);
    }

    return () => {
      stopAllCallSounds();
    };
  }, [activeCall?.status, isReceiver, isCaller, language]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopAllCallSounds();
      endWebRTC(false);
    };
  }, []);

  // Timer loop for Active Call & Ringing Timeout check
  useEffect(() => {
    if (!activeCall) return;

    if (activeCall.status === 'active' && activeCall.acceptedAtTimestamp) {
      const updateTimer = () => {
        const elapsed = Math.max(0, Math.floor((Date.now() - (activeCall.acceptedAtTimestamp || Date.now())) / 1000));
        setCallDurationSeconds(elapsed);
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }

    if (activeCall.status === 'ringing') {
      const checkTimeout = () => {
        checkCallTimeout(discussion.id);
      };
      const interval = setInterval(checkTimeout, 1000);
      return () => clearInterval(interval);
    }
  }, [activeCall?.status, activeCall?.acceptedAtTimestamp, discussion.id]);

  // Local Mute State
  const isMutedLocally = isLocallyMuted;

  // Other participant's display name
  const otherPartyName = isCaller
    ? (activeCall?.receiverName || (currentRole === 'listener' ? 'Member' : 'Listener'))
    : (activeCall?.callerName || (currentRole === 'listener' ? 'Member' : 'Listener'));

  // Action Handlers
  const handleAccept = async () => {
    if (!activeCall) return;
    try {
      initializedReceiverForCallId.current = activeCall.id;
      acceptVoiceCall(discussion.id, currentRole);
      await startReceiverWebRTC(activeCall.id, currentRole);
    } catch (err) {
      console.error('[WebRTC] Receiver failed to accept and connect:', err);
    }
  };

  const handleJoinActiveCall = async () => {
    if (!activeCall) return;
    try {
      if (isCaller) {
        initializedCallerForCallId.current = activeCall.id;
        const receiverRole = currentRole === 'listener' ? 'user' : 'listener';
        const receiverId = currentRole === 'listener' 
          ? (discussion.userId || '') 
          : (discussion.openedByListenerId || discussion.joinedListenerId || '');
        await startCallerWebRTC(
          activeCall.id,
          discussion.id,
          currentUserId,
          currentRole,
          receiverId,
          receiverRole
        );
      } else {
        initializedReceiverForCallId.current = activeCall.id;
        await startReceiverWebRTC(activeCall.id, currentRole);
      }
    } catch (err) {
      console.error('[WebRTC] Failed to join active call audio:', err);
    }
  };

  const handleDecline = () => {
    endWebRTC(true);
    declineVoiceCall(discussion.id, currentRole);
  };

  const handleHangUp = () => {
    endWebRTC(true);
    hangUpVoiceCall(discussion.id, currentRole);
  };

  const handleToggleMute = () => {
    const nextMuted = !isLocallyMuted;
    setIsLocallyMuted(nextMuted);
    setMicrophoneMuted(nextMuted);
    toggleMuteVoiceCall(discussion.id, currentRole);
  };

  const handleRunDiagnostic = async () => {
    setDiagnosticTesting(true);
    setDiagnosticResult(null);
    try {
      const res = await runAudioDiagnosticTest();
      setDiagnosticResult(res);
    } finally {
      setDiagnosticTesting(false);
    }
  };

  // -------------------------------------------------------------
  // 1. RECENTLY ENDED NOTICE TOAST (Brief calm alert)
  // -------------------------------------------------------------
  if (recentlyEndedNotice && (!activeCall || activeCall.status === 'ended')) {
    return (
      <div className="w-full bg-[#FAF6F0] border-b border-[#EAE3D6] px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-[#4A5D52] animate-fadeIn shrink-0">
        <div className="flex items-center gap-2">
          <PhoneOff className="w-4 h-4 text-stone-500" />
          <span className="font-medium">{recentlyEndedNotice}</span>
        </div>
        <button
          onClick={() => setRecentlyEndedNotice(null)}
          className="text-stone-400 hover:text-stone-600 p-1 rounded-md cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  if (!activeCall || activeCall.status === 'ended') {
    return null;
  }

  // -------------------------------------------------------------
  // 2. INCOMING CALL MODAL (Receiver side while ringing)
  // -------------------------------------------------------------
  if (activeCall.status === 'ringing' && isReceiver) {
    return (
      <div 
        id="incoming-call-modal"
        className="relative z-30 w-full bg-linear-to-r from-[#1D3B2C] via-[#244A37] to-[#1D3B2C] text-white px-4 py-3 sm:py-3.5 border-b border-emerald-500/30 shadow-md animate-fadeIn shrink-0 box-border"
      >
        <div className="max-w-md mx-auto flex flex-col items-center justify-center gap-2.5 sm:gap-3 text-center">
          {/* Header Row: Pulsing Phone Icon + Caller Name + Status */}
          <div className="flex items-center gap-3">
            {/* Pulsing Phone Icon */}
            <div className="relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
                <PhoneIncoming className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
              </div>
            </div>

            <div className="text-left rtl:text-right">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm sm:text-base text-white tracking-wide truncate max-w-[200px] sm:max-w-[260px]">
                  {activeCall.callerName}
                </h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-300/30 font-medium shrink-0">
                  {language === 'fr' ? 'En attente' : language === 'ar' ? 'يرن' : 'Ringing'}
                </span>
              </div>
              <p className="text-xs text-emerald-200/90 font-medium">
                {language === 'fr' ? 'Appel vocal entrant...' : language === 'ar' ? 'مكالمة صوتية واردة...' : 'Incoming Voice Call...'}
              </p>
            </div>
          </div>

          {/* Action Buttons: Accept & Decline side-by-side with equal, clean proportions */}
          <div className="flex items-center gap-2.5 w-full max-w-xs sm:max-w-sm justify-center">
            <button
              id="voice-call-decline-btn"
              type="button"
              onClick={handleDecline}
              className="flex-1 px-4 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 whitespace-nowrap"
              title={language === 'fr' ? 'Refuser l\'appel' : language === 'ar' ? 'رفض المكالمة' : 'Decline call'}
            >
              <PhoneOff className="w-3.5 h-3.5 shrink-0" />
              <span>{language === 'fr' ? 'Refuser' : language === 'ar' ? 'رفض' : 'Decline'}</span>
            </button>

            <button
              id="voice-call-accept-btn"
              type="button"
              onClick={handleAccept}
              className="flex-1 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0F291C] text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95 animate-pulse whitespace-nowrap"
              title={language === 'fr' ? 'Accepter l\'appel et activer le micro' : language === 'ar' ? 'قبول المكالمة وتفعيل الصوت' : 'Accept call & enable audio'}
            >
              <PhoneCall className="w-3.5 h-3.5 shrink-0" />
              <span>{language === 'fr' ? 'Accepter' : language === 'ar' ? 'قبول' : 'Accept'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 3. OUTGOING CALLING BAR (Caller side while ringing)
  // -------------------------------------------------------------
  if (activeCall.status === 'ringing' && isCaller) {
    return (
      <div 
        id="outgoing-call-bar"
        className="w-full bg-[#203D2E] text-white px-3 py-2.5 sm:px-4 border-b border-emerald-600/30 shadow-xs animate-fadeIn shrink-0 box-border overflow-hidden"
      >
        <div className="w-full flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 basis-auto">
            <div className="relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <div className="relative w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                <PhoneForwarded className="w-4 h-4 animate-pulse" />
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-white truncate">
                  {language === 'fr' ? 'Appel en cours...' : language === 'ar' ? 'جارٍ الاتصال...' : 'Calling...'}
                </span>
                <span className="text-[10px] text-emerald-200/80 shrink-0">
                  ({language === 'fr' ? 'sonnerie en cours' : language === 'ar' ? 'يرن الآن' : 'ringing'})
                </span>
                {webrtcStatus.connectionState === 'mic-ready' && (
                  <span className="text-[9.5px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-medium shrink-0">
                    Mic Ready
                  </span>
                )}
              </div>
              <p className="text-[11px] text-emerald-200/80 truncate">
                {language === 'fr' ? 'En attente de' : language === 'ar' ? 'في انتظار' : 'Waiting for'}{' '}
                <strong className="text-white font-medium">{otherPartyName}</strong>
              </p>
            </div>
          </div>

          <button
            id="voice-call-cancel-btn"
            type="button"
            onClick={handleHangUp}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-xs active:scale-95 ml-auto"
            title={language === 'fr' ? 'Annuler l\'appel' : language === 'ar' ? 'إلغاء الاتصال' : 'Cancel call'}
          >
            <PhoneOff className="w-3.5 h-3.5 shrink-0" />
            <span>{language === 'fr' ? 'Annuler' : language === 'ar' ? 'إلغاء' : 'Cancel'}</span>
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 4. ACTIVE IN-CALL SCREEN / DOCKED BAR
  // -------------------------------------------------------------
  if (activeCall.status === 'active') {
    const isConnecting = webrtcStatus.connectionState === 'connecting' || webrtcStatus.connectionState === 'waiting-for-answer' || webrtcStatus.connectionState === 'creating-offer';
    const isConnected = webrtcStatus.connectionState === 'connected';
    const isReconnecting = webrtcStatus.connectionState === 'reconnecting';
    const isFailed = webrtcStatus.connectionState === 'failed';

    return (
      <div 
        id="active-voice-call-bar"
        className="w-full bg-[#1A3326] text-white border-b border-emerald-500/40 px-3 py-2 sm:px-4 sm:py-2.5 shadow-md animate-fadeIn shrink-0 box-border overflow-hidden"
      >
        <div className="w-full flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          {/* Active Call Info: Other person + Pulse + Live Timer + Connection Indicator */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 basis-auto">
            <div className="flex items-center gap-2 min-w-0">
              <div className="relative shrink-0">
                <span className={`w-2.5 h-2.5 rounded-full inline-block ${isConnected ? 'bg-emerald-400 animate-pulse' : isConnecting ? 'bg-amber-400 animate-pulse' : 'bg-rose-400'}`} />
                {isConnected && (
                  <span className="absolute -top-0.5 -left-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400/40 animate-ping" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-white tracking-wide truncate max-w-[120px] sm:max-w-[180px]">
                    {otherPartyName}
                  </span>

                  {/* WebRTC Audio State Tag */}
                  {isConnected ? (
                    <span className="text-[9.5px] px-1.5 py-0.2 rounded-full bg-emerald-500/25 text-emerald-200 border border-emerald-400/40 font-medium flex items-center gap-1 shrink-0">
                      <Radio className="w-2.5 h-2.5 text-emerald-300 animate-pulse" />
                      <span>{language === 'fr' ? 'En direct' : language === 'ar' ? 'مباشر' : 'Live Audio'}</span>
                    </span>
                  ) : isConnecting ? (
                    <span className="text-[9.5px] px-1.5 py-0.2 rounded-full bg-amber-500/25 text-amber-200 border border-amber-400/40 font-medium flex items-center gap-1 shrink-0">
                      <RefreshCw className="w-2.5 h-2.5 text-amber-300 animate-spin" />
                      <span>{language === 'fr' ? 'Connexion...' : language === 'ar' ? 'ربط...' : 'Connecting...'}</span>
                    </span>
                  ) : isReconnecting ? (
                    <span className="text-[9.5px] px-1.5 py-0.2 rounded-full bg-amber-600/30 text-amber-200 border border-amber-400/40 font-medium shrink-0">
                      {language === 'fr' ? 'Reconnexion...' : language === 'ar' ? 'إعادة الاتصال...' : 'Reconnecting...'}
                    </span>
                  ) : isFailed ? (
                    <span className="text-[9.5px] px-1.5 py-0.2 rounded-full bg-rose-500/30 text-rose-200 border border-rose-400/40 font-medium flex items-center gap-1 shrink-0">
                      <AlertCircle className="w-2.5 h-2.5 text-rose-300" />
                      <span>{language === 'fr' ? 'Relais limité' : language === 'ar' ? 'محدود' : 'Relay Limited'}</span>
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-emerald-200/90 font-mono">
                  <Clock className="w-3 h-3 text-emerald-300 shrink-0" />
                  <span className="shrink-0">{formatCallDuration(callDurationSeconds)}</span>
                  {isMutedLocally && (
                    <span className="ml-1 text-amber-300 font-sans text-[10px] font-semibold shrink-0">
                      • {language === 'fr' ? 'Micro coupé' : language === 'ar' ? 'مكتوم' : 'Muted'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Headphone note on wide screens */}
            <div className="hidden 2xl:flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-800/50 text-[10.5px] text-emerald-200 border border-emerald-600/40 shrink-0 ml-1">
              <Headphones className="w-3 h-3 text-emerald-300 shrink-0" />
              <span>
                {language === 'fr' 
                  ? 'Écouteurs conseillés' 
                  : language === 'ar' 
                  ? 'يُفضّل استخدام سماعات الرأس' 
                  : 'Headphones recommended'}
              </span>
            </div>
          </div>

          {/* Call Controls: Join Audio (if idle) / Diagnostics / Mute / Hang Up */}
          <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 shrink-0 max-w-full justify-end ml-auto">
            {webrtcStatus.connectionState === 'idle' ? (
              <button
                id="voice-call-join-btn"
                type="button"
                onClick={handleJoinActiveCall}
                className="h-8 px-2.5 sm:px-3 py-1 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-[#12241A] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0 whitespace-nowrap"
              >
                <Phone className="w-3 h-3 fill-current shrink-0" />
                <span>{language === 'fr' ? 'Rejoindre l\'audio' : language === 'ar' ? 'الانضمام للصوت' : 'Join Audio Call'}</span>
              </button>
            ) : (
              <>
                {/* Audio Diagnostics Modal Toggle */}
                <button
                  id="voice-call-diagnostics-btn"
                  type="button"
                  onClick={() => setShowDiagnosticModal(true)}
                  className="h-8 px-2 sm:px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-200 hover:text-white border border-white/20 text-xs font-medium flex items-center gap-1 transition-all cursor-pointer shrink-0 whitespace-nowrap"
                  title="Test microphone, speakers & WebRTC network"
                >
                  <Activity className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                  <span className="hidden xl:inline text-[11px]">
                    {language === 'fr' ? 'Statut audio' : language === 'ar' ? 'فحص الصوت' : 'Audio Status'}
                  </span>
                </button>

                {/* Mute/Unmute Real Hardware Input */}
                <button
                  id="voice-call-mute-toggle-btn"
                  type="button"
                  onClick={handleToggleMute}
                  className={`h-8 px-2.5 sm:px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 border shrink-0 whitespace-nowrap ${
                    isMutedLocally
                      ? 'bg-amber-600/90 hover:bg-amber-600 text-white border-amber-400/50 ring-2 ring-amber-400/30'
                      : 'bg-white/10 hover:bg-white/20 text-emerald-100 hover:text-white border-white/20'
                  }`}
                  title={isMutedLocally ? 'Unmute microphone' : 'Mute microphone'}
                >
                  {isMutedLocally ? (
                    <>
                      <MicOff className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                      <span>{language === 'fr' ? 'Micro coupé' : language === 'ar' ? 'مكتوم' : 'Muted'}</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                      <span>{language === 'fr' ? 'Couper micro' : language === 'ar' ? 'كتم' : 'Mute'}</span>
                    </>
                  )}
                </button>
              </>
            )}

            {/* Hang Up Real Call */}
            <button
              id="voice-call-hang-up-btn"
              type="button"
              onClick={handleHangUp}
              className="h-8 px-3 sm:px-3.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0 whitespace-nowrap"
              title={language === 'fr' ? 'Raccrocher et terminer l\'appel' : language === 'ar' ? 'إنهاء المكالمة' : 'Hang up call'}
            >
              <PhoneOff className="w-3.5 h-3.5 shrink-0" />
              <span>{language === 'fr' ? 'Raccrocher' : language === 'ar' ? 'إنهاء' : 'Hang Up'}</span>
            </button>
          </div>
        </div>

        {/* Real-time error notice if permission denied or relay failed */}
        {webrtcStatus.error && dismissedError !== webrtcStatus.error && (
          <div className="w-full mt-2 bg-rose-950/80 border border-rose-500/40 rounded-xl px-3 py-1.5 text-xs text-rose-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-rose-300 shrink-0" />
              <span>{webrtcStatus.error}</span>
            </div>
            <button 
              onClick={() => setDismissedError(webrtcStatus.error)}
              className="text-rose-300 hover:text-white p-0.5 rounded cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* AUDIO & WEBRTC DIAGNOSTICS MODAL */}
        {/* ------------------------------------------------------------- */}
        {showDiagnosticModal && (
          <div 
            id="audio-diagnostics-modal"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl max-w-md w-full p-5 text-stone-800 shadow-2xl border border-stone-200 animate-fadeIn">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#2F5342]" />
                  <h3 className="font-bold text-sm text-[#1A3326]">
                    {language === 'fr' ? 'Diagnostic Audio & Réseau' : language === 'ar' ? 'تشخيص الصوت والشبكة' : 'Audio & Network Diagnostics'}
                  </h3>
                </div>
                <button 
                  onClick={() => setShowDiagnosticModal(false)}
                  className="p-1 text-stone-400 hover:text-stone-600 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-4 space-y-3.5 text-xs">
                {/* Peer Connection Status */}
                <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#EAE4D9] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-600 font-medium">WebRTC Connection:</span>
                    <span className="font-mono font-bold capitalize px-2 py-0.5 rounded-full text-[10.5px] bg-emerald-100 text-emerald-800">
                      {webrtcStatus.connectionState}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-600 font-medium">Signaling Transport:</span>
                    <span className="font-mono text-stone-700">Firestore (Handshake & ICE)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-600 font-medium">Hardware Microphone:</span>
                    <span className="font-semibold text-stone-700">
                      {isMutedLocally ? 'Muted (Silent Frame Transmission)' : 'Active (Streaming)'}
                    </span>
                  </div>
                </div>

                {/* Echo Prevention & Audio Quality Guide */}
                <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200/80 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-900">
                    <Headphones className="w-3.5 h-3.5 text-[#2F5342]" />
                    <span>{language === 'fr' ? 'Élimination de l’écho & Qualité audio' : language === 'ar' ? 'منع الصدى وجودة الصوت' : 'Echo Prevention & Audio Tips'}</span>
                  </div>
                  <p className="text-[11px] text-stone-600 leading-relaxed">
                    {language === 'fr' 
                      ? 'L’écho ou effet « caverne » se produit lorsque les haut-parleurs de l’ordinateur retransmettent la voix dans le micro. Le système applique désormais une annulation d’écho stricte (AEC mono). Pour un son optimal, portez des écouteurs ou un casque.' 
                      : language === 'ar'
                      ? 'يحدث الصدى أو تكرار الصوت عندما تلتقط ميكروفونات الحاسوب الصوت الخارج من السماعات. تم تفعيل مانع الصدى وعزل الضوضاء تلقائيًا. يُنصح بارتداء سماعات الرأس لضمان صفاء تام.'
                      : 'Echo or repeating happens when external PC speakers bleed into the microphone. Hardware Acoustic Echo Cancellation (AEC) and Noise Suppression are actively enforced. Using headphones completely prevents speaker-to-mic feedback.'}
                  </p>
                </div>

                {/* STUN & TURN Infrastructure Transparency */}
                <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-stone-700">
                    <Server className="w-3.5 h-3.5 text-[#2F5342]" />
                    <span>STUN / TURN Relays</span>
                  </div>
                  <p className="text-[11px] text-stone-600 leading-relaxed">
                    Calls establish direct peer-to-peer audio via Google STUN servers. When strict firewalls or mobile NAT prevents direct connection, Open Relay Project free TURN relay is used as fallback.
                  </p>
                  <div className="text-[10px] text-stone-500 bg-amber-50 p-2 rounded-lg border border-amber-200/60">
                    <strong>Notice:</strong> Free TURN relay provides connectivity fallback. Under peak usage, relay speeds may have capacity limits.
                  </div>
                </div>

                {/* Self-Test Output */}
                {diagnosticTesting ? (
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-center gap-2 text-emerald-800">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Testing microphone and speaker output...</span>
                  </div>
                ) : diagnosticResult ? (
                  <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-emerald-900">Microphone Input:</span>
                      <span className={`font-semibold ${diagnosticResult.micAudioDetected ? 'text-emerald-700' : 'text-stone-600'}`}>
                        {diagnosticResult.micAudioDetected ? `Sound Detected (Level: ${diagnosticResult.averageVolume})` : 'Permission Granted, Waiting for voice'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-emerald-900">Speaker Test Tone:</span>
                      <span className="font-semibold text-emerald-700">
                        {diagnosticResult.speakerWorking ? 'Chime Played Successfully' : 'Ready'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-[11px] text-stone-600">
                    {language === 'fr' 
                      ? 'Cliquez sur "Tester l\'audio" ci-dessous pour vérifier votre microphone et vos haut-parleurs.'
                      : language === 'ar'
                      ? 'اضغط على "اختبار الصوت" أدناه لفحص الميكروفون ومكبر الصوت.'
                      : 'Click "Test Audio" below if you wish to verify your microphone and speakers.'}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleRunDiagnostic}
                  disabled={diagnosticTesting}
                  className="px-3 py-1.5 rounded-xl bg-[#2F5342] hover:bg-[#244234] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${diagnosticTesting ? 'animate-spin' : ''}`} />
                  <span>
                    {diagnosticResult 
                      ? (language === 'fr' ? 'Tester à nouveau' : language === 'ar' ? 'إعادة الاختبار' : 'Retest Audio')
                      : (language === 'fr' ? 'Tester l\'audio' : language === 'ar' ? 'اختبار الصوت' : 'Test Audio')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDiagnosticModal(false)}
                  className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium cursor-pointer"
                >
                  {language === 'fr' ? 'Fermer' : language === 'ar' ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

/**
 * CallButton Component
 * Small phone icon button to place inside the chat header
 * Visible ONLY for active discussions with registered users
 */
export interface CallButtonProps {
  discussion: DiscussionConversation;
  currentRole: 'user' | 'listener';
  currentUserId: string;
  currentUserName: string;
  className?: string;
  compact?: boolean;
  iconOnly?: boolean;
}

export const CallButton: React.FC<CallButtonProps> = ({
  discussion,
  currentRole,
  currentUserId,
  currentUserName,
  className = '',
  compact = false,
  iconOnly = false,
}) => {
  const { language } = useLanguage();
  const isEligible = canStartVoiceCall(discussion);

  if (!isEligible) {
    return null;
  }

  const activeCall = discussion.activeCall;
  const isOngoing = Boolean(activeCall && activeCall.status !== 'ended');

  const handleClick = () => {
    if (isOngoing) return;
    const updated = initiateVoiceCall(
      discussion.id,
      { id: currentUserId, name: currentUserName },
      currentRole
    );
    if (updated?.activeCall) {
      const receiverRole = currentRole === 'listener' ? 'user' : 'listener';
      const receiverId = currentRole === 'listener' 
        ? (discussion.userId || '') 
        : (discussion.openedByListenerId || discussion.joinedListenerId || '');

      startCallerWebRTC(
        updated.activeCall.id,
        discussion.id,
        currentUserId,
        currentRole,
        receiverId,
        receiverRole
      ).catch((err) => {
        console.error('[WebRTC] Caller initialization failed:', err);
      });
    }
  };

  if (iconOnly) {
    return (
      <button
        id="chat-initiate-voice-call-btn"
        type="button"
        onClick={handleClick}
        disabled={isOngoing}
        className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-all cursor-pointer ${
          isOngoing
            ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50 cursor-default animate-pulse'
            : 'bg-emerald-500 hover:bg-emerald-600 text-white border border-emerald-400/40 active:scale-95 shadow-xs'
        } ${className}`}
        title={
          isOngoing
            ? (language === 'fr' ? 'Appel vocal en cours' : language === 'ar' ? 'مكالمة صوتية جارية' : 'Voice call in progress')
            : (language === 'fr' ? 'Démarrer un appel vocal' : language === 'ar' ? 'بدء مكالمة صوتية' : 'Start voice call')
        }
        aria-label="Start Voice Call"
      >
        <Phone className="w-3.5 h-3.5 text-white shrink-0" />
      </button>
    );
  }

  return (
    <button
      id="chat-initiate-voice-call-btn"
      type="button"
      onClick={handleClick}
      disabled={isOngoing}
      className={`${
        compact
          ? 'h-7 px-2 py-0.5 rounded-lg text-[11px] gap-1'
          : 'h-8 px-2 sm:px-2.5 py-1 rounded-xl text-xs gap-1.5'
      } font-semibold flex items-center shrink-0 whitespace-nowrap transition-all cursor-pointer ${
        isOngoing
          ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50 cursor-default animate-pulse'
          : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 hover:text-white border border-emerald-400/35 active:scale-95'
      } ${className}`}
      title={
        isOngoing
          ? (language === 'fr' ? 'Appel vocal en cours' : language === 'ar' ? 'مكالمة صوتية جارية' : 'Voice call in progress')
          : (language === 'fr' ? 'Démarrer un appel vocal' : language === 'ar' ? 'بدء مكالمة صوتية' : 'Start voice call')
      }
      aria-label="Start Voice Call"
    >
      <Phone className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-emerald-300 shrink-0`} />
      <span className="hidden sm:inline">
        {isOngoing
          ? (language === 'fr' ? 'En appel' : language === 'ar' ? 'في مكالمة' : 'In Call')
          : compact
          ? (language === 'fr' ? 'Appel' : language === 'ar' ? 'اتصال' : 'Call')
          : (language === 'fr' ? 'Appel vocal' : language === 'ar' ? 'اتصال صوتي' : 'Voice Call')}
      </span>
    </button>
  );
};
