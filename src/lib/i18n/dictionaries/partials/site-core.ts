/**
 * Dictionary partial — `site-core`.
 *
 * Partials exist so several areas of the site can grow their copy at once
 * without editing the two root dictionaries. Each partial owns one top-level
 * namespace per key below; the root files spread them in. The English object
 * is typed from the Arabic one, so a key added on one side and forgotten on
 * the other is a build error.
 *
 * Owned by the core routes: the locale layout and chrome, the home page,
 * `/about/**`, `/get-involved/**`, `/contact`, `/verify` and `/legal/[slug]`.
 * No organisational facts live here — names, numbers, channels and figures
 * come from `organization_settings` and the CMS (RULE 6).
 */
export const site_coreAr = {
  /** Header, official-channels bar, footer, 404 and error boundary chrome. */
  siteChrome: {
    channelsBarNav: 'شريط القنوات الرسمية',
    secondaryNav: 'روابط إضافية',
    whatsapp: 'واتساب',
    officeHours: 'ساعات العمل',
    phone: 'الهاتف',
    email: 'البريد الإلكتروني',
    address: 'العنوان',
    homeLinkLabel: 'الصفحة الرئيسية',
  },

  /** Home page sections that have no copy elsewhere. */
  homePage: {
    identityTitle: 'سجل المؤسسة',
    identityLead: 'الحقائق التي يبحث عنها الشريك أولاً: الاسم القانوني، والترخيص، وسنة التأسيس.',
    yearsActive: 'سنوات من العمل',
    governoratesCount: 'محافظات نعمل فيها',
    partnersCount: 'شركاء منشورون',
    membershipsCount: 'عضويات وشبكات',
    aboutTitle: 'من نحن',
    aboutCta: 'تعرّف علينا',
    whereWeWorkTitle: 'أين نعمل',
    whereWeWorkLead: 'المحافظات التي نُفّذت فيها مشاريع منشورة، مرتّبة بحسب عدد المشاريع.',
    projectsUnit: 'مشروع',
    getInvolvedTitle: 'شارك معنا',
    getInvolvedLead: 'ثلاثة أبواب مفتوحة: شراكة مؤسسية، أو تطوّع، أو دعم مباشر.',
    storyCta: 'اقرأ القصة',
    metricsFootnote: 'تُنشر الأرقام مع فترتها وحالة التحقّق منها فقط.',
  },

  /** `/about` overview and its four sub-pages. */
  aboutPages: {
    eyebrow: 'من نحن',
    overviewLead: 'من نحن قانونياً، وما الذي نسعى إليه، ومن يقود العمل، وأين ننتمي.',
    sectionsTitle: 'أقسام هذه الصفحة',
    identityLead: 'الحقائق الرسمية للمؤسسة كما هي مسجّلة لدى جهة الترخيص.',
    identityEmpty: 'لم تُستكمل بيانات السجل التعريفي بعد.',
    visionMissionTitle: 'الرؤية والرسالة',
    visionMissionLead: 'ما نطمح إليه، وكيف نعمل للوصول إليه، والقيم التي تحكم قراراتنا.',
    visionMissionEmptyTitle: 'لم تُنشر الرؤية والرسالة بعد',
    visionMissionEmptyBody: 'ستظهر هنا فور اعتمادها ونشرها من إدارة المؤسسة.',
    valuesLead: 'المبادئ التي ترسم طريقة عملنا وتوجّه قراراتنا.',
    principlesLead: 'الالتزامات التي نحاسب أنفسنا عليها في كل تدخّل.',
    governanceLead: 'مجلس الإدارة والإدارة التنفيذية والطاقم — من وافقوا على نشر بياناتهم.',
    governanceConsentNote: 'يُدرج هنا فقط من منح موافقة صريحة على نشر اسمه ودوره.',
    governanceEmptyTitle: 'لم تُنشر بيانات الحوكمة بعد',
    governanceEmptyBody: 'ستظهر أسماء أعضاء مجلس الإدارة والإدارة التنفيذية هنا فور نشرها.',
    strategyLead: 'الأهداف الاستراتيجية، والمستهدفات المقترنة بفترتها، ووثائق الخطة.',
    objectivesTitle: 'الأهداف الاستراتيجية',
    targetsTitle: 'المستهدفات',
    targetsLead: 'كل مستهدف يُنشر مع فترته وحالته.',
    strategyDocumentsTitle: 'وثائق الخطة',
    strategyEmptyTitle: 'لم تُنشر الخطة الاستراتيجية بعد',
    strategyEmptyBody: 'ستظهر الأهداف والمستهدفات هنا فور اعتماد الخطة ونشرها.',
    membershipsLead: 'الشبكات والائتلافات التي ننتمي إليها، والعضويات التي تحملها المؤسسة.',
    networksTitle: 'الشبكات',
    membershipsTitle: 'العضويات',
    membershipsEmptyTitle: 'لم تُنشر العضويات بعد',
    membershipsEmptyBody: 'ستظهر الشبكات والعضويات هنا فور توثيقها ونشرها.',
    membershipFull: 'عضوية كاملة',
    membershipObserver: 'عضو مراقب',
    website: 'الموقع الإلكتروني',
    allPartners: 'كل الشركاء',
    downloadDocument: 'تنزيل الوثيقة',
    publishedYear: 'سنة النشر',
  },

  /** `/get-involved` index, `/get-involved/partner`, `/volunteer`, `/support`. */
  getInvolved: {
    title: 'شارك معنا',
    eyebrow: 'شارك معنا',
    lead: 'ثلاث طرق للمساهمة في عملنا: شراكة مؤسسية، أو تطوّع، أو دعم مباشر.',
    partnerTitle: 'كن شريكاً',
    partnerLead: 'للمؤسسات والجهات المانحة: تمويل، أو ائتلاف، أو تنفيذ مشترك، أو دعم فني.',
    partnerFormLead: 'أخبرنا عن مؤسستك ومجال الشراكة الذي يهمّك، وسيتواصل معك فريقنا.',
    volunteerTitle: 'تطوّع معنا',
    volunteerLead: 'للأفراد الراغبين في المشاركة الميدانية أو الإدارية ضمن برامجنا.',
    volunteerFormLead: 'املأ النموذج وسنتواصل معك عند توفّر فرصة تناسب مجالك وإتاحتك.',
    supportTitle: 'ادعمنا',
    supportLead: 'تواصل معنا مباشرة لمعرفة كيف يصل الدعم إلى المؤسسة اليوم.',
    supportBody:
      'لا يستقبل الموقع أي مدفوعات. للاستفسار عن طرق الدعم المتاحة حالياً، تواصل مع الفريق عبر القناة الرسمية أدناه وسيُرشدك إلى الخطوات.',
    whatsappCta: 'تواصل عبر واتساب',
    whatsappMessage: 'مرحباً، أودّ الاستفسار عن طرق دعم المؤسسة.',
    whatsappUnavailableTitle: 'قناة واتساب غير متاحة حالياً',
    whatsappUnavailableBody: 'تواصل معنا عبر صفحة التواصل، أو راجع قائمة قنواتنا الرسمية.',
    verifyCalloutTitle: 'تحقّق قبل أن تتعامل',
    verifyCalloutBody: 'قارن أي قناة أو رقم يصلك بقائمة قنواتنا الرسمية قبل التعامل معه.',
    verifyCalloutCta: 'قائمة القنوات الرسمية',
    contactAlternative: 'أو راسلنا عبر صفحة التواصل',
    learnMore: 'المزيد',
  },

  /**
   * The error boundaries — `(site)/[locale]/error.tsx` and `global-error.tsx`.
   *
   * Those two are Client Components (React requires an error boundary to be
   * one) and they render after something upstream has already failed, so they
   * cannot `await getDictionary()` and may not even have a resolved locale.
   * They import `site_coreAr` and `site_coreEn` directly and render **both**
   * languages, each block carrying its own `lang`/`dir` — the same answer
   * `not-found-body.tsx` gives, for the same reason. The copy still lives
   * here rather than in the components (RULE 5).
   */
  boundary: {
    errorTitle: 'تعذّر عرض هذه الصفحة',
    errorBody: 'حدث خطأ غير متوقّع. حاول مجدداً، وإن تكرّر فأخبرنا.',
    referenceLabel: 'رقم المرجع',
    retry: 'إعادة المحاولة',
  },

  /** `/legal/[slug]`. */
  legalPages: {
    eyebrow: 'أحكام',
    unpublishedTitle: 'هذه الصفحة غير متاحة حالياً',
    unpublishedBody: 'لم يُنشر محتوى هذه الصفحة بعد. عد لاحقاً أو تواصل معنا إن كان لديك سؤال.',
    lastUpdated: 'آخر تحديث',
    readArabic: 'اقرأ النسخة العربية',
  },
} satisfies Record<string, Record<string, string>>;

