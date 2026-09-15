import { ADMIN_OPTIONS } from '@/lib/admin-options';
import type { FieldSpec } from './content-form';

/**
 * One config per entity — the payoff of the generic form layer.
 *
 * These are the screens. Adding an entity means adding an entry here and a
 * route that renders `ContentForm` with it, not designing another editor.
 */

const SLUG: FieldSpec = {
  kind: 'bilingual',
  name: 'slug',
  label: 'المسار',
  required: true,
  hint: 'حروف وأرقام وشرطات فقط.',
};

/** Programme / project options for the relation selects, loaded per page. */
export type RelationOptions = {
  programs: { value: string; label: string }[];
  projects: { value: string; label: string }[];
};

const GALLERY: FieldSpec = {
  kind: 'gallery',
  name: 'gallery',
  label: 'معرض الصور',
  hint: 'بالترتيب الذي تظهر به. كل صورة تخضع لقاعدة الموافقة عند النشر.',
};

const relationFields = (options: RelationOptions): FieldSpec[] => [
  { kind: 'select', name: 'programId', label: 'البرنامج', options: options.programs },
  { kind: 'select', name: 'projectId', label: 'المشروع', options: options.projects },
];

export const postFields = (options: RelationOptions): FieldSpec[] => [
  { kind: 'bilingual', name: 'title', label: 'العنوان', required: true, max: 200 },
  SLUG,
  {
    kind: 'select',
    name: 'category',
    label: 'التصنيف',
    options: [...ADMIN_OPTIONS.postCategory],
    required: true,
  },
  { kind: 'bilingual', name: 'excerpt', label: 'مقتطف', multiline: true, max: 400 },
  { kind: 'richtext', name: 'body', labelAr: 'المحتوى (عربي)', labelEn: 'Body (English)' },
  ...relationFields(options),
  { kind: 'media', name: 'heroMediaId', label: 'الصورة الرئيسية' },
  GALLERY,
  {
    kind: 'text',
    name: 'expiresAt',
    label: 'تاريخ انتهاء الإعلان',
    type: 'date',
    // The archive cron reads this. Only announcements may carry one — the
    // `posts_expiry_only_announcements` constraint refuses it on a news item.
    hint: 'للإعلانات فقط. تُؤرشَف تلقائياً بعد هذا التاريخ.',
  },
  { kind: 'checkbox', name: 'isFeatured', label: 'مميّز' },
];

export const storyFields = (options: RelationOptions): FieldSpec[] => [
  { kind: 'bilingual', name: 'title', label: 'العنوان', required: true, max: 200 },
  SLUG,
  { kind: 'bilingual', name: 'summary', label: 'ملخّص', multiline: true, max: 600 },
  { kind: 'richtext', name: 'body', labelAr: 'المحتوى (عربي)', labelEn: 'Body (English)' },
  ...relationFields(options),
  { kind: 'bilingual', name: 'quoteText', label: 'اقتباس', multiline: true, max: 400 },
  { kind: 'bilingual', name: 'quoteAttribution', label: 'نسبة الاقتباس', max: 120 },
  {
    kind: 'checkbox',
    name: 'subjectAnonymized',
    label: 'هوية صاحب القصة مُخفاة',
    // Default-on, and the form says what turning it off costs.
    hint: 'إن أُلغيت، يصبح توثيق الموافقة إلزامياً قبل الحفظ.',
  },
  { kind: 'checkbox', name: 'consentObtained', label: 'الموافقة مُوثَّقة' },
  {
    kind: 'text',
    name: 'consentReference',
    label: 'مرجع الموافقة',
    hint: 'رقم أو مسار المستند. مطلوب لأي قصة تكشف هوية صاحبها.',
  },
  { kind: 'media', name: 'heroMediaId', label: 'الصورة الرئيسية' },
  GALLERY,
  { kind: 'checkbox', name: 'isFeatured', label: 'مميّزة' },
];

