import { RuleCategory, UserAccount, RuleVisibilityRole } from '../types';
import { isSuperAdmin, isAdministrator } from './userManagement';
import {
  fetchRulesCategoriesFromFirestore,
  saveRuleCategoryToFirestore,
  deleteRuleCategoryFromFirestore,
  subscribeToRulesCategories,
} from '../lib/firestoreService';

const RULES_STORAGE_KEY = '3awdli_rules_categories';

export const DEFAULT_RULE_CATEGORIES: RuleCategory[] = [
  {
    id: 'general',
    systemKey: 'general',
    order: 1,
    targetRole: 'all',
    title: {
      fr: 'Réglement général',
      en: 'General Rules',
      ar: 'القوانين العامة',
    },
    content: {
      fr: `<h2>Charte de la communauté 3awdli</h2>
<p>Bienvenue sur <strong>3awdli</strong>, un sanctuaire dédié à l'écoute empathique, au soutien psychologique bénévole et au bien-être émotionnel. Afin de préserver la sécurité, la dignité et la sérénité de chacun, tous les membres et visiteurs sont tenus de respecter les règles suivantes :</p>

<h3>1. Respect mutuel et bienveillance inconditionnelle</h3>
<ul>
  <li>Chaque personne mérite d'être entendue avec respect, considération et sans le moindre jugement.</li>
  <li>Les insultes, le harcèlement, la provocation, les discours haineux et toute forme de discrimination (liée au genre, à l'origine, à la religion ou aux croyances) sont <strong>strictement interdits</strong> et entraînent un bannissement immédiat.</li>
</ul>

<h3>2. Confidentialité et anonymat</h3>
<ul>
  <li>Les conversations partagées sur la plateforme sont <strong>confidentielles</strong>. Ne divulguez jamais d'informations nominatives ou de données personnelles sensibles dans les espaces publics.</li>
  <li>Il est formellement interdit de capturer, enregistrer ou diffuser publiquement des échanges privés.</li>
</ul>

<h3>3. Limites du service et urgences médicales</h3>
<blockquote><strong>Important :</strong> 3awdli est un espace d'écoute bienveillante et de soutien moral. La plateforme ne constitue en aucun cas un service d'urgences médicales ou psychiatriques.</blockquote>
<p>En cas de crise aiguë ou de danger vital immédiat pour vous-même ou autrui, contactez sans attendre les services d'urgence officiels de votre pays (au Maroc : SAMU 141, Police 19, Protection Civile 15).</p>`,

      en: `<h2>3awdli Community Charter</h2>
<p>Welcome to <strong>3awdli</strong>, a sanctuary dedicated to empathetic listening, volunteer emotional support, and mental wellness. To safeguard the dignity, psychological safety, and tranquility of every individual, all members and visitors must abide by these principles:</p>

<h3>1. Mutual Respect & Unconditional Kindness</h3>
<ul>
  <li>Every person has the right to be listened to with warmth, care, and total freedom from judgment.</li>
  <li>Harassment, insults, hate speech, bullying, and discrimination of any kind (based on gender, background, faith, or identity) are <strong>strictly prohibited</strong> and result in immediate sanctions.</li>
</ul>

<h3>2. Absolute Confidentiality & Anonymity</h3>
<ul>
  <li>All listening discussions conducted on 3awdli are <strong>confidential</strong>. Never share personal identifiable details in public areas.</li>
  <li>Taking screenshots, recording conversations, or publishing private dialogue outside the platform is strictly forbidden.</li>
</ul>

<h3>3. Scope of Service & Medical Emergencies</h3>
<blockquote><strong>Notice:</strong> 3awdli provides compassionate human listening and psychological first aid. It is not an emergency psychiatric hospital or acute medical facility.</blockquote>
<p>If you or someone around you is in immediate physical danger or life-threatening crisis, please reach out directly to your local emergency services (in Morocco: Medical SAMU 141, Police 19, Rescue 15).</p>`,

      ar: `<h2>ميثاق مجتمع 3awdli</h2>
<p>أهلاً بكم في <strong>3awdli</strong>، مساحتكم الآمنة للاستماع الوجداني والدعم النفسي الخيري والتخفيف الوجداني. حرصاً على صون كرامة الجميع وتوفير بيئة ملؤها السكينة والطمأنينة، نرجو من كافة الزوار والأعضاء الالتزام بالقواعد التالية:</p>

<h3>1. الاحترام المتبادل والتعاطف غير المشروط</h3>
<ul>
  <li>لكل إنسان الحق في أن يُسمع باهتمام واحترام تام، بعيداً عن أي إطلاق أحكام أو تقليل من معاناته.</li>
  <li>يُحظر منعاً باتاً أي شكل من أشكال المضايقة، السب، خطابات الكراهية، التنمر، أو التمييز القائم على العرق أو الدين أو الجنس. هذه السلوكيات تؤدي إلى حظر الحساب فوراً.</li>
</ul>

<h3>2. السرية المطلقة والخصوصية</h3>
<ul>
  <li>المحادثات الخاصة داخل المنصة محاطة بـ <strong>سرية تامة</strong>. لا تشارك بياناتك الشخصية الحساسة أو عناوينك في الفضاءات العامة.</li>
  <li>يُمنع منعاً قاطعاً تصوير المحادثات، تسجيلها، أو تسريب أي حوار خاص خارج المنصة.</li>
</ul>

<h3>3. حدود الخدمة وحالات الطوارئ القصوى</h3>
<blockquote><strong>تنبيه هام:</strong> منصة 3awdli فضاء للإصغاء الدافئ والدعم المعنوي، وليست بديلاً عن مصحات الطوارئ الطبية أو المستشفيات النفسية السريرية.</blockquote>
<p>في حالات الخطر الحاد أو التهديد المباشر للحياة، يرجى التوجه فوراً لأرقام الطوارئ الرسمية (في المغرب: الإسعاف 141، الشرطة 19، الوقاية المدنية 15).</p>`,
    },
  },
  {
    id: 'listeners',
    systemKey: 'listeners',
    order: 2,
    targetRole: 'listeners',
    title: {
      fr: 'Réglement des listeners',
      en: 'Listener Rules',
      ar: 'قوانين المستمعين',
    },
    content: {
      fr: `<h2>Guide d'éthique et de pratique pour les Écoutants (Listeners)</h2>
<p>En tant qu'écoutant sur <strong>3awdli</strong>, vous incarnez le cœur battant de notre mission de soutien. Cette responsabilité requiert une éthique rigoureuse, du dévouement et une vigilance continue.</p>

<h3>1. Posture d'écoute active et non-jugement</h3>
<ul>
  <li>Adoptez une écoute chaleureuse, empathique et centrée sur la personne qui s'exprime.</li>
  <li>Ne dispensez pas de diagnostics psychiatriques ou de prescriptions médicales. Votre rôle est d'offrir une présence bienveillante et un ancrage rassurant.</li>
</ul>

<h3>2. Interdiction stricte de partage de contacts personnels</h3>
<ul>
  <li>Il est <strong>formellement interdit</strong> d'échanger des coordonnées privées avec les utilisateurs (numéro WhatsApp, réseaux sociaux personnels, e-mails personnels).</li>
  <li>Tous les échanges doivent s'effectuer exclusivement au sein de l'environnement sécurisé de 3awdli afin de préserver la protection des deux parties.</li>
</ul>

<h3>3. Partage de cas et signalement</h3>
<ul>
  <li>Si une situation dépasse vos compétences ou suscite une inquiétude éthique, utilisez la fonction <em>Boîte aux lettres / Partager</em> pour consulter un confrère ou le Responsable des écoutants.</li>
  <li>En cas de propos violents, menaces explicites d'atteinte à la vie ou comportements abusifs, déclenchez immédiatement un <strong>Signalement</strong> vers le Responsable.</li>
</ul>

<h3>4. Préservation personnelle et hygiène mentale</h3>
<blockquote>Prenez soin de vous : accordez-vous des pauses régulières et n'hésitez pas à demander du soutien à vos pairs en cas de charge émotionnelle élevée.</blockquote>`,

      en: `<h2>Ethics & Practice Guidelines for Listeners</h2>
<p>As a volunteer listener on <strong>3awdli</strong>, you represent the sanctuary's core foundation. This noble role requires rigorous ethical standards, unwavering empathy, and emotional vigilance.</p>

<h3>1. Active Empathetic Listening & Non-Judgment</h3>
<ul>
  <li>Maintain a warm, patient, and human-centered presence throughout every interaction.</li>
  <li>Never deliver psychiatric diagnoses, prescribe pharmaceuticals, or impose moral decisions. Your role is grounded in compassionate presence and reflective listening.</li>
</ul>

<h3>2. Strict Prohibition on Personal Contact Exchange</h3>
<ul>
  <li>You are <strong>strictly forbidden</strong> from sharing private contact info with users (personal phone numbers, WhatsApp, social media accounts, or personal emails).</li>
  <li>All communications must remain strictly within the protected 3awdli infrastructure to preserve safety and healthy boundaries.</li>
</ul>

<h3>3. Peer Consultations & Immediate Escalation</h3>
<ul>
  <li>When faced with complex psychological dynamics, use the <em>Mailbox / Share Discussion</em> tool to consult peer listeners or the Head of Listeners.</li>
  <li>For imminent self-harm threats, abusive conduct, or boundary breaches, file a <strong>Safety Report</strong> to the Head of Listeners immediately.</li>
</ul>

<h3>4. Listener Self-Care & Mental Well-Being</h3>
<blockquote>Compassion fatigue is real. Take regular intervals off duty and reach out to team leadership whenever you experience heavy emotional resonance.</blockquote>`,

      ar: `<h2>دليل الأخلاقيات والممارسة للمستمعين</h2>
<p>بصفتك مستمعاً معتمداً في <strong>3awdli</strong>، فإنك تمثل الركيزة الأساسية لرسالتنا الإنسانية. هذه الأمانة تتطلب التزاماً أخلاقياً صارماً ويقظة نفسية مستمرة.</p>

<h3>1. الإصغاء الفعّال والحياد التام</h3>
<ul>
  <li>تحلَّ بالصبر والدفء والتعاطف الصادق مع كل شخص يبوح بمشاعره.</li>
  <li>لا تقدم تشخيصات طبية سريرية ولا تصف أدوية. دورك الأساسي هو توفير سند نفسي آمن وإصغاء مخلص خالي من أي وصم.</li>
</ul>

<h3>2. حظر تبادل وسائل التواصل الشخصية منعاً باتاً</h3>
<ul>
  <li>يُحظر <strong>قطعياً</strong> تبادل أرقام الهواتف الشخصية، حسابات واتساب، أو حسابات التواصل الاجتماعي مع المستفيدين.</li>
  <li>كافة الحوارات تتم حصراً داخل فضاء 3awdli المشفر لصون خصوصيتك وحماية سلامة الجميع.</li>
</ul>

<h3>3. استشارة الزملاء وتصعيد الحالات الحرجة</h3>
<ul>
  <li>في الحالات المعقدة، بادر بمشاركة المحادثة عبر <em>صندوق الرسائل</em> لطلب المشورة من زملائك المستمعين أو رئيس المستمعين.</li>
  <li>عند رصد أي نية لإيذاء النفس أو سلوك تحرش، قم برفع <strong>بلاغ فوري</strong> لمسؤول المستمعين للتعامل معه وفق البروتوكول.</li>
</ul>

<h3>4. العناية الذاتية وحماية التوازن النفسي</h3>
<blockquote>صحتك النفسية أولاً : خذ فترات راحة كافية ولا تتردد في طلب المشورة عند الشعور بعبء وجداني زائد.</blockquote>`,
    },
  },
  {
    id: 'head_of_listeners',
    systemKey: 'head_of_listeners',
    order: 3,
    targetRole: 'head_of_listeners',
    title: {
      fr: 'Réglement des heads of listeners',
      en: 'Head of Listeners Rules',
      ar: 'قوانين رؤساء المستمعين',
    },
    content: {
      fr: `<h2>Responsabilités et gouvernance des Responsables des écoutants</h2>
<p>Le Responsable des écoutants (<em>Head of Listeners</em>) assure la supervision clinique, l'accompagnement éthique et la coordination quotidienne de l'équipe d'écoute.</p>

<h3>1. Supervision bienveillante et accompagnement d'équipe</h3>
<ul>
  <li>Surveiller en temps réel la file d'attente des discussions afin de veiller à une prise en charge fluide des personnes en détresse.</li>
  <li>Accompagner les écoutants lors des demandes de consultation et veiller à leur équilibre psychologique (prévention du burn-out).</li>
</ul>

<h3>2. Traitement rigoureux des signalements</h3>
<ul>
  <li>Examiner avec impartialité chaque signalement soumis par les écoutants ou les utilisateurs dans le tableau de bord <em>Signalements</em>.</li>
  <li>Rédiger des réponses claires, pédagogiques et proportionnées.</li>
  <li>Lorsque la gravité de la situation l'exige (bannissement définitif, menaces graves, litiges sensibles), transférer le dossier aux <strong>Administrateurs</strong> accompagné d'une note explicative détaillée.</li>
</ul>

<h3>3. Équité et exemplarité</h3>
<blockquote>Le Responsable des écoutants incarne les plus hauts standards d'intégrité et de confidentialité de l'institution.</blockquote>`,

      en: `<h2>Governance & Protocol for Heads of Listeners</h2>
<p>The Head of Listeners provides clinical oversight, ethical mentorship, and operational leadership across the listening fellowship.</p>

<h3>1. Active Supervision & Fellow Mentorship</h3>
<ul>
  <li>Monitor the live discussions queue to ensure no person in emotional distress is left unattended.</li>
  <li>Provide compassionate case guidance on consultation requests submitted via the Mailbox system.</li>
  <li>Identify signs of listener exhaustion and support team members proactively.</li>
</ul>

<h3>2. Investigation & Processing of Safety Reports</h3>
<ul>
  <li>Thoroughly and impartially investigate every report filed by listeners or users within the dedicated <em>Reports</em> interface.</li>
  <li>Issue clear, reasoned, and constructive written resolutions.</li>
  <li>When severe violations occur (warranting platform bans or formal sanctions), escalate the incident to <strong>Administrators</strong> with a comprehensive diagnostic brief.</li>
</ul>

<h3>3. Integrity and Exemplary Stewardship</h3>
<blockquote>Heads of Listeners must exemplify empathy, confidentiality, and balanced leadership at all times.</blockquote>`,

      ar: `<h2>مسؤوليات وبروتوكول رؤساء المستمعين</h2>
<p>يتولى رئيس المستمعين الإشراف الإرشادي والمتابعة الأخلاقية والتنسيق الميداني لفريق المستمعين لضمان جودة الأداء وسلامة الأعضاء.</p>

<h3>1. الإشراف الميداني ودعم الفريق</h3>
<ul>
  <li>متابعة قائمة الانتظار للمحادثات وضمان توزيع الدعم وسرعة التكفل بالحالات.</li>
  <li>تقديم المشورة والتوجيه النفسي السليم للمستمعين في طلبات الاستشارة الواردة عبر صندوق الرسائل.</li>
  <li>متابعة السلامة النفسية للمستمعين والحرص على عدم تعرضهم للإرهاق العاطفي.</li>
</ul>

<h3>2. معالجة البلاغات والتقارير</h3>
<ul>
  <li>فحص كافة البلاغات الواردة في قسم <em>البلاغات</em> بدقة وموضوعية.</li>
  <li>صياغة ردود توجيهية واضحة ومسؤولة تحفظ حقوق جميع الأطراف.</li>
  <li>إحالة الملفات البالغة الحساسية أو التي تستوجب عقوبات الحظر إلى <strong>المشرفين الإداريين</strong> مع تقرير توضيحي مفصل.</li>
</ul>

<h3>3. النزاهة والقدوة الأخلاقية</h3>
<blockquote>يمثل رئيس المستمعين النموذج الأعلى في الانضباط الأخلاقي وحفظ الأمانة وصون خصوصية المستفيدين.</blockquote>`,
    },
  },
  {
    id: 'administrators',
    systemKey: 'administrators',
    order: 4,
    targetRole: 'administrators',
    title: {
      fr: 'Réglement des administrateurs',
      en: 'Administrator Rules',
      ar: 'قوانين المشرفين',
    },
    content: {
      fr: `<h2>Directives de gouvernance pour les Administrateurs</h2>
<p>Les Administrateurs veillent à l'intégrité de la plateforme 3awdli, à la sécurité des infrastructures, au respect des normes éthiques et à la protection des données de chaque membre.</p>

<h3>1. Neutralité, justice et impartialité</h3>
<ul>
  <li>Toute décision administrative (sanction, avertissement, gestion de compte) doit être motivée, équitable et libre de toute animosité personnelle.</li>
  <li>Les litiges transférés par le Responsable des écoutants doivent être traités avec diligence et discernement.</li>
</ul>

<h3>2. Protection des données et sécurité du système</h3>
<ul>
  <li>L'accès aux outils d'administration est strictement confidentiel. Aucun compte administrateur ne peut être partagé.</li>
  <li>Le respect du secret professionnel et la confidentialité absolue des données d'utilisateurs sont inviolables.</li>
</ul>

<h3>3. Attribution et révision des rôles</h3>
<ul>
  <li>L'attribution des statuts Écoutant, Responsable des écoutants, Animateur et Rédacteur doit être validée avec discernement selon les qualifications et l'engagement éthique du candidat.</li>
</ul>

<blockquote><strong>Règle d'exclusivité d'édition :</strong> Conformément à la gouvernance de 3awdli, le contenu de cette section « Réglement des administrateurs » est rédigé et modifié <strong>exclusivement par le compte Admin principal</strong> (Fondateur). Les administrateurs disposent du droit de consultation intégrale.</blockquote>`,

      en: `<h2>Governance Directives for Administrators</h2>
<p>Administrators uphold the overall integrity of 3awdli, safeguard systemic infrastructure, ensure data privacy, and enforce platform standards.</p>

<h3>1. Neutrality, Due Process & Fairness</h3>
<ul>
  <li>Every administrative resolution (sanctions, warnings, account moderation) must be impartial, documented, and guided by member safety.</li>
  <li>Escalated cases referred by the Head of Listeners must be reviewed with utmost care and discernment.</li>
</ul>

<h3>2. Data Privacy & Systemic Confidentiality</h3>
<ul>
  <li>Administrative credentials and management portals are strictly personal and must never be shared or transferred.</li>
  <li>Data security and confidentiality guidelines are inviolable under all circumstances.</li>
</ul>

<h3>3. Role Stewardship</h3>
<ul>
  <li>Granting roles such as Listener, Head of Listeners, Facilitator, and Writer requires thorough verification of competence and moral commitment.</li>
</ul>

<blockquote><strong>Editorial Exclusivity Notice:</strong> Under 3awdli platform governance, the text of this "Administrator Rules" section is authored and edited <strong>exclusively by the primary Admin account</strong> (Founder). Administrators hold full viewing rights.</blockquote>`,

      ar: `<h2>المبادئ التوجيهية لمشرفي وإداريي المنصة</h2>
<p>يسهر المشرفون الإداريون على الحفاظ على سلامة منصة 3awdli، حماية البنية التحتية، صون سرية البيانات، وتطبيق أرفع معايير الحوكمة والعدالة.</p>

<h3>1. الحياد، النزاهة والإنصاف</h3>
<ul>
  <li>كافة القرارات الإدارية (الإنذارات، الحظر، البت في النزاعات) تبنى على معايير عادلة وموضوعية تهدف حصراً لحماية أمان المجتمع.</li>
  <li>معالجة الملفات المحالة من مسؤول المستمعين بحكمة ودقة متناهية وسرعة استجابة.</li>
</ul>

<h3>2. حماية البيانات وسرية الأنظمة</h3>
<ul>
  <li>بيانات الولوج إلى لوحة الإدارة سرية للغاية ولا يجوز مشاركتها تحت أي ظرف.</li>
  <li>الالتزام التام بالسر المهني وحماية سرية بيانات المستخدمين والمستمعين.</li>
</ul>

<h3>3. أمانة إدارة الأدوار والصلاحيات</h3>
<ul>
  <li>منح صفة مستمع، مسؤول مستمعين، ميسر، أو كاتب يخضع لتقييم دقيق للكفاءة والالتزام الأخلاقي.</li>
</ul>

<blockquote><strong>ملاحظة حصرية التعديل:</strong> وفقاً لميثاق الحوكمة في 3awdli، فإن نصوص هذا القسم "قوانين المشرفين" يتم تحريرها وتعديلها <strong>حصراً بواسطة حساب مدير المنصة (Admin)</strong>. ويحق للمشرفين الإداريين الاطلاع الكامل عليها.</blockquote>`,
    },
  },
];

