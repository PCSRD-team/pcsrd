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
import { partialsAr } from './partials';

export const ar = {
  ...partialsAr,
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
    language: 'اللغة',
    switchToEnglish: 'English',
    /**
     * What joins the items of an inline list. Punctuation is copy: Arabic
     * takes `،` and English takes `,`, and a component that decides that with
     * a ternary is a component holding copy.
     */
    listSeparator: '، ',
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
    anonymousNotice:
      'يمكنك تقديم هذه الشكوى دون ذكر اسمك. لا نسجّل عنوان جهازك ولا بيانات متصفحك مع الشكاوى.',
    channel: 'القناة',
    identifier: 'المعرّف أو الرقم',
    evidenceUrl: 'رابط الدليل',
    occurredOn: 'تاريخ الحادثة',
  },

  contactPage: {
    eyebrow: 'نحن هنا للاستماع',
    lead: 'أرسل استفسارك وسيتابع فريقنا معك عبر بيانات التواصل التي تضعها في النموذج.',
    formTitle: 'أرسل لنا رسالة',
    formLead: 'الحقول المعلّمة بنجمة مطلوبة. سنستخدم بياناتك للرد على هذا الطلب فقط.',
    detailsTitle: 'بيانات التواصل',
    detailsLead: 'تواصل معنا مباشرة أو تحقق من حسابات المؤسسة الرسمية.',
    responseNote: 'تصل رسالتك مباشرة إلى فريق المؤسسة وتحصل على رقم مرجعي للمتابعة.',
    officialChannels: 'حساباتنا الرسمية',
    noContactDetails: 'ستظهر بيانات التواصل هنا بعد إضافتها من لوحة التحكم.',
    verifyChannels: 'تحقق من جميع القنوات',
    complaintsEyebrow: 'مسار آمن ومستقل',
    complaintsLead: 'يمكنك تقديم شكوى بسرية، مع إمكانية عدم ذكر اسمك أو أي وسيلة تواصل.',
    complaintFormTitle: 'تفاصيل الشكوى',
  },

  states: {
    emptyTitle: 'لا يوجد محتوى بعد',
    emptyBody: 'سيظهر المحتوى هنا فور نشره.',
    emptyFiltered: 'لا نتائج مطابقة لهذه التصفية.',
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

    // Thrown by the service layer. These twelve keys were referenced in code
    // and defined in neither dictionary, and `resolveKey` returns the key
    // itself when it does not resolve — so an editor who tripped the
    // safeguarding gate saw the Latin string `errors.media.minorConsentState`
    // inside a right-to-left Arabic screen.
    invalidEmail: 'أدخل بريداً إلكترونياً صحيحاً.',

    slug: {
      taken: 'هذا المسار مستخدم بالفعل. اختر مساراً آخر.',
    },

    content: {
      unpublishFirst: 'أوقف نشر العنصر قبل هذا الإجراء.',
      keyTaken: 'هذا المُعرِّف مستخدم بالفعل. اختر مُعرِّفاً آخر.',
    },

    media: {
      altRequired: 'النص البديل بالعربية مطلوب لكل وسيط.',
      minorConsentState:
        'صورة تُظهر طفلاً يمكن التعرّف عليه لا يمكن حفظها بحالة «لا يلزم إذن».',
      minorConsentRequired:
        'لا يمكن النشر: وسيط يُظهر أطفالاً يمكن التعرّف عليهم دون إذن موثّق.',
      consentReferenceRequired:
        'أدخل مرجع الإذن الموثّق. الإقرار بالحصول على إذن دون مرجع لا يُقبل.',
    },

    metric: {
      periodOrder: 'تاريخ بداية الفترة يجب أن يسبق تاريخ نهايتها.',
      sourceRequired: 'مصدر الرقم مطلوب.',
      mustBeVerified: 'لا يمكن نشر رقم أثر قبل التحقّق منه.',
    },

    story: {
      consentRequired: 'قصة المستفيد تحتاج إلى إذن موثّق قبل النشر.',
    },

    // Zod refines that mirror database CHECK constraints, so the editor gets
    // the message on the field rather than a constraint name.
    project: {
      dateOrder: 'تاريخ بداية المشروع يجب أن يسبق تاريخ نهايته.',
    },

    post: {
      expiryOnlyAnnouncements: 'تاريخ الانتهاء متاح للإعلانات فقط.',
    },

    partner: {
      membershipLevelShape: 'مستوى العضوية متاح للشبكات والعضويات فقط.',
    },

    attachment: {
      sensitiveRefused: 'لا يمكن تنزيل مرفق مرتبط ببلاغ سرّي.',
    },

    // Thrown by `services/users/user.service.ts` and `redirect.service.ts`.
    // The first three mirror the database's own refusals
    // (`guard_profile_privileges`): the service states the rule before the
    // statement is issued, and the trigger states it again for a raw console.
    users: {
      selfRole: 'لا يمكنك تغيير دورك بنفسك. اطلب ذلك من مدير آخر.',
      selfDeactivate: 'لا يمكنك إيقاف حسابك بنفسك.',
      lastAdmin: 'لا يمكن إزالة آخر مدير نشط في النظام.',
      inviteFailed: 'تعذّر إرسال الدعوة. تحقّق من البريد الإلكتروني وحاول مجدداً.',
      emailTaken: 'يوجد حساب بهذا البريد الإلكتروني بالفعل.',
      profileMissing: 'أُنشئ الحساب لكن لم يُعثر على ملفه. راجع مدير النظام.',
    },

    redirects: {
      sourceTaken: 'يوجد تحويل من هذا المسار بالفعل.',
      pathFormat: 'يجب أن يبدأ المسار بشرطة مائلة «/» ولا يحتوي على مسافات.',
      loop: 'المصدر والوجهة متطابقان.',
      reserved: 'لا يمكن تحويل مسارات لوحة التحكم أو الواجهة البرمجية.',
    },

    mediaInUse: 'لا يمكن حذف وسيط مستخدم في محتوى. أزل الاستخدامات أولاً.',
  },

  /**
   * Admin panel copy that crosses the action boundary as a dictionary key —
   * result messages, row actions, confirmations, the screens with no field
   * config. The admin is Arabic-only, so the English half of this block is
   * never rendered; it exists because `Dictionary` is derived from this file
   * and both locales must carry the same shape.
   */
  admin: {
    saved: 'تم الحفظ.',
    created: 'تمت الإضافة.',
    statusChanged: 'تم تغيير الحالة.',
    deleted: 'تم الحذف.',
    invited: 'أُرسلت الدعوة بالبريد الإلكتروني.',
    updated: 'تم التحديث.',

    form: {
      checkFields: 'تحقّق من الحقول المميّزة.',
      save: 'حفظ',
      saveDraft: 'حفظ كمسودة',
      submitReview: 'إرسال للمراجعة',
      publish: 'نشر',
      unpublish: 'إلغاء النشر',
      archive: 'أرشفة',
      restore: 'إعادة إلى مسودة',
      delete: 'حذف',
      confirmDelete: 'تأكيد الحذف',
      deleteHint: 'الحذف نهائي ولا يمكن التراجع عنه.',
      deletePublishedHint: 'أوقف نشر العنصر قبل حذفه.',
      actions: 'إجراءات',
      add: 'إضافة',
      back: 'رجوع إلى القائمة',
      lastEdited: 'آخر تعديل',
    },

    flash: {
      error: 'تعذّر تنفيذ الإجراء.',
    },

    users: {
      title: 'المستخدمون',
      description:
        'صلاحية قراءة الشكاوى السرّية تُمنح لكل شخص على حدة، ولا يمنحها دور المدير تلقائياً.',
      invite: 'دعوة مستخدم',
      inviteHint:
        'يصل المدعوّ بريد لتعيين كلمة المرور. يبدأ الحساب بدور «محرّر» ما لم يُحدَّد غير ذلك.',
      email: 'البريد الإلكتروني',
      fullName: 'الاسم الكامل',
      role: 'الدور',
      sendInvite: 'إرسال الدعوة',
      setRole: 'تغيير الدور',
      grantSensitive: 'منح صلاحية الشكاوى السرّية',
      revokeSensitive: 'سحب صلاحية الشكاوى السرّية',
      deactivate: 'إيقاف الحساب',
      reactivate: 'إعادة تفعيل الحساب',
      confirmDeactivate: 'تأكيد الإيقاف',
      you: 'أنت',
      selfHint: 'لا يمكنك تغيير دورك أو إيقاف حسابك بنفسك.',
      roles: { admin: 'مدير', content_manager: 'مسؤول محتوى', editor: 'محرّر' },
      active: 'نشط',
      inactive: 'موقوف',
      sensitiveAllowed: 'مسموح',
      lastLogin: 'آخر دخول',
      never: 'لم يدخل بعد',
    },

    redirects: {
      title: 'التحويلات',
      description:
        'تسري فوراً على الموقع: يستشير الوكيل قائمة مخزّنة مؤقتاً ويُحدَّثها كل حفظ.',
      add: 'إضافة تحويل',
      source: 'من المسار',
      sourceHint: 'المسار القديم كما يظهر في الرابط، مثل /old-page. يُطابَق مع أو بدون بادئة اللغة.',
      destination: 'إلى المسار',
      destinationHint: 'مسار داخلي يبدأ بـ / أو رابط كامل يبدأ بـ https://.',
      code: 'رمز الحالة',
      codes: {
        '301': '301 — دائم',
        '302': '302 — مؤقت',
        '307': '307 — مؤقت (يحفظ الطريقة)',
        '308': '308 — دائم (يحفظ الطريقة)',
      },
      empty: 'لا تحويلات.',
    },

    media: {
      edit: 'تعديل بيانات الوسيط',
      usage: 'أين يُستخدم',
      notUsed: 'غير مستخدم في أي محتوى.',
      usageHint: 'لا يمكن حذف الوسيط ما دام مستخدماً. أزل الاستخدامات أولاً ثم احذفه.',
      delete: 'حذف الوسيط',
      deleteHint: 'يُحذف السجل والملف من التخزين.',
      file: 'الملف',
      dimensions: 'الأبعاد',
      size: 'الحجم',
      uploaded: 'رُفع في',
      exifNotStripped: 'بيانات EXIF لم تُجرَّد',
      openDetail: 'التفاصيل',
      consent: {
        not_required: 'لا تلزم موافقة',
        obtained: 'مُوثَّقة',
        pending: 'قيد الانتظار',
      },
      usageEntity: {
        program: 'برنامج',
        project: 'مشروع',
        story: 'قصة',
        post: 'خبر',
        vacancy: 'وظيفة',
        page: 'صفحة',
        partner: 'شريك',
        person: 'شخص',
        publication: 'إصدار',
        organization: 'بيانات المؤسسة',
        project_gallery: 'معرض مشروع',
        story_gallery: 'معرض قصة',
        program_gallery: 'معرض برنامج',
        post_gallery: 'معرض خبر',
      },
    },

    submissions: {
      handling: 'المعالجة',
      state: 'الحالة',
      internalNote: 'ملاحظة داخلية',
      noteHint: 'لا تُنسخ هذه الملاحظة إلى سجل التدقيق.',
      handledBy: 'المسؤول',
      handledAt: 'آخر معالجة',
      notHandled: 'لم تُعالَج بعد',
      download: 'تنزيل المرفق',
      downloadHint: 'يُسجَّل كل تنزيل في سجل التدقيق.',
      sensitiveNoDownload: 'لا يُتاح تنزيل مرفقات الشكاوى السرّية.',
      purgeAt: 'يُحذف تلقائياً في',
      field: 'الحقل',
      value: 'القيمة',
      empty: 'لا محتوى.',
      states: {
        new: 'جديد',
        in_progress: 'قيد المعالجة',
        handled: 'مُعالَج',
        archived: 'مؤرشف',
      },
    },
  },

  footer: {
    identityTitle: 'السجل التعريفي',
    channelsTitle: 'القنوات الرسمية',
    programsTitle: 'البرامج',
    brandTitle: 'المؤسسة',
    quickLinksTitle: 'روابط سريعة',
    getInvolvedTitle: 'شارك معنا',
    contactTitle: 'التواصل والحسابات',
    secondaryEmail: 'بريد إلكتروني إضافي',
    noSocialLinks: 'ستظهر الحسابات الاجتماعية هنا بعد إضافة روابطها في الإعدادات.',
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

  /** Option labels for the six public forms. Keys are the schema's values. */
  formOptions: {
    un: 'أمم متحدة', ingo: 'منظمة دولية', foundation: 'مؤسسة مانحة',
    government: 'جهة حكومية', local_ngo: 'منظمة أهلية محلية',
    private: 'قطاع خاص', other: 'أخرى',

    funding: 'تمويل', consortium: 'ائتلاف', implementation: 'تنفيذ',
    technical: 'دعم فني',

    general: 'استفسار عام', partnership: 'شراكة', media: 'إعلام',
    complaint: 'شكوى',

    under_18: 'أقل من 18', '18_24': '18–24', '25_34': '25–34',
    '35_49': '35–49', '50_plus': '50 فأكثر',

    psychosocial: 'الدعم النفسي الاجتماعي', education: 'التعليم',
    relief_distribution: 'توزيع المساعدات', logistics: 'اللوجستيات',
    administration: 'الشؤون الإدارية',

    weekdays: 'أيام الأسبوع', weekends: 'نهاية الأسبوع',
    evenings: 'المساء', flexible: 'مرن',

    service_quality: 'جودة الخدمة', staff_conduct: 'سلوك أحد العاملين',
    selection_process: 'آلية الاختيار', safeguarding: 'الحماية والصون',
    corruption: 'فساد أو سوء استخدام',

    none: 'لا أرغب بالتواصل', email: 'بالبريد الإلكتروني', phone: 'بالهاتف',

    facebook: 'فيسبوك', instagram: 'إنستغرام', whatsapp: 'واتساب',
    telegram: 'تيليغرام', x: 'إكس', website: 'موقع إلكتروني',
    phone_call: 'مكالمة هاتفية', sms: 'رسالة نصية', in_person: 'مقابلة مباشرة',
  },

  /** Copy for generated metadata and social cards. */
  seo: {
    ogImageAlt: 'بطاقة تعريفية بالمؤسسة تحمل اسمها ووصفها المختصر',
    getInvolved: {
      volunteerTitle: 'تطوّع معنا',
    },
  },

  a11y: {
    mainNav: 'التنقّل الرئيسي',
    breadcrumb: 'مسار التصفّح',
    pagination: 'ترقيم الصفحات',
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
