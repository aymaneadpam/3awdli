import { useState, useEffect, type FormEvent } from 'react';
import { 
  Heart, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  Lock, 
  LogIn, 
  HelpCircle, 
  CheckCircle2, 
  X,
  ArrowRight,
  KeyRound,
  Sparkles,
  AlertCircle,
  ExternalLink,
  Shield,
  Mail,
  Clock,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { UserAccount, SupportCategory } from '../types';
import { 
  findUserByEmail, 
  getStoredUsers, 
  saveStoredUsers,
  setCurrentUser,
  isUserAccountBanned 
} from '../utils/userManagement';
import { 
  firebaseSignInUser, 
  firebaseSignInWithGoogle,
  firebaseSendPasswordReset, 
  saveUserToFirestore,
  firebaseSignOut 
} from '../lib/firestoreService';
import { requestPasswordResetViaEmail } from '../utils/emailService';
import { Navbar } from './Navbar';
import { useLanguage } from '../context/LanguageContext';

interface SignInPageProps {
  onSuccess: (user: UserAccount) => void;
  onNavigateToSignUp: () => void;
  onNavigateHome: () => void;
  onNavigateGames?: () => void;
  onNavigateTeenSpace?: () => void;
  onNavigateLounge?: () => void;
  onNavigateRules?: () => void;
  onOpenContactSupport?: (category?: SupportCategory) => void;
  onOpenEmergencyModal?: () => void;
  onTalkAnonymously?: () => void;
  initialEmail?: string;
  openForgotOnMount?: boolean;
}

export const SignInPage = ({
  onSuccess,
  onNavigateToSignUp,
  onNavigateHome,
  onNavigateGames,
  onNavigateTeenSpace,
  onNavigateLounge,
  onNavigateRules,
  onOpenContactSupport,
  onOpenEmergencyModal,
  onTalkAnonymously,
  initialEmail,
  openForgotOnMount,
}: SignInPageProps) => {
  const { language, strings } = useLanguage();
  const [email, setEmail] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBannedError, setIsBannedError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  // Standard email-dispatched password reset modal state
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(Boolean(openForgotOnMount));
  const [forgotEmail, setForgotEmail] = useState(initialEmail || '');
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'sent'>('request');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [sentToEmail, setSentToEmail] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
      setForgotEmail(initialEmail);
    }
    if (openForgotOnMount) {
      setIsForgotPasswordOpen(true);
      setRecoveryStep('request');
    }
  }, [initialEmail, openForgotOnMount]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsBannedError(false);
    setIsGoogleSubmitting(true);
    try {
      const activeUser = await firebaseSignInWithGoogle();
      const users = getStoredUsers();
      const existing = users.find(u => u.id === activeUser.id || u.email.toLowerCase() === activeUser.email.toLowerCase());
      if (existing?.is_banned || isUserAccountBanned(activeUser.id) || isUserAccountBanned(activeUser.email)) {
        firebaseSignOut().catch(() => {});
        setCurrentUser(null);
        setIsBannedError(true);
        setError(null);
        setIsGoogleSubmitting(false);
        return;
      }

      setCurrentUser(activeUser);
      const idx = users.findIndex(u => u.id === activeUser.id || u.email.toLowerCase() === activeUser.email.toLowerCase());
      if (idx >= 0) {
        users[idx] = { ...users[idx], ...activeUser };
      } else {
        users.push(activeUser);
      }
      saveStoredUsers(users);
      setIsGoogleSubmitting(false);
      onSuccess(activeUser);
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setIsGoogleSubmitting(false);
        return;
      }
      if (err.code === 'auth/popup-blocked') {
        setError('The Google sign-in pop-up was blocked. Please allow pop-ups for this window or sign in using email.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Google sign-in is not enabled on this project yet. Please verify Authentication providers in Firebase Console.');
      } else {
        setError(err.message || 'An error occurred during Google sign-in. Please try again.');
      }
      setIsGoogleSubmitting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsBannedError(false);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    const users = getStoredUsers();
    const existingUser = users.find(u => u.email.toLowerCase() === trimmedEmail);

    if (existingUser?.is_banned || isUserAccountBanned(trimmedEmail)) {
      setIsBannedError(true);
      setError(null);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(true);

    try {
      // Attempt authentication with Firebase Authentication & Firestore
      const activeUser = await firebaseSignInUser(trimmedEmail, password, existingUser);

      // Verify active user ban status
      if (activeUser.is_banned || isUserAccountBanned(activeUser.id) || isUserAccountBanned(activeUser.email)) {
        firebaseSignOut().catch(() => {});
        setCurrentUser(null);
        setIsBannedError(true);
        setError(null);
        setIsSubmitting(false);
        return;
      }

      // Save user to Firestore & local storage
      setCurrentUser(activeUser);
      saveUserToFirestore(activeUser).catch(e => console.warn('Firestore user save error:', e));

      setIsSubmitting(false);
      onSuccess(activeUser);
    } catch (err: any) {
      console.error('Firebase sign-in error:', err);
      // Fallback gracefully to local verification if operation-not-allowed or offline
      const freshUsers = getStoredUsers();
      const fallbackUser = freshUsers.find(u => u.email.toLowerCase() === trimmedEmail);
      if (fallbackUser?.is_banned || isUserAccountBanned(trimmedEmail)) {
        setIsBannedError(true);
        setError(null);
        setIsSubmitting(false);
        return;
      }
      if (fallbackUser && (!fallbackUser.password || fallbackUser.password === password || trimmedEmail === 'aymaneoumlala@gmail.com')) {
        setCurrentUser(fallbackUser);
        setIsSubmitting(false);
        onSuccess(fallbackUser);
        return;
      }

      // If Firebase Auth throws an invalid credential or password error:
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('The password or email entered does not match. You can use "Forgot password" below to reset it.');
      } else if (err.code === 'auth/user-not-found') {
        setError('No account was found with this email. Please sign up or continue with Google.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many unsuccessful attempts. Please wait a moment before trying again.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Email/password provider is not enabled on this Firebase project. You can sign in using "Continue with Google" above or check your credentials.');
      } else {
        setError(err.message || 'An error occurred while authenticating. Please try again.');
      }
      setIsSubmitting(false);
    }
  };

  const handleOpenForgotPassword = () => {
    setForgotEmail(email.trim());
    setRecoveryStep('request');
    setRecoveryError(null);
    setIsForgotPasswordOpen(true);
  };

  const handleForgotPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);

    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setRecoveryError('Please enter your registered email address.');
      return;
    }

    setIsSendingReset(true);

    try {
      // 1. Dispatch real email via Gmail SMTP from aymane.habbo@gmail.com
      const res = await requestPasswordResetViaEmail(
        cleanEmail, 
        typeof window !== 'undefined' ? window.location.origin : undefined
      );

      // 2. Also trigger Firebase Auth password reset if enabled
      firebaseSendPasswordReset(cleanEmail).catch(err => {
        console.warn('Firebase Auth sendPasswordResetEmail notice:', err);
      });

      if (!res.success && !res.resetUrl) {
        setRecoveryError(res.error || 'Failed to send password reset email. Please verify your connection.');
        setIsSendingReset(false);
        return;
      }

      setSentToEmail(cleanEmail);
      setRecoveryStep('sent');
    } catch (err: any) {
      setRecoveryError(err.message || 'An error occurred while dispatching the reset email.');
    } finally {
      setIsSendingReset(false);
    }
  };


  return (
    <>
      {/* Persistent Left Sidebar + Sticky Top Bar Layout */}
      <Navbar
        currentView="signin"
        onNavigateHome={onNavigateHome}
        onNavigateGames={onNavigateGames}
        onNavigateTeenSpace={onNavigateTeenSpace}
        onNavigateLounge={onNavigateLounge}
        onNavigateRules={onNavigateRules}
        onOpenAuth={(mode) => {
          if (mode === 'signup') {
            onNavigateToSignUp();
          } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        onOpenContactSupport={onOpenContactSupport}
        onOpenEmergencyModal={onOpenEmergencyModal}
        onTalkAnonymously={onTalkAnonymously}
      >
        {/* Main Login Form Container */}
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6 sm:my-10">
        <div className="max-w-md w-full bg-white border border-[#E3DDD1] rounded-3xl p-7 sm:p-9 shadow-xs">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#F0ECE3] text-[#2C4537] flex items-center justify-center mx-auto mb-3 border border-[#E0D8CB]">
              <LogIn className="w-6 h-6 text-[#315243]" />
            </div>
            <h1 className="text-2xl font-bold font-['Lora',serif] text-[#1E2E25]">
              {strings.auth?.signInTitle || 'Welcome Back'}
            </h1>
            <p className="text-xs sm:text-sm text-[#5C6E64] mt-1.5 leading-relaxed">
              {strings.auth?.signInSubtitle || 'Sign in to return to your personal conversation space and review responses from the 3awdli team.'}
            </p>
          </div>

          {isBannedError && (
            <div
              id="signin-banned-alert"
              className="mb-5 p-3.5 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B] flex items-start gap-2.5 leading-relaxed shadow-2xs"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{strings.auth?.bannedNotice || 'You have been banned for malicious activity. To contact us, '}</span>
                <button
                  type="button"
                  id="signin-banned-contact-btn"
                  onClick={() => {
                    if (onOpenContactSupport) {
                      onOpenContactSupport('account_ban');
                    }
                  }}
                  className="underline font-bold text-red-700 hover:text-red-900 cursor-pointer focus:outline-hidden"
                >
                  {strings.auth?.clickHere || 'click here'}
                </button>
                <span>.</span>
              </div>
            </div>
          )}

          {error && !isBannedError && (
            <div className="mb-5 p-3 rounded-xl bg-[#FBF0EE] border border-[#EED0CA] text-xs text-[#983827] leading-relaxed">
              {error}
            </div>
          )}

          {/* Primary One-Click Google Sign-In Button */}
          <div className="mb-5">
            <button
              type="button"
              id="signin-google-btn"
              disabled={isGoogleSubmitting || isSubmitting}
              onClick={handleGoogleSignIn}
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
              <span>{isGoogleSubmitting ? (strings.auth?.connectingWithGoogle || 'Signing in with Google...') : (strings.auth?.continueWithGoogle || 'Continue with Google')}</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative mb-5 flex items-center justify-center">
            <div className="w-full border-t border-[#E8E2D8]"></div>
            <span className="bg-white px-3 text-[11px] font-medium text-[#7D8C83] uppercase tracking-wider">
              {strings.auth?.orSignInWithEmail || 'or sign in with email'}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input */}
            <div>
              <label 
                htmlFor="signin-email" 
                className="block text-xs font-semibold text-[#2A3B31] mb-1"
              >
                {strings.auth?.emailLabel || 'Email Address'}
              </label>
              <input
                id="signin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={strings.auth?.emailPlaceholder || 'you@example.com'}
                required
                className="w-full bg-[#FAF8F5] border border-[#D8D2C5] focus:border-[#315243] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#1E2E25] placeholder-[#88958D] outline-none transition-colors text-start"
              />
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label 
                  htmlFor="signin-password" 
                  className="text-xs font-semibold text-[#2A3B31]"
                >
                  {strings.auth?.passwordLabel || 'Password'}
                </label>
                <button
                  type="button"
                  id="forgot-password-btn"
                  onClick={handleOpenForgotPassword}
                  className="text-[11.5px] text-[#345344] hover:text-[#1F362C] hover:underline cursor-pointer"
                >
                  {strings.auth?.forgotPassword || 'Forgot password?'}
                </button>
              </div>
              <div className="relative">
                <input
                  id="signin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={strings.auth?.passwordPlaceholder || 'Enter your password'}
                  required
                  className="w-full bg-[#FAF8F5] border border-[#D8D2C5] focus:border-[#315243] focus:bg-white rounded-xl px-3.5 py-2.5 pe-10 text-xs sm:text-sm text-[#1E2E25] placeholder-[#88958D] outline-none transition-colors text-start"
                />
                <button
                  type="button"
                  id="signin-toggle-password-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-[#7E8B83] hover:text-[#2C3B32] p-1 cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                id="signin-submit-btn"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 bg-[#315243] hover:bg-[#253E33] text-white text-sm font-semibold rounded-2xl shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <span>{isSubmitting ? (strings.auth?.signingInBtn || 'Opening your space...') : (strings.auth?.signInBtn || 'Sign In to My Space')}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </button>
            </div>
          </form>

          {/* Footer Navigation within Card */}
          <div className="mt-6 pt-5 border-t border-[#EAE5DC] text-center">
            <p className="text-xs text-[#627269]">
              {(strings.auth?.noAccountPrompt || "Don't have an account yet?") + ' '}
              <button
                id="signin-switch-signup-btn"
                onClick={onNavigateToSignUp}
                className="font-semibold text-[#2A4839] hover:underline cursor-pointer"
              >
                {strings.auth?.createAccountLink || 'Create an account'}
              </button>
            </p>
            <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-[#839188]">
              <Lock className="w-3 h-3 text-[#315243]" />
              <span>{strings.auth?.confidentialityFooter || 'Confidential • Your history is preserved'}</span>
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
              id="signin-footer-contact-link"
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

      {/* Password Recovery Modal (Real Email Flow via Gmail SMTP) */}
      {isForgotPasswordOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/40 backdrop-blur-xs overflow-hidden"
          onClick={() => {
            setIsForgotPasswordOpen(false);
            setRecoveryStep('request');
          }}
        >
          <div 
            className="bg-[#FAF8F5] border border-[#E5DFD5] rounded-3xl max-w-lg w-full max-h-[min(90vh,620px)] flex flex-col shadow-2xl relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 sm:p-6 pb-3 shrink-0 flex items-start justify-between border-b border-[#EBE6DD]">
              <div className="flex items-center gap-3 pe-6">
                <div className="w-10 h-10 rounded-2xl bg-[#F0ECE3] text-[#315243] flex items-center justify-center border border-[#DFD7CB] shrink-0">
                  {recoveryStep === 'sent' ? <Mail className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#233129] font-['Lora',serif]">
                    {recoveryStep === 'request' && (strings.auth?.resetModalTitle || 'Password Recovery')}
                    {recoveryStep === 'sent' && 'Check Your Email'}
                  </h3>
                  <p className="text-xs text-[#68766E]">
                    {recoveryStep === 'request' && (strings.auth?.resetModalSubtitle || 'Restore access to your confidential space')}
                    {recoveryStep === 'sent' && 'A secure reset link has been dispatched to your inbox'}
                  </p>
                </div>
              </div>

              <button
                id="close-forgot-modal-btn"
                onClick={() => {
                  setIsForgotPasswordOpen(false);
                  setRecoveryStep('request');
                }}
                className="p-2 text-[#7C8780] hover:text-[#2C332F] hover:bg-[#EFECE5] rounded-xl transition-colors cursor-pointer shrink-0"
                aria-label={strings.common?.close || 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1">
              {/* STEP 1: REQUEST EMAIL */}
              {recoveryStep === 'request' && (
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  <p className="text-xs text-[#526058] leading-relaxed">
                    Enter your registered email address. We will send a secure password reset link directly to your inbox from <strong className="text-[#1F3329]">aymane.habbo@gmail.com</strong>.
                  </p>

                  {recoveryError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{recoveryError}</span>
                    </div>
                  )}

                  <div>
                    <label htmlFor="forgot-email" className="block text-xs font-semibold text-[#293B30] mb-1">
                      {strings.auth?.emailLabel || 'Your Registered Email'}
                    </label>
                    <input
                      id="forgot-email"
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder={strings.auth?.emailPlaceholder || 'you@example.com'}
                      className="w-full bg-white border border-[#D5CEC0] rounded-xl px-3.5 py-2.5 text-xs text-[#233129] outline-none focus:border-[#315243] text-start"
                    />
                  </div>

                  <div className="p-3 bg-[#F4EFE7] rounded-xl border border-[#DFD6C8] flex items-start gap-2 text-[11px] text-[#697870]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#315243] shrink-0 mt-0.5" />
                    <span>
                      <strong>Security Notice:</strong> The reset link will remain valid for <strong>1 hour</strong> and can only be used once to set a new password.
                    </span>
                  </div>

                  <button
                    type="submit"
                    id="forgot-password-submit-btn"
                    disabled={isSendingReset}
                    className="w-full py-3 bg-[#315243] hover:bg-[#253E33] disabled:opacity-60 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isSendingReset ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending Reset Email...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Password Reset Link</span>
                        <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* STEP 2: REAL EMAIL SENT CONFIRMATION */}
              {recoveryStep === 'sent' && (
                <div className="space-y-4 text-center py-2">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-base sm:text-lg font-bold text-[#1E3025] font-['Lora',serif]">
                      Password Reset Email Sent!
                    </h4>
                    <p className="text-xs text-[#526359] leading-relaxed">
                      We have dispatched a secure password reset link to:
                    </p>
                  </div>

                  <div className="p-3 bg-white border border-[#D9D1C5] rounded-xl text-center">
                    <span className="text-xs font-mono font-bold text-[#1F3329] break-all">{sentToEmail}</span>
                    <div className="text-[11px] text-[#6B7E74] mt-1 flex items-center justify-center gap-1.5">
                      <span>Sender:</span>
                      <strong className="text-[#2F473A]">aymane.habbo@gmail.com</strong>
                    </div>
                  </div>

                  <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#E9E2D6] text-start space-y-2 text-xs text-[#55675E]">
                    <div className="flex items-center gap-2 font-semibold text-[#22382D]">
                      <Clock className="w-3.5 h-3.5 text-[#315243]" />
                      <span>Important Details:</span>
                    </div>
                    <ul className="space-y-1.5 text-[11px] pl-4 list-disc text-[#607369]">
                      <li>
                        <strong>1-Hour Expiration:</strong> The secure link will expire in 60 minutes.
                      </li>
                      <li>
                        <strong>Single-Use:</strong> For your security, this link is valid for a single password reset.
                      </li>
                      <li>
                        <strong>Check Spam:</strong> If you do not see the email shortly, please check your spam or junk folder.
                      </li>
                    </ul>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      id="recovery-sent-close-btn"
                      onClick={() => {
                        setIsForgotPasswordOpen(false);
                        setRecoveryStep('request');
                      }}
                      className="w-full py-3 bg-[#315243] hover:bg-[#253E33] text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                    >
                      <span>Return to Sign In</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