let inMemoryRulesCategories: RuleCategory[] = [...DEFAULT_RULE_CATEGORIES];
let isRulesInitialized = false;

/**
 * Access Control Checker: Who can view a specific category
 */
export function canViewRuleCategory(
  category: RuleCategory,
  currentUser?: UserAccount | null
): boolean {
  if (!category) return false;

  // 'all' target is visible to everyone, including guests
  if (category.targetRole === 'all') return true;

  // If user is not logged in, they can only view 'all'
  if (!currentUser) return false;

  const isSuperAdminAccount = isSuperAdmin(currentUser);
  const isAdministratorAccount = isAdministrator(currentUser);
  const isHeadOfListeners = Boolean(currentUser.is_head_of_listeners || (currentUser as any).role === 'head_of_listeners');
  const isListener = Boolean(currentUser.is_listener || currentUser.isListener || currentUser.role === 'listener');

  // SuperAdmin and Administrators can view everything
  if (isSuperAdminAccount || isAdministratorAccount) return true;

  // Head of Listeners can view 'listeners' and 'head_of_listeners'
  if (category.targetRole === 'head_of_listeners') {
    return isHeadOfListeners;
  }

  // Listeners can view 'listeners'
  if (category.targetRole === 'listeners') {
    return isListener || isHeadOfListeners;
  }

  // Administrators category: only admins
  if (category.targetRole === 'administrators') {
    return isAdministratorAccount || isSuperAdminAccount;
  }

  return false;
}

