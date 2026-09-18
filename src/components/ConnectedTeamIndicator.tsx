import React, { useState, useEffect, useRef } from 'react';
import { User, Star, ShieldCheck, Sparkles } from 'lucide-react';
import { UserAccount } from '../types';
import { StoredUser, isAdministrator } from '../utils/userManagement';
import { getConnectedTeamMembers } from '../utils/shareManagement';
import { ListenerGenderIcon } from './ListenerGenderDisplay';

interface ConnectedTeamIndicatorProps {
  currentUser?: UserAccount | null;
  language: string;
}

/**
 * Top bar indicator for connected team members:
 * - Visible only to Listeners, Heads of Listeners, Administrators, and Admin.
 * - Displays a small head/person icon near "Talk Openly" with a live green indicator.
 * - On hover (and on click for mobile/touch devices), opens a popover card showing
 *   everyone currently connected (online) who has one of these roles:
 *   - Username
 *   - Role (badge: Head of Listeners, Administrator, or Listener)
 *   - Profession
 *   - Gender (icon/color matching ListenerGenderDisplay)
 *   - A green dot indicating they are currently online
 */
export const ConnectedTeamIndicator: React.FC<ConnectedTeamIndicatorProps> = ({
  currentUser,
  language,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [connectedMembers, setConnectedMembers] = useState<StoredUser[]>(() => getConnectedTeamMembers());
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Sync connected members
  useEffect(() => {
    const updateMembers = () => {
      setConnectedMembers(getConnectedTeamMembers());
    };

    updateMembers();

    // Listen to real-time events
    window.addEventListener('3awdli_online_users_updated', updateMembers);
    window.addEventListener('3awdli_users_updated', updateMembers);
    window.addEventListener('storage', updateMembers);

    // Periodic refresh every 4 seconds to catch active presence
    const interval = setInterval(updateMembers, 4000);

    return () => {
      window.removeEventListener('3awdli_online_users_updated', updateMembers);
      window.removeEventListener('3awdli_users_updated', updateMembers);
      window.removeEventListener('storage', updateMembers);
      clearInterval(interval);
    };
  }, []);

  // Handle smooth hover with small debounced close
  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Small Head / Person Icon Button */}
      <button
        type="button"
        id="topbar-connected-team-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative flex items-center justify-center p-2 sm:px-2.5 sm:py-2 rounded-xl border transition-all cursor-pointer shrink-0 ${
          isOpen
            ? 'bg-[#EAE4D8] border-[#C8BFA8] text-[#1E3F2E] shadow-xs ring-2 ring-[#264634]/15'
            : 'bg-[#FAF8F5] hover:bg-[#F3EDE2] border-[#E3DDD1] text-[#244233]'
        }`}
        title={
          language === 'fr'
            ? `Membres de l'équipe connectés (${connectedMembers.length} en ligne)`
            : `Connected Team Members (${connectedMembers.length} online)`
        }
        aria-label={
          language === 'fr'
            ? 'Membres de l\'équipe connectés'
            : 'Connected Team Members'
        }
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        {/* Small head/person icon */}
        <User className="w-4 h-4 text-[#264634]" />

        {/* Live green indicator dot on the head/person icon */}
        <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5 pointer-events-none">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 ring-2 ring-white" />
        </span>
      </button>

      {/* Popover Dropdown on Hover */}
      {isOpen && (
        <div
          id="topbar-connected-team-popover"
          role="dialog"
          aria-label={language === 'fr' ? 'Membres de l\'équipe connectés' : 'Connected Team Members'}
          className="absolute right-0 top-full mt-2 w-72 sm:w-84 bg-white border border-[#E3DDD1] rounded-2xl shadow-xl p-3.5 z-50 animate-in fade-in-50 duration-150"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-[#ECE7DE] mb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#EAF3EE] text-[#1E3F2E] flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-[#264634]" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-[#1E2E25] font-['Lora',serif] leading-tight">
                  {language === 'fr' ? 'Équipe connectée' : 'Connected Team Members'}
                </h3>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                {connectedMembers.length} {language === 'fr' ? 'en ligne' : 'online'}
              </span>
            </span>
          </div>

          {/* Members List */}
          <div className="max-h-72 overflow-y-auto space-y-2 divide-y divide-[#F5EFE6]">
            {connectedMembers.length === 0 ? (
              <div className="py-4 text-center text-xs text-[#7A8C82]">
                {language === 'fr'
                  ? 'Aucun membre de l\'équipe n\'est connecté actuellement.'
                  : 'No team members are currently online.'}
              </div>
            ) : (
              connectedMembers.map((member) => {
                const isHead = Boolean(member.is_head_of_listeners);
                const isAdmin = Boolean(
                  member.role === 'admin' ||
                  member.role === 'administrator' ||
                  member.is_administrator ||
                  isAdministrator(member)
                );
                const isCurrentUser = currentUser?.id === member.id;

                return (
                  <div
                    key={member.id}
                    id={`connected-team-member-${member.id}`}
                    className="pt-2 first:pt-0 flex items-center justify-between gap-2.5"
                  >
                    {/* Left: Avatar with green dot */}
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-xl bg-[#E8EFEA] text-[#244534] font-bold text-xs flex items-center justify-center border border-[#CFDCD3]">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      {/* Green dot on avatar */}
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
                        title={language === 'fr' ? 'Actuellement en ligne' : 'Currently online'}
                        aria-label="Online"
                      />
                    </div>

                    {/* Center: Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-xs text-[#1B3226] truncate">
                          {member.name}
                        </span>
                        {isCurrentUser && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-[#EFECE5] text-[#55675D] font-medium">
                            {language === 'fr' ? 'vous' : 'you'}
                          </span>
                        )}
                        {/* Gender Icon (Blue 👨 for Male, Pink 👩 for Female) */}
                        <ListenerGenderIcon gender={member.gender || 'Male'} />
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {/* Role Badge */}
                        {isHead ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                            <span>Head of Listeners</span>
                          </span>
                        ) : isAdmin ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300">
                            <ShieldCheck className="w-2.5 h-2.5 text-emerald-700" />
                            <span>Administrator</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#EAF3EE] text-[#1E3F2E] border border-[#CFE1D6]">
                            <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                            <span>Listener</span>
                          </span>
                        )}

                        {/* Profession */}
                        {member.profession && (
                          <span className="text-[10.5px] text-[#5B6E63] truncate">
                            &bull; {member.profession}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Green dot indicator */}
                    <div className="shrink-0 flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full bg-emerald-500 shadow-2xs"
                        title={language === 'fr' ? 'En ligne' : 'Online'}
                      />
                      <span className="text-[10.5px] font-medium text-emerald-700 hidden sm:inline">
                        {language === 'fr' ? 'En ligne' : 'Online'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
