import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Play, Pause, Sparkles } from 'lucide-react';

type BreathingPhase = 'inhale' | 'hold' | 'exhale';

// Durations in milliseconds: Inhale (4s) → Hold (2s) → Exhale (6s) → Inhale (4s)...
const PHASE_DURATIONS: Record<BreathingPhase, number> = {
  inhale: 4000,
  hold: 2000,
  exhale: 6000,
};

// Phase sequence: Exhale flows directly into next Inhale with no gap
const NEXT_PHASE: Record<BreathingPhase, BreathingPhase> = {
  inhale: 'hold',
  hold: 'exhale',
  exhale: 'inhale',
};

const PHASE_LABELS: Record<BreathingPhase, string> = {
  inhale: 'Breathe in...',
  hold: 'Hold...',
  exhale: 'Breathe out...',
};

const PHASE_ACCENTS: Record<BreathingPhase, { ring: string; aura: string; badge: string }> = {
  inhale: {
    ring: '#90BED4',
    aura: 'rgba(162, 204, 226, 0.35)',
    badge: 'bg-[#EBF5FB] text-[#24526B] border-[#BEDEF0]',
  },
  hold: {
    ring: '#B4A2D8',
    aura: 'rgba(188, 172, 224, 0.35)',
    badge: 'bg-[#F4EFFC] text-[#4E3975] border-[#D9CEF0]',
  },
  exhale: {
    ring: '#9EC2AA',
    aura: 'rgba(172, 209, 184, 0.35)',
    badge: 'bg-[#EEF7F1] text-[#28573A] border-[#C3E2CE]',
  },
};

// Ambient sine wave audio synthesizer for peaceful breathing swell
class BreathingAudioSynth {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private isMuted = false;
  private isRunning = false;

  private initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.gain && this.ctx) {
      const now = this.ctx.currentTime;
      if (muted) {
        this.gain.gain.setValueAtTime(this.gain.gain.value, now);
        this.gain.gain.linearRampToValueAtTime(0.0001, now + 0.3);
      }
    }
  }

  public start() {
    if (this.isRunning) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      this.osc = ctx.createOscillator();
      this.gain = ctx.createGain();

      this.osc.type = 'sine'; // pure warm harmonic wave
      this.osc.frequency.setValueAtTime(174, ctx.currentTime); // 174Hz peaceful foundation

      this.gain.gain.setValueAtTime(0.0001, ctx.currentTime);

      this.osc.connect(this.gain);
      this.gain.connect(ctx.destination);

      this.osc.start();
      this.isRunning = true;
    } catch {
      // Audio is non-blocking
    }
  }

  public updatePhase(phase: BreathingPhase) {
    if (this.isMuted || !this.isRunning || !this.ctx || !this.gain || !this.osc) return;
    try {
      const now = this.ctx.currentTime;
      const durSec = PHASE_DURATIONS[phase] / 1000;

      if (phase === 'inhale') {
        // Rise gently in volume and pitch
        this.osc.frequency.cancelScheduledValues(now);
        this.osc.frequency.setValueAtTime(174, now);
        this.osc.frequency.linearRampToValueAtTime(216, now + durSec);

        this.gain.gain.cancelScheduledValues(now);
        this.gain.gain.setValueAtTime(Math.max(0.0001, this.gain.gain.value), now);
        this.gain.gain.linearRampToValueAtTime(0.045, now + durSec);
      } else if (phase === 'hold') {
        // Maintain a serene steady warmth
        this.gain.gain.cancelScheduledValues(now);
        this.gain.gain.setValueAtTime(0.045, now);
      } else if (phase === 'exhale') {
        // Gentle descent over 6 seconds
        this.osc.frequency.cancelScheduledValues(now);
        this.osc.frequency.setValueAtTime(216, now);
        this.osc.frequency.linearRampToValueAtTime(174, now + durSec);

        this.gain.gain.cancelScheduledValues(now);
        this.gain.gain.setValueAtTime(0.045, now);
        this.gain.gain.linearRampToValueAtTime(0.003, now + durSec);
      }
    } catch {
      // Audio is non-blocking
    }
  }

  public stop() {
    if (this.gain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.gain.gain.linearRampToValueAtTime(0.0001, now + 0.3);
      } catch {}
    }
    setTimeout(() => {
      try {
        this.osc?.stop();
        this.osc?.disconnect();
        this.gain?.disconnect();
      } catch {}
      this.isRunning = false;
      this.osc = null;
      this.gain = null;
    }, 350);
  }
}