/**
 * Permission Checker: Who can write/edit content inside a category
 * EXCEPTION ENFORCED:
 * Administrators CANNOT edit content in "Administrator Rules" (administrators).
 * ONLY the Admin account (isSuperAdmin) can edit that specific category.
 * For all other categories: any Administrator (and Admin) can edit.
 */
export function canEditRuleCategory(
  category: RuleCategory,
  currentUser?: UserAccount | null
): boolean {
  if (!currentUser) return false;

  const isSuper = isSuperAdmin(currentUser);
  const isAdmin = isAdministrator(currentUser);

  // If this is the Administrator Rules category: STRICTLY ONLY the Admin account can edit!
  if (category.id === 'administrators' || category.systemKey === 'administrators') {
    return isSuper;
  }

  // All other categories can be edited by any Administrator (including Super Admin)
  return isAdmin;
}

/**
 * Permission Checker: Who can create custom categories
 */
export function canManageCustomCategories(currentUser?: UserAccount | null): boolean {
  return isAdministrator(currentUser);
}

/**
 * Initialize Firestore synchronization for rules categories
 */
export function initFirestoreRulesSync(onUpdate?: (categories: RuleCategory[]) => void): () => void {
  // Load local backup first
  if (typeof window !== 'undefined' && !isRulesInitialized) {
    try {
      const stored = localStorage.getItem(RULES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          inMemoryRulesCategories = mergeWithDefaults(parsed);
        }
      }
    } catch {
      // ignore
    }
  }

  isRulesInitialized = true;

  // Subscribe to real-time updates from Firestore
  const unsubscribe = subscribeToRulesCategories(
    async (remoteCategories) => {
      if (!remoteCategories || remoteCategories.length === 0) {
        // First-time seed: seed default categories into Firestore
        try {
          for (const cat of DEFAULT_RULE_CATEGORIES) {
            await saveRuleCategoryToFirestore(cat);
          }
          inMemoryRulesCategories = [...DEFAULT_RULE_CATEGORIES];
        } catch (err) {
          console.error('Error seeding default rule categories:', err);
        }
      } else {
        inMemoryRulesCategories = mergeWithDefaults(remoteCategories);
      }

      // Update local storage
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(inMemoryRulesCategories));
        } catch {
          // ignore
        }
      }

      if (onUpdate) {
        onUpdate([...inMemoryRulesCategories]);
      }
    },
    (err) => {
      console.warn('Rules sync warning, using local categories:', err);
      if (onUpdate) {
        onUpdate([...inMemoryRulesCategories]);
      }
    }
  );

  return unsubscribe;
}

