import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Heart, Sparkles, Volume2, VolumeX, ArrowLeft } from 'lucide-react';

export type PetType = 'cat' | 'dog';

export type PetReactionType =
  | 'hop-bounce'
  | 'side-wiggle'
  | 'spin-twirl'
  | 'content-tilt'
  | 'jump-joy'
  | 'body-shake'
  | 'playful-roll'
  | 'camera-nuzzle'
  | 'happy-stretch'
  | 'victory-dance';

export const PET_REACTIONS: PetReactionType[] = [
  'hop-bounce',
  'side-wiggle',
  'spin-twirl',
  'content-tilt',
  'jump-joy',
  'body-shake',
  'playful-roll',
  'camera-nuzzle',
  'happy-stretch',
  'victory-dance',
];

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  type: 'heart' | 'star';
}

// Cat messages: short, mostly emoji-only comforting reactions
export const CAT_MESSAGES = [
  "🐾💕",
  "😸✨",
  "🐟💛",
  "😻🌸",
  "Purr~ 🐾",
  "🧡🐱",
  "😽💫",
  "Meow~ 💕",
];

// Dog messages: short, mostly emoji-only comforting reactions
export const DOG_MESSAGES = [
  "🐾🐶",
  "🦴💛",
  "😊🐕",
  "Woof~ 🐾",
  "💕🐾💕",
  "😄🐶✨",
  "🌟🐕🌟",
  "Yay! 🐾",
];

// Audio context helper for smooth, reliable sound synthesis
let sharedAudioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
};

// Pet-specific gentle sound effects on feeding (default ON, soft and soothing)
const playPetFeedingSound = (pet: PetType, isEarlyCatch: boolean, reaction: PetReactionType = 'hop-bounce') => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (pet === 'cat') {
      // Gentle, soft, sweet "meow" sound with subtle pitch/duration adjustments per reaction
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'triangle'; // warm rounded harmonics
      filter.type = 'bandpass';
      filter.Q.setValueAtTime(2.2, now);

      let startFreq = 370;
      let peakFreq = isEarlyCatch ? 730 : 670;
      let endFreq = 460;
      let dur = 0.54;

      if (reaction === 'jump-joy' || reaction === 'victory-dance') {
        startFreq = 400;
        peakFreq = isEarlyCatch ? 780 : 720;
        endFreq = 490;
        dur = 0.60;
      } else if (reaction === 'content-tilt' || reaction === 'camera-nuzzle') {
        startFreq = 330;
        peakFreq = 510;
        endFreq = 380;
        dur = 0.64;
      } else if (reaction === 'spin-twirl' || reaction === 'playful-roll') {
        startFreq = 380;
        peakFreq = 730;
        endFreq = 500;
        dur = 0.50;
      } else if (reaction === 'side-wiggle') {
        startFreq = 360;
        peakFreq = 640;
        endFreq = 440;
        dur = 0.52;
      } else if (reaction === 'happy-stretch') {
        startFreq = 320;
        peakFreq = 490;
        endFreq = 360;
        dur = 0.66;
      }

      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(peakFreq, now + dur * 0.32);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur * 0.92);

      filter.frequency.setValueAtTime(560, now);
      filter.frequency.linearRampToValueAtTime(1420, now + dur * 0.32);
      filter.frequency.linearRampToValueAtTime(700, now + dur * 0.92);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.045, now + 0.06);
      gain.gain.setValueAtTime(0.045, now + dur * 0.45);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + dur + 0.02);

      // Soft higher harmonic for sweet purr warmth
      const overtone = ctx.createOscillator();
      const overGain = ctx.createGain();
      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(startFreq * 2, now);
      overtone.frequency.exponentialRampToValueAtTime(peakFreq * 2, now + dur * 0.32);
      overtone.frequency.exponentialRampToValueAtTime(endFreq * 2, now + dur * 0.92);

      overGain.gain.setValueAtTime(0, now);
      overGain.gain.linearRampToValueAtTime(reaction === 'content-tilt' ? 0.02 : 0.012, now + 0.07);
      overGain.gain.exponentialRampToValueAtTime(0.0001, now + dur - 0.04);

      overtone.connect(overGain);
      overGain.connect(ctx.destination);

      overtone.start(now);
      overtone.stop(now + dur);
    } else {
      // Gentle, soft, happy dog sound with subtle variation per reaction
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      filter.type = 'lowpass';
      filter.Q.setValueAtTime(1.8, now);

      let startFreq = 290;
      let endFreq = 175;
      let dur = 0.26;

      if (reaction === 'jump-joy' || reaction === 'victory-dance') {
        startFreq = 340;
        endFreq = 210;
        dur = 0.30;
      } else if (reaction === 'content-tilt' || reaction === 'camera-nuzzle') {
        startFreq = 260;
        endFreq = 180;
        dur = 0.32;
      } else if (reaction === 'spin-twirl' || reaction === 'playful-roll') {
        startFreq = 310;
        endFreq = 190;
        dur = 0.25;
      } else if (reaction === 'happy-stretch') {
        startFreq = 250;
        endFreq = 170;
        dur = 0.36;
      }

      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur * 0.8);

      filter.frequency.setValueAtTime(520, now);
      filter.frequency.linearRampToValueAtTime(720, now + 0.05);
      filter.frequency.exponentialRampToValueAtTime(320, now + dur * 0.9);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.045, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + dur + 0.02);

      // Second cheerful content yip/boof for bouncy/joyful reactions
      if (
        reaction === 'hop-bounce' ||
        reaction === 'jump-joy' ||
        reaction === 'side-wiggle' ||
        reaction === 'victory-dance' ||
        reaction === 'playful-roll'
      ) {
        const osc2 = ctx.createOscillator();
        const filter2 = ctx.createBiquadFilter();
        const gain2 = ctx.createGain();

        const t2 = now + 0.14;
        osc2.type = 'sine';
        filter2.type = 'lowpass';
        osc2.frequency.setValueAtTime(330, t2);
        osc2.frequency.exponentialRampToValueAtTime(210, t2 + 0.16);
        filter2.frequency.setValueAtTime(620, t2);

        gain2.gain.setValueAtTime(0, t2);
        gain2.gain.linearRampToValueAtTime(0.032, t2 + 0.035);
        gain2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.20);

        osc2.connect(filter2);
        filter2.connect(gain2);
        gain2.connect(ctx.destination);

        osc2.start(t2);
        osc2.stop(t2 + 0.22);
      }
    }

    // Peaceful soft harmonic chime alongside
    const chimeNotes = isEarlyCatch ? [523.25, 659.25] : [440.0];
    chimeNotes.forEach((freq, idx) => {
      const chimeOsc = ctx.createOscillator();
      const chimeGain = ctx.createGain();
      chimeOsc.type = 'sine';
      const chimeStart = now + idx * 0.09;
      chimeOsc.frequency.setValueAtTime(freq, chimeStart);

      const chimeVol = isEarlyCatch ? 0.022 : 0.016;
      chimeGain.gain.setValueAtTime(0, chimeStart);
      chimeGain.gain.linearRampToValueAtTime(chimeVol, chimeStart + 0.03);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, chimeStart + 0.85);

      chimeOsc.connect(chimeGain);
      chimeGain.connect(ctx.destination);

      chimeOsc.start(chimeStart);
      chimeOsc.stop(chimeStart + 0.9);
    });
  } catch {
    // Audio is non-essential
  }
};

// Catch Zone parameters along the vertical falling path (progress from 0.0 to 1.0)
const CATCH_ZONE_START = 0.44;
const CATCH_ZONE_END = 0.68;
const FALL_DURATION_MS = 3800; // Calm, steady, peaceful falling duration

