import { Shield, Heart, LifeBuoy, User, Sparkles, ShieldCheck } from 'lucide-react';
import { AuthMode, UserAccount } from '../types';

interface NavbarProps {
  onOpenAuth: (mode: AuthMode) => void;
  onTalkAnonymously: () => void;
  onOpenEmergencyModal: () => void;
  currentUser?: UserAccount | null;
  onOpenDashboard?: () => void;
  onOpenDiscussions?: () => void;
  onOpenAdmin?: () => void;
}

export const Navbar = ({
  onOpenAuth,
  onTalkAnonymously,
  onOpenEmergencyModal,
  currentUser,
  onOpenDashboard,
  onOpenDiscussions,
  onOpenAdmin,
}: NavbarProps) => {
  const isListener = Boolean(currentUser?.is_listener || currentUser?.isListener || currentUser?.role === 'listener');
  const isAdmin = currentUser?.role === 'admin';

  return (
    <header className="sticky top-0 z-40 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-[#E9E4DC]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#315243] text-white flex items-center justify-center shadow-xs">
            <Heart className="w-6 h-6 text-emerald-200 fill-emerald-200/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold tracking-tight text-[#1F362C] font-['Lora',serif]">
                3awdli
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#E5EEE9] text-[#2F5342] font-medium border border-[#D0E0D7]">
                Association
              </span>
            </div>
            <p className="text-xs text-[#627068] hidden sm:block">
              Free & Confidential Mental Health Space
            </p>
          </div>
        </div>

        {/* Center / Reassurance tag */}
        <div className="hidden md:flex items-center gap-2 text-xs text-[#52635A] bg-[#F2EFE8] px-3.5 py-1.5 rounded-full border border-[#E3DDD2]">
          <Shield className="w-3.5 h-3.5 text-[#315243]" />
          <span>100% Free & Anonymous Support</span>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            id="emergency-info-nav-btn"
            onClick={onOpenEmergencyModal}
            className="flex items-center gap-1.5 text-xs text-[#7A5043] hover:text-[#5E3B30] hover:bg-[#F8EFEB] px-2.5 sm:px-3 py-2 rounded-xl transition-colors cursor-pointer"
            title="Emergency Information"
          >
            <LifeBuoy className="w-3.5 h-3.5 text-[#B65E46]" />
            <span className="hidden sm:inline">Emergency Help</span>
          </button>

          {currentUser ? (
            <div className="flex items-center gap-2">
              {/* Listener Discussions Menu Option */}
              {isListener && onOpenDiscussions && (
                <button
                  id="nav-discussions-btn"
                  onClick={onOpenDiscussions}
                  className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#244634] bg-[#E8F1EC] hover:bg-[#D9E8DF] border border-[#CADED2] px-3 py-2 rounded-xl transition-colors cursor-pointer"
                  title="Listeners Discussions Workspace"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Discussions</span>
                </button>
              )}

              {/* Admin Portal Button */}
              {isAdmin && onOpenAdmin && (
                <button
                  id="nav-admin-btn"
                  onClick={onOpenAdmin}
                  className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-[#57351F] bg-[#FBF0E4] hover:bg-[#F3E2D0] border border-[#E9D3BE] px-3 py-2 rounded-xl transition-colors cursor-pointer"
                  title="Listeners Team & Role Management"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#884B20]" />
                  <span>Admin</span>
                </button>
              )}

              <button
                id="nav-myspace-btn"
                onClick={onOpenDashboard}
                className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#224131] bg-[#F1EFEA] hover:bg-[#E6E1D7] border border-[#DCD5C8] px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
              >
                <User className="w-4 h-4 text-[#315243]" />
                <span>My Space ({currentUser.name})</span>
              </button>
            </div>
          ) : (
            <>
              <button
                id="nav-signin-btn"
                onClick={() => onOpenAuth('signin')}
                className="text-xs sm:text-sm font-medium text-[#2F3D35] hover:text-[#18231D] px-3 py-2 rounded-xl hover:bg-[#EFECE5] transition-colors cursor-pointer"
              >
                Sign In
              </button>

              <button
                id="nav-signup-btn"
                onClick={() => onOpenAuth('signup')}
                className="hidden sm:inline-block text-xs sm:text-sm font-medium text-[#2C483A] bg-[#E7F0EB] hover:bg-[#D9E7DF] border border-[#CCDCD2] px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Sign Up
              </button>
            </>
          )}

          <button
            id="nav-talk-anonymously-btn"
            onClick={onTalkAnonymously}
            className="text-xs sm:text-sm font-medium text-white bg-[#315243] hover:bg-[#253F33] px-3.5 sm:px-4 py-2 rounded-xl shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex items-center gap-1.5"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
            <span>Talk Anonymously</span>
          </button>
        </div>
      </div>
    </header>
  );
};
