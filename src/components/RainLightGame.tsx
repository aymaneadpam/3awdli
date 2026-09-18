import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Play, Pause, Sparkles, CloudRain, Flame } from 'lucide-react';

interface Ripple {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
}

interface FloatingLight {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  driftX: number;
}

interface Raindrop {
  id: number;
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
  speed: number;
  length: number;
  opacity: number;
  layer: 'back' | 'mid' | 'front';
}

// Neutral, soothing water ripple tones (soft rain blues, seafoam, warm honey, clear water)
const NEUTRAL_RIPPLE_COLORS = [
  'rgba(253, 230, 138, 0.45)', // warm honey glow
  'rgba(186, 216, 238, 0.50)', // soft slate rain blue
  'rgba(202, 228, 220, 0.45)', // calm sage mint
  'rgba(224, 231, 255, 0.45)', // subtle sky mist
  'rgba(254, 243, 199, 0.40)', // soft golden amber
];

// Pentatonic frequencies for calm water-drop chimes (C5, D5, E5, G5, A5)
const DROP_FREQUENCIES = [523.25, 587.33, 659.25, 783.99, 880.0];

// Ambient Soft Rain Audio Synthesizer (Zero-latency Web Audio API)
class RainAudioSynth {
  private ctx: AudioContext | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;
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
    if (this.noiseGain && this.ctx) {
      const now = this.ctx.currentTime;
      if (muted) {
        this.noiseGain.gain.setValueAtTime(this.noiseGain.gain.value, now);
        this.noiseGain.gain.linearRampToValueAtTime(0.0001, now + 0.3);
      } else if (this.isRunning) {
        this.noiseGain.gain.setValueAtTime(0.0001, now);
        this.noiseGain.gain.linearRampToValueAtTime(0.035, now + 0.5);
      }
    }
  }

  public start() {
    if (this.isRunning) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      // Generate 2 seconds of pink/soft noise for looped rain patter
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99 * b0 + white * 0.05;
        b1 = 0.95 * b1 + white * 0.03;
        b2 = 0.85 * b2 + white * 0.02;
        data[i] = (b0 + b1 + b2) * 0.35;
      }

      this.noiseSource = ctx.createBufferSource();
      this.noiseSource.buffer = buffer;
      this.noiseSource.loop = true;

      // Low-pass filter to sound like gentle rain against glass
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(650, ctx.currentTime);

      this.noiseGain = ctx.createGain();
      this.noiseGain.gain.setValueAtTime(this.isMuted ? 0.0001 : 0.035, ctx.currentTime);

      this.noiseSource.connect(filter);
      filter.connect(this.noiseGain);
      this.noiseGain.connect(ctx.destination);

      this.noiseSource.start();
      this.isRunning = true;
    } catch {
      // Audio is non-blocking
    }
  }

  public playSoftWaterDrop() {
    if (this.isMuted || !this.ctx || this.ctx.state === 'closed') return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const freq = DROP_FREQUENCIES[Math.floor(Math.random() * DROP_FREQUENCIES.length)];
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.85, now + 0.35);

      gain.gain.setValueAtTime(0.015, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    } catch {}
  }

  public stop() {
    if (this.noiseGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.noiseGain.gain.linearRampToValueAtTime(0.0001, now + 0.3);
      } catch {}
    }
    setTimeout(() => {
      try {
        this.noiseSource?.stop();
        this.noiseSource?.disconnect();
        this.noiseGain?.disconnect();
      } catch {}
      this.isRunning = false;
      this.noiseSource = null;
      this.noiseGain = null;
    }, 350);
  }
}

