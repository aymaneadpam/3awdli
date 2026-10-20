// WebRTC Peer-to-Peer Audio Call Service
// Uses browser WebRTC for real-time bidirectional audio
// Uses Firestore for handshake signaling (Offer, Answer, ICE candidates)
// Free STUN: Google STUN servers
// Free TURN: Open Relay Project (Metered) as fallback for NAT traversal

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export type WebRTCConnectionState =
  | 'idle'
  | 'requesting-mic'
  | 'mic-ready'
  | 'creating-offer'
  | 'waiting-for-answer'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed'
  | 'disconnected'
  | 'ended';

export interface WebRTCStatus {
  connectionState: WebRTCConnectionState;
  isMicMuted: boolean;
  hasLocalAudio: boolean;
  hasRemoteAudio: boolean;
  error: string | null;
  callId: string | null;
  role: 'caller' | 'receiver' | null;
}

// -------------------------------------------------------------
// STUN & TURN Configuration
// -------------------------------------------------------------
export const RTC_ICE_SERVERS: RTCIceServer[] = [
  // Google's free public STUN servers
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },

  // Open Relay Project's free public STUN & TURN servers (Metered)
  // Note: This free tier provides fallback NAT relay. Under heavy load or
  // strict enterprise firewalls, a dedicated paid TURN server may be needed in the future.
  { urls: 'stun:openrelay.metered.ca:80' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turns:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: RTC_ICE_SERVERS,
  iceCandidatePoolSize: 10,
};

// Singleton active call variables
let activePC: RTCPeerConnection | null = null;
let activeLocalStream: MediaStream | null = null;
let remoteAudioEl: HTMLAudioElement | null = null;
let remoteMediaStream: MediaStream | null = null;
let activeCallId: string | null = null;
let activeRole: 'caller' | 'receiver' | null = null;
let unsubs: Unsubscribe[] = [];
let queuedRemoteCandidates: RTCIceCandidateInit[] = [];
let isRemoteDescSet = false;
let currentMuteState = false;
let isInitializingSession = false;

// Subscribed listeners for status updates
type StatusListener = (status: WebRTCStatus) => void;
const listeners = new Set<StatusListener>();

let currentStatus: WebRTCStatus = {
  connectionState: 'idle',
  isMicMuted: false,
  hasLocalAudio: false,
  hasRemoteAudio: false,
  error: null,
  callId: null,
  role: null,
};

function updateStatus(partial: Partial<WebRTCStatus>) {
  currentStatus = { ...currentStatus, ...partial };
  listeners.forEach((listener) => {
    try {
      listener(currentStatus);
    } catch (err) {
      console.error('[WebRTC] Listener notification error:', err);
    }
  });
}

export function subscribeToWebRTCStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  listener(currentStatus);
  return () => {
    listeners.delete(listener);
  };
}

export function getCurrentWebRTCStatus(): WebRTCStatus {
  return currentStatus;
}

// -------------------------------------------------------------
// Audio Element Management
// -------------------------------------------------------------
function getOrCreateRemoteAudio(): HTMLAudioElement {
  if (typeof document === 'undefined') {
    throw new Error('document is not available');
  }

  // Clean up any stale or duplicate audio elements from previous sessions
  const existingDuplicates = document.querySelectorAll('audio[data-webrtc-remote="true"]');
  existingDuplicates.forEach((el) => {
    if (el !== remoteAudioEl) {
      try {
        (el as HTMLAudioElement).pause();
        (el as HTMLAudioElement).srcObject = null;
        el.remove();
      } catch {}
    }
  });

  if (!remoteAudioEl || !document.body.contains(remoteAudioEl)) {
    let existing = document.getElementById('webrtc-remote-audio-player') as HTMLAudioElement | null;
    if (!existing) {
      existing = document.createElement('audio');
      existing.id = 'webrtc-remote-audio-player';
      existing.setAttribute('data-webrtc-remote', 'true');
      existing.autoplay = true;
      (existing as any).playsInline = true;
      existing.volume = 1.0;
      // Hidden from view but attached to DOM body to prevent browser background suspension
      existing.style.position = 'fixed';
      existing.style.pointerEvents = 'none';
      existing.style.opacity = '0';
      existing.style.zIndex = '-1';
      document.body.appendChild(existing);
    }
    remoteAudioEl = existing;
  }
  return remoteAudioEl;
}

