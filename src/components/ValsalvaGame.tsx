import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldAlert, 
  Wind, 
  Sparkles, 
  RotateCcw, 
  Play, 
  Square, 
  CheckCircle2, 
  Heart, 
  ArrowRight,
  Info
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface ValsalvaGameProps {
  onSelectOtherGame?: () => void;
}

type ExerciseStep = 'ready' | 'inhale' | 'hold' | 'relax' | 'completed';

export const ValsalvaGame: React.FC<ValsalvaGameProps> = ({ onSelectOtherGame }) => {
  const { language } = useLanguage();

  // Safety acknowledgment state (user must acknowledge safety framing before proceeding)
  const [hasAcknowledgedSafety, setHasAcknowledgedSafety] = useState<boolean>(false);

  // Exercise step state
  const [step, setStep] = useState<ExerciseStep>('ready');
  const [countdown, setCountdown] = useState<number>(12);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Exercise flow coordinator
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (step === 'inhale') {
      // Step 1: Inhale deeply through nose (4 seconds)
      setCountdown(4);
      let remaining = 4;
      timerRef.current = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          setStep('hold');
        }
      }, 1000);
    } else if (step === 'hold') {
      // Step 2: Gentle hold / balloon technique (12 seconds countdown)
      setCountdown(12);
      let remaining = 12;
      timerRef.current = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          setStep('relax');
        }
      }, 1000);
    } else if (step === 'relax') {
      // Step 3: Relax and breathe normally (6 seconds calm pause)
      setCountdown(6);
      let remaining = 6;
      timerRef.current = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          setStep('completed');
        }
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step]);

  const handleStart = () => {
    setStep('inhale');
  };

  const handleStop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStep('ready');
  };

  const handleRepeat = () => {
    setStep('inhale');
  };

  // Translations for all steps and safety notice
  const text = {
    safetyTag: language === 'ar' ? 'تنبيه أمان وسلامة' : language === 'fr' ? 'Note de sécurité' : 'Safety First',
    safetyTitle: language === 'ar' ? 'إشعار صحي قبل البدء' : language === 'fr' ? 'Précautions avant de commencer' : 'Important Safety Note',
    safetyMessage: 
      language === 'ar'
        ? 'تتضمن هذه التقنية حبس أنفاسك بلطف. إذا كنت تعاني من أي حالة قلبية، أو مشاكل في ضغط الدم، أو لم تكن متأكداً مما إذا كانت آمنة لك، يُرجى استشارة الطبيب قبل تجربتها، أو الاستمتاع بتماريننا المهدئة الأخرى بدلاً منها.'
        : language === 'fr'
        ? "Cette technique implique de retenir doucement votre respiration. Si vous avez des problèmes cardiaques, des troubles de la tension artérielle ou si vous n'êtes pas sûr(e) que cela soit sans danger pour vous, veuillez consulter un médecin avant de l'essayer, ou profitez simplement de nos autres exercices apaisants."
        : 'This technique involves gently holding your breath. If you have any heart condition, blood pressure issues, or are unsure if this is safe for you, please consult a doctor before trying it, or simply enjoy our other calming exercises instead.',
    acknowledgeBtn: language === 'ar' ? 'فهمت ذلك، متابعة' : language === 'fr' ? "J'ai compris, continuer" : 'I understand, continue',
    otherExercisesBtn: language === 'ar' ? 'استكشاف التمارين الأخرى' : language === 'fr' ? "Voir d'autres exercices" : 'Explore other calming exercises',
    
    step1Title: language === 'ar' ? 'الخطوة 1: الشهيق' : language === 'fr' ? 'Étape 1 : Inspiration' : 'Step 1: Inhale',
    step1Instruction: 
      language === 'ar'
        ? 'تنفس بعمق من خلال أنفك.'
        : language === 'fr'
        ? 'Inspirez profondément par le nez.'
        : 'Breathe in deeply through your nose.',
        
    step2Title: language === 'ar' ? 'الخطوة 2: ضغط لطيف' : language === 'fr' ? 'Étape 2 : Maintien doux' : 'Step 2: Gentle Hold',
    step2Instruction:
      language === 'ar'
        ? 'والآن، حاول الزفير برفق مع إبقاء فمك مغلقاً وسد أنفك بإصبعيك، وكأنك تنفخ بالوناً دون ترك الهواء يخرج — فقط بجهد خفيف ولطيف، دون أي إجهاد.'
        : language === 'fr'
        ? "Maintenant, essayez doucement d'expirer en gardant la bouche fermée et en vous pinçant le nez, comme pour gonfler un ballon sans laisser l'air sortir — juste un effort léger et doux, sans forcer."
        : 'Now gently try to breathe out while keeping your mouth closed and pinching your nose, as if blowing up a balloon without letting air out — just a light, gentle effort, nothing forceful.',
        
    step3Title: language === 'ar' ? 'الخطوة 3: الاسترخاء' : language === 'fr' ? 'Étape 3 : Relâchement' : 'Step 3: Release',
    step3Instruction:
      language === 'ar'
        ? 'استرخِ وتنفس بشكل طبيعي من جديد.'
        : language === 'fr'
        ? 'Relâchez et respirez à nouveau normalement.'
        : 'Relax and breathe normally again.',

    completedTitle: language === 'ar' ? 'أحسنت' : language === 'fr' ? 'Séance terminée' : 'Peaceful pause complete',
    completedSubtitle:
      language === 'ar'
        ? 'خذ لحظة لملاحظة الإحساس الهادئ في صدرك وتباطؤ نبضاتك.'
        : language === 'fr'
        ? 'Prenez un instant pour ressentir le calme qui s’installe dans votre corps.'
        : 'Take a gentle moment to notice the quiet sensation and settled rhythm in your body.',

    doAgainBtn: language === 'ar' ? 'كرر التمرين' : language === 'fr' ? 'Recommencer' : 'Do it again',
    readyTitle: language === 'ar' ? 'تمارين تقنية فالسالفا' : language === 'fr' ? 'Exercice de Valsalva' : 'Valsalva Calming Technique',
    readySubtitle: 
      language === 'ar'
        ? 'تمرين موجه يهدئ العصب المبهم ببطء وسكينة، دون أي قيود أو ضغط.'
        : language === 'fr'
        ? 'Un exercice doux pour stimuler le nerf vague à votre propre rythme.'
        : 'A gentle guided practice to soothe your nervous system at a calm, unhurried pace.',
    startBtn: language === 'ar' ? 'ابدأ التمرين' : language === 'fr' ? 'Commencer' : 'Begin exercise',
    stopBtn: language === 'ar' ? 'إيقاف التمرين' : language === 'fr' ? 'Arrêter' : 'Stop at any point',
    reviewSafety: language === 'ar' ? 'مراجعة إشعار الأمان' : language === 'fr' ? 'Relire la note de sécurité' : 'Review safety note',
  };

  // 1. SAFETY FRAMING FIRST: Displayed before the exercise can be accessed
  if (!hasAcknowledgedSafety) {
    return (
      <div 
        id="valsalva-safety-framing" 
        className="max-w-xl mx-auto bg-white/90 backdrop-blur-xs border border-[#E3DDD1] rounded-3xl p-4 sm:p-8 md:p-9 shadow-xs text-center w-full max-w-full overflow-hidden"
      >
        <div className="w-12 h-12 rounded-2xl bg-[#F5EDE1] text-[#785434] flex items-center justify-center mx-auto mb-4 border border-[#E8DEC9]">
          <ShieldAlert className="w-6 h-6 text-[#8B653E]" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F5EDE1] text-[#6E4F32] text-xs font-semibold mb-3 border border-[#EADFCB]">
          <Info className="w-3.5 h-3.5" />
          <span>{text.safetyTag}</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-normal text-[#1F2F26] font-['Lora',serif] mb-3">
          {text.safetyTitle}
        </h3>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] border border-[#E9E3D6] text-start mb-6">
          <p className="text-xs sm:text-sm text-[#4E5E54] leading-relaxed font-light">
            {text.safetyMessage}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            id="acknowledge-valsalva-safety-btn"
            onClick={() => setHasAcknowledgedSafety(true)}
            className="w-full sm:w-auto px-6 py-3 bg-[#2D4D3D] hover:bg-[#1F372B] text-white text-xs sm:text-sm font-medium rounded-xl shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>{text.acknowledgeBtn}</span>
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180 text-emerald-200" />
          </button>

          {onSelectOtherGame && (
            <button
              type="button"
              id="choose-other-calming-game-btn"
              onClick={onSelectOtherGame}
              className="w-full sm:w-auto px-5 py-3 bg-[#F2EDE4] hover:bg-[#E6DFD3] text-[#334A3C] text-xs sm:text-sm font-medium rounded-xl border border-[#DCD3C4] transition-all cursor-pointer"
            >
              {text.otherExercisesBtn}
            </button>
          )}
        </div>
      </div>
    );
  }

  // 2. THE EXERCISE STEP-BY-STEP
  return (
    <div className="max-w-2xl mx-auto space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="bg-white/90 backdrop-blur-xs border border-[#E2DDD3] rounded-3xl p-4 sm:p-8 md:p-10 shadow-xs text-center relative overflow-hidden w-full max-w-full">
        {/* Soft top accent line */}
        <div className="absolute top-0 inset-x-0 h-1 w-full bg-gradient-to-r from-[#8AC5A6] via-[#4A7D63] to-[#A3D9BE]"></div>

        {/* STEP: READY */}
        {step === 'ready' && (
          <div className="py-6 flex flex-col items-center">
            {/* Flat pastel visual for ready state */}
            <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-[#EBF4EE] border-4 border-[#C8E1D3] flex items-center justify-center mb-6 shadow-2xs">
              <Heart className="w-12 h-12 text-[#3D6B53]" />
            </div>

            <h3 className="text-xl sm:text-2xl font-normal text-[#1A2D22] font-['Lora',serif] mb-2">
              {text.readyTitle}
            </h3>
            <p className="text-xs sm:text-sm text-[#5B6D62] max-w-md mx-auto leading-relaxed mb-7 font-light">
              {text.readySubtitle}
            </p>

            <button
              type="button"
              id="valsalva-start-exercise-btn"
              onClick={handleStart}
              className="px-6 py-3 bg-[#2D4D3D] hover:bg-[#1E362A] text-white text-xs sm:text-sm font-medium rounded-xl shadow-2xs hover:shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 text-emerald-200 fill-emerald-200" />
              <span>{text.startBtn}</span>
            </button>
          </div>
        )}

        {/* STEP 1: INHALE (Deeply through nose, animated visual cue) */}
        {step === 'inhale' && (
          <div className="py-4 flex flex-col items-center">
            {/* Step badge */}
            <span className="text-[11px] font-semibold text-[#2D5640] bg-[#EAF5EE] border border-[#CFE7D9] px-3 py-0.5 rounded-full mb-5">
              {text.step1Title}
            </span>

            {/* Flat pastel expanding visual cue */}
            <div className="relative w-32 h-32 xs:w-36 xs:h-36 sm:w-48 sm:h-48 flex items-center justify-center mb-6 max-w-full overflow-hidden">
              {/* Animated expanding outer ring */}
              <div 
                className="absolute inset-0 rounded-full bg-[#E3F2E9] border-2 border-[#92CEAA] animate-ping opacity-25"
                style={{ animationDuration: '3s' }}
              />
              <div 
                className="w-28 h-28 xs:w-32 xs:h-32 sm:w-40 sm:h-40 rounded-full bg-[#E8F4EC] border-4 border-[#69B589] flex flex-col items-center justify-center shadow-xs transition-transform duration-1000 scale-105"
              >
                <Wind className="w-8 h-8 sm:w-10 sm:h-10 text-[#2D5640] mb-1 animate-pulse" />
                <span className="text-[10px] sm:text-xs font-semibold text-[#2D5640] uppercase tracking-wider">
                  {language === 'ar' ? 'شهيق' : language === 'fr' ? 'Inspirez' : 'Inhale'}
                </span>
                <span className="text-xs text-[#527763] font-mono mt-0.5">
                  {countdown}s
                </span>
              </div>
            </div>

            {/* Step 1 Instruction Text */}
            <p className="text-base sm:text-lg text-[#1E3025] font-['Lora',serif] max-w-lg mx-auto leading-relaxed mb-6">
              &ldquo;{text.step1Instruction}&rdquo;
            </p>

            <button
              type="button"
              onClick={handleStop}
              className="text-xs text-[#62776B] hover:text-[#284937] underline cursor-pointer inline-flex items-center gap-1"
            >
              <Square className="w-3 h-3" />
              <span>{text.stopBtn}</span>
            </button>
          </div>
        )}

        {/* STEP 2: GENTLE HOLD (Like blowing up a balloon without letting air out, 10-15s with gentle countdown) */}
        {step === 'hold' && (
          <div className="py-4 flex flex-col items-center">
            {/* Step badge */}
            <span className="text-[11px] font-semibold text-[#6E4F32] bg-[#F7EFE6] border border-[#EBDCCB] px-3 py-0.5 rounded-full mb-5">
              {text.step2Title}
            </span>

            {/* Flat pastel balloon visual holding steady with gentle pulse */}
            <div className="relative w-32 h-32 xs:w-36 xs:h-36 sm:w-48 sm:h-48 flex items-center justify-center mb-6 max-w-full overflow-hidden">
              {/* Soft steady aura */}
              <div className="absolute inset-2 rounded-full bg-[#F5ECE1] border border-[#E2D0BE] opacity-60"></div>
              <div 
                className="w-28 h-28 xs:w-32 xs:h-32 sm:w-40 sm:h-40 rounded-full bg-[#FAF3EA] border-4 border-[#D8BEA3] flex flex-col items-center justify-center shadow-xs"
              >
                {/* Flat balloon silhouette */}
                <div className="w-8 h-9 sm:w-10 sm:h-11 rounded-full bg-[#C99C70] flex items-center justify-center mb-1 relative shadow-2xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/60 absolute top-2 left-2"></div>
                </div>
                <span className="text-xl sm:text-3xl font-semibold font-['Lora',serif] text-[#5C3F24]">
                  {countdown}s
                </span>
                <span className="text-[9px] sm:text-[10px] font-semibold text-[#7E5E41] uppercase tracking-wider">
                  {language === 'ar' ? 'ضغط لطيف' : language === 'fr' ? 'Maintien doux' : 'Gentle Hold'}
                </span>
              </div>
            </div>

            {/* Step 2 Instruction Text (Exact requested text) */}
            <p className="text-xs sm:text-sm text-[#273B30] font-['Lora',serif] max-w-md mx-auto leading-relaxed mb-6 font-normal">
              &ldquo;{text.step2Instruction}&rdquo;
            </p>

            <button
              type="button"
              onClick={handleStop}
              className="text-xs text-[#62776B] hover:text-[#284937] underline cursor-pointer inline-flex items-center gap-1"
            >
              <Square className="w-3 h-3" />
              <span>{text.stopBtn}</span>
            </button>
          </div>
        )}

        {/* STEP 3: RELAX (Relax and breathe normally again, calm pause) */}
        {step === 'relax' && (
          <div className="py-4 flex flex-col items-center">
            {/* Step badge */}
            <span className="text-[11px] font-semibold text-[#254C37] bg-[#E7F3EC] border border-[#C5E2D1] px-3 py-0.5 rounded-full mb-5">
              {text.step3Title}
            </span>

            {/* Flat pastel settling waves visual */}
            <div className="relative w-32 h-32 xs:w-36 xs:h-36 sm:w-48 sm:h-48 flex items-center justify-center mb-6 max-w-full overflow-hidden">
              <div className="w-28 h-28 xs:w-32 xs:h-32 sm:w-40 sm:h-40 rounded-full bg-[#EBF5EF] border-4 border-[#86C9A3] flex flex-col items-center justify-center shadow-xs">
                <Sparkles className="w-7 h-7 sm:w-9 sm:h-9 text-[#2C593F] mb-1" />
                <span className="text-lg sm:text-2xl font-semibold font-['Lora',serif] text-[#1E3E2D]">
                  {countdown}s
                </span>
                <span className="text-[9px] sm:text-[10px] font-semibold text-[#3D6950] uppercase tracking-wider">
                  {language === 'ar' ? 'تنفس طبيعي' : language === 'fr' ? 'Détente' : 'Normal Breathing'}
                </span>
              </div>
            </div>

            {/* Step 3 Instruction Text */}
            <p className="text-base sm:text-lg text-[#1E3025] font-['Lora',serif] max-w-lg mx-auto leading-relaxed mb-6">
              &ldquo;{text.step3Instruction}&rdquo;
            </p>

            <button
              type="button"
              onClick={handleStop}
              className="text-xs text-[#62776B] hover:text-[#284937] underline cursor-pointer inline-flex items-center gap-1"
            >
              <Square className="w-3 h-3" />
              <span>{text.stopBtn}</span>
            </button>
          </div>
        )}

        {/* STEP: COMPLETED (Do it again button with no pressure, no score, no fail state) */}
        {step === 'completed' && (
          <div className="py-6 flex flex-col items-center w-full max-w-full">
            <div className="w-16 h-16 rounded-full bg-[#EAF4EE] border border-[#BCE1CC] text-[#2B543D] flex items-center justify-center mb-4">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <h3 className="text-xl sm:text-2xl font-normal text-[#1A2E22] font-['Lora',serif] mb-2">
              {text.completedTitle}
            </h3>
            <p className="text-xs sm:text-sm text-[#5A6D61] max-w-md mx-auto leading-relaxed mb-6 font-light">
              {text.completedSubtitle}
            </p>

            {/* Do it again button */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3 w-full max-w-xs sm:max-w-none mx-auto">
              <button
                type="button"
                id="valsalva-do-it-again-btn"
                onClick={handleRepeat}
                className="w-full sm:w-auto px-6 py-3 bg-[#2D4D3D] hover:bg-[#1D3528] text-white text-xs sm:text-sm font-medium rounded-xl shadow-2xs hover:shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-emerald-200" />
                <span>{text.doAgainBtn}</span>
              </button>

              {onSelectOtherGame && (
                <button
                  type="button"
                  onClick={onSelectOtherGame}
                  className="w-full sm:w-auto px-5 py-3 bg-[#F2EDE4] hover:bg-[#E6DFD3] text-[#334A3C] text-xs sm:text-sm font-medium rounded-xl border border-[#DCD3C4] transition-all cursor-pointer text-center"
                >
                  {text.otherExercisesBtn}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Re-read safety note toggle */}
      <div className="text-center">
        <button
          type="button"
          onClick={() => setHasAcknowledgedSafety(false)}
          className="text-[11px] text-[#718579] hover:text-[#2D4D3D] underline cursor-pointer transition-colors inline-flex items-center gap-1"
        >
          <Info className="w-3 h-3" />
          <span>{text.reviewSafety}</span>
        </button>
      </div>
    </div>
  );
};
