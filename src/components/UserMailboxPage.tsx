import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Inbox, 
  CheckCheck, 
  Trash2, 
  Search, 
  ArrowLeft, 
  ShieldCheck, 
  Sparkles, 
  Clock, 
  Filter, 
  Check, 
  FileText,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  PlusCircle
} from 'lucide-react';
import { UserAccount, UserMailboxMessage } from '../types';
import { 
  getStoredUserMailboxMessages, 
  markUserMailboxMessageAsRead, 
  markUserMailboxMessageAsUnread, 
  markAllUserMailboxMessagesAsRead, 
  deleteUserMailboxMessage,
  createSampleWelcomeMessage
} from '../utils/userMailboxManagement';
import { Navbar } from './Navbar';

interface UserMailboxPageProps {
  currentUser: UserAccount;
  onNavigateHome: () => void;
  onNavigateDashboard?: () => void;
  onNavigateGames?: () => void;
  onNavigateTeenSpace?: () => void;
  onNavigateLounge?: () => void;
  onNavigateRules?: () => void;
  onNavigateSchedules?: () => void;
  onOpenEmergencyModal?: () => void;
  onOpenContactSupport?: () => void;
  onTalkAnonymously?: () => void;
  onSignOut?: () => void;
}

export const UserMailboxPage: React.FC<UserMailboxPageProps> = ({
  currentUser,
  onNavigateHome,
  onNavigateDashboard,
  onNavigateGames,
  onNavigateTeenSpace,
  onNavigateLounge,
  onNavigateRules,
  onNavigateSchedules,
  onOpenEmergencyModal,
  onOpenContactSupport,
  onTalkAnonymously,
  onSignOut,
}) => {
  const [messages, setMessages] = useState<UserMailboxMessage[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Load messages from storage
  const loadMessages = () => {
    const list = getStoredUserMailboxMessages(currentUser.id);
    setMessages(list);
  };

  useEffect(() => {
    loadMessages();

    const handleUpdate = () => {
      loadMessages();
    };

    window.addEventListener('3awdli_user_mailbox_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('3awdli_user_mailbox_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [currentUser.id]);

  // When selecting a message, mark it as read automatically
  const handleSelectMessage = (msg: UserMailboxMessage) => {
    setSelectedMessageId(msg.id);
    if (!msg.read) {
      markUserMailboxMessageAsRead(currentUser.id, msg.id);
      // Optimistically update local state
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, read: true } : m))
      );
    }
  };

  const handleToggleRead = (msgId: string, currentReadState: boolean) => {
    if (currentReadState) {
      markUserMailboxMessageAsUnread(currentUser.id, msgId);
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, read: false } : m))
      );
    } else {
      markUserMailboxMessageAsRead(currentUser.id, msgId);
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, read: true } : m))
      );
    }
  };

  const handleMarkAllRead = () => {
    markAllUserMailboxMessagesAsRead(currentUser.id);
    setMessages((prev) => prev.map((m) => ({ ...m, read: true })));
  };

  const handleDeleteMessage = (msgId: string) => {
    deleteUserMailboxMessage(currentUser.id, msgId);
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    if (selectedMessageId === msgId) {
      setSelectedMessageId(null);
    }
    setDeleteConfirmId(null);
  };

  const handleGenerateSample = () => {
    const sample = createSampleWelcomeMessage(currentUser.id, currentUser.name);
    loadMessages();
    setSelectedMessageId(sample.id);
  };

  // Filter & search
  const filteredMessages = messages.filter((m) => {
    if (filter === 'unread' && m.read) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSubject = m.subject.toLowerCase().includes(q);
      const matchSender = m.senderName.toLowerCase().includes(q);
      const matchContent = m.content.toLowerCase().includes(q);
      return matchSubject || matchSender || matchContent;
    }
    return true;
  });

  const unreadCount = messages.filter((m) => !m.read).length;
  const selectedMessage = messages.find((m) => m.id === selectedMessageId);

  // Render badge label for message type
  const getTypeBadge = (type?: string) => {
    switch (type) {
      case 'report_reply':
        return { label: 'Report Reply', bg: 'bg-[#FEF3C7]', text: 'text-[#92400E]', border: 'border-[#FDE68A]' };
      case 'support_reply':
        return { label: 'Support Response', bg: 'bg-[#EFF6FF]', text: 'text-[#1E40AF]', border: 'border-[#BFDBFE]' };
      case 'team_notice':
        return { label: 'Team Notice', bg: 'bg-[#E8F1EC]', text: 'text-[#2C4A3C]', border: 'border-[#CFDFD6]' };
      default:
        return { label: 'Message', bg: 'bg-[#F4EFE6]', text: 'text-[#4A5D4E]', border: 'border-[#E3DDCF]' };
    }
  };

  return (
    <Navbar
      currentView="user-mailbox"
      currentUser={currentUser}
      onNavigateHome={onNavigateHome}
      onNavigateDashboard={onNavigateDashboard}
      onNavigateMailbox={() => {
        setSelectedMessageId(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
      onNavigateGames={onNavigateGames}
      onNavigateTeenSpace={onNavigateTeenSpace}
      onNavigateLounge={onNavigateLounge}
      onNavigateRules={onNavigateRules}
      onNavigateSchedules={onNavigateSchedules}
      onOpenEmergencyModal={onOpenEmergencyModal}
      onOpenContactSupport={onOpenContactSupport}
      onTalkAnonymously={onTalkAnonymously}
      onSignOut={onSignOut}
    >
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Page Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-[#E8E2D8]">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#E8F1EC] text-[#2C4A3C] border border-[#CFDFD6] flex items-center justify-center shrink-0 shadow-2xs">
              <Mail className="w-6 h-6 text-[#315243]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold font-['Lora',serif] text-[#1E2E25]">
                  Mailbox
                </h1>
                {unreadCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#2E5A44] text-white shadow-2xs">
                    {unreadCount} {unreadCount === 1 ? 'unread' : 'unread'}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-[#5C6E64] mt-0.5">
                Replies to your reports, support responses, and communications from the 3awdli team.
              </p>
            </div>
          </div>

          {/* Header Quick Actions */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {unreadCount > 0 && (
              <button
                type="button"
                id="user-mailbox-mark-all-read-btn"
                onClick={handleMarkAllRead}
                className="px-3 py-1.5 rounded-xl border border-[#D5CEC2] hover:border-[#2E5A44] text-[#2E5A44] text-xs font-semibold bg-white hover:bg-[#F7F5F0] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all as read</span>
              </button>
            )}

            {/* Subtle generator button for initial testing if mailbox is empty */}
            {messages.length === 0 && (
              <button
                type="button"
                id="user-mailbox-sample-btn"
                onClick={handleGenerateSample}
                className="px-3 py-1.5 rounded-xl bg-[#2E5A44] hover:bg-[#234534] text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Welcome Note</span>
              </button>
            )}
          </div>
        </div>

        {/* Mailbox Content: Master-Detail Responsive Layout */}
        <div className="bg-white border border-[#E3DDD1] rounded-3xl overflow-hidden shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
            {/* Left Pane: Messages List (visible on desktop or on mobile when no message is opened) */}
            <div
              className={`lg:col-span-5 border-b lg:border-b-0 lg:border-r border-[#EAE5DC] flex flex-col ${
                selectedMessageId ? 'hidden lg:flex' : 'flex'
              }`}
            >
              {/* Filter Tabs & Search */}
              <div className="p-4 border-b border-[#EAE5DC] bg-[#FAF8F5]/70 space-y-3">
                {/* Tabs */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="user-mailbox-tab-all"
                    onClick={() => setFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      filter === 'all'
                        ? 'bg-[#2E5A44] text-white shadow-2xs'
                        : 'text-[#5C6E64] hover:text-[#1E2E25] hover:bg-[#EDE8DE]'
                    }`}
                  >
                    All Messages ({messages.length})
                  </button>
                  <button
                    type="button"
                    id="user-mailbox-tab-unread"
                    onClick={() => setFilter('unread')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      filter === 'unread'
                        ? 'bg-[#2E5A44] text-white shadow-2xs'
                        : 'text-[#5C6E64] hover:text-[#1E2E25] hover:bg-[#EDE8DE]'
                    }`}
                  >
                    <span>Unread</span>
                    {unreadCount > 0 && (
                      <span className="w-2 h-2 rounded-full bg-[#E05240] ring-2 ring-white"></span>
                    )}
                  </button>
                </div>

                {/* Search Input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#88958D]" />
                  <input
                    type="text"
                    id="user-mailbox-search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search messages, reports, or team..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#D8D2C5] focus:border-[#2E5A44] rounded-xl text-[#1E2E25] placeholder-[#88958D] outline-none transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[#7C8B82] hover:text-[#25332A] cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Message List Items */}
              <div className="flex-1 overflow-y-auto divide-y divide-[#EAE5DC] max-h-[620px]">
                {filteredMessages.length === 0 ? (
                  <div className="p-8 text-center my-auto">
                    <div className="w-12 h-12 rounded-2xl bg-[#F5F2EB] text-[#7A8A80] border border-[#E3DDCF] flex items-center justify-center mx-auto mb-3">
                      <Inbox className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-[#2A3B31]">
                      {filter === 'unread' ? 'No unread messages' : 'Your Mailbox is empty'}
                    </h3>
                    <p className="text-xs text-[#627269] mt-1 max-w-xs mx-auto leading-relaxed">
                      {filter === 'unread'
                        ? 'All messages from the team have been reviewed.'
                        : 'Replies to your reports and communications from the 3awdli team will appear here.'}
                    </p>
                    {messages.length === 0 && (
                      <div className="mt-4">
                        <button
                          type="button"
                          id="user-mailbox-empty-sample-btn"
                          onClick={handleGenerateSample}
                          className="px-3.5 py-2 rounded-xl bg-[#2E5A44] hover:bg-[#234534] text-white text-xs font-semibold shadow-2xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Generate Sample Welcome Note</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  filteredMessages.map((msg) => {
                    const isSelected = msg.id === selectedMessageId;
                    const badge = getTypeBadge(msg.type);

                    return (
                      <button
                        key={msg.id}
                        type="button"
                        id={`user-mailbox-item-${msg.id}`}
                        onClick={() => handleSelectMessage(msg)}
                        className={`w-full text-left p-4 transition-colors relative cursor-pointer flex flex-col gap-1.5 ${
                          isSelected
                            ? 'bg-[#F2ECE1] border-l-4 border-[#2E5A44]'
                            : msg.read
                            ? 'bg-white hover:bg-[#FAF8F5]'
                            : 'bg-[#FBFDFB] hover:bg-[#F2F8F4] font-medium'
                        }`}
                      >
                        {/* Header: Sender & Timestamp & Unread Dot */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {!msg.read && (
                              <span
                                className="w-2 h-2 rounded-full bg-[#2E5A44] shrink-0"
                                title="Unread"
                              />
                            )}
                            <span
                              className={`text-xs truncate ${
                                !msg.read ? 'font-bold text-[#1E2E25]' : 'font-semibold text-[#3D4F44]'
                              }`}
                            >
                              {msg.senderName}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#7C8B82] shrink-0 whitespace-nowrap">
                            {msg.createdAt.split('•')[0].trim()}
                          </span>
                        </div>

                        {/* Subject */}
                        <div
                          className={`text-xs sm:text-[13px] truncate ${
                            !msg.read ? 'font-bold text-[#1A2620]' : 'text-[#2D3D33]'
                          }`}
                        >
                          {msg.subject}
                        </div>

                        {/* Summary preview */}
                        <p className="text-[11.5px] text-[#63756A] line-clamp-2 leading-relaxed">
                          {msg.summary || msg.content}
                        </p>

                        {/* Bottom Tags */}
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md border font-medium ${badge.bg} ${badge.text} ${badge.border}`}
                          >
                            {badge.label}
                          </span>
                          <span className="text-[10.5px] text-[#86968D]">
                            {msg.createdAt.split('•')[1]?.trim()}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Pane: Message Reader (visible on desktop, or mobile when a message is selected) */}
            <div
              className={`lg:col-span-7 flex flex-col bg-[#FDFBF7] ${
                selectedMessageId ? 'flex' : 'hidden lg:flex'
              }`}
            >
              {selectedMessage ? (
                <div className="flex-1 flex flex-col h-full">
                  {/* Reader Header / Action Bar */}
                  <div className="p-4 sm:p-5 border-b border-[#EAE5DC] bg-white flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {/* Mobile Back Button */}
                      <button
                        type="button"
                        id="user-mailbox-back-btn"
                        onClick={() => setSelectedMessageId(null)}
                        className="lg:hidden p-1.5 rounded-xl border border-[#D5CEC2] text-[#2A3B31] hover:bg-[#FAF8F5] cursor-pointer"
                        aria-label="Back to messages list"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs text-[#6F7F75] font-medium hidden sm:inline">
                        Message Details
                      </span>
                    </div>

                    {/* Actions: Mark read/unread & Delete */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        id="user-mailbox-toggle-read-btn"
                        onClick={() => handleToggleRead(selectedMessage.id, selectedMessage.read)}
                        className="px-2.5 py-1.5 rounded-xl border border-[#D5CEC2] hover:border-[#2E5A44] text-xs text-[#2E5A44] hover:bg-[#FAF8F5] transition-colors flex items-center gap-1.5 font-medium cursor-pointer"
                        title={selectedMessage.read ? 'Mark as unread' : 'Mark as read'}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{selectedMessage.read ? 'Mark unread' : 'Mark read'}</span>
                      </button>

                      {deleteConfirmId === selectedMessage.id ? (
                        <div className="flex items-center gap-1 bg-[#FBF0EE] border border-[#EED0CA] px-2 py-1 rounded-xl">
                          <span className="text-[11px] text-[#983827] font-medium">Delete?</span>
                          <button
                            type="button"
                            id="user-mailbox-confirm-delete-btn"
                            onClick={() => handleDeleteMessage(selectedMessage.id)}
                            className="px-2 py-0.5 bg-[#983827] text-white text-[11px] rounded font-semibold cursor-pointer"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-1.5 py-0.5 text-[11px] text-[#5A675E] hover:text-[#1E2E25] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          id="user-mailbox-delete-btn"
                          onClick={() => setDeleteConfirmId(selectedMessage.id)}
                          className="p-1.5 rounded-xl border border-[#D5CEC2] hover:border-[#E05240] text-[#7C8B82] hover:text-[#E05240] hover:bg-[#FBF0EE] transition-colors cursor-pointer"
                          title="Delete message"
                          aria-label="Delete message"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Message Detail Content */}
                  <div className="p-5 sm:p-7 flex-1 overflow-y-auto space-y-6">
                    {/* Header Info */}
                    <div className="space-y-3 pb-5 border-b border-[#EAE5DC]">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <h2 className="text-xl sm:text-2xl font-bold font-['Lora',serif] text-[#1E2E25] leading-snug">
                          {selectedMessage.subject}
                        </h2>
                        {(() => {
                          const badge = getTypeBadge(selectedMessage.type);
                          return (
                            <span
                              className={`text-xs px-2.5 py-1 rounded-lg border font-semibold ${badge.bg} ${badge.text} ${badge.border}`}
                            >
                              {badge.label}
                            </span>
                          );
                        })()}
                      </div>

                      <div className="flex items-center justify-between text-xs text-[#63756A] flex-wrap gap-2 pt-1">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#E8F1EC] text-[#2C4A3C] border border-[#CFDFD6] flex items-center justify-center font-bold text-[11px]">
                            3
                          </div>
                          <div>
                            <span className="font-semibold text-[#25332A]">{selectedMessage.senderName}</span>
                            <span className="text-[#84948B] ml-1.5">to you</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11.5px] text-[#7D8C83]">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{selectedMessage.createdAt}</span>
                        </div>
                      </div>
                    </div>

                    {/* Body Text */}
                    <div className="text-xs sm:text-sm text-[#25332A] leading-relaxed whitespace-pre-line space-y-4 max-w-none">
                      {selectedMessage.content}
                    </div>

                    {/* Reassurance Footer Banner */}
                    <div className="mt-8 pt-6 border-t border-[#EAE5DC]">
                      <div className="p-4 rounded-2xl bg-[#F5F2EC] border border-[#E3DDCF] flex items-start gap-3 text-xs text-[#4F5B53] leading-relaxed">
                        <ShieldCheck className="w-4 h-4 text-[#315243] shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-[#25332A]">Confidential Communication</p>
                          <p className="text-[11.5px] text-[#5A675E] mt-0.5">
                            This message was sent directly to your account by the 3awdli team. Your identity and communications remain strictly protected under our sanctuary standards.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* No message selected placeholder */
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center my-auto">
                  <div className="w-16 h-16 rounded-3xl bg-[#F5F2EB] text-[#7A8A80] border border-[#E3DDCF] flex items-center justify-center mb-4 shadow-2xs">
                    <Mail className="w-8 h-8 text-[#55695D]" />
                  </div>
                  <h3 className="text-base font-bold font-['Lora',serif] text-[#1E2E25]">
                    Select a Message
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5C6E64] mt-1.5 max-w-sm leading-relaxed">
                    Choose any message from the list on the left to read responses, review report updates, or read guidance from our team.
                  </p>
                  {messages.length === 0 && (
                    <div className="mt-5">
                      <button
                        type="button"
                        id="user-mailbox-sample-reader-btn"
                        onClick={handleGenerateSample}
                        className="px-4 py-2.5 rounded-2xl bg-[#2E5A44] hover:bg-[#234534] text-white text-xs font-semibold shadow-xs transition-all inline-flex items-center gap-2 cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Generate Sample Welcome Note</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </Navbar>
  );
};
