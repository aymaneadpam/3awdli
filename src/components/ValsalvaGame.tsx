import React, { useState, useEffect } from 'react';
import { Activity, Play, Pause, RotateCcw, Volume2, VolumeX, ShieldCheck, Info } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const ValsalvaGame: React.FC = () => {
  const { language } = useLanguage();

  const [isActive, setIsActive] = useState<boolean>(false);
  const [phase, setPhase] = useState<'prepare' | 'strain' | 'release' | 'rest'>('prepare');
  const [countdown, setCountdown] = useState<number>(10);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isActive) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setPhase((cur) => {
              if (cur === 'prepare') return 'strain';
              if (cur === 'strain') return 'release';
              if (cur === 'release') return 'rest';
              return 'prepare';
            });
            return 10;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isActive, phase]);

  const handleReset = () => {
    setIsActive(false);
    setPhase('prepare');
    setCountdown(10);
  };

  return (
    <div className="space-y-8">
      {/* Interactive Guided Valsalva Card */}
      <div className="bg-white/90 backdrop-blur-xs border border-[#E2DDD3] rounded-3xl p-6 sm:p-10 shadow-xs text-center relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1.5 w-full bg-gradient-to-r from-[#507A65] via-[#315243] to-[#7EA892]"></div>

        <div className="py-6 flex flex-col items-center justify-center">
          <div 
            className={`w-36 h-36 sm:w-44 sm:h-44 rounded-full flex flex-col items-center justify-center transition-all duration-700 shadow-md ${
              phase === 'strain' 
                ? 'bg-[#E3EFE8] border-4 border-[#315243] scale-105' 
                : phase === 'release' 
                ? 'bg-[#EBF3FA] border-4 border-[#5B8CB0] scale-95'
                : phase === 'rest'
                ? 'bg-[#F2EFF7] border-4 border-[#8B7AA3] scale-100'
                : 'bg-[#F4EFE7] border-4 border-[#C8BDAB] scale-100'
            }`}
          >
            <Activity className={`w-8 h-8 mb-1 transition-colors ${
              phase === 'strain' ? 'text-[#315243] animate-pulse' : 'text-[#5C6F65]'
            }`} />
            
            <span className="text-2xl sm:text-3xl font-bold font-['Lora',serif] text-[#1D2E25]">
              {countdown}s
            </span>

            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4E6157] mt-0.5">
              {phase === 'prepare' && (language === 'ar' ? 'استعد' : language === 'fr' ? 'Préparez-vous' : 'Get Ready')}
              {phase === 'strain' && (language === 'ar' ? 'ضغط لطيف' : language === 'fr' ? 'Pression douce' : 'Gentle Pressure')}
              {phase === 'release' && (language === 'ar' ? 'إطلاق واسترخاء' : language === 'fr' ? 'Relâchez' : 'Release & Exhale')}
              {phase === 'rest' && (language === 'ar' ? 'راحة طبيعية' : language === 'fr' ? 'Repos' : 'Rest & Settle')}
            </span>
          </div>

          <p className="mt-6 text-sm text-[#4E5F55] max-w-md mx-auto leading-relaxed">
            {phase === 'prepare' && (
              language === 'ar' 
                ? 'اجلس في وضع مريح واسترخِ كتفيك قبل البدء.'
                : language === 'fr'
                ? 'Asseyez-vous confortablement et relâchez vos épaules.'
                : 'Sit in a comfortable posture and loosen your shoulders before starting.'
            )}
            {phase === 'strain' && (
              language === 'ar'
                ? 'خذ نفساً ثم احبسه واضغط برفق كأنك تنفخ في بالون مقفل لمدة 10 إلى 15 ثانية دون إجهاد.'
                : language === 'fr'
                ? 'Prenez une inspiration, retenez doucement l\'air en exerçant une pression modérée sans forcer.'
                : 'Take a breath in and gently bear down with moderate pressure without straining your neck.'
            )}
            {phase === 'release' && (
              language === 'ar'
                ? 'أطلق نفسك برفق واشعر بتدفق الهدوء وانخفاض وتيرة نبضات قلبك.'
                : language === 'fr'
                ? 'Expirez doucement et ressentez la vague de calme qui ralentit votre rythme cardiaque.'
                : 'Exhale smoothly and feel the wave of relief slowing your heart rate.'
            )}
            {phase === 'rest' && (
              language === 'ar'
                ? 'تنفس بعمق وبشكل طبيعي. دع جسمك يستوعب الهدوء.'
                : language === 'fr'
                ? 'Respirez normalement et laissez votre corps s\'apaiser.'
                : 'Breathe normally and let your system settle into deep relaxation.'
            )}
          </p>

          <div className="flex items-center gap-3 mt-6">
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className="px-5 py-2.5 bg-[#315243] hover:bg-[#233F32] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>
                {isActive 
                  ? (language === 'ar' ? 'إيقاف مؤقت' : language === 'fr' ? 'Pause' : 'Pause')
                  : (language === 'ar' ? 'بدء التمرين' : language === 'fr' ? 'Démarrer' : 'Start Technique')}
              </span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 bg-[#EDE7DE] hover:bg-[#E2DAD0] text-[#2C4135] text-xs sm:text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 cursor-pointer border border-[#D8CEBE]"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{language === 'ar' ? 'إعادة' : language === 'fr' ? 'Réinitialiser' : 'Reset'}</span>
            </button>

            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2.5 bg-[#EDE7DE] hover:bg-[#E2DAD0] text-[#2C4135] rounded-xl transition-colors cursor-pointer border border-[#D8CEBE]"
              title={soundEnabled ? 'Mute sound' : 'Enable calming tone'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-[#315243]" /> : <VolumeX className="w-4 h-4 text-[#7A8B81]" />}
            </button>
          </div>
        </div>
      </div>

      {/* Safety and Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="p-5 sm:p-6 rounded-3xl bg-[#F4F1EA] border border-[#E5DEC9] text-start">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E6ECE8] text-[#294B3B] flex items-center justify-center border border-[#CFDFD6]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-[#1C2C23] font-['Lora',serif]">
              {language === 'ar' ? 'كيف تعمل تقنية فالسالفا؟' : language === 'fr' ? 'Comment ça fonctionne ?' : 'How does it work?'}
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-[#5C6E64] leading-relaxed">
            {language === 'ar'
              ? 'تزيد المناورة من الضغط داخل الصدر، مما يحفز العصب المبهم لإرسال إشارة طبيعية للقلب لخفض تسارع نبضاته.'
              : language === 'fr'
              ? 'Cette technique stimule le nerf vague pour transmettre un signal d\'apaisement naturel au cœur.'
              : 'The maneuver gently stimulates the vagus nerve to transmit a natural calming brake signal to your heart.'}
          </p>
        </div>

        <div className="p-5 sm:p-6 rounded-3xl bg-[#F4F1EA] border border-[#E5DEC9] text-start">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E6ECE8] text-[#294B3B] flex items-center justify-center border border-[#CFDFD6]">
              <Info className="w-5 h-5" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-[#1C2C23] font-['Lora',serif]">
              {language === 'ar' ? 'إرشادات الأمان' : language === 'fr' ? 'Conseils de sécurité' : 'Safety Advice'}
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-[#5C6E64] leading-relaxed">
            {language === 'ar'
              ? 'تُمارس دائماً أثناء الجلوس أو الاستلقاء. لا تضغط بشدة. إذا شعرت بأي دوار، توقف فوراً.'
              : language === 'fr'
              ? 'À pratiquer toujours en position assise ou allongée. Arrêtez en cas de vertige.'
              : 'Always practice while comfortably seated. Never strain excessively, and stop if you feel dizzy.'}
          </p>
        </div>
      </div>
    </div>
  );
};
