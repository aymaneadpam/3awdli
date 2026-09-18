import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Heart, Volume2, VolumeX, RotateCcw, Sparkles } from 'lucide-react';
import { HEARTBEAT_AUDIO_DATA_URI, HEARTBEAT_AUDIO_PATH } from '../audio/heartbeatSound';

interface SettledHeart {
  id: number;
  xPercent: number; // 5% to 95%
  yPx: number; // Distance from top of the frame
  color: string;
  rotation: number;
  scale: number;
  opacity: number;
}

interface FlyingHeart {
  id: number;
  targetXPercent: number;
  targetYPx: number;
  color: string;
  targetRotation: number;
  targetScale: number;
  driftX: number;
}

// Varied pastel palette: soft pink, lavender, mint, pale blue, peach, pale yellow, soft coral, etc.
const PASTEL_HEART_COLORS = [
  '#F6A5B2', // Soft Rose Pink
  '#F9B4B7', // Pastel Blossom
  '#F8C0A6', // Warm Peach
  '#FADAA2', // Soft Warm Butter
  '#BFE3CA', // Gentle Mint
  '#B8E2DC', // Soft Seafoam
  '#BEE0F5', // Pale Sky Blue
  '#C8CCF5', // Gentle Periwinkle
  '#D6C6F0', // Soft Lavender
  '#E8C2E5', // Pastel Lilac
  '#F7BCD8', // Soft Petal
  '#F5C8B8', // Pale Apricot
  '#CDE5BA', // Soft Willow Green
];

// Reliable, multi-instance audio player using real audio file assets
class HeartbeatAudioPlayer {
  private pool: HTMLAudioElement[] = [];
  private poolIndex = 0;
  private isUnlocked = false;
  private isMuted = false;

  constructor(poolSize = 5) {
    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < poolSize; i++) {
          // Embedded audio data URI ensures zero-latency, immune to network or path issues
          const audio = new Audio(HEARTBEAT_AUDIO_DATA_URI);
          audio.preload = 'auto';
          audio.volume = 0.95; // Clearly audible, comfortable volume
          this.pool.push(audio);
        }
      } catch (err) {
        console.warn('[Heartbeat Audio] Pool init notice:', err);
      }
    }
  }

  public unlock() {
    if (this.isUnlocked) return;
    this.isUnlocked = true;
    if (this.pool.length > 0) {
      const a = this.pool[0];
      const p = a.play();
      if (p !== undefined) {
        p.then(() => {
          a.pause();
          a.currentTime = 0;
        }).catch(() => {
          // Will play on next direct keypress gesture
        });
      }
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    this.pool.forEach((a) => {
      a.muted = muted;
    });
  }

  public play() {
    if (this.isMuted) return;
    this.unlock();

    if (this.pool.length === 0) {
      try {
        const audio = new Audio(HEARTBEAT_AUDIO_PATH);
        audio.volume = 0.95;
        const p = audio.play();
        if (p !== undefined) {
          p.catch((err) => console.warn('[Heartbeat Audio] Direct playback error:', err));
        }
      } catch (err) {
        console.warn('[Heartbeat Audio] Fallback failed:', err);
      }
      return;
    }

    const audio = this.pool[this.poolIndex];
    this.poolIndex = (this.poolIndex + 1) % this.pool.length;
    try {
      audio.currentTime = 0;
      audio.volume = 0.95; // Clear comfortable volume
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Heartbeat audio playing
          })
          .catch((err) => {
            console.warn('[Heartbeat Audio] Browser play policy notice:', err);
            // Secondary attempt with file path
            try {
              const fallback = new Audio(HEARTBEAT_AUDIO_PATH);
              fallback.volume = 0.95;
              fallback.play().catch((e) => console.warn('[Heartbeat Audio] Secondary error:', e));
            } catch {}
          });
      }
    } catch (err) {
      console.warn('[Heartbeat Audio] Play error:', err);
    }
  }
}

