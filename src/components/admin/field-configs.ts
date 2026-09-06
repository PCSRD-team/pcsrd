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

export const POST_FIELDS: FieldSpec[] = [
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
  { kind: 'media', name: 'heroMediaId', label: 'الصورة الرئيسية' },
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

export const STORY_FIELDS: FieldSpec[] = [
  { kind: 'bilingual', name: 'title', label: 'العنوان', required: true, max: 200 },
  SLUG,
  { kind: 'bilingual', name: 'summary', label: 'ملخّص', multiline: true, max: 600 },
  { kind: 'richtext', name: 'body', labelAr: 'المحتوى (عربي)', labelEn: 'Body (English)' },
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
  { kind: 'bilingual', name: 'strategicObjective', label: 'الهدف الاستراتيجي', multiline: true, max: 600 },
  {
    kind: 'media',
    name: 'heroMediaId',
    label: 'صورة السلايدر الرئيسية',
    hint: 'اختر صورة من مكتبة الوسائط. تظهر في سلايدر البرامج في الصفحة الرئيسية.',
  },
  {
    kind: 'text',
    name: 'displayOrder',
    label: 'ترتيب الظهور في الصفحة الرئيسية',
    type: 'number',
    hint: 'تستخدم الصفحة الرئيسية هذا الرقم لترتيب البرامج المنشورة في السلايدر.',
  },
];