/**
 * Helper to ensure the 4 core system categories always exist in memory, sorted by order
 */
function mergeWithDefaults(categories: RuleCategory[]): RuleCategory[] {
  const map = new Map<string, RuleCategory>();

  // Seed defaults first
  for (const def of DEFAULT_RULE_CATEGORIES) {
    map.set(def.id, { ...def });
  }

  // Merge loaded/remote categories
  for (const cat of categories) {
    const existing = map.get(cat.id);
    if (existing) {
      map.set(cat.id, {
        ...existing,
        ...cat,
        title: { ...existing.title, ...cat.title },
        content: { ...existing.content, ...cat.content },
      });
    } else {
      map.set(cat.id, cat);
    }
  }

  return Array.from(map.values()).sort((a, b) => (a.order || 99) - (b.order || 99));
}

/**
 * Get current in-memory categories
 */
export function getRulesCategories(): RuleCategory[] {
  return [...inMemoryRulesCategories];
}

/**
 * Save / Update a rule category
 */
export async function saveRuleCategory(
  category: RuleCategory,
  editorUser?: UserAccount | null
): Promise<void> {
  // Check permission
  if (!canEditRuleCategory(category, editorUser)) {
    throw new Error('Unauthorized: You do not have permission to edit this rules category.');
  }

  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const updated: RuleCategory = {
    ...category,
    updatedAt: dateStr,
    updatedAtTimestamp: Date.now(),
    updatedBy: editorUser?.name || 'Administrator',
  };

  // Update in-memory
  const idx = inMemoryRulesCategories.findIndex((c) => c.id === updated.id);
  if (idx >= 0) {
    inMemoryRulesCategories[idx] = updated;
  } else {
    inMemoryRulesCategories.push(updated);
  }

  // Update localStorage
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(inMemoryRulesCategories));
    } catch {
      // ignore
    }
  }

  // Save to Firestore
  await saveRuleCategoryToFirestore(updated);
}

