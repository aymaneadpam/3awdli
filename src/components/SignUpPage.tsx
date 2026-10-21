import { useState, type FormEvent } from 'react';
import { 
  Heart, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  Lock, 
  Sparkles,
  ArrowRight,
  HelpCircle,
  Check
} from 'lucide-react';
import { UserAccount } from '../types';
import { firebaseRegisterUser, firebaseSignInWithGoogle } from '../lib/firestoreService';
import { getStoredUsers, saveStoredUsers, setCurrentUser } from '../utils/userManagement';
import { Navbar } from './Navbar';
import { useLanguage } from '../context/LanguageContext';
import { formatSiteTime } from '../utils/timezoneManagement';

interface SignUpPageProps {
  onSuccess: (user: UserAccount) => void;
  onNavigateToSignIn: () => void;
  onNavigateHome: () => void;
  onNavigateGames?: () => void;
  onNavigateTeenSpace?: () => void;
  onNavigateLounge?: () => void;
  onNavigateRules?: () => void;
  onNavigateSchedules?: () => void;
  onOpenContactSupport?: () => void;
  onOpenEmergencyModal?: () => void;
  onTalkAnonymously?: () => void;
}

export const SignUpPage = ({
  onSuccess,
  onNavigateToSignIn,
  onNavigateHome,
  onNavigateGames,
  onNavigateTeenSpace,
  onNavigateLounge,
  onNavigateRules,
  onNavigateSchedules,
  onOpenContactSupport,
  onOpenEmergencyModal,
  onTalkAnonymously,
}: SignUpPageProps) => {
  const { language, strings } = useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  // Password requirements for new accounts only
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  const handleGoogleSignUp = async () => {
    setError(null);
    setIsGoogleSubmitting(true);
    try {
      const activeUser = await firebaseSignInWithGoogle();
      const users = getStoredUsers();
      const existingIdx = users.findIndex(u => u.email.toLowerCase() === activeUser.email.toLowerCase());
      if (existingIdx >= 0) {
        users[existingIdx] = { ...users[existingIdx], ...activeUser };
      } else {
        users.push(activeUser);
      }
      saveStoredUsers(users);
      setCurrentUser(activeUser);

      // Initialize initial conversation if needed
      const initialChatsKey = `3awdli_chats_${activeUser.id}`;
      if (!localStorage.getItem(initialChatsKey)) {
        const welcomeMessage = {
          id: `msg_init_${Date.now()}`,
          sender: 'team',
          senderName: 'Dr. Leila • Clinical Psychologist',
          text: `Welcome to your personal space, ${activeUser.name}. Everything you share here is private and automatically preserved in our real-time database so you can return whenever life feels overwhelming. Whenever you are ready, feel free to tell us what is on your mind.`,
          timestamp: formatSiteTime(),
        };
        localStorage.setItem(initialChatsKey, JSON.stringify([welcomeMessage]));
      }

      setIsGoogleSubmitting(false);
      onSuccess(activeUser);
    } catch (err: any) {
      console.error('Google sign-up error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setIsGoogleSubmitting(false);
        return;
      }
      if (err.code === 'auth/popup-blocked') {
        setError('The Google sign-up pop-up was blocked. Please allow pop-ups for this window or sign up using email.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Google sign-in is not enabled on this project yet. Please verify Authentication providers in Firebase Console.');
      } else {
        setError(err.message || 'An error occurred during Google sign-up. Please try again.');
      }
      setIsGoogleSubmitting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
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

    if (password.length < 8) {
      setError(
        strings.auth?.passwordRuleMinLengthError ||
        (language === 'ar'
          ? 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.'
          : language === 'fr'
          ? 'Le mot de passe doit comporter au moins 8 caractères.'
          : 'Password must be at least 8 characters long.')
      );
      return;
    }

    if (!hasLetter || !hasNumber) {
      setError(
        strings.auth?.passwordRuleMixError ||
        (language === 'ar'
          ? 'يجب أن تحتوي كلمة المرور على مزيج من الحروف والأرقام.'
          : language === 'fr'
          ? 'Le mot de passe doit contenir un mélange de lettres et de chiffres.'
          : 'Password must include both letters and numbers.')
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Create user in real Firebase Authentication & Firestore
      const { user: firebaseUser } = await firebaseRegisterUser(trimmedName, trimmedEmail, password);

      // 2. Also ensure local users list is updated
      const users = getStoredUsers();
      const existingIdx = users.findIndex(u => u.email.toLowerCase() === trimmedEmail);
      const fullUser = {
        ...firebaseUser,
      };

      if (existingIdx >= 0) {
        users[existingIdx] = { ...users[existingIdx], ...fullUser };
      } else {
        users.push(fullUser);
      }
      saveStoredUsers(users);
      setCurrentUser(firebaseUser);

      // Initialize initial conversation if needed
      const initialChatsKey = `3awdli_chats_${firebaseUser.id}`;
      if (!localStorage.getItem(initialChatsKey)) {
        const welcomeMessage = {
          id: `msg_init_${Date.now()}`,
          sender: 'team',
          senderName: 'Dr. Leila • Clinical Psychologist',
          text: `Welcome to your personal space, ${trimmedName}. Everything you share here is private and automatically preserved in our real-time database so you can return whenever life feels overwhelming. Whenever you are ready, feel free to tell us what is on your mind.`,
          timestamp: formatSiteTime(),
        };
        localStorage.setItem(initialChatsKey, JSON.stringify([welcomeMessage]));
      }

      setIsSubmitting(false);
      onSuccess(firebaseUser);
    } catch (err: any) {
      console.error('Firebase sign-up error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists in the database. Please sign in instead.');
      } else if (err.code === 'auth/weak-password') {
        setError('The password is too weak. Please use at least 6 characters with a combination of letters and numbers.');
      } else if (err.code === 'auth/invalid-email') {
        setError('The email address provided is invalid.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Email/password provider is not enabled on this project. You can click "Continue with Google" above.');
      } else {
        setError(err.message || 'Something went wrong while connecting to the database. Please try again.');
      }
      setIsSubmitting(false);
    }
  };

  return (
    <Navbar
      currentView="signup"
      onNavigateHome={onNavigateHome}
      onNavigateGames={onNavigateGames}
      onNavigateTeenSpace={onNavigateTeenSpace}
      onNavigateLounge={onNavigateLounge}
      onNavigateRules={onNavigateRules}
      onNavigateSchedules={onNavigateSchedules}
      onOpenAuth={(mode) => {
        if (mode === 'signin') {
          onNavigateToSignIn();
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }}
      onOpenContactSupport={onOpenContactSupport}
      onOpenEmergencyModal={onOpenEmergencyModal}
      onTalkAnonymously={onTalkAnonymously}
    >
      {/* Main Form Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6 sm:my-10">
        <div className="max-w-md w-full bg-white border border-[#E3DDD1] rounded-3xl p-7 sm:p-9 shadow-xs">
          {/* Header & Reassuring Context */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#E8F1EC] text-[#2C4A3C] flex items-center justify-center mx-auto mb-3 border border-[#CFDFD6]">
              <Sparkles className="w-6 h-6 text-[#315243]" />
            </div>
            <h1 className="text-2xl font-bold font-['Lora',serif] text-[#1E2E25]">
              {strings.auth?.signUpTitle || 'Create Your Personal Space'}
            </h1>
            <p className="text-xs sm:text-sm text-[#5C6E64] mt-1.5 leading-relaxed">
              {strings.auth?.signUpSubtitle || 'A quiet, protected sanctuary where your discussions with our team are saved so you can pick up whenever you return.'}
            </p>
          </div>

          {/* Privacy Reminder Banner - Warm and Not Clinical */}
          <div className="bg-[#F5F2EC] border border-[#E3DDCF] rounded-2xl p-3.5 mb-6 text-xs text-[#4F5B53] flex items-start gap-2.5 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-[#315243] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#25332A] mb-0.5">
                {strings.auth?.privacyBannerTitle || 'Your Privacy Stays First'}
              </p>
              <p className="text-[11.5px] text-[#5A675E]">
                {strings.auth?.privacyBannerDesc || 'We only ask for what is strictly needed to maintain your saved conversations. Your real name is never required, and your records remain strictly confidential.'}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-[#FBF0EE] border border-[#EED0CA] text-xs text-[#983827] leading-relaxed">
              {error}
            </div>
          )}

          {/* Primary One-Click Google Sign-In / Sign-Up Button */}
          <div className="mb-5">
            <button
              type="button"
              id="signup-google-btn"
              disabled={isGoogleSubmitting || isSubmitting}
              onClick={handleGoogleSignUp}
              className="w-full py-3 px-4 bg-white hover:bg-[#F7F5F0] border border-[#D5CEC2] hover:border-[#B5ACA0] text-[#1E2E25] text-xs sm:text-sm font-semibold rounded-2xl shadow-2xs transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isGoogleSubmitting ? (strings.auth?.connectingWithGoogle || 'Connecting with Google...') : (strings.auth?.continueWithGoogle || 'Continue with Google')}</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative mb-5 flex items-center justify-center">
            <div className="w-full border-t border-[#E8E2D8]"></div>
            <span className="bg-white px-3 text-[11px] font-medium text-[#7D8C83] uppercase tracking-wider">
              {strings.auth?.orSignUpWithEmail || 'or create account with email'}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name / Nickname */}
            <div>
              <label 
                htmlFor="signup-name" 
                className="block text-xs font-semibold text-[#2A3B31] mb-1"
              >
                {strings.auth?.fullNameLabel || 'What should we call you?'}
              </label>
              <input
                id="signup-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={strings.auth?.fullNamePlaceholder || 'First name or nickname (e.g., Sarah, Adam, Nour)'}
                required
                className="w-full bg-[#FAF8F5] border border-[#D8D2C5] focus:border-[#315243] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#1E2E25] placeholder-[#88958D] outline-none transition-colors text-start"
              />
              <p className="text-[11px] text-[#718177] mt-1">
                {strings.auth?.fullNameHelp || "Doesn't need to be your legal name — whatever you feel comfortable with."}
              </p>
            </div>

            {/* Email */}
            <div>
              <label 
                htmlFor="signup-email" 
                className="block text-xs font-semibold text-[#2A3B31] mb-1"
              >
                {strings.auth?.emailLabel || 'Email Address'}
              </label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={strings.auth?.emailPlaceholder || 'you@example.com'}
                required
                className="w-full bg-[#FAF8F5] border border-[#D8D2C5] focus:border-[#315243] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#1E2E25] placeholder-[#88958D] outline-none transition-colors text-start"
              />
              <p className="text-[11px] text-[#718177] mt-1">
                {strings.auth?.emailHelp || 'Used solely to restore your conversation history and keep your space private.'}
              </p>
            </div>

            {/* Password */}
            <div>
              <label 
                htmlFor="signup-password" 
                className="block text-xs font-semibold text-[#2A3B31] mb-1"
              >
                {strings.auth?.choosePasswordLabel || 'Choose a Password'}
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={strings.auth?.choosePasswordPlaceholder || 'At least 8 characters (letters & numbers)'}
                  required
                  minLength={8}
                  className="w-full bg-[#FAF8F5] border border-[#D8D2C5] focus:border-[#315243] focus:bg-white rounded-xl px-3.5 py-2.5 pe-10 text-xs sm:text-sm text-[#1E2E25] placeholder-[#88958D] outline-none transition-colors text-start"
                />
                <button
                  type="button"
                  id="signup-toggle-password-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-[#7E8B83] hover:text-[#2C3B32] p-1 cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Requirements Checklist for New Accounts */}
              <div className="mt-2.5 p-2.5 bg-[#F4EFE7]/80 rounded-xl border border-[#E5DFD5] space-y-1.5 text-[11px]">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <div className={`flex items-center gap-1.5 transition-colors ${hasMinLength ? 'text-emerald-700 font-medium' : 'text-[#7D8C83]'}`}>
                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${hasMinLength ? 'bg-emerald-100 text-emerald-700' : 'bg-[#E5DFD5] text-[#7D8C83]'}`}>
                      {hasMinLength ? <Check className="w-2.5 h-2.5" /> : '•'}
                    </span>
                    <span>{strings.auth?.passwordRequirementLength || (language === 'ar' ? '8 أحرف على الأقل' : language === 'fr' ? 'Au moins 8 caractères' : 'At least 8 characters')}</span>
                  </div>
                  <div className={`flex items-center gap-1.5 transition-colors ${hasLetter && hasNumber ? 'text-emerald-700 font-medium' : 'text-[#7D8C83]'}`}>
                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${hasLetter && hasNumber ? 'bg-emerald-100 text-emerald-700' : 'bg-[#E5DFD5] text-[#7D8C83]'}`}>
                      {hasLetter && hasNumber ? <Check className="w-2.5 h-2.5" /> : '•'}
                    </span>
                    <span>{strings.auth?.passwordRequirementLettersNumbers || (language === 'ar' ? 'مزيج من الحروف والأرقام' : language === 'fr' ? 'Mélange de lettres et chiffres' : 'Mix of letters and numbers')}</span>
                  </div>
                </div>
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
                <span>{isSubmitting ? (strings.auth?.signingUpBtn || 'Preparing your space...') : (strings.auth?.signUpBtn || 'Create My Personal Space')}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </button>
            </div>
          </form>

          {/* Footer Navigation within Card */}
          <div className="mt-6 pt-5 border-t border-[#EAE5DC] text-center">
            <p className="text-xs text-[#627269]">
              {(strings.auth?.alreadyHaveAccount || 'Already have an account?') + ' '}
              <button
                id="signup-switch-signin-btn"
                onClick={onNavigateToSignIn}
                className="font-semibold text-[#2A4839] hover:underline cursor-pointer"
              >
                {strings.auth?.signInLink || 'Sign in to your space'}
              </button>
            </p>
            <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-[#839188]">
              <Lock className="w-3 h-3 text-[#315243]" />
              <span>{strings.auth?.signUpConfidentialityFooter || '100% Free • Non-profit • Confidential'}</span>
            </div>
            {onOpenContactSupport && (
              <div className="mt-3 pt-3 border-t border-[#EAE5DC] text-center">
                <button
                  type="button"
                  onClick={() => onOpenContactSupport()}
                  className="text-xs text-[#52655A] hover:text-[#21352A] hover:underline cursor-pointer inline-flex items-center gap-1.5 font-medium"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-[#315243]" />
                  <span>{strings.auth?.contactSupportPrompt || 'Need help with the site? Contact Support'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Page Footer */}
      <footer className="w-full py-5 text-center text-xs text-[#7A8A80] border-t border-[#E5DFD5] bg-[#FAF8F5]/80 mt-auto">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; {new Date().getFullYear()} {strings.common?.appName || '3awdli'} &bull; {language === 'ar' ? 'فريق الدعم النفسي' : language === 'fr' ? 'Équipe d\'écoute' : 'Listening Team'}</span>
          {onOpenContactSupport && (
            <button
              id="signup-footer-contact-link"
              onClick={() => onOpenContactSupport()}
              className="text-[#315243] hover:underline font-medium cursor-pointer inline-flex items-center gap-1"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{strings.auth?.contactSupportPrompt || 'Need help with the site? Contact Support'}</span>
            </button>
          )}
        </div>
      </footer>
    </Navbar>
  );
};
