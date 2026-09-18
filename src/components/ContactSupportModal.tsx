import { useState, type FormEvent, useEffect } from 'react';
import { 
  HelpCircle, 
  X, 
  Send, 
  CheckCircle2, 
  HeartHandshake, 
  AlertCircle, 
  Mail, 
  ShieldAlert,
  ShieldCheck,
  Lock,
  Ban
} from 'lucide-react';
import { UserAccount, SupportCategory } from '../types';
import { createSupportRequest } from '../utils/supportRequests';
import { useLanguage } from '../context/LanguageContext';

interface ContactSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserAccount | null;
  onTalkAnonymously?: () => void;
  onRedirectToChat?: () => void;
  initialCategory?: SupportCategory;
}

export const ContactSupportModal = ({
  isOpen,
  onClose,
  currentUser,
  onTalkAnonymously,
  onRedirectToChat,
  initialCategory,
}: ContactSupportModalProps) => {
  const { language } = useLanguage();
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState<SupportCategory>(initialCategory || 'technical');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [reportedListenerOrDiscussion, setReportedListenerOrDiscussion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryOptions = [
    { 
      id: 'technical' as SupportCategory, 
      label: language === 'ar' ? 'مشكلة تقنية' : language === 'fr' ? 'Problème technique' : 'Technical issue', 
      description: language === 'ar' ? 'أخطاء، بطء التحميل أو الصوت' : language === 'fr' ? 'Bugs, chargement de page ou audio' : 'Bugs, page loading, or audio issues' 
    },
    { 
      id: 'account' as SupportCategory, 
      label: language === 'ar' ? 'مشكلة في الحساب' : language === 'fr' ? 'Problème de compte' : 'Account problem', 
      description: language === 'ar' ? 'تسجيل الدخول، كلمة المرور أو الإعدادات' : language === 'fr' ? 'Connexion, mot de passe ou paramètres' : 'Login, password, or profile settings' 
    },
    { 
      id: 'feedback' as SupportCategory, 
      label: language === 'ar' ? 'اقتراحات وآراء' : language === 'fr' ? 'Commentaires' : 'Feedback', 
      description: language === 'ar' ? 'أفكار لتطوير وتحسين منصة 3awdli' : language === 'fr' ? 'Idées ou suggestions pour améliorer 3awdli' : 'Ideas or suggestions to improve 3awdli' 
    },
    { 
      id: 'report_listener' as SupportCategory, 
      label: language === 'ar' ? 'إبلاغ عن مستمع' : language === 'fr' ? 'Signaler un écoutant' : 'Report a listener', 
      description: language === 'ar' ? 'سلوك مقلق أو تقرير أخلاقي' : language === 'fr' ? 'Comportement préoccupant ou rapport éthique' : 'Concerning behavior or ethics report' 
    },
    { 
      id: 'account_ban' as SupportCategory, 
      label: language === 'ar' ? 'حظر الحساب' : language === 'fr' ? 'Bannissement' : 'Account Ban', 
      description: language === 'ar' ? 'استفسار أو طعن في تعليق الحساب' : language === 'fr' ? 'Recours ou questions sur un compte banni' : 'Questions or appeals regarding a suspended or banned account' 
    },
    { 
      id: 'general' as SupportCategory, 
      label: language === 'ar' ? 'استفسار عام' : language === 'fr' ? 'Demande générale' : 'General inquiry', 
      description: language === 'ar' ? 'أسئلة عامة حول المنصة وخدماتها' : language === 'fr' ? 'Questions générales sur la plateforme' : 'General questions regarding the platform' 
    },
  ];

  // Initialize email and category when modal opens or user changes
  useEffect(() => {
    if (isOpen) {
      if (currentUser?.email) {
        setEmail(currentUser.email);
      } else {
        setEmail('');
      }
      const activeCat = initialCategory || 'technical';
      setCategory(activeCat);
      setSubject('');
      setMessage('');
      setReportedListenerOrDiscussion('');
      setError(null);
      setIsSuccess(false);
    }
  }, [isOpen, currentUser, initialCategory]);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    if (!trimmedEmail) {
      setError('Please provide an email address so we can reply to you.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!trimmedSubject) {
      setError('Please enter a short subject describing your inquiry.');
      return;
    }

    if (!trimmedMessage) {
      setError('Please enter your message or question.');
      return;
    }

    setIsSubmitting(true);

    try {
      createSupportRequest({
        subject: trimmedSubject,
        message: trimmedMessage,
        email: trimmedEmail,
        category,
        reportedListenerOrDiscussion:
          category === 'report_listener' ? reportedListenerOrDiscussion.trim() : undefined,
        priority: category === 'report_listener' || category === 'account_ban' ? 'urgent' : 'normal',
        destinationEmail: 'aymane.habbo@gmail.com',
        userId: currentUser?.id,
        userName: currentUser?.name,
      });

      setIsSuccess(true);
    } catch (err) {
      console.error('Error submitting support request:', err);
      setError('An error occurred while submitting your message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRedirectToListenerChat = () => {
    onClose();
    if (onRedirectToChat) {
      onRedirectToChat();
    } else if (onTalkAnonymously) {
      onTalkAnonymously();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/40 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-[#FAF8F5] border border-[#E5DFD5] rounded-3xl max-w-lg w-full flex flex-col shadow-2xl relative overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        id="contact-support-modal"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 shrink-0 flex items-start justify-between border-b border-[#EBE6DD]">
          <div className="flex items-center gap-3 pe-4">
            <div className="w-10 h-10 rounded-2xl bg-[#E8F1EC] text-[#294B3A] border border-[#CFE1D6] flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#233129] font-['Lora',serif]">
                {language === 'ar' ? 'الاتصال بفريق الدعم التقني' : language === 'fr' ? "Contacter l'assistance du site" : 'Contact Site Support'}
              </h3>
              <p className="text-xs text-[#64746A]">
                {language === 'ar'
                  ? 'خدمة المستخدمين، المشاكل التقنية والاستفسارات حول الموقع'
                  : language === 'fr' 
                  ? 'Service client, problèmes techniques et demandes sur le site' 
                  : 'Customer service, technical issues & site inquiries'}
              </p>
            </div>
          </div>

          <button
            id="contact-modal-close-btn"
            onClick={onClose}
            className="text-[#75847B] hover:text-[#2A3B31] p-1.5 rounded-xl hover:bg-[#EAE4D9] transition-colors cursor-pointer shrink-0"
            aria-label="Close contact modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6">
          {/* Crucial Tone Notice Banner */}
          <div className="mb-5 p-3.5 rounded-2xl bg-[#F4EFE7] border border-[#E2DAD0] flex items-start gap-2.5 text-xs text-[#526258] leading-relaxed">
            <AlertCircle className="w-4 h-4 text-[#7B4E3E] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[#2C3B32]">
                {language === 'ar' ? 'تنويه: ليس للدعم النفسي العاطفي:' : language === 'fr' ? 'Pas pour le soutien émotionnel :' : 'Not for emotional support:'}
              </span>{' '}
              {language === 'ar'
                ? 'هذا النموذج مخصص للأمور التقنية ومشاكل الحسابات أو الإبلاغ عن أي تجاوز، وليس للمحادثات النفسية والاستماع.'
                : language === 'fr'
                ? "Ce formulaire est destiné aux problèmes techniques, aux soucis de compte, aux avis sur le site ou au signalement d'un comportement préoccupant d'un écoutant — pas au soutien émotionnel."
                : 'This form is for technical issues, account problems, feedback about the site, or reporting concerning behavior from a listener — not for emotional support.'}
              <div className="mt-2 pt-2 border-t border-[#DFD6CA] flex items-center gap-1.5">
                <span>
                  {language === 'ar'
                    ? 'هل تبحث عن مستمع ليفهمك الآن؟'
                    : language === 'fr'
                    ? 'Vous cherchez une écoute bienveillante dès maintenant ?'
                    : 'Looking for a listening ear right now?'}
                </span>
                <button
                  type="button"
                  onClick={handleRedirectToListenerChat}
                  className="font-semibold text-[#2A4839] hover:text-[#183024] underline cursor-pointer inline-flex items-center gap-1"
                >
                  <HeartHandshake className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'تحدث معنا' : language === 'fr' ? 'Parlez-nous' : 'Talk to us'}</span>
                </button>
              </div>
            </div>
          </div>

          {isSuccess ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#E5F2EB] text-[#254635] border border-[#CCE2D5] flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-6 h-6 text-emerald-700" />
              </div>

              <div>
                <h4 className="text-lg font-bold text-[#1E3227] font-['Lora',serif]">
                  {language === 'ar' ? 'تم استلام رسالتك من قبل الإدارة' : language === 'fr' ? "Message reçu par l'administration" : 'Message Received by Administration'}
                </h4>
                <p className="text-xs sm:text-sm text-[#55675D] max-w-sm mx-auto mt-1.5 leading-relaxed">
                  {language === 'ar' ? (
                    <>شكراً لتواصلك معنا. تم حفظ طلبك بأمان في لوحة الإدارة وسيقوم المشرفون بمراجعته. سنرد عليك على <strong>{email}</strong> في أقرب وقت.</>
                  ) : language === 'fr' ? (
                    <>Merci de nous avoir contactés. Votre demande a été enregistrée en toute sécurité dans la console d'administration. Nous vous répondrons à <strong>{email}</strong> dans les meilleurs délais.</>
                  ) : (
                    <>Thank you for reaching out. Your inquiry has been securely stored in the Admin Support console and queued for direct administrative review. We will reply to <strong>{email}</strong> promptly.</>
                  )}
                </p>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 bg-[#2B4B3A] hover:bg-[#1E372A] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {language === 'ar' ? 'إغلاق' : language === 'fr' ? 'Terminer' : 'Done'}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-[#FBF0EE] border border-[#E9C8C4] text-xs text-[#9B2F23] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold text-[#304137] mb-1.5">
                  {language === 'ar' ? 'بريدك الإلكتروني' : language === 'fr' ? 'Votre adresse e-mail' : 'Your Email Address'} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-[#76857C]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="contact-email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full ps-10 pe-3.5 py-2.5 text-xs sm:text-sm bg-white border border-[#DDD7CD] rounded-xl text-[#233129] placeholder-[#9BA7A0] focus:outline-hidden focus:ring-2 focus:ring-[#325243]/20 focus:border-[#325243] transition-all"
                  />
                </div>
                {currentUser ? (
                  <p className="text-[11px] text-[#5D7065] mt-1 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-emerald-700 shrink-0" />
                    <span>
                      {language === 'ar'
                        ? `مرتبط بحسابك الحالي (${currentUser.name})`
                        : language === 'fr'
                        ? `Lié à votre compte connecté (${currentUser.name})`
                        : `Auto-attached from your signed-in account (${currentUser.name})`}
                    </span>
                  </p>
                ) : (
                  <p className="text-[11px] text-[#7A8A80] mt-1">
                    {language === 'ar'
                      ? 'يمكنك الإرسال بهوية مجهولة؛ أدخل بريداً إلكترونياً لتلقي ردنا.'
                      : language === 'fr' 
                      ? "Vous pouvez soumettre de manière anonyme ; entrez un e-mail pour recevoir notre réponse." 
                      : 'You can submit anonymously; enter any email where you wish to receive our reply.'}
                  </p>
                )}
              </div>

              {/* Category Selection */}
              <div>
                <label className="block text-xs font-semibold text-[#304137] mb-1.5">
                  {language === 'ar' ? 'الفئة / الموضوع' : language === 'fr' ? 'Catégorie / Thème' : 'Category / Topic'} <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {categoryOptions.map((opt) => {
                    const isSelected = category === opt.id;
                    const isReportListener = opt.id === 'report_listener';
                    const isAccountBan = opt.id === 'account_ban';
                    return (
                      <button
                        key={opt.id}
                        id={`contact-category-${opt.id}`}
                        type="button"
                        onClick={() => {
                          setCategory(opt.id);
                        }}
                        className={`p-2.5 rounded-xl text-start border text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? isReportListener
                              ? 'bg-[#FEF2F2] border-red-300 text-red-800 ring-2 ring-red-400/20 shadow-xs'
                              : isAccountBan
                              ? 'bg-rose-50 border-rose-300 text-rose-800 ring-2 ring-rose-400/20 shadow-xs'
                              : 'bg-[#294B3A] border-[#294B3A] text-white shadow-xs'
                            : isReportListener
                            ? 'bg-white border-[#F2D7D5] text-[#93332A] hover:bg-[#FEF2F2]'
                            : isAccountBan
                            ? 'bg-white border-rose-200 text-rose-800 hover:bg-rose-50/70'
                            : 'bg-white border-[#DDD7CD] text-[#48594F] hover:bg-[#F5F2EB]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {isReportListener && (
                            <ShieldAlert className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-red-700' : 'text-red-500'}`} />
                          )}
                          {isAccountBan && (
                            <Ban className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-rose-700' : 'text-rose-500'}`} />
                          )}
                          <span className="truncate">{opt.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Account Ban Appeal Callout */}
              {category === 'account_ban' && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 space-y-2">
                  <div className="flex items-start gap-2.5 text-xs text-rose-900 leading-relaxed">
                    <Ban className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">
                        {language === 'ar' ? 'مراجعة / طعن في حظر الحساب:' : language === 'fr' ? 'Examen / Recours contre le bannissement :' : 'Administrative Ban Review / Appeal:'}
                      </span>{' '}
                      {language === 'ar'
                        ? 'سيتم تحويل طلبك مباشرة وبأولوية إلى بريد الإدارة. يُرجى توضيح التفاصيل لمراجعة القرار.'
                        : language === 'fr'
                        ? "Votre demande sera transmise en priorité aux administrateurs. Veuillez indiquer votre adresse e-mail et des explications afin qu'ils puissent examiner la décision."
                        : 'Your inquiry will be placed in the priority Administrator Support inbox. Please provide your email and details regarding your activity so the Administrators can review your ban.'}
                    </div>
                  </div>
                </div>
              )}

              {/* Report a listener reassurance callout & details */}
              {category === 'report_listener' && (
                <div className="p-3.5 rounded-2xl bg-[#FFF5F5] border border-[#FED7D7] space-y-3">
                  <div className="flex items-start gap-2.5 text-xs text-[#9B2C2C] leading-relaxed">
                    <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">
                        {language === 'ar' ? 'مراجعة إدارية سرية ومحمية:' : language === 'fr' ? 'Examen administratif confidentiel :' : 'Confidential Administrative Review:'}
                      </span>{' '}
                      {language === 'ar'
                        ? 'تقريرك يُرسل بسرية تامة لمشرفي الموقع فقط، ولن يتمكن أي مستمع من الاطلاع عليه.'
                        : language === 'fr'
                        ? 'Votre signalement est transmis strictement aux administrateurs du site pour évaluation confidentielle. Les écoutants ne peuvent pas voir ce rapport.'
                        : 'Your report is submitted strictly to site administrators for private evaluation. Listeners cannot view this report.'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#742A2A] mb-1">
                      {language === 'ar'
                        ? 'ما هي المحادثة أو من هو المستمع المعني؟ (اختياري)'
                        : language === 'fr' 
                        ? 'À quelle conversation ou à quel écoutant cela se rapporte-t-il ? (Facultatif)' 
                        : 'Which conversation or listener does this relate to? (Optional)'}
                    </label>
                    <input
                      type="text"
                      value={reportedListenerOrDiscussion}
                      onChange={(e) => setReportedListenerOrDiscussion(e.target.value)}
                      placeholder={
                        language === 'ar'
                          ? 'مثال: اسم المستمع، تاريخ/وقت أو موضوع النقاش'
                          : language === 'fr'
                          ? "ex. : Nom de l'écoutant, date/heure ou sujet"
                          : "e.g., Listener name, date/time, or topic of discussion"
                      }
                      className="w-full px-3 py-2 text-xs bg-white border border-[#FEB2B2] rounded-xl text-[#2D3748] placeholder-[#A0AEC0] focus:outline-hidden focus:ring-2 focus:ring-red-400/20 focus:border-red-400"
                    />
                  </div>
                </div>
              )}

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-[#304137] mb-1.5">
                  {language === 'ar' ? 'عنوان الموضوع' : language === 'fr' ? 'Sujet' : 'Subject'} <span className="text-red-500">*</span>
                </label>
                <input
                  id="contact-subject-input"
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={
                    category === 'report_listener'
                      ? (language === 'ar' ? 'مثال: تعامل غير لائق مع مستمع' : language === 'fr' ? "ex. : Échange préoccupant avec un écoutant" : 'e.g., Concerning interaction with listener')
                      : (language === 'ar' ? 'مثال: مشكلة في الدخول، خطأ في الموقع، فكرة تطوير...' : language === 'fr' ? "ex. : Question sur mon compte, Erreur du site, Suggestion..." : 'e.g., Question about my account, Site error, Suggestion...')
                  }
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-[#DDD7CD] rounded-xl text-[#233129] placeholder-[#9BA7A0] focus:outline-hidden focus:ring-2 focus:ring-[#325243]/20 focus:border-[#325243] transition-all"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-semibold text-[#304137] mb-1.5">
                  {language === 'ar' ? 'الرسالة أو التفاصيل' : language === 'fr' ? 'Message' : 'Message'} <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="contact-message-input"
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    category === 'report_listener'
                      ? (language === 'ar' ? 'يرجى توضيح ما حدث في المحادثة ليتسنى للإدارة اتخاذ الإجراء المناسب...' : language === 'fr' ? "Veuillez décrire ce qui s'est passé pour que l'administration puisse prendre les mesures adaptées..." : 'Please describe what happened during the conversation so the administrator can take appropriate action...')
                      : (language === 'ar' ? 'يرجى كتابة تفاصيل استفسارك أو المشكلة التي واجهتها بدقة...' : language === 'fr' ? "Veuillez préciser votre problème technique, votre question ou votre retour..." : 'Please share the details of your technical issue, question, or site feedback...')
                  }
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-[#DDD7CD] rounded-xl text-[#233129] placeholder-[#9BA7A0] focus:outline-hidden focus:ring-2 focus:ring-[#325243]/20 focus:border-[#325243] transition-all resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-[#54645B] hover:text-[#25392F] hover:bg-[#EFECE5] rounded-xl transition-colors cursor-pointer"
                >
                  {language === 'ar' ? 'إلغاء' : language === 'fr' ? 'Annuler' : 'Cancel'}
                </button>

                <button
                  id="contact-submit-btn"
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2B4B3A] hover:bg-[#1E372A] disabled:bg-[#8CA296] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {isSubmitting ? (
                    <span>{language === 'ar' ? 'جاري الإرسال...' : language === 'fr' ? 'Envoi en cours...' : 'Submitting...'}</span>
                  ) : (
                    <>
                      <span>{language === 'ar' ? 'إرسال للإدارة' : language === 'fr' ? "Envoyer à l'admin" : 'Send to Admin'}</span>
                      <Send className="w-3.5 h-3.5 rtl:rotate-180" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
