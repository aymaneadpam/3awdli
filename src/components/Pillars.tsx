import { Users, ShieldCheck, HeartHandshake, Compass, Smile, Sparkles } from 'lucide-react';

interface PillarsProps {
  onTalkAnonymously: () => void;
}

export const Pillars = ({ onTalkAnonymously }: PillarsProps) => {
  const pillars = [
    {
      icon: Users,
      title: "Specialized Listening Team",
      description: "You're connected with certified psychologists and trained psychology students who understand emotional distress and listen with sincere empathy.",
      tag: "Professionals & Students",
    },
    {
      icon: ShieldCheck,
      title: "100% Free & Confidential",
      description: "No fees, no judgment, and no identity required. Whether you share a small daily worry or deep trauma, your space remains completely private.",
      tag: "Zero Cost Ever",
    },
    {
      icon: Compass,
      title: "Gentle Next-Step Guidance",
      description: "From providing an understanding ear for temporary hardships to recommending professional ongoing therapy when helpful, we guide you safely.",
      tag: "Personalized Support",
    },
  ];

  const commonStruggles = [
    "Stress & Burnout",
    "Anxiety & Panic",
    "Relationship & Family Conflicts",
    "Grief & Loneliness",
    "Academic or Career Pressure",
    "Self-Worth & Low Mood",
  ];

  return (
    <section className="py-16 sm:py-20 border-t border-[#EAE5DC] bg-[#F7F4EE]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="max-w-2xl mx-auto text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E5EEE9] text-[#2F5342] text-xs font-medium mb-3.5 border border-[#CFDFD6]">
            <Sparkles className="w-3.5 h-3.5 text-[#315243]" />
            <span>How 3awdli Supports You</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-[#1F2F26] tracking-tight font-['Lora',serif]">
            A quiet sanctuary when the world feels too loud
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#57645C] leading-relaxed">
            In Moroccan culture and language, <em className="italic font-medium text-[#2F4F3F]">"3awdli"</em> means "tell me everything." It is an invitation to speak your truth without fear.
          </p>
        </div>

        {/* 3 Core Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {pillars.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div 
                key={idx}
                className="bg-white/80 backdrop-blur-xs border border-[#E7E2D8] rounded-3xl p-6 sm:p-7 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#EAF1ED] text-[#2A493B] flex items-center justify-center border border-[#D5E4DC]">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-medium text-[#466657] bg-[#EAF1ED] px-2.5 py-1 rounded-full">
                      {pillar.tag}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-[#203027] mb-2 font-['Lora',serif]">
                    {pillar.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5B6860] leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* What You Can Bring to Us Banner */}
        <div className="bg-[#ECE7DE]/60 border border-[#DDD6CA] rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-2">
              <HeartHandshake className="w-4 h-4 text-[#315243]" />
              <span className="text-xs uppercase tracking-wider font-semibold text-[#315243]">
                No matter is too small
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-[#213128] font-['Lora',serif]">
              Whatever is weighing on your heart, you can share it here.
            </h3>
            <p className="text-xs sm:text-sm text-[#5C6A62] mt-1.5 leading-relaxed">
              You do not need to be in a total breakdown to deserve a listening ear. Whether it is a bad day or an overwhelming burden, we are here.
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
              <span>Start an Anonymous Chat</span>
            </button>
            <p className="text-[11px] text-[#78857E] mt-2">
              Free • Instant • Completely confidential
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