export const VACANCY_FIELDS: FieldSpec[] = [
  { kind: 'bilingual', name: 'title', label: 'المسمّى', required: true, max: 200 },
  SLUG,
  {
    kind: 'select',
    name: 'type',
    label: 'النوع',
    options: [...ADMIN_OPTIONS.vacancyType],
    required: true,
  },
  { kind: 'bilingual', name: 'location', label: 'مكان العمل', max: 120 },
  {
    kind: 'select',
    name: 'employmentType',
    label: 'نوع التعاقد',
    options: [
      { value: 'FULL_TIME', label: 'دوام كامل' },
      { value: 'PART_TIME', label: 'دوام جزئي' },
      { value: 'VOLUNTEER', label: 'تطوّع' },
    ],
  },
  { kind: 'richtext', name: 'description', labelAr: 'الوصف (عربي)', labelEn: 'Description (English)' },
  { kind: 'richtext', name: 'requirements', labelAr: 'المتطلبات (عربي)', labelEn: 'Requirements (English)' },
  {
    kind: 'text',
    name: 'deadline',
    label: 'آخر موعد للتقديم',
    type: 'date',
    required: true,
    // Not optional anywhere in the system: the column is `not null` and the
    // daily archive job depends on every row having one.
    hint: 'إلزامي. تُؤرشَف الوظيفة تلقائياً بعده ويختفي نموذج التقديم.',
  },
  {
    kind: 'select',
    name: 'applicationMethod',
    label: 'طريقة التقديم',
    options: [
      { value: 'form', label: 'نموذج على الموقع' },
      { value: 'email', label: 'بريد إلكتروني' },
    ],
  },
  {
    kind: 'text',
    name: 'applicationEmail',
    label: 'بريد التقديم',
    type: 'email',
    hint: 'مطلوب إذا كانت طريقة التقديم بالبريد.',
  },
];

export const PUBLICATION_FIELDS: FieldSpec[] = [
  { kind: 'bilingual', name: 'title', label: 'العنوان', required: true, max: 200 },
  SLUG,
  {
    kind: 'select',
    name: 'type',
    label: 'النوع',
    options: [...ADMIN_OPTIONS.publicationType],
    required: true,
  },
  { kind: 'bilingual', name: 'description', label: 'الوصف', multiline: true, max: 800 },
  { kind: 'media', name: 'fileArId', label: 'الملف (عربي)', assetKind: 'document' },
  {
    kind: 'media',
    name: 'fileEnId',
    label: 'الملف (إنجليزي)',
    assetKind: 'document',
    hint: 'إن تُرك فارغاً، يُعرض الملف العربي للقارئ الإنجليزي.',
  },
  { kind: 'text', name: 'publishedYear', label: 'سنة النشر', type: 'number' },
  { kind: 'checkbox', name: 'isFeatured', label: 'مميّز' },
  { kind: 'text', name: 'displayOrder', label: 'ترتيب الظهور', type: 'number' },
];

export const PAGE_FIELDS: FieldSpec[] = [
  {
    kind: 'text',
    name: 'key',
    label: 'المفتاح',
    required: true,
    hint: 'privacy · accessibility · terms · verify. لا يُغيَّر بعد الإنشاء — المسار يبحث به.',
  },
  { kind: 'bilingual', name: 'title', label: 'العنوان', required: true, max: 200 },
  SLUG,
  { kind: 'richtext', name: 'body', labelAr: 'المحتوى (عربي)', labelEn: 'Body (English)' },
];

