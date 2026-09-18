import React, { useState, useEffect, useMemo } from 'react';
import { 
  Coffee, 
  Sparkles, 
  Plus, 
  Clock, 
  ArrowLeft, 
  Calendar, 
  DoorOpen, 
  PenTool, 
  Edit3, 
  Trash2, 
  ShieldCheck, 
  ChevronRight, 
  BookOpen, 
  CheckCircle2,
  X,
  AlertCircle,
  Radio,
  LogIn,
  UserPlus,
  EyeOff,
  RotateCcw,
  Archive
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Navbar } from './Navbar';
import { LoungeQueueScreen } from './LoungeQueueScreen';
import { LoungeChatRoom } from './LoungeChatRoom';
import { LoungeArticle, UserAccount, ViewState } from '../types';
import { 
  getStoredLoungeArticles, 
  createLoungeArticle, 
  updateLoungeArticle, 
  deleteLoungeArticle, 
  hideLoungeArticle,
  republishLoungeArticle,
  getPublicLoungeArticles,
  getHiddenLoungeArticles,
  getLoungeScheduleStatus,
  formatScheduledDateTime,
  sortLoungeArticles 
} from '../utils/loungeManagement';
import { isAdministrator, isExpertFacilitator } from '../utils/userManagement';
import { RichTextEditor } from './RichTextEditor';
import { RichTextRenderer } from './RichTextRenderer';

interface LoungePageProps {
  currentUser?: UserAccount | null;
  onNavigateHome: () => void;
  onNavigateDashboard: () => void;
  onNavigateDiscussions: (tab?: 'unopened' | 'mailbox') => void;
  onNavigateAdmin?: () => void;
  onNavigateMemberManagement?: () => void;
  onNavigateGames: () => void;
  onNavigateTeenSpace?: () => void;
  onNavigateRules?: () => void;
  onNavigateMailbox?: () => void;
  onNavigateSignIn?: () => void;
  onNavigateSignUp?: () => void;
  onOpenEmergencyModal: () => void;
  onOpenContactSupport: () => void;
  onTalkAnonymously: () => void;
  onSignOut: () => void;
}

type LoungeSubView = 'lobby' | 'reader' | 'editor' | 'queue' | 'room';

