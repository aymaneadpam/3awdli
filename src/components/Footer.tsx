import { Heart, Shield, AlertCircle, PhoneCall } from 'lucide-react';
import { AuthMode } from '../types';

interface FooterProps {
  onOpenAuth: (mode: AuthMode) => void;
  onTalkAnonymously: () => void;
  onOpenEmergencyModal: () => void;
}

export const Footer = ({
  onOpenAuth,
  onTalkAnonymously,
  onOpenEmergencyModal,
}: FooterProps) => {
  return (
    <footer className="border-t border-[#E8E3DA] bg-[#F4EFE7] text-[#4A574F]">
      {/* Unobtrusive, clear safety note banner as requested */}
      <div className="bg-[#EDE6DC] border-b border-[#E0D8CB] px-4 py-3 text-center text-xs text-[#5D6B63]">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2">
          <span className="flex items-center gap-1.5 font-medium text-[#7D4F40]">
            <AlertCircle className="w-4 h-4 text-[#B55941] shrink-0" />
            <span>Emergency Safety Notice:</span>
          </span>
          <span>
            This service is not for emergencies. Anyone in immediate danger should contact local emergency services immediately.
          </span>
          <button
            onClick={onOpenEmergencyModal}
            className="text-[#315243] underline font-semibold hover:text-[#1F362C] cursor-pointer ml-1"
          >
            Emergency numbers
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand & mission */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#315243] text-white flex items-center justify-center">
                <Heart className="w-4 h-4 text-emerald-200 fill-emerald-200/20" />
              </div>
              <span className="text-xl font-bold text-[#1C2C24] font-['Lora',serif]">
                3awdli
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#616F67] leading-relaxed max-w-md">
              A free, non-profit association dedicated to listening, emotional comfort, and psychological guidance. Connect with empathetic psychologists and psychology students in complete confidence.
            </p>
            <div className="flex items-center gap-3 text-xs text-[#57695F]">
              <span className="flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-emerald-700" />
                No data retention for anonymous chats
              </span>
            </div>
          </div>

          {/* Quick choices */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#2C3B33] mb-3">
              Get Support
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={onTalkAnonymously}
                  className="hover:text-[#1F362C] hover:underline cursor-pointer flex items-center gap-1.5 font-medium text-[#2F5342]"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Talk Anonymously (Instant)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenAuth('signin')}
                  className="hover:text-[#1F362C] hover:underline cursor-pointer"
                >
                  Sign In (Returning Users)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenAuth('signup')}
                  className="hover:text-[#1F362C] hover:underline cursor-pointer"
                >
                  Sign Up (New Account)
                </button>
              </li>
            </ul>
          </div>

          {/* Crisis assistance */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#2C3B33] mb-3">
              Need Urgent Help?
            </h4>
            <p className="text-xs text-[#6A7870] leading-relaxed mb-3">
              If your situation is life-threatening, reach out to professional rescue or hospital helplines right now.
            </p>
            <button
              onClick={onOpenEmergencyModal}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#EAE3D7] hover:bg-[#DDD5C7] text-[#2F3E35] transition-colors cursor-pointer"
            >
              <PhoneCall className="w-3 h-3 text-[#315243]" />
              <span>View Crisis Numbers</span>
            </button>
          </div>
        </div>

        <div className="pt-8 border-t border-[#E3DDD1] flex flex-col sm:flex-row items-center justify-between text-xs text-[#7A8780] gap-4">
          <p>
            &copy; {new Date().getFullYear()} 3awdli Association. All rights reserved. Free, safe, and confidential.
          </p>
          <p className="italic text-[#6B7971]">
            "Remind yourself that your mental health truly matters."
          </p>
        </div>
      </div>
    </footer>
  );
};