export const CompanionGame: React.FC = () => {
  // Game state
  const [selectedPet, setSelectedPet] = useState<PetType | null>(null);
  const [foodProgress, setFoodProgress] = useState<number>(0); // 0.0 (top) to 1.0 (reaches pet)
  const [isDelivered, setIsDelivered] = useState<boolean>(false);
  const [isReacting, setIsReacting] = useState<boolean>(false);
  const [isEarlyReaction, setIsEarlyReaction] = useState<boolean>(false);
  const [currentReaction, setCurrentReaction] = useState<PetReactionType>('hop-bounce');
  const reactionIndexRef = useRef<number>(0);
  const messageIndexRef = useRef<number>(0);
  const [currentMessage, setCurrentMessage] = useState<string | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isBlinking, setIsBlinking] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true); // Sound ON by default as requested
  const [screenTransitioning, setScreenTransitioning] = useState<boolean>(false);
  const [feedIteration, setFeedIteration] = useState<number>(0);

  // Animation frame and timeout refs
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nextItemTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reactTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ref to hold current food progress synchronously for instantaneous spacebar checks
  const foodProgressRef = useRef<number>(0);
  const isDeliveredRef = useRef<boolean>(false);

  useEffect(() => {
    foodProgressRef.current = foodProgress;
  }, [foodProgress]);

  useEffect(() => {
    isDeliveredRef.current = isDelivered;
  }, [isDelivered]);

  // Periodic blinking effect
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 220);
    }, 3800);

    return () => clearInterval(blinkInterval);
  }, []);

  // Handle successful treat delivery (either early circle catch or gentle automatic catch)
  const handleFeed = useCallback(
    (isEarlyCatch: boolean) => {
      if (isDeliveredRef.current) return;
      isDeliveredRef.current = true;
      setIsDelivered(true);
      setIsReacting(true);
      setIsEarlyReaction(isEarlyCatch);
      setFeedIteration((prev) => prev + 1);

      // Sequential reaction in fixed order: 1, 2, 3, ... then loop back around
      const reactionIdx = reactionIndexRef.current % PET_REACTIONS.length;
      const chosenReaction = PET_REACTIONS[reactionIdx];
      reactionIndexRef.current = (reactionIdx + 1) % PET_REACTIONS.length;
      setCurrentReaction(chosenReaction);

      // Play pet-specific gentle sound effect (ON by default)
      if (soundEnabled && selectedPet) {
        playPetFeedingSound(selectedPet, isEarlyCatch, chosenReaction);
      }

      // Sequential message in fixed order according to current pet: 1, 2, 3, ... then loop back around
      const pool = selectedPet === 'cat' ? CAT_MESSAGES : DOG_MESSAGES;
      const msgIdx = messageIndexRef.current % pool.length;
      const nextMsg = pool[msgIdx];
      messageIndexRef.current = (msgIdx + 1) % pool.length;
      setCurrentMessage(nextMsg);

      // Floating particles: springier reward has more particles (8), auto has 4
      const particleCount = isEarlyCatch ? 8 : 4;
      const newParticles: Particle[] = Array.from({ length: particleCount }).map((_, i) => ({
        id: Date.now() + i,
        x: (Math.random() - 0.5) * (isEarlyCatch ? 130 : 90),
        y: -25 - Math.random() * (isEarlyCatch ? 35 : 20),
        size: isEarlyCatch ? 16 + Math.random() * 8 : 14 + Math.random() * 6,
        opacity: 0.95,
        type: i % 2 === 0 ? 'heart' : 'star',
      }));
      setParticles(newParticles);

      // Hide message bubble after ~3.2s
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
      messageTimeoutRef.current = setTimeout(() => {
        setCurrentMessage(null);
      }, 3200);

      // Reset pet reaction state after ~2.4s
      if (reactTimeoutRef.current) clearTimeout(reactTimeoutRef.current);
      reactTimeoutRef.current = setTimeout(() => {
        setIsReacting(false);
        setIsEarlyReaction(false);
        setParticles([]);
      }, 2400);

      // Loop to next falling food item after calm pause (~1.6s)
      if (nextItemTimeoutRef.current) clearTimeout(nextItemTimeoutRef.current);
      nextItemTimeoutRef.current = setTimeout(() => {
        foodProgressRef.current = 0;
        setFoodProgress(0);
        isDeliveredRef.current = false;
        setIsDelivered(false);
      }, 1600);
    },
    [soundEnabled, selectedPet]
  );

  // Catch action when Space is pressed or Catch button is tapped
  const handleCatchAction = useCallback(() => {
    if (isDeliveredRef.current) return;
    const currentProg = foodProgressRef.current;

    // Check if food is visually inside the catch circle
    if (currentProg >= CATCH_ZONE_START && currentProg <= CATCH_ZONE_END) {
      // CAUGHT IN CIRCLE: rewarding, springier reaction!
      handleFeed(true);
    } else {
      // OUTSIDE CIRCLE: Nothing happens!
      // No penalty, no reset, no negative feedback. Food keeps falling exactly as it was.
    }
  }, [handleFeed]);

  // Main animation frame loop for falling food
  useEffect(() => {
    if (!selectedPet || isDelivered) return;

    const tick = (time: number) => {
      if (lastTimeRef.current !== null && !isDeliveredRef.current) {
        const delta = time - lastTimeRef.current;
        setFoodProgress((prev) => {
          const next = prev + delta / FALL_DURATION_MS;
          if (next >= 1.0) {
            // AUTOMATIC CATCH AT BOTTOM:
            // When food reaches pet/ground level without circle catch,
            // it is automatically caught and fed gently (calmer version).
            // Zero fail state!
            handleFeed(false);
            return 1.0;
          }
          return next;
        });
      }
      lastTimeRef.current = time;
      if (!isDeliveredRef.current) {
        animFrameRef.current = requestAnimationFrame(tick);
      }
    };

    lastTimeRef.current = null;
    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [selectedPet, isDelivered, handleFeed]);

  // Listen for Spacebar keydown
  useEffect(() => {
    if (!selectedPet) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault(); // Prevent default browser window scrolling
        if (!e.repeat) {
          handleCatchAction();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedPet, handleCatchAction]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
      if (nextItemTimeoutRef.current) clearTimeout(nextItemTimeoutRef.current);
      if (reactTimeoutRef.current) clearTimeout(reactTimeoutRef.current);
    };
  }, []);

  // Handle select pet
  const handleSelectPet = (pet: PetType) => {
    setScreenTransitioning(true);
    setTimeout(() => {
      setSelectedPet(pet);
      setFoodProgress(0);
      foodProgressRef.current = 0;
      isDeliveredRef.current = false;
      setIsDelivered(false);
      setIsReacting(false);
      setIsEarlyReaction(false);
      reactionIndexRef.current = 0;
      messageIndexRef.current = 0;
      setCurrentReaction('hop-bounce');
      setFeedIteration(0);
      setCurrentMessage(null);
      setScreenTransitioning(false);
    }, 400);
  };

  // Back to pet selection
  const handleBackToSelect = () => {
    setScreenTransitioning(true);
    setTimeout(() => {
      setSelectedPet(null);
      setFoodProgress(0);
      foodProgressRef.current = 0;
      isDeliveredRef.current = false;
      setIsDelivered(false);
      setIsReacting(false);
      setIsEarlyReaction(false);
      reactionIndexRef.current = 0;
      messageIndexRef.current = 0;
      setCurrentReaction('hop-bounce');
      setFeedIteration(0);
      setCurrentMessage(null);
      setScreenTransitioning(false);
    }, 400);
  };

  // Is the falling food currently inside the visible catch circle?
  const isInsideCatchZone = foodProgress >= CATCH_ZONE_START && foodProgress <= CATCH_ZONE_END;

  // Dynamic CSS variable adjustments for early catch (higher spring) vs gentle fall catch
  const isEarly = isEarlyReaction;

  // Cat Illustration SVG Component with lively, varied reaction animations and idle breathing
  const renderCat = (size = 180) => {
    const catCssVars = {
      '--cat-hop-h': isEarly ? '-28px' : '-18px',
      '--cat-micro-hop-h': isEarly ? '-13px' : '-8px',
      '--cat-jump-h': isEarly ? '-40px' : '-26px',
      '--cat-jump-pause': isEarly ? '-36px' : '-24px',
      '--cat-spin-lift': isEarly ? '-18px' : '-10px',
      '--cat-nuzzle-scale': isEarly ? '1.24' : '1.18',
    } as React.CSSProperties;

    const getCatAnimStyle = (): React.CSSProperties => {
      if (!isReacting) {
        return {
          animation: 'catBreathingLively 1.8s ease-in-out infinite',
          transformOrigin: '100px 185px',
        };
      }
      switch (currentReaction) {
        case 'hop-bounce':
          return {
            animation: 'catHopBounce 1.8s cubic-bezier(0.28, 0.84, 0.42, 1) forwards',
            transformOrigin: '100px 185px',
          };
        case 'side-wiggle':
          return {
            animation: 'catSideWiggle 1.9s ease-in-out forwards',
            transformOrigin: '100px 185px',
          };
        case 'spin-twirl':
          return {
            animation: 'catSpinTwirl 1.7s cubic-bezier(0.34, 1.3, 0.64, 1) forwards',
            transformOrigin: '100px 130px',
          };
        case 'content-tilt':
          return {
            animation: 'catContentTilt 2.0s ease-in-out forwards',
            transformOrigin: '100px 185px',
          };
        case 'jump-joy':
          return {
            animation: 'catJumpJoy 1.9s cubic-bezier(0.22, 1, 0.36, 1) forwards',
            transformOrigin: '100px 185px',
          };
        case 'body-shake':
          return {
            animation: 'catBodyShake 1.8s ease-in-out forwards',
            transformOrigin: '100px 185px',
          };
        case 'playful-roll':
          return {
            animation: 'catPlayfulRoll 1.9s cubic-bezier(0.34, 1.2, 0.64, 1) forwards',
            transformOrigin: '100px 145px',
          };
        case 'camera-nuzzle':
          return {
            animation: 'catCameraNuzzle 2.0s ease-in-out forwards',
            transformOrigin: '100px 185px',
          };
        case 'happy-stretch':
          return {
            animation: 'catHappyStretch 2.0s ease-in-out forwards',
            transformOrigin: '100px 185px',
          };
        case 'victory-dance':
          return {
            animation: 'catVictoryDance 1.9s ease-in-out forwards',
            transformOrigin: '100px 185px',
          };
        default:
          return {
            animation: 'catHopBounce 1.8s cubic-bezier(0.28, 0.84, 0.42, 1) forwards',
            transformOrigin: '100px 185px',
          };
      }
    };

    const getCatTailStyle = (): React.CSSProperties => {
      if (!isReacting) {
        return {
          animation: 'catTailGentle 2.2s ease-in-out infinite',
          transformOrigin: '145px 155px',
        };
      }
      switch (currentReaction) {
        case 'hop-bounce':
          return {
            animation: 'catTailHop 1.8s ease-in-out forwards',
            transformOrigin: '145px 155px',
          };
        case 'side-wiggle':
          return {
            animation: 'catTailSwish 1.9s ease-in-out forwards',
            transformOrigin: '145px 155px',
          };
        case 'spin-twirl':
          return {
            animation: 'catTailTwirl 1.7s ease-in-out forwards',
            transformOrigin: '145px 155px',
          };
        case 'content-tilt':
          return {
            animation: 'catTailContent 2.0s ease-in-out forwards',
            transformOrigin: '145px 155px',
          };
        case 'jump-joy':
          return {
            animation: 'catTailJump 1.9s ease-in-out forwards',
            transformOrigin: '145px 155px',
          };
        case 'body-shake':
          return {
            animation: 'catTailShake 1.8s ease-in-out forwards',
            transformOrigin: '145px 155px',
          };
        case 'playful-roll':
          return {
            animation: 'catTailRoll 1.9s ease-in-out forwards',
            transformOrigin: '145px 155px',
          };
        case 'camera-nuzzle':
          return {
            animation: 'catTailNuzzle 2.0s ease-in-out forwards',
            transformOrigin: '145px 155px',
          };
        case 'happy-stretch':
          return {
            animation: 'catTailStretch 2.0s ease-in-out forwards',
            transformOrigin: '145px 155px',
          };
        case 'victory-dance':
          return {
            animation: 'catTailVictory 1.9s ease-in-out forwards',
            transformOrigin: '145px 155px',
          };
        default:
          return {
            animation: 'catTailHop 1.8s ease-in-out forwards',
            transformOrigin: '145px 155px',
          };
      }
    };

    return (
      <div
        className="relative inline-block"
        style={{ width: size, height: size, ...catCssVars }}
      >
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full select-none overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="catBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F5E5D5" />
              <stop offset="100%" stopColor="#E6CFBC" />
            </linearGradient>
            <linearGradient id="catEarInner" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F8D3D6" />
              <stop offset="100%" stopColor="#F0BAC0" />
            </linearGradient>
          </defs>

          <style>{`
            @keyframes catBreathingLively {
              0%, 100% { transform: translateY(0px) scale(1, 1); }
              50% { transform: translateY(-3.5px) scale(1.02, 0.985); }
            }
            @keyframes catTailGentle {
              0%, 100% { transform: rotate(0deg); }
              50% { transform: rotate(7deg); }
            }

            /* Reaction 1: Hop / Bounce */
            @keyframes catHopBounce {
              0% { transform: translateY(0) scale(1, 1); }
              12% { transform: translateY(3px) scale(1.06, 0.94); }
              32% { transform: translateY(var(--cat-hop-h, -24px)) scale(0.93, 1.07); }
              52% { transform: translateY(2px) scale(1.04, 0.96); }
              70% { transform: translateY(var(--cat-micro-hop-h, -11px)) scale(0.97, 1.03); }
              86% { transform: translateY(1px) scale(1.02, 0.98); }
              100% { transform: translateY(0) scale(1, 1); }
            }
            @keyframes catTailHop {
              0%, 100% { transform: rotate(0deg); }
              32% { transform: rotate(24deg) translateY(-2px); }
              52% { transform: rotate(6deg); }
              70% { transform: rotate(18deg); }
            }

            /* Reaction 2: Side Wiggle */
            @keyframes catSideWiggle {
              0% { transform: translateX(0) rotate(0deg); }
              14% { transform: translateX(-8px) rotate(-4.5deg); }
              28% { transform: translateX(8px) rotate(4.5deg); }
              42% { transform: translateX(-7px) rotate(-4deg); }
              56% { transform: translateX(7px) rotate(4deg); }
              70% { transform: translateX(-4px) rotate(-2deg); }
              84% { transform: translateX(3px) rotate(1.5deg); }
              100% { transform: translateX(0) rotate(0deg); }
            }
            @keyframes catTailSwish {
              0%, 100% { transform: rotate(0deg); }
              25% { transform: rotate(-16deg); }
              50% { transform: rotate(26deg); }
              75% { transform: rotate(-12deg); }
            }

            /* Reaction 3: Spin / Twirl */
            @keyframes catSpinTwirl {
              0% { transform: rotate(0deg) translateY(0) scale(1); }
              15% { transform: rotate(-12deg) translateY(2px) scale(1.05, 0.95); }
              38% { transform: rotate(140deg) translateY(var(--cat-spin-lift, -16px)) scale(0.92, 1.06); }
              60% { transform: rotate(260deg) translateY(var(--cat-spin-lift, -14px)) scale(0.94, 1.05); }
              78% { transform: rotate(360deg) translateY(2px) scale(1.06, 0.94); }
              89% { transform: rotate(360deg) translateY(-3px) scale(0.98, 1.02); }
              100% { transform: rotate(360deg) translateY(0) scale(1); }
            }
            @keyframes catTailTwirl {
              0% { transform: rotate(0deg); }
              35% { transform: rotate(-24deg); }
              65% { transform: rotate(28deg); }
              100% { transform: rotate(0deg); }
            }

            /* Reaction 4: Content Squint & Tilt */
            @keyframes catContentTilt {
              0% { transform: rotate(0deg) translateY(0); }
              22% { transform: rotate(7deg) translateY(-4px) scale(1.02); }
              42% { transform: rotate(9.5deg) translateY(-5px) scale(1.03); }
              68% { transform: rotate(8.5deg) translateY(-4px) scale(1.02); }
              86% { transform: rotate(3deg) translateY(-1px); }
              100% { transform: rotate(0deg) translateY(0); }
            }
            @keyframes catTailContent {
              0%, 100% { transform: rotate(6deg); }
              42% { transform: rotate(20deg); }
              70% { transform: rotate(12deg); }
            }

            /* Reaction 5: Jump for Joy */
            @keyframes catJumpJoy {
              0% { transform: translateY(0) scale(1, 1); }
              12% { transform: translateY(6px) scale(1.12, 0.88); }
              28% { transform: translateY(var(--cat-jump-h, -34px)) scale(0.90, 1.12); }
              46% { transform: translateY(var(--cat-jump-pause, -32px)) scale(0.95, 1.05); }
              64% { transform: translateY(5px) scale(1.14, 0.88); }
              78% { transform: translateY(-7px) scale(0.97, 1.03); }
              90% { transform: translateY(1px) scale(1.02, 0.98); }
              100% { transform: translateY(0) scale(1, 1); }
            }
            @keyframes catTailJump {
              0%, 100% { transform: rotate(0deg); }
              28%, 46% { transform: rotate(-26deg) scale(1.1); }
              64% { transform: rotate(20deg); }
              78% { transform: rotate(6deg); }
            }

            /* Reaction 6: Body Shake */
            @keyframes catBodyShake {
              0% { transform: rotate(0deg) translateX(0) scale(1); }
              8% { transform: rotate(-3.5deg) translateX(-4px) scale(1.02, 0.98); }
              16% { transform: rotate(3.5deg) translateX(4px) scale(0.98, 1.02); }
              24% { transform: rotate(-4deg) translateX(-5px) scale(1.03, 0.97); }
              32% { transform: rotate(4deg) translateX(5px) scale(0.97, 1.03); }
              40% { transform: rotate(-3deg) translateX(-3px); }
              48% { transform: rotate(3deg) translateX(3px); }
              58% { transform: rotate(-2deg) translateX(-2px); }
              68% { transform: rotate(1.5deg) translateX(2px); }
              80% { transform: rotate(-0.5deg) translateX(-1px); }
              90% { transform: rotate(0deg) scale(1.02, 0.98); }
              100% { transform: rotate(0deg) scale(1, 1); }
            }
            @keyframes catTailShake {
              0%, 100% { transform: rotate(0deg); }
              15% { transform: rotate(26deg); }
              30% { transform: rotate(-18deg); }
              45% { transform: rotate(22deg); }
              60% { transform: rotate(-12deg); }
              75% { transform: rotate(10deg); }
            }

            /* Reaction 7: Playful Roll */
            @keyframes catPlayfulRoll {
              0% { transform: rotate(0deg) translateY(0) scale(1, 1); }
              15% { transform: rotate(-15deg) translateY(4px) scale(1.04, 0.96); }
              35% { transform: rotate(45deg) translateY(12px) scale(0.96, 1.02); }
              50% { transform: rotate(72deg) translateY(16px) scale(0.95, 1.05); }
              68% { transform: rotate(35deg) translateY(10px) scale(0.98, 1.02); }
              82% { transform: rotate(-8deg) translateY(-4px) scale(1.02, 0.98); }
              92% { transform: rotate(2deg) translateY(0) scale(1.01, 0.99); }
              100% { transform: rotate(0deg) translateY(0) scale(1, 1); }
            }
            @keyframes catTailRoll {
              0%, 100% { transform: rotate(0deg); }
              35% { transform: rotate(-30deg) scale(0.9); }
              50% { transform: rotate(28deg) scale(1.1); }
              82% { transform: rotate(-12deg); }
            }

            /* Reaction 8: Camera Nuzzle (leaning close to viewer) */
            @keyframes catCameraNuzzle {
              0% { transform: scale(1) translateY(0) rotate(0deg); }
              20% { transform: scale(1.08) translateY(-6px) rotate(-4deg); }
              40% { transform: scale(var(--cat-nuzzle-scale, 1.20)) translateY(-14px) rotate(6deg); }
              62% { transform: scale(var(--cat-nuzzle-scale, 1.20)) translateY(-12px) rotate(8deg); }
              82% { transform: scale(1.06) translateY(-4px) rotate(2deg); }
              100% { transform: scale(1) translateY(0) rotate(0deg); }
            }
            @keyframes catTailNuzzle {
              0%, 100% { transform: rotate(4deg); }
              40%, 62% { transform: rotate(22deg); }
              82% { transform: rotate(10deg); }
            }

            /* Reaction 9: Happy Stretch */
            @keyframes catHappyStretch {
              0% { transform: scale(1, 1) translateY(0) skewX(0deg); }
              16% { transform: scale(1.10, 0.88) translateY(8px) skewX(2deg); }
              38% { transform: scale(0.92, 1.14) translateY(-14px) skewX(-3deg); }
              58% { transform: scale(0.92, 1.14) translateY(-12px) skewX(-2deg); }
              78% { transform: scale(1.05, 0.95) translateY(2px) skewX(1deg); }
              90% { transform: scale(0.99, 1.01) translateY(-2px); }
              100% { transform: scale(1, 1) translateY(0) skewX(0deg); }
            }
            @keyframes catTailStretch {
              0%, 100% { transform: rotate(0deg); }
              38%, 58% { transform: rotate(-32deg) scale(1.15); }
              78% { transform: rotate(12deg); }
            }

            /* Reaction 10: Victory Dance / Tippy-Taps */
            @keyframes catVictoryDance {
              0% { transform: translateY(0) rotate(0deg); }
              12% { transform: translateY(-8px) rotate(-5deg); }
              24% { transform: translateY(1px) rotate(0deg); }
              36% { transform: translateY(-8px) rotate(5deg); }
              48% { transform: translateY(1px) rotate(0deg); }
              60% { transform: translateY(-16px) rotate(-3deg) scale(1.04); }
              74% { transform: translateY(2px) scale(1.03, 0.97); }
              88% { transform: translateY(-4px) scale(0.98, 1.02); }
              100% { transform: translateY(0) rotate(0deg) scale(1); }
            }
            @keyframes catTailVictory {
              0%, 100% { transform: rotate(0deg); }
              12% { transform: rotate(-18deg); }
              36% { transform: rotate(24deg); }
              60% { transform: rotate(-26deg); }
              74% { transform: rotate(14deg); }
            }
          `}</style>

          {/* Animated cat group with key to trigger fresh keyframe on each feed */}
          <g
            key={`cat-anim-${feedIteration}-${isReacting ? currentReaction : 'idle'}`}
            style={getCatAnimStyle()}
          >
            {/* Swaying / Reacting Tail */}
            <path
              d="M145 155 C165 150 178 135 174 118 C171 106 158 108 159 116 C161 123 154 136 142 142"
              fill="none"
              stroke="#D8BEA7"
              strokeWidth="10"
              strokeLinecap="round"
              style={getCatTailStyle()}
            />

            {/* Rounded Body */}
            <ellipse cx="100" cy="142" rx="48" ry="42" fill="url(#catBodyGrad)" />

            {/* Soft Belly Patch */}
            <ellipse cx="100" cy="148" rx="26" ry="24" fill="#FCF7F2" opacity="0.85" />

            {/* Rounded Front Paws */}
            <ellipse cx="82" cy="176" rx="13" ry="9" fill="#E6CFBC" />
            <ellipse cx="118" cy="176" rx="13" ry="9" fill="#E6CFBC" />

            {/* Head */}
            <circle cx="100" cy="94" r="42" fill="url(#catBodyGrad)" />

            {/* Left Ear */}
            <path d="M68 76 Q60 40 78 48 Z" fill="url(#catBodyGrad)" />
            <path d="M70 70 Q66 48 76 53 Z" fill="url(#catEarInner)" />

            {/* Right Ear */}
            <path d="M132 76 Q140 40 122 48 Z" fill="url(#catBodyGrad)" />
            <path d="M130 70 Q134 48 124 53 Z" fill="url(#catEarInner)" />

            {/* Cheeks Blush */}
            <circle
              cx="74"
              cy="106"
              r={currentReaction === 'camera-nuzzle' && isReacting ? 8 : 6.5}
              fill="#F7CAD0"
              opacity={isReacting ? (currentReaction === 'camera-nuzzle' ? 1.0 : 0.95) : 0.45}
            />
            <circle
              cx="126"
              cy="106"
              r={currentReaction === 'camera-nuzzle' && isReacting ? 8 : 6.5}
              fill="#F7CAD0"
              opacity={isReacting ? (currentReaction === 'camera-nuzzle' ? 1.0 : 0.95) : 0.45}
            />

            {/* Eyes: varied per reaction */}
            {isReacting ? (
              currentReaction === 'content-tilt' ||
              currentReaction === 'camera-nuzzle' ||
              currentReaction === 'happy-stretch' ? (
                // Content, blissful squint (sweet curved crescents: ‿ ‿)
                <g stroke="#564234" strokeWidth="3" strokeLinecap="round" fill="none">
                  <path d="M79 93 Q85 98 92 93" />
                  <path d="M108 93 Q115 98 121 93" />
                </g>
              ) : currentReaction === 'body-shake' ? (
                // Cute squeezed-shut eyes (> <) while shaking
                <g stroke="#564234" strokeWidth="2.8" strokeLinecap="round" fill="none">
                  <path d="M79 89 L87 93 L79 97" />
                  <path d="M121 89 L113 93 L121 97" />
                </g>
              ) : currentReaction === 'jump-joy' || currentReaction === 'victory-dance' ? (
                // Wide sparkling joyful crescent eyes (^ ^)
                <g>
                  <path d="M78 95 Q85 83 93 95" stroke="#564234" strokeWidth="3.2" strokeLinecap="round" fill="none" />
                  <path d="M107 95 Q115 83 122 95" stroke="#564234" strokeWidth="3.2" strokeLinecap="round" fill="none" />
                  <circle cx="85.5" cy="88" r="1.4" fill="#F4ACB7" />
                  <circle cx="114.5" cy="88" r="1.4" fill="#F4ACB7" />
                </g>
              ) : currentReaction === 'spin-twirl' || currentReaction === 'playful-roll' ? (
                // Playful twirl/roll eyes (^ ^)
                <g stroke="#564234" strokeWidth="3.2" strokeLinecap="round" fill="none">
                  <path d="M79 94 Q85 84 92 94" />
                  <path d="M108 94 Q114 84 121 94" />
                </g>
              ) : (
                // Happy curved crescents for hop-bounce and side-wiggle
                <g stroke="#564234" strokeWidth="3.2" strokeLinecap="round" fill="none">
                  <path d="M80 94 Q86 85 92 94" />
                  <path d="M108 94 Q114 85 120 94" />
                </g>
              )
            ) : isBlinking ? (
              <g stroke="#564234" strokeWidth="2.6" strokeLinecap="round" fill="none">
                <line x1="80" y1="94" x2="92" y2="94" />
                <line x1="108" y1="94" x2="120" y2="94" />
              </g>
            ) : (
              <g fill="#4A3728">
                <ellipse cx="86" cy="93" rx="4.5" ry="6" />
                <ellipse cx="114" cy="93" rx="4.5" ry="6" />
                <circle cx="84.5" cy="91" r="1.5" fill="#FFFFFF" />
                <circle cx="112.5" cy="91" r="1.5" fill="#FFFFFF" />
              </g>
            )}

            {/* Cute Nose */}
            <polygon points="100,102 96,98 104,98" fill="#F4ACB7" />

            {/* Gentle Smile */}
            <path
              d="M96 104 Q100 108 100 104 Q100 108 104 104"
              fill="none"
              stroke="#6B5344"
              strokeWidth="2"
              strokeLinecap="round"
            />

            {/* Whiskers */}
            <g stroke="#A89482" strokeWidth="1.5" strokeLinecap="round" opacity="0.65">
              <line x1="68" y1="101" x2="52" y2="98" />
              <line x1="68" y1="106" x2="50" y2="108" />
              <line x1="132" y1="101" x2="148" y2="98" />
              <line x1="132" y1="106" x2="150" y2="108" />
            </g>
          </g>
        </svg>
      </div>
    );
  };

  // Dog Illustration SVG Component with lively, varied reaction animations and idle breathing
  const renderDog = (size = 180) => {
    const dogCssVars = {
      '--dog-hop-h': isEarly ? '-30px' : '-19px',
      '--dog-micro-hop-h': isEarly ? '-14px' : '-9px',
      '--dog-jump-h': isEarly ? '-42px' : '-28px',
      '--dog-jump-pause': isEarly ? '-38px' : '-25px',
      '--dog-spin-lift': isEarly ? '-18px' : '-11px',
      '--dog-nuzzle-scale': isEarly ? '1.25' : '1.18',
    } as React.CSSProperties;

    const getDogAnimStyle = (): React.CSSProperties => {
      if (!isReacting) {
        return {
          animation: 'dogBreathingLively 1.8s ease-in-out infinite',
          transformOrigin: '100px 185px',
        };
      }
      switch (currentReaction) {
        case 'hop-bounce':
          return {
            animation: 'dogHopBounce 1.8s cubic-bezier(0.28, 0.84, 0.42, 1) forwards',
            transformOrigin: '100px 185px',
          };
        case 'side-wiggle':
          return {
            animation: 'dogSideWiggle 1.9s ease-in-out forwards',
            transformOrigin: '100px 185px',
          };
        case 'spin-twirl':
          return {
            animation: 'dogSpinTwirl 1.7s cubic-bezier(0.34, 1.3, 0.64, 1) forwards',
            transformOrigin: '100px 130px',
          };
        case 'content-tilt':
          return {
            animation: 'dogContentTilt 2.0s ease-in-out forwards',
            transformOrigin: '100px 185px',
          };
        case 'jump-joy':
          return {
            animation: 'dogJumpJoy 1.9s cubic-bezier(0.22, 1, 0.36, 1) forwards',
            transformOrigin: '100px 185px',
          };
        case 'body-shake':
          return {
            animation: 'dogBodyShake 1.8s ease-in-out forwards',
            transformOrigin: '100px 185px',
          };
        case 'playful-roll':
          return {
            animation: 'dogPlayfulRoll 1.9s cubic-bezier(0.34, 1.2, 0.64, 1) forwards',
            transformOrigin: '100px 145px',
          };
        case 'camera-nuzzle':
          return {
            animation: 'dogCameraNuzzle 2.0s ease-in-out forwards',
            transformOrigin: '100px 185px',
          };
        case 'happy-stretch':
          return {
            animation: 'dogHappyStretch 2.0s ease-in-out forwards',
            transformOrigin: '100px 185px',
          };
        case 'victory-dance':
          return {
            animation: 'dogVictoryDance 1.9s ease-in-out forwards',
            transformOrigin: '100px 185px',
          };
        default:
          return {
            animation: 'dogHopBounce 1.8s cubic-bezier(0.28, 0.84, 0.42, 1) forwards',
            transformOrigin: '100px 185px',
          };
      }
    };

    const getDogTailStyle = (): React.CSSProperties => {
      if (!isReacting) {
        return {
          animation: 'dogTailGentle 1.6s ease-in-out infinite',
          transformOrigin: '148px 152px',
        };
      }
      switch (currentReaction) {
        case 'hop-bounce':
          return {
            animation: 'dogTailWagBounce 1.8s ease-in-out forwards',
            transformOrigin: '148px 152px',
          };
        case 'side-wiggle':
          return {
            animation: 'dogTailWagHyper 0.22s ease-in-out infinite',
            transformOrigin: '148px 152px',
          };
        case 'spin-twirl':
          return {
            animation: 'dogTailTwirl 1.7s ease-in-out forwards',
            transformOrigin: '148px 152px',
          };
        case 'content-tilt':
          return {
            animation: 'dogTailContent 2.0s ease-in-out forwards',
            transformOrigin: '148px 152px',
          };
        case 'jump-joy':
          return {
            animation: 'dogTailJump 1.9s ease-in-out forwards',
            transformOrigin: '148px 152px',
          };
        case 'body-shake':
          return {
            animation: 'dogTailShake 1.8s ease-in-out forwards',
            transformOrigin: '148px 152px',
          };
        case 'playful-roll':
          return {
            animation: 'dogTailRoll 1.9s ease-in-out forwards',
            transformOrigin: '148px 152px',
          };
        case 'camera-nuzzle':
          return {
            animation: 'dogTailNuzzle 2.0s ease-in-out forwards',
            transformOrigin: '148px 152px',
          };
        case 'happy-stretch':
          return {
            animation: 'dogTailStretch 2.0s ease-in-out forwards',
            transformOrigin: '148px 152px',
          };
        case 'victory-dance':
          return {
            animation: 'dogTailVictory 1.9s ease-in-out forwards',
            transformOrigin: '148px 152px',
          };
        default:
          return {
            animation: 'dogTailWagBounce 1.8s ease-in-out forwards',
            transformOrigin: '148px 152px',
          };
      }
    };

    const getDogEarLeftStyle = (): React.CSSProperties | undefined => {
      if (!isReacting) return undefined;
      switch (currentReaction) {
        case 'jump-joy':
          return {
            animation: 'dogEarJumpLeft 1.9s ease-in-out forwards',
            transformOrigin: '62px 76px',
          };
        case 'side-wiggle':
          return {
            animation: 'dogEarWiggleLeft 1.9s ease-in-out forwards',
            transformOrigin: '62px 76px',
          };
        case 'body-shake':
          return {
            animation: 'dogEarShakeLeft 1.8s ease-in-out forwards',
            transformOrigin: '62px 76px',
          };
        case 'content-tilt':
          return {
            animation: 'dogEarTiltLeft 2.0s ease-in-out forwards',
            transformOrigin: '62px 76px',
          };
        case 'playful-roll':
          return {
            animation: 'dogEarRollLeft 1.9s ease-in-out forwards',
            transformOrigin: '62px 76px',
          };
        case 'camera-nuzzle':
          return {
            animation: 'dogEarNuzzleLeft 2.0s ease-in-out forwards',
            transformOrigin: '62px 76px',
          };
        case 'happy-stretch':
          return {
            animation: 'dogEarStretchLeft 2.0s ease-in-out forwards',
            transformOrigin: '62px 76px',
          };
        case 'victory-dance':
          return {
            animation: 'dogEarVictoryLeft 1.9s ease-in-out forwards',
            transformOrigin: '62px 76px',
          };
        default:
          return undefined;
      }
    };

    const getDogEarRightStyle = (): React.CSSProperties | undefined => {
      if (!isReacting) return undefined;
      switch (currentReaction) {
        case 'jump-joy':
          return {
            animation: 'dogEarJumpRight 1.9s ease-in-out forwards',
            transformOrigin: '138px 76px',
          };
        case 'side-wiggle':
          return {
            animation: 'dogEarWiggleRight 1.9s ease-in-out forwards',
            transformOrigin: '138px 76px',
          };
        case 'body-shake':
          return {
            animation: 'dogEarShakeRight 1.8s ease-in-out forwards',
            transformOrigin: '138px 76px',
          };
        case 'content-tilt':
          return {
            animation: 'dogEarTiltRight 2.0s ease-in-out forwards',
            transformOrigin: '138px 76px',
          };
        case 'playful-roll':
          return {
            animation: 'dogEarRollRight 1.9s ease-in-out forwards',
            transformOrigin: '138px 76px',
          };
        case 'camera-nuzzle':
          return {
            animation: 'dogEarNuzzleRight 2.0s ease-in-out forwards',
            transformOrigin: '138px 76px',
          };
        case 'happy-stretch':
          return {
            animation: 'dogEarStretchRight 2.0s ease-in-out forwards',
            transformOrigin: '138px 76px',
          };
        case 'victory-dance':
          return {
            animation: 'dogEarVictoryRight 1.9s ease-in-out forwards',
            transformOrigin: '138px 76px',
          };
        default:
          return undefined;
      }
    };

    return (
      <div
        className="relative inline-block"
        style={{ width: size, height: size, ...dogCssVars }}
      >
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full select-none overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="dogBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#EAC7A1" />
              <stop offset="100%" stopColor="#D9B387" />
            </linearGradient>
            <linearGradient id="dogEarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#C89D6E" />
              <stop offset="100%" stopColor="#B38654" />
            </linearGradient>
          </defs>

          <style>{`
            @keyframes dogBreathingLively {
              0%, 100% { transform: translateY(0px) scale(1, 1); }
              50% { transform: translateY(-3.5px) scale(1.02, 0.985); }
            }
            @keyframes dogTailGentle {
              0%, 100% { transform: rotate(3deg); }
              50% { transform: rotate(12deg); }
            }

            /* Reaction 1: Hop / Bounce */
            @keyframes dogHopBounce {
              0% { transform: translateY(0) scale(1, 1); }
              12% { transform: translateY(4px) scale(1.08, 0.92); }
              30% { transform: translateY(var(--dog-hop-h, -26px)) scale(0.92, 1.08); }
              50% { transform: translateY(3px) scale(1.06, 0.94); }
              68% { transform: translateY(var(--dog-micro-hop-h, -13px)) scale(0.96, 1.04); }
              84% { transform: translateY(1px) scale(1.03, 0.97); }
              100% { transform: translateY(0) scale(1, 1); }
            }
            @keyframes dogTailWagBounce {
              0%, 100% { transform: rotate(8deg); }
              25% { transform: rotate(32deg); }
              45% { transform: rotate(-6deg); }
              65% { transform: rotate(30deg); }
              85% { transform: rotate(4deg); }
            }

            /* Reaction 2: Side Wiggle */
            @keyframes dogSideWiggle {
              0% { transform: translateX(0) rotate(0deg); }
              12% { transform: translateX(-10px) rotate(-5.5deg) translateY(-2px); }
              25% { transform: translateX(10px) rotate(5.5deg) translateY(-2px); }
              38% { transform: translateX(-9px) rotate(-5deg) translateY(-1px); }
              50% { transform: translateX(9px) rotate(5deg) translateY(-1px); }
              62% { transform: translateX(-6px) rotate(-3.5deg); }
              75% { transform: translateX(6px) rotate(3.5deg); }
              88% { transform: translateX(-2px) rotate(-1.5deg); }
              100% { transform: translateX(0) rotate(0deg); }
            }
            @keyframes dogTailWagHyper {
              0%, 100% { transform: rotate(-14deg); }
              50% { transform: rotate(36deg); }
            }
            @keyframes dogEarWiggleLeft {
              0%, 100% { transform: rotate(0deg); }
              25% { transform: rotate(-10deg); }
              75% { transform: rotate(8deg); }
            }
            @keyframes dogEarWiggleRight {
              0%, 100% { transform: rotate(0deg); }
              25% { transform: rotate(8deg); }
              75% { transform: rotate(-10deg); }
            }

            /* Reaction 3: Spin / Twirl */
            @keyframes dogSpinTwirl {
              0% { transform: rotate(0deg) translateY(0) scale(1); }
              14% { transform: rotate(-12deg) translateY(3px) scale(1.05, 0.95); }
              35% { transform: rotate(120deg) translateY(var(--dog-spin-lift, -16px)) scale(0.92, 1.06); }
              55% { transform: rotate(240deg) translateY(var(--dog-spin-lift, -14px)) scale(0.93, 1.05); }
              75% { transform: rotate(360deg) translateY(2px) scale(1.07, 0.93); }
              88% { transform: rotate(360deg) translateY(-3px) scale(0.98, 1.02); }
              100% { transform: rotate(360deg) translateY(0) scale(1); }
            }
            @keyframes dogTailTwirl {
              0% { transform: rotate(0deg); }
              35% { transform: rotate(-22deg); }
              70% { transform: rotate(32deg); }
              100% { transform: rotate(0deg); }
            }

            /* Reaction 4: Content Squint & Inquisitive Tilt */
            @keyframes dogContentTilt {
              0% { transform: rotate(0deg) translateY(0); }
              22% { transform: rotate(8deg) translateY(-3px) scale(1.02); }
              42% { transform: rotate(11deg) translateY(-5px) scale(1.03); }
              68% { transform: rotate(10deg) translateY(-4px) scale(1.02); }
              86% { transform: rotate(4deg) translateY(-1px); }
              100% { transform: rotate(0deg) translateY(0); }
            }
            @keyframes dogTailContent {
              0%, 100% { transform: rotate(6deg); }
              50% { transform: rotate(18deg); }
            }
            @keyframes dogEarTiltLeft {
              0%, 100% { transform: rotate(0deg); }
              42% { transform: rotate(9deg); }
            }
            @keyframes dogEarTiltRight {
              0%, 100% { transform: rotate(0deg); }
              42% { transform: rotate(-6deg); }
            }

            /* Reaction 5: Jump for Joy */
            @keyframes dogJumpJoy {
              0% { transform: translateY(0) scale(1, 1); }
              12% { transform: translateY(7px) scale(1.14, 0.86); }
              28% { transform: translateY(var(--dog-jump-h, -36px)) scale(0.88, 1.14); }
              46% { transform: translateY(var(--dog-jump-pause, -34px)) scale(0.94, 1.06); }
              64% { transform: translateY(6px) scale(1.15, 0.87); }
              78% { transform: translateY(-8px) scale(0.96, 1.04); }
              90% { transform: translateY(2px) scale(1.02, 0.98); }
              100% { transform: translateY(0) scale(1, 1); }
            }
            @keyframes dogTailJump {
              0%, 100% { transform: rotate(8deg); }
              28%, 46% { transform: rotate(34deg) scale(1.1); }
              64% { transform: rotate(-10deg); }
              78% { transform: rotate(24deg); }
            }
            @keyframes dogEarJumpLeft {
              0%, 100% { transform: rotate(0deg); }
              28%, 46% { transform: rotate(-24deg) translateY(-4px); }
              64% { transform: rotate(8deg); }
            }
            @keyframes dogEarJumpRight {
              0%, 100% { transform: rotate(0deg); }
              28%, 46% { transform: rotate(24deg) translateY(-4px); }
              64% { transform: rotate(-8deg); }
            }

            /* Reaction 6: Body Shake */
            @keyframes dogBodyShake {
              0% { transform: rotate(0deg) translateX(0) scale(1); }
              8% { transform: rotate(-4deg) translateX(-5px) scale(1.03, 0.97); }
              16% { transform: rotate(4deg) translateX(5px) scale(0.97, 1.03); }
              24% { transform: rotate(-5deg) translateX(-6px) scale(1.04, 0.96); }
              32% { transform: rotate(5deg) translateX(6px) scale(0.96, 1.04); }
              40% { transform: rotate(-4deg) translateX(-4px); }
              48% { transform: rotate(4deg) translateX(4px); }
              58% { transform: rotate(-2.5deg) translateX(-3px); }
              68% { transform: rotate(2deg) translateX(2px); }
              80% { transform: rotate(-1deg) translateX(-1px); }
              90% { transform: rotate(0deg) scale(1.02, 0.98); }
              100% { transform: rotate(0deg) scale(1, 1); }
            }
            @keyframes dogTailShake {
              0%, 100% { transform: rotate(6deg); }
              12% { transform: rotate(34deg); }
              24% { transform: rotate(-16deg); }
              36% { transform: rotate(32deg); }
              48% { transform: rotate(-12deg); }
              60% { transform: rotate(28deg); }
              72% { transform: rotate(-6deg); }
              84% { transform: rotate(18deg); }
            }
            @keyframes dogEarShakeLeft {
              0%, 100% { transform: rotate(0deg); }
              12%, 36%, 60% { transform: rotate(-22deg); }
              24%, 48%, 72% { transform: rotate(14deg); }
            }
            @keyframes dogEarShakeRight {
              0%, 100% { transform: rotate(0deg); }
              12%, 36%, 60% { transform: rotate(22deg); }
              24%, 48%, 72% { transform: rotate(-14deg); }
            }

            /* Reaction 7: Playful Roll */
            @keyframes dogPlayfulRoll {
              0% { transform: rotate(0deg) translateY(0) scale(1, 1); }
              16% { transform: rotate(-18deg) translateY(5px) scale(1.05, 0.95); }
              36% { transform: rotate(50deg) translateY(14px) scale(0.95, 1.03); }
              52% { transform: rotate(78deg) translateY(18px) scale(0.94, 1.06); }
              70% { transform: rotate(40deg) translateY(12px) scale(0.97, 1.02); }
              84% { transform: rotate(-10deg) translateY(-5px) scale(1.04, 0.96); }
              92% { transform: rotate(3deg) translateY(1px) scale(1.01, 0.99); }
              100% { transform: rotate(0deg) translateY(0) scale(1, 1); }
            }
            @keyframes dogTailRoll {
              0%, 100% { transform: rotate(10deg); }
              36% { transform: rotate(-26deg); }
              52% { transform: rotate(36deg); }
              70% { transform: rotate(-14deg); }
            }
            @keyframes dogEarRollLeft {
              0%, 100% { transform: rotate(0deg); }
              36% { transform: rotate(20deg); }
              52% { transform: rotate(-30deg); }
              70% { transform: rotate(10deg); }
            }
            @keyframes dogEarRollRight {
              0%, 100% { transform: rotate(0deg); }
              36% { transform: rotate(-20deg); }
              52% { transform: rotate(30deg); }
              70% { transform: rotate(-10deg); }
            }

            /* Reaction 8: Camera Nuzzle (snout boop) */
            @keyframes dogCameraNuzzle {
              0% { transform: scale(1) translateY(0) rotate(0deg); }
              20% { transform: scale(1.08) translateY(-6px) rotate(3deg); }
              42% { transform: scale(var(--dog-nuzzle-scale, 1.22)) translateY(-15px) rotate(-5deg); }
              62% { transform: scale(var(--dog-nuzzle-scale, 1.22)) translateY(-13px) rotate(-4deg); }
              82% { transform: scale(1.06) translateY(-4px) rotate(1deg); }
              100% { transform: scale(1) translateY(0) rotate(0deg); }
            }
            @keyframes dogTailNuzzle {
              0%, 100% { transform: rotate(8deg); }
              30%, 70% { transform: rotate(26deg); }
              50% { transform: rotate(-8deg); }
            }
            @keyframes dogEarNuzzleLeft {
              0%, 100% { transform: rotate(0deg); }
              42%, 62% { transform: rotate(12deg) translateY(-2px); }
            }
            @keyframes dogEarNuzzleRight {
              0%, 100% { transform: rotate(0deg); }
              42%, 62% { transform: rotate(-12deg) translateY(-2px); }
            }

            /* Reaction 9: Happy Stretch */
            @keyframes dogHappyStretch {
              0% { transform: scale(1, 1) translateY(0) skewX(0deg); }
              16% { transform: scale(1.12, 0.86) translateY(9px) skewX(3deg); }
              38% { transform: scale(0.90, 1.16) translateY(-16px) skewX(-4deg); }
              58% { transform: scale(0.90, 1.16) translateY(-14px) skewX(-3deg); }
              78% { transform: scale(1.06, 0.94) translateY(3px) skewX(1deg); }
              90% { transform: scale(0.98, 1.02) translateY(-2px); }
              100% { transform: scale(1, 1) translateY(0) skewX(0deg); }
            }
            @keyframes dogTailStretch {
              0%, 100% { transform: rotate(8deg); }
              38%, 58% { transform: rotate(35deg) scale(1.15); }
              78% { transform: rotate(-6deg); }
            }
            @keyframes dogEarStretchLeft {
              0%, 100% { transform: rotate(0deg); }
              38%, 58% { transform: rotate(-18deg); }
              78% { transform: rotate(8deg); }
            }
            @keyframes dogEarStretchRight {
              0%, 100% { transform: rotate(0deg); }
              38%, 58% { transform: rotate(18deg); }
              78% { transform: rotate(-8deg); }
            }

            /* Reaction 10: Victory Dance (tippy-taps) */
            @keyframes dogVictoryDance {
              0% { transform: translateY(0) rotate(0deg); }
              10% { transform: translateY(-10px) translateX(-4px) rotate(-4deg); }
              20% { transform: translateY(1px) translateX(0) rotate(0deg); }
              30% { transform: translateY(-10px) translateX(4px) rotate(4deg); }
              40% { transform: translateY(1px) translateX(0) rotate(0deg); }
              52% { transform: translateY(-18px) rotate(0deg) scale(1.06); }
              66% { transform: translateY(3px) scale(1.06, 0.94); }
              80% { transform: translateY(-6px) scale(0.98, 1.02); }
              90% { transform: translateY(1px) scale(1.01, 0.99); }
              100% { transform: translateY(0) rotate(0deg) scale(1); }
            }
            @keyframes dogTailVictory {
              0%, 100% { transform: rotate(10deg); }
              20% { transform: rotate(-16deg); }
              40% { transform: rotate(34deg); }
              60% { transform: rotate(-18deg); }
              80% { transform: rotate(30deg); }
            }
            @keyframes dogEarVictoryLeft {
              0%, 100% { transform: rotate(0deg); }
              10%, 30%, 52% { transform: rotate(-16deg); }
              20%, 40%, 66% { transform: rotate(8deg); }
            }
            @keyframes dogEarVictoryRight {
              0%, 100% { transform: rotate(0deg); }
              10%, 30%, 52% { transform: rotate(16deg); }
              20%, 40%, 66% { transform: rotate(-8deg); }
            }
          `}</style>

          {/* Animated dog group with key to trigger fresh keyframe on each feed */}
          <g
            key={`dog-anim-${feedIteration}-${isReacting ? currentReaction : 'idle'}`}
            style={getDogAnimStyle()}
          >
            {/* Wagging / Reacting Tail */}
            <path
              d="M148 152 C168 144 182 128 178 112 C176 102 165 106 166 114 C167 122 158 132 144 140"
              fill="none"
              stroke="#C89D6E"
              strokeWidth="11"
              strokeLinecap="round"
              style={getDogTailStyle()}
            />

            {/* Rounded Body */}
            <ellipse cx="100" cy="144" rx="50" ry="43" fill="url(#dogBodyGrad)" />

            {/* Warm Belly Patch */}
            <ellipse cx="100" cy="148" rx="26" ry="24" fill="#FFF8F0" opacity="0.85" />

            {/* Rounded Front Paws */}
            <ellipse cx="80" cy="178" rx="14" ry="9" fill="#D9B387" />
            <ellipse cx="120" cy="178" rx="14" ry="9" fill="#D9B387" />

            {/* Head */}
            <circle cx="100" cy="94" r="44" fill="url(#dogBodyGrad)" />

            {/* Floppy Left Ear */}
            <path
              d="M62 76 C44 80 46 114 62 118 C70 120 74 102 68 86 Z"
              fill="url(#dogEarGrad)"
              style={getDogEarLeftStyle()}
            />

            {/* Floppy Right Ear */}
            <path
              d="M138 76 C156 80 154 114 138 118 C130 120 126 102 132 86 Z"
              fill="url(#dogEarGrad)"
              style={getDogEarRightStyle()}
            />

            {/* Snout Area */}
            <ellipse cx="100" cy="106" rx="20" ry="15" fill="#FFF4E6" />

            {/* Cheeks Blush */}
            <circle
              cx="72"
              cy="106"
              r={currentReaction === 'camera-nuzzle' && isReacting ? 8.5 : 7}
              fill="#F8C7BA"
              opacity={isReacting ? (currentReaction === 'camera-nuzzle' ? 1.0 : 0.95) : 0.4}
            />
            <circle
              cx="128"
              cy="106"
              r={currentReaction === 'camera-nuzzle' && isReacting ? 8.5 : 7}
              fill="#F8C7BA"
              opacity={isReacting ? (currentReaction === 'camera-nuzzle' ? 1.0 : 0.95) : 0.4}
            />

            {/* Eyes: varied per reaction */}
            {isReacting ? (
              currentReaction === 'content-tilt' ||
              currentReaction === 'camera-nuzzle' ||
              currentReaction === 'happy-stretch' ? (
                // Content, blissful puppy squint (sweet curved crescents: ‿ ‿)
                <g stroke="#4E3524" strokeWidth="3" strokeLinecap="round" fill="none">
                  <path d="M77 91 Q84 96 92 91" />
                  <path d="M108 91 Q116 96 123 91" />
                </g>
              ) : currentReaction === 'body-shake' ? (
                // Cute squeezed-shut eyes (> <) while shaking
                <g stroke="#4E3524" strokeWidth="2.8" strokeLinecap="round" fill="none">
                  <path d="M77 88 L85 92 L77 96" />
                  <path d="M123 88 L115 92 L123 96" />
                </g>
              ) : currentReaction === 'jump-joy' || currentReaction === 'victory-dance' ? (
                // Big joyful arcs (^ ^)
                <g>
                  <path d="M77 93 Q85 81 93 93" stroke="#4E3524" strokeWidth="3.4" strokeLinecap="round" fill="none" />
                  <path d="M107 93 Q115 81 123 93" stroke="#4E3524" strokeWidth="3.4" strokeLinecap="round" fill="none" />
                  <circle cx="85" cy="86" r="1.5" fill="#F8C7BA" />
                  <circle cx="115" cy="86" r="1.5" fill="#F8C7BA" />
                </g>
              ) : currentReaction === 'spin-twirl' || currentReaction === 'playful-roll' ? (
                // Excited twirl/roll eyes
                <g stroke="#4E3524" strokeWidth="3.2" strokeLinecap="round" fill="none">
                  <path d="M77 92 Q85 82 93 92" />
                  <path d="M107 92 Q115 82 123 92" />
                </g>
              ) : (
                // Cheerful arcs for hop-bounce and side-wiggle
                <g stroke="#4E3524" strokeWidth="3.2" strokeLinecap="round" fill="none">
                  <path d="M78 92 Q85 83 92 92" />
                  <path d="M108 92 Q115 83 122 92" />
                </g>
              )
            ) : isBlinking ? (
              <g stroke="#4E3524" strokeWidth="2.8" strokeLinecap="round" fill="none">
                <line x1="78" y1="92" x2="92" y2="92" />
                <line x1="108" y1="92" x2="122" y2="92" />
              </g>
            ) : (
              <g fill="#452F1E">
                <ellipse cx="85" cy="91" rx="5" ry="6.5" />
                <ellipse cx="115" cy="91" rx="5" ry="6.5" />
                <circle cx="83.5" cy="89" r="1.8" fill="#FFFFFF" />
                <circle cx="113.5" cy="89" r="1.8" fill="#FFFFFF" />
              </g>
            )}

            {/* Heart-shaped Nose */}
            <path
              d="M95 101 C95 98 105 98 105 101 C105 104 100 108 100 108 C100 108 95 104 95 101 Z"
              fill="#422E1F"
            />

            {/* Gentle Smile / Tongue */}
            {isReacting ? (
              currentReaction === 'content-tilt' || currentReaction === 'camera-nuzzle' ? (
                // Content peaceful soft closed smile
                <path
                  d="M95 108 Q100 112 105 108"
                  fill="none"
                  stroke="#422E1F"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              ) : currentReaction === 'body-shake' ? (
                // Shaking mouth with little side tongue
                <g>
                  <path
                    d="M94 108 Q100 112 106 108"
                    fill="none"
                    stroke="#422E1F"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <path d="M98 110 C98 114 103 114 103 110 Z" fill="#F4978E" />
                </g>
              ) : (
                // Happy open tongue pant for jump, bounce, wiggle, twirl, roll, victory, stretch
                <g>
                  <path
                    d="M95 109 Q100 114 105 109"
                    fill="none"
                    stroke="#422E1F"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <path d="M97 111 C97 116.5 103 116.5 103 111 Z" fill="#F4978E" />
                </g>
              )
            ) : (
              <path
                d="M95 108 Q100 112 105 108"
                fill="none"
                stroke="#422E1F"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}
          </g>
        </svg>
      </div>
    );
  };

  // Treat Biscuit Component
  const renderTreatIcon = () => {
    return (
      <div className="w-10 h-10 rounded-full bg-[#E8C28A] border border-[#CCA268] shadow-sm flex items-center justify-center text-[#785128] select-none">
        {selectedPet === 'cat' ? (
          // Little fish shape treat for cat
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
            <path d="M12 4C8 4 4 8 4 12C4 16 8 20 12 20C15 20 18 18 20 15L22 17V7L20 9C18 6 15 4 12 4ZM7 11C6.4 11 6 10.6 6 10C6 9.4 6.4 9 7 9C7.6 9 8 9.4 8 10C8 10.6 7.6 11 7 11Z" />
          </svg>
        ) : (
          // Little bone / biscuit shape treat for dog
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
            <path d="M18 5C16.9 5 16 5.9 16 7C16 7.3 16.1 7.6 16.2 7.8L7.8 16.2C7.6 16.1 7.3 16 7 16C5.9 16 5 16.9 5 18C5 19.1 5.9 20 7 20C8.1 20 9 19.1 9 18C9 17.7 8.9 17.4 8.8 17.2L17.2 8.8C17.4 8.9 17.7 9 18 9C19.1 9 20 8.1 20 7C20 5.9 19.1 5 18 5Z" />
          </svg>
        )}
      </div>
    );
  };

  // Floating particles renderer
  const renderParticles = () => {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-visible flex items-center justify-center">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute transition-all duration-[2000ms] ease-out flex items-center justify-center animate-[bounce_1.8s_ease-out_infinite]"
            style={{
              transform: `translate(${p.x}px, ${p.y - 70}px)`,
              opacity: p.opacity,
            }}
          >
            {p.type === 'heart' ? (
              <Heart className="w-5 h-5 text-rose-400 fill-rose-300 drop-shadow-xs" />
            ) : (
              <Sparkles className="w-5 h-5 text-amber-400 fill-amber-300 drop-shadow-xs" />
            )}
          </div>
        ))}
      </div>
    );
  };

  // Dynamic vertical travel distance in pixels for the falling stage
  const TRAVEL_HEIGHT_PX = 230;
  const currentTreatY = foodProgress * TRAVEL_HEIGHT_PX;
  const catchZoneCenterY = ((CATCH_ZONE_START + CATCH_ZONE_END) / 2) * TRAVEL_HEIGHT_PX;

  return (
    <div
      id="companion-game-container"
      className="w-full max-w-2xl mx-auto select-none font-['Plus_Jakarta_Sans',sans-serif]"
    >
      {/* 
        ========================================================================
        SCREEN 1: PET SELECTION SCREEN
        ========================================================================
      */}
      {!selectedPet && (
        <div
          className={`bg-white/85 backdrop-blur-sm border border-[#E8E1D5] rounded-3xl p-6 sm:p-10 shadow-xs transition-opacity duration-500 text-center ${
            screenTransitioning ? 'opacity-0 scale-98' : 'opacity-100 scale-100'
          }`}
        >
          {/* Header text */}
          <div className="mb-8">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF2ED] text-[#294B3B] text-xs font-semibold mb-3 border border-[#D2E2D8]">
              <Heart className="w-3.5 h-3.5 text-[#315243]" />
              <span>Companion Space</span>
            </span>
            <h2 className="text-2xl sm:text-3xl font-semibold text-[#1F2F26] font-['Lora',serif]">
              Choose your gentle companion
            </h2>
            <p className="mt-2 text-sm text-[#5D6B63] max-w-md mx-auto">
              A quiet, judgment-free friend to be with you. There are no wrong choices, timers, or scores.
            </p>
          </div>

          {/* Two large side-by-side rounded cards: Cat and Dog */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-lg mx-auto">
            {/* Cat Option */}
            <button
              type="button"
              id="select-pet-cat-btn"
              onClick={() => handleSelectPet('cat')}
              className="group flex flex-col items-center justify-center p-6 sm:p-7 rounded-3xl bg-[#FAF7F2] hover:bg-[#F3EDE2] border border-[#E5DDD0] hover:border-[#D0C2AE] transition-all duration-300 shadow-2xs hover:shadow-md cursor-pointer text-center focus:outline-none focus:ring-2 focus:ring-[#315243]/20"
            >
              <div className="transform group-hover:scale-105 transition-transform duration-500 mb-4">
                {renderCat(140)}
              </div>
              <span className="text-lg font-semibold text-[#273A30] font-['Lora',serif] group-hover:text-[#182C22]">
                Cat
              </span>
              <span className="text-xs text-[#6F7F76] mt-1">
                Quiet &amp; purring presence
              </span>
            </button>

            {/* Dog Option */}
            <button
              type="button"
              id="select-pet-dog-btn"
              onClick={() => handleSelectPet('dog')}
              className="group flex flex-col items-center justify-center p-6 sm:p-7 rounded-3xl bg-[#FAF7F2] hover:bg-[#F3EDE2] border border-[#E5DDD0] hover:border-[#D0C2AE] transition-all duration-300 shadow-2xs hover:shadow-md cursor-pointer text-center focus:outline-none focus:ring-2 focus:ring-[#315243]/20"
            >
              <div className="transform group-hover:scale-105 transition-transform duration-500 mb-4">
                {renderDog(140)}
              </div>
              <span className="text-lg font-semibold text-[#273A30] font-['Lora',serif] group-hover:text-[#182C22]">
                Dog
              </span>
              <span className="text-xs text-[#6F7F76] mt-1">
                Warm &amp; faithful presence
              </span>
            </button>
          </div>

          <div className="mt-8 text-xs text-[#7A8A81]">
            <span>Click either friend to begin spending peaceful time together.</span>
          </div>
        </div>
      )}

      {/* 
        ========================================================================
        SCREEN 2: MAIN FEEDING SCREEN (WITH VISIBLE CATCH ZONE & GENTLE SOUND)
        ========================================================================
      */}
      {selectedPet && (
        <div
          className={`relative bg-gradient-to-b from-[#FDFCFA] to-[#F5EFEB] border border-[#EAE3D7] rounded-3xl p-6 sm:p-8 shadow-sm transition-all duration-500 min-h-[560px] flex flex-col justify-between overflow-hidden ${
            screenTransitioning ? 'opacity-0 scale-98' : 'opacity-100 scale-100'
          }`}
        >
          {/* Top Bar: Change Pet & Audio Mute/Unmute Toggle */}
          <div className="flex items-center justify-between gap-3 mb-2 shrink-0">
            <button
              type="button"
              id="game-change-pet-btn"
              onClick={handleBackToSelect}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/85 hover:bg-white text-[#4A5D52] hover:text-[#1E3327] border border-[#E0D7C9] text-xs font-medium transition-colors cursor-pointer shadow-2xs"
              title="Choose a different companion"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Change Pet</span>
            </button>

            {/* Sound toggle button (ON by default) */}
            <button
              type="button"
              id="game-sound-toggle-btn"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/85 hover:bg-white text-[#4A5D52] hover:text-[#1E3327] border border-[#E0D7C9] text-xs font-medium transition-colors cursor-pointer shadow-2xs"
              title={soundEnabled ? "Mute soothing sound" : "Unmute soothing sound"}
              aria-label={soundEnabled ? "Mute soothing sound" : "Unmute soothing sound"}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-[#2A4C3B]" />
                  <span className="text-[11px] text-[#335644] font-medium hidden sm:inline">Sound On</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-[#8A9A90]" />
                  <span className="text-[11px] text-[#788880] font-medium hidden sm:inline">Muted</span>
                </>
              )}
            </button>
          </div>

          {/* Central Vertical Stage: Falling Food -> Catch Zone -> Animated Pet */}
          <div className="relative flex-1 flex flex-col items-center justify-center my-2 select-none">
            {/* Particle Burst on Feeding */}
            {renderParticles()}

            {/* Falling Track Container */}
            <div
              className="relative w-full max-w-[260px] flex items-center justify-center"
              style={{ height: TRAVEL_HEIGHT_PX + 150 }}
            >
              {/* 
                ================================================================
                CATCH ZONE CIRCLE
                - Visible circle positioned above the companion
                - Soft dashed calm styling matching the aesthetic
                - Gently highlights when treat enters the circle
                ================================================================
              */}
              <div
                id="companion-catch-zone"
                className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full flex flex-col items-center justify-center transition-all duration-200 pointer-events-none ${
                  isInsideCatchZone && !isDelivered
                    ? 'w-20 h-20 border-2 border-[#2A5741] bg-[#E3EFE8]/80 shadow-md ring-4 ring-[#33684E]/20 scale-105'
                    : 'w-20 h-20 border-2 border-dashed border-[#B8D1C3] bg-[#F2F7F4]/55'
                }`}
                style={{
                  top: `${catchZoneCenterY}px`,
                }}
              >
                <Sparkles
                  className={`w-4 h-4 transition-colors ${
                    isInsideCatchZone && !isDelivered ? 'text-[#204935] animate-spin' : 'text-[#87A895]'
                  }`}
                />
                <span
                  className={`text-[9px] uppercase tracking-wider font-semibold mt-0.5 transition-colors ${
                    isInsideCatchZone && !isDelivered ? 'text-[#1E4330] font-bold' : 'text-[#7B9B88]'
                  }`}
                >
                  Catch
                </span>
              </div>

              {/* 
                ================================================================
                FALLING FOOD ITEM
                - Drifts gently from top to bottom
                - Snaps smoothly if caught in circle
                ================================================================
              */}
              {!isDelivered && (
                <div
                  id="falling-food-item"
                  className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-75 ease-linear"
                  style={{
                    top: `${currentTreatY}px`,
                    transform: `translate(-50%, -50%) scale(${isInsideCatchZone ? 1.12 : 1})`,
                  }}
                >
                  {renderTreatIcon()}
                </div>
              )}

              {/* 
                ================================================================
                ANIMATED COMPANION (CAT OR DOG)
                - Positioned at the bottom of the falling column
                - Fast, lively, alert breathing (~1.8s) & tail animations
                ================================================================
              */}
              <div
                id="companion-pet-model"
                data-pet-type={selectedPet}
                data-pet-reaction={isReacting ? currentReaction : 'idle'}
                className="absolute left-1/2 -translate-x-1/2 bottom-0 flex flex-col items-center justify-center"
              >
                {/* Speech Bubble: Positioned right above the companion's head/face */}
                {currentMessage && (
                  <div
                    id="pet-speech-bubble"
                    className="absolute -top-11 sm:-top-13 z-30 px-4 py-1.5 rounded-2xl bg-white text-[#21382C] text-sm sm:text-base font-semibold shadow-md border border-[#DDD4C5] transition-all duration-300 animate-[fade-in_0.3s_ease-out] flex items-center justify-center text-center whitespace-nowrap select-none"
                  >
                    <span>{currentMessage}</span>
                    {/* Speech bubble beak pointing straight down to pet's head */}
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-[#DDD4C5] rotate-45"></div>
                  </div>
                )}

                {selectedPet === 'cat' ? renderCat(170) : renderDog(170)}
              </div>
            </div>
          </div>

          {/* Bottom Controls & Clear Guidance */}
          <div className="mt-2 text-center shrink-0">
            {/* Helpful, calm guidance */}
            <div className="mb-3">
              <p className="text-xs sm:text-sm font-medium text-[#294235] font-['Lora',serif]">
                Press <kbd className="px-2 py-0.5 rounded-lg bg-white border border-[#DDD5C7] text-[#1E3228] text-xs font-mono shadow-2xs mx-1 font-semibold">Space</kbd> while the treat is inside the circle to catch early.
              </p>
              <p className="text-xs text-[#6F7F77] mt-1">
                Or simply let it fall to be fed gently. No penalties, no wrong timing.
              </p>
            </div>

            {/* Tap/Click Button (Works for mouse and mobile touch screen) */}
            <div className="flex justify-center">
              <button
                type="button"
                id="catch-treat-btn"
                onClick={handleCatchAction}
                disabled={isDelivered}
                className={`px-6 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer shadow-xs select-none border ${
                  isInsideCatchZone && !isDelivered
                    ? 'bg-[#294D3B] text-white border-[#294D3B] shadow-md ring-2 ring-[#315743]/25 scale-102'
                    : 'bg-white hover:bg-[#F4EFE6] text-[#284838] border-[#D9D1C2]'
                }`}
              >
                {isInsideCatchZone ? '✨ Catch in Circle! ✨' : 'Press Space to Catch (or Wait)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