export const RainLightGame: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true); // Sound ON by default
  const [lightWarmth, setLightWarmth] = useState<number>(1); // Warmth intensity (1 to 2.4)
  const [isLightPressed, setIsLightPressed] = useState<boolean>(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [floatingLights, setFloatingLights] = useState<FloatingLight[]>([]);
  const [interactionCount, setInteractionCount] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const synthRef = useRef<RainAudioSynth | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const nextIdRef = useRef<number>(1);

  // Initialize rain audio synth
  useEffect(() => {
    const synth = new RainAudioSynth();
    synth.setMuted(!soundEnabled);
    synthRef.current = synth;

    const handleUnlock = () => {
      synthRef.current?.start();
      window.removeEventListener('pointerdown', handleUnlock);
      window.removeEventListener('keydown', handleUnlock);
      window.removeEventListener('touchstart', handleUnlock);
    };

    window.addEventListener('pointerdown', handleUnlock, { passive: true });
    window.addEventListener('keydown', handleUnlock, { passive: true });
    window.addEventListener('touchstart', handleUnlock, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', handleUnlock);
      window.removeEventListener('keydown', handleUnlock);
      window.removeEventListener('touchstart', handleUnlock);
      synthRef.current?.stop();
    };
  }, []);

  // Update sound state
  useEffect(() => {
    synthRef.current?.setMuted(!soundEnabled);
    if (soundEnabled && isPlaying) {
      synthRef.current?.start();
    }
  }, [soundEnabled, isPlaying]);

  // Initial Raindrops generation
  const [raindrops, setRaindrops] = useState<Raindrop[]>(() => {
    const drops: Raindrop[] = [];
    for (let i = 0; i < 40; i++) {
      drops.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        speed: 0.25 + Math.random() * 0.45,
        length: 12 + Math.random() * 18,
        opacity: 0.25 + Math.random() * 0.45,
        layer: i % 3 === 0 ? 'back' : i % 3 === 1 ? 'mid' : 'front',
      });
    }
    return drops;
  });

  // Animation Loop for raindrops and floating warm embers
  useEffect(() => {
    if (!isPlaying) return;

    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const delta = Math.min((currentTime - lastTime) / 16.66, 2.5);
      lastTime = currentTime;

      // Update falling raindrops
      setRaindrops((prev) =>
        prev.map((drop) => {
          let newY = drop.y + drop.speed * delta;
          let newX = drop.x - drop.speed * 0.1 * delta; // gentle angle in rain
          if (newY > 100) {
            newY = -5;
            newX = Math.random() * 100;
          }
          return { ...drop, x: newX, y: newY };
        })
      );

      // Update floating embers/motes of light
      setFloatingLights((prev) =>
        prev
          .map((item) => ({
            ...item,
            y: item.y - 0.35 * delta,
            x: item.x + item.driftX * delta,
            opacity: item.opacity - 0.007 * delta,
          }))
          .filter((item) => item.opacity > 0.02)
      );

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  // Handle click on the rain window pane
  const handlePaneClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    synthRef.current?.playSoftWaterDrop();

    const id = nextIdRef.current++;
    const color = NEUTRAL_RIPPLE_COLORS[id % NEUTRAL_RIPPLE_COLORS.length];

    // Add ripple
    setRipples((prev) => [...prev.slice(-12), { id, x, y, color, size: 70 }]);

    // Add floating golden light ember
    setFloatingLights((prev) => [
      ...prev.slice(-16),
      {
        id,
        x,
        y,
        size: 10 + Math.random() * 6,
        opacity: 0.9,
        driftX: (Math.random() - 0.5) * 0.35,
      },
    ]);

    setInteractionCount((c) => c + 1);

    // Auto-remove ripple after animation
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 1400);
  }, []);

  // Handle interacting with the central lantern/light
  const handleLightClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering pane click ripple
    synthRef.current?.playSoftWaterDrop();

    setIsLightPressed(true);
    setLightWarmth((w) => Math.min(w + 0.4, 2.4));

    // Emit gentle glowing light motes from lantern
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      for (let i = 0; i < 4; i++) {
        const id = nextIdRef.current++;
        setTimeout(() => {
          setFloatingLights((prev) => [
            ...prev.slice(-16),
            {
              id,
              x: centerX + (Math.random() - 0.5) * 36,
              y: centerY - 14 + (Math.random() - 0.5) * 24,
              size: 12 + Math.random() * 8,
              opacity: 0.95,
              driftX: (Math.random() - 0.5) * 0.45,
            },
          ]);
        }, i * 120);
      }
    }

    setTimeout(() => {
      setIsLightPressed(false);
    }, 400);

    // Gently return light back to peaceful baseline glow
    setTimeout(() => {
      setLightWarmth(1);
    }, 3500);
  };

  return (
    <div
      id="rain-light-game-container"
      className="w-full max-w-2xl mx-auto select-none font-['Plus_Jakarta_Sans',sans-serif]"
    >
      {/* Outer Card Container */}
      <div className="bg-white/85 backdrop-blur-sm border border-[#E8E1D5] rounded-3xl p-5 sm:p-8 shadow-xs">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-[#EDF3F7] border border-[#CBDCE7] flex items-center justify-center text-[#355268]">
              <CloudRain className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-[#1C2E24] font-['Lora',serif]">
                Rain & Light
              </h2>
              <p className="text-[11px] text-[#6D7D74]">Gentle Weather Sanctuary</p>
            </div>
          </div>

          {/* Controls: Play/Pause and Mute/Unmute */}
          <div className="flex items-center gap-2">
            {/* Play/Pause Button */}
            <button
              type="button"
              id="rain-light-pause-btn"
              onClick={() => setIsPlaying(!isPlaying)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/85 hover:bg-white text-[#4A5D52] hover:text-[#1E3327] border border-[#E0D7C9] text-xs font-medium transition-colors cursor-pointer shadow-2xs"
              title={isPlaying ? 'Pause rain animation' : 'Resume rain animation'}
              aria-label={isPlaying ? 'Pause rain animation' : 'Resume rain animation'}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-[#5D6F64]" />
                  <span className="text-[11px] text-[#5D6F64] font-medium hidden sm:inline">
                    Pause
                  </span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-[#2A4C3B] fill-current" />
                  <span className="text-[11px] text-[#335644] font-medium hidden sm:inline">
                    Resume
                  </span>
                </>
              )}
            </button>

            {/* Sound Toggle Button (ON by default, matching other games) */}
            <button
              type="button"
              id="rain-light-sound-toggle-btn"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/85 hover:bg-white text-[#4A5D52] hover:text-[#1E3327] border border-[#E0D7C9] text-xs font-medium transition-colors cursor-pointer shadow-2xs"
              title={soundEnabled ? 'Mute soothing rain sound' : 'Unmute soothing rain sound'}
              aria-label={soundEnabled ? 'Mute soothing rain sound' : 'Unmute soothing rain sound'}
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

        {/* Rain Window Scene */}
        <div
          ref={containerRef}
          id="rain-light-window-pane"
          onClick={handlePaneClick}
          className="relative bg-gradient-to-b from-[#C4D7E5] via-[#AFC8D8] to-[#99B6C7] border-4 border-[#E8E1D5] rounded-3xl min-h-[430px] sm:min-h-[470px] flex flex-col items-center justify-between p-6 sm:p-8 overflow-hidden shadow-inner cursor-pointer"
        >
          {/* Warm Amber Hearth Light Glow Spreading Against the Cool Rain */}
          <div
            className="absolute inset-0 pointer-events-none transition-all duration-700 ease-out"
            style={{
              background: `radial-gradient(circle at 50% 55%, rgba(254, 215, 122, ${
                0.28 * lightWarmth
              }) 0%, rgba(253, 230, 138, ${
                0.16 * lightWarmth
              }) 38%, rgba(245, 158, 11, ${0.04 * lightWarmth}) 65%, transparent 80%)`,
            }}
          />

          {/* Distant Misty Garden & Soft Fog Layers (Neutral flat hills) */}
          <div className="absolute inset-0 pointer-events-none opacity-30">
            <svg
              viewBox="0 0 400 300"
              preserveAspectRatio="none"
              className="w-full h-full object-cover"
            >
              <path
                d="M 0 240 Q 90 205 200 235 Q 310 265 400 220 L 400 300 L 0 300 Z"
                fill="#7F9DB4"
                opacity="0.5"
              />
              <path
                d="M 0 260 Q 120 230 240 255 Q 340 280 400 250 L 400 300 L 0 300 Z"
                fill="#6F8FA7"
                opacity="0.6"
              />
            </svg>
          </div>

          {/* Animated Falling Raindrops */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {raindrops.map((drop) => (
              <div
                key={drop.id}
                className="absolute rounded-full bg-white/75"
                style={{
                  left: `${drop.x}%`,
                  top: `${drop.y}%`,
                  width: drop.layer === 'front' ? '2px' : '1.5px',
                  height: `${drop.length}px`,
                  opacity: drop.opacity,
                  transform: 'rotate(-7deg)',
                  filter: drop.layer === 'back' ? 'blur(0.4px)' : 'none',
                }}
              />
            ))}
          </div>

          {/* Condensation Window Drops (Static soft droplets on the glass) */}
          <div className="absolute inset-0 pointer-events-none opacity-40">
            <div className="w-2.5 h-3.5 rounded-full bg-white/60 blur-[0.3px] absolute top-[25%] left-[18%]" />
            <div className="w-2 h-4 rounded-full bg-white/50 blur-[0.3px] absolute top-[45%] left-[28%]" />
            <div className="w-3 h-4 rounded-full bg-white/65 blur-[0.3px] absolute top-[30%] right-[22%]" />
            <div className="w-2 h-3 rounded-full bg-white/50 blur-[0.3px] absolute top-[65%] right-[32%]" />
            <div className="w-1.5 h-2.5 rounded-full bg-white/50 blur-[0.3px] absolute top-[75%] left-[38%]" />
          </div>

          {/* Window Frame Panes Cross-Mullion (Subtle architectural warmth) */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-25">
            <div className="w-full h-1 bg-[#F5EFEB]/60 backdrop-blur-2xs" />
            <div className="h-full w-1 bg-[#F5EFEB]/60 backdrop-blur-2xs absolute" />
          </div>

          {/* User Tap Ripples (Clear/amber water ripples) */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {ripples.map((ripple) => (
              <div
                key={ripple.id}
                className="absolute rounded-full border border-white/60 pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${ripple.x}px`,
                  top: `${ripple.y}px`,
                  width: `${ripple.size}px`,
                  height: `${ripple.size}px`,
                  backgroundColor: ripple.color,
                  animation: 'rippleExpand 1.4s cubic-bezier(0.2, 0.8, 0.4, 1) forwards',
                }}
              />
            ))}
          </div>

          {/* Floating Warm Golden Light Orbs Created by Interaction */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {floatingLights.map((item) => (
              <div
                key={item.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
                style={{
                  left: `${item.x}px`,
                  top: `${item.y}px`,
                  opacity: item.opacity,
                }}
              >
                <div
                  className="rounded-full bg-gradient-to-r from-[#FDE68A] to-[#F59E0B] shadow-sm"
                  style={{
                    width: `${item.size}px`,
                    height: `${item.size}px`,
                    boxShadow: '0 0 8px rgba(251, 191, 36, 0.7)',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Top Subtle Guidance Cue */}
          <div className="relative z-10 text-center pt-2">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/70 backdrop-blur-xs border border-white/55 text-[#244233] text-xs font-medium shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-[#3D6952]" />
              <span>Touch anywhere on the glass</span>
            </div>
          </div>

          {/* Central Warm Light Element (A cozy, flat warm lantern/candle) */}
          <div className="relative z-10 flex flex-col items-center justify-center my-auto">
            {/* Ambient Radial Halo */}
            <div
              className="absolute rounded-full blur-2xl transition-all duration-700 ease-out pointer-events-none"
              style={{
                width: `${150 * lightWarmth}px`,
                height: `${150 * lightWarmth}px`,
                backgroundColor: 'rgba(252, 211, 77, 0.42)',
                transform: isLightPressed ? 'scale(1.28)' : 'scale(1)',
              }}
            />

            {/* Interactive Warm Lantern / Candle Vessel */}
            <button
              type="button"
              id="rain-central-light-button"
              onClick={handleLightClick}
              className={`relative group p-5 sm:p-6 rounded-full bg-white/85 hover:bg-white/95 backdrop-blur-md border border-[#E9DFCF] shadow-md transition-all duration-500 cursor-pointer ${
                isLightPressed
                  ? 'scale-115 shadow-lg'
                  : 'hover:scale-105 active:scale-98'
              }`}
              title="Warm the light"
              aria-label="Warm the light"
            >
              {/* Cozy Flat Lantern / Flame Illustration */}
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
                {/* Outer Glass Lantern Bell / Dome */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-[#FFFDF7]/60 to-[#FDF4E3]/90 border border-[#E2D5BE] shadow-inner flex items-center justify-center">
                  {/* Subtle lantern top ring */}
                  <div className="absolute -top-2 w-5 h-2 rounded-t-md bg-[#64748B] border border-[#475569]" />
                </div>

                {/* Inner Glowing Candle / Lantern Flame */}
                <div
                  className="relative z-10 flex items-center justify-center transition-transform duration-300"
                  style={{
                    transform: `scale(${0.9 + lightWarmth * 0.15})`,
                  }}
                >
                  <Flame
                    className="w-9 h-9 sm:w-10 sm:h-10 text-[#F59E0B] fill-[#FBBF24] filter drop-shadow-[0_0_8px_rgba(245,158,11,0.5)] transition-colors group-hover:fill-[#FDE68A]"
                    strokeWidth={1.8}
                  />
                </div>
              </div>
            </button>

            <span className="mt-3 text-xs font-medium text-[#2C4436] bg-white/75 backdrop-blur-xs px-3.5 py-1 rounded-full border border-white/50 shadow-2xs">
              Warm the light
            </span>
          </div>

          {/* Bottom Atmospheric Footer */}
          <div className="relative z-10 text-center pb-1">
            <p className="text-xs sm:text-sm text-[#274435] font-medium tracking-wide bg-white/55 backdrop-blur-xs px-4 py-1.5 rounded-2xl border border-white/50 inline-block shadow-2xs">
              {interactionCount === 0
                ? 'Watch the gentle rain, or touch the glass to create ripples.'
                : 'Each drop brings calm. Take your time.'}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes rippleExpand {
          0% {
            transform: translate(-50%, -50%) scale(0.2);
            opacity: 0.85;
          }
          100% {
            transform: translate(-50%, -50%) scale(2.2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};