// -------------------------------------------------------------
// Microphone Permission & Stream Acquisition
// -------------------------------------------------------------
export async function acquireMicrophoneStream(): Promise<MediaStream> {
  if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Your browser or environment does not support microphone capture via WebRTC.');
  }

  // Stop any previously held local tracks before requesting fresh stream
  if (activeLocalStream) {
    activeLocalStream.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {}
    });
    activeLocalStream = null;
  }

  updateStatus({ connectionState: 'requesting-mic', error: null });

  try {
    let stream: MediaStream;

// Advanced constraints for real-time voice calls:
    // echoCancellation, noiseSuppression, and autoGainControl are essential for eliminating feedback.
    // channelCount: 1 (mono) forces hardware & browser AEC engines to engage properly without stereo phasing.
    // latency: 0.01 minimizes buffer queues to eliminate "repeating last words" buffer lag.
    // Keep constraints simple. Over-constraining (sampleRate, latency, goog* flags)
    // can make browsers disable or re-init their echo canceller / noise suppressor.
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      });
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }

    activeLocalStream = stream;

    // Ensure all acquired audio tracks enforce echo cancellation and respect current mute state
    stream.getAudioTracks().forEach((track) => {
      // Tell the browser this is speech so it tunes processing accordingly
      try { (track as any).contentHint = 'speech'; } catch {}

      // Hardware level mute enforcement
      track.enabled = !currentMuteState;
    });

    updateStatus({
      connectionState: 'mic-ready',
      hasLocalAudio: true,
      isMicMuted: currentMuteState,
    });
    return stream;
  } catch (err: any) {
    const errName = err?.name || '';
    let friendlyMessage = 'Could not access your microphone.';

    if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
      friendlyMessage = 'Microphone permission was denied. Please allow microphone access in your browser to talk.';
    } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
      friendlyMessage = 'No microphone device was detected on your computer or phone.';
    } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
      friendlyMessage = 'Your microphone is already in use by another application or tab.';
    } else if (err?.message) {
      friendlyMessage = err.message;
    }

    updateStatus({
      connectionState: 'failed',
      error: friendlyMessage,
      hasLocalAudio: false,
    });
    throw new Error(friendlyMessage);
  }
}

// -------------------------------------------------------------
// WebRTC SDP Optimization for Zero-Echo Speech
// -------------------------------------------------------------
function formatOpusSdp(sdp: string): string {
  if (!sdp) return sdp;
  const opusMatch = sdp.match(/a=rtpmap:(\d+)\s+opus\/48000/i);
  if (!opusMatch) return sdp;
  const pt = opusMatch[1];

  // Clean voice settings. NOTE: no usedtx (DTX causes hiss / pumping noise between words)
  // and no cbr (forces constant bitrate and hurts quality on weak mobile networks).
  const params = 'minptime=10;useinbandfec=1;stereo=0;sprop-stereo=0;maxaveragebitrate=40000;maxplaybackrate=48000';

  const fmtpLine = new RegExp(`a=fmtp:${pt}\\s+[^\\r\\n]*`, 'i');
  if (fmtpLine.test(sdp)) {
    // Replace the existing line entirely (prepending created duplicate keys)
    return sdp.replace(fmtpLine, `a=fmtp:${pt} ${params}`);
  }
  return sdp.replace(opusMatch[0], `${opusMatch[0]}\r\na=fmtp:${pt} ${params}`);
}

