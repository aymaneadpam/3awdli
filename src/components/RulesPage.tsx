import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Edit3,
  Plus,
  Trash2,
  Lock,
  Globe,
  Users,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck
} from 'lucide-react';
import { UserAccount, RuleCategory, RuleVisibilityRole } from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  getRulesCategories,
  initFirestoreRulesSync,
  canViewRuleCategory,
  canEditRuleCategory,
  canManageCustomCategories,
  saveRuleCategory,
  createCustomRuleCategory,
  deleteCustomRuleCategory,
} from '../utils/rulesManagement';
import { isSuperAdmin, isAdministrator } from '../utils/userManagement';
import { RichTextEditor } from './RichTextEditor';
import { RichTextRenderer } from './RichTextRenderer';

interface RulesPageProps {
  currentUser?: UserAccount | null;
  onNavigateHome?: () => void;
}

export const RulesPage: React.FC<RulesPageProps> = ({ currentUser }) => {
  const { language, t } = useLanguage();
  const rulesT = (t as any).rulesSection || {};

  const [categories, setCategories] = useState<RuleCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('general');
  const [isEditing, setIsEditing] = useState(false);
  const [editLangTab, setEditLangTab] = useState<'fr' | 'en' | 'ar'>(language as any);
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Edit form state
  const [formTitle, setFormTitle] = useState({ fr: '', en: '', ar: '' });
  const [formContent, setFormContent] = useState({ fr: '', en: '', ar: '' });
  const [formTargetRole, setFormTargetRole] = useState<RuleVisibilityRole>('all');

  // Sync with Firestore & in-memory cache
  useEffect(() => {
    setCategories(getRulesCategories());
    const unsubscribe = initFirestoreRulesSync((updated) => {
      setCategories(updated);
    });
    return () => unsubscribe();
  }, []);

  // Update editor language tab whenever site language changes
  useEffect(() => {
    setEditLangTab(language as any);
  }, [language]);

  // Filter categories visible to current user
  const visibleCategories = useMemo(() => {
    return categories.filter((cat) => canViewRuleCategory(cat, currentUser));
  }, [categories, currentUser]);

  // Ensure selected category is valid and visible
  useEffect(() => {
    if (visibleCategories.length > 0) {
      const exists = visibleCategories.some((c) => c.id === selectedCategoryId);
      if (!exists) {
        setSelectedCategoryId(visibleCategories[0].id);
      }
    }
  }, [visibleCategories, selectedCategoryId]);

  const activeCategory = useMemo(() => {
    return visibleCategories.find((c) => c.id === selectedCategoryId) || visibleCategories[0];
  }, [visibleCategories, selectedCategoryId]);

  const userCanEditCurrentCategory = useMemo(() => {
    if (!activeCategory) return false;
    return canEditRuleCategory(activeCategory, currentUser);
  }, [activeCategory, currentUser]);

  const userCanManageCustom = useMemo(() => {
    return canManageCustomCategories(currentUser);
  }, [currentUser]);

  // Start editing active category
  const handleStartEdit = () => {
    if (!activeCategory) return;
    setFormTitle({
      fr: activeCategory.title.fr || '',
      en: activeCategory.title.en || '',
      ar: activeCategory.title.ar || '',
    });
    setFormContent({
      fr: activeCategory.content.fr || '',
      en: activeCategory.content.en || '',
      ar: activeCategory.content.ar || '',
    });
    setFormTargetRole(activeCategory.targetRole || 'all');
    setErrorMessage(null);
    setIsEditing(true);
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setIsEditing(false);
    setIsCreatingCustom(false);
    setErrorMessage(null);
  };

  // Save edits
  const handleSaveEdit = async () => {
    if (!activeCategory) return;
    try {
      setErrorMessage(null);
      const updatedCat: RuleCategory = {
        ...activeCategory,
        title: {
          fr: formTitle.fr.trim() || activeCategory.title.fr,
          en: formTitle.en.trim() || activeCategory.title.en,
          ar: formTitle.ar.trim() || activeCategory.title.ar,
        },
        content: {
          fr: formContent.fr,
          en: formContent.en,
          ar: formContent.ar,
        },
        targetRole: formTargetRole,
      };

      await saveRuleCategory(updatedCat, currentUser);
      setCategories(getRulesCategories());
      setIsEditing(false);
      setSaveStatus(rulesT.saveSuccess || 'Rules successfully updated!');
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while saving.');
    }
  };

  // Open Create Custom Category modal
  const handleStartCreateCustom = () => {
    setFormTitle({ fr: '', en: '', ar: '' });
    setFormContent({ fr: '', en: '', ar: '' });
    setFormTargetRole('all');
    setErrorMessage(null);
    setIsCreatingCustom(true);
  };

  // Save new custom category
  const handleSaveNewCustom = async () => {
    try {
      setErrorMessage(null);
      const chosenTitle = formTitle[editLangTab]?.trim();
      if (!chosenTitle) {
        setErrorMessage(
          language === 'ar'
            ? 'يرجى إدخال عنوان لهذا التصنيف.'
            : language === 'fr'
            ? 'Veuillez saisir un titre pour cette catégorie.'
            : 'Please enter a title for this category.'
        );
        return;
      }

      const defaultText = formContent[editLangTab] || '<p></p>';
      const titleObj = {
        fr: formTitle.fr.trim() || chosenTitle,
        en: formTitle.en.trim() || chosenTitle,
        ar: formTitle.ar.trim() || chosenTitle,
      };
      const contentObj = {
        fr: formContent.fr || defaultText,
        en: formContent.en || defaultText,
        ar: formContent.ar || defaultText,
      };

      const created = await createCustomRuleCategory({
        title: titleObj,
        content: contentObj,
        targetRole: formTargetRole,
        creatorUser: currentUser,
      });

      setCategories(getRulesCategories());
      setSelectedCategoryId(created.id);
      setIsCreatingCustom(false);
      setSaveStatus(rulesT.saveSuccess || 'Category created!');
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error creating category.');
    }
  };

  // Delete custom category
  const handleDeleteCustom = async (id: string) => {
    const confirmMsg = rulesT.deleteConfirm || 'Are you sure you want to delete this custom sub-category?';
    if (!window.confirm(confirmMsg)) return;

    try {
      await deleteCustomRuleCategory(id, currentUser);
      setCategories(getRulesCategories());
      setSelectedCategoryId('general');
    } catch (err: any) {
      alert(err.message || 'Error deleting category.');
    }
  };

  // Helper for localized title
  const getCategoryTitle = (cat: RuleCategory) => {
    if (!cat) return '';
    const localized = (cat.title as any)?.[language];
    if (localized) return localized;
    return cat.title.fr || cat.title.en || cat.title.ar || cat.id;
  };

  // Helper for localized content
  const getCategoryContent = (cat: RuleCategory) => {
    if (!cat) return '';
    const localized = (cat.content as any)?.[language];
    if (localized) return localized;
    return cat.content.fr || cat.content.en || cat.content.ar || '';
  };

  const getRoleBadge = (role: RuleVisibilityRole) => {
    switch (role) {
      case 'all':
        return {
          label: rulesT.allRolesBadge || 'Visible to all',
          color: 'bg-[#EBF5EF] text-[#284939] border-[#C2E0CC]',
          icon: Globe,
        };
      case 'listeners':
        return {
          label: rulesT.listenersRoleBadge || 'Listeners & Above',
          color: 'bg-[#EEF2FF] text-[#3730A3] border-[#C7D2FE]',
          icon: Users,
        };
      case 'head_of_listeners':
        return {
          label: rulesT.headOfListenersRoleBadge || 'Head of Listeners & Admin',
          color: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]',
          icon: UserCheck,
        };
      case 'administrators':
        return {
          label: rulesT.administratorsRoleBadge || 'Administrators & Admin',
          color: 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]',
          icon: Lock,
        };
      default:
        return {
          label: role,
          color: 'bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]',
          icon: Eye,
        };
    }
  };

  const isSuper = isSuperAdmin(currentUser);
  const isAdminUser = isAdministrator(currentUser);
  const isAdministratorRulesCategory = activeCategory?.id === 'administrators' || activeCategory?.systemKey === 'administrators';

  return (
    <div className="min-h-screen bg-[#FBF9F5] text-[#1E3428] py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
        {/* Header Banner */}
        <header className="text-center space-y-3 sm:space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EBF3ED] border border-[#CDE1D4] text-xs font-semibold text-[#284939] tracking-wide uppercase shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-[#284939]" />
            <span>{rulesT.badge || 'Governance & Sanctuary Ethics'}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-[#14261C] tracking-tight">
            {rulesT.title || 'Rules & Principles'}
          </h1>
          <p className="text-sm sm:text-base text-[#4C6355] max-w-2xl mx-auto leading-relaxed">
            {rulesT.subtitle ||
              'The commitments, behavioral guidelines, and ethical standards that preserve 3awdli as a safe haven for all.'}
          </p>
        </header>

        {/* Notifications & Feedback */}
        {saveStatus && (
          <div className="flex items-center gap-3 p-4 bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] rounded-2xl shadow-xs animate-fade-in">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-[#059669]" />
            <span className="text-sm font-medium">{saveStatus}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-3 p-4 bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] rounded-2xl shadow-xs animate-fade-in">
            <AlertCircle className="w-5 h-5 shrink-0 text-[#DC2626]" />
            <span className="text-sm font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Sub-Categories Navigation Bar */}
        <div className="bg-white border border-[#E6DEC $\rightarrow$ E6DEC] border-[#E5DEC $\rightarrow$ #E5DED0] border-[#E8E1D5] rounded-2xl p-2 sm:p-2.5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Category Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {visibleCategories.map((cat) => {
                const isSelected = cat.id === selectedCategoryId;
                const badgeInfo = getRoleBadge(cat.targetRole);
                const BadgeIcon = badgeInfo.icon;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(cat.id);
                      setIsEditing(false);
                      setIsCreatingCustom(false);
                    }}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#284939] text-white shadow-xs'
                        : 'bg-[#F9F7F2] text-[#3D5245] hover:bg-[#EFEAE0] hover:text-[#182C20]'
                    }`}
                  >
                    <span>{getCategoryTitle(cat)}</span>
                    {cat.targetRole !== 'all' && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-1 ${
                          isSelected ? 'bg-white/20 text-white' : badgeInfo.color
                        }`}
                        title={badgeInfo.label}
                      >
                        <BadgeIcon className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Add Custom Category Button (Admins only) */}
            {userCanManageCustom && !isCreatingCustom && (
              <button
                type="button"
                onClick={handleStartCreateCustom}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#284939] bg-[#EAF2ED] hover:bg-[#D9E8DD] border border-[#C5DDCB] transition-colors cursor-pointer ms-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{rulesT.addCategoryBtn || 'Add Sub-Category'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Create Custom Category Form Modal/Box */}
        {isCreatingCustom && (
          <div className="bg-white border-2 border-[#284939]/30 rounded-3xl p-6 sm:p-8 shadow-md space-y-6 animate-fade-in">
            <div className="flex items-center justify-between border-b border-[#EFEAE0] pb-4">
              <div>
                <h2 className="text-xl font-bold text-[#14261C]">
                  {rulesT.newCategoryTitle || 'Create New Rules Sub-Category'}
                </h2>
                <p className="text-xs sm:text-sm text-[#5C7265]">
                  {rulesT.newCategoryDesc ||
                    'Define a custom rules subsection with tailored role visibility.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#F3EFE7] hover:bg-[#E7DFD2] text-[#3D5245] transition-colors cursor-pointer"
              >
                {rulesT.cancelBtn || 'Cancel'}
              </button>
            </div>

            {/* Visibility Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#4A5E51]">
                {rulesT.targetRoleLabel || 'Visibility Permission'}
              </label>
              <select
                value={formTargetRole}
                onChange={(e) => setFormTargetRole(e.target.value as RuleVisibilityRole)}
                className="w-full sm:w-80 px-3.5 py-2.5 rounded-xl border border-[#D5CDC0] bg-[#FBF9F5] text-sm text-[#182C20] focus:ring-2 focus:ring-[#284939]/20 focus:border-[#284939] outline-none"
              >
                <option value="all">{rulesT.roleAll || 'Visible to everyone (including visitors)'}</option>
                <option value="listeners">{rulesT.roleListeners || 'Listeners, Head of Listeners & Administrators'}</option>
                <option value="head_of_listeners">{rulesT.roleHeadOfListeners || 'Head of Listeners & Administrators'}</option>
                <option value="administrators">{rulesT.roleAdministrators || 'Administrators only'}</option>
              </select>
            </div>

            {/* Language Switcher for Drafting */}
            <div className="flex items-center gap-2 border-b border-[#F0ECE3] pb-2 text-xs">
              <span className="font-semibold text-[#6E8074]">{rulesT.currentLanguageTab || 'Language view'}:</span>
              {(['fr', 'en', 'ar'] as const).map((langKey) => (
                <button
                  key={langKey}
                  type="button"
                  onClick={() => setEditLangTab(langKey)}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    editLangTab === langKey
                      ? 'bg-[#284939] text-white'
                      : 'bg-[#F0ECE3] text-[#4A5E51] hover:bg-[#E5DFD4]'
                  }`}
                >
                  {langKey === 'fr' ? 'Français' : langKey === 'en' ? 'English' : 'العربية'}
                </button>
              ))}
            </div>

            {/* Category Title Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#4A5E51]">
                {rulesT.categoryTitleLabel || 'Category Title'} ({editLangTab.toUpperCase()})
              </label>
              <input
                type="text"
                value={formTitle[editLangTab]}
                onChange={(e) =>
                  setFormTitle((prev) => ({ ...prev, [editLangTab]: e.target.value }))
                }
                placeholder="e.g. Code de Déontologie / Ethics Charter"
                className="w-full px-4 py-2.5 rounded-xl border border-[#D5CDC0] bg-white text-[#182C20] text-sm focus:ring-2 focus:ring-[#284939]/20 focus:border-[#284939] outline-none"
              />
            </div>

            {/* Rich Text Editor for Content */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#4A5E51]">
                {rulesT.categoryContentLabel || 'Category Rules Content'} ({editLangTab.toUpperCase()})
              </label>
              <RichTextEditor
                value={formContent[editLangTab]}
                onChange={(newHtml) =>
                  setFormContent((prev) => ({ ...prev, [editLangTab]: newHtml }))
                }
                placeholder="Write the rules, bullet points, and guidelines here..."
                language={editLangTab}
                minHeight="280px"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#EFEAE0]">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#F3EFE7] hover:bg-[#E5DFD4] text-[#3D5245] transition-colors cursor-pointer"
              >
                {rulesT.cancelBtn || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveNewCustom}
                className="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#284939] hover:bg-[#1F3A2D] text-white shadow-xs transition-colors cursor-pointer"
              >
                {rulesT.createCategoryBtn || 'Create Sub-Category'}
              </button>
            </div>
          </div>
        )}

        {/* Main Content Card */}
        {activeCategory && !isCreatingCustom && (
          <article className="bg-white border border-[#E8E1D5] rounded-3xl p-6 sm:p-10 shadow-xs space-y-6 sm:space-y-8">
            {/* Top Bar of Category */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#F0ECE3]">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#14261C]">
                    {getCategoryTitle(activeCategory)}
                  </h2>
                  {(() => {
                    const badge = getRoleBadge(activeCategory.targetRole);
                    const BIcon = badge.icon;
                    return (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.color}`}
                      >
                        <BIcon className="w-3.5 h-3.5" />
                        <span>{badge.label}</span>
                      </span>
                    );
                  })()}
                </div>

                {/* Last update metadata */}
                {activeCategory.updatedAt && (
                  <div className="flex items-center gap-1.5 text-xs text-[#7A8E81]">
                    <Clock className="w-3.5 h-3.5 text-[#96A79C]" />
                    <span>
                      {rulesT.lastUpdated || 'Last updated'}: {activeCategory.updatedAt}
                    </span>
                    {activeCategory.updatedBy && (
                      <span>
                        • {rulesT.updatedBy || 'by'} {activeCategory.updatedBy}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons for this category */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Edit Button */}
                {userCanEditCurrentCategory && !isEditing && (
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#284939] hover:bg-[#1E382B] text-white shadow-xs transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>{rulesT.editRulesBtn || 'Edit Category Content'}</span>
                  </button>
                )}

                {/* Notice for Administrators viewing Administrator Rules (when not Super Admin) */}
                {isAdministratorRulesCategory && isAdminUser && !isSuper && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] text-xs font-medium">
                    <Lock className="w-3.5 h-3.5" />
                    <span>{rulesT.adminOnlyNotice || 'Only the Admin account can write or edit Administrator Rules.'}</span>
                  </div>
                )}

                {/* Delete button if custom category */}
                {activeCategory.isCustom && userCanManageCustom && !isEditing && (
                  <button
                    type="button"
                    onClick={() => handleDeleteCustom(activeCategory.id)}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-[#B91C1C] hover:bg-[#FEF2F2] border border-[#FCA5A5] transition-colors cursor-pointer"
                    title={rulesT.deleteCategoryBtn || 'Delete Sub-Category'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{rulesT.deleteCategoryBtn || 'Delete'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* If Editing Mode: Render RichTextEditor Form */}
            {isEditing ? (
              <div className="space-y-6 animate-fade-in">
                {/* Language Switcher for Drafting */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F9F7F2] p-3 rounded-2xl border border-[#E8E1D5]">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-[#5A6E61]">
                      {rulesT.currentLanguageTab || 'Language view'}:
                    </span>
                    {(['fr', 'en', 'ar'] as const).map((langKey) => (
                      <button
                        key={langKey}
                        type="button"
                        onClick={() => setEditLangTab(langKey)}
                        className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                          editLangTab === langKey
                            ? 'bg-[#284939] text-white shadow-xs'
                            : 'bg-white text-[#4A5E51] hover:bg-[#EFEAE0] border border-[#DDD5C7]'
                        }`}
                      >
                        {langKey === 'fr'
                          ? rulesT.frenchTab || 'Français'
                          : langKey === 'en'
                          ? rulesT.englishTab || 'English'
                          : rulesT.arabicTab || 'العربية'}
                      </button>
                    ))}
                  </div>

                  {/* Target role selector for custom categories */}
                  {activeCategory.isCustom && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-[#5A6E61]">
                        {rulesT.targetRoleLabel || 'Visibility'}:
                      </span>
                      <select
                        value={formTargetRole}
                        onChange={(e) => setFormTargetRole(e.target.value as RuleVisibilityRole)}
                        className="px-2.5 py-1 rounded-lg border border-[#D5CDC0] bg-white text-xs text-[#182C20] focus:ring-1 focus:ring-[#284939] outline-none"
                      >
                        <option value="all">{rulesT.roleAll || 'Everyone'}</option>
                        <option value="listeners">{rulesT.roleListeners || 'Listeners+'}</option>
                        <option value="head_of_listeners">{rulesT.roleHeadOfListeners || 'Head of Listeners+'}</option>
                        <option value="administrators">{rulesT.roleAdministrators || 'Admin only'}</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Category Title Field */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#4A5E51]">
                    {rulesT.categoryTitleLabel || 'Category Title'} ({editLangTab.toUpperCase()})
                  </label>
                  <input
                    type="text"
                    value={formTitle[editLangTab]}
                    onChange={(e) =>
                      setFormTitle((prev) => ({ ...prev, [editLangTab]: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-[#D5CDC0] bg-white text-[#182C20] text-sm focus:ring-2 focus:ring-[#284939]/20 focus:border-[#284939] outline-none"
                  />
                </div>

                {/* Rich Text Editor Component */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#4A5E51]">
                    {rulesT.categoryContentLabel || 'Category Rules Content'} ({editLangTab.toUpperCase()})
                  </label>
                  <RichTextEditor
                    value={formContent[editLangTab]}
                    onChange={(newHtml) =>
                      setFormContent((prev) => ({ ...prev, [editLangTab]: newHtml }))
                    }
                    placeholder="Write rules, guidance, directives, headings and lists..."
                    language={editLangTab}
                    minHeight="340px"
                  />
                </div>

                {/* Save and Cancel Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F0ECE3]">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#F3EFE7] hover:bg-[#E5DFD4] text-[#3D5245] transition-colors cursor-pointer"
                  >
                    {rulesT.cancelBtn || 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#284939] hover:bg-[#1E382B] text-white shadow-xs transition-colors cursor-pointer"
                  >
                    {rulesT.saveChangesBtn || 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              /* Reading Mode: Display Content Directly On Page */
              <div className="space-y-6">
                {getCategoryContent(activeCategory) ? (
                  <RichTextRenderer
                    content={getCategoryContent(activeCategory)}
                    className="text-base leading-relaxed text-[#23382C]"
                  />
                ) : (
                  <div className="text-center py-12 px-4 border border-dashed border-[#DDD5C7] rounded-2xl bg-[#FAF8F5] space-y-3">
                    <AlertCircle className="w-8 h-8 text-[#A3B2A8] mx-auto" />
                    <p className="text-sm font-medium text-[#65796D]">
                      {rulesT.noContentYet || 'No rules have been written for this section yet.'}
                    </p>
                    {userCanEditCurrentCategory && (
                      <button
                        type="button"
                        onClick={handleStartEdit}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#284939] text-white hover:bg-[#1E382B] transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{rulesT.editRulesBtn || 'Edit Category Content'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </article>
        )}
      </div>
    </div>
  );
};
