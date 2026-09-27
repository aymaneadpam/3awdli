import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  CalendarClock, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  ArrowLeft, 
  MessageCircleHeart, 
  Sparkles, 
  ShieldCheck, 
  Info, 
  LifeBuoy, 
  Gamepad2, 
  Coffee, 
  X,
  AlertCircle,
  Check,
  Globe
} from 'lucide-react';
import { UserAccount, ChatScheduleWindow, ScheduleWindowType } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { isAdministrator, isSuperAdmin } from '../utils/userManagement';
import { useSiteTimezone } from '../utils/timezoneManagement';
import { 
  useChatSchedule, 
  saveSchedule, 
  deleteSchedule, 
  deleteAllSchedules,
  toggleScheduleActive,
  formatDaysList,
  WEEKDAYS_MAP,
  formatFriendlyNextOpening,
  formatLocalDateString,
  saveStoredSchedules
} from '../utils/scheduleManagement';
import { Logo } from './Logo';

export interface SchedulesPageProps {
  currentUser?: UserAccount | null;
  onNavigateHome: () => void;
  onTalkAnonymously: () => void;
  onOpenEmergencyModal?: () => void;
  onNavigateGames?: () => void;
  onNavigateLounge?: () => void;
}

export const SchedulesPage: React.FC<SchedulesPageProps> = ({
  currentUser,
  onNavigateHome,
  onTalkAnonymously,
  onOpenEmergencyModal,
  onNavigateGames,
  onNavigateLounge,
}) => {
  const { language } = useLanguage();
  const { schedules, isOpen, currentWindow, nextWindow } = useChatSchedule();
  const { timezone, setTimezone, availableTimezones, currentSiteTime } = useSiteTimezone();

  const isSuperAdminAccount = isSuperAdmin(currentUser);
  const isAdministratorAccount = isAdministrator(currentUser);
  const canManageSchedules = isSuperAdminAccount || isAdministratorAccount;

  const [isSavingTimezone, setIsSavingTimezone] = useState(false);
  const [timezoneSuccessMsg, setTimezoneSuccessMsg] = useState<string | null>(null);

  const handleTimezoneChange = async (newTzId: string) => {
    setIsSavingTimezone(true);
    try {
      const success = await setTimezone(newTzId);
      if (success) {
        setTimezoneSuccessMsg(
          language === 'fr'
            ? `Fuseau horaire du site mis à jour : ${newTzId} !`
            : language === 'ar'
            ? `تم تحديث توقيت الموقع إلى : ${newTzId} !`
            : `Site timezone updated to ${newTzId}!`
        );
        setTimeout(() => setTimezoneSuccessMsg(null), 3500);
      }
    } catch (err) {
      console.error('Failed to update timezone:', err);
    } finally {
      setIsSavingTimezone(false);
    }
  };

  // Add/Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    title: string;
    type: ScheduleWindowType;
    date: string;
    dates: string[];
    daysOfWeek: number[];
    startTime: string;
    endTime: string;
    notes: string;
    isActive: boolean;
  }>({
    title: '',
    type: 'weekly_recurring',
    date: '',
    dates: [],
    daysOfWeek: [1],
    startTime: '18:00',
    endTime: '20:00',
    notes: '',
    isActive: true,
  });

  const [dateInputVal, setDateInputVal] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const friendlyNext = formatFriendlyNextOpening(nextWindow, language as any);

  const handleOpenAddModal = () => {
    setEditingScheduleId(null);
    setFormData({
      title: '',
      type: 'weekly_recurring',
      date: formatLocalDateString(new Date()),
      dates: [],
      daysOfWeek: [1],
      startTime: '18:00',
      endTime: '20:00',
      notes: '',
      isActive: true,
    });
    setDateInputVal(formatLocalDateString(new Date()));
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (schedule: ChatScheduleWindow) => {
    setEditingScheduleId(schedule.id);
    setFormData({
      title: schedule.title || '',
      type: schedule.type || 'weekly_recurring',
      date: schedule.date || '',
      dates: schedule.dates || [],
      daysOfWeek: schedule.daysOfWeek || (schedule.dayOfWeek !== undefined ? [schedule.dayOfWeek] : [1]),
      startTime: schedule.startTime || '18:00',
      endTime: schedule.endTime || '20:00',
      notes: schedule.notes || '',
      isActive: schedule.isActive !== false,
    });
    setDateInputVal(schedule.date || formatLocalDateString(new Date()));
    setIsModalOpen(true);
  };

  const handleToggleDay = (dayIndex: number) => {
    setFormData((prev) => {
      const exists = prev.daysOfWeek.includes(dayIndex);
      let updated: number[];
      if (exists) {
        if (prev.daysOfWeek.length === 1) return prev; // Keep at least one
        updated = prev.daysOfWeek.filter((d) => d !== dayIndex);
      } else {
        updated = [...prev.daysOfWeek, dayIndex].sort();
      }
      return { ...prev, daysOfWeek: updated };
    });
  };

  const handleAddDateToDates = () => {
    if (!dateInputVal) return;
    if (formData.dates.includes(dateInputVal)) return;
    setFormData((prev) => ({
      ...prev,
      dates: [...prev.dates, dateInputVal].sort(),
      date: prev.date || dateInputVal,
    }));
  };

  const handleRemoveDate = (dToRemove: string) => {
    setFormData((prev) => {
      const filtered = prev.dates.filter((d) => d !== dToRemove);
      return {
        ...prev,
        dates: filtered,
        date: filtered[0] || '',
      };
    });
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.startTime || !formData.endTime) return;

    try {
      const titleToSave = formData.title.trim() || (
        formData.type === 'weekly_recurring'
          ? `${formatDaysList(formData.daysOfWeek, language as any)} Session`
          : `Session (${formData.dates.length > 0 ? formData.dates.join(', ') : formData.date})`
      );

      await saveSchedule(
        {
          title: titleToSave,
          type: formData.type,
          date: formData.type === 'specific_date' ? (formData.dates[0] || formData.date) : undefined,
          dates: formData.type === 'specific_date' && formData.dates.length > 0 ? formData.dates : undefined,
          daysOfWeek: formData.type === 'weekly_recurring' ? formData.daysOfWeek : undefined,
          startTime: formData.startTime,
          endTime: formData.endTime,
          notes: formData.notes.trim() || undefined,
          isActive: formData.isActive,
          createdAt: new Date().toISOString(),
          createdAtTimestamp: Date.now(),
        },
        editingScheduleId || undefined,
        currentUser?.name || 'Administrator',
        currentUser?.id || 'admin'
      );

      setIsModalOpen(false);
      setSaveSuccessMsg(language === 'fr' ? 'Horaires enregistrés avec succès !' : language === 'ar' ? 'تم حفظ المواعيد بنجاح !' : 'Schedule saved successfully!');
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err) {
      console.error('Error saving schedule:', err);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    await deleteSchedule(id);
    setDeleteConfirmId(null);
  };

  const handleToggleActive = async (id: string, currentVal: boolean) => {
    await toggleScheduleActive(id, !currentVal);
  };

  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const handleDeleteAll = async () => {
    if (window.confirm(
      language === 'fr' 
        ? 'Voulez-vous vraiment supprimer tous les créneaux d\'écoute ? La messagerie sera alors considérée comme fermée.' 
        : language === 'ar' 
        ? 'هل أنت متأكد من حذف جميع مواعيد الاستماع؟ ستكون المحادثات مغلقة تماماً.' 
        : 'Are you sure you want to delete all listening windows? The chat will be closed.'
    )) {
      setIsDeletingAll(true);
      try {
        await deleteAllSchedules();
      } catch (err) {
        console.error('Error deleting all schedules:', err);
      } finally {
        setIsDeletingAll(false);
      }
    }
  };

  // Helper to calculate duration in hours
  const calculateDuration = (start: string, end: string): string => {
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    let diff = (eH * 60 + eM) - (sH * 60 + sM);
    if (diff < 0) diff += 24 * 60; // Overnight
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}m`;
    }
    if (hours > 0) {
      return `${hours}h`;
    }
    return `${mins}m`;
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col font-sans selection:bg-[#E2EBE5] selection:text-[#183626]">
      {/* Top Header */}
      <header className="sticky top-0 z-20 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-[#E9E3D8] px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onNavigateHome}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#304B3B] hover:text-[#193224] p-1.5 rounded-xl hover:bg-[#EAE4D8] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            <span>{language === 'fr' ? 'Retour' : language === 'ar' ? 'الرئيسية' : 'Home'}</span>
          </button>
          <div className="h-4 w-[1px] bg-[#DDD6C8]" />
          <div className="flex items-center gap-2">
            <Logo className="w-6 h-6" />
            <span className="font-bold text-sm text-[#233C2F] font-['Lora',serif]">3awdli</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E5ECE7] text-[#2C523D] border border-[#CFDFD5]">
              {language === 'fr' ? 'Horaires' : language === 'ar' ? 'المواعيد' : 'Schedules'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOpen ? (
            <button
              type="button"
              onClick={onTalkAnonymously}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white bg-[#264634] hover:bg-[#1C3627] px-3.5 py-1.5 rounded-xl shadow-2xs transition-all cursor-pointer"
            >
              <MessageCircleHeart className="w-4 h-4 text-emerald-200" />
              <span>{currentUser ? (language === 'fr' ? 'Parler ouvertement' : language === 'ar' ? 'تحدث بصراحة' : 'Talk Openly') : (language === 'fr' ? 'Parler anonymement' : language === 'ar' ? 'تحدث بهوية مجهولة' : 'Talk Anonymously')}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#FAF0E4] text-[#714E29] border border-[#E8D4BE]">
              <Clock className="w-3.5 h-3.5 text-[#885A2E]" />
              <span>{language === 'fr' ? 'Actuellement fermé' : language === 'ar' ? 'مغلق حالياً' : 'Currently closed'}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        {/* Success toast */}
        {saveSuccessMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-semibold flex items-center gap-2.5 shadow-2xs animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-[#E6EFE9] text-[#244C36] border border-[#CDE1D4]">
            <CalendarClock className="w-3.5 h-3.5 text-[#2C5E43]" />
            <span>
              {language === 'fr' 
                ? 'Permanences & Présence bienveillante' 
                : language === 'ar' 
                ? 'مواعيد الاستماع وفترات الحضور' 
                : 'Listening Shifts & Dedicated Hours'}
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-bold text-[#1F3327] tracking-tight font-['Lora',serif]">
            {language === 'fr'
              ? "Quand nous trouver sur 3awdli"
              : language === 'ar'
              ? 'مواعيد وأوقات الاستماع على 3awdli'
              : 'When to find us on 3awdli'}
          </h1>

          <p className="text-sm sm:text-base text-[#576A5F] leading-relaxed">
            {language === 'fr'
              ? "Parce que chaque échange mérite notre écoute la plus totale et une attention sans faille, notre équipe d'écoutants est présente selon des créneaux planifiés réguliers."
              : language === 'ar'
              ? 'لأن كل محادثة وكل شخص يستحق كامل اهتمامنا وحضورنا دون تشتت، يتواجد فريق المستمعين المتطوعين وفق فترات وجداول محددة.'
              : "Because every conversation deserves our full, undivided attention and authentic human presence, our volunteer listeners are present during scheduled shifts."}
          </p>
        </div>

        {/* Live Status Hero Card */}
        <div className={`p-5 sm:p-7 rounded-3xl border transition-all shadow-xs ${
          isOpen
            ? 'bg-linear-to-br from-[#EAF5EF] via-[#EDF7F1] to-[#E3EFE7] border-[#BCDCC8]'
            : 'bg-linear-to-br from-[#FDF6ED] via-[#FAF3EA] to-[#F3E7D6] border-[#E8D9C5]'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                isOpen 
                  ? 'bg-[#D2EBDE] text-[#1D5134] border border-[#B1DCBF]' 
                  : 'bg-[#F2E0CA] text-[#7A5026] border border-[#E1CAA9]'
              }`}>
                {isOpen ? (
                  <MessageCircleHeart className="w-6 h-6" />
                ) : (
                  <Clock className="w-6 h-6" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    isOpen 
                      ? 'bg-emerald-600 text-white shadow-2xs' 
                      : 'bg-[#82542B] text-white shadow-2xs'
                  }`}>
                    {isOpen && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                      </span>
                    )}
                    {isOpen 
                      ? (language === 'fr' ? 'Ouvert en ce moment' : language === 'ar' ? 'مفتوح الآن' : 'Open Right Now')
                      : (language === 'fr' ? 'Actuellement en pause' : language === 'ar' ? 'مغلق حالياً' : 'Currently Resting')}
                  </span>
                  {isOpen && currentWindow?.endTime && (
                    <span className="text-xs font-semibold text-[#29563C]">
                      {language === 'fr' ? `Jusqu'à ${currentWindow.endTime}` : language === 'ar' ? `حتى ${currentWindow.endTime}` : `Until ${currentWindow.endTime}`}
                    </span>
                  )}
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#E5EAE7] text-[#2C4E3A] border border-[#CCD7D0] inline-flex items-center gap-1">
                    <Globe className="w-3 h-3 text-[#2C4E3A]" />
                    <span>{language === 'fr' ? `Tél. : ${currentSiteTime} (${timezone.shortLabel})` : language === 'ar' ? `التوقيت : ${currentSiteTime} (${timezone.shortLabel})` : `Site Time: ${currentSiteTime} (${timezone.shortLabel})`}</span>
                  </span>
                </div>

                <h2 className="text-lg sm:text-xl font-bold text-[#1E3125] mt-1.5">
                  {isOpen 
                    ? (language === 'fr' 
                        ? 'Nos écoutants sont disponibles pour vous entendre' 
                        : language === 'ar' 
                        ? 'فريق المستمعين متاح حالياً للتحدث معك' 
                        : 'Our listeners are available to hear you right now')
                    : (language === 'fr'
                        ? 'Le chat est fermé pour le moment'
                        : language === 'ar'
                        ? 'المحادثات مغلقة في هذه اللحظة'
                        : 'The chat is currently closed')}
                </h2>

                <p className="text-xs sm:text-sm text-[#5D6F64] mt-1 max-w-xl leading-relaxed">
                  {isOpen 
                    ? (language === 'fr'
                        ? "N'hésitez pas à ouvrir un échange gratuit, confidentiel et sans jugement."
                        : language === 'ar'
                        ? 'لا تتردد في بدء محادثة آمنة، مجانية وسرية 100% بدون أي حكم أو ضغط.'
                        : 'Feel free to start a free, confidential conversation in total freedom and safety.')
                    : (language === 'fr'
                        ? `Prochaine permanence d'écoute : ${friendlyNext}`
                        : language === 'ar'
                        ? `الموعد القادم للاستماع : ${friendlyNext}`
                        : `Next open listening shift: ${friendlyNext}`)}
                </p>
              </div>
            </div>

            {isOpen ? (
              <button
                type="button"
                onClick={onTalkAnonymously}
                className="px-5 py-2.5 rounded-xl bg-[#244533] hover:bg-[#1A3426] text-white font-bold text-sm transition-all shadow-xs hover:shadow-sm cursor-pointer flex items-center justify-center gap-2 shrink-0"
              >
                <MessageCircleHeart className="w-4 h-4 text-emerald-200" />
                <span>{currentUser ? (language === 'fr' ? 'Démarrer une discussion' : language === 'ar' ? 'ابدأ محادثة' : 'Start Discussion') : (language === 'fr' ? 'Parler anonymement' : language === 'ar' ? 'تحدث بهوية مجهولة' : 'Talk Anonymously')}</span>
              </button>
            ) : (
              <div className="shrink-0 flex flex-col items-start sm:items-end gap-1 text-xs">
                <span className="font-semibold text-[#7D532B]">
                  {language === 'fr' ? 'Prochain créneau :' : language === 'ar' ? 'الموعد القادم :' : 'Next session:'}
                </span>
                <span className="font-bold text-sm text-[#462D15] bg-[#F1DECA] px-3 py-1.5 rounded-xl border border-[#DEC4A7]">
                  {friendlyNext}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Administrator Management Bar (Visible ONLY to Administrators) */}
        {canManageSchedules && (
          <div className="p-4 sm:p-5 rounded-2xl bg-purple-50/70 border border-purple-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-purple-700" />
              </div>
              <div>
                <p className="text-xs font-bold text-purple-900 uppercase tracking-wider">
                  {language === 'fr' ? 'Gestion Administrateur' : language === 'ar' ? 'إدارة المشرفين' : 'Administrator Management'}
                </p>
                <p className="text-xs text-purple-800/80">
                  {language === 'fr'
                    ? 'Définissez les dates, jours et heures où le chat 3awdli est accessible.'
                    : language === 'ar'
                    ? 'حدد التواريخ والأيام والساعات التي تكون فيها خدمة المحادثات متاحة.'
                    : 'Configure open-chat dates, weekly shifts, and times when discussions can be started.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-stretch sm:self-auto">
              {schedules.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteAll}
                  disabled={isDeletingAll}
                  className="px-3 py-2 text-xs font-semibold text-rose-700 hover:text-rose-900 hover:bg-rose-100/60 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                  title={language === 'fr' ? 'Supprimer tous les créneaux' : language === 'ar' ? 'حذف جميع المواعيد' : 'Delete all schedules'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeletingAll ? (language === 'fr' ? 'Suppression...' : language === 'ar' ? 'جارٍ الحذف...' : 'Deleting...') : (language === 'fr' ? 'Tout supprimer' : language === 'ar' ? 'حذف الكل' : 'Delete All')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleOpenAddModal}
                className="flex-1 sm:flex-initial px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-2xs hover:shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{language === 'fr' ? 'Ajouter un créneau' : language === 'ar' ? 'إضافة موعد جديد' : 'Add Open Window'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Administrator Site Timezone Setting (Visible ONLY to Administrators) */}
        {canManageSchedules && (
          <div className="p-5 sm:p-6 rounded-2xl bg-linear-to-br from-indigo-50/90 via-purple-50/60 to-purple-100/40 border border-purple-200/90 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Globe className="w-5 h-5 text-purple-100" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-purple-950">
                      {language === 'fr' ? 'Fuseau horaire du site (Administrateurs)' : language === 'ar' ? 'توقيت الموقع المعتمد (خاص بالمشرفين)' : 'Site Timezone Setting (Administrators Only)'}
                    </h3>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-200 text-purple-900 border border-purple-300">
                      {timezone.shortLabel}
                    </span>
                    {timezone.id === 'GMT+0' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {language === 'fr' ? 'Par défaut' : language === 'ar' ? 'الافتراضي' : 'Default'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-purple-800/80 mt-0.5 leading-relaxed">
                    {language === 'fr'
                      ? 'Définit le référentiel horaire officiel pour les ouvertures/fermetures de chat et les horodatages du site (base par défaut : GMT+0).'
                      : language === 'ar'
                      ? 'يحدد التوقيت الرسمي المعتمد لمواعيد فتح وإغلاق المحادثات وتسجيل التوقيتات عبر الموقع (الافتراضي: GMT+0).'
                      : 'Sets the effective time reference site-wide for chat schedule status, listening shifts, and timestamp recordings. Baseline is GMT+0.'}
                  </p>
                </div>
              </div>

              {/* Live Site Time Badge */}
              <div className="flex items-center gap-2 self-start sm:self-center px-3.5 py-2 rounded-xl bg-white/95 border border-purple-200 text-purple-900 shadow-2xs shrink-0">
                <Clock className="w-4 h-4 text-purple-600" />
                <div className="text-xs">
                  <span className="text-purple-600/80 font-medium">{language === 'fr' ? 'Heure du site : ' : language === 'ar' ? 'توقيت الموقع : ' : 'Effective Site Time: '}</span>
                  <span className="font-bold text-purple-950 text-sm ml-1">{currentSiteTime}</span>
                  <span className="text-[10.5px] font-semibold text-purple-700 ml-1">({timezone.shortLabel})</span>
                </div>
              </div>
            </div>

            {timezoneSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-100/90 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{timezoneSuccessMsg}</span>
              </div>
            )}

            {/* Timezone Selector Controls */}
            <div className="pt-1 flex flex-col md:flex-row items-stretch md:items-end gap-3.5">
              <div className="flex-1">
                <label htmlFor="site-timezone-select" className="block text-[11px] font-bold text-purple-900 uppercase tracking-wider mb-1.5">
                  {language === 'fr' ? 'Sélectionner le fuseau horaire' : language === 'ar' ? 'اختر توقيت الموقع' : 'Choose Timezone Offset'}
                </label>
                <select
                  id="site-timezone-select"
                  value={timezone.id}
                  disabled={isSavingTimezone}
                  onChange={(e) => handleTimezoneChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-purple-200 text-xs sm:text-sm font-semibold text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-600 shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {availableTimezones.map((tz) => (
                    <option key={tz.id} value={tz.id}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wider mb-1.5">
                  {language === 'fr' ? 'Raccourcis rapides' : language === 'ar' ? 'اختيارات سريعة' : 'Quick Presets'}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['GMT+0', 'GMT+1', 'GMT+2', 'GMT+3', 'GMT-5'].map((tzId) => {
                    const isSelected = timezone.id === tzId;
                    return (
                      <button
                        key={tzId}
                        type="button"
                        disabled={isSavingTimezone}
                        onClick={() => handleTimezoneChange(tzId)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-purple-700 text-white shadow-xs ring-2 ring-purple-300'
                            : 'bg-white text-purple-900 border border-purple-200 hover:bg-purple-100/70 hover:border-purple-300 shadow-2xs'
                        }`}
                      >
                        {tzId === 'GMT+0' ? 'GMT+0 (Default)' : tzId}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Schedule Windows List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg sm:text-xl font-bold text-[#20372A] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#2E543F]" />
              <span>{language === 'fr' ? 'Horaires et créneaux planifiés' : language === 'ar' ? 'جدول المواعيد والفترات المبرمجة' : 'Scheduled Availability Windows'}</span>
            </h2>
            <span className="text-xs text-[#6C7E74]">
              {schedules.filter((s) => s.isActive !== false).length} {language === 'fr' ? 'créneaux actifs' : language === 'ar' ? 'مواعيد نشطة' : 'active windows'}
            </span>
          </div>

          {schedules.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-[#E7DFD4] text-[#6E7B73]">
              <CalendarClock className="w-10 h-10 mx-auto text-[#A5B3AA] mb-2" />
              <p className="font-semibold text-sm">
                {language === 'fr' ? 'Aucun créneau configuré pour le moment.' : language === 'ar' ? 'لا توجد مواعيد مبرمجة حالياً.' : 'No availability windows configured yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {schedules.map((item) => {
                const isCurrentlyActiveWindow = isOpen && currentWindow?.id === item.id;
                const isItemActive = item.isActive !== false;

                return (
                  <div
                    key={item.id}
                    className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                      isCurrentlyActiveWindow
                        ? 'bg-[#EBF7F0] border-[#9AD1AF] shadow-xs ring-2 ring-emerald-500/20'
                        : isItemActive
                        ? 'bg-white border-[#E6E0D6] shadow-2xs hover:border-[#CCD9D0]'
                        : 'bg-[#F7F5F0]/60 border-[#E8E2D7] opacity-65'
                    }`}
                  >
                    <div>
                      {/* Top status & days */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                            item.type === 'weekly_recurring'
                              ? 'bg-[#E7F0EB] text-[#244F37] border border-[#CFDFD5]'
                              : 'bg-[#F2ECE1] text-[#5E4830] border border-[#DDCFBE]'
                          }`}>
                            {item.type === 'weekly_recurring' 
                              ? (language === 'fr' ? 'Hebdomadaire' : language === 'ar' ? 'أسبوعي متكرر' : 'Weekly Recurring')
                              : (language === 'fr' ? 'Date spécifique' : language === 'ar' ? 'تاريخ محدد' : 'Specific Date')}
                          </span>

                          {isCurrentlyActiveWindow ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white animate-pulse">
                              {language === 'fr' ? 'En cours' : language === 'ar' ? 'جارٍ الآن' : 'Live Now'}
                            </span>
                          ) : !isItemActive ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                              {language === 'fr' ? 'Désactivé' : language === 'ar' ? 'معطل' : 'Paused'}
                            </span>
                          ) : null}
                        </div>

                        {/* Admin Action Buttons */}
                        {canManageSchedules && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleActive(item.id, isItemActive)}
                              className={`p-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                isItemActive 
                                  ? 'text-emerald-700 hover:bg-emerald-50' 
                                  : 'text-gray-500 hover:bg-gray-100'
                              }`}
                              title={isItemActive ? 'Pause window' : 'Activate window'}
                            >
                              {isItemActive ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(item)}
                              className="p-1.5 rounded-lg text-purple-700 hover:bg-purple-100/60 transition-colors cursor-pointer"
                              title="Edit schedule window"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(item.id)}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete schedule window"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="text-base font-bold text-[#1B3024]">
                        {item.title || (
                          item.type === 'weekly_recurring'
                            ? formatDaysList(item.daysOfWeek || [item.dayOfWeek || 0], language as any)
                            : (item.dates?.join(', ') || item.date)
                        )}
                      </h3>

                      {/* Days or Date display */}
                      <div className="mt-1 text-xs text-[#52655A] flex items-center gap-1.5 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-[#305340] shrink-0" />
                        <span>
                          {item.type === 'weekly_recurring'
                            ? formatDaysList(item.daysOfWeek || [item.dayOfWeek || 0], language as any)
                            : item.dates && item.dates.length > 0
                            ? item.dates.join(', ')
                            : item.date}
                        </span>
                      </div>

                      {/* Time Range */}
                      <div className="mt-3 flex items-center justify-between p-2.5 rounded-xl bg-[#FAF8F4] border border-[#E8E2D7]">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#2E533F]" />
                          <span className="font-bold text-sm sm:text-base text-[#1D3627]">
                            {item.startTime} – {item.endTime} <span className="text-xs font-normal text-[#5B6D62]">({timezone.shortLabel})</span>
                          </span>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[#ECE6DC] text-[#4F6056]">
                          {calculateDuration(item.startTime, item.endTime)}
                        </span>
                      </div>

                      {/* Notes / Description */}
                      {item.notes && (
                        <p className="mt-2.5 text-xs text-[#63746B] italic leading-relaxed">
                          "{item.notes}"
                        </p>
                      )}
                    </div>

                    {/* Footer timestamp */}
                    <div className="mt-4 pt-3 border-t border-[#EFE9DF] text-[10.5px] text-[#84958C] flex items-center justify-between">
                      <span>3awdli Shift</span>
                      <span>24h format</span>
                    </div>

                    {/* Delete Confirmation Overlay */}
                    {deleteConfirmId === item.id && (
                      <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs">
                        <p className="font-bold text-rose-900 mb-2">
                          {language === 'fr' ? 'Supprimer ce créneau ?' : language === 'ar' ? 'هل تريد حذف هذا الموعد ؟' : 'Delete this schedule window?'}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDeleteSchedule(item.id)}
                            className="px-3 py-1 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 cursor-pointer"
                          >
                            {language === 'fr' ? 'Oui, supprimer' : language === 'ar' ? 'نعم، احذف' : 'Yes, delete'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-3 py-1 bg-white text-gray-700 font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 cursor-pointer"
                          >
                            {language === 'fr' ? 'Annuler' : language === 'ar' ? 'إلغاء' : 'Cancel'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Peaceful Supportive Alternatives while waiting */}
        <div className="p-6 rounded-3xl bg-linear-to-b from-[#F7F4EE] to-[#FAF8F5] border border-[#E5DFD4] space-y-4">
          <div className="flex items-center gap-2.5">
            <Info className="w-5 h-5 text-[#305240]" />
            <h3 className="font-bold text-[#1C3326] text-base">
              {language === 'fr' ? 'Ressources disponibles en dehors des horaires' : language === 'ar' ? 'مساحات متاحة دائماً حتى خارج أوقات الاستماع' : 'Always available outside scheduled windows'}
            </h3>
          </div>

          <p className="text-xs sm:text-sm text-[#5D6F64] leading-relaxed">
            {language === 'fr'
              ? "Si vous nous visitez en dehors de nos heures d'ouverture, plusieurs espaces restent à votre libre disposition sans aucune contrainte de temps :"
              : language === 'ar'
              ? 'إذا قمت بزيارتنا خارج أوقات ومواعيد فتح المحادثات، تبقى عدة مساحات وفضاءات رهن إشارتك للاسترخاء والدعم :'
              : 'If you visit outside our open listening shifts, you can still find calm, supportive reflections and grounding spaces freely available at all times:'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {/* Calming Games */}
            <div
              onClick={onNavigateGames}
              className="p-4 rounded-2xl bg-white border border-[#E3DDD1] hover:border-[#BFD5C6] transition-all cursor-pointer group shadow-2xs"
            >
              <div className="w-9 h-9 rounded-xl bg-[#E6F0EB] text-[#29513C] flex items-center justify-center mb-2.5 group-hover:bg-[#D4E8DC] transition-colors">
                <Gamepad2 className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-xs sm:text-sm text-[#1F3529]">
                {language === 'fr' ? 'Jeux de pleine conscience' : language === 'ar' ? 'ألعاب الاسترخاء' : 'Mindfulness Games'}
              </h4>
              <p className="text-[11px] text-[#69796F] mt-1">
                {language === 'fr' ? 'Respiration guidée, galets & pluie apaisante.' : language === 'ar' ? 'تمارين تنفس وتأمل مهدئة للضغط.' : 'Synchronous breathing & gentle rain.'}
              </p>
            </div>

            {/* The Lounge */}
            <div
              onClick={onNavigateLounge}
              className="p-4 rounded-2xl bg-white border border-[#E3DDD1] hover:border-[#DACDBA] transition-all cursor-pointer group shadow-2xs"
            >
              <div className="w-9 h-9 rounded-xl bg-[#F4ECE0] text-[#715330] flex items-center justify-center mb-2.5 group-hover:bg-[#EBDECB] transition-colors">
                <Coffee className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-xs sm:text-sm text-[#342416]">
                {language === 'fr' ? 'Le Lounge 3awdli' : language === 'ar' ? 'الصالون ومقالات الدعم' : 'The Community Lounge'}
              </h4>
              <p className="text-[11px] text-[#796B5C] mt-1">
                {language === 'fr' ? 'Articles intimes et réflexions bienveillantes.' : language === 'ar' ? 'مقالات داعمة وخواطر للتأمل والمواساة.' : 'Reflective articles & community topics.'}
              </p>
            </div>

            {/* Emergency Hotline */}
            <div
              onClick={onOpenEmergencyModal}
              className="p-4 rounded-2xl bg-white border border-[#FADBD3] hover:border-[#F5B5A6] transition-all cursor-pointer group shadow-2xs"
            >
              <div className="w-9 h-9 rounded-xl bg-[#FFF2EE] text-[#C23C26] flex items-center justify-center mb-2.5 group-hover:bg-[#FDE2DB] transition-colors">
                <LifeBuoy className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-xs sm:text-sm text-[#8C2919]">
                {language === 'fr' ? 'Lignes de crise 24h/24' : language === 'ar' ? 'أرقام الطوارئ 24/7' : '24/7 Crisis Helplines'}
              </h4>
              <p className="text-[11px] text-[#9E4D3E] mt-1">
                {language === 'fr' ? 'SAMU, Police, Protection Civile gratuits.' : language === 'ar' ? 'أرقام المساعدة الفورية المجانية.' : 'Free official emergency contacts.'}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Administrator Add / Edit Schedule Window Modal */}
      {isModalOpen && canManageSchedules && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div 
            className="w-full max-w-lg bg-[#FAF8F5] rounded-3xl border border-[#E3DDD1] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-purple-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CalendarClock className="w-5 h-5 text-purple-200" />
                <h3 className="font-bold text-base">
                  {editingScheduleId
                    ? (language === 'fr' ? 'Modifier le créneau d\'écoute' : language === 'ar' ? 'تعديل موعد الاستماع' : 'Edit Schedule Window')
                    : (language === 'fr' ? 'Ajouter un créneau d\'écoute' : language === 'ar' ? 'إضافة موعد استماع جديد' : 'Add Open-Chat Window')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-purple-200 hover:text-white hover:bg-purple-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveModal} className="p-6 overflow-y-auto space-y-4">
              {/* Type Switcher */}
              <div>
                <label className="block text-xs font-bold text-[#32493C] uppercase tracking-wider mb-1.5">
                  {language === 'fr' ? 'Type de créneau' : language === 'ar' ? 'نوع الموعد' : 'Window Type'}
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-[#ECE7DC] rounded-xl border border-[#DDD5C7]">
                  <button
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, type: 'weekly_recurring' }))}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      formData.type === 'weekly_recurring'
                        ? 'bg-[#2A4B37] text-white shadow-2xs'
                        : 'text-[#4F6256] hover:text-[#253A2E]'
                    }`}
                  >
                    {language === 'fr' ? 'Jour(s) récurrent(s)' : language === 'ar' ? 'أيام أسبوعية متكررة' : 'Weekly Recurring'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, type: 'specific_date' }))}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      formData.type === 'specific_date'
                        ? 'bg-[#2A4B37] text-white shadow-2xs'
                        : 'text-[#4F6256] hover:text-[#253A2E]'
                    }`}
                  >
                    {language === 'fr' ? 'Date(s) spécifique(s)' : language === 'ar' ? 'تاريخ محدد' : 'Specific Date(s)'}
                  </button>
                </div>
              </div>

              {/* Title / Label */}
              <div>
                <label className="block text-xs font-semibold text-[#32493C] mb-1">
                  {language === 'fr' ? 'Intitulé du créneau (optionnel)' : language === 'ar' ? 'عنوان الموعد (اختياري)' : 'Window Title (optional)'}
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                  placeholder={formData.type === 'weekly_recurring' ? 'Ex: Soirée bienveillante' : 'Ex: Session spéciale du 24'}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#DCD5C7] text-sm text-[#1F3327] placeholder:text-[#99A69F] focus:outline-none focus:ring-2 focus:ring-[#2C4E3A]"
                />
              </div>

              {/* Weekly Days Selector */}
              {formData.type === 'weekly_recurring' ? (
                <div>
                  <label className="block text-xs font-semibold text-[#32493C] mb-1.5">
                    {language === 'fr' ? 'Jour(s) de la semaine' : language === 'ar' ? 'أيام الأسبوع' : 'Days of the week'}
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                      const isSelected = formData.daysOfWeek.includes(d);
                      const dayName = WEEKDAYS_MAP[d];
                      const label = language === 'fr' ? dayName.shortFr : language === 'ar' ? dayName.shortAr : dayName.shortEn;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => handleToggleDay(d)}
                          className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-[#294B37] text-white border-[#294B37] shadow-2xs'
                              : 'bg-white text-[#4A5D52] border-[#DED7CA] hover:bg-[#F2EDE4]'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-[#69796F] mt-1.5">
                    {language === 'fr' ? 'Sélectionnez un ou plusieurs jours pour cette plage horaire.' : language === 'ar' ? 'اختر يوماً أو عدة أيام لهذا التوقيت.' : 'Select one or more days for this time window.'}
                  </p>
                </div>
              ) : (
                /* Specific Date Selector */
                <div>
                  <label className="block text-xs font-semibold text-[#32493C] mb-1">
                    {language === 'fr' ? 'Date(s) de la permanence' : language === 'ar' ? 'تاريخ أو تواريخ الجلسة' : 'Date(s)'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={dateInputVal}
                      onChange={(e) => setDateInputVal(e.target.value)}
                      className="flex-1 px-3.5 py-2 rounded-xl bg-white border border-[#DCD5C7] text-sm text-[#1F3327] focus:outline-none focus:ring-2 focus:ring-[#2C4E3A]"
                    />
                    <button
                      type="button"
                      onClick={handleAddDateToDates}
                      className="px-3 py-2 bg-[#284936] hover:bg-[#1E3728] text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      {language === 'fr' ? 'Ajouter date' : language === 'ar' ? 'أضف تاريخاً' : 'Add date'}
                    </button>
                  </div>

                  {formData.dates.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {formData.dates.map((d) => (
                        <span
                          key={d}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#E6F0EB] text-[#244E36] text-xs font-semibold border border-[#CCE0D3]"
                        >
                          <span>{d}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDate(d)}
                            className="hover:text-rose-700 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Time Range (Start Time & End Time) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#32493C] mb-1">
                    {language === 'fr' ? 'Heure de début' : language === 'ar' ? 'وقت البدء' : 'Start Time'} <span className="font-normal text-[#5B6D62]">({timezone.shortLabel})</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData((p) => ({ ...p, startTime: e.target.value }))}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#DCD5C7] text-sm font-semibold text-[#1F3327] focus:outline-none focus:ring-2 focus:ring-[#2C4E3A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#32493C] mb-1">
                    {language === 'fr' ? 'Heure de fin' : language === 'ar' ? 'وقت الانتهاء' : 'End Time'} <span className="font-normal text-[#5B6D62]">({timezone.shortLabel})</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.endTime}
                    onChange={(e) => setFormData((p) => ({ ...p, endTime: e.target.value }))}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#DCD5C7] text-sm font-semibold text-[#1F3327] focus:outline-none focus:ring-2 focus:ring-[#2C4E3A]"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-[#32493C] mb-1">
                  {language === 'fr' ? 'Notes ou description (optionnel)' : language === 'ar' ? 'ملاحظات وتوجيهات (اختياري)' : 'Notes / description (optional)'}
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                  placeholder={language === 'fr' ? 'Ex: Écoute empathique et bienveillante pour démarrer le week-end...' : 'Ex: Compassionate support...'}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#DCD5C7] text-sm text-[#1F3327] placeholder:text-[#99A69F] focus:outline-none focus:ring-2 focus:ring-[#2C4E3A] resize-none"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="schedule-active-checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))}
                  className="w-4 h-4 rounded text-[#284936] focus:ring-[#284936] cursor-pointer"
                />
                <label htmlFor="schedule-active-checkbox" className="text-xs font-semibold text-[#253B2E] cursor-pointer">
                  {language === 'fr' ? 'Créneau actif immédiatement' : language === 'ar' ? 'تفعيل هذا الموعد فوراً' : 'Window active immediately'}
                </label>
              </div>

              {/* Form Buttons */}
              <div className="pt-3 border-t border-[#E8E2D7] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#57685D] hover:bg-[#EAE4D8] transition-colors cursor-pointer"
                >
                  {language === 'fr' ? 'Annuler' : language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs sm:text-sm font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer"
                >
                  {editingScheduleId
                    ? (language === 'fr' ? 'Enregistrer les modifications' : language === 'ar' ? 'حفظ التعديلات' : 'Save Changes')
                    : (language === 'fr' ? 'Créer le créneau' : language === 'ar' ? 'إنشاء الموعد' : 'Create Window')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