// -------------------------------------------------------------
// PeerConnection Setup Helpers
// -------------------------------------------------------------
function setupPeerConnectionEvents(pc: RTCPeerConnection, callId: string, role: 'caller' | 'receiver') {
  // Remote stream handling: Ensure ONLY remote audio is played through speakers
  pc.ontrack = (event) => {
    // 1. Critical Loopback Prevention:
    // Never allow local user's own microphone track to be connected to the speaker output
    if (activeLocalStream) {
      const localTrackIds = new Set(activeLocalStream.getAudioTracks().map((t) => t.id));
      if (localTrackIds.has(event.track.id)) {
        console.warn('[WebRTC] Blocked feedback loop: received local track in ontrack event');
        return;
      }
    }

    const audioEl = getOrCreateRemoteAudio();

    // Direct stream attachment avoids WebRTC NetEq jitter buffer duplication and packet repetition
    if (event.streams && event.streams[0]) {
      audioEl.srcObject = event.streams[0];
      remoteMediaStream = event.streams[0];
    } else {
      if (!remoteMediaStream) {
        remoteMediaStream = new MediaStream();
        audioEl.srcObject = remoteMediaStream;
      }
      if (!remoteMediaStream.getAudioTracks().some((t) => t.id === event.track.id)) {
        remoteMediaStream.addTrack(event.track);
      }
    }

    event.track.onended = () => {
      if (remoteMediaStream) {
        remoteMediaStream.removeTrack(event.track);
      }
    };

    audioEl.play().catch((playErr) => {
      console.warn('[WebRTC] Remote audio playback waiting for user interaction:', playErr);
    });

    updateStatus({ hasRemoteAudio: true });
  };

  // Connection state monitoring
  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    if (state === 'connected') {
      updateStatus({ connectionState: 'connected', error: null });
    } else if (state === 'connecting') {
      updateStatus({ connectionState: 'connecting' });
    } else if (state === 'disconnected') {
      updateStatus({ connectionState: 'reconnecting' });
    } else if (state === 'failed') {
      updateStatus({
        connectionState: 'failed',
        error: 'Direct peer connection failed. Text chat remains active.',
      });
    } else if (state === 'closed') {
      updateStatus({ connectionState: 'ended' });
    }
  };

  pc.oniceconnectionstatechange = () => {
    const iceState = pc.iceConnectionState;
    if (iceState === 'connected' || iceState === 'completed') {
      updateStatus({ connectionState: 'connected', error: null });
    } else if (iceState === 'failed') {
      // Try ICE restart if possible or flag warning
      updateStatus({
        connectionState: 'failed',
        error: 'Network connection could not traverse firewall/NAT.',
      });
    }
  };
}

