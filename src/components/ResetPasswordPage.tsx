import React, { useState, useEffect } from 'react';
import { 
  KeyRound, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ArrowRight, 
  ShieldCheck, 
  Mail, 
  Loader2,
  Sparkles,
  Check
} from 'lucide-react';
import { verifyPasswordResetToken, submitPasswordReset } from '../utils/emailService';
import { updateUserPassword, findUserByEmail, getStoredUsers, saveStoredUsers } from '../utils/userManagement';
import { saveUserToFirestore, updateUserPasswordInFirestore } from '../lib/firestoreService';
import { Navbar } from './Navbar';
import { useLanguage } from '../context/LanguageContext';

interface ResetPasswordPageProps {
  token: string;
  initialEmail?: string;
  onNavigateSignIn: (prefillEmail?: string, openForgotModal?: boolean) => void;
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

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({
  token,
  initialEmail = '',
  onNavigateSignIn,
  onNavigateHome,
  onNavigateGames,
  onNavigateTeenSpace,
  onNavigateLounge,
  onNavigateRules,
  onNavigateSchedules,
  onOpenContactSupport,
  onOpenEmergencyModal,
  onTalkAnonymously,
}) => {
  const { language, strings } = useLanguage();

  const [isLoading, setIsLoading] = useState(true);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [targetEmail, setTargetEmail] = useState(initialEmail);
  const [tokenError, setTokenError] = useState<{
    code: 'invalid' | 'expired' | 'already_used' | 'missing_token' | 'server_error';
    message: string;
  } | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Password requirements calculation
  const hasMinLength = newPassword.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasMix = hasLetter && hasNumber;
  const hasMatch = Boolean(newPassword && confirmPassword && newPassword === confirmPassword);

  // Resolve token from props or directly from URL query/hash parameters
  const getActiveToken = () => {
    if (token && token.trim()) return token.trim();
    if (typeof window === 'undefined') return '';
    try {
      const search = new URLSearchParams(window.location.search);
      let t = search.get('token') || search.get('reset_token') || '';
      if (!t && window.location.hash) {
        const hashStr = window.location.hash.replace(/^#\/?/, '');
        const queryPart = hashStr.includes('?') ? hashStr.split('?')[1] : hashStr;
        const hashParams = new URLSearchParams(queryPart);
        t = hashParams.get('token') || hashParams.get('reset_token') || '';
      }
      return t;
    } catch {
      return '';
    }
  };

  const activeToken = getActiveToken();

  // Validate token on mount or when token changes
  useEffect(() => {
    let isMounted = true;

    async function checkToken() {
      const tokenToCheck = activeToken;

      if (!tokenToCheck) {
        if (isMounted) {
          setIsLoading(false);
          setTokenValid(false);
          setTokenError({
            code: 'missing_token',
            message: 'No reset token was provided in the link. Please request a new password reset link.',
          });
        }
        return;
      }

      setIsLoading(true);
      const res = await verifyPasswordResetToken(tokenToCheck);
      
      if (!isMounted) return;

      if (res.valid) {
        setTokenValid(true);
        if (res.email) {
          setTargetEmail(res.email);
        }
        setTokenError(null);
      } else {
        setTokenValid(false);
        setTokenError({
          code: res.error || 'invalid',
          message: res.message || 'This reset link is invalid or has expired.',
        });
      }
      setIsLoading(false);
    }

    checkToken();

    return () => {
      isMounted = false;
    };
  }, [activeToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const tokenToSubmit = activeToken;
    if (!tokenToSubmit) {
      setFormError('Reset token is missing. Please request a new reset link.');
      return;
    }

    if (!newPassword) {
      setFormError(
        language === 'ar'
          ? 'يرجى إدخال كلمة المرور الجديدة.'
          : language === 'fr'
          ? 'Veuillez saisir un nouveau mot de passe.'
          : 'Please enter a new password.'
      );
      return;
    }

    if (newPassword.length < 8) {
      setFormError(
        strings.auth?.passwordRuleMinLengthError ||
        (language === 'ar'
          ? 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.'
          : language === 'fr'
          ? 'Le mot de passe doit comporter au moins 8 caractères.'
          : 'Password must be at least 8 characters long.')
      );
      return;
    }

    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setFormError(
        strings.auth?.passwordRuleMixError ||
        (language === 'ar'
          ? 'يجب أن تحتوي كلمة المرور على مزيج من الحروف والأرقام.'
          : language === 'fr'
          ? 'Le mot de passe doit contenir un mélange de lettres et de chiffres.'
          : 'Password must include both letters and numbers.')
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError(
        language === 'ar'
          ? 'كلمتا المرور غير متطابقتين. يرجى التأكد من تطابق الحقلين تماماً.'
          : language === 'fr'
          ? 'Les mots de passe ne correspondent pas. Veuillez vérifier que les deux champs sont identiques.'
          : 'Passwords do not match. Please ensure both fields are identical.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Submit reset to Express backend (which marks the token as used and prevents reuse)
      const res = await submitPasswordReset(tokenToSubmit, newPassword);

      if (!res.success) {
        setFormError(res.error || 'Failed to update password. The link may have expired or already been used.');
        setIsSubmitting(false);
        return;
      }

      const emailToUpdate = res.email || targetEmail;

      // 2. Synchronize user record in local storage and Firestore
      if (emailToUpdate) {
        const cleanEmail = emailToUpdate.trim().toLowerCase();
        updateUserPassword(cleanEmail, newPassword);
        try {
          await updateUserPasswordInFirestore(cleanEmail, newPassword);
        } catch (dbErr) {
          console.warn('Firestore direct password sync notice:', dbErr);
        }
      }

      setIsSuccess(true);
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred while saving your new password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Navbar
      currentView="signin"
      onNavigateHome={onNavigateHome}
      onNavigateGames={onNavigateGames}
      onNavigateTeenSpace={onNavigateTeenSpace}
      onNavigateLounge={onNavigateLounge}
      onNavigateRules={onNavigateRules}
      onNavigateSchedules={onNavigateSchedules}
      onOpenAuth={() => onNavigateSignIn(targetEmail)}
      onOpenContactSupport={onOpenContactSupport}
      onOpenEmergencyModal={onOpenEmergencyModal}
      onTalkAnonymously={onTalkAnonymously}
    >
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-md my-auto">
          {/* Card Container */}
          <div className="bg-white rounded-3xl border border-[#EBE5DC] shadow-sm overflow-hidden">
            {/* Header Banner */}
            <div className="bg-[#315243] text-white p-6 sm:p-8 text-center relative overflow-hidden">
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center mx-auto mb-3 text-emerald-200 border border-white/15 shadow-inner">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold font-['Lora',serif] tracking-tight">
                  {strings.auth?.resetModalTitle || 'Set New Password'}
                </h1>
                <p className="text-xs sm:text-sm text-[#D7E4DC] mt-1">
                  {strings.auth?.resetModalSubtitle || 'Choose a secure password for your personal space.'}
                </p>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-6 sm:p-8">
              {/* STATE 1: LOADING VALIDATION */}
              {isLoading && (
                <div className="py-12 text-center space-y-4">
                  <Loader2 className="w-8 h-8 text-[#315243] animate-spin mx-auto" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[#1F362C]">
                      Verifying secure reset link...
                    </p>
                    <p className="text-xs text-[#7B8B82]">
                      Checking token validity and 1-hour expiration window
                    </p>
                  </div>
                </div>
              )}

              {/* STATE 2: INVALID / EXPIRED / ALREADY USED TOKEN */}
              {!isLoading && tokenValid === false && (
                <div className="space-y-6 text-center py-2">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
                    {tokenError?.code === 'expired' ? (
                      <Clock className="w-7 h-7" />
                    ) : (
                      <AlertCircle className="w-7 h-7" />
                    )}
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-base sm:text-lg font-bold text-[#1F362C] font-['Lora',serif]">
                      {tokenError?.code === 'expired'
                        ? 'Reset Link Expired'
                        : tokenError?.code === 'already_used'
                        ? 'Link Already Used'
                        : 'Invalid Reset Link'}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#5C6E64] leading-relaxed max-w-sm mx-auto">
                      {tokenError?.message ||
                        'This password reset link is invalid or has expired. For your security, reset links are only valid for 1 hour and can only be used once.'}
                    </p>
                  </div>

                  <div className="p-4 bg-[#F8F5F0] rounded-2xl border border-[#EAE3D8] text-start text-xs text-[#526359] space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-[#2C4136]">
                      <ShieldCheck className="w-4 h-4 text-[#315243]" />
                      <span>Security Protection</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-[#68786F]">
                      To safeguard member privacy, all 3awdli password reset links expire after <strong>60 minutes</strong> and are permanently deactivated upon first use.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigateSignIn(targetEmail, true)}
                    className="w-full py-3 px-4 bg-[#315243] hover:bg-[#253E33] text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Request a New Reset Link</span>
                  </button>

                  <div>
                    <button
                      type="button"
                      onClick={() => onNavigateSignIn()}
                      className="text-xs text-[#5A6D63] hover:text-[#1F362C] underline underline-offset-4 cursor-pointer"
                    >
                      Return to Sign In
                    </button>
                  </div>
                </div>
              )}

              {/* STATE 3: FORM TO ENTER NEW PASSWORD */}
              {!isLoading && tokenValid === true && !isSuccess && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {targetEmail && (
                    <div className="p-3 bg-[#F4F8F5] border border-[#D5E3DC] rounded-xl flex items-center justify-between text-xs">
                      <span className="text-[#596E62]">Resetting password for:</span>
                      <span className="font-semibold text-[#1F362C] font-mono">{targetEmail}</span>
                    </div>
                  )}

                  {formError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div>
                    <label 
                      htmlFor="new-password"
                      className="block text-xs font-semibold text-[#293B30] mb-1.5"
                    >
                      {strings.auth?.newPasswordLabel || 'New Password'}
                    </label>
                    <div className="relative">
                      <input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={strings.auth?.newPasswordPlaceholder || 'At least 8 characters (letters & numbers)'}
                        minLength={8}
                        className="w-full bg-[#FAF8F5] border border-[#D5CEC0] rounded-xl px-3.5 py-2.5 pe-10 text-xs sm:text-sm text-[#233129] outline-none focus:border-[#315243] focus:bg-white transition-colors text-start"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute end-3 top-1/2 -translate-y-1/2 text-[#7E8B83] hover:text-[#2C3B32] p-1 cursor-pointer"
                        aria-label="Toggle password visibility"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label 
                      htmlFor="confirm-new-password"
                      className="block text-xs font-semibold text-[#293B30] mb-1.5"
                    >
                      {strings.auth?.confirmPasswordLabel || 'Confirm New Password'}
                    </label>
                    <input
                      id="confirm-new-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={strings.auth?.confirmPasswordPlaceholder || 'Re-enter your new password'}
                      className="w-full bg-[#FAF8F5] border border-[#D5CEC0] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#233129] outline-none focus:border-[#315243] focus:bg-white transition-colors text-start"
                    />
                  </div>

                  <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E8E1D5] space-y-1.5 text-[11px] text-[#697870]">
                    <div className="flex items-center gap-1.5 text-[#315243] font-semibold">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Password Requirements</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 pt-0.5">
                      <div className={`flex items-center gap-1.5 transition-colors ${hasMinLength ? 'text-emerald-700 font-medium' : 'text-[#7D8C83]'}`}>
                        <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${hasMinLength ? 'bg-emerald-100 text-emerald-700' : 'bg-[#E5DFD5] text-[#7D8C83]'}`}>
                          {hasMinLength ? <Check className="w-2.5 h-2.5" /> : '•'}
                        </span>
                        <span>{strings.auth?.passwordRequirementLength || (language === 'ar' ? '8 أحرف على الأقل' : language === 'fr' ? 'Au moins 8 caractères' : 'At least 8 characters')}</span>
                      </div>
                      <div className={`flex items-center gap-1.5 transition-colors ${hasMix ? 'text-emerald-700 font-medium' : 'text-[#7D8C83]'}`}>
                        <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${hasMix ? 'bg-emerald-100 text-emerald-700' : 'bg-[#E5DFD5] text-[#7D8C83]'}`}>
                          {hasMix ? <Check className="w-2.5 h-2.5" /> : '•'}
                        </span>
                        <span>{strings.auth?.passwordRequirementLettersNumbers || (language === 'ar' ? 'مزيج من الحروف والأرقام' : language === 'fr' ? 'Mélange de lettres et de chiffres' : 'Mix of letters and numbers')}</span>
                      </div>
                      <div className={`flex items-center gap-1.5 transition-colors ${hasMatch ? 'text-emerald-700 font-medium' : 'text-[#7D8C83]'}`}>
                        <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${hasMatch ? 'bg-emerald-100 text-emerald-700' : 'bg-[#E5DFD5] text-[#7D8C83]'}`}>
                          {hasMatch ? <Check className="w-2.5 h-2.5" /> : '•'}
                        </span>
                        <span>{strings.auth?.passwordRequirementMatch || (language === 'ar' ? 'كلمتا المرور متطابقتان' : language === 'fr' ? 'Les mots de passe correspondent' : 'Passwords match exactly')}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 bg-[#315243] hover:bg-[#253E33] disabled:opacity-60 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs mt-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <span>{strings.auth?.saveNewPasswordBtn || 'Save New Password & Continue'}</span>
                        <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* STATE 4: SUCCESS CONFIRMATION */}
              {!isLoading && isSuccess && (
                <div className="space-y-6 text-center py-2">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-base sm:text-lg font-bold text-[#1F362C] font-['Lora',serif]">
                      {strings.auth?.resetSuccessTitle || 'Password Reset Complete!'}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#5C6E64] leading-relaxed max-w-sm mx-auto">
                      Your password has been successfully updated. You can now sign in to your confidential personal space.
                    </p>
                  </div>

                  <div className="p-3.5 bg-[#F4F8F5] rounded-xl border border-[#D5E3DC] text-xs text-[#315243] flex items-center justify-center gap-2 font-medium">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Your account is safe and ready to use</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigateSignIn(targetEmail)}
                    className="w-full py-3 px-4 bg-[#315243] hover:bg-[#253E33] text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                  >
                    <span>{strings.auth?.signInBtn || 'Sign In to My Space'}</span>
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Return to Sign In link */}
          <div className="text-center mt-4">
            <button
              type="button"
              id="reset-return-to-signin-link"
              onClick={() => onNavigateSignIn(targetEmail)}
              className="text-xs text-[#5A6D63] hover:text-[#1F362C] hover:underline underline-offset-4 cursor-pointer"
            >
              Return to Sign In
            </button>
          </div>
        </div>
      </main>
    </Navbar>
  );
};
