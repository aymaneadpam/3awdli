import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { 
  X, 
  Share2, 
  ArrowLeft, 
  Search, 
  Star, 
  ShieldCheck, 
  Sparkles,
  CheckCircle2, 
  Send, 
  AlertCircle,
  MessageSquare,
  Clock,
  Briefcase
} from 'lucide-react';
import { DiscussionConversation, UserAccount } from '../types';
import { getStoredUsers, StoredUser, isAdministrator } from '../utils/userManagement';
import { isUserOnline, createShareRequest, getShareRequestsForDiscussion } from '../utils/shareManagement';
import { ListenerGenderIcon } from './ListenerGenderDisplay';
import { useLanguage } from '../context/LanguageContext';

interface ShareConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  discussion: DiscussionConversation;
  currentListener: UserAccount;
}

export const ShareConversationModal = ({
  isOpen,
  onClose,
  discussion,
  currentListener,
}: ShareConversationModalProps) => {
  const { language } = useLanguage();
  const [step, setStep] = useState<'list' | 'form' | 'success'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColleague, setSelectedColleague] = useState<StoredUser | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successRecipientName, setSuccessRecipientName] = useState('');

  // Tabs: 'connected' (default), 'all', or 'existingShares'
  const [listenerFilterTab, setListenerFilterTab] = useState<'connected' | 'all' | 'existingShares'>('connected');

  // Reset to Connected Listeners whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setListenerFilterTab('connected');
      setStep('list');
      setSelectedColleague(null);
      setSearchQuery('');
      setErrorMsg(null);
    }
  }, [isOpen]);

  // Existing share requests sent for this discussion
  const existingRequests = useMemo(() => {
    return getShareRequestsForDiscussion(discussion.id);
  }, [discussion.id, step]);

  // Retrieve eligible colleagues: other listeners and higher ranked (Head of Listeners, Admin), excluding current listener
  const eligibleColleagues = useMemo(() => {
    const allUsers = getStoredUsers();
    return allUsers.filter((u) => {
      // Strictly exclude current listener
      if (u.id === currentListener.id) return false;

      // Must be a listener or higher-ranked (Head of Listeners, Admin)
      const isListener = Boolean(u.is_listener || u.isListener || u.role === 'listener');
      const isHead = Boolean(u.is_head_of_listeners);
      const isAdmin = Boolean(
        u.role === 'admin' ||
        u.role === 'administrator' ||
        u.is_administrator ||
        isAdministrator(u)
      );

      return isListener || isHead || isAdmin;
    });
  }, [currentListener.id]);

  // Connected colleagues (currently online)
  const connectedColleagues = useMemo(() => {
    return eligibleColleagues.filter((u) => isUserOnline(u.id));
  }, [eligibleColleagues]);

  // Displayed colleagues based on selected tab ('connected' or 'all')
  const displayedColleagues = useMemo(() => {
    const baseList = listenerFilterTab === 'connected' ? connectedColleagues : eligibleColleagues;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return baseList;
    return baseList.filter((u) => {
      const nameMatch = u.name.toLowerCase().includes(q);
      const profMatch = u.profession?.toLowerCase().includes(q);
      return nameMatch || profMatch;
    });
  }, [listenerFilterTab, connectedColleagues, eligibleColleagues, searchQuery]);

  if (!isOpen) return null;

  const handleSelectColleague = (user: StoredUser) => {
    setSelectedColleague(user);
    setSubject('');
    setDescription('');
    setErrorMsg(null);
    setStep('form');
  };

  const handleBackToList = () => {
    setSelectedColleague(null);
    setStep('list');
    setErrorMsg(null);
  };

  const handleClose = () => {
    setStep('list');
    setSelectedColleague(null);
    setSubject('');
    setDescription('');
    setErrorMsg(null);
    onClose();
  };

  const handleSubmitShare = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedColleague) return;

    const trimmedSubject = subject.trim();
    const trimmedDesc = description.trim();

    if (!trimmedSubject) {
      setErrorMsg('Please enter a subject for the share request.');
      return;
    }

    if (!trimmedDesc) {
      setErrorMsg('Please provide a description or context for your colleague.');
      return;
    }

    try {
      createShareRequest({
        discussionId: discussion.id,
        discussionTitle: discussion.type === 'anonymous' ? 'Anonymous Visitor Support' : `Discussion with ${discussion.userName || 'Member'}`,
        fromListenerId: currentListener.id,
        fromListenerName: currentListener.name,
        fromListenerProfession: currentListener.profession,
        fromListenerGender: currentListener.gender,
        fromListenerEmail: currentListener.email,
        toUserId: selectedColleague.id,
        toUserName: selectedColleague.name,
        toUserProfession: selectedColleague.profession,
        toUserRole: selectedColleague.is_head_of_listeners ? 'Head of Listeners' : (selectedColleague.role === 'admin' ? 'Administrator' : 'Listener'),
        toUserGender: selectedColleague.gender,
        toUserEmail: selectedColleague.email,
        subject: trimmedSubject,
        description: trimmedDesc,
      });

      setSuccessRecipientName(selectedColleague.name);
      setStep('success');
    } catch (err) {
      console.error('Failed to create share request:', err);
      setErrorMsg('An unexpected error occurred while sending the share request. Please try again.');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div className="bg-white border border-[#DDD7CB] rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#EFEBE3] bg-[#FAF8F5] shrink-0">
          <div className="flex items-center gap-2.5">
            {step === 'form' && (
              <button
                type="button"
                id="share-back-btn"
                onClick={handleBackToList}
                className="p-1.5 rounded-xl hover:bg-[#EDE7DC] text-[#4F6357] transition-colors cursor-pointer mr-0.5"
                title="Back to list"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-9 h-9 rounded-2xl bg-[#E8F2EC] text-[#244534] flex items-center justify-center shrink-0">
              <Share2 className="w-4 h-4 text-[#284C38]" />
            </div>
            <div>
              <h2 id="share-modal-title" className="text-base font-bold text-[#1C3227] font-['Lora',serif] leading-tight">
                {step === 'list' && 'Share Conversation'}
                {step === 'form' && 'Send Share Request'}
                {step === 'success' && 'Share Request Sent'}
              </h2>
              <p className="text-[11px] text-[#697B71]">
                {step === 'list' && 'Select a colleague or supervisor to share this discussion with'}
                {step === 'form' && `Sharing with ${selectedColleague?.name}`}
                {step === 'success' && 'Your request has been logged successfully'}
              </p>
            </div>
          </div>

          <button
            id="close-share-modal-btn"
            type="button"
            onClick={handleClose}
            className="text-[#788A80] hover:text-[#21352A] p-2 rounded-xl hover:bg-[#EBE5DC] transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Discussion Context Capsule */}
        <div className="px-5 py-2.5 bg-[#F4EFE6] border-b border-[#E8E1D5] flex items-center justify-between text-xs text-[#56675D] shrink-0">
          <div className="flex items-center gap-2 truncate">
            <MessageSquare className="w-3.5 h-3.5 text-[#305240] shrink-0" />
            <span className="truncate">
              Discussion <strong>#{discussion.id}</strong> &bull; {discussion.type === 'anonymous' ? 'Anonymous Visitor' : (discussion.userName || 'Member')}
            </span>
          </div>
          <span className="text-[11px] text-[#7A8C82] shrink-0 hidden sm:inline">
            Started: {discussion.startedAt}
          </span>
        </div>

        {/* STEP 1: COLLEAGUES LIST VIEW */}
        {step === 'list' && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* TABS: Connected Listeners | All Listeners | (optional) Existing Shares */}
            <div className="flex items-center gap-2 px-5 pt-3.5 pb-2 border-b border-[#ECE7DE] bg-white shrink-0 overflow-x-auto">
              {/* Tab 1: Connected Listeners (Default) */}
              <button
                type="button"
                id="tab-connected-listeners"
                onClick={() => setListenerFilterTab('connected')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  listenerFilterTab === 'connected'
                    ? 'bg-[#2A4B3A] text-white shadow-xs'
                    : 'bg-[#F4EFE6] text-[#55675D] hover:bg-[#EBE5DC]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                <span>Connected Listeners</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                    listenerFilterTab === 'connected'
                      ? 'bg-white/20 text-white font-bold'
                      : 'bg-[#E5DFD4] text-[#44554B]'
                  }`}
                >
                  {connectedColleagues.length}
                </span>
              </button>

              {/* Tab 2: All Listeners */}
              <button
                type="button"
                id="tab-all-listeners"
                onClick={() => setListenerFilterTab('all')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  listenerFilterTab === 'all'
                    ? 'bg-[#2A4B3A] text-white shadow-xs'
                    : 'bg-[#F4EFE6] text-[#55675D] hover:bg-[#EBE5DC]'
                }`}
              >
                <span>All Listeners</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                    listenerFilterTab === 'all'
                      ? 'bg-white/20 text-white font-bold'
                      : 'bg-[#E5DFD4] text-[#44554B]'
                  }`}
                >
                  {eligibleColleagues.length}
                </span>
              </button>

              {/* Tab 3: Existing Shares (if any) */}
              {existingRequests.length > 0 && (
                <button
                  type="button"
                  id="tab-existing-shares"
                  onClick={() => setListenerFilterTab('existingShares')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ml-auto ${
                    listenerFilterTab === 'existingShares'
                      ? 'bg-[#2A4B3A] text-white shadow-xs'
                      : 'bg-[#FAF6EE] text-[#6B7D72] hover:bg-[#EBE5DC] border border-[#E3DDD1]'
                  }`}
                >
                  <span>Existing Shares</span>
                  <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-[#E5DFD4] text-[#44554B]">
                    {existingRequests.length}
                  </span>
                </button>
              )}
            </div>

            {listenerFilterTab !== 'existingShares' ? (
              <>
                {/* Search Bar */}
                <div className="p-4 pb-3 bg-white shrink-0">
                  <div className="relative">
                    <Search className="w-4 h-4 text-[#87968D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      id="search-colleagues-input"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={
                        listenerFilterTab === 'connected'
                          ? 'Search connected listeners by name or profession...'
                          : 'Search all listeners by name or profession...'
                      }
                      className="w-full bg-[#FAF8F5] border border-[#DDD6C8] rounded-xl pl-9 pr-3.5 py-2 text-xs text-[#24352B] placeholder-[#8B9C92] outline-none focus:border-[#2C4D3C] focus:bg-white transition-colors"
                    />
                  </div>
                </div>

                {/* Colleague Cards List */}
                <div className="p-4 pt-1 overflow-y-auto flex-1 space-y-2.5 divide-y divide-[#F1EDE5]">
                  {displayedColleagues.length === 0 ? (
                    <div className="py-10 text-center text-xs text-[#6F8076] space-y-2.5">
                      <p>
                        {listenerFilterTab === 'connected'
                          ? (searchQuery
                              ? 'No connected listeners match your search.'
                              : 'No other listeners are currently connected online.')
                          : (searchQuery
                              ? 'No colleagues match your search.'
                              : 'No eligible colleagues found.')}
                      </p>
                      {listenerFilterTab === 'connected' && eligibleColleagues.length > 0 && !searchQuery && (
                        <button
                          type="button"
                          onClick={() => setListenerFilterTab('all')}
                          className="px-3.5 py-1.5 rounded-xl bg-[#2A4B3A] text-white text-xs font-semibold hover:bg-[#1E362A] transition-all cursor-pointer shadow-xs"
                        >
                          View All Listeners ({eligibleColleagues.length})
                        </button>
                      )}
                    </div>
                  ) : (
                    displayedColleagues.map((colleague) => {
                      const online = isUserOnline(colleague.id);
                      const isHead = Boolean(colleague.is_head_of_listeners);
                      const isAdmin = Boolean(
                        colleague.role === 'admin' ||
                        colleague.role === 'administrator' ||
                        colleague.is_administrator ||
                        isAdministrator(colleague)
                      );

                      return (
                        <div
                          key={colleague.id}
                          id={`colleague-card-${colleague.id}`}
                          onClick={() => handleSelectColleague(colleague)}
                          className="pt-2.5 first:pt-0 group flex items-center justify-between gap-3 p-3 rounded-2xl hover:bg-[#F6F3ED] border border-transparent hover:border-[#DDD7CB] transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Avatar with Online Green Dot (only if online) */}
                            <div className="relative shrink-0">
                              <div className="w-10 h-10 rounded-2xl bg-[#E8EFEA] text-[#244534] font-bold text-sm flex items-center justify-center border border-[#CFDCD3]">
                                {colleague.name.charAt(0).toUpperCase()}
                              </div>
                              {/* Online indicator: green dot if online; no dot if offline */}
                              {online && (
                                <span 
                                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white shadow-2xs"
                                  title="Currently Online"
                                  aria-label="Online"
                                />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-xs sm:text-sm text-[#1B3226] truncate group-hover:text-[#184630]">
                                  {colleague.name}
                                </span>

                                {/* Rank / Role Badge */}
                                {isHead ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                                    <Star className="w-2.5 h-2.5 text-amber-600 fill-amber-500" />
                                    Head of Listeners
                                  </span>
                                ) : isAdmin ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0">
                                    <ShieldCheck className="w-2.5 h-2.5 text-emerald-700" />
                                    Administrator
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-[#EAF3EE] text-[#1E3F2E] border border-[#CFE1D6] shrink-0">
                                    <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                                    Listener
                                  </span>
                                )}

                                {/* Gender Icon: Blue man emoji for Male, Pink woman emoji for Female */}
                                <ListenerGenderIcon gender={colleague.gender || 'Male'} />
                              </div>

                              {/* Profession */}
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-[#58695F]">
                                <span className="truncate">
                                  {colleague.profession || 'Psychology Support Specialist'}
                                </span>
                              </div>

                              {/* Status text: green dot only for online; no dot for offline */}
                              <div className="text-[10.5px] mt-0.5 flex items-center gap-1.5">
                                {online ? (
                                  <>
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shadow-2xs" />
                                    <span className="text-emerald-700 font-medium">Online now</span>
                                  </>
                                ) : (
                                  <span className="text-[#88998F]">Offline</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-xl bg-white group-hover:bg-[#2B4E3C] text-[#335342] group-hover:text-white border border-[#D5CFC3] group-hover:border-[#2B4E3C] text-xs font-semibold transition-all shrink-0 shadow-2xs"
                          >
                            Select
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              /* TAB: ALREADY SENT SHARE REQUESTS */
              <div className="p-5 overflow-y-auto flex-1 space-y-3">
                <h3 className="text-xs font-bold text-[#2A4335] uppercase tracking-wider">
                  Sent Requests for this conversation
                </h3>
                {existingRequests.map((req) => (
                  <div 
                    key={req.id} 
                    className="p-3.5 bg-[#FAF8F5] border border-[#E4DDD0] rounded-2xl space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-semibold text-[#1C3227]">
                        <span>To: {req.toUserName}</span>
                        <ListenerGenderIcon gender={req.toUserGender} />
                      </div>
                      <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium border border-amber-200">
                        {req.status}
                      </span>
                    </div>
                    <div className="font-medium text-[#2E493B]">
                      {req.subject}
                    </div>
                    <p className="text-[#596B61] line-clamp-2 text-[11.5px]">
                      {req.description}
                    </p>
                    <div className="text-[10.5px] text-[#7E8F84] flex items-center gap-1 pt-1 border-t border-[#EFE9DF]">
                      <Clock className="w-3 h-3" />
                      <span>Sent: {req.createdAt}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: FORM VIEW */}
        {step === 'form' && selectedColleague && (
          <form onSubmit={handleSubmitShare} className="flex flex-col flex-1 min-h-0">
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* Selected Colleague Banner */}
              <div className="p-3.5 bg-[#F2F7F4] border border-[#CEE2D6] rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-2xl bg-white text-[#254535] font-bold text-sm flex items-center justify-center border border-[#B8D3C3]">
                      {selectedColleague.name.charAt(0)}
                    </div>
                    {isUserOnline(selectedColleague.id) && (
                      <span 
                        className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white"
                        title="Online"
                      />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-bold text-[#1C3328] truncate">
                        {selectedColleague.name}
                      </span>
                      {selectedColleague.is_head_of_listeners && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          Head of Listeners
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#4F6457]">
                      <span className="truncate">{selectedColleague.profession || 'Psychology Support Specialist'}</span>
                      <ListenerGenderIcon gender={selectedColleague.gender || 'Male'} />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleBackToList}
                  className="text-xs text-[#2A4F3C] font-semibold underline hover:text-[#183526] shrink-0 cursor-pointer"
                >
                  Change
                </button>
              </div>

              {/* Error Banner */}
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Subject Input */}
              <div>
                <label 
                  htmlFor="share-subject-input"
                  className="block text-xs font-semibold text-[#293E32] mb-1.5"
                >
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  id="share-subject-input"
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="e.g. Seeking second opinion on bereavement / panic attack symptoms..."
                  className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-[#D5CEC2] text-xs sm:text-sm text-[#223329] placeholder-[#8F9E96] outline-none focus:border-[#2C4D3C] focus:ring-2 focus:ring-[#2C4D3C]/10 transition-all"
                />
              </div>

              {/* Description Input */}
              <div>
                <label 
                  htmlFor="share-description-input"
                  className="block text-xs font-semibold text-[#293E32] mb-1.5"
                >
                  Description &amp; Context <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="share-description-input"
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Provide background, specific moments from the discussion, or questions you want your colleague to review..."
                  className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-[#D5CEC2] text-xs sm:text-sm text-[#223329] placeholder-[#8F9E96] outline-none focus:border-[#2C4D3C] focus:ring-2 focus:ring-[#2C4D3C]/10 transition-all resize-none"
                />
                <p className="text-[11px] text-[#7C8E84] mt-1">
                  Your colleague will receive this request along with linked access to review this discussion.
                </p>
              </div>
            </div>

            {/* Form Footer */}
            <div className="p-4 border-t border-[#EFEAE1] bg-[#FAF8F5] flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleBackToList}
                className="px-4 py-2 rounded-xl border border-[#D4CDC1] text-xs font-semibold text-[#55675D] hover:bg-[#EFEAE2] transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                id="submit-share-request-btn"
                className="px-5 py-2 rounded-xl bg-[#284C3A] hover:bg-[#1E3A2C] text-white text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Share Request</span>
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: SUCCESS VIEW */}
        {step === 'success' && (
          <div className="p-6 text-center space-y-4 my-auto">
            <div className="w-14 h-14 rounded-3xl bg-[#E8F3ED] text-[#254B37] flex items-center justify-center mx-auto border border-[#BED7CA] shadow-2xs">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>

            <div>
              <h3 className="text-base font-bold text-[#1C3227] font-['Lora',serif]">
                Share Request Sent!
              </h3>
              <p className="text-xs text-[#5D6F64] mt-1 max-w-sm mx-auto leading-relaxed">
                Your share request for Discussion #{discussion.id} was successfully dispatched to <strong>{successRecipientName}</strong>.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep('list');
                  setSelectedColleague(null);
                  setSubject('');
                  setDescription('');
                }}
                className="px-4 py-2 rounded-xl border border-[#D4CEC2] text-xs font-semibold text-[#4F6257] hover:bg-[#F2ECE3] transition-colors cursor-pointer"
              >
                Share with Another
              </button>
              <button
                type="button"
                id="done-share-btn"
                onClick={handleClose}
                className="px-5 py-2 rounded-xl bg-[#284C3A] hover:bg-[#1E3A2C] text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