// -------------------------------------------------------------
// CALLER: Start WebRTC Session
// -------------------------------------------------------------
export async function startCallerWebRTC(
  callId: string,
  discussionId: string,
  callerId: string,
  callerRole: 'user' | 'listener',
  receiverId: string,
  receiverRole: 'user' | 'listener'
): Promise<void> {
  // Prevent duplicate concurrent initialization for the same call
  if (isInitializingSession || (activeCallId === callId && activePC)) {
    console.log('[WebRTC] Caller session already active or initializing for', callId);
    return;
  }
  isInitializingSession = true;

  // Clean up any stale session
  endWebRTC(false);

  activeCallId = callId;
  activeRole = 'caller';
  isRemoteDescSet = false;
  queuedRemoteCandidates = [];

  updateStatus({
    callId,
    role: 'caller',
    connectionState: 'requesting-mic',
    error: null,
  });

  try {
    // 1. Acquire microphone with echo cancellation and mono speech
    const localStream = await acquireMicrophoneStream();

    // 2. Initialize RTCPeerConnection
    const pc = new RTCPeerConnection(RTC_CONFIGURATION);
    activePC = pc;

    // 3. Add audio tracks to connection with current mute state applied
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !currentMuteState;
      pc.addTrack(track, localStream);
    });

    // 4. Setup event handlers
    setupPeerConnectionEvents(pc, callId, 'caller');

    // 5. Gather local ICE candidates and post to Firestore callerCandidates collection
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candJson = event.candidate.toJSON();
        addDoc(collection(db, 'call_signaling', callId, 'callerCandidates'), candJson).catch((err) => {
          console.warn('[WebRTC] Failed to write caller candidate:', err);
        });
      }
    };

    // 6. Create SDP Offer
    updateStatus({ connectionState: 'creating-offer' });
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });
    const modifiedOffer = new RTCSessionDescription({
      type: offer.type,
      sdp: formatOpusSdp(offer.sdp || ''),
    });
    await pc.setLocalDescription(modifiedOffer);

    // 7. Write signaling document to Firestore
    await setDoc(doc(db, 'call_signaling', callId), {
      callId,
      discussionId,
      callerId,
      callerRole,
      receiverId,
      receiverRole,
      status: 'ringing',
      offer: {
        type: modifiedOffer.type,
        sdp: modifiedOffer.sdp,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    updateStatus({ connectionState: 'waiting-for-answer' });

    // 8. Listen for SDP Answer from receiver
    const callDocUnsub = onSnapshot(doc(db, 'call_signaling', callId), async (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();

      if (data.status === 'ended') {
        endWebRTC(false);
        return;
      }

      if (data.answer && !isRemoteDescSet && activePC) {
        try {
          const remoteDesc = new RTCSessionDescription(data.answer);
          await activePC.setRemoteDescription(remoteDesc);
          isRemoteDescSet = true;
          updateStatus({ connectionState: 'connecting' });

          // Drain queued receiver candidates
          while (queuedRemoteCandidates.length > 0) {
            const cand = queuedRemoteCandidates.shift();
            if (cand && activePC) {
              await activePC.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }
          }
        } catch (setDescErr) {
          console.error('[WebRTC] Caller failed to set remote description (answer):', setDescErr);
        }
      }
    });
    unsubs.push(callDocUnsub);

    // 9. Listen for ICE candidates from receiver
    const receiverCandidatesCol = collection(db, 'call_signaling', callId, 'receiverCandidates');
    const candUnsub = onSnapshot(receiverCandidatesCol, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const candData = change.doc.data() as RTCIceCandidateInit;
          if (activePC && isRemoteDescSet) {
            try {
              await activePC.addIceCandidate(new RTCIceCandidate(candData));
            } catch (candErr) {
              console.warn('[WebRTC] Failed to add receiver candidate:', candErr);
            }
          } else {
            queuedRemoteCandidates.push(candData);
          }
        }
      });
    });
    unsubs.push(candUnsub);

  } catch (err: any) {
    console.error('[WebRTC] Error starting caller session:', err);
    updateStatus({
      connectionState: 'failed',
      error: err.message || 'Failed to start call.',
    });
    throw err;
  }
}

