import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BookOpen, 
  PenTool, 
  ArrowLeft, 
  Trash2, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  Upload, 
  Image as ImageIcon, 
  Check, 
  AlertCircle, 
  Search, 
  X, 
  Sparkles, 
  Calendar, 
  User, 
  Edit3,
  Heart
} from 'lucide-react';
import { TeenSpaceArticle, UserAccount } from '../types';
import { 
  getStoredTeenSpaceArticles, 
  createTeenSpaceArticle, 
  updateTeenSpaceArticle, 
  hideTeenSpaceArticle, 
  republishTeenSpaceArticle, 
  permanentlyDeleteTeenSpaceArticle,
  initFirestoreTeenSpaceArticlesSync 
} from '../utils/teenSpaceManagement';
import { isWriter, isAdministrator, isSuperAdmin } from '../utils/userManagement';
import { Navbar } from './Navbar';
import { useLanguage } from '../context/LanguageContext';
import { RichTextEditor } from './RichTextEditor';
import { RichTextRenderer } from './RichTextRenderer';

interface TeenSpacePageProps {
  currentUser?: UserAccount | null;
  onNavigateHome: () => void;
  onNavigateDashboard?: () => void;
  onNavigateDiscussions?: (tab?: 'unopened' | 'mailbox') => void;
  onNavigateGames?: () => void;
  onNavigateTeenSpace?: () => void;
  onNavigateLounge?: () => void;
  onNavigateRules?: () => void;
  onNavigateMailbox?: () => void;
  onNavigateAdmin?: () => void;
  onNavigateMemberManagement?: () => void;
  onOpenEmergencyModal: () => void;
  onOpenContactSupport?: () => void;
  onTalkAnonymously?: () => void;
  onOpenAuth?: (mode: 'signin' | 'signup') => void;
  onSignOut?: () => void;
}