export const PROGRAM_FIELDS: FieldSpec[] = [
  {
    kind: 'select',
    name: 'key',
    label: 'المفتاح',
    options: [...ADMIN_OPTIONS.programKey],
    required: true,
    hint: 'ثلاثة برامج فقط. المفتاح يربط البرنامج بمشاريعه ولونه.',
  },
  { kind: 'bilingual', name: 'title', label: 'الاسم', required: true, max: 200 },
  SLUG,
  {
    kind: 'bilingual',
    name: 'tagline',
    label: 'وصف السلايدر / الجملة التعريفية',
    max: 200,
    hint: 'يظهر كوصف قصير داخل بطاقة البرنامج في الصفحة الرئيسية وصفحة البرنامج.',
  },
  {
    kind: 'select',
    name: 'targetGroups',
    label: 'الفئات المستهدفة',
    options: [...ADMIN_OPTIONS.targetGroup],
    multiple: true,
  },
  { kind: 'richtext', name: 'introduction', labelAr: 'المقدّمة (عربي)', labelEn: 'Introduction (English)' },
  {
    kind: 'richtext',
    name: 'eligibility',
    labelAr: 'من يستفيد (عربي)',
    labelEn: 'Who qualifies (English)',
  },
  {
    kind: 'richtext',
    name: 'howToAccess',
    labelAr: 'كيف تصل إلى الخدمة (عربي)',
    labelEn: 'How to access (English)',
  },
  { kind: 'richtext', name: 'rationale', labelAr: 'المبرّر (عربي)', labelEn: 'Rationale (English)' },
  {
    kind: 'richtext',
    name: 'impactStatement',
    labelAr: 'بيان الأثر (عربي)',
    labelEn: 'Impact statement (English)',
  },
  {
    kind: 'richtext',
    name: 'sustainability',
    labelAr: 'الاستدامة (عربي)',
    labelEn: 'Sustainability (English)',
  },
  { kind: 'bilingual', name: 'strategicObjective', label: 'الهدف الاستراتيجي', multiline: true, max: 600 },
  {
    kind: 'media',
    name: 'heroMediaId',
    label: 'صورة السلايدر الرئيسية',
    hint: 'اختر صورة من مكتبة الوسائط. تظهر في سلايدر البرامج في الصفحة الرئيسية.',
  },
  GALLERY,
  {
    kind: 'text',
    name: 'displayOrder',
    label: 'ترتيب الظهور في الصفحة الرئيسية',
    type: 'number',
    hint: 'تستخدم الصفحة الرئيسية هذا الرقم لترتيب البرامج المنشورة في السلايدر.',
  },
];

// ── Catalogue entities (STATE-006) ───────────────────────────────────────
// Partners carry a `status` and use the publish bar; people and impact figures
// have no lifecycle — `isPublic` is the decision — and use the single save
// button (`bar="save"`), which also keeps the metric's own `status` select
// from colliding with the bar's `status` buttons.

export const PARTNER_FIELDS: FieldSpec[] = [
  { kind: 'bilingual', name: 'name', label: 'الاسم', required: true, max: 160 },
  {
    kind: 'select',
    name: 'type',
    label: 'النوع',
    options: [...ADMIN_OPTIONS.partnerType],
    required: true,
  },
  {
    kind: 'select',
    name: 'membershipLevel',
    label: 'مستوى العضوية',
    options: [...ADMIN_OPTIONS.membershipLevel],
    hint: 'للشبكات والعضويات فقط؛ يُتجاهل لغيرها.',
  },
  { kind: 'bilingual', name: 'sector', label: 'القطاع', max: 120 },
  { kind: 'bilingual', name: 'description', label: 'الوصف', multiline: true, max: 800 },
  {
    kind: 'text',
    name: 'website',
    label: 'الموقع الإلكتروني',
    hint: 'رابط كامل يبدأ بـ https://',
  },
  { kind: 'media', name: 'logoMediaId', label: 'الشعار' },
  {
    kind: 'select',
    name: 'logoPermission',
    label: 'إذن عرض الشعار',
    options: [...ADMIN_OPTIONS.logoPermission],
    required: true,
    // The public site renders the logo only when this is `granted`; a
    // published partner with a pending permission appears by name alone.
    hint: 'لا يُعرض الشعار على الموقع إلا إذا كان الإذن ممنوحاً.',
  },
  { kind: 'checkbox', name: 'isFeatured', label: 'مميّز' },
  { kind: 'text', name: 'displayOrder', label: 'ترتيب الظهور', type: 'number' },
];

export const PERSON_FIELDS: FieldSpec[] = [
  { kind: 'bilingual', name: 'name', label: 'الاسم', required: true, max: 120 },
  { kind: 'bilingual', name: 'role', label: 'الصفة', required: true, max: 120 },
  {
    kind: 'select',
    name: 'category',
    label: 'الفئة',
    options: [...ADMIN_OPTIONS.personCategory],
    required: true,
  },
  { kind: 'bilingual', name: 'bio', label: 'نبذة', multiline: true, max: 1200 },
  { kind: 'media', name: 'photoMediaId', label: 'الصورة' },
  {
    kind: 'checkbox',
    name: 'isPublic',
    label: 'يظهر على الموقع',
    // DNH-5. Naming staff in Gaza is a safety decision made per person.
    hint: 'قرار أمني يُتّخذ لكل شخص على حدة. الصورة تخضع لقاعدة الموافقة نفسها عند النشر.',
  },
  { kind: 'text', name: 'displayOrder', label: 'ترتيب الظهور', type: 'number' },
];