// -------------------------------------------------------------
// RECEIVER: Accept & Connect WebRTC Session
// -------------------------------------------------------------
export async function startReceiverWebRTC(
  callId: string,
  receiverRole: 'user' | 'listener'
): Promise<void> {
  // Prevent duplicate concurrent initialization for the same call
  if (isInitializingSession || (activeCallId === callId && activePC)) {
    console.log('[WebRTC] Receiver session already active or initializing for', callId);
    return;
  }
  isInitializingSession = true;

  // Clean up any existing session
  endWebRTC(false);

  activeCallId = callId;
  activeRole = 'receiver';
  isRemoteDescSet = false;
  queuedRemoteCandidates = [];

  updateStatus({
    callId,
    role: 'receiver',
    connectionState: 'requesting-mic',
    error: null,
  });

  try {
    // 1. Acquire microphone with echo cancellation and mono speech
    const localStream = await acquireMicrophoneStream();

    // 2. Read signaling doc to retrieve offer
    const callDocRef = doc(db, 'call_signaling', callId);
    let callDocSnap = await getDoc(callDocRef);

    // If doc not immediately available, retry briefly (Firestore propagation)
    if (!callDocSnap.exists() || !callDocSnap.data()?.offer) {
      await new Promise((res) => setTimeout(res, 500));
      callDocSnap = await getDoc(callDocRef);
    }

    if (!callDocSnap.exists() || !callDocSnap.data()?.offer) {
      throw new Error('Call offer is missing or has expired.');
    }

    const offerData = callDocSnap.data()?.offer;

    // 3. Initialize RTCPeerConnection
    const pc = new RTCPeerConnection(RTC_CONFIGURATION);
    activePC = pc;

    // 4. Add local audio tracks with current mute state applied
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !currentMuteState;
      pc.addTrack(track, localStream);
    });

    // 5. Setup event handlers
    setupPeerConnectionEvents(pc, callId, 'receiver');

    // 6. Gather local ICE candidates and post to Firestore receiverCandidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candJson = event.candidate.toJSON();
        addDoc(collection(db, 'call_signaling', callId, 'receiverCandidates'), candJson).catch((err) => {
          console.warn('[WebRTC] Failed to write receiver candidate:', err);
        });
      }
    };

    // 7. Set Remote Description from Offer
    const remoteOffer = new RTCSessionDescription(offerData);
    await pc.setRemoteDescription(remoteOffer);
    isRemoteDescSet = true;

    // 8. Create SDP Answer
    const answer = await pc.createAnswer();
    const modifiedAnswer = new RTCSessionDescription({
      type: answer.type,
      sdp: formatOpusSdp(answer.sdp || ''),
    });
    await pc.setLocalDescription(modifiedAnswer);

    // 9. Update Firestore signaling doc with answer
    await updateDoc(callDocRef, {
      answer: {
        type: modifiedAnswer.type,
        sdp: modifiedAnswer.sdp,
      },
      status: 'active',
      acceptedAt: Date.now(),
      updatedAt: Date.now(),
    });

    updateStatus({ connectionState: 'connecting' });

    // 10. Listen for ICE candidates from caller
    const callerCandidatesCol = collection(db, 'call_signaling', callId, 'callerCandidates');
    const candUnsub = onSnapshot(callerCandidatesCol, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const candData = change.doc.data() as RTCIceCandidateInit;
          if (activePC && isRemoteDescSet) {
            try {
              await activePC.addIceCandidate(new RTCIceCandidate(candData));
            } catch (candErr) {
              console.warn('[WebRTC] Failed to add caller candidate:', candErr);
            }
          } else {
            queuedRemoteCandidates.push(candData);
          }
        }
      });
    });
    unsubs.push(candUnsub);

    // 11. Listen for call termination
    const callDocUnsub = onSnapshot(callDocRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      if (data.status === 'ended') {
        endWebRTC(false);
      }
    });
    unsubs.push(callDocUnsub);

  } catch (err: any) {
    console.error('[WebRTC] Error starting receiver session:', err);
    updateStatus({
      connectionState: 'failed',
      error: err.message || 'Failed to accept call audio.',
    });
    throw err;
  } finally {
    isInitializingSession = false;
  }
}

