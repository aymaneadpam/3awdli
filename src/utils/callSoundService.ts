// Gentle Audio Service for Voice Calls
// Uses Web Audio API to synthesize calm, soothing call chimes and ringtones (non-jarring)

let audioCtx: AudioContext | null = null;
let ringInterval: NodeJS.Timeout | null = null;
let isRinging = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Play a single gentle dual-tone chime (calm, meditative, warm)
 */
function playGentlePulse(freq1: number, freq2: number, duration: number, gainValue = 0.08) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // First harmonic
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq1, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(gainValue, now + 0.08);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + duration);

    // Second harmonic (richer soothing chord)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq2, now + 0.04);
    gain2.gain.setValueAtTime(0.001, now + 0.04);
    gain2.gain.linearRampToValueAtTime(gainValue * 0.8, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.04);
    osc2.stop(now + duration);
  } catch {
    // Audio failures are non-blocking
  }
}

/**
 * Start gentle incoming ringtone (loops every 3 seconds)
 */
export function startIncomingRingtone(): void {
  if (isRinging) return;
  isRinging = true;

  // Immediate first pulse
  playGentlePulse(440, 554.37, 1.2, 0.09); // A4 + C#5 (warm major third)

  // Follow-up pulse in cycle
  setTimeout(() => {
    if (isRinging) {
      playGentlePulse(523.25, 659.25, 1.1, 0.08); // C5 + E5
    }
  }, 400);

  if (ringInterval) clearInterval(ringInterval);
  ringInterval = setInterval(() => {
    if (!isRinging) return;
    playGentlePulse(440, 554.37, 1.2, 0.09);
    setTimeout(() => {
      if (isRinging) {
        playGentlePulse(523.25, 659.25, 1.1, 0.08);
      }
    }, 400);
  }, 3200);
}

/**
 * Start outgoing ringback tone (caller side, mellow subtle pulse)
 */
export function startOutgoingRingback(): void {
  if (isRinging) return;
  isRinging = true;

  playGentlePulse(440, 480, 1.4, 0.04);

  if (ringInterval) clearInterval(ringInterval);
  ringInterval = setInterval(() => {
    if (!isRinging) return;
    playGentlePulse(440, 480, 1.4, 0.04);
  }, 3000);
}

/**
 * Stop all active ringtones and sounds
 */
export function stopAllCallSounds(): void {
  isRinging = false;
  if (ringInterval) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
}

/**
 * Play a pleasant positive connection chime when call is accepted
 */
export function playCallConnectedChime(): void {
  stopAllCallSounds();
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => { // C5, E5, G5
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      gain.gain.setValueAtTime(0.001, now + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.07, now + i * 0.1 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.3);
    });
  } catch {}
}

/**
 * Play a soft gentle call-ended tone
 */
export function playCallEndedChime(): void {
  stopAllCallSounds();
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    [659.25, 523.25].forEach((freq, i) => { // E5 -> C5 gentle descent
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.15);
      gain.gain.setValueAtTime(0.001, now + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.06, now + i * 0.15 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.28);
    });
  } catch {}
}