/**
 * Deliberately not `as const`: the Arabic object stays un-narrowed so that the
 * English mirror only has to match the key shape, not the literal strings —
 * `en.ts` would otherwise fail to typecheck once this partial is spread in.
 */
type Shape = { [K in keyof typeof site_coreAr]: { [P in keyof (typeof site_coreAr)[K]]: string } };

export const site_coreEn: Shape = {
  siteChrome: {
    channelsBarNav: 'Official channels bar',
    secondaryNav: 'More links',
    whatsapp: 'WhatsApp',
    officeHours: 'Office hours',
    phone: 'Phone',
    email: 'Email',
    address: 'Address',
    homeLinkLabel: 'Home page',
  },

  homePage: {
    identityTitle: 'Organisation record',
    identityLead: 'The facts a partner looks for first: legal name, licence and founding year.',
    yearsActive: 'Years of work',
    governoratesCount: 'Governorates we work in',
    partnersCount: 'Published partners',
    membershipsCount: 'Memberships and networks',
    aboutTitle: 'About us',
    aboutCta: 'Learn about us',
    whereWeWorkTitle: 'Where we work',
    whereWeWorkLead: 'Governorates with published projects, ordered by project count.',
    projectsUnit: 'projects',
    getInvolvedTitle: 'Get involved',
    getInvolvedLead: 'Three open doors: institutional partnership, volunteering, or direct support.',
    storyCta: 'Read the story',
    metricsFootnote: 'Figures are published only with their period and verification status.',
  },

  aboutPages: {
    eyebrow: 'About us',
    overviewLead: 'Who we are legally, what we work towards, who leads the work, and where we belong.',
    sectionsTitle: 'Sections of this page',
    identityLead: 'The organisation’s official facts as registered with the licensing authority.',
    identityEmpty: 'The identity record has not been completed yet.',
    visionMissionTitle: 'Vision and mission',
    visionMissionLead: 'What we aspire to, how we work towards it, and the values that govern our decisions.',
    visionMissionEmptyTitle: 'The vision and mission have not been published yet',
    visionMissionEmptyBody: 'They will appear here once approved and published by the organisation.',
    valuesLead: 'The principles that shape how we work and how we make decisions.',
    principlesLead: 'The commitments we hold ourselves to in every intervention.',
    governanceLead: 'Board, executive management and staff — those who consented to be listed.',
    governanceConsentNote: 'Only people who gave explicit consent to publish their name and role are listed.',
    governanceEmptyTitle: 'Governance details have not been published yet',
    governanceEmptyBody: 'Board and executive management members will appear here once published.',
    strategyLead: 'Strategic objectives, targets locked to their period, and the plan documents.',
    objectivesTitle: 'Strategic objectives',
    targetsTitle: 'Targets',
    targetsLead: 'Every target is published with its period and status.',
    strategyDocumentsTitle: 'Plan documents',
    strategyEmptyTitle: 'The strategic plan has not been published yet',
    strategyEmptyBody: 'Objectives and targets will appear here once the plan is approved and published.',
    membershipsLead: 'The networks and coalitions we belong to, and the memberships the organisation holds.',
    networksTitle: 'Networks',
    membershipsTitle: 'Memberships',
    membershipsEmptyTitle: 'Memberships have not been published yet',
    membershipsEmptyBody: 'Networks and memberships will appear here once documented and published.',
    membershipFull: 'Full member',
    membershipObserver: 'Observer',
    website: 'Website',
    allPartners: 'All partners',
    downloadDocument: 'Download document',
    publishedYear: 'Year published',
  },

  getInvolved: {
    title: 'Get involved',
    eyebrow: 'Get involved',
    lead: 'Three ways to contribute to our work: institutional partnership, volunteering, or direct support.',
    partnerTitle: 'Partner with us',
    partnerLead: 'For institutions and donors: funding, consortium, joint implementation or technical support.',
    partnerFormLead: 'Tell us about your organisation and the partnership you have in mind; our team will follow up.',
    volunteerTitle: 'Volunteer with us',
    volunteerLead: 'For individuals who want to take part in field or administrative work within our programmes.',
    volunteerFormLead: 'Fill in the form and we will contact you when an opportunity matches your area and availability.',
    supportTitle: 'Support us',
    supportLead: 'Contact us directly to learn how support reaches the organisation today.',
    supportBody:
      'This website does not take payments. To ask about the support options currently available, contact the team through the official channel below and they will guide you through the steps.',
    whatsappCta: 'Message us on WhatsApp',
    whatsappMessage: 'Hello, I would like to ask about ways to support the organisation.',
    whatsappUnavailableTitle: 'WhatsApp channel not available yet',
    whatsappUnavailableBody: 'Reach us through the contact page, or check the list of official channels.',
    verifyCalloutTitle: 'Verify before you engage',
    verifyCalloutBody: 'Compare any channel or number that reaches you against our list of official channels first.',
    verifyCalloutCta: 'List of official channels',
    contactAlternative: 'Or write to us through the contact page',
    learnMore: 'Learn more',
  },

  boundary: {
    errorTitle: 'This page could not be shown',
    errorBody: 'Something went wrong. Please try again, and let us know if it keeps happening.',
    referenceLabel: 'Reference',
    retry: 'Try again',
  },

  legalPages: {
    eyebrow: 'Legal',
    unpublishedTitle: 'This page is not available yet',
    unpublishedBody: 'Its content has not been published. Check back later, or contact us if you have a question.',
    lastUpdated: 'Last updated',
    readArabic: 'Read the Arabic version',
  },
};
