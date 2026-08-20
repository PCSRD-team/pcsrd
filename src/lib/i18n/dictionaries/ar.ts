/**
 * Arabic dictionary — the source locale.
 *
 * Arabic is not a translation here; it is what the copy was written in. The
 * English file mirrors this shape and TypeScript enforces that it stays
 * complete, so a key added here and forgotten there is a build error rather
 * than a blank heading in production.
 *
 * No organisational facts live in this file. Names, licence numbers, phone
 * numbers and figures all come from `organization_settings` — RULE 6.
 */
export const ar = {
  common: {
    skipToContent: 'تخطَّ إلى المحتوى',
    menu: 'القائمة',
    close: 'إغلاق',
    search: 'بحث',
    readMore: 'اقرأ المزيد',
    viewAll: 'عرض الكل',
    back: 'رجوع',
    next: 'التالي',
    previous: 'السابق',
    page: 'صفحة',
    of: 'من',
    loading: 'جارٍ التحميل…',
    required: 'مطلوب',
    optional: 'اختياري',
    submit: 'إرسال',
    submitting: 'جارٍ الإرسال…',
    download: 'تنزيل',
    externalLink: 'رابط خارجي',
    language: 'اللغة',
    switchToEnglish: 'English',
  },

  nav: {
    home: 'الرئيسية',
    about: 'من نحن',
    programs: 'البرامج',
    projects: 'المشاريع',
    impact: 'الأثر',
    news: 'الأخبار',
    partners: 'الشركاء',
    resources: 'الإصدارات',
    careers: 'الوظائف',
    contact: 'تواصل معنا',
    verify: 'تحقّق من قنواتنا',
    support: 'ادعمنا',
    partner: 'كن شريكاً',
  },

  channels: {
    barLabel: 'القنوات الرسمية',
    barText: 'تأكّد أنك تتعامل مع حساباتنا الرسمية',
    barCta: 'قائمة القنوات المعتمدة',
  },

  home: {
    heroEyebrow: 'مؤسسة أهلية مسجّلة',
    programsTitle: 'برامجنا',
    programsLead: 'ثلاثة برامج تُنفَّذ عبر مشاريع موثّقة بفتراتها ونتائجها.',
    impactTitle: 'الأثر',
    impactLead: 'كل رقم منشور مقترن بفترته وحالة التحقّق منه.',
    latestTitle: 'آخر المستجدات',
    storiesTitle: 'قصص من الميدان',
    partnersTitle: 'شركاؤنا',
    verifyTitle: 'قنواتنا الرسمية',
    verifyLead: 'إذا وصلك طلب تبرّع باسمنا من قناة غير مدرجة هنا، فهو ليس منّا.',
  },

  programs: {
    title: 'البرامج',
    lead: 'ما نعمل عليه، ولمن، وكيف يمكن الوصول إلى الخدمة.',
    eligibility: 'من يستفيد',
    howToAccess: 'كيف تصل إلى الخدمة',
    objectives: 'الأهداف المحدّدة',
    interventions: 'التدخّلات الرئيسية',
    sustainability: 'الاستدامة',
    targetGroups: 'الفئات المستهدفة',
    projectsInProgram: 'مشاريع هذا البرنامج',
    projectCount: 'عدد المشاريع',
  },

  projects: {
    title: 'المشاريع',
    lead: 'سجل المشاريع المنفَّذة والجارية.',
    filters: 'تصفية',
    clearFilters: 'إزالة التصفية',
    program: 'البرنامج',
    governorate: 'المحافظة',
    theme: 'المجال',
    year: 'السنة',
    state: 'الحالة',
    statePlanned: 'مخطَّط',
    stateActive: 'جارٍ',
    stateCompleted: 'مكتمل',
    results: 'نتيجة',
    objective: 'الهدف',
    activities: 'الأنشطة',
    outcomes: 'المخرجات',
    period: 'الفترة',
    locations: 'مناطق التنفيذ',
    implementingPartners: 'شركاء التنفيذ',
    donors: 'الجهات المموّلة',
    gallery: 'من الميدان',
  },

  impact: {
    title: 'الأثر',
    lead: 'أرقام مقترنة بفترتها ومصدر التحقّق منها.',
    period: 'الفترة',
    verified: 'مُتحقَّق منه',
    reported: 'مُبلَّغ عنه',
    target: 'مستهدف',
    source: 'مصدر التحقّق',
    storiesTitle: 'قصص',
    storyAnonymized: 'أُخفيت هوية صاحب القصة حمايةً له.',
  },

  news: {
    title: 'الأخبار',
    lead: 'أخبار وبيانات وإعلانات.',
    categoryNews: 'خبر',
    categoryStatement: 'بيان',
    categoryAnnouncement: 'إعلان',
    publishedOn: 'نُشر في',
  },

  careers: {
    title: 'الوظائف والتطوّع',
    lead: 'الشواغر المفتوحة حالياً.',
    deadline: 'آخر موعد للتقديم',
    location: 'مكان العمل',
    employmentType: 'نوع التعاقد',
    postedOn: 'تاريخ الإعلان',
    requirements: 'المتطلبات',
    applyNow: 'قدّم الآن',
    applyByEmail: 'التقديم عبر البريد الإلكتروني',
    closed: 'أُغلق باب التقديم',
    noOpenings: 'لا توجد شواغر مفتوحة حالياً.',
  },

  verify: {
    title: 'قنواتنا الرسمية',
    lead: 'هذه هي القنوات الوحيدة التي نتحدّث من خلالها.',
    channel: 'القناة',
    handle: 'المعرّف',
    lastVerified: 'آخر تحقّق',
    official: 'رسمي',
    notOurs: 'ليس تابعاً لنا',
    reportTitle: 'أبلغ عن انتحال صفة',
    reportLead: 'إذا رأيت حساباً أو رقماً ينتحل اسمنا، أخبرنا.',
  },

  about: {
    title: 'من نحن',
    identity: 'السجل التعريفي',
    legalName: 'الاسم القانوني',
    licenseNumber: 'رقم الترخيص',
    licenseAuthority: 'جهة الترخيص',
    foundedYear: 'سنة التأسيس',
    legalForm: 'الشكل القانوني',
    vision: 'الرؤية',
    mission: 'الرسالة',
    values: 'القيم',
    principles: 'المبادئ',
    strategy: 'الخطة الاستراتيجية',
    governance: 'الحوكمة',
    board: 'مجلس الإدارة',
    executive: 'الإدارة التنفيذية',
    structure: 'الهيكل التنظيمي',
    membership: 'العضويات والشبكات',
  },

  partners: {
    title: 'الشركاء',
    lead: 'الجهات التي نعمل معها.',
    implementing: 'شريك تنفيذ',
    donor: 'جهة مموّلة',
    network: 'شبكة',
    membership: 'عضوية',
    logoWithheld: 'لم يُمنح إذن استخدام الشعار بعد.',
  },

  resources: {
    title: 'الإصدارات',
    lead: 'التقارير والسياسات والدراسات.',
    report: 'تقرير',
    policy: 'سياسة',
    profile: 'ملف تعريفي',
    strategy: 'خطة استراتيجية',
    evaluation: 'تقييم',
    other: 'أخرى',
    fileSize: 'حجم الملف',
    notAvailableInLocale: 'هذا الإصدار متاح بالعربية فقط.',
  },

  forms: {
    success: 'وصلتنا رسالتك.',
    successWithReference: 'وصلتنا رسالتك. رقمك المرجعي:',
    keepReference: 'احتفظ بهذا الرقم لأي متابعة.',
    name: 'الاسم',
    email: 'البريد الإلكتروني',
    phone: 'رقم الهاتف',
    subject: 'الموضوع',
    message: 'الرسالة',
    organizationName: 'اسم المؤسسة',
    organizationType: 'نوع المؤسسة',
    country: 'الدولة',
    role: 'المسمّى الوظيفي',
    interest: 'مجال الاهتمام',
    programsOfInterest: 'البرامج ذات الصلة',
    enquiryType: 'نوع الاستفسار',
    ageBand: 'الفئة العمرية',
    governorate: 'المحافظة',
    areas: 'مجالات التطوّع',
    availability: 'الإتاحة',
    experience: 'الخبرة السابقة',
    motivation: 'دافعك للتطوّع',
    cv: 'السيرة الذاتية',
    cvHint: 'PDF أو Word، بحد أقصى 4 ميغابايت.',
    coverNote: 'رسالة تعريفية',
    portfolioUrl: 'رابط أعمال سابقة',
    category: 'التصنيف',
    incidentDate: 'تاريخ الواقعة',
    location: 'المكان',
    description: 'الوصف',
    relatedProject: 'المشروع ذو الصلة',
    contactPreference: 'كيف تفضّل أن نتواصل معك',
    contactNone: 'لا أرغب بالتواصل',
    anonymousNotice:
      'يمكنك تقديم هذه الشكوى دون ذكر اسمك. لا نسجّل عنوان جهازك ولا بيانات متصفحك مع الشكاوى.',
    channel: 'القناة',
    identifier: 'المعرّف أو الرقم',
    evidenceUrl: 'رابط الدليل',
    occurredOn: 'تاريخ الحادثة',
  },

  states: {
    emptyTitle: 'لا يوجد محتوى بعد',
    emptyBody: 'سيظهر المحتوى هنا فور نشره.',
    emptyFiltered: 'لا نتائج مطابقة لهذه التصفية.',
    errorTitle: 'تعذّر عرض هذا القسم',
    errorBody: 'حدث خطأ غير متوقّع. حاول تحديث الصفحة.',
    retry: 'إعادة المحاولة',
    notFoundTitle: 'الصفحة غير موجودة',
    notFoundBody: 'قد يكون الرابط قديماً أو أن الصفحة أُزيلت.',
    untranslatedTitle: 'هذه الصفحة غير مترجَمة بعد',
    untranslatedBody: 'المحتوى معروض بالعربية.',
  },

  errors: {
    validation: 'تحقّق من الحقول المميّزة.',
    unexpected: 'حدث خطأ غير متوقّع.',
    rateLimited: 'أرسلت طلبات كثيرة. حاول بعد قليل.',
    captcha: 'تعذّر التحقّق من أنك لست روبوتاً. أعد المحاولة.',
    unauthorized: 'يلزم تسجيل الدخول.',
    forbidden: 'ليست لديك صلاحية لهذا الإجراء.',
    notFound: 'العنصر غير موجود.',
    field: {
      required: 'هذا الحقل مطلوب.',
      email: 'أدخل بريداً إلكترونياً صحيحاً.',
      phone: 'أدخل رقم هاتف صحيحاً.',
      url: 'أدخل رابطاً صحيحاً.',
      date: 'أدخل تاريخاً صحيحاً.',
      number: 'أدخل رقماً صحيحاً.',
      country: 'اختر الدولة.',
      slug: 'يُسمح بالحروف والأرقام والشرطة فقط.',
      uuid: 'معرّف غير صالح.',
      tooShort: 'النص أقصر من المطلوب.',
      tooLong: 'النص أطول من المسموح.',
    },
    upload: {
      too_large: 'حجم الملف يتجاوز 4 ميغابايت.',
      bad_type: 'نوع الملف غير مدعوم.',
      empty: 'الملف فارغ.',
      unreadable: 'تعذّرت قراءة الملف.',
      failed: 'تعذّر رفع الملف. حاول مجدداً.',
    },
  },

  footer: {
    identityTitle: 'السجل التعريفي',
    channelsTitle: 'القنوات الرسمية',
    programsTitle: 'البرامج',
    legalTitle: 'أحكام',
    privacy: 'سياسة الخصوصية',
    accessibility: 'إتاحة الوصول',
    terms: 'شروط الاستخدام',
    complaints: 'آلية تقديم الشكاوى',
    rights: 'جميع الحقوق محفوظة',
  },

  /**
   * Enum labels. These are content, not code, so they live here rather than in
   * the component that renders a facet — rule 5. The keys match the pg enum
   * values exactly.
   */
  enums: {
    governorate: {
      north_gaza: 'شمال غزة',
      gaza: 'غزة',
      middle: 'الوسطى',
      khan_younis: 'خان يونس',
      rafah: 'رفح',
    },
    theme: {
      women: 'النساء',
      children: 'الأطفال',
      youth_adolescents: 'الشباب واليافعون',
      psychosocial_health: 'الصحة النفسية',
      relief: 'الإغاثة',
    },
    program: {
      protection: 'الحماية',
      humanitarian_response: 'الاستجابة الإنسانية',
      early_recovery: 'التعافي المبكر',
    },
    targetGroup: {
      children: 'الأطفال',
      youth: 'الشباب',
      women: 'النساء',
      poor_families: 'الأسر الفقيرة',
      elderly: 'كبار السن',
      pwd: 'ذوو الإعاقة',
    },
    partnerType: {
      implementing: 'شريك تنفيذ',
      donor: 'جهة مموّلة',
      network: 'شبكة',
      membership: 'عضوية',
    },
    personCategory: {
      board: 'مجلس الإدارة',
      executive: 'الإدارة التنفيذية',
      staff: 'الطاقم',
    },
    publicationType: {
      report: 'تقرير',
      policy: 'سياسة',
      profile: 'ملف تعريفي',
      strategy: 'خطة استراتيجية',
      evaluation: 'تقييم',
      other: 'أخرى',
    },
  },

  a11y: {
    mainNav: 'التنقّل الرئيسي',
    footerNav: 'روابط التذييل',
    breadcrumb: 'مسار التصفّح',
    pagination: 'ترقيم الصفحات',
    currentPage: 'الصفحة الحالية',
    openMenu: 'فتح القائمة',
    closeMenu: 'إغلاق القائمة',
    filterPanel: 'لوحة التصفية',
  },
};

/**
 * The shape every locale must fill.
 *
 * Deliberately **not** `as const`: that would make each value its own literal
 * type, and the English file would then fail to typecheck because
 * `'Skip to content'` is not assignable to `'تخطَّ إلى المحتوى'`. Widening to
 * `string` keeps the check that matters — the set of keys — and drops the one
 * that makes no sense across languages.
 */
export type Dictionary = typeof ar;