/**
 * Create a new custom category
 */
export async function createCustomRuleCategory(params: {
  title: { en: string; fr: string; ar: string };
  content: { en: string; fr: string; ar: string };
  targetRole: RuleVisibilityRole;
  creatorUser?: UserAccount | null;
}): Promise<RuleCategory> {
  if (!canManageCustomCategories(params.creatorUser)) {
    throw new Error('Unauthorized: Only Administrators can create custom rules categories.');
  }

  const id = `custom_${Date.now()}`;
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const newCategory: RuleCategory = {
    id,
    order: inMemoryRulesCategories.length + 1,
    targetRole: params.targetRole,
    isCustom: true,
    title: params.title,
    content: params.content,
    createdAt: dateStr,
    createdAtTimestamp: Date.now(),
    updatedAt: dateStr,
    updatedAtTimestamp: Date.now(),
    updatedBy: params.creatorUser?.name || 'Administrator',
  };

  inMemoryRulesCategories.push(newCategory);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(inMemoryRulesCategories));
    } catch {
      // ignore
    }
  }

  await saveRuleCategoryToFirestore(newCategory);
  return newCategory;
}

/**
 * Delete a custom category
 */
export async function deleteCustomRuleCategory(
  id: string,
  currentUser?: UserAccount | null
): Promise<void> {
  if (!canManageCustomCategories(currentUser)) {
    throw new Error('Unauthorized: Only Administrators can delete custom rules categories.');
  }

  const target = inMemoryRulesCategories.find((c) => c.id === id);
  if (!target || !target.isCustom) {
    throw new Error('Cannot delete a standard system rules category.');
  }

  inMemoryRulesCategories = inMemoryRulesCategories.filter((c) => c.id !== id);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(inMemoryRulesCategories));
    } catch {
      // ignore
    }
  }

  await deleteRuleCategoryFromFirestore(id);
}
