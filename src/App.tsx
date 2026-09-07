import { useState, useEffect } from 'react';
import { 
  MessageCircle, 
  LogIn, 
  UserPlus, 
  ShieldCheck, 
  Heart, 
  Sparkles, 
  HelpCircle, 
  ArrowRight
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { AnonymousChatWidget } from './components/AnonymousChatWidget';
import { EmergencyModal } from './components/EmergencyModal';
import { Pillars } from './components/Pillars';
import { Footer } from './components/Footer';
import { SignInPage } from './components/SignInPage';
import { SignUpPage } from './components/SignUpPage';
import { PersonalDashboard } from './components/PersonalDashboard';
import { DiscussionsPage } from './components/DiscussionsPage';
import { AdminRoleManagement } from './components/AdminRoleManagement';
import { GenderPreferenceModal } from './components/GenderPreferenceModal';
import { ViewState, UserAccount, AuthMode, ListenerGenderPreference } from './types';
import { getCurrentUser, getStoredUsers } from './utils/userManagement';
import { updateDiscussionGenderPreference } from './utils/discussionManagement';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [isGenderPreferenceModalOpen, setIsGenderPreferenceModalOpen] = useState(false);
  const [anonGenderPreference, setAnonGenderPreference] = useState<ListenerGenderPreference>(() => {
    try {
      return (localStorage.getItem('3awdli_anon_gender_preference') as ListenerGenderPreference) || 'any';
    } catch {
      return 'any';
    }
  });
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  useEffect(() => {
    // Seed and refresh users
    getStoredUsers();
    const user = getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }
  }, []);

  const handleOpenAuth = (mode: AuthMode) => {
    if (mode === 'signin') {
      if (currentUser) {
        setCurrentView('dashboard');
      } else {
        setCurrentView('signin');
      }
    } else if (mode === 'signup') {
      setCurrentView('signup');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAuthSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    setCurrentView('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSignOut = () => {
    localStorage.removeItem('3awdli_current_user');
    setCurrentUser(null);
    setCurrentView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTalkAnonymously = () => {
    if (currentView !== 'home') {
      setCurrentView('home');
    }
    setIsGenderPreferenceModalOpen(true);
  };

  const handleConfirmGenderPreference = (preference: ListenerGenderPreference) => {
    setAnonGenderPreference(preference);
    try {
      localStorage.setItem('3awdli_anon_gender_preference', preference);
    } catch {
      // localStorage fallback
    }
    updateDiscussionGenderPreference('disc_anon_live_portal', preference);
    setIsGenderPreferenceModalOpen(false);
    setIsChatOpen(true);
  };

  const faqs = [
    {
      q: "Who is listening when I reach out?",
      a: "Our team is made up of licensed psychologists and advanced psychology university students under specialized supervision. Every listener is committed to offering a gentle, non-judgmental ear and ethical support.",
    },
    {
      q: "Is it really 100% free and confidential?",
      a: "Yes. 3awdli is run as an association purely dedicated to public mental health. We never charge any fees. When you select 'Talk Anonymously', you are not asked for your name, phone number, or email.",
    },
    {
      q: "What kind of topics or difficulties can I bring?",
      a: "Anything that is bothering you — everyday stress, anxiety, relationship issues, academic burnout, feeling lonely, or simply having a heavy heart. You don't have to wait for a crisis to speak up.",
    },
    {
      q: "What happens during and after the conversation?",
      a: "A team member will listen attentively to your thoughts and feelings. Together, you can explore what you are going through, and our team will guide you on gentle next steps — whether that is healthy coping strategies or a recommendation to consult a professional therapist.",
    },
  ];

  // Dedicated page rendering based on view state
  if (currentView === 'signin') {
    return (
      <>
        <SignInPage
          onSuccess={handleAuthSuccess}
          onNavigateToSignUp={() => {
            setCurrentView('signup');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateHome={() => {
            setCurrentView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
        <EmergencyModal
          isOpen={isEmergencyModalOpen}
          onClose={() => setIsEmergencyModalOpen(false)}
          onTalkAnonymously={handleTalkAnonymously}
        />
      </>
    );
  }

  if (currentView === 'signup') {
    return (
      <>
        <SignUpPage
          onSuccess={handleAuthSuccess}
          onNavigateToSignIn={() => {
            setCurrentView('signin');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateHome={() => {
            setCurrentView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
        <EmergencyModal
          isOpen={isEmergencyModalOpen}
          onClose={() => setIsEmergencyModalOpen(false)}
          onTalkAnonymously={handleTalkAnonymously}
        />
      </>
    );
  }

  if (currentView === 'discussions') {
    const activeListenerUser: UserAccount = currentUser || {
      id: 'listener_demo',
      name: 'Team Listener',
      email: 'listener@3awdli.org',
      role: 'listener',
      is_listener: true,
      profession: 'Psychology Resident',
      createdAt: 'Today',
    };

    return (
      <>
        <DiscussionsPage
          user={activeListenerUser}
          onNavigateHome={() => {
            setCurrentView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateDashboard={() => {
            setCurrentView('dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateAdmin={currentUser?.role === 'admin' ? () => {
            setCurrentView('admin');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } : undefined}
          onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
          onSignOut={handleSignOut}
        />
        <EmergencyModal
          isOpen={isEmergencyModalOpen}
          onClose={() => setIsEmergencyModalOpen(false)}
          onTalkAnonymously={handleTalkAnonymously}
        />
      </>
    );
  }

  if (currentView === 'admin') {
    return (
      <>
        <AdminRoleManagement
          currentUser={currentUser}
          onNavigateHome={() => {
            setCurrentView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateDashboard={() => {
            setCurrentView('dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateDiscussions={() => {
            setCurrentView('discussions');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
          onSignOut={handleSignOut}
          onSwitchUser={(switched) => {
            setCurrentUser(switched);
            localStorage.setItem('3awdli_current_user', JSON.stringify(switched));
            setCurrentView('dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
        <EmergencyModal
          isOpen={isEmergencyModalOpen}
          onClose={() => setIsEmergencyModalOpen(false)}
          onTalkAnonymously={handleTalkAnonymously}
        />
      </>
    );
  }

  if (currentView === 'dashboard' && currentUser) {
    return (
      <>
        <PersonalDashboard
          user={currentUser}
          onSignOut={handleSignOut}
          onNavigateHome={() => {
            setCurrentView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateDiscussions={() => {
            setCurrentView('discussions');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateAdmin={() => {
            setCurrentView('admin');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
        />
        <EmergencyModal
          isOpen={isEmergencyModalOpen}
          onClose={() => setIsEmergencyModalOpen(false)}
          onTalkAnonymously={handleTalkAnonymously}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#2C332E]">
      {/* Navigation */}
      <Navbar
        currentUser={currentUser}
        onOpenDashboard={() => {
          setCurrentView('dashboard');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenDiscussions={() => {
          setCurrentView('discussions');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenAdmin={() => {
          setCurrentView('admin');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenAuth={handleOpenAuth}
        onTalkAnonymously={handleTalkAnonymously}
        onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="pt-12 pb-16 sm:pt-16 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
          {/* Gentle Association Badge */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#EBF2EE] border border-[#D1E3D8] text-[#28493A] text-xs font-medium shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Free, Non-profit &amp; Confidential Mental Health Association</span>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center max-w-3xl mx-auto mb-10">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-[#1B2B22] tracking-tight leading-[1.2] font-['Lora',serif]">
              You don&apos;t have to carry your burdens all by yourself.
            </h1>
            <p className="mt-4 text-base sm:text-lg text-[#55635B] leading-relaxed">
              Welcome to <span className="font-semibold text-[#274738]">3awdli</span> — a compassionate listening ear, ready whenever you need to open up.
            </p>
          </div>

          {/* EXACT REQUIRED INTRODUCTION TEXT */}
          {/* Displayed prominently near the top of the page, exactly as written */}
          <div 
            id="prominent-introduction-card"
            className="max-w-3xl mx-auto bg-white/90 backdrop-blur-xs border border-[#E2DDD3] rounded-3xl p-7 sm:p-9 shadow-xs mb-14 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r from-[#507A65] via-[#315243] to-[#7EA892]"></div>
            
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-[#EAF2ED] text-[#2A493B] flex items-center justify-center shrink-0 mt-0.5 border border-[#D2E2D8]">
                <Heart className="w-5 h-5 text-[#315243] fill-[#315243]/20" />
              </div>
              <div>
                <p className="text-base sm:text-lg text-[#2A342E] leading-relaxed font-['Lora',serif] font-normal italic">
                  &ldquo;At 3awdli, we believe that no one should have to navigate their struggles alone. We are a dedicated association committed to providing a safe, confidential space for those who suffer in silence, completely for free. We are here to listen, support, and remind you that your mental health truly matters.&rdquo;
                </p>
                <div className="mt-3.5 flex items-center gap-2 text-xs text-[#5D6F64] font-['Plus_Jakarta_Sans',sans-serif]">
                  <span className="font-semibold text-[#2A4839] not-italic">— The 3awdli Team &amp; Association</span>
                  <span>&bull;</span>
                  <span>Free &amp; Confidential</span>
                </div>
              </div>
            </div>
          </div>

          {/* THREE USER CHOICES */}
          <div className="mb-6 text-center">
            <h2 className="text-xl sm:text-2xl font-semibold text-[#1C2C23] font-['Lora',serif]">
              How would you like to begin?
            </h2>
            <p className="text-xs sm:text-sm text-[#63726A] mt-1">
              Select the option that feels most comfortable for you today.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* OPTION 1: Talk Anonymously (Highlighted & Primary) */}
            <div 
              id="option-talk-anonymously"
              className="bg-[#315243] text-white rounded-3xl p-7 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between relative overflow-hidden border border-[#274436] group"
            >
              <div className="absolute top-3 right-3">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3 text-emerald-300" />
                  Instant &bull; No Login
                </span>
              </div>

              <div>
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-200 mb-5">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold font-['Lora',serif] text-white mb-2">
                  Talk Anonymously
                </h3>
                <p className="text-xs font-medium text-emerald-200/90 mb-3 uppercase tracking-wider">
                  No account needed
                </p>
                <p className="text-xs sm:text-sm text-emerald-50/90 leading-relaxed mb-6">
                  Jump directly into a 100% private, confidential conversation with our listening team right now. No name or registration requested.
                </p>
              </div>

              <div>
                <button
                  id="hero-talk-anonymously-btn"
                  onClick={handleTalkAnonymously}
                  className="w-full py-3.5 px-4 bg-white hover:bg-emerald-50 text-[#254234] font-semibold text-sm rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 group-hover:gap-3 cursor-pointer"
                >
                  <span>Start Talking Now</span>
                  <ArrowRight className="w-4 h-4 text-[#254234]" />
                </button>
                <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-emerald-100/80">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Team member joins immediately</span>
                </div>
              </div>
            </div>

            {/* OPTION 2: Sign In */}
            <div 
              id="option-sign-in"
              className="bg-white/80 backdrop-blur-xs border border-[#E3DDD1] rounded-3xl p-7 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#F0ECE4] text-[#33463B] flex items-center justify-center mb-5 border border-[#E0D8CA]">
                  <LogIn className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold font-['Lora',serif] text-[#1E2E25] mb-2">
                  Sign In
                </h3>
                <p className="text-xs font-medium text-[#5F7066] mb-3 uppercase tracking-wider">
                  For returning registered users
                </p>
                <p className="text-xs sm:text-sm text-[#5D6B63] leading-relaxed mb-6">
                  Log in to your account to review previous discussions, access saved coping notes, and continue your continuous mental health journey.
                </p>
              </div>

              <div>
                <button
                  id="hero-signin-btn"
                  onClick={() => handleOpenAuth('signin')}
                  className="w-full py-3.5 px-4 bg-[#F2EFE8] hover:bg-[#E5E0D5] text-[#24372C] font-semibold text-sm rounded-2xl border border-[#D9D2C4] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogIn className="w-4 h-4 text-[#315243]" />
                  <span>{currentUser ? `Enter My Space (${currentUser.name})` : 'Sign In'}</span>
                </button>
                <p className="mt-3 text-center text-[11px] text-[#7C8B82]">
                  Manage your personal session history
                </p>
              </div>
            </div>

            {/* OPTION 3: Sign Up */}
            <div 
              id="option-sign-up"
              className="bg-white/80 backdrop-blur-xs border border-[#E3DDD1] rounded-3xl p-7 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#EAF2ED] text-[#274737] flex items-center justify-center mb-5 border border-[#D0E2D7]">
                  <UserPlus className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold font-['Lora',serif] text-[#1E2E25] mb-2">
                  Sign Up
                </h3>
                <p className="text-xs font-medium text-[#4D6D5C] mb-3 uppercase tracking-wider">
                  For new users creating an account
                </p>
                <p className="text-xs sm:text-sm text-[#5D6B63] leading-relaxed mb-6">
                  Register a secure account to request dedicated psychologist follow-ups, track personal progress, and maintain long-term support.
                </p>
              </div>

              <div>
                <button
                  id="hero-signup-btn"
                  onClick={() => handleOpenAuth('signup')}
                  className="w-full py-3.5 px-4 bg-[#E7F0EB] hover:bg-[#DAE7E0] text-[#234232] font-semibold text-sm rounded-2xl border border-[#C9DCD0] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 text-[#28493A]" />
                  <span>Create Account</span>
                </button>
                <p className="mt-3 text-center text-[11px] text-[#7C8B82]">
                  Always free &bull; Secure &amp; protected
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Supportive Pillars Section */}
        <Pillars onTalkAnonymously={handleTalkAnonymously} />

        {/* FAQ Section */}
        <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EDE8DF] text-[#4F5E55] text-xs font-medium mb-3">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Questions &amp; Reassurance</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold text-[#1F2F26] font-['Lora',serif]">
              Common questions about talking with 3awdli
            </h2>
            <p className="mt-2 text-sm text-[#5D6B63]">
              Everything you need to know about our free, confidential service.
            </p>
          </div>

          <div className="space-y-3.5">
            {faqs.map((faq, idx) => {
              const isExpanded = activeFaq === idx;
              return (
                <div 
                  key={idx}
                  className="bg-white/80 border border-[#E3DDD1] rounded-2xl overflow-hidden shadow-2xs transition-colors"
                >
                  <button
                    id={`faq-accordion-${idx}`}
                    onClick={() => setActiveFaq(isExpanded ? null : idx)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
                    aria-expanded={isExpanded}
                  >
                    <span className="text-sm sm:text-base font-semibold text-[#24332A] font-['Lora',serif]">
                      {faq.q}
                    </span>
                    <span className={`text-[#315243] font-bold text-lg transition-transform duration-200 ${isExpanded ? 'rotate-45' : ''}`}>
                      +
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-[#5A6860] leading-relaxed border-t border-[#F0ECE4]">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Reassurance banner below FAQ */}
          <div className="mt-12 p-6 rounded-3xl bg-[#EBF2EE] border border-[#D3E3DA] text-center flex flex-col items-center">
            <div className="w-10 h-10 rounded-2xl bg-[#315243] text-white flex items-center justify-center mb-3 shadow-xs">
              <Heart className="w-5 h-5 text-emerald-200 fill-emerald-200/20" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-[#21382D] font-['Lora',serif]">
              Ready to take the first step?
            </h3>
            <p className="text-xs sm:text-sm text-[#4E6156] max-w-md mt-1 mb-4">
              It only takes one message. A caring listener is ready to be with you in our anonymous chat.
            </p>
            <button
              onClick={handleTalkAnonymously}
              className="px-6 py-3 bg-[#315243] hover:bg-[#253E32] text-white text-xs sm:text-sm font-semibold rounded-2xl shadow-sm transition-all cursor-pointer flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4 text-emerald-200" />
              <span>Talk Anonymously Now</span>
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer
        onOpenAuth={handleOpenAuth}
        onTalkAnonymously={handleTalkAnonymously}
        onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
      />

      {/* Floating Anonymous Chat Widget (draggable, session managed by team) */}
      <AnonymousChatWidget
        isOpen={isChatOpen}
        onOpen={() => setIsGenderPreferenceModalOpen(true)}
        onOpenSignUp={() => handleOpenAuth('signup')}
        genderPreference={anonGenderPreference}
        onChangeGenderPreference={() => setIsGenderPreferenceModalOpen(true)}
      />

      {/* Gender Preference Modal before starting conversation */}
      <GenderPreferenceModal
        isOpen={isGenderPreferenceModalOpen}
        currentPreference={anonGenderPreference}
        onClose={() => setIsGenderPreferenceModalOpen(false)}
        onConfirm={handleConfirmGenderPreference}
      />

      {/* Emergency Helpline Modal */}
      <EmergencyModal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
        onTalkAnonymously={handleTalkAnonymously}
      />
    </div>
  );
}