export const TeenSpacePage: React.FC<TeenSpacePageProps> = ({
  currentUser,
  onNavigateHome,
  onNavigateDashboard,
  onNavigateDiscussions,
  onNavigateGames,
  onNavigateTeenSpace,
  onNavigateLounge,
  onNavigateRules,
  onNavigateMailbox,
  onNavigateAdmin,
  onNavigateMemberManagement,
  onOpenEmergencyModal,
  onOpenContactSupport,
  onTalkAnonymously,
  onOpenAuth,
  onSignOut,
}) => {
  const { language } = useLanguage();
  const [articles, setArticles] = useState<TeenSpaceArticle[]>(() => getStoredTeenSpaceArticles());
  const [selectedArticle, setSelectedArticle] = useState<TeenSpaceArticle | null>(null);
  const [activeTab, setActiveTab] = useState<'published' | 'hidden'>('published');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<TeenSpaceArticle | null>(null);
  const [deleteConfirmArticle, setDeleteConfirmArticle] = useState<TeenSpaceArticle | null>(null);
  const [permanentDeleteConfirmArticle, setPermanentDeleteConfirmArticle] = useState<TeenSpaceArticle | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Write / Edit Form state
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formImage, setFormImage] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Writer / Admin permissions
  const canWrite = useMemo(() => {
    return isWriter(currentUser) || isAdministrator(currentUser) || isSuperAdmin(currentUser);
  }, [currentUser]);

  // Sync with storage & firestore
  useEffect(() => {
    const handleUpdate = () => {
      setArticles(getStoredTeenSpaceArticles());
    };
    window.addEventListener('3awdli_teen_space_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    const unsubscribeFirestore = initFirestoreTeenSpaceArticlesSync();

    return () => {
      window.removeEventListener('3awdli_teen_space_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filtered lists
  const publishedArticles = useMemo(() => {
    return articles
      .filter((a) => !a.is_hidden)
      .sort((a, b) => (b.createdAtTimestamp || 0) - (a.createdAtTimestamp || 0));
  }, [articles]);

  const hiddenArticles = useMemo(() => {
    return articles
      .filter((a) => Boolean(a.is_hidden))
      .sort((a, b) => (b.hiddenAtTimestamp || b.createdAtTimestamp || 0) - (a.hiddenAtTimestamp || a.createdAtTimestamp || 0));
  }, [articles]);

  const displayedArticles = useMemo(() => {
    const source = activeTab === 'published' ? publishedArticles : hiddenArticles;
    if (!searchQuery.trim()) return source;
    const q = searchQuery.toLowerCase().trim();
    return source.filter(
      (a) => a.title.toLowerCase().includes(q) || a.authorName.toLowerCase().includes(q)
    );
  }, [activeTab, publishedArticles, hiddenArticles, searchQuery]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingArticle(null);
    setFormTitle('');
    setFormContent('');
    setFormImage('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80');
    setIsWriteModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (article: TeenSpaceArticle) => {
    setEditingArticle(article);
    setFormTitle(article.title);
    setFormContent(article.content);
    setFormImage(article.imageUrl || '');
    setIsWriteModalOpen(true);
  };

  // Handle Image Upload (File -> Data URL)
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast(
        language === 'ar'
          ? 'يرجى اختيار ملف صورة صالح (PNG, JPG, WebP).'
          : language === 'fr'
          ? 'Veuillez sélectionner un fichier image valide (PNG, JPG, WebP).'
          : 'Please select a valid image file (PNG, JPG, WebP).'
      );
      return;
    }

    // Limit to ~4MB
    if (file.size > 4.5 * 1024 * 1024) {
      showToast(
        language === 'ar'
          ? 'حجم الصورة يتجاوز 4 ميغابايت. يرجى اختيار صورة أصغر.'
          : language === 'fr'
          ? "La taille de l'image dépasse 4 Mo. Veuillez choisir une photo plus petite."
          : 'Image size exceeds 4MB. Please choose a smaller photo.'
      );
      return;
    }

    setIsUploadingImage(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormImage(reader.result);
        setIsUploadingImage(false);
      }
    };
    reader.onerror = () => {
      showToast(
        language === 'ar'
          ? 'فشل تحميل ملف الصورة.'
          : language === 'fr'
          ? "Échec du chargement du fichier image."
          : 'Failed to load image file.'
      );
      setIsUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  // Save Article (Create or Update)
  const handleSaveArticle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      showToast(
        language === 'ar'
          ? 'يرجى إدخال عنوان للمقال.'
          : language === 'fr'
          ? "Veuillez saisir un titre d'article."
          : 'Please enter an article title.'
      );
      return;
    }
    if (!formContent.trim()) {
      showToast(
        language === 'ar'
          ? 'يرجى تقديم المحتوى المكتوب للمقال.'
          : language === 'fr'
          ? "Veuillez fournir le contenu écrit de l'article."
          : 'Please provide the written content for the article.'
      );
      return;
    }
    if (!currentUser) {
      showToast(
        language === 'ar'
          ? 'يجب تسجيل الدخول بصلاحية كاتب للنشر.'
          : language === 'fr'
          ? 'Vous devez être connecté avec le rôle Rédacteur pour publier.'
          : 'You must be signed in with the Writer role to publish.'
      );
      return;
    }

    try {
      if (editingArticle) {
        const updated = updateTeenSpaceArticle(editingArticle.id, {
          title: formTitle.trim(),
          content: formContent.trim(),
          imageUrl: formImage.trim() || undefined,
        });
        setArticles(getStoredTeenSpaceArticles());
        if (selectedArticle && selectedArticle.id === updated.id) {
          setSelectedArticle(updated);
        }
        showToast(
          language === 'ar'
            ? 'تم تحديث المقال بنجاح.'
            : language === 'fr'
            ? 'Article mis à jour avec succès.'
            : 'Article updated successfully.'
        );
      } else {
        createTeenSpaceArticle(
          {
            title: formTitle.trim(),
            content: formContent.trim(),
            imageUrl: formImage.trim() || undefined,
          },
          currentUser
        );
        setArticles(getStoredTeenSpaceArticles());
        showToast(
          language === 'ar'
            ? 'تم نشر المقال في فضاء اليافعين!'
            : language === 'fr'
            ? "Article publié dans l'Espace Ados !"
            : 'Article published to Teen Space!'
        );
      }

      setIsWriteModalOpen(false);
      setEditingArticle(null);
    } catch (err) {
      console.error(err);
      showToast(
        language === 'ar'
          ? 'حدث خطأ أثناء حفظ المقال.'
          : language === 'fr'
          ? "Une erreur est survenue lors de l'enregistrement de l'article."
          : 'An error occurred while saving the article.'
      );
    }
  };

  // Handle Soft-Delete (Move to Hidden)
  const handleConfirmHideArticle = () => {
    if (!deleteConfirmArticle) return;
    const authorOrAdminName = currentUser?.name || 'Writer';
    hideTeenSpaceArticle(deleteConfirmArticle.id, authorOrAdminName);
    setArticles(getStoredTeenSpaceArticles());

    if (selectedArticle && selectedArticle.id === deleteConfirmArticle.id) {
      setSelectedArticle(null);
    }

    showToast(
      language === 'ar'
        ? `تم نقل "${deleteConfirmArticle.title}" إلى المقالات المخفية.`
        : language === 'fr'
        ? `"${deleteConfirmArticle.title}" déplacé vers les articles masqués.`
        : `"${deleteConfirmArticle.title}" moved to Hidden Articles.`
    );
    setDeleteConfirmArticle(null);
  };

  // Handle Republish (Restore from Hidden)
  const handleRepublishArticle = (article: TeenSpaceArticle) => {
    republishTeenSpaceArticle(article.id);
    setArticles(getStoredTeenSpaceArticles());
    if (selectedArticle && selectedArticle.id === article.id) {
      setSelectedArticle({ ...article, is_hidden: false });
    }
    showToast(
      language === 'ar'
        ? `تمت إعادة نشر "${article.title}" في فضاء اليافعين!`
        : language === 'fr'
        ? `"${article.title}" republié dans l'Espace Ados !`
        : `"${article.title}" republished to Teen Space!`
    );
  };

  // Handle Permanent Delete
  const handleConfirmPermanentDelete = () => {
    if (!permanentDeleteConfirmArticle) return;
    permanentlyDeleteTeenSpaceArticle(permanentDeleteConfirmArticle.id);
    setArticles(getStoredTeenSpaceArticles());

    if (selectedArticle && selectedArticle.id === permanentDeleteConfirmArticle.id) {
      setSelectedArticle(null);
    }

    showToast(
      language === 'ar'
        ? 'تم حذف المقال نهائياً.'
        : language === 'fr'
        ? 'Article définitivement supprimé.'
        : 'Article permanently deleted.'
    );
    setPermanentDeleteConfirmArticle(null);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#24352C] flex flex-col font-sans selection:bg-[#D5E3DA] selection:text-[#183124]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 end-6 z-50 bg-[#1E372C] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-[#315745] text-sm animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Navigation Bar / Sidebar Layout */}
      <Navbar
        currentView="teen-space"
        currentUser={currentUser}
        onNavigateHome={onNavigateHome}
        onNavigateDashboard={onNavigateDashboard}
        onNavigateDiscussions={onNavigateDiscussions}
        onNavigateGames={onNavigateGames}
        onNavigateTeenSpace={onNavigateTeenSpace}
        onNavigateLounge={onNavigateLounge}
        onNavigateRules={onNavigateRules}
        onNavigateMailbox={onNavigateMailbox}
        onNavigateAdmin={onNavigateAdmin}
        onNavigateMemberManagement={onNavigateMemberManagement}
        onOpenEmergencyModal={onOpenEmergencyModal}
        onOpenContactSupport={onOpenContactSupport}
        onTalkAnonymously={onTalkAnonymously}
        onOpenAuth={onOpenAuth}
        onSignOut={onSignOut}
      >
        <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
          {/* ====================================================
              VIEW A: FULL ARTICLE READING VIEW
             ==================================================== */}
          {selectedArticle ? (
            <div className="max-w-4xl mx-auto">
              {/* Back to Teen Space Main View */}
              <button
                id="teen-article-back-btn"
                onClick={() => setSelectedArticle(null)}
                className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#55695E] hover:text-[#1F3328] transition-colors cursor-pointer bg-white px-4 py-2 rounded-xl border border-[#E3DDD1] shadow-2xs"
              >
                <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
                <span>{language === 'ar' ? 'العودة إلى فضاء اليافعين' : language === 'fr' ? "Retour à l'Espace Ados" : 'Return to Teen Space'}</span>
              </button>

              <article className="bg-white rounded-3xl border border-[#E5DFD5] shadow-sm overflow-hidden">
                {/* Featured Cover Image */}
                {selectedArticle.imageUrl && (
                  <div className="w-full h-64 sm:h-96 md:h-[420px] relative overflow-hidden bg-[#F0ECE3]">
                    <img
                      src={selectedArticle.imageUrl}
                      alt={selectedArticle.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                  </div>
                )}

                {/* Article Header & Metadata */}
                <div className="p-6 sm:p-10 md:p-12 border-b border-[#F0ECE3]">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#EBF2EE] text-[#224433] border border-[#D1E2D7]">
                      <BookOpen className="w-3.5 h-3.5 text-[#284939]" />
                      <span>{language === 'ar' ? 'مقال فضاء اليافعين' : language === 'fr' ? 'Article Espace Ados' : 'Teen Space Article'}</span>
                    </span>

                    {/* Writer / Admin Action Controls */}
                    {canWrite && (
                      <div className="flex items-center gap-2">
                        {selectedArticle.is_hidden ? (
                          <>
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                              <EyeOff className="w-3 h-3" />
                              {language === 'ar' ? 'مخفي' : language === 'fr' ? 'Masqué' : 'Hidden'}
                            </span>
                            <button
                              onClick={() => handleRepublishArticle(selectedArticle)}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#284939] text-white hover:bg-[#1E372B] transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>{language === 'ar' ? 'إعادة النشر' : language === 'fr' ? 'Republier' : 'Republish'}</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              id="edit-article-btn"
                              onClick={() => handleOpenEditModal(selectedArticle)}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-[#D7D1C5] text-[#4A5D52] hover:bg-[#F4EFE7] transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>{language === 'ar' ? 'تعديل المقال' : language === 'fr' ? "Modifier l'article" : 'Edit Article'}</span>
                            </button>
                            <button
                              id="delete-article-btn"
                              onClick={() => setDeleteConfirmArticle(selectedArticle)}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{language === 'ar' ? 'حذف' : language === 'fr' ? 'Supprimer' : 'Delete'}</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#1B3125] font-['Lora',serif] leading-tight mb-6">
                    {selectedArticle.title}
                  </h1>

                  {/* Writer Profile & Reused Profession Label */}
                  <div className="flex items-center gap-3.5 pt-4 border-t border-[#F5F1EA]">
                    <div className="w-12 h-12 rounded-2xl bg-[#E6F0EA] text-[#214332] font-bold text-base flex items-center justify-center border border-[#CFE1D6] shadow-2xs shrink-0">
                      {selectedArticle.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm sm:text-base text-[#1E3428]">
                          {selectedArticle.authorName}
                        </span>
                        {/* Profession Label (reused from Listener profile) */}
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-[#FAF6ED] text-[#7A5814] border border-[#EADBBD]">
                          <Sparkles className="w-3 h-3 text-[#B48118]" />
                          <span>
                            {selectedArticle.authorProfession
                              ? (language === 'ar' && selectedArticle.authorProfession.toLowerCase().includes('psychologist')
                                  ? 'أخصائي نفسي'
                                  : selectedArticle.authorProfession)
                              : (language === 'ar' ? 'أخصائي نفسي' : language === 'fr' ? 'Psychologue' : 'Psychologist')}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#75867C] mt-0.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{language === 'ar' ? `نُشر في ${selectedArticle.createdAt}` : language === 'fr' ? `Publié le ${selectedArticle.createdAt}` : `Published on ${selectedArticle.createdAt}`}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Full Article Content */}
                <div className="p-6 sm:p-10 md:p-12 text-[#2C3E33] leading-relaxed text-base sm:text-lg">
                  <RichTextRenderer content={selectedArticle.content} />
                </div>

                {/* Friendly Closing Footer */}
                <div className="p-6 sm:p-8 bg-[#FAF8F5] border-t border-[#F0ECE3] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs text-[#62746A]">
                    <Heart className="w-4 h-4 text-[#C2583F]" />
                    <span>{language === 'ar' ? 'فضاء اليافعين في عاود لي: واحة قراءة آمنة وداعمة للشباب واليافعين.' : language === 'fr' ? 'Espace Ados 3awdli : un espace de lecture bienveillant et sécurisé pour les jeunes.' : '3awdli Teen Space: A safe, compassionate reading zone for youth.'}</span>
                  </div>
                  <button
                    onClick={() => setSelectedArticle(null)}
                    className="self-start sm:self-auto px-4 py-2 rounded-xl bg-[#284939] hover:bg-[#1E372B] text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                  >
                    {language === 'ar' ? 'العودة لجميع المقالات' : language === 'fr' ? 'Retour à tous les articles' : 'Back to All Articles'}
                  </button>
                </div>
              </article>
            </div>
          ) : (
            /* ====================================================
                VIEW B: MAIN TEEN SPACE DIRECTORY / CARDS VIEW
               ==================================================== */
            <div>
              {/* Header Banner */}
              <div className="bg-white rounded-3xl border border-[#E8E2D7] p-6 sm:p-8 shadow-xs mb-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#E5EEE9] text-[#284B38] text-xs font-semibold border border-[#CFE1D6]">
                        {language === 'ar' ? 'واحة الشباب واليافعين' : language === 'fr' ? 'Sanctuaire Jeunesse' : 'Youth Sanctuary'}
                      </span>
                      <span className="text-xs text-[#7C8D83]">
                        {language === 'ar' ? 'بقلم كتاب معتمدين في الصحة النفسية' : language === 'fr' ? 'Rédigé par des spécialistes de la santé mentale' : 'Written by Verified Mental Health Writers'}
                      </span>
                    </div>
                    <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-[#1F362C] font-['Lora',serif] flex items-center gap-2.5">
                      <BookOpen className="w-7 h-7 text-[#254233]" />
                      <span>{language === 'ar' ? 'فضاء اليافعين' : language === 'fr' ? 'Espace Ados' : 'Teen Space'}</span>
                    </h1>
                    <p className="mt-2 text-sm text-[#617369] max-w-2xl leading-relaxed">
                      {language === 'ar'
                        ? 'مقالات ملهمة وتأملات وأدلة نفسية مصممة خصيصاً للشباب واليافعين في مسيرتهم مع الدراسة والعلاقات والمشاعر والنمو.'
                        : language === 'fr'
                        ? 'Articles bienveillants, réflexions et repères psychologiques conçus pour les adolescents et les jeunes.'
                        : 'Thoughtful articles, reflections, and psychology-informed guides crafted specifically for teenagers and youth navigating school, relationships, emotions, and growing up.'}
                    </p>
                  </div>

                  {/* Writer Call-to-Action */}
                  {canWrite && (
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        id="write-new-article-btn"
                        onClick={handleOpenCreateModal}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#284939] hover:bg-[#1E372B] text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-xs"
                      >
                        <PenTool className="w-4 h-4" />
                        <span>{language === 'ar' ? 'كتابة مقال جديد' : language === 'fr' ? 'Rédiger un nouvel article' : 'Write New Article'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Tabs & Search Bar */}
                <div className="mt-8 pt-6 border-t border-[#F0ECE3] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Public vs Hidden Tabs (Hidden only visible to Writers/Admins) */}
                  <div className="flex items-center gap-2">
                    <button
                      id="tab-published-articles"
                      onClick={() => setActiveTab('published')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                        activeTab === 'published'
                          ? 'bg-[#284939] text-white shadow-2xs'
                          : 'bg-[#F6F3EC] text-[#55695E] hover:bg-[#EDE9E0]'
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'المقالات المنشورة' : language === 'fr' ? 'Articles publiés' : 'Published Articles'}</span>
                      <span className="ms-1 px-2 py-0.2 rounded-full text-[10.5px] bg-white/20">
                        {publishedArticles.length}
                      </span>
                    </button>

                    {canWrite && (
                      <button
                        id="tab-hidden-articles"
                        onClick={() => setActiveTab('hidden')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                          activeTab === 'hidden'
                            ? 'bg-[#B65E46] text-white shadow-2xs'
                            : 'bg-[#F6F3EC] text-[#55695E] hover:bg-[#EDE9E0]'
                        }`}
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>{language === 'ar' ? 'المقالات المخفية' : language === 'fr' ? 'Articles masqués' : 'Hidden Articles'}</span>
                        {hiddenArticles.length > 0 && (
                          <span className="ms-1 px-2 py-0.2 rounded-full text-[10.5px] bg-white/20">
                            {hiddenArticles.length}
                          </span>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Search Filter */}
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-[#889B90] absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="search-teen-articles-input"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={language === 'ar' ? 'ابحث في المقالات أو الكتاب...' : language === 'fr' ? 'Rechercher des articles ou auteurs...' : 'Search articles or writers...'}
                      className="w-full ps-9 pe-8 py-2 text-xs bg-[#FAF8F5] rounded-xl border border-[#DDD7CD] focus:outline-none focus:ring-2 focus:ring-[#284939] text-[#24352C] placeholder-[#94A49B]"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute end-2.5 top-1/2 -translate-y-1/2 text-[#889B90] hover:text-[#284939] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Hidden Articles Explanatory Notice */}
              {activeTab === 'hidden' && canWrite && (
                <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
                  <EyeOff className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">{language === 'ar' ? 'منطقة المقالات المخفية:' : language === 'fr' ? 'Zone des articles masqués :' : 'Hidden Articles Staging Area:'}</span>{' '}
                    {language === 'ar'
                      ? 'هذه المقالات مخفية عن زوار فضاء اليافعين العام. يمكن للكتاب مراجعتها أو تعديلها أو إعادة نشرها أو حذفها نهائياً.'
                      : language === 'fr'
                      ? 'Ces articles sont masqués de la vue publique. Les rédacteurs peuvent les consulter, modifier, republier ou supprimer définitivement.'
                      : 'These articles are hidden from the public Teen Space view. Writers can review, edit, republish them back to the main view, or permanently delete them.'}
                  </div>
                </div>
              )}

              {/* Articles Grid: SHOWS IMAGE, TITLE, WRITER NAME ONLY */}
              {displayedArticles.length === 0 ? (
                <div className="bg-white rounded-3xl border border-[#E8E2D7] p-12 text-center shadow-xs">
                  <BookOpen className="w-10 h-10 text-[#9BB0A3] mx-auto mb-3" />
                  <h3 className="text-base font-bold text-[#23382D]">
                    {activeTab === 'hidden'
                      ? (language === 'ar' ? 'لا توجد مقالات مخفية' : language === 'fr' ? 'Aucun article masqué' : 'No Hidden Articles')
                      : (language === 'ar' ? 'لم يتم العثور على مقالات' : language === 'fr' ? 'Aucun article trouvé' : 'No Articles Found')}
                  </h3>
                  <p className="text-xs text-[#718278] mt-1 max-w-sm mx-auto">
                    {searchQuery 
                      ? (language === 'ar' ? 'حاول تعديل كلمات البحث.' : language === 'fr' ? 'Essayez de modifier vos termes de recherche.' : 'Try adjusting your search terms.')
                      : activeTab === 'hidden' 
                      ? (language === 'ar' ? 'المقالات المحذوفة تنتقل إلى هنا لتتمكن من إعادة نشرها أو تعديلها لاحقاً.' : language === 'fr' ? 'Les articles supprimés apparaissent ici afin que vous puissiez les republier plus tard.' : 'Deleted articles move here so you can republish or edit them later.')
                      : (language === 'ar' ? 'عد قريباً لمطالعة مقالات وإرشادات جديدة.' : language === 'fr' ? 'Revenez bientôt pour découvrir de nouveaux articles.' : 'Check back soon for new reflections and guidance.')}
                  </p>
                  {canWrite && activeTab === 'published' && (
                    <button
                      onClick={handleOpenCreateModal}
                      className="mt-4 px-4 py-2 rounded-xl bg-[#284939] hover:bg-[#1E372B] text-white text-xs font-semibold cursor-pointer"
                    >
                      {language === 'ar' ? 'اكتب أول مقال' : language === 'fr' ? 'Écrire le premier article' : 'Write First Article'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayedArticles.map((article) => (
                    <div
                      key={article.id}
                      className="bg-white rounded-3xl border border-[#E6E0D6] overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col group"
                    >
                      {/* Article Image */}
                      <div 
                        onClick={() => setSelectedArticle(article)}
                        className="w-full h-48 sm:h-52 bg-[#F0ECE3] relative overflow-hidden cursor-pointer"
                      >
                        {article.imageUrl ? (
                          <img
                            src={article.imageUrl}
                            alt={article.title}
                            className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#9FB0A6] bg-[#F7F4EE]">
                            <ImageIcon className="w-10 h-10" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                        
                        {/* Hidden Badge */}
                        {article.is_hidden && (
                          <span className="absolute top-3 start-3 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-2xs flex items-center gap-1">
                            <EyeOff className="w-3 h-3" />
                            <span>{language === 'ar' ? 'مخفي' : language === 'fr' ? 'Masqué' : 'Hidden'}</span>
                          </span>
                        )}
                      </div>

                      {/* Card Content: Title and Writer Name Only */}
                      <div className="p-5 flex-1 flex flex-col justify-between">
                        <div 
                          onClick={() => setSelectedArticle(article)}
                          className="cursor-pointer"
                        >
                          <h2 className="text-base sm:text-lg font-bold text-[#1E3428] font-['Lora',serif] group-hover:text-[#264B38] transition-colors leading-snug line-clamp-2">
                            {article.title}
                          </h2>
                        </div>

                        {/* Writer Name & Actions */}
                        <div className="mt-4 pt-3 border-t border-[#F2EDE5] flex items-center justify-between gap-2">
                          <div 
                            onClick={() => setSelectedArticle(article)}
                            className="flex items-center gap-2 cursor-pointer min-w-0"
                          >
                            <div className="w-6 h-6 rounded-full bg-[#E5EFE9] text-[#244534] font-bold text-[11px] flex items-center justify-center shrink-0">
                              {article.authorName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-semibold text-[#485C51] truncate">
                              {article.authorName}
                            </span>
                          </div>

                          {/* Writer Controls */}
                          {canWrite && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              {article.is_hidden ? (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRepublishArticle(article);
                                    }}
                                    className="p-1.5 text-xs text-[#284939] hover:bg-[#EBF2EE] rounded-lg transition-colors cursor-pointer"
                                    title={language === 'ar' ? 'إعادة نشر المقال' : language === 'fr' ? 'Republier l’article' : 'Republish Article'}
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPermanentDeleteConfirmArticle(article);
                                    }}
                                    className="p-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                    title={language === 'ar' ? 'حذف نهائي' : language === 'fr' ? 'Supprimer définitivement' : 'Permanently Delete'}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenEditModal(article);
                                    }}
                                    className="p-1.5 text-xs text-[#52655A] hover:text-[#233A2D] hover:bg-[#F0ECE4] rounded-lg transition-colors cursor-pointer"
                                    title={language === 'ar' ? 'تعديل المقال' : language === 'fr' ? 'Modifier l’article' : 'Edit Article'}
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirmArticle(article);
                                    }}
                                    className="p-1.5 text-xs text-[#9E4D3B] hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                    title={language === 'ar' ? 'نقل إلى المقالات المخفية' : language === 'fr' ? 'Déplacer vers les articles masqués' : 'Move to Hidden Articles'}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </Navbar>

      {/* ====================================================
          MODAL 1: WRITE / EDIT ARTICLE MODAL (Writer Role Only)
         ==================================================== */}
      {isWriteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[min(92vh,780px)] flex flex-col border border-[#E3DDD1] shadow-2xl overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-[#F0ECE3] bg-[#FAF8F5] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[#E6EFEA] text-[#244535] flex items-center justify-center">
                  <PenTool className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E3428]">
                    {editingArticle
                      ? (language === 'ar' ? 'تعديل مقال فضاء اليافعين' : language === 'fr' ? "Modifier l'article de l'Espace Ados" : 'Edit Teen Space Article')
                      : (language === 'ar' ? 'كتابة مقال جديد لفضاء اليافعين' : language === 'fr' ? "Rédiger un nouvel article pour l'Espace Ados" : 'Write New Article for Teen Space')}
                  </h3>
                  <p className="text-xs text-[#6F8177]">
                    {language === 'ar' ? 'يُنشر باسم الكاتب:' : language === 'fr' ? 'Publié sous le nom de rédacteur :' : 'Published under writer:'}{' '}
                    <strong>{currentUser?.name}</strong>{' '}
                    ({currentUser?.profession
                      ? (language === 'ar' && currentUser.profession.toLowerCase().includes('psychologist') ? 'أخصائي نفسي' : currentUser.profession)
                      : (language === 'ar' ? 'أخصائي نفسي' : language === 'fr' ? 'Psychologue' : 'Psychologist')})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsWriteModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#7F9186] hover:text-[#253A2F] hover:bg-[#EDE8E0] transition-colors cursor-pointer"
                title={language === 'ar' ? 'إغلاق' : language === 'fr' ? 'Fermer' : 'Close'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form id="write-article-form" onSubmit={handleSaveArticle} className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {/* Article Title */}
              <div>
                <label className="block text-xs font-bold text-[#273E31] mb-1.5 uppercase tracking-wide">
                  {language === 'ar' ? 'عنوان المقال' : language === 'fr' ? "Titre de l'article" : 'Article Title'} <span className="text-red-500">*</span>
                </label>
                <input
                  id="article-title-input"
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={
                    language === 'ar'
                      ? 'مثال: التعامل مع قلق الامتحانات: قيمتك لا تحددها علامة'
                      : language === 'fr'
                      ? "ex. Gérer l'anxiété des examens : votre valeur ne dépend pas d'une note"
                      : "e.g. Navigating Exam Anxiety: Why Your Worth Isn't a Grade"
                  }
                  className="w-full px-4 py-2.5 text-sm bg-white rounded-xl border border-[#D9D3C7] focus:outline-none focus:ring-2 focus:ring-[#284939] text-[#23352B] placeholder-[#9EAEA4]"
                />
              </div>

              {/* Image Upload / URL */}
              <div>
                <label className="block text-xs font-bold text-[#273E31] mb-1.5 uppercase tracking-wide">
                  {language === 'ar' ? 'صورة المقال' : language === 'fr' ? "Image de l'article" : 'Article Image'}
                </label>

                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />

                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="px-4 py-2 rounded-xl bg-white border border-[#D7D1C5] hover:bg-[#F4EFE7] text-xs font-semibold text-[#3E5246] transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>
                      {isUploadingImage
                        ? (language === 'ar' ? 'جاري تحميل الصورة...' : language === 'fr' ? 'Chargement de la photo...' : 'Loading photo...')
                        : (language === 'ar' ? 'رفع ملف صورة' : language === 'fr' ? 'Téléverser un fichier' : 'Upload Image File')}
                    </span>
                  </button>

                  <span className="text-xs text-[#829388]">
                    {language === 'ar' ? 'أو الصق رابط الصورة:' : language === 'fr' ? "ou collez le lien de l'image :" : 'or paste image link:'}
                  </span>

                  <input
                    type="url"
                    value={formImage}
                    onChange={(e) => setFormImage(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="flex-1 px-3 py-2 text-xs bg-white rounded-xl border border-[#D9D3C7] focus:outline-none focus:ring-2 focus:ring-[#284939] text-[#23352B] placeholder-[#9EAEA4]"
                  />
                </div>

                {/* Preview Image */}
                {formImage && (
                  <div className="mt-3 relative w-full h-36 rounded-2xl overflow-hidden border border-[#E3DDD1] bg-[#F2EEE7]">
                    <img
                      src={formImage}
                      alt="Article preview"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <button
                      type="button"
                      onClick={() => setFormImage('')}
                      className="absolute top-2 end-2 p-1 rounded-full bg-black/50 hover:bg-black/70 text-white cursor-pointer"
                      title={language === 'ar' ? 'إزالة الصورة' : language === 'fr' ? "Supprimer l'image" : 'Remove image'}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Written Content */}
              <div>
                <label className="block text-xs font-bold text-[#273E31] mb-1.5 uppercase tracking-wide">
                  {language === 'ar' ? 'المحتوى المكتوب' : language === 'fr' ? 'Contenu écrit' : 'Written Content'} <span className="text-red-500">*</span>
                </label>
                <RichTextEditor
                  id="article-content-editor"
                  value={formContent}
                  onChange={(val) => setFormContent(val)}
                  language={language as any}
                  placeholder={
                    language === 'ar'
                      ? 'اكتب كلمات دافئة ومطمئنة لقلوب وعقول اليافعين...'
                      : language === 'fr'
                      ? 'Rédigez des mots bienveillants et rassurants pour les jeunes...'
                      : 'Write compassionate, grounding words for young minds...'
                  }
                  minHeight="240px"
                />
              </div>
            </form>

            {/* Fixed Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-[#F0ECE3] bg-[#FAF8F5] shrink-0">
              <button
                type="button"
                onClick={() => setIsWriteModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#D7D1C5] text-xs font-semibold text-[#57695F] hover:bg-[#F2EFE8] cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء' : language === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button
                type="submit"
                form="write-article-form"
                className="px-5 py-2 rounded-xl bg-[#284939] hover:bg-[#1E372B] text-white text-xs font-semibold cursor-pointer shadow-xs"
              >
                {editingArticle
                  ? (language === 'ar' ? 'حفظ التعديلات' : language === 'fr' ? 'Enregistrer les modifications' : 'Save Changes')
                  : (language === 'ar' ? 'نشر المقال' : language === 'fr' ? "Publier l'article" : 'Publish Article')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          MODAL 2: CONFIRM DELETE (MOVE TO HIDDEN ARTICLES)
         ==================================================== */}
      {deleteConfirmArticle && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
          <div className="bg-white rounded-3xl w-full max-w-sm flex flex-col border border-[#E3DDD1] shadow-xl overflow-hidden text-center p-6 animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-[#FDF0EC] text-[#B65E46] flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#1F362C]">
              {language === 'ar' ? 'إخفاء هذا المقال؟' : language === 'fr' ? 'Masquer cet article ?' : 'Hide this Article?'}
            </h3>
            <p className="text-xs text-[#6B7C72] mt-2 leading-relaxed">
              {language === 'ar' ? (
                <>
                  هل أنت متأكد من رغبتك في إخفاء <strong>&quot;{deleteConfirmArticle.title}&quot;</strong>؟ ستتم إزالته من فضاء اليافعين العام ونقله إلى قسم <strong>المقالات المخفية</strong>، حيث يمكن للكتاب مراجعته أو تعديله أو إعادة نشره لاحقاً.
                </>
              ) : language === 'fr' ? (
                <>
                  Êtes-vous sûr de vouloir masquer <strong>&quot;{deleteConfirmArticle.title}&quot;</strong> ? Il sera retiré de la vue publique et placé dans les <strong>Articles masqués</strong>, où les rédacteurs peuvent le modifier ou le republier plus tard.
                </>
              ) : (
                <>
                  Are you sure you want to delete <strong>&quot;{deleteConfirmArticle.title}&quot;</strong>? It will be removed from the public Teen Space view and moved to the <strong>Hidden Articles</strong> section, where Writers can view, edit, or republish it later.
                </>
              )}
            </p>

            <div className="mt-6 flex items-center justify-center gap-2.5">
              <button
                onClick={() => setDeleteConfirmArticle(null)}
                className="px-4 py-2 rounded-xl border border-[#D7D1C5] text-xs font-semibold text-[#5A6C62] hover:bg-[#F2EFE8] cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء' : language === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button
                id="confirm-hide-article-btn"
                onClick={handleConfirmHideArticle}
                className="px-4 py-2 rounded-xl bg-[#B65E46] hover:bg-[#9B4B36] text-white text-xs font-semibold cursor-pointer"
              >
                {language === 'ar' ? 'نعم، انقل إلى المخفية' : language === 'fr' ? 'Oui, déplacer vers masqués' : 'Yes, Move to Hidden'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          MODAL 3: PERMANENT DELETE CONFIRMATION
         ==================================================== */}
      {permanentDeleteConfirmArticle && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
          <div className="bg-white rounded-3xl w-full max-w-sm flex flex-col border border-[#E3DDD1] shadow-xl overflow-hidden text-center p-6 animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#1F362C]">
              {language === 'ar' ? 'حذف المقال نهائياً؟' : language === 'fr' ? 'Supprimer définitivement l’article ?' : 'Permanently Delete Article?'}
            </h3>
            <p className="text-xs text-[#6B7C72] mt-2 leading-relaxed">
              {language === 'ar' ? (
                <>
                  لا يمكن التراجع عن هذا الإجراء. سيتم حذف <strong>&quot;{permanentDeleteConfirmArticle.title}&quot;</strong> بشكل نهائي من قاعدة البيانات.
                </>
              ) : language === 'fr' ? (
                <>
                  Cette action est irréversible. <strong>&quot;{permanentDeleteConfirmArticle.title}&quot;</strong> sera définitivement supprimé.
                </>
              ) : (
                <>
                  This action cannot be undone. <strong>&quot;{permanentDeleteConfirmArticle.title}&quot;</strong> will be permanently removed from storage.
                </>
              )}
            </p>

            <div className="mt-6 flex items-center justify-center gap-2.5">
              <button
                onClick={() => setPermanentDeleteConfirmArticle(null)}
                className="px-4 py-2 rounded-xl border border-[#D7D1C5] text-xs font-semibold text-[#5A6C62] hover:bg-[#F2EFE8] cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء' : language === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmPermanentDelete}
                className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-semibold cursor-pointer"
              >
                {language === 'ar' ? 'حذف نهائي' : language === 'fr' ? 'Supprimer définitivement' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