export const LoungePage: React.FC<LoungePageProps> = ({
  currentUser,
  onNavigateHome,
  onNavigateDashboard,
  onNavigateDiscussions,
  onNavigateAdmin,
  onNavigateMemberManagement,
  onNavigateGames,
  onNavigateTeenSpace,
  onNavigateRules,
  onNavigateMailbox,
  onNavigateSignIn,
  onNavigateSignUp,
  onOpenEmergencyModal,
  onOpenContactSupport,
  onTalkAnonymously,
  onSignOut,
}) => {
  const { language } = useLanguage();
  const [subView, setSubView] = useState<LoungeSubView>('lobby');
  const [articles, setArticles] = useState<LoungeArticle[]>(() => getStoredLoungeArticles());
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);

  // Live timer for countdown updates (ticks every second)
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Administrator Editor Form State
  const [formTitle, setFormTitle] = useState<string>('');
  const [formContent, setFormContent] = useState<string>('');
  const [formDateTime, setFormDateTime] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Auth requirement prompt for anonymous users clicking "Join the Lounge"
  const [showAnonymousJoinModal, setShowAnonymousJoinModal] = useState<boolean>(false);

  const isUserAdministrator = isAdministrator(currentUser);
  const isUserFounder = isUserAdministrator; // backward-compatible alias
  const isUserFacilitator = isExpertFacilitator(currentUser);
  const canManageLounge = isUserAdministrator || isUserFacilitator;
  const canAccessHiddenArticles = canManageLounge;

  // Active tab within Lounge: 'public' (normal lobby) vs 'hidden' (hidden articles, visible only to Founder & Facilitators)
  const [lobbyTab, setLobbyTab] = useState<'public' | 'hidden'>('public');

  // Article pending deletion confirmation modal (Founder delete action)
  const [articlePendingDelete, setArticlePendingDelete] = useState<LoungeArticle | null>(null);

  // Temporary action toast notification
  const [actionToast, setActionToast] = useState<{ message: string; type?: 'success' | 'info' } | null>(null);

  const showToast = (message: string) => {
    setActionToast({ message, type: 'success' });
    setTimeout(() => {
      setActionToast(null);
    }, 4000);
  };

  // Handle Join the Lounge click: authenticated users go to queue, guests get sign in prompt
  const handleJoinLounge = (article: LoungeArticle) => {
    if (!currentUser) {
      setShowAnonymousJoinModal(true);
      return;
    }
    setSelectedArticleId(article.id);
    setSubView('queue');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Live timer interval: ticks every 1000ms for exact live second-by-second countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen to updates in stored articles
  useEffect(() => {
    const handleUpdate = () => {
      setArticles(getStoredLoungeArticles());
    };
    window.addEventListener('3awdli_lounge_articles_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('3awdli_lounge_articles_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Public articles (non-hidden): this is what normal visitors and public lobby see
  const publicArticles = useMemo(() => {
    return articles.filter((a) => !a.is_hidden);
  }, [articles]);

  // Hidden articles: preserved deleted articles, accessible exclusively by Founder & Host
  const hiddenArticles = useMemo(() => {
    return articles.filter((a) => Boolean(a.is_hidden));
  }, [articles]);

  // Sorted public articles based on live schedule status:
  // 1. Currently OPEN lounges at the very top (above all others).
  // 2. Upcoming sessions (soonest scheduled closest to top).
  // 3. Past / older sessions at the bottom.
  const sortedArticles = useMemo(() => {
    return sortLoungeArticles(publicArticles, currentTime);
  }, [publicArticles, currentTime]);

  // Sorted hidden articles (most recently hidden or updated first)
  const sortedHiddenArticles = useMemo(() => {
    return [...hiddenArticles].sort((a, b) => {
      const timeA = a.hiddenAtTimestamp || a.updatedAtTimestamp || a.createdAtTimestamp;
      const timeB = b.hiddenAtTimestamp || b.updatedAtTimestamp || b.createdAtTimestamp;
      return timeB - timeA;
    });
  }, [hiddenArticles]);

  // Live detection of currently open lounge article (only searches public, active articles)
  const currentlyOpenArticle = useMemo(() => {
    return (
      sortedArticles.find((a) => {
        const status = getLoungeScheduleStatus(
          a.scheduledOpeningTimestamp,
          currentTime,
          a.durationMinutes,
          a.isClosed
        );
        return status.isOpen;
      }) || null
    );
  }, [sortedArticles, currentTime]);

  // The active article currently being read
  const activeArticle = useMemo(() => {
    if (!selectedArticleId) return null;
    return articles.find((a) => a.id === selectedArticleId) || null;
  }, [articles, selectedArticleId]);

  // The article currently being edited
  const editingArticle = useMemo(() => {
    if (!editingArticleId) return null;
    return articles.find((a) => a.id === editingArticleId) || null;
  }, [articles, editingArticleId]);

  // Open article in full reader view
  const handleOpenArticle = (id: string) => {
    setSelectedArticleId(id);
    setSubView('reader');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Open editor for creating a new article
  const handleOpenCreate = () => {
    setEditingArticleId(null);
    setFormTitle('');
    setFormContent('');
    // Default scheduled time to 2 hours from now formatted for datetime-local
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const defaultLocalTime = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}T${pad(future.getHours())}:${pad(future.getMinutes())}`;
    setFormDateTime(defaultLocalTime);
    setFormError(null);
    setSubView('editor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Open editor for editing an existing article
  const handleOpenEdit = (article: LoungeArticle, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingArticleId(article.id);
    setFormTitle(article.title);
    setFormContent(article.content);
    
    // Format existing scheduled timestamp into datetime-local string
    const d = new Date(article.scheduledOpeningTimestamp || article.scheduledOpening);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const localStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setFormDateTime(localStr);
    setFormError(null);
    setSubView('editor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Trigger Founder delete confirmation modal
  const handleDeleteArticleClick = (article: LoungeArticle, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setArticlePendingDelete(article);
  };

  // Confirm delete article -> moves to Hidden Articles instead of permanent erasure
  const handleConfirmDelete = async () => {
    if (!articlePendingDelete) return;
    const target = articlePendingDelete;
    setArticlePendingDelete(null);

    await deleteLoungeArticle(target.id, currentUser?.id);

    if (selectedArticleId === target.id) {
      setSelectedArticleId(null);
      setSubView('lobby');
    }

    showToast(`"${target.title}" removed from public Lobby and moved to Hidden Articles.`);
  };

  // Re-publish a hidden article back to public Lobby list
  const handleRepublishArticle = async (article: LoungeArticle, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    await republishLoungeArticle(article.id);
    showToast(`"${article.title}" re-published! It is now live in the public Lobby.`);
  };

  // Save or update article
  const handleSaveArticle = async (e: React.FormEvent, republishImmediately: boolean = false) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!formTitle.trim()) {
      setFormError('Please provide an article title.');
      return;
    }
    if (!formContent.trim()) {
      setFormError('Please write the article content.');
      return;
    }
    if (!formDateTime) {
      setFormError('Please select a scheduled date and time for the lounge opening.');
      return;
    }

    const scheduledDate = new Date(formDateTime);
    if (isNaN(scheduledDate.getTime())) {
      setFormError('Invalid scheduled date and time format.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const scheduledTimestamp = scheduledDate.getTime();
      const scheduledIso = scheduledDate.toISOString();

      if (editingArticleId) {
        await updateLoungeArticle(editingArticleId, {
          title: formTitle.trim(),
          content: formContent.trim(),
          scheduledOpening: scheduledIso,
          scheduledOpeningTimestamp: scheduledTimestamp,
        });

        if (republishImmediately) {
          await republishLoungeArticle(editingArticleId);
          showToast('Article updated and re-published to the public Lobby!');
        } else {
          showToast('Article changes saved successfully.');
        }

        setSelectedArticleId(editingArticleId);
        setSubView('reader');
      } else {
        const created = await createLoungeArticle(
          {
            title: formTitle.trim(),
            content: formContent.trim(),
            scheduledOpening: scheduledIso,
            scheduledOpeningTimestamp: scheduledTimestamp,
          },
          currentUser
        );
        setSelectedArticleId(created.id);
        setSubView('reader');
        showToast('New article published and scheduled!');
      }
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save article. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Formatted date preview for editor
  const previewScheduledFormatted = useMemo(() => {
    if (!formDateTime) return null;
    const d = new Date(formDateTime);
    if (isNaN(d.getTime())) return null;
    return formatScheduledDateTime(d.getTime());
  }, [formDateTime]);

  return (
    <Navbar
      currentView="lounge"
      currentUser={currentUser}
      onNavigateHome={onNavigateHome}
      onNavigateDashboard={onNavigateDashboard}
      onNavigateDiscussions={onNavigateDiscussions}
      onNavigateAdmin={onNavigateAdmin}
      onNavigateMemberManagement={onNavigateMemberManagement}
      onNavigateGames={onNavigateGames}
      onNavigateTeenSpace={onNavigateTeenSpace}
      onNavigateRules={onNavigateRules}
      onNavigateMailbox={onNavigateMailbox}
      onNavigateLounge={() => {
        setSubView('lobby');
        setSelectedArticleId(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
      onOpenEmergencyModal={onOpenEmergencyModal}
      onOpenContactSupport={onOpenContactSupport}
      onTalkAnonymously={onTalkAnonymously}
      onSignOut={onSignOut}
    >
      <div className="flex-1 py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full font-['Plus_Jakarta_Sans',sans-serif]">
        
        {/* ================================================================ */}
        {/* SUBVIEW: 1. THE LOBBY PAGE                                       */}
        {/* ================================================================ */}
        {subView === 'lobby' && (
          <div id="lounge-lobby-view" className="space-y-8">
            {/* Header Banner */}
            <div className="bg-gradient-to-br from-[#F4EFE6] via-[#FAF7F2] to-[#ECE5D8] border border-[#E3DBD0] rounded-3xl p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E5EEE9] text-[#254233] text-xs font-semibold border border-[#CEE0D6]">
                    <Coffee className="w-3.5 h-3.5 text-[#315243]" />
                    <span>{language === 'ar' ? 'الصالون' : language === 'fr' ? 'Le Salon' : 'The Lounge'}</span>
                    {isUserAdministrator ? (
                      <span className="ms-1 px-2 py-0.5 rounded-full bg-[#2A4C3B] text-white text-[10px] font-bold">
                        {language === 'ar' ? 'صلاحية الإدارة' : language === 'fr' ? 'Accès Administrateur' : 'Administrator Access'}
                      </span>
                    ) : isUserFacilitator ? (
                      <span className="ms-1 px-2 py-0.5 rounded-full bg-amber-700 text-white text-[10px] font-bold">
                        {language === 'ar' ? 'ميسر خبير' : language === 'fr' ? 'Facilitateur Expert' : 'Expert Facilitator'}
                      </span>
                    ) : null}
                  </div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-[#182C22] font-['Lora',serif] tracking-tight">
                    {language === 'ar' ? 'الصالون' : language === 'fr' ? 'Le Salon' : 'The Lounge'}
                  </h1>
                  <p className="text-sm sm:text-base text-[#57695F] max-w-2xl leading-relaxed">
                    {language === 'ar'
                      ? 'مقالات تأملية وحلقات حوارية مجدولة مباشرة يقدمها مسؤولو المنصة والميسرون الخبراء. استكشف الجلسات القادمة، وتابع العد التنازلي المباشر، وانضم فور فتح الأبواب.'
                      : language === 'fr'
                      ? 'Articles de réflexion et cercles de discussion programmés animés par les Administrateurs et Facilitateurs Experts. Explorez les sessions à venir et participez dès l’ouverture.'
                      : 'Reflective articles and scheduled live circles hosted by the platform’s Administrators & Expert Facilitators. Explore upcoming sessions, watch live countdowns, and join as doors open.'}
                  </p>
                </div>

                {/* Administrator & Expert Facilitator "Write New Article" Action */}
                {canManageLounge && (
                  <button
                    type="button"
                    id="administrator-write-article-btn"
                    onClick={handleOpenCreate}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#28493A] hover:bg-[#1E372B] text-white font-medium text-sm transition-all shadow-sm hover:shadow-md cursor-pointer shrink-0"
                  >
                    <PenTool className="w-4 h-4 text-emerald-200" />
                    <span>{language === 'ar' ? 'كتابة مقال' : language === 'fr' ? 'Rédiger un article' : 'Write Article'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* 
              SPECIAL ANNOUNCEMENT BANNER:
              - If a lounge is currently open: shows "A lounge is open!" and clicking takes user directly to that article.
              - If no lounge is currently open: shows "No lounge is open for now" in the same spot, not clickable.
              - Updates automatically/live as lounges open and close without page refresh.
            */}
            {currentlyOpenArticle ? (
              <div
                id="lounge-announcement-banner-open"
                onClick={() => handleOpenArticle(currentlyOpenArticle.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOpenArticle(currentlyOpenArticle.id);
                  }
                }}
                className="group relative overflow-hidden bg-gradient-to-r from-[#EAF6EF] via-[#F0F9F3] to-[#E3F4EA] border-2 border-[#76C596] hover:border-[#3CA86A] rounded-3xl p-5 sm:p-6 transition-all shadow-xs hover:shadow-md cursor-pointer ring-2 ring-[#76C596]/25"
                title={language === 'ar' ? 'الصالون مفتوح حالياً! اضغط لدخول الجلسة' : language === 'fr' ? 'Un salon est actuellement ouvert ! Cliquez pour entrer dans la session' : 'A lounge is currently open! Click to enter this session'}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                    <div className="relative flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#1C5B39] text-white shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                      <Radio className="w-5 h-5 text-emerald-200" />
                      <span className="absolute -top-1 -end-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#185334]">
                          {language === 'ar' ? 'حلقة مباشرة' : language === 'fr' ? 'Cercle en direct' : 'Live Circle'}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#D1EFE0] text-[#144C2F] text-[10px] font-extrabold shadow-2xs">
                          {language === 'ar' ? 'الأبواب مفتوحة الآن' : language === 'fr' ? 'Portes ouvertes maintenant' : 'Doors Open Now'}
                        </span>
                      </div>
                      <h2 className="text-base sm:text-lg lg:text-xl font-bold text-[#143B27] font-['Lora',serif] group-hover:text-[#0C291B] transition-colors leading-snug">
                        {language === 'ar' ? 'الصالون مفتوح الآن!' : language === 'fr' ? 'Un salon est ouvert !' : 'A lounge is open!'}
                      </h2>
                      <p className="text-xs sm:text-sm text-[#3E654E] truncate max-w-xl mt-0.5">
                        {currentlyOpenArticle.title}
                      </p>
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#205E3C] text-white text-xs sm:text-sm font-semibold group-hover:bg-[#16462C] transition-all shadow-2xs shrink-0">
                    <span>{language === 'ar' ? 'دخول الصالون المفتوح' : language === 'fr' ? 'Entrer dans le salon ouvert' : 'Enter Open Lounge'}</span>
                    <ChevronRight className="w-4 h-4 text-emerald-200 group-hover:translate-x-0.5 transition-transform rtl:rotate-180" />
                  </div>
                </div>
              </div>
            ) : (
              <div
                id="lounge-announcement-banner-closed"
                className="bg-[#FAF7F2] border border-[#E3DACB] rounded-3xl p-5 sm:p-6 transition-colors cursor-default select-none"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                    <div className="flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#EBE3D5] text-[#63756B] shrink-0">
                      <Clock className="w-5 h-5 text-[#63756B]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#798C81]">
                          {language === 'ar' ? 'حالة الصالون' : language === 'fr' ? 'Statut du salon' : 'Lounge Status'}
                        </span>
                      </div>
                      <h2 className="text-base sm:text-lg font-medium text-[#46574E] font-['Lora',serif]">
                        {language === 'ar' ? 'لا يوجد صالون مفتوح حالياً' : language === 'fr' ? 'Aucun salon ouvert actuellement' : 'No lounge is open for now'}
                      </h2>
                      <p className="text-xs sm:text-sm text-[#7A8C82] mt-0.5">
                        {language === 'ar' ? 'استكشف الجلسات القادمة والعد التنازلي المباشر أدناه' : language === 'fr' ? 'Découvrez les sessions à venir et les comptes à rebours ci-dessous' : 'Explore upcoming sessions and live countdowns below'}
                      </p>
                    </div>
                  </div>

                  <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EDE6DC] text-[#5D7065] text-xs font-medium border border-[#DDD4C5]">
                    <Coffee className="w-3.5 h-3.5 text-[#6C8074]" />
                    <span>{language === 'ar' ? 'الجلسات المجدولة أدناه' : language === 'fr' ? 'Sessions programmées ci-dessous' : 'Scheduled Sessions Below'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tabs for Founder and Host to toggle between Public Lobby and Hidden Articles */}
            {canAccessHiddenArticles && (
              <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#EFE9DF] border border-[#DDD3C2] w-fit">
                <button
                  type="button"
                  id="tab-lounge-public-lobby"
                  onClick={() => setLobbyTab('public')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    lobbyTab === 'public'
                      ? 'bg-[#28493A] text-white shadow-xs'
                      : 'text-[#475C51] hover:text-[#182C22] hover:bg-white/60'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>{language === 'ar' ? 'الصالون العام' : language === 'fr' ? 'Salon Public' : 'Public Lobby'}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      lobbyTab === 'public' ? 'bg-white/20 text-white' : 'bg-[#DDD2C1] text-[#36493F]'
                    }`}
                  >
                    {sortedArticles.length}
                  </span>
                </button>

                <button
                  type="button"
                  id="tab-lounge-hidden-articles"
                  onClick={() => setLobbyTab('hidden')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    lobbyTab === 'hidden'
                      ? 'bg-[#28493A] text-white shadow-xs'
                      : 'text-[#475C51] hover:text-[#182C22] hover:bg-white/60'
                  }`}
                >
                  <EyeOff className="w-4 h-4 text-amber-500" />
                  <span>{language === 'ar' ? 'المقالات المخفية' : language === 'fr' ? 'Articles masqués' : 'Hidden Articles'}</span>
                  {hiddenArticles.length > 0 ? (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        lobbyTab === 'hidden'
                          ? 'bg-amber-400 text-amber-950'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}
                    >
                      {hiddenArticles.length}
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#86998E] font-medium">(0)</span>
                  )}
                </button>
              </div>
            )}

            {/* TAB CONTENT: HIDDEN ARTICLES (Founder & Host Only) */}
            {lobbyTab === 'hidden' && canAccessHiddenArticles ? (
              <div id="lounge-hidden-articles-section" className="space-y-4">
                {/* Header Information Card */}
                <div className="p-5 sm:p-6 rounded-3xl bg-amber-50/90 border border-amber-200/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                      <Archive className="w-5 h-5 text-amber-700" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-bold text-[#182C22] font-['Lora',serif]">
                          {language === 'ar' ? 'أرشيف المقالات المخفية' : language === 'fr' ? 'Archive des articles masqués' : 'Hidden Articles Archive'}
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-200/70 text-amber-900 text-[10px] font-bold uppercase tracking-wider">
                          {hiddenArticles.length} {language === 'ar' ? 'مقالة' : language === 'fr' ? 'article(s)' : hiddenArticles.length === 1 ? 'article' : 'articles'}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-[#5D7065] mt-0.5">
                        {language === 'ar'
                          ? 'تُنقل المقالات المحذوفة إلى هنا بدلاً من حذفها نهائياً. يمكنك مراجعتها، تعديلها، أو إعادة نشرها في أي وقت.'
                          : language === 'fr'
                          ? 'Les articles supprimés sont conservés ici. Vous pouvez les consulter, les modifier ou les republier à tout moment.'
                          : 'Any deleted article moves here instead of being permanently erased. Review, edit, or re-publish them anytime.'}
                      </p>
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold shrink-0 border border-amber-300">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                    <span>{language === 'ar' ? 'للإدارة والميسرين الخبراء فقط' : language === 'fr' ? 'Réservé aux Administrateurs et Facilitateurs' : 'Administrator & Expert Facilitator Only'}</span>
                  </div>
                </div>

                {sortedHiddenArticles.length === 0 ? (
                  <div className="text-center py-16 px-4 bg-white/70 border border-[#E9DFCF] rounded-3xl">
                    <EyeOff className="w-10 h-10 text-[#A2B3A8] mx-auto mb-3" />
                    <h3 className="text-base font-medium text-[#1E3529]">
                      {language === 'ar' ? 'لا توجد مقالات مخفية' : language === 'fr' ? 'Aucun article masqué' : 'No hidden articles'}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#6C7E74] mt-1 max-w-md mx-auto">
                      {language === 'ar'
                        ? 'عند قيام الإدارة بحذف مقال من الصالون، يُنقل إلى هنا بدلاً من حذفه نهائياً.'
                        : language === 'fr'
                        ? "Lorsqu'un administrateur supprime un article du Salon, il est déplacé ici."
                        : 'When an Administrator deletes an article from The Lounge, it moves here instead of being permanently erased.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {sortedHiddenArticles.map((article) => (
                      <div
                        key={article.id}
                        id={`hidden-article-item-${article.id}`}
                        className="rounded-2xl p-5 sm:p-6 bg-white/95 border border-amber-200/90 shadow-2xs hover:shadow-xs transition-all space-y-3"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="space-y-2.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold border border-amber-300">
                                <EyeOff className="w-3 h-3" />
                                <span>{language === 'ar' ? 'مخفي عن العامة' : language === 'fr' ? 'Masqué au public' : 'Hidden from Public'}</span>
                              </span>
                              {article.hiddenAt && (
                                <span className="text-xs text-[#7A8C81]">
                                  {language === 'ar' ? `أُخفي في ${article.hiddenAt}` : language === 'fr' ? `Masqué le ${article.hiddenAt}` : `Hidden on ${article.hiddenAt}`}
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleOpenArticle(article.id)}
                              className="text-start group/title focus:outline-none block w-full"
                            >
                              <h3 className="text-base sm:text-lg font-semibold text-[#182C22] group-hover/title:text-[#274B39] font-['Lora',serif] leading-snug transition-colors">
                                {article.title}
                              </h3>
                            </button>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-[#5E7166]">
                              <span className="inline-flex items-center gap-1 text-[#465E50] font-medium">
                                <ShieldCheck className="w-3.5 h-3.5 text-[#2E5240]" />
                                <span>{language === 'ar' ? `الكاتب: ${article.authorName}` : language === 'fr' ? `Auteur : ${article.authorName}` : `Author: ${article.authorName}`}</span>
                              </span>
                              <span className="text-[#C4BDB1]">•</span>
                              <span>{language === 'ar' ? `الموعد: ${formatScheduledDateTime(article.scheduledOpeningTimestamp)}` : language === 'fr' ? `Programmé : ${formatScheduledDateTime(article.scheduledOpeningTimestamp)}` : `Scheduled: ${formatScheduledDateTime(article.scheduledOpeningTimestamp)}`}</span>
                              <span className="text-[#C4BDB1]">•</span>
                              <span>{language === 'ar' ? `تاريخ النشر: ${article.createdAt}` : language === 'fr' ? `Publié : ${article.createdAt}` : `Originally Published: ${article.createdAt}`}</span>
                            </div>
                          </div>

                          {/* Action Buttons: View, Edit, Re-publish */}
                          <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-2 lg:pt-0">
                            <button
                              type="button"
                              id={`view-hidden-article-btn-${article.id}`}
                              onClick={() => handleOpenArticle(article.id)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F6F1E9] hover:bg-[#EBE2D4] text-[#244233] text-xs font-medium transition-colors cursor-pointer border border-[#E0D7C9]"
                              title={language === 'ar' ? 'عرض المقال كاملاً' : language === 'fr' ? "Voir l'article complet" : 'View full written article'}
                            >
                              <BookOpen className="w-3.5 h-3.5 text-[#4D6558]" />
                              <span>{language === 'ar' ? 'عرض المقال' : language === 'fr' ? "Voir l'article" : 'View Article'}</span>
                            </button>

                            <button
                              type="button"
                              id={`edit-hidden-article-btn-${article.id}`}
                              onClick={(e) => handleOpenEdit(article, e)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F0ECE3] hover:bg-[#E4DDD0] text-[#2C483A] text-xs font-medium border border-[#DCD3C4] transition-colors cursor-pointer"
                              title={language === 'ar' ? 'تعديل المقال' : language === 'fr' ? "Modifier l'article" : 'Edit article title, content, or schedule'}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>{language === 'ar' ? 'تعديل' : language === 'fr' ? 'Modifier' : 'Edit'}</span>
                            </button>

                            <button
                              type="button"
                              id={`republish-hidden-article-btn-${article.id}`}
                              onClick={(e) => handleRepublishArticle(article, e)}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#28493A] hover:bg-[#1E372B] text-white text-xs font-semibold shadow-xs hover:shadow-sm transition-all cursor-pointer"
                              title={language === 'ar' ? 'إعادة النشر إلى الصالون العام' : language === 'fr' ? 'Republier dans le salon public' : 'Re-publish to move back into the normal public Lobby list'}
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-emerald-300" />
                              <span>{language === 'ar' ? 'إعادة النشر' : language === 'fr' ? 'Republier' : 'Re-publish'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* TAB CONTENT: PUBLIC LOBBY */
              <div className="space-y-4">
                {/* Lobby List Section Header */}
                <div className="flex items-center justify-between border-b border-[#EADFCF] pb-3">
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-[#1C2F25] font-['Lora',serif]">
                      {language === 'ar' ? 'مقالات الصالون والحلقات المجدولة' : language === 'fr' ? 'Articles du Salon & Cercles Programmés' : 'Lobby Articles & Scheduled Circles'}
                    </h2>
                    <p className="text-xs sm:text-sm text-[#6A7B72]">
                      {language === 'ar' ? 'اضغط على عنوان المقال لقراءة تأملاته ونصوصه الكاملة' : language === 'fr' ? "Cliquez sur un titre d'article pour lire l'intégralité des réflexions" : 'Select an article title to read its full written reflections'}
                    </p>
                  </div>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#EDE6DC] text-[#4A5E53] border border-[#DDD3C4]">
                    {sortedArticles.length} {language === 'ar' ? 'مقال' : language === 'fr' ? 'Article(s)' : sortedArticles.length === 1 ? 'Article' : 'Articles'}
                  </span>
                </div>

                {/* 
                  THE LOBBY LIST:
                  - Sorted with any OPEN lounge at the very top.
                  - Upcoming / future sessions next (soonest first).
                  - Past / concluded sessions toward the bottom.
                  - Scheduled date/time highlighted with a clear, calm, distinct cedar-accent badge.
                  - Live countdown badge & Join the Lounge button for open sessions.
                */}
                <div className="space-y-3.5">
                  {sortedArticles.length === 0 ? (
                    <div className="text-center py-16 px-4 bg-white/70 border border-[#E9DFCF] rounded-3xl">
                      <BookOpen className="w-10 h-10 text-[#8CA095] mx-auto mb-3" />
                      <h3 className="text-base font-medium text-[#1E3529]">
                        {language === 'ar' ? 'لا توجد مقالات في الصالون بعد' : language === 'fr' ? 'Aucun article dans le Salon pour le moment' : 'No articles in the Lounge yet'}
                      </h3>
                      <p className="text-xs sm:text-sm text-[#6C7E74] mt-1">
                        {isUserAdministrator
                          ? (language === 'ar' ? 'بصفتك مديراً، اضغط على "كتابة مقال" أعلاه لجدولة أول جلسة.' : language === 'fr' ? 'En tant qu’administrateur, cliquez sur "Rédiger un article" ci-dessus pour planifier la première session.' : 'As Administrator, click "Write Article" above to schedule the first session.')
                          : (language === 'ar' ? 'سيقوم مسؤولو المنصة بنشر المقالات والجلسات المجدولة قريباً.' : language === 'fr' ? 'Les administrateurs publieront bientôt les articles et sessions programmées.' : 'Administrators will publish upcoming articles and scheduled circles soon.')}
                      </p>
                      {isUserAdministrator && (
                        <button
                          type="button"
                          onClick={handleOpenCreate}
                          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#28493A] text-white text-xs font-medium hover:bg-[#1E372B]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{language === 'ar' ? 'كتابة أول مقال' : language === 'fr' ? 'Rédiger le premier article' : 'Write First Article'}</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    sortedArticles.map((article) => {
                      const scheduleStatus = getLoungeScheduleStatus(
                        article.scheduledOpeningTimestamp,
                        currentTime,
                        article.durationMinutes,
                        article.isClosed
                      );

                      return (
                        <div
                          key={article.id}
                          id={`lounge-lobby-item-${article.id}`}
                          className={`group relative rounded-2xl p-5 sm:p-6 transition-all shadow-2xs hover:shadow-sm ${
                            scheduleStatus.isOpen
                              ? 'border-2 border-[#6BC08E] bg-gradient-to-r from-white via-white to-[#F0F8F3] ring-2 ring-[#6BC08E]/25 shadow-xs'
                              : scheduleStatus.status === 'countdown'
                              ? 'border border-[#E3DACB] bg-gradient-to-r from-white via-white to-[#FDFBF7]'
                              : scheduleStatus.isPast
                              ? 'border border-[#EAE2D7] bg-[#FAF8F5]/85 opacity-95'
                              : 'border border-[#EAE0D2] bg-white/90 hover:bg-white'
                          }`}
                        >
                          {/* Special Top Tag for Open Lounge */}
                          {scheduleStatus.isOpen && (
                            <div className="flex items-center gap-1.5 mb-2.5 text-[11px] font-bold text-[#145733] uppercase tracking-wider">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                              </span>
                              <span>{language === 'ar' ? 'مفتوح الآن — في أعلى قائمة الصالون' : language === 'fr' ? 'Ouvert maintenant — En tête du salon' : 'Open Now — Currently at top of lobby'}</span>
                            </div>
                          )}

                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            
                            {/* Title & Scheduled Opening Date/Time */}
                            <div className="space-y-2.5 min-w-0 flex-1">
                              {/* Title button - opens full article */}
                              <button
                                type="button"
                                onClick={() => handleOpenArticle(article.id)}
                                className="text-start group/title focus:outline-none block w-full"
                              >
                                <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-[#182C22] group-hover/title:text-[#274B39] font-['Lora',serif] leading-snug transition-colors">
                                  {article.title}
                                </h3>
                              </button>

                              {/* Scheduled Date & Time and Status Display */}
                              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 text-xs text-[#5E7166]">
                                {/* Author Info */}
                                <span className="inline-flex items-center gap-1 text-[#465E50] font-medium">
                                  <ShieldCheck className="w-3.5 h-3.5 text-[#2E5240]" />
                                  <span>{article.authorName}</span>
                                </span>

                                <span className="text-[#C4BDB1]">•</span>

                                {/* 
                                  SCHEDULE DISPLAY:
                                  For closed/past lounges: displays original published date.
                                  For upcoming/open lounges: displays distinct scheduled badge.
                                */}
                                {scheduleStatus.isPast ? (
                                  <span
                                    id={`article-published-${article.id}`}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F0EBE2] text-[#55695E] border border-[#DCD3C4] font-medium text-xs tracking-tight shadow-2xs"
                                    title="Published date of this concluded lounge article"
                                  >
                                    <Calendar className="w-3.5 h-3.5 text-[#72857A] shrink-0" />
                                    <span>{language === 'ar' ? `تاريخ النشر: ${article.createdAt}` : language === 'fr' ? `Publié le : ${article.createdAt}` : `Published: ${article.createdAt}`}</span>
                                  </span>
                                ) : (
                                  <span
                                    id={`article-schedule-${article.id}`}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FBF1E6] text-[#874116] border border-[#ECD1BA] font-semibold text-xs tracking-tight shadow-2xs"
                                    title="Scheduled opening date and time"
                                  >
                                    <Calendar className="w-3.5 h-3.5 text-[#A24D1C] shrink-0" />
                                    <span>{language === 'ar' ? `الموعد: ${formatScheduledDateTime(article.scheduledOpeningTimestamp)}` : language === 'fr' ? `Programmé : ${formatScheduledDateTime(article.scheduledOpeningTimestamp)}` : `Scheduled: ${formatScheduledDateTime(article.scheduledOpeningTimestamp)}`}</span>
                                  </span>
                                )}

                                {/* Live Countdown Badge: Displayed on the day the scheduled date/time arrives */}
                                {scheduleStatus.status === 'countdown' && (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFF6E5] text-[#92540D] border border-[#F3DFC1] font-bold text-xs shadow-2xs animate-pulse">
                                    <Clock className="w-3.5 h-3.5 text-[#B45309] shrink-0" />
                                    <span>{scheduleStatus.countdownText}</span>
                                  </span>
                                )}

                                {/* Live Now indicator if opened */}
                                {scheduleStatus.isOpen && (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E5F5EC] text-[#1E5736] border border-[#BCE4CC] font-bold text-xs shadow-2xs">
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                                    </span>
                                    <span>{language === 'ar' ? 'الصالون مفتوح' : language === 'fr' ? 'Le Salon est ouvert' : 'Lounge is Open'}</span>
                                  </span>
                                )}

                                {/* Session Concluded indicator if past */}
                                {scheduleStatus.isPast && (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F0EBE2] text-[#6A786F] border border-[#DCD3C4] font-medium text-xs shadow-2xs">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-[#86948B] shrink-0" />
                                    <span>{language === 'ar' ? 'اختُتمت الجلسة' : language === 'fr' ? 'Session terminée' : 'Session Concluded'}</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Right Actions: Read Article & "Join the Lounge" Button */}
                            <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-2 lg:pt-0">
                              {/* "Join the Lounge" Button: Appears when scheduled time arrives / countdown reaches 0 */}
                              {scheduleStatus.isOpen && (
                                <button
                                  type="button"
                                  id={`join-lounge-btn-${article.id}`}
                                  onClick={() => handleJoinLounge(article)}
                                  className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-[#216743] to-[#2B7A52] hover:from-[#195235] hover:to-[#246946] text-white text-xs sm:text-sm font-semibold transition-all shadow-sm hover:shadow-md cursor-pointer animate-none"
                                  title="Join the Lounge session now"
                                >
                                  <DoorOpen className="w-4 h-4 text-emerald-100" />
                                  <span>{language === 'ar' ? 'الانضمام إلى الصالون' : language === 'fr' ? 'Rejoindre le Salon' : 'Join the Lounge'}</span>
                                </button>
                              )}

                              {/* Read Article Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenArticle(article.id)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F6F1E9] hover:bg-[#EBE2D4] text-[#244233] text-xs font-medium transition-colors cursor-pointer border border-[#E0D7C9]"
                              >
                                <span>{language === 'ar' ? 'قراءة المقال' : language === 'fr' ? "Lire l'article" : 'Read Article'}</span>
                                <ChevronRight className="w-3.5 h-3.5 text-[#4D6558] rtl:rotate-180" />
                              </button>

                              {/* Editorial Actions: Edit & Delete (Delete asks for confirmation and moves to Hidden Articles) */}
                              {canManageLounge && (
                                <div className="flex items-center gap-1 ms-1 border-s border-[#E5DDD0] ps-2">
                                  <button
                                    type="button"
                                    onClick={(e) => handleOpenEdit(article, e)}
                                    className="p-2 rounded-lg text-[#617469] hover:text-[#182F23] hover:bg-[#F2ECE3] transition-colors cursor-pointer"
                                    title="Edit article"
                                    aria-label="Edit article"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    id={`founder-delete-article-${article.id}`}
                                    onClick={(e) => handleDeleteArticleClick(article, e)}
                                    className="p-2 rounded-lg text-[#889890] hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                                    title="Delete article (asks confirmation & moves to Hidden Articles)"
                                    aria-label="Delete article"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>

                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* SUBVIEW: 2. READING AN ARTICLE                                   */}
        {/* ================================================================ */}
        {subView === 'reader' && activeArticle && (
          <div id="lounge-reader-view" className="space-y-6">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                id="lounge-back-to-lobby-btn"
                onClick={() => {
                  setSubView('lobby');
                  setSelectedArticleId(null);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-[#F3EEE5] text-[#294838] border border-[#DFD8CB] text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
              >
                <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
                <span>{language === 'ar' ? 'العودة إلى صالون المنصة' : language === 'fr' ? 'Retour au salon' : 'Back to Lounge Lobby'}</span>
              </button>

              {/* Controls on reader view */}
              <div className="flex items-center gap-2">
                {canAccessHiddenArticles && (
                  <button
                    type="button"
                    id="reader-edit-article-btn"
                    onClick={() => handleOpenEdit(activeArticle)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F0ECE3] hover:bg-[#E4DDD0] text-[#2C483A] text-xs font-medium border border-[#DCD3C4] transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'تعديل المقال' : language === 'fr' ? "Modifier l'article" : 'Edit Article'}</span>
                  </button>
                )}

                {canAccessHiddenArticles && activeArticle.is_hidden && (
                  <button
                    type="button"
                    id="reader-republish-article-btn"
                    onClick={() => handleRepublishArticle(activeArticle)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#28493A] hover:bg-[#1E372B] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-emerald-300" />
                    <span>{language === 'ar' ? 'إعادة النشر إلى الصالون' : language === 'fr' ? 'Republier dans le salon' : 'Re-publish to Lobby'}</span>
                  </button>
                )}

                {canManageLounge && !activeArticle.is_hidden && (
                  <button
                    type="button"
                    id="reader-delete-article-btn"
                    onClick={(e) => handleDeleteArticleClick(activeArticle, e)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium border border-red-200 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'حذف' : language === 'fr' ? 'Supprimer' : 'Delete'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Hidden Article Notice (if article was hidden by Founder) */}
            {activeArticle.is_hidden && (
              <div
                id="reader-hidden-article-banner"
                className="p-4 sm:p-5 rounded-2xl bg-amber-50 border-2 border-amber-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <EyeOff className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-amber-950">
                      {language === 'ar' ? 'هذا المقال مخفي حالياً عن الصالون العام.' : language === 'fr' ? 'Cet article est actuellement masqué du salon public.' : 'This article is currently hidden from the public Lobby.'}
                    </p>
                    <p className="text-xs text-amber-800/90">
                      {language === 'ar'
                        ? 'لا يمكن للمستخدمين العاديين قراءة هذا المقال أو حضور جلسته المجدولة.'
                        : language === 'fr'
                        ? 'Les utilisateurs normaux ne peuvent pas voir cet article ni sa session programmée.'
                        : 'Normal users cannot view this article or its scheduled session.'}
                      {activeArticle.hiddenAt && ` (${language === 'ar' ? `أُخفي في ${activeArticle.hiddenAt}` : language === 'fr' ? `Masqué le ${activeArticle.hiddenAt}` : `Hidden on ${activeArticle.hiddenAt}`})`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  id="reader-banner-republish-btn"
                  onClick={() => handleRepublishArticle(activeArticle)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#28493A] hover:bg-[#1E372B] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-300" />
                  <span>{language === 'ar' ? 'إعادة النشر إلى الصالون العام' : language === 'fr' ? 'Republier dans le salon public' : 'Re-publish to Public Lobby'}</span>
                </button>
              </div>
            )}

            {/* Scheduled Lounge Status Banner for this Article */}
            {(() => {
              const status = getLoungeScheduleStatus(
                activeArticle.scheduledOpeningTimestamp,
                currentTime,
                activeArticle.durationMinutes,
                activeArticle.isClosed
              );
              return (
                <div
                  className={`rounded-2xl p-4 sm:p-5 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    status.isOpen
                      ? 'bg-[#EAF6EF] border-[#B7DECA]'
                      : status.status === 'countdown'
                      ? 'bg-[#FFF9EE] border-[#F2E0C4]'
                      : status.isPast
                      ? 'bg-[#FAF7F2] border-[#E5DDCE]'
                      : 'bg-[#F5EFE6] border-[#E5DDCE]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        status.isOpen
                          ? 'bg-[#266F48] text-white'
                          : status.status === 'countdown'
                          ? 'bg-[#D97706] text-white'
                          : status.isPast
                          ? 'bg-[#6D7D74] text-white'
                          : 'bg-[#436554] text-white'
                      }`}
                    >
                      {status.isOpen ? (
                        <DoorOpen className="w-5 h-5" />
                      ) : status.status === 'countdown' ? (
                        <Clock className="w-5 h-5" />
                      ) : status.isPast ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Calendar className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wider font-semibold text-[#5A6F62]">
                          {language === 'ar' ? 'حالة الجلسة المباشرة' : language === 'fr' ? 'Statut de la session en direct' : 'Live Session Status'}
                        </span>
                        {status.isOpen ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-bold">
                            {language === 'ar' ? 'مباشر الآن' : language === 'fr' ? 'En direct' : 'Live Now'}
                          </span>
                        ) : status.status === 'countdown' ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold">
                            {language === 'ar' ? 'اليوم' : language === 'fr' ? "Aujourd'hui" : 'Today'}
                          </span>
                        ) : status.isPast ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E3DCD1] text-[#4F5E56] font-medium">
                            {language === 'ar' ? 'اختُتمت' : language === 'fr' ? 'Terminée' : 'Concluded'}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm font-semibold text-[#182F24] mt-0.5">
                        {status.isOpen
                          ? (language === 'ar' ? 'أبواب الصالون مفتوحة الآن لهذه الجلسة.' : language === 'fr' ? 'Les portes du salon sont ouvertes pour cet échange.' : 'The Lounge doors are now open for this discussion.')
                          : status.status === 'countdown'
                          ? status.countdownText
                          : status.isPast
                          ? (language === 'ar' ? 'اختُتمت هذه الحلقة الحوارية المباشرة. تظل التأملات المكتوبة متاحة للقراءة.' : language === 'fr' ? 'Ce cercle en direct est terminé. Les réflexions restent disponibles.' : 'This live lounge circle has concluded. Written reflections remain open to explore.')
                          : `${language === 'ar' ? 'الموعد المجدول: ' : language === 'fr' ? 'Programmé pour le ' : 'Scheduled for '}${formatScheduledDateTime(activeArticle.scheduledOpeningTimestamp)}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {status.isOpen && (
                      <button
                        type="button"
                        id="reader-join-lounge-btn"
                        onClick={() => handleJoinLounge(activeArticle)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#216743] hover:bg-[#185335] text-white text-xs sm:text-sm font-semibold transition-all shadow-sm cursor-pointer"
                      >
                        <DoorOpen className="w-4 h-4 text-emerald-100" />
                        <span>{language === 'ar' ? 'الانضمام إلى الصالون' : language === 'fr' ? 'Rejoindre le Salon' : 'Join the Lounge'}</span>
                      </button>
                    )}

                    {/* Administrator session close/reopen control */}
                    {isUserAdministrator && (
                      <button
                        type="button"
                        onClick={async () => {
                          await updateLoungeArticle(activeArticle.id, {
                            isClosed: !activeArticle.isClosed,
                            closedAt: !activeArticle.isClosed ? new Date().toISOString() : undefined,
                          });
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/80 hover:bg-white text-[#4A5D52] text-xs font-medium border border-[#D9D0C3] transition-colors cursor-pointer"
                        title={language === 'ar' ? 'إجراء الإدارة: إغلاق أو إعادة فتح الجلسة' : language === 'fr' ? 'Action Administrateur : Fermer ou rouvrir' : 'Administrator action: Close or reopen live session'}
                      >
                        {activeArticle.isClosed ? (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-[#2A4C3B]" />
                            <span>{language === 'ar' ? 'إعادة فتح الجلسة' : language === 'fr' ? 'Rouvrir la session' : 'Re-open Session'}</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5 text-[#886743]" />
                            <span>{language === 'ar' ? 'اختتام الجلسة' : language === 'fr' ? 'Terminer la session' : 'Conclude Session'}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Article Content Sheet */}
            <article className="bg-white border border-[#E9DFCF] rounded-3xl p-6 sm:p-10 lg:p-12 shadow-xs space-y-8">
              {/* Header */}
              <div className="space-y-4 border-b border-[#EAE3D7] pb-6">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-[#182C22] font-['Lora',serif] leading-tight tracking-tight">
                  {activeArticle.title}
                </h1>

                <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-[#5C7064]">
                  <span className="inline-flex items-center gap-1.5 font-medium text-[#2A4939] bg-[#EAF2ED] px-2.5 py-1 rounded-full border border-[#D0E2D7]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#2A4939]" />
                    <span>{language === 'ar' ? `بقلم الإدارة • ${activeArticle.authorName}` : language === 'fr' ? `Rédigé par l'Administrateur • ${activeArticle.authorName}` : `Written by Administrator • ${activeArticle.authorName}`}</span>
                  </span>

                  {/* Scheduled or Concluded Published Date Display */}
                  {(() => {
                    const readerStatus = getLoungeScheduleStatus(
                      activeArticle.scheduledOpeningTimestamp,
                      currentTime,
                      activeArticle.durationMinutes,
                      activeArticle.isClosed
                    );
                    return readerStatus.isPast ? (
                      <span
                        id="reader-article-published-concluded"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F0EBE2] text-[#55695E] border border-[#DCD3C4] font-medium text-xs tracking-tight shadow-2xs"
                        title="Published date of this concluded lounge article"
                      >
                        <Calendar className="w-3.5 h-3.5 text-[#72857A] shrink-0" />
                        <span>{language === 'ar' ? `تاريخ النشر: ${activeArticle.createdAt}` : language === 'fr' ? `Publié le : ${activeArticle.createdAt}` : `Published: ${activeArticle.createdAt}`}</span>
                      </span>
                    ) : (
                      <>
                        <span
                          id="reader-article-schedule"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FBF1E6] text-[#874116] border border-[#ECD1BA] font-semibold text-xs tracking-tight shadow-2xs"
                        >
                          <Calendar className="w-3.5 h-3.5 text-[#A24D1C] shrink-0" />
                          <span>{language === 'ar' ? `الموعد: ${formatScheduledDateTime(activeArticle.scheduledOpeningTimestamp)}` : language === 'fr' ? `Programmé : ${formatScheduledDateTime(activeArticle.scheduledOpeningTimestamp)}` : `Scheduled: ${formatScheduledDateTime(activeArticle.scheduledOpeningTimestamp)}`}</span>
                        </span>
                        <span className="text-[#88988F]">{language === 'ar' ? `نُشر في ${activeArticle.createdAt}` : language === 'fr' ? `Publié le ${activeArticle.createdAt}` : `Published ${activeArticle.createdAt}`}</span>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Full Written Article Body */}
              <div className="text-[#2C3E34] text-base sm:text-lg leading-[1.75] font-normal">
                <RichTextRenderer content={activeArticle.content} />
              </div>

              {/* Bottom Closing Reflection */}
              <div className="pt-8 border-t border-[#EAE3D7] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#EDF3EF] flex items-center justify-center text-[#2A4C3B]">
                    <Coffee className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#1D3528]">{language === 'ar' ? 'حلقة مجتمع الصالون' : language === 'fr' ? 'Cercle communautaire du Salon' : 'The Lounge Community Circle'}</p>
                    <p className="text-[11px] text-[#697D72]">
                      {language === 'ar' ? `الموعد المجدول: ${formatScheduledDateTime(activeArticle.scheduledOpeningTimestamp)}` : language === 'fr' ? `Ouverture prévue : ${formatScheduledDateTime(activeArticle.scheduledOpeningTimestamp)}` : `Scheduled opening: ${formatScheduledDateTime(activeArticle.scheduledOpeningTimestamp)}`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSubView('lobby');
                    setSelectedArticleId(null);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#28493A] hover:underline cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
                  <span>{language === 'ar' ? 'العودة إلى قائمة الصالون' : language === 'fr' ? 'Retour à la liste du salon' : 'Return to Lobby List'}</span>
                </button>
              </div>
            </article>
          </div>
        )}

        {/* ================================================================ */}
        {/* SUBVIEW: 3. FOUNDER / HOST ARTICLE EDITOR                         */}
        {/* ================================================================ */}
        {subView === 'editor' && canAccessHiddenArticles && (
          <div id="lounge-editor-view" className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setSubView('lobby');
                  setEditingArticleId(null);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-[#F3EEE5] text-[#294838] border border-[#DFD8CB] text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
              >
                <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
                <span>{language === 'ar' ? 'إلغاء والعودة إلى الصالون' : language === 'fr' ? 'Annuler et retourner au salon' : 'Cancel & Return to Lobby'}</span>
              </button>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2A4C3B] text-white text-xs font-semibold shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
                <span>{language === 'ar' ? (isUserAdministrator ? 'استوديو تحرير الإدارة' : 'استوديو تحرير الميسر الخبير') : language === 'fr' ? (isUserAdministrator ? 'Studio de rédaction Administrateur' : 'Studio de rédaction Facilitateur') : (isUserAdministrator ? 'Administrator Editorial Studio' : 'Expert Facilitator Editorial Studio')}</span>
              </div>
            </div>

            {/* Editor Card */}
            <div className="bg-white border border-[#E7DED0] rounded-3xl p-6 sm:p-10 shadow-xs">
              <div className="border-b border-[#EAE3D7] pb-5 mb-6">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-semibold text-[#182C22] font-['Lora',serif]">
                    {language === 'ar' ? (editingArticleId ? 'تعديل مقال الصالون' : 'كتابة مقال جديد للصالون') : language === 'fr' ? (editingArticleId ? "Modifier l'article du salon" : 'Rédiger un nouvel article du salon') : (editingArticleId ? 'Edit Lounge Article' : 'Write New Lounge Article')}
                  </h2>
                  {editingArticle?.is_hidden && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold">
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'تعديل مقال مخفي' : language === 'fr' ? 'Modification d’un article masqué' : 'Editing Hidden Article'}</span>
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-[#5F7367] mt-1">
                  {language === 'ar' ? 'صغ تأملاتك وحدد موعد فتح الأبواب للحلقة الحوارية المباشرة.' : language === 'fr' ? 'Rédigez vos réflexions et planifiez l’heure d’ouverture du cercle en direct.' : 'Craft your reflections and set the scheduled opening time for the live community circle.'}
                </p>
              </div>

              {editingArticle?.is_hidden && (
                <div className="mb-6 p-4 rounded-2xl bg-amber-50/90 border border-amber-200 flex items-start gap-3 text-amber-900 text-xs sm:text-sm">
                  <EyeOff className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
                  <div>
                    <span className="font-semibold">{language === 'ar' ? 'حالة المقال المخفي:' : language === 'fr' ? 'Statut masqué :' : 'Hidden Article Status:'}</span> {language === 'ar' ? 'هذا المقال موجود حالياً في قسم المقالات المخفية. يمكنك حفظ تعديلاتك مع إبقائه مخفياً، أو حفظه وإعادة نشره مباشرة في الصالون العام.' : language === 'fr' ? 'Cet article se trouve dans la section masquée. Vous pouvez enregistrer vos modifications tout en le gardant masqué, ou le republier directement dans le salon public.' : 'This article is currently in the Hidden Articles section. You can save your edits while keeping it hidden, or save and re-publish it directly into the public Lobby list in one step.'}
                  </div>
                </div>
              )}

              {formError && (
                <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-800 text-xs sm:text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={(e) => handleSaveArticle(e, false)} className="space-y-6">
                {/* 1. Article Title */}
                <div>
                  <label
                    htmlFor="lounge-article-title-input"
                    className="block text-xs sm:text-sm font-semibold text-[#20362B] mb-2"
                  >
                    {language === 'ar' ? 'عنوان المقال' : language === 'fr' ? "Titre de l'article" : 'Article Title'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="lounge-article-title-input"
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder={language === 'ar' ? 'مثال: بنية الضعف الإنساني: العثور على الطمأنينة في السكون المشترك' : language === 'fr' ? 'ex. L’architecture de la vulnérabilité' : 'e.g. The Architecture of Vulnerability: Finding Comfort in Shared Stillness'}
                    className="w-full px-4 py-3 rounded-2xl bg-[#FCFAF7] border border-[#D9D1C3] text-[#1E3327] placeholder:text-[#97A59D] focus:outline-none focus:border-[#2C4F3D] focus:ring-2 focus:ring-[#2C4F3D]/15 text-sm font-medium transition-all"
                  />
                  <p className="text-[11px] text-[#697A70] mt-1.5">
                    {language === 'ar' ? 'سيظهر هذا العنوان في قائمة الصالون مع وقت الافتتاح المجدول.' : language === 'fr' ? "Ce titre apparaîtra dans la liste du salon avec l'heure d'ouverture programmée." : 'This title will appear in the Lounge Lobby list alongside its scheduled opening time.'}
                  </p>
                </div>

                {/* 2. Scheduled Date & Time */}
                <div className="p-5 rounded-2xl bg-[#FAF7F2] border border-[#E5DDCF] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label
                      htmlFor="lounge-article-datetime-input"
                      className="block text-xs sm:text-sm font-semibold text-[#20362B]"
                    >
                      {language === 'ar' ? 'تاريخ ووقت فتح الصالون المجدول' : language === 'fr' ? "Date et heure d'ouverture prévues" : 'Scheduled Lounge Opening Date & Time'} <span className="text-red-500">*</span>
                    </label>

                    {previewScheduledFormatted && (
                      <span className="text-xs font-semibold text-[#224A37] bg-[#E4EFE8] px-2.5 py-1 rounded-lg border border-[#CDE1D4]">
                        {language === 'ar' ? `الافتتاح: ${previewScheduledFormatted}` : language === 'fr' ? `Ouverture : ${previewScheduledFormatted}` : `Opening: ${previewScheduledFormatted}`}
                      </span>
                    )}
                  </div>

                  <input
                    id="lounge-article-datetime-input"
                    type="datetime-local"
                    required
                    value={formDateTime}
                    onChange={(e) => setFormDateTime(e.target.value)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white border border-[#D9D1C3] text-[#1E3327] focus:outline-none focus:border-[#2C4F3D] text-sm font-medium transition-all"
                  />
                </div>

                {/* 3. Written Article Content */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="lounge-article-content-input"
                      className="block text-xs sm:text-sm font-semibold text-[#20362B]"
                    >
                      {language === 'ar' ? 'محتوى المقال' : language === 'fr' ? "Contenu de l'article" : 'Article Content'} <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[11px] text-[#718277]">
                      {formContent.trim().split(/\s+/).filter(Boolean).length} {language === 'ar' ? 'كلمة' : language === 'fr' ? 'mots' : 'words'}
                    </span>
                  </div>

                  <RichTextEditor
                    id="lounge-article-content-input"
                    value={formContent}
                    onChange={(val) => setFormContent(val)}
                    placeholder={language === 'ar' ? 'اكتب تأملاتك وأفكارك هنا...' : language === 'fr' ? 'Rédigez vos réflexions ici...' : 'Write your article reflections here...'}
                    language={language as any}
                    minHeight="280px"
                  />
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-[#EAE3D7] flex flex-wrap items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSubView('lobby');
                      setEditingArticleId(null);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#F0ECE3] hover:bg-[#E4DDD0] text-[#344E40] text-xs sm:text-sm font-medium transition-colors cursor-pointer"
                  >
                    {language === 'ar' ? 'إلغاء' : language === 'fr' ? 'Annuler' : 'Cancel'}
                  </button>

                  {editingArticle?.is_hidden ? (
                    <>
                      <button
                        type="button"
                        id="lounge-save-hidden-article-btn"
                        disabled={isSubmitting}
                        onClick={(e) => handleSaveArticle(e, false)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E8E1D5] hover:bg-[#DDD3C4] text-[#244031] text-xs sm:text-sm font-semibold transition-all cursor-pointer border border-[#D1C6B4]"
                      >
                        <CheckCircle2 className="w-4 h-4 text-[#3D5A4A]" />
                        <span>{isSubmitting ? (language === 'ar' ? 'جاري الحفظ...' : language === 'fr' ? 'Enregistrement...' : 'Saving...') : (language === 'ar' ? 'حفظ (مع إبقائه مخفياً)' : language === 'fr' ? 'Enregistrer (garder masqué)' : 'Save (Keep Hidden)')}</span>
                      </button>

                      <button
                        type="button"
                        id="lounge-save-and-republish-btn"
                        disabled={isSubmitting}
                        onClick={(e) => handleSaveArticle(e, true)}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#28493A] hover:bg-[#1E372B] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold transition-all shadow-sm cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4 text-emerald-300" />
                        <span>{isSubmitting ? (language === 'ar' ? 'جاري النشر...' : language === 'fr' ? 'Publication...' : 'Publishing...') : (language === 'ar' ? 'حفظ وإعادة النشر في الصالون' : language === 'fr' ? 'Enregistrer et republier dans le salon' : 'Save & Re-publish to Lobby')}</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="submit"
                      id="lounge-publish-article-btn"
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#28493A] hover:bg-[#1E372B] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold transition-all shadow-sm cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                      <span>{isSubmitting ? (language === 'ar' ? 'جاري الحفظ...' : language === 'fr' ? 'Enregistrement...' : 'Saving...') : editingArticleId ? (language === 'ar' ? 'تحديث المقال' : language === 'fr' ? "Mettre à jour l'article" : 'Update Article') : (language === 'ar' ? 'نشر وجدولة' : language === 'fr' ? 'Publier et programmer' : 'Publish & Schedule')}</span>
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* SUBVIEW: 4. LOUNGE QUEUE SCREEN                                  */}
        {/* ================================================================ */}
        {subView === 'queue' && activeArticle && (
          <LoungeQueueScreen
            article={activeArticle}
            currentUser={currentUser}
            onBackToLobby={() => {
              setSubView('lobby');
              setSelectedArticleId(null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onBackToArticle={() => {
              setSubView('reader');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onNavigateSignIn={onNavigateSignIn}
            onNavigateSignUp={onNavigateSignUp}
            onLoungeClosed={() => {
              setArticles(getStoredLoungeArticles());
            }}
            onEnterChatRoom={() => {
              setSubView('room');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* ================================================================ */}
        {/* SUBVIEW: 5. LOUNGE LIVE CHAT ROOM                                */}
        {/* ================================================================ */}
        {subView === 'room' && activeArticle && (
          <LoungeChatRoom
            article={activeArticle}
            currentUser={currentUser}
            isHost={isExpertFacilitator(currentUser, activeArticle)}
            onLeaveRoom={() => {
              setSubView('lobby');
              setSelectedArticleId(null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* ================================================================ */}
        {/* MODAL: FOUNDER DELETE ARTICLE CONFIRMATION                        */}
        {/* ================================================================ */}
        {articlePendingDelete && (
          <div
            id="confirm-delete-article-modal"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
          >
            <div className="bg-white border border-[#DDD4C5] rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-700 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <button
                  type="button"
                  onClick={() => setArticlePendingDelete(null)}
                  className="p-1.5 rounded-lg text-[#75867D] hover:bg-[#F2EDE4] transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <h3 className="text-lg sm:text-xl font-bold text-[#182C22] font-['Lora',serif]">
                  {language === 'ar' ? 'هل أنت متأكد من حذف هذا المقال؟' : language === 'fr' ? 'Êtes-vous sûr de vouloir supprimer cet article ?' : 'Are you sure you want to delete this article?'}
                </h3>
                <p className="text-xs sm:text-sm text-[#4E6257] mt-2 font-medium">
                  "{articlePendingDelete.title}"
                </p>
                <div className="mt-3 p-3.5 rounded-2xl bg-[#F8F5F0] border border-[#E3D9C9] text-xs text-[#5D6F64] space-y-1 leading-relaxed">
                  <p className="font-semibold text-[#294536]">{language === 'ar' ? 'ماذا يحدث بعد الحذف:' : language === 'fr' ? 'Que se passe-t-il après la suppression :' : 'What happens after deleting:'}</p>
                  <p>{language === 'ar' ? '• تتم إزالة المقال فوراً من قائمة الصالون العام التي يراها المستخدمون.' : language === 'fr' ? '• L’article est immédiatement retiré de la vue publique.' : '• The article is immediately removed from what normal users see in the public Lobby list.'}</p>
                  <p>{language === 'ar' ? '• يتم حفظه في قسم "المقالات المخفية" للإدارة، حيث يمكنك مراجعته أو تعديله أو إعادة نشره في أي وقت.' : language === 'fr' ? '• Il est conservé dans les articles masqués.' : '• It is preserved in the Administrator & Expert Facilitator "Hidden Articles" section, where you can review, edit, or re-publish it back to the public at any time.'}</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  id="confirm-delete-article-no-btn"
                  onClick={() => setArticlePendingDelete(null)}
                  className="px-4 py-2.5 rounded-xl border border-[#D5C9B7] bg-white hover:bg-[#F2ECE1] text-[#28493A] text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                >
                  {language === 'ar' ? 'لا، احتفظ بالمقال' : language === 'fr' ? "Non, garder l'article" : 'No, Keep Article'}
                </button>
                <button
                  type="button"
                  id="confirm-delete-article-yes-btn"
                  onClick={handleConfirmDelete}
                  className="px-5 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  {language === 'ar' ? 'نعم، احذف المقال' : language === 'fr' ? "Oui, supprimer l'article" : 'Yes, Delete Article'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Toast Notification */}
        {actionToast && (
          <div
            id="lounge-action-toast"
            className="fixed bottom-6 end-6 z-50 max-w-sm rounded-2xl bg-[#1E3327] text-white p-4 shadow-xl border border-emerald-800/40 flex items-center gap-3 animate-in slide-in-from-bottom-3 duration-200"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-xs sm:text-sm font-medium leading-snug">{actionToast.message}</span>
          </div>
        )}

        {/* ================================================================ */}
        {/* MODAL: AUTH REQUIRED FOR ANONYMOUS VISITORS TRYING TO JOIN       */}
        {/* ================================================================ */}
        {showAnonymousJoinModal && (
          <div
            id="anonymous-queue-gate-modal"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
          >
            <div className="bg-white border border-[#DDD4C5] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-xl space-y-5">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-[#E6F3EC] text-[#226744] flex items-center justify-center">
                  <DoorOpen className="w-5 h-5" />
                </div>
                <button
                  type="button"
                  id="close-anonymous-auth-modal-btn"
                  onClick={() => setShowAnonymousJoinModal(false)}
                  className="p-1.5 rounded-lg text-[#75867D] hover:bg-[#F2EDE4] transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-semibold mb-2">
                  <span>{language === 'ar' ? 'تسجيل الدخول مطلوب' : language === 'fr' ? 'Connexion requise' : 'Sign In Required'}</span>
                </div>
                <h3 className="text-xl font-bold text-[#182C22] font-['Lora',serif]">
                  {language === 'ar' ? 'يلزم وجود حساب للانضمام' : language === 'fr' ? 'Compte requis pour participer' : 'Account Required to Join'}
                </h3>
                <p className="text-xs sm:text-sm text-[#506358] mt-2 leading-relaxed">
                  {language === 'ar'
                    ? 'يمكن فقط للأعضاء المسجلين الانضمام إلى قائمة الانتظار ودخول الحلقة الحوارية المباشرة. لا يمكن للزوار غير المسجلين الانضمام. يرجى تسجيل الدخول أو إنشاء حساب مجاني للمشاركة.'
                    : language === 'fr'
                    ? 'Seuls les utilisateurs connectés peuvent rejoindre la file d’attente et le cercle en direct. Les visiteurs anonymes ne peuvent pas participer. Veuillez vous connecter ou créer un compte gratuit.'
                    : 'Only logged-in users with an account can join the queue and enter the live circle. Anonymous visitors cannot join. Please sign in or create a free account to take part in this session.'}
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  id="lounge-gate-signin-btn"
                  onClick={() => {
                    setShowAnonymousJoinModal(false);
                    if (onNavigateSignIn) onNavigateSignIn();
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#28493A] hover:bg-[#1E372B] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                >
                  <LogIn className="w-4 h-4 rtl:rotate-180" />
                  <span>{language === 'ar' ? 'تسجيل الدخول إلى حسابك' : language === 'fr' ? 'Se connecter à votre compte' : 'Sign In to Your Account'}</span>
                </button>

                <button
                  type="button"
                  id="lounge-gate-signup-btn"
                  onClick={() => {
                    setShowAnonymousJoinModal(false);
                    if (onNavigateSignUp) onNavigateSignUp();
                  }}
                  className="w-full py-2.5 rounded-xl border border-[#D5C9B7] bg-white hover:bg-[#F2ECE1] text-[#28493A] text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{language === 'ar' ? 'إنشاء حساب مجاني' : language === 'fr' ? 'Créer un compte gratuit' : 'Create a Free Account'}</span>
                </button>

                <button
                  type="button"
                  id="lounge-gate-cancel-btn"
                  onClick={() => setShowAnonymousJoinModal(false)}
                  className="w-full py-2 rounded-xl text-[#72857A] hover:text-[#182C22] text-xs font-medium transition-colors cursor-pointer text-center"
                >
                  {language === 'ar' ? 'إلغاء والعودة إلى الصالون' : language === 'fr' ? 'Annuler et retourner au salon' : 'Cancel and Return to Lobby'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </Navbar>
  );
};