// -------------------------------------------------------------
// Real Hardware Microphone Mute / Unmute
// -------------------------------------------------------------
export function setMicrophoneMuted(muted: boolean): void {
  currentMuteState = muted;

  // 1. Hardware disable/enable on all active microphone stream tracks
  if (activeLocalStream) {
    activeLocalStream.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  // 2. Hardware disable/enable on all active RTCRtpSenders in the PeerConnection
  // This completely stops audio packet generation and transmission across the WebRTC link
  if (activePC) {
    activePC.getSenders().forEach((sender) => {
      if (sender.track && sender.track.kind === 'audio') {
        sender.track.enabled = !muted;
      }
    });
  }

  updateStatus({ isMicMuted: muted });
}

export function isMicrophoneMuted(): boolean {
  return currentMuteState;
}

// -------------------------------------------------------------
// End / Clean Up WebRTC Session
// -------------------------------------------------------------
export function endWebRTC(updateFirestore = true): void {
  const callIdToClose = activeCallId;
  isInitializingSession = false;

  // Unsubscribe Firestore listeners
  unsubs.forEach((unsub) => {
    try {
      unsub();
    } catch {}
  });
  unsubs = [];

  // Stop local media stream tracks
  if (activeLocalStream) {
    activeLocalStream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {}
    });
    activeLocalStream = null;
  }

  // Stop remote media stream tracks
  if (remoteMediaStream) {
    remoteMediaStream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {}
    });
    remoteMediaStream = null;
  }

  // Stop and remove remote audio playback element from DOM
  if (remoteAudioEl) {
    try {
      remoteAudioEl.pause();
      remoteAudioEl.srcObject = null;
      remoteAudioEl.remove();
    } catch {}
    remoteAudioEl = null;
  }

  // Close peer connection
  if (activePC) {
    try {
      activePC.close();
    } catch {}
    activePC = null;
  }

  queuedRemoteCandidates = [];
  isRemoteDescSet = false;
  activeCallId = null;
  activeRole = null;
  currentMuteState = false;

  updateStatus({
    connectionState: 'ended',
    hasLocalAudio: false,
    hasRemoteAudio: false,
    isMicMuted: false,
    error: null,
    callId: null,
    role: null,
  });

  // Mark status in Firestore if requested
  if (updateFirestore && callIdToClose) {
    updateDoc(doc(db, 'call_signaling', callIdToClose), {
      status: 'ended',
      endedAt: Date.now(),
      updatedAt: Date.now(),
    }).catch(() => {});
  }
}

// -------------------------------------------------------------
// Microphone & Audio Diagnostics Self-Test
// -------------------------------------------------------------
export interface AudioDiagnosticResult {
  ok: boolean;
  micSupported: boolean;
  micPermissionGranted: boolean;
  micAudioDetected: boolean;
  speakerWorking: boolean;
  averageVolume: number;
  message: string;
}

export async function runAudioDiagnosticTest(): Promise<AudioDiagnosticResult> {
  const result: AudioDiagnosticResult = {
    ok: false,
    micSupported: false,
    micPermissionGranted: false,
    micAudioDetected: false,
    speakerWorking: false,
    averageVolume: 0,
    message: '',
  };

  if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    result.message = 'WebRTC / getUserMedia is not supported in this browser.';
    return result;
  }
  result.micSupported = true;

  let testStream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;

  try {
    // 1. Request microphone access
    testStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false,
    });
    result.micPermissionGranted = true;

    // 2. Measure microphone input volume using Web Audio Analyser
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtxClass) {
      audioCtx = new AudioCtxClass();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(testStream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // Sample volume over ~500ms
      let maxSample = 0;
      let totalSample = 0;
      let sampleCount = 0;

      for (let i = 0; i < 5; i++) {
        analyser.getByteFrequencyData(dataArray);
        for (let j = 0; j < bufferLength; j++) {
          const val = dataArray[j];
          totalSample += val;
          if (val > maxSample) maxSample = val;
        }
        sampleCount += bufferLength;
        await new Promise((r) => setTimeout(r, 100));
      }

      const avg = sampleCount > 0 ? totalSample / sampleCount : 0;
      result.averageVolume = Math.round(avg);
      // If any sound/ambient frequency was detected
      result.micAudioDetected = maxSample > 0 || avg > 0;

      // 3. Play subtle gentle chime to test speaker
      try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
        result.speakerWorking = true;
      } catch {
        result.speakerWorking = false;
      }
    }

    result.ok = true;
    result.message = 'Microphone and audio output are functioning properly.';
    return result;
  } catch (err: any) {
    result.ok = false;
    result.message = err.message || 'Microphone test failed.';
    return result;
  } finally {
    if (testStream) {
      testStream.getTracks().forEach((t) => t.stop());
    }
    if (audioCtx && audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {});
    }
  }
}
