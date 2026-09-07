import { useState, type FormEvent } from 'react';
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
  Copy,
  Check,
  Sparkles,
  AlertCircle,
  ExternalLink,
  Shield
} from 'lucide-react';
import { UserAccount } from '../types';
import { 
  findUserByEmail, 
  updateUserPassword, 
  getStoredUsers, 
  saveStoredUsers 
} from '../utils/userManagement';

interface SignInPageProps {
  onSuccess: (user: UserAccount) => void;
  onNavigateToSignUp: () => void;
  onNavigateHome: () => void;
}

export const SignInPage = ({
  onSuccess,
  onNavigateToSignUp,
  onNavigateHome,
}: SignInPageProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Developer-friendly on-screen password reset modal state
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'resetForm' | 'success'>('request');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [generatedResetLink, setGeneratedResetLink] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const storedUsersRaw = localStorage.getItem('3awdli_users');
      const users: Array<UserAccount & { password?: string }> = storedUsersRaw 
        ? JSON.parse(storedUsersRaw) 
        : [];

      // Find user
      const existingUser = users.find(u => u.email.toLowerCase() === trimmedEmail);

      if (existingUser) {
        if (existingUser.password && existingUser.password !== password) {
          setError('The password entered does not match our records. You can use "Forgot password" below if needed.');
          setIsSubmitting(false);
          return;
        }

        const isAdminAccount = existingUser.role === 'admin' || existingUser.email.toLowerCase() === 'aymaneoumlala@gmail.com';

        const activeUser: UserAccount = {
          id: existingUser.id,
          name: existingUser.name,
          email: existingUser.email,
          createdAt: existingUser.createdAt,
          role: isAdminAccount ? 'admin' : (existingUser.role || 'user'),
          is_listener: existingUser.is_listener,
          isListener: existingUser.isListener || existingUser.is_listener,
          is_head_of_listeners: existingUser.is_head_of_listeners,
          profession: existingUser.profession,
          listener_granted_at: existingUser.listener_granted_at,
        };

        localStorage.setItem('3awdli_current_user', JSON.stringify(activeUser));
        setTimeout(() => {
          setIsSubmitting(false);
          onSuccess(activeUser);
        }, 300);
      } else {
        // If it's a first time test user with a friendly name inferred from email or guest
        // We can either notify them, or if it's the demo account create it smoothly
        if (users.length === 0 || trimmedEmail === 'aymaneoumlala@gmail.com') {
          // Auto-provision demo account for convenience
          const inferredName = trimmedEmail.split('@')[0].replace(/[^a-zA-Z]/g, ' ') || 'Friend';
          const capitalized = inferredName.charAt(0).toUpperCase() + inferredName.slice(1);
          const isFirstOrAdmin = true;
          const demoUser: UserAccount & { password?: string } = {
            id: `user_${Date.now()}`,
            name: capitalized === 'Aymaneoumlala' ? 'Aymane Oumlala' : capitalized,
            email: trimmedEmail,
            password: password,
            createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            role: isFirstOrAdmin ? 'admin' : 'user',
          };
          users.push(demoUser);
          localStorage.setItem('3awdli_users', JSON.stringify(users));

          const publicUser: UserAccount = {
            id: demoUser.id,
            name: demoUser.name,
            email: demoUser.email,
            createdAt: demoUser.createdAt,
            role: demoUser.role,
            is_listener: demoUser.is_listener,
            isListener: demoUser.isListener,
            is_head_of_listeners: demoUser.is_head_of_listeners,
            profession: demoUser.profession,
          };
          localStorage.setItem('3awdli_current_user', JSON.stringify(publicUser));

          const initialChatsKey = `3awdli_chats_${demoUser.id}`;
          const sampleMessages = [
            {
              id: `msg_${Date.now()}_1`,
              sender: 'team',
              senderName: 'Dr. Leila • Clinical Psychologist',
              text: `Hello ${capitalized}, welcome back to 3awdli. Take a gentle breath. We are here whenever you would like to pick up where we left off.`,
              timestamp: '10:15 AM',
            },
          ];
          localStorage.setItem(initialChatsKey, JSON.stringify(sampleMessages));

          setTimeout(() => {
            setIsSubmitting(false);
            onSuccess(publicUser);
          }, 300);
        } else {
          setError('We could not find an account with this email. Please check the spelling or create a new account.');
          setIsSubmitting(false);
        }
      }
    } catch {
      setError('An error occurred while signing in. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleOpenForgotPassword = () => {
    setForgotEmail(email.trim());
    setRecoveryStep('request');
    setRecoveryError(null);
    setNewPassword('');
    setConfirmPassword('');
    setCopiedLink(false);
    setIsForgotPasswordOpen(true);
  };

  const handleForgotPasswordSubmit = (e: FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);

    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setRecoveryError('Please enter your registered email address.');
      return;
    }

    // Generate mock test reset link
    const token = `rst_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://3awdli.org';
    const mockLink = `${origin}/reset-password?token=${token}&email=${encodeURIComponent(cleanEmail)}`;
    setGeneratedResetLink(mockLink);
    setRecoveryStep('resetForm');
  };

  const handleSetNewPasswordSubmit = (e: FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);

    if (!newPassword) {
      setRecoveryError('Please enter your new password.');
      return;
    }

    if (newPassword.length < 6) {
      setRecoveryError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setRecoveryError('Passwords do not match. Please verify both fields.');
      return;
    }

    const cleanEmail = forgotEmail.trim().toLowerCase();
    const existingUser = findUserByEmail(cleanEmail);

    if (!existingUser) {
      // Auto-create test account so developers/testers aren't blocked with custom emails
      const inferredName = cleanEmail.split('@')[0].replace(/[^a-zA-Z]/g, ' ') || 'Friend';
      const capitalized = inferredName.charAt(0).toUpperCase() + inferredName.slice(1);
      const users = getStoredUsers();
      users.push({
        id: `user_${Date.now()}`,
        name: capitalized,
        email: cleanEmail,
        password: newPassword,
        createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        role: users.length === 0 || cleanEmail === 'aymaneoumlala@gmail.com' ? 'admin' : 'user',
      });
      saveStoredUsers(users);
    } else {
      updateUserPassword(cleanEmail, newPassword);
    }

    // Pre-fill the login form with the updated credentials
    setEmail(cleanEmail);
    setPassword(newPassword);

    setRecoveryStep('success');
  };

  const handleCopyLink = () => {
    if (generatedResetLink && navigator.clipboard) {
      navigator.clipboard.writeText(generatedResetLink).catch(() => {});
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };


  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col text-[#2C332E]">
      {/* Top Header */}
      <header className="border-b border-[#EAE4DC] bg-[#FAF8F5]/90 backdrop-blur-xs py-4 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            id="signin-back-home-btn"
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
            <span className="hidden sm:inline">New to 3awdli?</span>
            <button
              id="signin-nav-to-signup-btn"
              onClick={onNavigateToSignUp}
              className="text-[#2C483A] font-semibold hover:underline cursor-pointer ml-1"
            >
              Sign Up
            </button>
          </div>
        </div>
      </header>

      {/* Main Login Form Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6 sm:my-10">
        <div className="max-w-md w-full bg-white border border-[#E3DDD1] rounded-3xl p-7 sm:p-9 shadow-xs">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#F0ECE3] text-[#2C4537] flex items-center justify-center mx-auto mb-3 border border-[#E0D8CB]">
              <LogIn className="w-6 h-6 text-[#315243]" />
            </div>
            <h1 className="text-2xl font-bold font-['Lora',serif] text-[#1E2E25]">
              Welcome Back
            </h1>
            <p className="text-xs sm:text-sm text-[#5C6E64] mt-1.5 leading-relaxed">
              Sign in to return to your personal conversation space and review responses from the 3awdli team.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-[#FBF0EE] border border-[#EED0CA] text-xs text-[#983827] leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input */}
            <div>
              <label 
                htmlFor="signin-email" 
                className="block text-xs font-semibold text-[#2A3B31] mb-1"
              >
                Email Address
              </label>
              <input
                id="signin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-[#FAF8F5] border border-[#D8D2C5] focus:border-[#315243] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#1E2E25] placeholder-[#88958D] outline-none transition-colors"
              />
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label 
                  htmlFor="signin-password" 
                  className="text-xs font-semibold text-[#2A3B31]"
                >
                  Password
                </label>
                <button
                  type="button"
                  id="forgot-password-btn"
                  onClick={handleOpenForgotPassword}
                  className="text-[11.5px] text-[#345344] hover:text-[#1F362C] hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="signin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full bg-[#FAF8F5] border border-[#D8D2C5] focus:border-[#315243] focus:bg-white rounded-xl px-3.5 py-2.5 pr-10 text-xs sm:text-sm text-[#1E2E25] placeholder-[#88958D] outline-none transition-colors"
                />
                <button
                  type="button"
                  id="signin-toggle-password-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7E8B83] hover:text-[#2C3B32] p-1 cursor-pointer"
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
                <span>{isSubmitting ? 'Opening your space...' : 'Sign In to My Space'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Footer Navigation within Card */}
          <div className="mt-6 pt-5 border-t border-[#EAE5DC] text-center">
            <p className="text-xs text-[#627269]">
              Don&apos;t have an account yet?{' '}
              <button
                id="signin-switch-signup-btn"
                onClick={onNavigateToSignUp}
                className="font-semibold text-[#2A4839] hover:underline cursor-pointer"
              >
                Create an account
              </button>
            </p>
            <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-[#839188]">
              <Lock className="w-3 h-3 text-[#315243]" />
              <span>Confidential &bull; Your history is preserved</span>
            </div>
          </div>
        </div>
      </main>

      {/* Developer-Friendly Password Recovery / Reset Modal */}
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
            {/* Header - Fixed / shrink-0 */}
            <div className="p-5 sm:p-6 pb-3 shrink-0 flex items-start justify-between border-b border-[#EBE6DD]">
              <div className="flex items-center gap-3 pr-6">
                <div className="w-10 h-10 rounded-2xl bg-[#F0ECE3] text-[#315243] flex items-center justify-center border border-[#DFD7CB] shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#233129] font-['Lora',serif]">
                    {recoveryStep === 'request' && 'Password Recovery'}
                    {recoveryStep === 'resetForm' && 'Set New Password'}
                    {recoveryStep === 'success' && 'Password Reset Complete'}
                  </h3>
                  <p className="text-xs text-[#68766E]">
                    {recoveryStep === 'request' && 'Restore access to your confidential space'}
                    {recoveryStep === 'resetForm' && 'On-screen testing mode active'}
                    {recoveryStep === 'success' && 'Ready to sign in with your updated password'}
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
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1">
              {/* STEP 1: REQUEST EMAIL */}
              {recoveryStep === 'request' && (
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  <p className="text-xs text-[#526058] leading-relaxed">
                    Enter your registered email address. While in development mode, the reset link and password update form will appear directly on your screen right after you submit.
                  </p>

                  {recoveryError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{recoveryError}</span>
                    </div>
                  )}

                  <div>
                    <label htmlFor="forgot-email" className="block text-xs font-semibold text-[#293B30] mb-1">
                      Your Registered Email
                    </label>
                    <input
                      id="forgot-email"
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-white border border-[#D5CEC0] rounded-xl px-3.5 py-2.5 text-xs text-[#233129] outline-none focus:border-[#315243]"
                    />
                  </div>

                  <div className="p-3 bg-[#F4EFE7] rounded-xl border border-[#DFD6C8] flex items-start gap-2 text-[11px] text-[#697870]">
                    <Sparkles className="w-3.5 h-3.5 text-[#315243] shrink-0 mt-0.5" />
                    <span>
                      <strong>Developer notice:</strong> No real email server is required. Submitting will immediately open the password reset form on-screen.
                    </span>
                  </div>

                  <button
                    type="submit"
                    id="forgot-password-submit-btn"
                    className="w-full py-3 bg-[#315243] hover:bg-[#253E33] text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Continue to Reset Password</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* STEP 2: SET NEW PASSWORD ON-SCREEN (DEVELOPMENT TEST MODE) */}
              {recoveryStep === 'resetForm' && (
                <div className="space-y-4">
                  {/* Developer Mode Banner */}
                  <div className="p-3.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl flex items-start gap-2.5 text-xs text-[#92400E]">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                      <span className="font-semibold">Developer Testing Mode:</span>
                      <p className="mt-0.5 text-[#78350F]">
                        Since no external email service is connected yet, your reset link and direct password update form are provided immediately below so you can test the complete flow without waiting for an email.
                      </p>
                    </div>
                  </div>

                  {/* Simulated Reset Link Card */}
                  <div className="p-3 bg-[#F4EFE7] border border-[#DFD6C8] rounded-2xl space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-[#55675D]">
                      <span className="font-semibold flex items-center gap-1">
                        <KeyRound className="w-3.5 h-3.5 text-[#315243]" />
                        Simulated Reset Link
                      </span>
                      <button
                        type="button"
                        id="recovery-copy-link-btn"
                        onClick={handleCopyLink}
                        className="flex items-center gap-1 text-[#264435] hover:text-[#182E23] font-semibold transition-colors cursor-pointer text-[11px]"
                      >
                        {copiedLink ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="bg-white px-3 py-2 rounded-xl text-[11px] text-[#37453E] font-mono break-all border border-[#E3DDD1]">
                      {generatedResetLink}
                    </div>
                  </div>

                  {/* Form to Set New Password */}
                  <form onSubmit={handleSetNewPasswordSubmit} className="space-y-3.5 pt-1">
                    <div className="text-xs text-[#3D4C43] flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-[#E5DFD5]">
                      <span>Account email:</span>
                      <span className="font-semibold text-[#1F3329]">{forgotEmail}</span>
                    </div>

                    {recoveryError && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                        <span>{recoveryError}</span>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-[#293B30] mb-1">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          id="recovery-new-password"
                          type={showNewPassword ? 'text' : 'password'}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter at least 6 characters"
                          className="w-full bg-white border border-[#D5CEC0] rounded-xl px-3.5 py-2.5 pr-10 text-xs text-[#233129] outline-none focus:border-[#315243]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7E8B83] hover:text-[#2C3B32] p-1 cursor-pointer"
                          aria-label="Toggle password visibility"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#293B30] mb-1">
                        Confirm New Password
                      </label>
                      <input
                        id="recovery-confirm-password"
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your new password"
                        className="w-full bg-white border border-[#D5CEC0] rounded-xl px-3.5 py-2.5 text-xs text-[#233129] outline-none focus:border-[#315243]"
                      />
                    </div>

                    <div className="flex items-center gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRecoveryStep('request');
                          setRecoveryError(null);
                        }}
                        className="py-2.5 px-4 bg-[#EFECE5] hover:bg-[#E5E0D5] text-[#3D4C43] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      >
                        Back
                      </button>

                      <button
                        type="submit"
                        id="recovery-submit-new-password-btn"
                        className="flex-1 py-2.5 px-4 bg-[#315243] hover:bg-[#253E33] text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                      >
                        <span>Update Password Now</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* STEP 3: SUCCESS CONFIRMATION */}
              {recoveryStep === 'success' && (
                <div className="space-y-4 text-center py-2">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-[#1E3025] font-['Lora',serif]">
                      Password Successfully Updated!
                    </h4>
                    <p className="text-xs text-[#526359] mt-1.5 max-w-sm mx-auto leading-relaxed">
                      Your new password for <span className="font-semibold text-[#23382C]">{forgotEmail}</span> has been saved. We have filled your email and password into the sign-in form for you.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      id="recovery-success-signin-btn"
                      onClick={() => {
                        setIsForgotPasswordOpen(false);
                        setRecoveryStep('request');
                      }}
                      className="w-full py-3 bg-[#315243] hover:bg-[#253E33] text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                    >
                      <span>Sign In to My Space</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
