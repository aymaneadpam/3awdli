import { Users, ShieldCheck, HeartHandshake, Compass, Smile, Sparkles } from 'lucide-react';
import { User } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface PillarsProps {
  currentUser?: User | null;
  onTalkAnonymously: () => void;
}

export const Pillars = ({ currentUser, onTalkAnonymously }: PillarsProps) => {
  const { language, strings } = useLanguage();

  const pillars = [
    {
      icon: Users,
      title:
        language === 'ar'
          ? 'فريق استماع متخصص ومتدرب'
          : language === 'fr'
          ? 'Équipe d\'écoute spécialisée'
          : 'Specialized Listening Team',
      description:
        language === 'ar'
          ? 'تتواصل مع أخصائيين نفسيين وطلبة علم نفس معتمدين يفهمون الضيق العاطفي ويستمعون بتعاطف حقيقي.'
          : language === 'fr'
          ? 'Vous êtes mis en relation avec des psychologues certifiés et des étudiants formés qui écoutent avec bienveillance.'
          : "You're connected with certified psychologists and trained psychology students who understand emotional distress and listen with sincere empathy.",
      tag:
        language === 'ar'
          ? 'أخصائيون وطلبة'
          : language === 'fr'
          ? 'Professionnels & Étudiants'
          : 'Professionals & Students',
    },
    {
      icon: ShieldCheck,
      title:
        language === 'ar'
          ? 'مجاني 100% وسري بالكامل'
          : language === 'fr'
          ? '100% Gratuit & Confidentiel'
          : '100% Free & Confidential',
      description:
        language === 'ar'
          ? 'بدون أي مقابل، دون أحكام مسبقة، وبدون الحاجة لكشف هويتك. سواء كان هماً بسيطاً أو تجربة مؤلمة، مساحتك محمية تماماً.'
          : language === 'fr'
          ? 'Sans frais, sans jugement et sans obligation d\'identité. Que ce soit un souci quotidien ou un traumatisme, votre espace reste strictement privé.'
          : 'No fees, no judgment, and no identity required. Whether you share a small daily worry or deep trauma, your space remains completely private.',
      tag:
        language === 'ar'
          ? 'مجاني دائماً'
          : language === 'fr'
          ? 'Gratuit à vie'
          : 'Zero Cost Ever',
    },
    {
      icon: Compass,
      title:
        language === 'ar'
          ? 'مرافقة وتوجيه نفسي هادئ'
          : language === 'fr'
          ? 'Orientation bienveillante'
          : 'Gentle Next-Step Guidance',
      description:
        language === 'ar'
          ? 'من تقديم أذن صاغية لتخفيف الأوقات الصعبة إلى اقتراح متابعة نفسية متخصصة عند الحاجة، نرافقك بكل أمان.'
          : language === 'fr'
          ? 'D\'une oreille attentive pour surmonter une épreuve temporaire à une orientation professionnelle si nécessaire, nous vous guidons.'
          : 'From providing an understanding ear for temporary hardships to recommending professional ongoing therapy when helpful, we guide you safely.',
      tag:
        language === 'ar'
          ? 'دعم مخصص'
          : language === 'fr'
          ? 'Soutien personnalisé'
          : 'Personalized Support',
    },
  ];

  const commonStruggles =
    language === 'ar'
      ? [
          'التوتر والإرهاق النفسي',
          'القلق ونوبات الهلع',
          'خلافات العلاقات والأسرة',
          'الحزن والوحدة',
          'ضغوط الدراسة والعمل',
          'تقدير الذات وتقلب المزاج',
        ]
      : language === 'fr'
      ? [
          'Stress & Épuisement',
          'Anxiété & Panique',
          'Conflits familiaux & relationnels',
          'Deuil & Solitude',
          'Pression académique ou pro',
          'Estime de soi & Baisse de moral',
        ]
      : [
          'Stress & Burnout',
          'Anxiety & Panic',
          'Relationship & Family Conflicts',
          'Grief & Loneliness',
          'Academic or Career Pressure',
          'Self-Worth & Low Mood',
        ];

  return (
    <section className="py-20 sm:py-28 border-t border-[#EAE5DC] bg-[#F7F4EE]/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="max-w-2xl mx-auto text-center mb-14 sm:mb-20">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E5EEE9] text-[#2F5342] text-xs font-medium mb-4 border border-[#CFDFD6]">
            <Sparkles className="w-3.5 h-3.5 text-[#315243]" />
            <span>
              {language === 'ar'
                ? 'كيف تدعمك منصة 3awdli'
                : language === 'fr'
                ? 'Comment 3awdli vous accompagne'
                : 'How 3awdli Supports You'}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-normal text-[#1F2F26] tracking-tight font-['Lora',serif]">
            {language === 'ar'
              ? 'ملاذ هادئ عندما تضيق بك تفاصيل الحياة'
              : language === 'fr'
              ? 'Un havre de paix quand le monde devient trop lourd'
              : 'A quiet sanctuary when the world feels too loud'}
          </h2>
          <p className="mt-3.5 text-sm sm:text-base text-[#57645C] leading-relaxed font-light">
            {language === 'ar' ? (
              <>في الثقافة المغربية والدارجة، كلمة <em className="italic font-medium text-[#2F4F3F]">"عاود ليا"</em> تعني "احكِ لي كل شيء". إنها دعوة للتعبير عن مشاعرك بصدق وأمان دون خوف من الأحكام.</>
            ) : language === 'fr' ? (
              <>Dans la culture marocaine, <em className="italic font-medium text-[#2F4F3F]">"3awdli"</em> signifie "raconte-moi tout". C'est une invitation à vous exprimer sans crainte d'être jugé.</>
            ) : (
              <>In Moroccan culture and language, <em className="italic font-medium text-[#2F4F3F]">"3awdli"</em> means "tell me everything." It is an invitation to speak your truth without fear.</>
            )}
          </p>
        </div>

        {/* 3 Core Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-7 mb-16 sm:mb-20">
          {pillars.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div 
                key={idx}
                className="bg-white/75 backdrop-blur-xs border border-[#E7E2D8] rounded-3xl p-6 sm:p-7 shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-2xl bg-[#EAF1ED] text-[#2A493B] flex items-center justify-center border border-[#D5E4DC]">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-medium text-[#466657] bg-[#EAF1ED] px-2.5 py-1 rounded-full">
                      {pillar.tag}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-[#203027] mb-2 font-['Lora',serif]">
                    {pillar.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5B6860] leading-relaxed font-light">
                    {pillar.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* What You Can Bring to Us Banner */}
        <div className="bg-[#EBE6DD]/70 border border-[#DDD6CA] rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xs">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-2">
              <HeartHandshake className="w-4 h-4 text-[#315243]" />
              <span className="text-xs uppercase tracking-wider font-semibold text-[#315243]">
                {language === 'ar'
                  ? 'لا يوجد همٌّ صغير أو تافه'
                  : language === 'fr'
                  ? 'Aucun souci n\'est insignifiant'
                  : 'No matter is too small'}
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-[#213128] font-['Lora',serif]">
              {language === 'ar'
                ? 'مهما كان ما يثقل قلبك، يمكنك مشاركته هنا بكل راحة.'
                : language === 'fr'
                ? 'Quel que soit le poids sur votre cœur, vous pouvez le partager ici.'
                : 'Whatever is weighing on your heart, you can share it here.'}
            </h3>
            <p className="text-xs sm:text-sm text-[#5C6A62] mt-1.5 leading-relaxed">
              {language === 'ar'
                ? 'لست مضطراً للوصول إلى حافة الانهيار لتستحق من ينصت إليك. سواء كان يوماً متعباً أو عبئاً يصعب حمله، نحن هنا بجانبك.'
                : language === 'fr'
                ? 'Vous n\'avez pas besoin d\'être en crise aiguë pour mériter d\'être écouté. Qu\'il s\'agisse d\'une mauvaise journée ou d\'un fardeau pesant, nous sommes là.'
                : 'You do not need to be in a total breakdown to deserve a listening ear. Whether it is a bad day or an overwhelming burden, we are here.'}
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              {commonStruggles.map((item, i) => (
                <span 
                  key={i}
                  className="text-xs bg-white text-[#3F4F46] px-3 py-1 rounded-full border border-[#D9D3C7]"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="shrink-0 w-full md:w-auto text-center">
            <button
              id="pillars-talk-btn"
              onClick={onTalkAnonymously}
              className="w-full md:w-auto px-6 py-3.5 bg-[#315243] hover:bg-[#253F33] text-white text-sm font-semibold rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer inline-flex items-center justify-center gap-2"
            >
              <Smile className="w-4 h-4 text-emerald-300" />
              <span>{currentUser ? strings.common.talkOpenly : strings.common.talkAnonymously}</span>
            </button>
            <p className="text-[11px] text-[#78857E] mt-2">
              {strings.pillars.ctaMeta}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