export const HeartbeatGame: React.FC = () => {
  const [settledHearts, setSettledHearts] = useState<SettledHeart[]>([]);
  const [flyingHearts, setFlyingHearts] = useState<FlyingHeart[]>([]);
  const [isContracting, setIsContracting] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true); // Sound ON by default as requested

  const contractTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartCounterRef = useRef<number>(0);
  const frameContainerRef = useRef<HTMLDivElement | null>(null);
  const audioPlayerRef = useRef<HeartbeatAudioPlayer | null>(null);

  // Initialize audio player on component mount
  useEffect(() => {
    const player = new HeartbeatAudioPlayer();
    player.setMuted(!soundEnabled);
    audioPlayerRef.current = player;

    // Unlock browser audio upon very first user touch or interaction on the page
    const handleInitialUnlock = () => {
      audioPlayerRef.current?.unlock();
      window.removeEventListener('pointerdown', handleInitialUnlock);
      window.removeEventListener('touchstart', handleInitialUnlock);
      window.removeEventListener('keydown', handleInitialUnlock);
    };

    window.addEventListener('pointerdown', handleInitialUnlock, { passive: true });
    window.addEventListener('touchstart', handleInitialUnlock, { passive: true });
    window.addEventListener('keydown', handleInitialUnlock, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', handleInitialUnlock);
      window.removeEventListener('touchstart', handleInitialUnlock);
      window.removeEventListener('keydown', handleInitialUnlock);
    };
  }, []);

  // Synchronize audio mute state when user clicks mute button
  useEffect(() => {
    audioPlayerRef.current?.setMuted(!soundEnabled);
  }, [soundEnabled]);

  // Maximum rows before gently fading the oldest hearts to maintain graceful aesthetics
  const COLUMNS_PER_ROW = 13;
  const ROW_HEIGHT_PX = 23;
  const TOP_PADDING_PX = 16;
  const MAX_VISIBLE_HEARTS = 117; // ~9 rows

  // Core trigger: squeeze central heart and launch a flying heart
  const triggerHeartbeat = useCallback(() => {
    // 1. Central heart squeeze pulse
    setIsContracting(true);
    if (contractTimeoutRef.current) clearTimeout(contractTimeoutRef.current);
    contractTimeoutRef.current = setTimeout(() => {
      setIsContracting(false);
    }, 180);

    // 2. Play soft heartbeat sound if enabled
    if (soundEnabled) {
      audioPlayerRef.current?.play();
    }

    // 3. Compute destination position in the accumulating wall
    const index = heartCounterRef.current;
    heartCounterRef.current += 1;

    // Determine row and column in the wall
    const row = Math.floor((index % MAX_VISIBLE_HEARTS) / COLUMNS_PER_ROW);
    const col = (index % MAX_VISIBLE_HEARTS) % COLUMNS_PER_ROW;

    // Organic offsets so the wall looks hand-crafted and soft
    const jitterX = (Math.random() - 0.5) * 4;
    const jitterY = (Math.random() - 0.5) * 5;
    const targetXPercent = Math.max(
      6,
      Math.min(94, ((col + 0.5) / COLUMNS_PER_ROW) * 88 + 6 + jitterX)
    );
    const targetYPx = TOP_PADDING_PX + row * ROW_HEIGHT_PX + jitterY;
    const targetRotation = (Math.random() - 0.5) * 26; // -13deg to +13deg
    const targetScale = 0.88 + Math.random() * 0.22;
    const color = PASTEL_HEART_COLORS[Math.floor(Math.random() * PASTEL_HEART_COLORS.length)];
    const driftX = (Math.random() - 0.5) * 70;

    const heartId = Date.now() + Math.random();

    // 4. Launch small flying heart
    const newFlying: FlyingHeart = {
      id: heartId,
      targetXPercent,
      targetYPx,
      color,
      targetRotation,
      targetScale,
      driftX,
    };

    setFlyingHearts((prev) => [...prev, newFlying]);

    // 5. After gentle flight animation (~900ms), settle the heart into the permanent wall
    setTimeout(() => {
      // Remove from flying
      setFlyingHearts((prev) => prev.filter((h) => h.id !== heartId));

      // Settle into wall
      setSettledHearts((prev) => {
        const next = [
          ...prev,
          {
            id: heartId,
            xPercent: targetXPercent,
            yPx: targetYPx,
            color,
            rotation: targetRotation,
            scale: targetScale,
            opacity: 1,
          },
        ];

        // Graceful visual handling: if hearts exceed MAX_VISIBLE_HEARTS,
        // soften/prune the oldest hearts seamlessly without any alert or friction
        if (next.length > MAX_VISIBLE_HEARTS) {
          return next.slice(next.length - MAX_VISIBLE_HEARTS);
        }
        return next;
      });
    }, 900);
  }, [soundEnabled]);

  // Spacebar keydown listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault(); // Prevent browser scrolling
        audioPlayerRef.current?.unlock();
        if (!e.repeat) {
          triggerHeartbeat();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [triggerHeartbeat]);

  // Clean up timeouts
  useEffect(() => {
    return () => {
      if (contractTimeoutRef.current) clearTimeout(contractTimeoutRef.current);
    };
  }, []);

  // Soft clear option to start a fresh canvas if desired
  const handleClear = () => {
    setSettledHearts([]);
    setFlyingHearts([]);
    heartCounterRef.current = 0;
  };

  return (
    <div
      id="heartbeat-game-container"
      className="w-full max-w-2xl mx-auto select-none font-['Plus_Jakarta_Sans',sans-serif]"
    >
      {/* Container Card */}
      <div className="bg-white/85 backdrop-blur-sm border border-[#E8E1D5] rounded-3xl p-5 sm:p-8 shadow-xs">
        {/* Top Header Bar: Game Title & Controls */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-[#F8EAEB] border border-[#F3CFD5] flex items-center justify-center text-[#9E3E4B]">
              <Heart className="w-4 h-4 fill-current" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-[#1C2E24] font-['Lora',serif]">
                Heartbeat
              </h2>
              <p className="text-[11px] text-[#6D7D74]">Rhythm of Peace</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Sound toggle button (ON by default) */}
            <button
              type="button"
              id="heartbeat-sound-toggle-btn"
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

            {/* Clear wall option */}
            {settledHearts.length > 0 && (
              <button
                type="button"
                id="heartbeat-clear-btn"
                onClick={handleClear}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/85 hover:bg-white text-[#6D7D74] hover:text-[#2A3C32] border border-[#E0D7C9] text-xs font-medium transition-colors cursor-pointer shadow-2xs"
                title="Clear the heart wall to start fresh"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="text-[11px] hidden sm:inline">Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* 
          ========================================================================
          THE MAIN PICTURE FRAME
          - Rounded rectangle outline in the middle of the screen
          - Houses the accumulated wall at the top
          - Houses the central pulsing heart
          ========================================================================
        */}
        <div
          ref={frameContainerRef}
          id="heartbeat-picture-frame"
          className="relative w-full h-[410px] sm:h-[450px] rounded-3xl border-4 border-[#E2DAD0] bg-gradient-to-b from-[#FAF8F5] via-[#FFFDF9] to-[#F7F2EB] shadow-inner overflow-hidden flex flex-col justify-end items-center"
        >
          {/* Subtle inner decorative frame border */}
          <div className="absolute inset-1.5 rounded-[20px] border border-[#ECE5DA]/80 pointer-events-none" />

          {/* 
            ======================================================================
            ACCUMULATED WALL OF HEARTS (RESTING AGAINST TOP EDGE)
            ======================================================================
          */}
          <div
            id="accumulated-heart-wall"
            className="absolute inset-x-0 top-0 h-[220px] pointer-events-none"
          >
            {settledHearts.map((heart) => (
              <div
                key={heart.id}
                className="absolute transition-opacity duration-700 ease-out"
                style={{
                  left: `${heart.xPercent}%`,
                  top: `${heart.yPx}px`,
                  transform: `translate(-50%, 0) rotate(${heart.rotation}deg) scale(${heart.scale})`,
                  opacity: heart.opacity,
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5 drop-shadow-2xs"
                  style={{ fill: heart.color }}
                  aria-hidden="true"
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </div>
            ))}
          </div>

          {/* 
            ======================================================================
            ACTIVE FLYING HEARTS (LAUNCHED FROM CENTER UPWARD TOWARD WALL)
            - Like tapping "like" on social media
            - Upward float with gentle drift and wobble
            ======================================================================
          */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {flyingHearts.map((fh) => (
              <div
                key={fh.id}
                className="absolute"
                style={{
                  left: `${fh.targetXPercent}%`,
                  top: `${fh.targetYPx}px`,
                  animation: 'floatUpToRest 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards',
                  // Pass custom CSS variables for starting relative position
                  ['--drift-x' as string]: `${fh.driftX}px`,
                  ['--target-rot' as string]: `${fh.targetRotation}deg`,
                  ['--target-scale' as string]: `${fh.targetScale}`,
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-6 h-6 drop-shadow-xs"
                  style={{ fill: fh.color }}
                  aria-hidden="true"
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </div>
            ))}
          </div>

          {/* Inline keyframe animation for gentle social-media-style upward float */}
          <style>{`
            @keyframes floatUpToRest {
              0% {
                transform: translate(calc(-50% + var(--drift-x, 0px)), 190px) scale(0.65);
                opacity: 0.85;
              }
              45% {
                transform: translate(calc(-50% + (var(--drift-x, 0px) * 0.4)), 90px) scale(1.15);
                opacity: 1;
              }
              100% {
                transform: translate(-50%, 0px) rotate(var(--target-rot, 0deg)) scale(var(--target-scale, 1));
                opacity: 1;
              }
            }

            @keyframes gentleHeartIdle {
              0%, 100% {
                transform: scale(1);
              }
              50% {
                transform: scale(1.035);
              }
            }
          `}</style>

          {/* 
            ======================================================================
            LARGE CENTER HEART
            - Contracts briefly on each heartbeat
            - Springs smoothly back to normal
            ======================================================================
          */}
          <div className="relative mb-12 sm:mb-14 z-10 flex flex-col items-center">
            {/* Ambient soft glow underneath */}
            <div
              className={`absolute -inset-4 rounded-full bg-[#F6A5B2]/25 blur-xl transition-all duration-300 pointer-events-none ${
                isContracting ? 'scale-75 opacity-40' : 'scale-100 opacity-60'
              }`}
            />

            <button
              type="button"
              id="central-heart-button"
              onClick={triggerHeartbeat}
              className="relative focus:outline-none cursor-pointer group"
              aria-label="Heartbeat button - press space or click to pulse"
            >
              <div
                className="transition-transform ease-out"
                style={{
                  transform: isContracting
                    ? 'scale(0.85) translateY(2px)'
                    : 'scale(1) translateY(0)',
                  transitionDuration: isContracting ? '120ms' : '280ms',
                }}
              >
                <div
                  style={{
                    animation: isContracting ? 'none' : 'gentleHeartIdle 3.2s ease-in-out infinite',
                  }}
                >
                  <svg
                    viewBox="0 0 200 200"
                    className="w-36 h-36 sm:w-40 sm:h-40 select-none overflow-visible filter drop-shadow-md"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient id="mainHeartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#F89CA7" />
                        <stop offset="50%" stopColor="#F07C8C" />
                        <stop offset="100%" stopColor="#E26173" />
                      </linearGradient>
                      <linearGradient id="mainHeartShine" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {/* Main Heart Geometry */}
                    <path
                      d="M100 174 C35 125 15 90 15 57 C15 32 35 15 62 15 C80 15 93 25 100 37 C107 25 120 15 138 15 C165 15 185 32 185 57 C185 90 165 125 100 174 Z"
                      fill="url(#mainHeartGrad)"
                    />

                    {/* Soft top-left curved shine */}
                    <path
                      d="M62 25 C45 25 30 38 28 55 C27 62 30 70 35 77 C35 77 40 55 58 42 C72 32 83 34 83 34 C77 28 70 25 62 25 Z"
                      fill="url(#mainHeartShine)"
                    />
                  </svg>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* 
          ========================================================================
          INSTRUCTION & ACCESSIBILITY CONTROLS
          ========================================================================
        */}
        <div className="mt-5 text-center">
          <p className="text-xs sm:text-sm font-medium text-[#294235] font-['Lora',serif]">
            Press{' '}
            <kbd className="px-2.5 py-1 rounded-lg bg-[#FAF7F2] border border-[#DDD5C7] text-[#1E3228] text-xs font-mono shadow-2xs mx-1 font-semibold">
              Space
            </kbd>{' '}
            each time your heart beats.
          </p>
          <p className="text-xs text-[#6F7F77] mt-1.5">
            Watch the wall of peace gently grow. Take your time — there is no rush, score, or limit.
          </p>

          {/* Tap / Click button for touch screens and mobile visitors */}
          <div className="mt-3.5 flex justify-center">
            <button
              type="button"
              id="heartbeat-pulse-action-btn"
              onClick={triggerHeartbeat}
              className="px-6 py-2.5 rounded-2xl bg-white hover:bg-[#F8F5EE] text-[#284838] border border-[#D9D1C2] text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer shadow-xs active:scale-95 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-[#D87080]" />
              <span>Tap or Press Space</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
