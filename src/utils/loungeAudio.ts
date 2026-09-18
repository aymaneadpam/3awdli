/**
 * Audio synthesizer for The Lounge notifications.
 * Generates an authentic, soothing mindfulness chime / bell sound using the Web Audio API.
 */

let sharedAudioContext: AudioContext | null = null;

function getLoungeAudioContext(): AudioContext | null {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
      sharedAudioContext = new AudioCtx();
    }
    if (sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

/**
 * Play the soothing Lounge queue turn notification bell.
 * Harmonic dual-chime with warm exponential decay.
 */
export function playLoungeBellSound(): void {
  try {
    const ctx = getLoungeAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Master gain for comfortable volume
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.35, now);
    masterGain.connect(ctx.destination);

    // Warm filter to soften transients
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, now);
    filter.connect(masterGain);

    // Tone 1: Fundamental meditation bell (E5 - 659.25Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    // Subtle gentle vibrato / pitch envelope
    osc1.frequency.exponentialRampToValueAtTime(658, now + 2.5);

    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.linearRampToValueAtTime(0.6, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);

    osc1.connect(gain1);
    gain1.connect(filter);

    // Tone 2: Harmonic overtone (B5 - 987.77Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now);

    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.linearRampToValueAtTime(0.35, now + 0.015);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

    osc2.connect(gain2);
    gain2.connect(filter);

    // Tone 3: Shimmer overtone (E6 - 1318.5Hz)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(1318.5, now);

    gain3.gain.setValueAtTime(0.0001, now);
    gain3.gain.linearRampToValueAtTime(0.18, now + 0.01);
    gain3.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

    osc3.connect(gain3);
    gain3.connect(filter);

    // Start oscillators
    osc1.start(now);
    osc2.start(now);
    osc3.start(now);

    // Stop after decay
    osc1.stop(now + 2.6);
    osc2.stop(now + 2.6);
    osc3.stop(now + 2.6);
  } catch (err) {
    console.warn('Lounge bell chime audio notice:', err);
  }
}
