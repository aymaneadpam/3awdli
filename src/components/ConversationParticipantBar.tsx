import React, { useState } from 'react';
import { 
  ShieldCheck, 
  User, 
  UserCheck, 
  UserX, 
  Users, 
  Clock, 
  Info, 
  ChevronDown, 
  ChevronUp,
  Lock
} from 'lucide-react';
import { DiscussionConversation, DiscussionParticipant } from '../types';
import { getDiscussionParticipants } from '../utils/discussionManagement';
import { ListenerGenderIcon } from './ListenerGenderDisplay';

interface ConversationParticipantBarProps {
  discussion?: DiscussionConversation | null;
  className?: string;
  isCompact?: boolean;
  viewerId?: string | null;
  currentUserId?: string | null;
}

export const ConversationParticipantBar: React.FC<ConversationParticipantBarProps> = ({
  discussion,
  className = '',
  isCompact = false,
  viewerId,
  currentUserId,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!discussion) {
    return null;
  }

  const effectiveViewerId = viewerId || currentUserId;
  const participants: DiscussionParticipant[] = getDiscussionParticipants(discussion, effectiveViewerId);
  const activeListeners = participants.filter((p) => p.role === 'listener' && p.status === 'active');
  const excludedListeners = participants.filter((p) => p.role === 'listener' && p.status === 'excluded');
  const userParticipant = participants.find((p) => p.role === 'user');
  const isWaiting = activeListeners.length === 0;

  return (
    <div className={`bg-[#FAF7F2] border-b border-[#EAE3D6] text-xs transition-all ${className}`}>
      {/* Primary Bar Strip */}
      <div className="px-3.5 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#617267] shrink-0">
            <Users className="w-3.5 h-3.5 text-[#315243]" />
            <span>Participants:</span>
          </div>

          {/* User Profile Pill */}
          <div 
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EBF2EE] text-[#224131] border border-[#D2E3D9] text-[11px] shrink-0 font-medium"
            title={userParticipant?.isYou ? "You are in this private room" : "Participant in this private room"}
          >
            <div className="w-4 h-4 rounded-full bg-[#315243] text-white flex items-center justify-center text-[9px]">
              <User className="w-2.5 h-2.5" />
            </div>
            <span>{userParticipant?.name || (discussion.type === 'anonymous' ? 'Anonymous User' : 'Member')}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          </div>

          {/* Active Listener(s) */}
          {activeListeners.length > 0 ? (
            activeListeners.map((listener, idx) => (
              <div
                key={listener.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F0F6F2] text-[#1E3B2D] border border-[#CEE1D6] text-[11px] shrink-0 font-medium shadow-2xs"
                title={`${listener.name} - Active Listener`}
              >
                <div className="w-4 h-4 rounded-full bg-[#2E5040] text-emerald-100 flex items-center justify-center text-[9px] font-bold">
                  <UserCheck className="w-2.5 h-2.5" />
                </div>
                <span className="font-semibold text-[#183426]">{listener.name}</span>
                {idx > 0 && (
                  <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-[#DCEEE3] text-[#1C3B2B] font-medium">
                    Joined
                  </span>
                )}
                {listener.gender && <ListenerGenderIcon gender={listener.gender} />}
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Active in session"></span>
              </div>
            ))
          ) : isWaiting ? (
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] text-[11px] shrink-0">
              <Clock className="w-3 h-3 text-amber-600 animate-spin" />
              <span>Waiting for a listener to connect...</span>
            </div>
          ) : null}

          {/* Excluded Listener(s) (Marked visibly "Removed" / "No longer in this conversation") */}
          {excludedListeners.map((excluded) => (
            <div
              key={excluded.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F3EFE9] text-[#7E8B83] border border-[#DDD5C7] text-[11px] shrink-0 line-through opacity-75 decoration-[#9CA3AF]"
              title={`${excluded.name} was handed over and excluded from new messages for privacy.`}
            >
              <div className="w-4 h-4 rounded-full bg-[#9DA8A1] text-white flex items-center justify-center text-[9px]">
                <UserX className="w-2.5 h-2.5" />
              </div>
              <span className="font-medium text-[#6B7971]">{excluded.name}</span>
              <span className="no-underline inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded bg-[#E8E2D6] text-[#63483D] font-medium border border-[#D9D0C1]">
                <Lock className="w-2 h-2 text-[#7D4D3A]" />
                Removed
              </span>
            </div>
          ))}
        </div>

        {/* Toggle Details / Privacy Info */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[#64756A] hover:text-[#213C2E] p-1 rounded hover:bg-[#EFE9DF] transition-colors shrink-0 cursor-pointer flex items-center gap-1 text-[11px]"
          title="View participant privacy details"
        >
          <span className="hidden sm:inline text-[10.5px]">Who's in room?</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded Participant Breakdown & Privacy Reassurance */}
      {isExpanded && (
        <div className="px-4 py-2.5 bg-[#F5F1E8] border-t border-[#E8E1D3] text-[11px] text-[#4F5F55] space-y-2">
          <div className="flex items-center justify-between gap-2 border-b border-[#E6DECة border-[#E5DDD0] pb-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-[#1C3326]">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Room Privacy &amp; Access Transparency</span>
            </div>
            <span className="text-[10px] text-[#697B70]">Real-time encrypted connection</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Active Members Card */}
            <div className="p-2 rounded-xl bg-white border border-[#E3DBD0] space-y-1">
              <div className="text-[10.5px] font-semibold text-[#274836] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Active Participants ({activeListeners.length + (userParticipant ? 1 : 0)})</span>
              </div>
              <p className="text-[10px] text-[#637469]">
                These individuals can currently receive and read your messages:
              </p>
              <ul className="space-y-1 pt-1">
                <li className="flex items-center justify-between text-[10.5px]">
                  <span className="font-medium text-[#1E362A]">{userParticipant?.name}</span>
                  <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800">
                    {userParticipant?.isYou
                      ? (discussion.type === 'anonymous' ? 'You (Visitor)' : 'You (Member)')
                      : (discussion.type === 'anonymous' ? 'Anonymous User' : 'Member')}
                  </span>
                </li>
                {activeListeners.map((l) => (
                  <li key={l.id} className="flex items-center justify-between text-[10.5px]">
                    <div>
                      <span className="font-medium text-[#1E362A]">{l.name}</span>
                      {l.profession && (
                        <span className="text-[9.5px] text-[#67776D] block">{l.profession}</span>
                      )}
                    </div>
                    <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-[#E3EFE8] text-[#224734] font-medium">
                      {l.isYou ? 'Active Listener (You)' : 'Active Listener'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Excluded Members Card (if any) */}
            <div className="p-2 rounded-xl bg-white border border-[#E3DBD0] space-y-1">
              <div className="text-[10.5px] font-semibold text-[#664D3A] flex items-center gap-1">
                <Lock className="w-3 h-3 text-[#92400E]" />
                <span>Removed / Excluded Listeners ({excludedListeners.length})</span>
              </div>
              {excludedListeners.length > 0 ? (
                <>
                  <p className="text-[10px] text-[#715F54]">
                    Handed over: These listeners have zero access to any new messages you send.
                  </p>
                  <ul className="space-y-1 pt-1">
                    {excludedListeners.map((ex) => (
                      <li key={ex.id} className="flex items-center justify-between text-[10.5px] text-[#6C7A72]">
                        <div>
                          <span className="font-medium text-[#5B6961] line-through">{ex.name}</span>
                          <span className="text-[9px] text-[#86948C] block">
                            Excluded: {ex.excludedAt || 'Handover'}
                          </span>
                        </div>
                        <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-[#F3ECE0] text-[#7E4D36] font-medium border border-[#E3D4C4]">
                          No access to new messages
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-[10px] text-[#728277] italic pt-1">
                  No listeners have been excluded from this session.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