/**
 * Impact figures take their programme and project options at render time —
 * the relations are rows, not enums — so this is a function of those options
 * rather than a constant.
 */
export function metricFields(options: {
  programs: { value: string; label: string }[];
  projects: { value: string; label: string }[];
}): FieldSpec[] {
  return [
    { kind: 'bilingual', name: 'label', label: 'المؤشر', required: true, max: 160 },
    {
      kind: 'text',
      name: 'value',
      label: 'القيمة',
      required: true,
      hint: 'أرقام فقط، حتى منزلتين عشريتين. تُحفظ كنص كي لا يُقرَّب عدد المستفيدين.',
    },
    { kind: 'text', name: 'unit', label: 'الوحدة', required: true, hint: 'مثل: مستفيد، جلسة، أسرة.' },
    {
      kind: 'select',
      name: 'displayPrefix',
      label: 'بادئة العرض',
      options: [
        { value: '+', label: '+ (أكثر من)' },
        { value: '~', label: '~ (تقريباً)' },
      ],
    },
    { kind: 'select', name: 'programId', label: 'البرنامج', options: options.programs },
    { kind: 'select', name: 'projectId', label: 'المشروع', options: options.projects },
    { kind: 'text', name: 'periodStart', label: 'بداية الفترة', type: 'date', required: true },
    { kind: 'text', name: 'periodEnd', label: 'نهاية الفترة', type: 'date', required: true },
    {
      kind: 'select',
      name: 'status',
      label: 'حالة التحقّق',
      options: [...ADMIN_OPTIONS.metricStatus],
      required: true,
      // The rule: no published figure without its period and verification
      // status. `assertMetricPublishable` refuses `isPublic` on anything but
      // `verified` with a source.
      hint: 'لا يُنشر الرقم على الموقع إلا إذا كان مُتحقَّقاً منه ومقترناً بمصدره.',
    },
    {
      kind: 'text',
      name: 'verificationSource',
      label: 'مصدر التحقّق',
      hint: 'مطلوب لأي رقم مُتحقَّق منه: تقرير، تقييم، سجل داخلي.',
    },
    { kind: 'checkbox', name: 'isPublic', label: 'منشور على الموقع' },
    { kind: 'checkbox', name: 'isFeatured', label: 'مميّز' },
    { kind: 'text', name: 'displayOrder', label: 'ترتيب الظهور', type: 'number' },
  ];
}

/** Media metadata. `alt_ar` is required at every layer; this is the first. */
export const MEDIA_FIELDS: FieldSpec[] = [
  { kind: 'bilingual', name: 'alt', label: 'النص البديل', required: true, max: 300 },
  { kind: 'bilingual', name: 'caption', label: 'التعليق', multiline: true, max: 500 },
  { kind: 'text', name: 'credit', label: 'المصدر / حقوق الصورة' },
  {
    kind: 'select',
    name: 'consent',
    label: 'حالة الموافقة',
    options: [...ADMIN_OPTIONS.consentStatus],
    required: true,
    hint: 'سجّل الموافقة ومرجعها أولاً؛ لا يمكن وسم الصورة بأنها تُظهر قُصّراً قبل ذلك.',
  },
  {
    kind: 'text',
    name: 'consentReference',
    label: 'مرجع الموافقة',
    hint: 'رقم أو مسار نموذج الموافقة. مطلوب لأي صورة تُظهر قُصّراً.',
  },
  {
    // `chk_media_minor_consent` in the database: this may be on only when
    // consent is `obtained` with a reference. The order of the fields above
    // is the order the editor has to fill them in.
    kind: 'checkbox',
    name: 'hasIdentifiableMinors',
    label: 'تُظهر قُصّراً يمكن التعرّف عليهم',
    hint: 'يُقبل فقط بعد تسجيل موافقة موثّقة ومرجعها في الحقلين أعلاه. تحفظه قاعدة البيانات بهذا الشرط ولا تقبله بغيره.',
  },
];
