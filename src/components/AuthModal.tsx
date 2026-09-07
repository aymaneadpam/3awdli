import { useState, type FormEvent } from 'react';
import { X, UserCheck, UserPlus, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { AuthMode } from '../types';

interface AuthModalProps {
  mode: AuthMode;
  onClose: () => void;
  onTalkAnonymously: () => void;
}

export const AuthModal = ({
  mode,
  onClose,
  onTalkAnonymously,
}: AuthModalProps) => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  if (!mode) return null;

  const isSignIn = mode === 'signin';

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/40 backdrop-blur-xs overflow-hidden"
      onClick={onClose}
    >
      <div 
        className="bg-[#FAF8F5] border border-[#E5E0D6] rounded-3xl max-w-md w-full max-h-[min(90vh,560px)] flex flex-col shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed / shrink-0 */}
        <div className="p-5 sm:p-6 pb-3 shrink-0 flex items-start justify-between border-b border-[#EBE6DD]">
          <div className="flex items-center gap-3 pr-6">
            <div className="w-11 h-11 rounded-2xl bg-[#E8F1EC] text-[#2C4A3C] flex items-center justify-center border border-[#CFDFD6] shrink-0">
              {isSignIn ? <UserCheck className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#233129]">
                {isSignIn ? 'Sign In to 3awdli' : 'Create an Account on 3awdli'}
              </h2>
              <p className="text-xs text-[#6A7870]">
                {isSignIn ? 'For returning registered members' : 'For new user profiles'}
              </p>
            </div>
          </div>

          <button
            id="close-auth-modal-btn"
            onClick={onClose}
            className="p-2 text-[#7C8780] hover:text-[#2C332F] hover:bg-[#EFECE5] rounded-xl transition-colors cursor-pointer shrink-0"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          <div className="bg-[#F3EFE8] border border-[#E4DFD5] rounded-2xl p-4 text-xs text-[#4F5B53] leading-relaxed">
            <div className="flex items-start gap-2">
              <Lock className="w-4 h-4 text-[#315243] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#25332A] mb-1">
                  Account Portal Launching in the Next Phase
                </p>
                <p>
                  Our team is currently preparing the personalized member portal. The good news: you do not need an account to be heard today! You can start speaking with a compassionate listener right away with zero registration.
                </p>
              </div>
            </div>
          </div>

          {/* Action to talk anonymously right now */}
          <div>
            <button
              id="auth-modal-talk-anonymously-btn"
              onClick={() => {
                onClose();
                onTalkAnonymously();
              }}
              className="w-full py-3 px-4 bg-[#315243] hover:bg-[#253E33] text-white text-sm font-semibold rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Talk Anonymously Right Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-center text-[11px] text-[#7B8880] mt-2">
              100% Free &bull; No username or password required &bull; Immediate connection
            </p>
          </div>
        </div>

        {/* Optional notify me - Fixed Footer / shrink-0 */}
        <div className="p-4 sm:p-5 bg-[#F6F3EC] border-t border-[#E8E3DA] shrink-0">
          <p className="text-xs text-[#525E56] font-medium mb-2">
            Want to be notified when registered accounts launch?
          </p>
          {subscribed ? (
            <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>We'll keep you updated when member profiles open.</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="flex-1 text-xs bg-white border border-[#DCD6CA] rounded-xl px-3 py-2 outline-none focus:border-[#315243] text-[#2C332F]"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-[#E6E1D7] hover:bg-[#DAD4C8] text-[#2D3831] text-xs font-semibold rounded-xl transition-colors cursor-pointer shrink-0"
              >
                Notify Me
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
