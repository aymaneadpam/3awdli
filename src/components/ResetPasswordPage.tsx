import React from 'react';
import { 
  KeyRound, 
  ArrowRight, 
  ShieldCheck, 
  Mail,
  Home
} from 'lucide-react';
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
  token: _token,
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
  const { strings } = useLanguage();

  return (
    <Navbar
      currentView="reset-password"
      onNavigateHome={onNavigateHome}
      onNavigateGames={onNavigateGames}
      onNavigateTeenSpace={onNavigateTeenSpace}
      onNavigateLounge={onNavigateLounge}
      onNavigateRules={onNavigateRules}
      onNavigateSchedules={onNavigateSchedules}
      onOpenAuth={() => onNavigateSignIn(initialEmail)}
      onOpenContactSupport={onOpenContactSupport}
      onOpenEmergencyModal={onOpenEmergencyModal}
      onTalkAnonymously={onTalkAnonymously}
    >
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6 sm:my-10">
        <div className="max-w-md w-full">
          <div className="bg-white border border-[#E3DDD1] rounded-3xl p-6 sm:p-8 shadow-xs">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-[#F0ECE3] text-[#2C4537] flex items-center justify-center mx-auto mb-3 border border-[#E0D8CB]">
                <KeyRound className="w-6 h-6 text-[#315243]" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold font-['Lora',serif] text-[#1E2E25]">
                {strings.auth?.resetModalTitle || 'Password Reset'}
              </h1>
              <p className="text-xs sm:text-sm text-[#5C6E64] mt-2 leading-relaxed">
                Password resets are handled securely through the link sent to your registered email address.
              </p>
            </div>

            {/* Reassuring sanctuary card */}
            <div className="space-y-4">
              <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#EAE3D6] space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <Mail className="w-4 h-4 text-[#315243] shrink-0 mt-0.5" />
                  <div className="text-xs text-[#526359] leading-relaxed">
                    If you requested a password reset, please check your inbox (and spam folder) and click the link in the email to securely choose your new password.
                  </div>
                </div>
                <div className="flex items-start gap-2.5 pt-2 border-t border-[#EAE3D6]">
                  <ShieldCheck className="w-4 h-4 text-[#315243] shrink-0 mt-0.5" />
                  <div className="text-xs text-[#526359] leading-relaxed">
                    Once you set your new password through the link, return here and sign in.
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  id="reset-go-to-signin-btn"
                  onClick={() => onNavigateSignIn(initialEmail)}
                  className="w-full py-3 px-4 bg-[#315243] hover:bg-[#253E33] text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                >
                  <span>{strings.auth?.signInBtn || 'Go to Sign In'}</span>
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </button>

                <button
                  type="button"
                  id="reset-go-to-home-btn"
                  onClick={onNavigateHome}
                  className="w-full py-2.5 px-4 bg-transparent hover:bg-[#FAF8F5] text-[#55675D] hover:text-[#1E2E25] text-xs font-medium rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Return to Home</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </Navbar>
  );
};