export const BreathingPebbleGame: React.FC = () => {
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [phase, setPhase] = useState<BreathingPhase>('inhale');
  const [countdown, setCountdown] = useState<number>(4);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true); // Sound ON by default

  const synthRef = useRef<BreathingAudioSynth | null>(null);
  const phaseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize synth
  useEffect(() => {
    const synth = new BreathingAudioSynth();
    synth.setMuted(!soundEnabled);
    synthRef.current = synth;

    return () => {
      synthRef.current?.stop();
    };
  }, []);

  // Update mute/running state
  useEffect(() => {
    synthRef.current?.setMuted(!soundEnabled);
    if (soundEnabled && hasStarted && !isPaused) {
      synthRef.current?.start();
      synthRef.current?.updatePhase(phase);
    }
  }, [soundEnabled, hasStarted, isPaused, phase]);

  const handleStart = () => {
    setHasStarted(true);
    setIsPaused(false);
    setPhase('inhale');
    setCountdown(4);
    if (soundEnabled) {
      synthRef.current?.start();
      synthRef.current?.updatePhase('inhale');
    }
  };

  // Main automatic breathing cycle loop with 1-second countdown ticker
  useEffect(() => {
    if (!hasStarted || isPaused) {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      return;
    }

    // Initialize countdown for this phase
    const totalSeconds = PHASE_DURATIONS[phase] / 1000;
    setCountdown(totalSeconds);

    // Audio swell update
    synthRef.current?.updatePhase(phase);

    // Countdown interval (decrements every 1000ms)
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);

    // Phase transition timeout
    phaseTimerRef.current = setTimeout(() => {
      setPhase((prev) => NEXT_PHASE[prev]);
    }, PHASE_DURATIONS[phase]);

    return () => {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [hasStarted, phase, isPaused]);

  // Transition style for character breathing motion:
  // - Inhale (4s): Chest and shoulders expand and rise gracefully
  // - Hold (2s): Sustained gentle expansion
  // - Exhale (6s): Slower, calming descent directly into the next breath
  const getBreathingTransform = () => {
    if (!hasStarted) {
      return 'translateY(0px) scale(1, 1)';
    }
    switch (phase) {
      case 'inhale':
        return 'translateY(-8px) scale(1.06, 1.05)';
      case 'hold':
        return 'translateY(-8px) scale(1.06, 1.05)';
      case 'exhale':
        return 'translateY(0px) scale(1, 1)';
      default:
        return 'translateY(0px) scale(1, 1)';
    }
  };

  const getTransitionDuration = () => {
    if (!hasStarted || isPaused) return '0.4s';
    if (phase === 'inhale') return '4s';
    if (phase === 'exhale') return '6s';
    return '2s'; // hold
  };

  const currentAccent = PHASE_ACCENTS[phase];

  return (
    <div
      id="breathing-characters-container"
      className="w-full max-w-2xl mx-auto select-none font-['Plus_Jakarta_Sans',sans-serif]"
    >
      {/* Outer Card Container */}
      <div className="bg-white/85 backdrop-blur-sm border border-[#E8E1D5] rounded-3xl p-5 sm:p-8 shadow-xs">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-[#EAF2ED] border border-[#D0E2D6] flex items-center justify-center text-[#2A4C3B]">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-[#1C2E24] font-['Lora',serif]">
                Breathing Pals
              </h2>
              <p className="text-[11px] text-[#6D7D74]">Rhythmic Calming with Companions</p>
            </div>
          </div>

          {/* Controls: Start/Play/Pause and Mute/Unmute */}
          <div className="flex items-center gap-2">
            {!hasStarted ? (
              <button
                type="button"
                id="breathing-header-start-btn"
                onClick={handleStart}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#2A4C3B] hover:bg-[#1E372A] text-white text-xs font-medium transition-colors cursor-pointer shadow-2xs"
                title="Start breathing session"
                aria-label="Start breathing session"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start</span>
              </button>
            ) : (
              <button
                type="button"
                id="breathing-pause-btn"
                onClick={() => setIsPaused(!isPaused)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/85 hover:bg-white text-[#4A5D52] hover:text-[#1E3327] border border-[#E0D7C9] text-xs font-medium transition-colors cursor-pointer shadow-2xs"
                title={isPaused ? 'Resume breathing cycle' : 'Pause breathing cycle'}
                aria-label={isPaused ? 'Resume breathing cycle' : 'Pause breathing cycle'}
              >
                {isPaused ? (
                  <>
                    <Play className="w-3.5 h-3.5 text-[#2A4C3B] fill-current" />
                    <span className="text-[11px] text-[#335644] font-medium hidden sm:inline">
                      Resume
                    </span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5 text-[#5D6F64]" />
                    <span className="text-[11px] text-[#5D6F64] font-medium hidden sm:inline">
                      Pause
                    </span>
                  </>
                )}
              </button>
            )}

            {/* Sound Toggle Button (ON by default, matching Companion & Heartbeat) */}
            <button
              type="button"
              id="breathing-sound-toggle-btn"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/85 hover:bg-white text-[#4A5D52] hover:text-[#1E3327] border border-[#E0D7C9] text-xs font-medium transition-colors cursor-pointer shadow-2xs"
              title={soundEnabled ? 'Mute soothing sound' : 'Unmute soothing sound'}
              aria-label={soundEnabled ? 'Mute soothing sound' : 'Unmute soothing sound'}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-[#2A4C3B]" />
                  <span className="text-[11px] text-[#335644] font-medium hidden sm:inline">
                    Sound On
                  </span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-[#8A9A90]" />
                  <span className="text-[11px] text-[#788880] font-medium hidden sm:inline">
                    Muted
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Peaceful Center Stage */}
        <div
          id="breathing-stage"
          className="relative bg-gradient-to-b from-[#FBF9F5] to-[#F5EFEB] border border-[#EAE3D7] rounded-3xl min-h-[430px] sm:min-h-[470px] flex flex-col items-center justify-between p-6 sm:p-8 overflow-hidden shadow-inner"
        >
          {/* Subtle Ambient Radial Aura behind characters */}
          <div
            className="absolute pointer-events-none rounded-full blur-3xl transition-all"
            style={{
              width: '360px',
              height: '360px',
              top: '15%',
              background: !hasStarted ? 'rgba(215, 228, 222, 0.3)' : currentAccent.aura,
              transitionDuration: getTransitionDuration(),
              transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />

          {/* Top Status Area: Start Button or Phase Text Cue + Countdown Badge */}
          <div className="relative z-10 flex flex-col items-center justify-center pt-2 min-h-[52px]">
            {!hasStarted ? (
              <button
                type="button"
                id="breathing-start-main-btn"
                onClick={handleStart}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#2A4C3B] hover:bg-[#1E372A] text-white text-sm font-medium shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start</span>
              </button>
            ) : (
              <div className="flex items-center gap-3">
                {/* Calm Countdown Number Badge */}
                <div
                  id="breathing-countdown-badge"
                  className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl border flex items-center justify-center font-['Lora',serif] text-xl sm:text-2xl font-semibold shadow-2xs transition-colors duration-700 ${currentAccent.badge}`}
                >
                  {countdown}
                </div>

                {/* Minimal Phase Text Cue */}
                <span
                  key={phase}
                  className="text-lg sm:text-xl font-medium text-[#2C4235] font-['Lora',serif] tracking-wide"
                  style={{
                    animation: 'fadeInText 0.6s ease-in-out',
                  }}
                >
                  {PHASE_LABELS[phase]}
                </span>
              </div>
            )}
          </div>

          {/* Side-by-Side Cartoon Characters Breathing in Sync (Same flat style as cat/dog) */}
          <div className="relative z-10 flex items-end justify-center gap-6 sm:gap-12 w-full my-auto pt-4">
            {/* BOY CHARACTER */}
            <div className="flex flex-col items-center">
              <div
                className="transition-transform origin-bottom"
                style={{
                  transform: getBreathingTransform(),
                  transitionDuration: getTransitionDuration(),
                  transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <svg
                  viewBox="0 0 160 180"
                  className="w-36 h-40 sm:w-44 sm:h-48 select-none overflow-visible drop-shadow-2xs"
                  aria-label="Boy character breathing peacefully"
                >
                  <defs>
                    <linearGradient id="boySkinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#FFE0C8" />
                      <stop offset="100%" stopColor="#F5CBAA" />
                    </linearGradient>
                    <linearGradient id="boyHairGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#543A27" />
                      <stop offset="100%" stopColor="#3C2718" />
                    </linearGradient>
                    <linearGradient id="boySweaterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#8FB8A9" />
                      <stop offset="100%" stopColor="#759F90" />
                    </linearGradient>
                    <linearGradient id="boyPantsGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#5A6C77" />
                      <stop offset="100%" stopColor="#44535C" />
                    </linearGradient>
                  </defs>

                  {/* Soft Seated Shadow */}
                  <ellipse cx="80" cy="172" rx="46" ry="8" fill="#DFD6C8" opacity="0.65" />

                  {/* Crossed legs / cushion base */}
                  <ellipse cx="80" cy="162" rx="44" ry="15" fill="url(#boyPantsGrad)" />

                  {/* Cozy Sweater / Torso (Breaths in and out) */}
                  <path
                    d="M50 110 C48 95 62 86 80 86 C98 86 112 95 110 110 L115 152 C115 156 112 160 80 160 C48 160 45 156 45 152 Z"
                    fill="url(#boySweaterGrad)"
                  />

                  {/* Chest Highlight */}
                  <ellipse cx="80" cy="120" rx="18" ry="12" fill="#FFFFFF" opacity="0.16" />

                  {/* Sweater Neckband */}
                  <ellipse cx="80" cy="88" rx="14" ry="5" fill="#6B9384" />

                  {/* Resting Hands */}
                  <ellipse cx="60" cy="150" rx="7" ry="5" fill="url(#boySkinGrad)" />
                  <ellipse cx="100" cy="150" rx="7" ry="5" fill="url(#boySkinGrad)" />

                  {/* Neck */}
                  <rect x="74" y="76" width="12" height="15" rx="4" fill="url(#boySkinGrad)" />

                  {/* Rounded Boy Head */}
                  <circle cx="80" cy="54" r="32" fill="url(#boySkinGrad)" />

                  {/* Ears */}
                  <circle cx="48" cy="56" r="6" fill="url(#boySkinGrad)" />
                  <circle cx="112" cy="56" r="6" fill="url(#boySkinGrad)" />

                  {/* Soft Rosy Cheeks */}
                  <circle cx="62" cy="62" r="5" fill="#F7CAD0" opacity="0.65" />
                  <circle cx="98" cy="62" r="5" fill="#F7CAD0" opacity="0.65" />

                  {/* Peaceful Closed Eyes */}
                  <path
                    d="M 62 55 Q 68 62 74 55"
                    stroke="#4A3423"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    d="M 86 55 Q 92 62 98 55"
                    stroke="#4A3423"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    fill="none"
                  />

                  {/* Cute Calm Smile */}
                  <path
                    d="M 76 68 Q 80 72 84 68"
                    stroke="#593D28"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                  />

                  {/* Boy Hair Style (Tuft & bangs) */}
                  <path
                    d="M48 50 C48 24 64 20 80 20 C98 20 112 24 112 50 C112 40 106 32 96 30 C86 28 82 34 76 31 C68 28 58 35 48 50 Z"
                    fill="url(#boyHairGrad)"
                  />
                </svg>
              </div>
              <span className="text-xs font-medium text-[#6A7B72] mt-1">Leo</span>
            </div>

            {/* GIRL CHARACTER */}
            <div className="flex flex-col items-center">
              <div
                className="transition-transform origin-bottom"
                style={{
                  transform: getBreathingTransform(),
                  transitionDuration: getTransitionDuration(),
                  transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <svg
                  viewBox="0 0 160 180"
                  className="w-36 h-40 sm:w-44 sm:h-48 select-none overflow-visible drop-shadow-2xs"
                  aria-label="Girl character breathing peacefully"
                >
                  <defs>
                    <linearGradient id="girlSkinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#FFE0C8" />
                      <stop offset="100%" stopColor="#F5CBAA" />
                    </linearGradient>
                    <linearGradient id="girlHairGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#4E3321" />
                      <stop offset="100%" stopColor="#352012" />
                    </linearGradient>
                    <linearGradient id="girlSweaterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#BAA9D6" />
                      <stop offset="100%" stopColor="#A28EC2" />
                    </linearGradient>
                    <linearGradient id="girlPantsGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#5F5769" />
                      <stop offset="100%" stopColor="#484152" />
                    </linearGradient>
                  </defs>

                  {/* Soft Seated Shadow */}
                  <ellipse cx="80" cy="172" rx="46" ry="8" fill="#DFD6C8" opacity="0.65" />

                  {/* Crossed legs / cushion base */}
                  <ellipse cx="80" cy="162" rx="44" ry="15" fill="url(#girlPantsGrad)" />

                  {/* Cozy Sweater / Torso (Breaths in and out) */}
                  <path
                    d="M50 110 C48 95 62 86 80 86 C98 86 112 95 110 110 L115 152 C115 156 112 160 80 160 C48 160 45 156 45 152 Z"
                    fill="url(#girlSweaterGrad)"
                  />

                  {/* Chest Highlight */}
                  <ellipse cx="80" cy="120" rx="18" ry="12" fill="#FFFFFF" opacity="0.18" />

                  {/* Sweater Soft Peter Pan Collar */}
                  <path
                    d="M 68 88 Q 80 94 92 88 Q 80 86 68 88"
                    fill="#F7EFFE"
                    opacity="0.9"
                  />

                  {/* Resting Hands */}
                  <ellipse cx="60" cy="150" rx="7" ry="5" fill="url(#girlSkinGrad)" />
                  <ellipse cx="100" cy="150" rx="7" ry="5" fill="url(#girlSkinGrad)" />

                  {/* Neck */}
                  <rect x="74" y="76" width="12" height="15" rx="4" fill="url(#girlSkinGrad)" />

                  {/* Rounded Girl Head */}
                  <circle cx="80" cy="54" r="32" fill="url(#girlSkinGrad)" />

                  {/* Ears */}
                  <circle cx="48" cy="56" r="6" fill="url(#girlSkinGrad)" />
                  <circle cx="112" cy="56" r="6" fill="url(#girlSkinGrad)" />

                  {/* Soft Rosy Cheeks */}
                  <circle cx="62" cy="62" r="5" fill="#F7CAD0" opacity="0.65" />
                  <circle cx="98" cy="62" r="5" fill="#F7CAD0" opacity="0.65" />

                  {/* Peaceful Closed Eyes */}
                  <path
                    d="M 62 55 Q 68 62 74 55"
                    stroke="#4A3423"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    d="M 86 55 Q 92 62 98 55"
                    stroke="#4A3423"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    fill="none"
                  />

                  {/* Sweet Peaceful Smile */}
                  <path
                    d="M 76 68 Q 80 72 84 68"
                    stroke="#593D28"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                  />

                  {/* Cute Side Buns / Pigtails */}
                  <circle cx="44" cy="38" r="14" fill="url(#girlHairGrad)" />
                  <circle cx="116" cy="38" r="14" fill="url(#girlHairGrad)" />
                  <circle cx="45" cy="48" r="5" fill="#F8C8D4" />
                  <circle cx="115" cy="48" r="5" fill="#F8C8D4" />

                  {/* Girl Hair Bangs & Cap */}
                  <path
                    d="M48 52 C48 24 64 18 80 18 C98 18 112 24 112 52 C110 40 102 32 94 30 C86 28 80 34 74 30 C64 28 54 36 48 52 Z"
                    fill="url(#girlHairGrad)"
                  />
                </svg>
              </div>
              <span className="text-xs font-medium text-[#6A7B72] mt-1">Mia</span>
            </div>
          </div>

          {/* Bottom Gentle Instruction Text */}
          <div className="relative z-10 text-center pb-1">
            <p className="text-xs sm:text-sm text-[#6C7E74] font-medium tracking-wide">
              {!hasStarted
                ? 'Press Start to begin breathing with Leo and Mia.'
                : 'Breathe together with Leo and Mia.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
