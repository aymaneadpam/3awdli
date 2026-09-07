import { useState, type FormEvent } from 'react';
import { 
  Heart, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  Lock, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { UserAccount } from '../types';

interface SignUpPageProps {
  onSuccess: (user: UserAccount) => void;
  onNavigateToSignIn: () => void;
  onNavigateHome: () => void;
}

export const SignUpPage = ({
  onSuccess,
  onNavigateToSignIn,
  onNavigateHome,
}: SignUpPageProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setError('Please provide a name or nickname so our team knows how to address you gently.');
      return;
    }

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Please provide a valid email address so you can access your saved space.');
      return;
    }

    if (password.length < 6) {
      setError('Please choose a password with at least 6 characters to keep your space secure.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if user with this email already exists in localStorage
      const storedUsersRaw = localStorage.getItem('3awdli_users');
      const users: Array<UserAccount & { password?: string }> = storedUsersRaw 
        ? JSON.parse(storedUsersRaw) 
        : [];

      const existing = users.find(u => u.email.toLowerCase() === trimmedEmail);
      if (existing) {
        setError('An account with this email already exists. Would you like to sign in instead?');
        setIsSubmitting(false);
        return;
      }

      const isAdminAccount = users.length === 0 || trimmedEmail.toLowerCase() === 'aymaneoumlala@gmail.com';

      const newUser: UserAccount & { password?: string } = {
        id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: trimmedName,
        email: trimmedEmail,
        password: password,
        createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        role: isAdminAccount ? 'admin' : 'user',
      };

      users.push(newUser);
      localStorage.setItem('3awdli_users', JSON.stringify(users));

      // Save as currently active user
      const publicUser: UserAccount = {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        createdAt: newUser.createdAt,
        role: newUser.role,
        is_listener: newUser.is_listener,
        isListener: newUser.isListener,
        is_head_of_listeners: newUser.is_head_of_listeners,
        profession: newUser.profession,
      };
      localStorage.setItem('3awdli_current_user', JSON.stringify(publicUser));

      // Initialize their personal conversation with a warm welcoming message from the team
      const initialChatsKey = `3awdli_chats_${newUser.id}`;
      if (!localStorage.getItem(initialChatsKey)) {
        const welcomeMessage = {
          id: `msg_init_${Date.now()}`,
          sender: 'team',
          senderName: 'Dr. Leila • Clinical Psychologist',
          text: `Welcome to your personal space, ${trimmedName}. Everything you share here is private and automatically preserved so you can return whenever life feels overwhelming. Whenever you are ready, feel free to tell us what is on your mind.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        localStorage.setItem(initialChatsKey, JSON.stringify([welcomeMessage]));
      }

      setTimeout(() => {
        setIsSubmitting(false);
        onSuccess(publicUser);
      }, 300);
    } catch {
      setError('Something went wrong while saving your space. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col text-[#2C332E]">
      {/* Top Header */}
      <header className="border-b border-[#EAE4DC] bg-[#FAF8F5]/90 backdrop-blur-xs py-4 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            id="signup-back-home-btn"
            onClick={onNavigateHome}
            className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[#46564E] hover:text-[#1F3329] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to 3awdli Home</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#315243] text-white flex items-center justify-center">
              <Heart className="w-4 h-4 text-emerald-200" />
            </div>
            <span className="font-bold text-lg text-[#1F362C] font-['Lora',serif]">
              3awdli
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs text-[#52635A]">
            <span className="hidden sm:inline">Already registered?</span>
            <button
              id="signup-nav-to-signin-btn"
              onClick={onNavigateToSignIn}
              className="text-[#2C483A] font-semibold hover:underline cursor-pointer ml-1"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Main Form Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6 sm:my-10">
        <div className="max-w-md w-full bg-white border border-[#E3DDD1] rounded-3xl p-7 sm:p-9 shadow-xs">
          {/* Header & Reassuring Context */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#E8F1EC] text-[#2C4A3C] flex items-center justify-center mx-auto mb-3 border border-[#CFDFD6]">
              <Sparkles className="w-6 h-6 text-[#315243]" />
            </div>
            <h1 className="text-2xl font-bold font-['Lora',serif] text-[#1E2E25]">
              Create Your Personal Space
            </h1>
            <p className="text-xs sm:text-sm text-[#5C6E64] mt-1.5 leading-relaxed">
              A quiet, protected sanctuary where your discussions with our team are saved so you can pick up whenever you return.
            </p>
          </div>

          {/* Privacy Reminder Banner - Warm and Not Clinical */}
          <div className="bg-[#F5F2EC] border border-[#E3DDCF] rounded-2xl p-3.5 mb-6 text-xs text-[#4F5B53] flex items-start gap-2.5 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-[#315243] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#25332A] mb-0.5">
                Your Privacy Stays First
              </p>
              <p className="text-[11.5px] text-[#5A675E]">
                We only ask for what is strictly needed to maintain your saved conversations. Your real name is never required, and your records remain strictly confidential.
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-[#FBF0EE] border border-[#EED0CA] text-xs text-[#983827] leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name / Nickname */}
            <div>
              <label 
                htmlFor="signup-name" 
                className="block text-xs font-semibold text-[#2A3B31] mb-1"
              >
                What should we call you?
              </label>
              <input
                id="signup-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First name or nickname (e.g., Sarah, Adam, Nour)"
                required
                className="w-full bg-[#FAF8F5] border border-[#D8D2C5] focus:border-[#315243] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#1E2E25] placeholder-[#88958D] outline-none transition-colors"
              />
              <p className="text-[11px] text-[#718177] mt-1">
                Doesn&apos;t need to be your legal name — whatever you feel comfortable with.
              </p>
            </div>

            {/* Email */}
            <div>
              <label 
                htmlFor="signup-email" 
                className="block text-xs font-semibold text-[#2A3B31] mb-1"
              >
                Email Address
              </label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-[#FAF8F5] border border-[#D8D2C5] focus:border-[#315243] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#1E2E25] placeholder-[#88958D] outline-none transition-colors"
              />
              <p className="text-[11px] text-[#718177] mt-1">
                Used solely to restore your conversation history and keep your space private.
              </p>
            </div>

            {/* Password */}
            <div>
              <label 
                htmlFor="signup-password" 
                className="block text-xs font-semibold text-[#2A3B31] mb-1"
              >
                Choose a Password
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  className="w-full bg-[#FAF8F5] border border-[#D8D2C5] focus:border-[#315243] focus:bg-white rounded-xl px-3.5 py-2.5 pr-10 text-xs sm:text-sm text-[#1E2E25] placeholder-[#88958D] outline-none transition-colors"
                />
                <button
                  type="button"
                  id="signup-toggle-password-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7E8B83] hover:text-[#2C3B32] p-1 cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-3">
              <button
                type="submit"
                id="signup-submit-btn"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 bg-[#315243] hover:bg-[#253E33] text-white text-sm font-semibold rounded-2xl shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <span>{isSubmitting ? 'Preparing your space...' : 'Create My Personal Space'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Footer Navigation within Card */}
          <div className="mt-6 pt-5 border-t border-[#EAE5DC] text-center">
            <p className="text-xs text-[#627269]">
              Already have an account?{' '}
              <button
                id="signup-switch-signin-btn"
                onClick={onNavigateToSignIn}
                className="font-semibold text-[#2A4839] hover:underline cursor-pointer"
              >
                Sign in to your space
              </button>
            </p>
            <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-[#839188]">
              <Lock className="w-3 h-3 text-[#315243]" />
              <span>100% Free &bull; Non-profit &bull; Confidential</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
