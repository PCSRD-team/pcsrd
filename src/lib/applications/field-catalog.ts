import type {
  ApplicationFieldConfig,
  ApplicationFieldOption,
} from '@/db/schema/applications';
import type { ApplicationFieldType, ApplicationFormKind } from '@/db/schema/enums';

/**
 * The field catalogue — the vetted half of the form builder.
 *
 * `application_form_fields` lets an admin invent a field: a label, a type, a
 * few options, a tick for "required". That freedom is deliberate and it is not
 * going away, because a recruitment officer at 1am with a donor deadline must
 * never be blocked by a developer's release cycle. But a purely free-form
 * builder buys that freedom with four costs, and this file is what pays them
 * back for the fields people actually need:
 *
 * 1. **Validation an admin could not write, and must not be able to weaken.**
 *    A Palestinian ID is nine digits; a graduation year is not `19` and not
 *    `20250`; a CV is a document, not a 4 MB screenshot. Those rules live in
 *    `config` here, and `application_form_fields.catalogKey` records that the
 *    field came from the catalogue — which is what lets the answer schema
 *    apply the vetted rule rather than a generic "it is a string". A field the
 *    admin built by hand gets generic validation only, and that is the correct
 *    trade: the admin owns what they invented, the catalogue owns what it
 *    vouched for.
 *
 * 2. **The export, the search and the pipeline only work on stable keys.**
 *    `answers` is keyed by `key`, and two forms that both ask for a mobile
 *    number should answer on the same key, or the spreadsheet that merges a
 *    job and a volunteer intake has two columns where it needs one. The
 *    catalogue's `key` is the default written to the row, so agreement is the
 *    path of least resistance rather than a convention nobody remembers.
 *
 * 3. **Bilingual rendering has to be true, not aspirational.** Every entry
 *    carries `labelEn` as a non-optional string. An admin authoring in Arabic
 *    at speed will leave the English blank — which is honest, and the
 *    untranslated state handles it — but a field drawn from the catalogue is
 *    bilingual from the first click, so the English form is not a page of
 *    Arabic labels with an English submit button.
 *
 * 4. **The privacy posture has to survive the form builder.** `sensitive` is
 *    not a warning label: it gates rendering behind the form's consent tick
 *    and keeps the answer out of the default export. Deciding which fields
 *    carry it is a policy decision, and a policy decision belongs in reviewed
 *    source, not in whatever the admin ticked on a Thursday.
 *
 * `identityRole` is the fifth thing only a catalogue can promise:
 * `app.submit_application()` copies three answers into
 * `applications.applicantName / Email / Phone` so the applicants table can
 * sort, search and de-duplicate on columns that exist. It needs to be told
 * *which* three fields those are, and "the one whose catalogue entry claims
 * the role" is an answer that does not depend on the admin naming a field
 * correctly.
 *
 * What this file is not: it is not the schema, it is not the copy deck, and it
 * is not exhaustive. It is the set of fields a humanitarian recruitment in
 * Gaza asks for often enough that getting them wrong repeatedly would be
 * worse than getting them right once.
 *
 * Nothing here runs at import time except building the lookup map. The
 * invariants are checked by `assertCatalogInvariants()`, which the unit test
 * calls — see the note above it for why it is not called on module load.
 */

/**
 * Which part of a form a field belongs to.
 *
 * The group is the catalogue's own organisation — a picker with eighty-seven
 * entries in one list is a list nobody reads — and it doubles as the form
 * order: the groups are listed in the sequence an application reads in, so
 * "everything in `identity`, then everything in `contact`" is already a
 * sensible draft.
 */
export type CatalogGroup =
  | 'identity'
  | 'contact'
  | 'location'
  | 'education'
  | 'experience'
  | 'skills'
  | 'attachments'
  | 'availability'
  | 'compliance'
  | 'references'
  | 'other';

/** One ready-made field an admin can add to a form with a single click. */
export type CatalogField = {
  /** Stable identity. Also the default `key` written to application_form_fields. */
  key: string;
  group: CatalogGroup;
  type: ApplicationFieldType;
  labelAr: string;
  labelEn: string;
  helpAr?: string;
  helpEn?: string;
  placeholderAr?: string;
  options?: ApplicationFieldOption[];
  config?: ApplicationFieldConfig;
  /** Suggested default when the admin adds it; the admin can still flip it. */
  defaultRequired?: boolean;
  /** Personal data the organisation would rather not hold: ID number, date of birth. */
  sensitive?: boolean;
  /** Fills applications.applicantName / Email / Phone. At most one field per role. */
  identityRole?: 'name' | 'email' | 'phone';
};

/** The groups in form order. The picker and the default ordering both read this. */
export const CATALOG_GROUPS: readonly CatalogGroup[] = [
  'identity',
  'contact',
  'location',
  'education',
  'experience',
  'skills',
  'attachments',
  'availability',
  'compliance',
  'references',
  'other',
];

export const GROUP_LABEL_AR: Record<CatalogGroup, string> = {
  identity: 'البيانات الشخصية',
  contact: 'بيانات التواصل',
  location: 'مكان السكن',
  education: 'المؤهل العلمي',
  experience: 'الخبرة العملية',
  skills: 'المهارات واللغات',
  attachments: 'المرفقات',
  availability: 'الجاهزية والتفرغ',
  compliance: 'الإقرارات والسياسات',
  references: 'المُعرِّفون',
  other: 'حقول أخرى',
};

export const GROUP_LABEL_EN: Record<CatalogGroup, string> = {
  identity: 'Personal details',
  contact: 'Contact details',
  location: 'Location',
  education: 'Education',
  experience: 'Work experience',
  skills: 'Skills and languages',
  attachments: 'Attachments',
  availability: 'Availability',
  compliance: 'Declarations and policies',
  references: 'Referees',
  other: 'Other fields',
};

/**
 * Language proficiency, shared by the three language fields.
 *
 * Declared once rather than pasted three times: a level added here is added to
 * Arabic, English and Hebrew at the same moment, which is the only way the
 * three stay comparable in an export.
 */
const LANGUAGE_LEVELS: ApplicationFieldOption[] = [
  { value: 'native', labelAr: 'لغة أم', labelEn: 'Native' },
  { value: 'advanced', labelAr: 'متقدم', labelEn: 'Advanced' },
  { value: 'intermediate', labelAr: 'متوسط', labelEn: 'Intermediate' },
  { value: 'beginner', labelAr: 'مبتدئ', labelEn: 'Beginner' },
];

/**
 * The catalogue, flat and in form order.
 *
 * One array rather than a map of groups, because the builder renders it in
 * order and filters by `group` — and because a flat list makes "is this key
 * already taken" a single pass rather than a walk over eleven buckets.
 */
export const FIELD_CATALOG: readonly CatalogField[] = [
  // ── identity ───────────────────────────────────────────────────────────
  {
    key: 'full_name_ar',
    group: 'identity',
    type: 'short_text',
    labelAr: 'الاسم الرباعي بالعربية',
    labelEn: 'Full name in Arabic (four names)',
    helpAr: 'كما هو مثبت في بطاقة الهوية.',
    helpEn: 'As written on your ID card.',
    placeholderAr: 'الاسم واسم الأب واسم الجد واسم العائلة',
    config: { minLength: 5, maxLength: 120 },
    defaultRequired: true,
    identityRole: 'name',
  },
  {
    key: 'full_name_en',
    group: 'identity',
    type: 'short_text',
    labelAr: 'الاسم الكامل بالإنجليزية كما في جواز السفر',
    labelEn: 'Full name in English, as in your passport',
    helpAr: 'يُستخدم في المراسلات مع الجهات الدولية، فاكتبه بالحروف نفسها المثبتة في الجواز.',
    helpEn: 'Used in correspondence with international bodies, so match the passport spelling.',
    config: { minLength: 5, maxLength: 120 },
  },
  {
    // ── The privacy tension, stated once for the three fields that carry it
    //
    // `20-PRIVACY §5` is explicit: collect an age *band*, not a birth date,
    // and do not collect a national ID at all unless something makes it
    // unavoidable. The public volunteer form obeys that literally — see
    // `AGE_BANDS` in `src/lib/validation/forms.ts`, which has no date of birth
    // anywhere near it.
    //
    // Recruitment is the case where it is sometimes not avoidable: a signed
    // contract, a payroll file and a donor's due-diligence list all need a
    // verified identity, and an offer that cannot be made because the file has
    // no ID number helps nobody. So the fields exist — and every one of them
    // carries `sensitive: true`, which is the whole mechanism. Sensitive means
    // the field refuses to render unless the form carries a consent tick, and
    // means the answer is left out of the export unless the exporter asks for
    // it by name. The effect is that collecting a national ID is a deliberate,
    // visible act performed by a named admin on a specific form, rather than a
    // default that arrives with the template and is never questioned again.
    //
    // `age_band` sits a few entries below as the answer to give instead
    // whenever the question is really "is this person a minor, and roughly
    // which cohort are they in".
    key: 'national_id',
    group: 'identity',
    type: 'short_text',
    labelAr: 'رقم الهوية الشخصية',
    labelEn: 'National ID number',
    helpAr: 'تسعة أرقام كما في بطاقة الهوية الفلسطينية. لا يُطلب إلا عند الحاجة لإجراءات التعاقد.',
    helpEn: 'Nine digits, as on the Palestinian ID card. Asked only where contracting requires it.',
    placeholderAr: '٩ أرقام',
    // The pattern is the catalogue's, not the author's: `config.pattern` is
    // documented as never author-supplied, precisely so that a checked shape
    // cannot be relaxed from the admin screen.
    config: { pattern: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
    sensitive: true,
  },
  {
    key: 'passport_number',
    group: 'identity',
    type: 'short_text',
    labelAr: 'رقم جواز السفر',
    labelEn: 'Passport number',
    helpAr: 'يُطلب عادةً للفرص التي تتضمن سفراً أو تعاقداً مع جهة خارج فلسطين.',
    helpEn: 'Usually needed only where the role involves travel or a contract outside Palestine.',
    config: { minLength: 5, maxLength: 20 },
    sensitive: true,
  },
  {
    // Sensitive for the reason set out on `national_id` above: a birth date is
    // a permanent identifier, and `20-PRIVACY §5` asks for the band instead.
    key: 'date_of_birth',
    group: 'identity',
    type: 'date',
    labelAr: 'تاريخ الميلاد',
    labelEn: 'Date of birth',
    helpAr: 'لا تطلبه إلا إذا كان لازماً للتعاقد؛ وإلا فاستخدم حقل الفئة العمرية.',
    helpEn: 'Ask for this only where contracting requires it; otherwise use the age band field.',
    // `'today'` is a moving bound resolved at validation time, not a date
    // frozen into the row when the admin added the field.
    config: { maxDate: 'today' },
    sensitive: true,
  },
  {
    key: 'age_band',
    group: 'identity',
    type: 'select',
    labelAr: 'الفئة العمرية',
    labelEn: 'Age band',
    helpAr:
      'هذا البديل المُوصى به عن تاريخ الميلاد: يخبرنا بما نحتاج معرفته فعلاً — هل المتقدّم قاصر، وأي شريحة عمرية ينتمي إليها — دون أن نحتفظ بمُعرِّف دائم.',
    helpEn:
      'The recommended alternative to a date of birth: it answers what we actually need — whether the applicant is a minor, and roughly which cohort they belong to — without holding a permanent identifier.',
    options: [
      { value: 'under_18', labelAr: 'أقل من ١٨ سنة', labelEn: 'Under 18' },
      { value: '18_24', labelAr: '١٨ – ٢٤ سنة', labelEn: '18–24' },
      { value: '25_34', labelAr: '٢٥ – ٣٤ سنة', labelEn: '25–34' },
      { value: '35_49', labelAr: '٣٥ – ٤٩ سنة', labelEn: '35–49' },
      { value: '50_plus', labelAr: '٥٠ سنة فأكثر', labelEn: '50 and over' },
    ],
  },
  {
    key: 'gender',
    group: 'identity',
    type: 'select',
    labelAr: 'الجنس',
    labelEn: 'Gender',
    helpAr: 'يُستخدم لأغراض التوازن في التوظيف والتقارير المجمّعة فقط.',
    helpEn: 'Used for recruitment balance and aggregate reporting only.',
    options: [
      { value: 'female', labelAr: 'أنثى', labelEn: 'Female' },
      { value: 'male', labelAr: 'ذكر', labelEn: 'Male' },
      { value: 'prefer_not_to_say', labelAr: 'أفضّل عدم الإفصاح', labelEn: 'Prefer not to say' },
    ],
  },
  {
    key: 'marital_status',
    group: 'identity',
    type: 'select',
    labelAr: 'الحالة الاجتماعية',
    labelEn: 'Marital status',
    options: [
      { value: 'single', labelAr: 'أعزب / عزباء', labelEn: 'Single' },
      { value: 'married', labelAr: 'متزوج / متزوجة', labelEn: 'Married' },
      { value: 'divorced', labelAr: 'مطلّق / مطلّقة', labelEn: 'Divorced' },
      { value: 'widowed', labelAr: 'أرمل / أرملة', labelEn: 'Widowed' },
    ],
  },
  {
    key: 'nationality',
    group: 'identity',
    type: 'short_text',
    labelAr: 'الجنسية',
    labelEn: 'Nationality',
    config: { minLength: 2, maxLength: 60 },
  },

  // ── contact ────────────────────────────────────────────────────────────
  {
    key: 'mobile_number',
    group: 'contact',
    type: 'phone',
    labelAr: 'رقم الجوال',
    labelEn: 'Mobile number',
    helpAr: 'الرقم الذي نتصل به لترتيب المقابلة، فتأكد من أنه يعمل.',
    helpEn: 'The number we will call to arrange an interview, so make sure it is reachable.',
    placeholderAr: '٠٥٩ ١٢٣ ٤٥٦٧',
    defaultRequired: true,
    identityRole: 'phone',
  },
  {
    key: 'alt_phone',
    group: 'contact',
    type: 'phone',
    labelAr: 'رقم بديل أو رقم واتساب',
    labelEn: 'Alternative or WhatsApp number',
    helpAr: 'رقم آخر نصل إليك عليه إن تعذّر الاتصال بالأول — انقطاع الاتصالات وارد.',
    helpEn: 'A second number to reach you on if the first is unavailable — outages are common.',
  },
  {
    key: 'email',
    group: 'contact',
    type: 'email',
    labelAr: 'البريد الإلكتروني',
    labelEn: 'Email address',
    helpAr: 'يصلك عليه إشعار استلام الطلب ورقمه المرجعي.',
    helpEn: 'Your receipt and reference number are sent here.',
    defaultRequired: true,
    identityRole: 'email',
  },

  // ── location ───────────────────────────────────────────────────────────
  {
    // The five values are the `governorate` Postgres enum, in its order. They
    // are repeated here rather than derived from `governorate.enumValues`
    // because the catalogue must carry a bilingual label per option and the
    // enum carries none — but they must not drift, so the unit test compares
    // this list against the enum member for member.
    key: 'governorate',
    group: 'location',
    type: 'select',
    labelAr: 'المحافظة',
    labelEn: 'Governorate',
    options: [
      { value: 'north_gaza', labelAr: 'شمال غزة', labelEn: 'North Gaza' },
      { value: 'gaza', labelAr: 'غزة', labelEn: 'Gaza' },
      { value: 'middle', labelAr: 'الوسطى', labelEn: 'Middle Area' },
      { value: 'khan_younis', labelAr: 'خان يونس', labelEn: 'Khan Younis' },
      { value: 'rafah', labelAr: 'رفح', labelEn: 'Rafah' },
    ],
  },
  {
    key: 'city',
    group: 'location',
    type: 'short_text',
    labelAr: 'المدينة أو البلدة',
    labelEn: 'City or town',
    config: { minLength: 2, maxLength: 80 },
  },
  {
    key: 'address_detail',
    group: 'location',
    type: 'short_text',
    labelAr: 'الحي والعنوان التفصيلي',
    labelEn: 'Neighbourhood and detailed address',
    helpAr:
      'تجنّب هذا الحقل ما أمكن: المحافظة والمدينة تكفيان لأغراض التوظيف، والعنوان التفصيلي بيانات لا حاجة للاحتفاظ بها.',
    helpEn:
      'Avoid this field where you can: governorate and city are enough for recruitment, and a street address is data there is no need to hold.',
    config: { maxLength: 200 },
  },
  {
    key: 'displacement_status',
    group: 'location',
    type: 'select',
    labelAr: 'الوضع السكني الحالي',
    labelEn: 'Current displacement status',
    helpAr: 'يساعدنا على تقدير الوصول إلى مقرّ العمل وترتيب المقابلات، لا على المفاضلة بين المتقدّمين.',
    helpEn:
      'Helps us judge travel to the workplace and arrange interviews; it is not used to rank applicants.',
    options: [
      { value: 'resident', labelAr: 'مقيم في مكان سكنه الأصلي', labelEn: 'Living at my usual address' },
      { value: 'displaced_inside', labelAr: 'نازح داخل قطاع غزة', labelEn: 'Displaced inside Gaza' },
      { value: 'displaced_outside', labelAr: 'نازح خارج قطاع غزة', labelEn: 'Displaced outside Gaza' },
    ],
  },

  // ── education ──────────────────────────────────────────────────────────
  {
    key: 'education_level',
    group: 'education',
    type: 'select',
    labelAr: 'أعلى مؤهل علمي',
    labelEn: 'Highest qualification',
    options: [
      { value: 'secondary', labelAr: 'الثانوية العامة', labelEn: 'Secondary school' },
      { value: 'diploma', labelAr: 'دبلوم', labelEn: 'Diploma' },
      { value: 'bachelor', labelAr: 'بكالوريوس', labelEn: "Bachelor's degree" },
      { value: 'master', labelAr: 'ماجستير', labelEn: "Master's degree" },
      { value: 'phd', labelAr: 'دكتوراه', labelEn: 'Doctorate' },
    ],
  },
  {
    key: 'field_of_study',
    group: 'education',
    type: 'short_text',
    labelAr: 'التخصص',
    labelEn: 'Field of study',
    placeholderAr: 'الخدمة الاجتماعية، علم النفس، المحاسبة…',
    config: { minLength: 2, maxLength: 120 },
  },
  {
    key: 'institution',
    group: 'education',
    type: 'short_text',
    labelAr: 'الجامعة أو المؤسسة التعليمية',
    labelEn: 'University or institution',
    config: { minLength: 2, maxLength: 120 },
  },
  {
    key: 'graduation_year',
    group: 'education',
    type: 'number',
    labelAr: 'سنة التخرّج',
    labelEn: 'Year of graduation',
    // The bounds are wide on purpose. A narrow upper bound keyed to "this
    // year" would reject a legitimate answer from a student finishing next
    // term, and a bound that needs updating every January is a bound that
    // will not be updated.
    config: { min: 1950, max: 2100 },
  },
  {
    key: 'still_studying',
    group: 'education',
    type: 'checkbox',
    labelAr: 'ما زلت على مقاعد الدراسة',
    labelEn: 'I am still studying',
  },
  {
    key: 'expected_graduation_year',
    group: 'education',
    type: 'number',
    labelAr: 'سنة التخرّج المتوقعة',
    labelEn: 'Expected year of graduation',
    helpAr: 'للمتقدّمين الذين ما زالوا يدرسون.',
    helpEn: 'For applicants who are still studying.',
    config: { min: 1950, max: 2100 },
  },
  {
    key: 'academic_year',
    group: 'education',
    type: 'select',
    labelAr: 'السنة الدراسية الحالية',
    labelEn: 'Current academic year',
    helpAr: 'يُستخدم عادةً في فرص التدريب الجامعي.',
    helpEn: 'Usually used for internship intakes.',
    options: [
      { value: 'year_1', labelAr: 'السنة الأولى', labelEn: 'First year' },
      { value: 'year_2', labelAr: 'السنة الثانية', labelEn: 'Second year' },
      { value: 'year_3', labelAr: 'السنة الثالثة', labelEn: 'Third year' },
      { value: 'year_4', labelAr: 'السنة الرابعة', labelEn: 'Fourth year' },
      { value: 'year_5', labelAr: 'السنة الخامسة فأعلى', labelEn: 'Fifth year or above' },
    ],
  },
  {
    // `short_text`, not `number`: a grade is "٨٤٪", "جيد جداً" or "3.4 من 4"
    // depending on the institution, and forcing one of those shapes onto all
    // of them loses information the reviewer wanted.
    key: 'gpa',
    group: 'education',
    type: 'short_text',
    labelAr: 'المعدل أو التقدير',
    labelEn: 'GPA or grade',
    placeholderAr: '٨٤٪ أو جيد جداً أو ٣٫٤ من ٤',
    config: { maxLength: 40 },
  },
  {
    key: 'professional_courses',
    group: 'education',
    type: 'long_text',
    labelAr: 'الدورات والشهادات المهنية',
    labelEn: 'Professional courses and certificates',
    helpAr: 'اذكر اسم الدورة والجهة المانحة والسنة، دورةً في كل سطر.',
    helpEn: 'Give the course, the awarding body and the year, one per line.',
    placeholderAr:
      'مثال: إدارة المشاريع PMP، معايير المساءلة الإنسانية CHS، الحماية من الاستغلال والانتهاك الجنسي PSEA، القانون الدولي الإنساني IHL، الإسعافات الأولية…',
    config: { maxLength: 1500 },
  },

  // ── experience ─────────────────────────────────────────────────────────
  {
    key: 'years_experience',
    group: 'experience',
    type: 'number',
    labelAr: 'إجمالي سنوات الخبرة',
    labelEn: 'Total years of experience',
    config: { min: 0, max: 60 },
  },
  {
    key: 'years_ngo_experience',
    group: 'experience',
    type: 'number',
    labelAr: 'سنوات الخبرة في العمل الإنساني والأهلي',
    labelEn: 'Years of experience in the humanitarian / NGO sector',
    config: { min: 0, max: 60 },
  },
  {
    key: 'last_job_title',
    group: 'experience',
    type: 'short_text',
    labelAr: 'المسمّى الوظيفي الأخير',
    labelEn: 'Most recent job title',
    config: { minLength: 2, maxLength: 120 },
  },
  {
    key: 'last_employer',
    group: 'experience',
    type: 'short_text',
    labelAr: 'جهة العمل الأخيرة',
    labelEn: 'Most recent employer',
    config: { minLength: 2, maxLength: 120 },
  },
  {
    key: 'employment_from',
    group: 'experience',
    type: 'date',
    labelAr: 'تاريخ بدء العمل في الوظيفة الأخيرة',
    labelEn: 'Most recent employment: start date',
    config: { maxDate: 'today' },
  },
  {
    key: 'employment_to',
    group: 'experience',
    type: 'date',
    labelAr: 'تاريخ انتهاء العمل في الوظيفة الأخيرة',
    labelEn: 'Most recent employment: end date',
    helpAr: 'اتركه فارغاً إن كنت ما زلت على رأس عملك.',
    helpEn: 'Leave this empty if you are still in the role.',
  },
  {
    key: 'reason_for_leaving',
    group: 'experience',
    type: 'short_text',
    labelAr: 'سبب ترك العمل',
    labelEn: 'Reason for leaving',
    config: { maxLength: 200 },
  },
  {
    key: 'current_salary',
    group: 'experience',
    type: 'number',
    labelAr: 'الراتب الحالي',
    labelEn: 'Current salary',
    helpAr: 'المبلغ الشهري بالدولار الأمريكي.',
    helpEn: 'Monthly amount in US dollars.',
    config: { min: 0, max: 100000 },
  },
  {
    key: 'expected_salary',
    group: 'experience',
    type: 'number',
    labelAr: 'الراتب المتوقع',
    labelEn: 'Expected salary',
    helpAr: 'المبلغ الشهري بالدولار الأمريكي.',
    helpEn: 'Monthly amount in US dollars.',
    config: { min: 0, max: 100000 },
  },
  {
    key: 'worked_with_pcsrd_before',
    group: 'experience',
    type: 'checkbox',
    labelAr: 'سبق لي العمل أو التطوّع مع الجمعية',
    labelEn: 'I have worked or volunteered with the organisation before',
  },
  {
    key: 'expertise_areas',
    group: 'experience',
    type: 'multi_select',
    labelAr: 'مجالات الخبرة',
    labelEn: 'Areas of expertise',
    helpAr: 'اختر ما تملك فيه خبرة عملية فعلية، لا ما مررت به في دورة تدريبية.',
    helpEn: 'Choose what you have practical experience in, not what you attended a course about.',
    options: [
      { value: 'protection', labelAr: 'الحماية', labelEn: 'Protection' },
      { value: 'case_management', labelAr: 'إدارة الحالة', labelEn: 'Case management' },
      { value: 'psychosocial_support', labelAr: 'الدعم النفسي الاجتماعي', labelEn: 'Psychosocial support' },
      { value: 'education', labelAr: 'التعليم', labelEn: 'Education' },
      { value: 'child_protection', labelAr: 'حماية الطفل', labelEn: 'Child protection' },
      { value: 'gbv', labelAr: 'العنف القائم على النوع الاجتماعي', labelEn: 'Gender-based violence' },
      { value: 'health', labelAr: 'الصحة', labelEn: 'Health' },
      { value: 'nutrition', labelAr: 'التغذية', labelEn: 'Nutrition' },
      { value: 'wash', labelAr: 'المياه والإصحاح والنظافة', labelEn: 'WASH' },
      { value: 'shelter', labelAr: 'المأوى', labelEn: 'Shelter' },
      { value: 'food_security', labelAr: 'الأمن الغذائي', labelEn: 'Food security' },
      { value: 'cash_assistance', labelAr: 'المساعدات النقدية', labelEn: 'Cash assistance' },
      { value: 'livelihoods', labelAr: 'سبل العيش', labelEn: 'Livelihoods' },
      { value: 'meal', labelAr: 'المتابعة والتقييم والمساءلة والتعلّم', labelEn: 'MEAL' },
      { value: 'logistics', labelAr: 'اللوجستيات', labelEn: 'Logistics' },
      { value: 'procurement', labelAr: 'المشتريات', labelEn: 'Procurement' },
      { value: 'finance', labelAr: 'الشؤون المالية', labelEn: 'Finance' },
      { value: 'hr', labelAr: 'الموارد البشرية', labelEn: 'Human resources' },
      { value: 'it', labelAr: 'تكنولوجيا المعلومات', labelEn: 'IT' },
      { value: 'media_communication', labelAr: 'الإعلام والاتصال', labelEn: 'Media and communication' },
      { value: 'community_mobilisation', labelAr: 'التعبئة المجتمعية', labelEn: 'Community mobilisation' },
      { value: 'other', labelAr: 'مجال آخر', labelEn: 'Other' },
    ],
    config: { minChoices: 1, columns: 2 },
  },

  // ── skills ─────────────────────────────────────────────────────────────
  {
    key: 'arabic_level',
    group: 'skills',
    type: 'select',
    labelAr: 'مستوى اللغة العربية',
    labelEn: 'Arabic level',
    options: LANGUAGE_LEVELS,
  },
  {
    key: 'english_level',
    group: 'skills',
    type: 'select',
    labelAr: 'مستوى اللغة الإنجليزية',
    labelEn: 'English level',
    helpAr: 'التقارير المقدَّمة للمانحين تُكتب بالإنجليزية في كثير من المشاريع.',
    helpEn: 'Donor reporting is written in English on many projects.',
    options: LANGUAGE_LEVELS,
  },
  {
    key: 'hebrew_level',
    group: 'skills',
    type: 'select',
    labelAr: 'مستوى اللغة العبرية',
    labelEn: 'Hebrew level',
    options: LANGUAGE_LEVELS,
  },
  {
    key: 'computer_skills',
    group: 'skills',
    type: 'multi_select',
    labelAr: 'المهارات الحاسوبية',
    labelEn: 'Computer skills',
    options: [
      { value: 'microsoft_office', labelAr: 'مايكروسوفت أوفيس', labelEn: 'Microsoft Office' },
      { value: 'google_workspace', labelAr: 'جوجل وورك سبيس', labelEn: 'Google Workspace' },
      { value: 'kobotoolbox', labelAr: 'كوبو تولبوكس', labelEn: 'KoBoToolbox' },
      { value: 'odk', labelAr: 'أوبن داتا كِت ODK', labelEn: 'ODK' },
      { value: 'spss', labelAr: 'الحزمة الإحصائية SPSS', labelEn: 'SPSS' },
      { value: 'gis_arcgis', labelAr: 'نظم المعلومات الجغرافية GIS / ArcGIS', labelEn: 'GIS / ArcGIS' },
      { value: 'adobe_design', labelAr: 'برامج التصميم من أدوبي', labelEn: 'Adobe design suite' },
      { value: 'accounting_software', labelAr: 'برامج المحاسبة', labelEn: 'Accounting software' },
      { value: 'erp', labelAr: 'أنظمة تخطيط الموارد ERP', labelEn: 'ERP systems' },
      { value: 'data_analysis', labelAr: 'تحليل البيانات', labelEn: 'Data analysis' },
      { value: 'other', labelAr: 'مهارة أخرى', labelEn: 'Other' },
    ],
    config: { minChoices: 1, columns: 2 },
  },
  {
    key: 'driving_licence',
    group: 'skills',
    type: 'checkbox',
    labelAr: 'أحمل رخصة قيادة سارية',
    labelEn: 'I hold a valid driving licence',
  },
  {
    key: 'driving_licence_type',
    group: 'skills',
    type: 'short_text',
    labelAr: 'درجة رخصة القيادة',
    labelEn: 'Driving licence type',
    placeholderAr: 'خصوصي، عمومي، شحن…',
    config: { maxLength: 60 },
  },
  {
    key: 'own_vehicle',
    group: 'skills',
    type: 'checkbox',
    labelAr: 'أملك مركبة خاصة',
    labelEn: 'I have my own vehicle',
  },

  // ── attachments ────────────────────────────────────────────────────────
  {
    key: 'cv_file',
    group: 'attachments',
    type: 'file',
    labelAr: 'السيرة الذاتية',
    labelEn: 'CV',
    helpAr: 'ملف PDF أو Word، بحجم لا يتجاوز ٤ ميغابايت.',
    helpEn: 'A PDF or Word file, no larger than 4 MB.',
    config: { accept: 'document' },
    defaultRequired: true,
  },
  {
    key: 'cover_letter_file',
    group: 'attachments',
    type: 'file',
    labelAr: 'رسالة التقديم',
    labelEn: 'Cover letter',
    config: { accept: 'document' },
  },
  {
    key: 'academic_certificates_file',
    group: 'attachments',
    type: 'file',
    labelAr: 'الشهادات الأكاديمية',
    labelEn: 'Academic certificates',
    helpAr: 'اجمع الشهادات في ملف واحد إن كانت أكثر من واحدة.',
    helpEn: 'Combine several certificates into a single file.',
    config: { accept: 'document' },
  },
  {
    key: 'experience_certificates_file',
    group: 'attachments',
    type: 'file',
    labelAr: 'شهادات الخبرة',
    labelEn: 'Experience certificates',
    config: { accept: 'document' },
  },
  {
    // Sensitive for the same reason as `national_id`: a scan of an ID card is
    // the ID number plus a photograph plus a signature in one file. See the
    // comment on `national_id` for why the flag is the mechanism and not a
    // label. A confidential attachment is refused rather than gated — that is
    // a separate rule and it still applies here.
    key: 'id_copy_file',
    group: 'attachments',
    type: 'file',
    labelAr: 'صورة عن بطاقة الهوية',
    labelEn: 'Copy of your ID card',
    helpAr: 'لا تطلبها إلا في مرحلة التعاقد؛ لا حاجة إليها لفرز الطلبات.',
    helpEn: 'Ask for this at the contracting stage only; shortlisting does not need it.',
    config: { accept: 'document' },
    sensitive: true,
  },
  {
    key: 'portfolio_file',
    group: 'attachments',
    type: 'file',
    labelAr: 'نماذج من الأعمال',
    labelEn: 'Portfolio or work samples',
    helpAr: 'مفيد للوظائف الإعلامية والتصميمية والبحثية.',
    helpEn: 'Useful for media, design and research roles.',
    config: { accept: 'any' },
  },
  {
    key: 'personal_photo_file',
    group: 'attachments',
    type: 'file',
    labelAr: 'صورة شخصية',
    labelEn: 'Personal photograph',
    helpAr:
      'الصورة ليست شرطاً للنظر في الطلب، والجمعية لا تفاضل بين المتقدّمين على أساس المظهر. تُستخدم عند الحاجة لإصدار بطاقة تعريف بعد التعاقد.',
    helpEn:
      'A photograph is not required for your application to be considered, and the organisation does not screen on appearance. It is used, where needed, to issue a staff card after contracting.',
    config: { accept: 'image' },
  },

  // ── availability ───────────────────────────────────────────────────────
  {
    key: 'earliest_start_date',
    group: 'availability',
    type: 'date',
    labelAr: 'أقرب تاريخ يمكنك المباشرة فيه',
    labelEn: 'Earliest date you can start',
    config: { minDate: 'today' },
  },
  {
    key: 'work_arrangement',
    group: 'availability',
    type: 'select',
    labelAr: 'نمط العمل المفضّل',
    labelEn: 'Preferred working arrangement',
    options: [
      { value: 'full_time', labelAr: 'دوام كامل', labelEn: 'Full time' },
      { value: 'part_time', labelAr: 'دوام جزئي', labelEn: 'Part time' },
      { value: 'remote', labelAr: 'عن بُعد', labelEn: 'Remote' },
      { value: 'field', labelAr: 'عمل ميداني', labelEn: 'Field based' },
      { value: 'hybrid', labelAr: 'مزيج بين المكتب وعن بُعد', labelEn: 'Hybrid' },
    ],
  },
  {
    key: 'willing_to_work_across_governorates',
    group: 'availability',
    type: 'checkbox',
    labelAr: 'أستطيع العمل في محافظات أخرى عند الحاجة',
    labelEn: 'I can work in other governorates when needed',
  },
  {
    key: 'weekly_hours',
    group: 'availability',
    type: 'number',
    labelAr: 'عدد ساعات التطوّع الأسبوعية',
    labelEn: 'Weekly volunteering hours',
    helpAr: 'العدد الذي تستطيع الالتزام به فعلاً، لا الحد الأقصى النظري.',
    helpEn: 'The number you can genuinely commit to, not a theoretical maximum.',
    config: { min: 1, max: 60 },
  },
  {
    key: 'commitment_duration',
    group: 'availability',
    type: 'select',
    labelAr: 'مدة الالتزام المتوقعة',
    labelEn: 'Expected length of commitment',
    options: [
      { value: 'less_than_month', labelAr: 'أقل من شهر', labelEn: 'Less than a month' },
      { value: 'one_to_three', labelAr: 'من شهر إلى ثلاثة أشهر', labelEn: 'One to three months' },
      { value: 'three_to_six', labelAr: 'من ثلاثة إلى ستة أشهر', labelEn: 'Three to six months' },
      { value: 'six_to_twelve', labelAr: 'من ستة أشهر إلى سنة', labelEn: 'Six to twelve months' },
      { value: 'more_than_year', labelAr: 'أكثر من سنة', labelEn: 'More than a year' },
    ],
  },

  // ── compliance ─────────────────────────────────────────────────────────
  //
  // This group is the one an admin is most likely to get wrong by writing it
  // themselves, and the one where getting it wrong matters most. A PSEA
  // acknowledgement with a vague label is not an acknowledgement; a consent
  // tick that does not say what is being consented to is not consent. The
  // wording below is the point of these entries — more than the type or the
  // config — so it is written out in full in both languages rather than left
  // as a label the admin is expected to complete.
  {
    key: 'psea_acknowledgement',
    group: 'compliance',
    type: 'checkbox',
    labelAr: 'أقرّ بأنني اطّلعت على سياسة الحماية من الاستغلال والانتهاك الجنسي ومدوّنة السلوك وألتزم بهما',
    labelEn:
      'I confirm that I have read and will abide by the policy on protection from sexual exploitation and abuse, and the code of conduct',
    helpAr:
      'الحماية من الاستغلال والانتهاك الجنسي (PSEA) التزام غير قابل للتفاوض على كل من يعمل أو يتطوّع مع الجمعية: لا علاقة جنسية مع متلقّي المساعدة، ولا مقابل من أي نوع لقاء خدمة، وواجب الإبلاغ عن أي شبهة. تُسلَّم لك السياسة كاملة عند التعاقد.',
    helpEn:
      'Protection from sexual exploitation and abuse (PSEA) is a non-negotiable commitment for everyone who works or volunteers with the organisation: no sexual relationship with people receiving assistance, no exchange of any kind for a service, and a duty to report any concern. The full policy is given to you on contracting.',
    defaultRequired: true,
  },
  {
    key: 'child_safeguarding_acknowledgement',
    group: 'compliance',
    type: 'checkbox',
    labelAr: 'أقرّ بأنني اطّلعت على سياسة حماية الطفل وألتزم بها',
    labelEn: 'I confirm that I have read and will abide by the child safeguarding policy',
    helpAr:
      'تنطبق على كل دور يضع صاحبه في تماس مع الأطفال، ولو لم يكن ذلك جوهر الوظيفة، وتشمل قواعد التصوير والنشر والخلوة والإبلاغ.',
    helpEn:
      'It applies to any role that brings you into contact with children, even where that is not the core of the job, and covers photography, publication, being alone with a child, and reporting.',
  },
  {
    key: 'relative_at_pcsrd',
    group: 'compliance',
    type: 'checkbox',
    labelAr: 'لديّ قريب يعمل في الجمعية أو في مجلس إدارتها',
    labelEn: 'I have a relative who works for the organisation or sits on its board',
    helpAr:
      'الإفصاح لا يستبعدك من التقديم. إخفاء القرابة هو ما يُبطل الطلب، لأن تعارض المصالح يُدار بإخراج القريب من لجنة الاختيار، وهذا لا يمكن فعله إن لم نعلم.',
    helpEn:
      'Disclosing this does not rule you out. Concealing it is what invalidates an application: a conflict of interest is managed by keeping the relative off the selection panel, and that cannot happen if nobody knows.',
  },
  {
    // A separate optional field rather than a conditional one. `visibleWhen`
    // is a property of the *form field* row, not of a catalogue entry — the
    // admin wires the condition up in the builder after adding both, because
    // the condition names the other field's key on that specific form and the
    // catalogue cannot know what the admin called it.
    key: 'relative_details',
    group: 'compliance',
    type: 'short_text',
    labelAr: 'اسم القريب وصلة القرابة',
    labelEn: 'Name of the relative and your relationship to them',
    config: { maxLength: 160 },
  },
  {
    key: 'dismissed_for_discipline',
    group: 'compliance',
    type: 'checkbox',
    labelAr: 'سبق أن أُنهيت خدماتي من جهة عمل لأسباب تأديبية',
    labelEn: 'I have previously been dismissed from a post for disciplinary reasons',
  },
  {
    key: 'dismissal_details',
    group: 'compliance',
    type: 'long_text',
    labelAr: 'تفاصيل إنهاء الخدمة',
    labelEn: 'Details of the dismissal',
    helpAr: 'اذكر الجهة والسنة وما حدث بإيجاز. تُقرأ هذه الإجابة من مسؤول التوظيف وحده.',
    helpEn: 'Give the employer, the year and briefly what happened. Only the recruiting officer reads this.',
    config: { maxLength: 1000 },
  },
  {
    key: 'declaration_accurate',
    group: 'compliance',
    type: 'checkbox',
    labelAr: 'أقرّ بأن جميع المعلومات الواردة في هذا الطلب صحيحة وكاملة',
    labelEn: 'I declare that the information in this application is accurate and complete',
    helpAr: 'أي معلومة غير صحيحة تُكتشف لاحقاً قد تؤدي إلى استبعاد الطلب أو إنهاء التعاقد.',
    helpEn:
      'Information later found to be untrue may lead to the application being withdrawn or a contract being ended.',
    defaultRequired: true,
  },
  {
    key: 'consent_personal_data',
    group: 'compliance',
    type: 'checkbox',
    labelAr: 'أوافق على معالجة بياناتي الشخصية لأغراض هذا الطلب',
    labelEn: 'I consent to my personal data being processed for the purposes of this application',
    helpAr:
      'تعني الموافقة أن يطّلع فريق التوظيف على ما قدّمته لتقييم ترشّحك والتواصل معك بشأنه، لا أكثر. لا تُباع البيانات ولا تُشارك مع طرف ثالث إلا إذا اقتضى التعاقد ذلك، وتُحذف تلقائياً بعد انقضاء مدة الاحتفاظ المحددة لهذا النموذج. ولك أن تطلب حذف طلبك قبل ذلك.',
    helpEn:
      'Consent means the recruitment team may read what you submitted in order to assess your application and contact you about it, and nothing beyond that. Your data is not sold and is not shared with a third party unless contracting requires it, and it is deleted automatically once this form’s retention period ends. You may ask for your application to be deleted before then.',
    defaultRequired: true,
  },
  {
    // Not required, and it must never become required: a consent that is a
    // condition of applying is not a consent. An applicant who leaves this
    // unticked has their file deleted with the rest of the intake.
    key: 'consent_keep_cv',
    group: 'compliance',
    type: 'checkbox',
    labelAr: 'أوافق على الاحتفاظ بسيرتي الذاتية للنظر فيها عند طرح شواغر مستقبلية',
    labelEn: 'I consent to my CV being kept on file for future vacancies',
    helpAr: 'اختياري تماماً، ولا يؤثر تركه فارغاً على النظر في طلبك الحالي.',
    helpEn: 'Entirely optional; leaving it unticked has no effect on your current application.',
  },
  {
    key: 'accessibility_adjustments',
    group: 'compliance',
    type: 'long_text',
    labelAr: 'هل تحتاج إلى أي ترتيبات تيسيرية خلال مراحل التقديم والمقابلة؟',
    labelEn: 'Would any adjustments make the application and interview process work better for you?',
    helpAr:
      'نسأل لنرتّب، لا لنقيّم. مكان يسهل الوصول إليه، مقابلة عبر الهاتف بدل الحضور، وقت إضافي، مترجم لغة إشارة، مواد بخط أكبر — اكتب ما يلزمك ونرتّبه. لا يُطلب منك بيان طبي، ولا يؤثر ما تكتبه هنا على تقييم طلبك، ولا يطّلع عليه إلا من ينظّم المقابلات.',
    helpEn:
      'We ask in order to arrange, not to assess. An accessible venue, a phone interview instead of attending in person, extra time, a sign-language interpreter, materials in a larger size — tell us and we will arrange it. No medical evidence is asked for, what you write here has no bearing on how your application is judged, and only the person organising interviews sees it.',
    config: { maxLength: 1000 },
  },

  // ── references ─────────────────────────────────────────────────────────
  //
  // Two referees, spelled out field by field rather than as one free-text box.
  // A box produces "أبو محمد، مدير سابق، ٠٥٩…" in whatever order the applicant
  // thought of it; separate keys produce an export the recruiting officer can
  // actually call down.
  {
    key: 'referee1_name',
    group: 'references',
    type: 'short_text',
    labelAr: 'اسم المُعرِّف الأول',
    labelEn: 'Referee 1: name',
    config: { minLength: 3, maxLength: 120 },
  },
  {
    key: 'referee1_position',
    group: 'references',
    type: 'short_text',
    labelAr: 'المسمّى الوظيفي للمُعرِّف الأول',
    labelEn: 'Referee 1: position',
    config: { maxLength: 120 },
  },
  {
    key: 'referee1_organisation',
    group: 'references',
    type: 'short_text',
    labelAr: 'جهة عمل المُعرِّف الأول',
    labelEn: 'Referee 1: organisation',
    config: { maxLength: 120 },
  },
  {
    key: 'referee1_phone',
    group: 'references',
    type: 'phone',
    labelAr: 'رقم هاتف المُعرِّف الأول',
    labelEn: 'Referee 1: phone number',
  },
  {
    key: 'referee1_email',
    group: 'references',
    type: 'email',
    labelAr: 'البريد الإلكتروني للمُعرِّف الأول',
    labelEn: 'Referee 1: email address',
  },
  {
    key: 'referee1_relationship',
    group: 'references',
    type: 'short_text',
    labelAr: 'صفة المُعرِّف الأول بالنسبة إليك',
    labelEn: 'Referee 1: how they know you',
    placeholderAr: 'مدير مباشر، مشرف تدريب، زميل…',
    config: { maxLength: 120 },
  },
  {
    key: 'referee2_name',
    group: 'references',
    type: 'short_text',
    labelAr: 'اسم المُعرِّف الثاني',
    labelEn: 'Referee 2: name',
    config: { minLength: 3, maxLength: 120 },
  },
  {
    key: 'referee2_position',
    group: 'references',
    type: 'short_text',
    labelAr: 'المسمّى الوظيفي للمُعرِّف الثاني',
    labelEn: 'Referee 2: position',
    config: { maxLength: 120 },
  },
  {
    key: 'referee2_organisation',
    group: 'references',
    type: 'short_text',
    labelAr: 'جهة عمل المُعرِّف الثاني',
    labelEn: 'Referee 2: organisation',
    config: { maxLength: 120 },
  },
  {
    key: 'referee2_phone',
    group: 'references',
    type: 'phone',
    labelAr: 'رقم هاتف المُعرِّف الثاني',
    labelEn: 'Referee 2: phone number',
  },
  {
    key: 'referee2_email',
    group: 'references',
    type: 'email',
    labelAr: 'البريد الإلكتروني للمُعرِّف الثاني',
    labelEn: 'Referee 2: email address',
  },
  {
    key: 'referee2_relationship',
    group: 'references',
    type: 'short_text',
    labelAr: 'صفة المُعرِّف الثاني بالنسبة إليك',
    labelEn: 'Referee 2: how they know you',
    config: { maxLength: 120 },
  },
  {
    key: 'contact_current_employer',
    group: 'references',
    type: 'checkbox',
    labelAr: 'يمكنكم التواصل مع جهة عملي الحالية',
    labelEn: 'You may contact my current employer',
    helpAr: 'إن تركته فارغاً فلن نتواصل معهم إلا بعد إبلاغك وأخذ موافقتك.',
    helpEn: 'If you leave this unticked we will not contact them without telling you and asking first.',
  },

  // ── other ──────────────────────────────────────────────────────────────
  {
    key: 'heard_about',
    group: 'other',
    type: 'select',
    labelAr: 'كيف علمت بهذه الفرصة؟',
    labelEn: 'How did you hear about this opportunity?',
    helpAr: 'يساعدنا على معرفة القنوات التي تصل فعلاً إلى الناس.',
    helpEn: 'Helps us learn which channels actually reach people.',
    options: [
      { value: 'website', labelAr: 'الموقع الإلكتروني', labelEn: 'This website' },
      { value: 'facebook', labelAr: 'فيسبوك', labelEn: 'Facebook' },
      { value: 'linkedin', labelAr: 'لينكدإن', labelEn: 'LinkedIn' },
      { value: 'friend', labelAr: 'من صديق أو معرفة', labelEn: 'From a friend' },
      { value: 'partner_organisation', labelAr: 'من مؤسسة شريكة', labelEn: 'From a partner organisation' },
      { value: 'job_board', labelAr: 'موقع للوظائف', labelEn: 'A job board' },
      { value: 'other', labelAr: 'مصدر آخر', labelEn: 'Somewhere else' },
    ],
  },
  {
    key: 'why_suitable',
    group: 'other',
    type: 'long_text',
    labelAr: 'لماذا ترى نفسك مناسباً لهذه الفرصة؟',
    labelEn: 'Why are you suitable for this role?',
    helpAr: 'اربط خبرتك بمتطلبات الإعلان تحديداً، في حدود صفحة واحدة.',
    helpEn: 'Connect your experience to the requirements in the advert. About one page is plenty.',
    config: { minLength: 20, maxLength: 1500 },
  },
  {
    key: 'additional_notes',
    group: 'other',
    type: 'long_text',
    labelAr: 'ملاحظات إضافية',
    labelEn: 'Anything else you would like to add',
    config: { maxLength: 1000 },
  },

  // The headings. They live in `other` because that is where the picker keeps
  // them, not because they belong at the end of a form: the builder inserts
  // them *between* the groups, which is what turns forty inputs in a column
  // into six readable parts. A `section` carries no answer, so it can be
  // neither required nor sensitive — a database CHECK says so, and
  // `assertCatalogInvariants` says so here.
  {
    key: 'section_personal',
    group: 'other',
    type: 'section',
    labelAr: 'البيانات الشخصية وبيانات التواصل',
    labelEn: 'Personal and contact details',
  },
  {
    key: 'section_education',
    group: 'other',
    type: 'section',
    labelAr: 'المؤهلات العلمية',
    labelEn: 'Education and qualifications',
  },
  {
    key: 'section_experience',
    group: 'other',
    type: 'section',
    labelAr: 'الخبرة العملية والمهارات',
    labelEn: 'Experience and skills',
  },
  {
    key: 'section_attachments',
    group: 'other',
    type: 'section',
    labelAr: 'المرفقات',
    labelEn: 'Attachments',
    helpAr: 'حجم كل ملف لا يتجاوز ٤ ميغابايت.',
    helpEn: 'Each file must be 4 MB or smaller.',
  },
  {
    key: 'section_compliance',
    group: 'other',
    type: 'section',
    labelAr: 'الإقرارات والموافقات',
    labelEn: 'Declarations and consent',
    helpAr: 'اقرأ هذا القسم قبل الإرسال؛ التوقيع هنا التزام يسري من لحظة التعاقد.',
    helpEn: 'Read this section before you submit; what you confirm here binds you from contracting onwards.',
  },
  {
    key: 'section_references',
    group: 'other',
    type: 'section',
    labelAr: 'المُعرِّفون',
    labelEn: 'Referees',
  },
];

/** Built once at import. The builder looks a key up per rendered row. */
export const CATALOG_BY_KEY: ReadonlyMap<string, CatalogField> = new Map(
  FIELD_CATALOG.map((field) => [field.key, field]),
);

/**
 * Look a catalogue entry up by key.
 *
 * Returns `undefined` rather than throwing: a stored `catalogKey` may name an
 * entry that a later release removed, and a form that once used it must still
 * render from the row's own columns instead of crashing.
 */
export function catalogField(key: string): CatalogField | undefined {
  return CATALOG_BY_KEY.get(key);
}

/**
 * The fields a brand-new form starts with, in order.
 *
 * Deliberately short. A new form should open as something an admin can publish
 * in a minute and then grow, not as a wall of eighty fields they have to
 * delete — and every entry here is either something the pipeline needs (the
 * three identity fields), something every recruitment needs (a CV), or
 * something the privacy posture needs (the declaration and the consent tick).
 */
export const DEFAULT_FORM_FIELDS: readonly string[] = [
  'section_personal',
  'full_name_ar',
  'email',
  'mobile_number',
  'governorate',
  'section_attachments',
  'cv_file',
  'section_compliance',
  'declaration_accurate',
  'consent_personal_data',
];

/**
 * Starter sets per form kind.
 *
 * A job posting and a volunteer intake are not the same form with a different
 * title: the job asks about salary and notice period, the volunteer intake
 * asks how many hours a week and for how long, and asking each the other's
 * questions wastes the applicant's time and collects data with no use.
 *
 * Keyed by `application_form_kind` so a kind added to the enum fails to
 * typecheck here until someone decides what it should start with.
 */
export const STARTER_FIELDS: Record<ApplicationFormKind, readonly string[]> = {
  job: [
    'section_personal',
    'full_name_ar',
    'full_name_en',
    'email',
    'mobile_number',
    'governorate',
    'section_education',
    'education_level',
    'field_of_study',
    'institution',
    'graduation_year',
    'section_experience',
    'years_experience',
    'years_ngo_experience',
    'last_job_title',
    'last_employer',
    'expertise_areas',
    'english_level',
    'computer_skills',
    'expected_salary',
    'earliest_start_date',
    'section_attachments',
    'cv_file',
    'cover_letter_file',
    'section_references',
    'referee1_name',
    'referee1_position',
    'referee1_organisation',
    'referee1_phone',
    'why_suitable',
    'heard_about',
    'section_compliance',
    'psea_acknowledgement',
    'relative_at_pcsrd',
    'accessibility_adjustments',
    'declaration_accurate',
    'consent_personal_data',
    'consent_keep_cv',
  ],
  volunteer: [
    'section_personal',
    'full_name_ar',
    'email',
    'mobile_number',
    'age_band',
    'governorate',
    'section_experience',
    'expertise_areas',
    'weekly_hours',
    'commitment_duration',
    'willing_to_work_across_governorates',
    'why_suitable',
    'heard_about',
    'section_compliance',
    'psea_acknowledgement',
    'child_safeguarding_acknowledgement',
    'accessibility_adjustments',
    'declaration_accurate',
    'consent_personal_data',
  ],
  internship: [
    'section_personal',
    'full_name_ar',
    'email',
    'mobile_number',
    'age_band',
    'governorate',
    'section_education',
    'institution',
    'field_of_study',
    'academic_year',
    'expected_graduation_year',
    'gpa',
    'section_experience',
    'english_level',
    'computer_skills',
    'earliest_start_date',
    'weekly_hours',
    'section_attachments',
    'cv_file',
    'why_suitable',
    'heard_about',
    'section_compliance',
    'psea_acknowledgement',
    'child_safeguarding_acknowledgement',
    'accessibility_adjustments',
    'declaration_accurate',
    'consent_personal_data',
  ],
  training: [
    'section_personal',
    'full_name_ar',
    'email',
    'mobile_number',
    'age_band',
    'gender',
    'governorate',
    'displacement_status',
    'section_education',
    'education_level',
    'field_of_study',
    'section_experience',
    'years_experience',
    'expertise_areas',
    'why_suitable',
    'heard_about',
    'section_compliance',
    'accessibility_adjustments',
    'declaration_accurate',
    'consent_personal_data',
  ],
  consultancy: [
    'section_personal',
    'full_name_ar',
    'full_name_en',
    'email',
    'mobile_number',
    'governorate',
    'section_education',
    'education_level',
    'field_of_study',
    'section_experience',
    'years_experience',
    'years_ngo_experience',
    'expertise_areas',
    'english_level',
    'expected_salary',
    'earliest_start_date',
    'section_attachments',
    'cv_file',
    'portfolio_file',
    'section_references',
    'referee1_name',
    'referee1_organisation',
    'referee1_email',
    'why_suitable',
    'section_compliance',
    'psea_acknowledgement',
    'relative_at_pcsrd',
    'declaration_accurate',
    'consent_personal_data',
  ],
  other: DEFAULT_FORM_FIELDS,
};

// ── The self-check ───────────────────────────────────────────────────────

/** `application_form_fields_key_shape`, restated so a bad key never reaches the DB. */
const KEY_SHAPE = /^[a-z][a-z0-9_]{0,47}$/;

/**
 * An option's `value` is a machine token: it becomes the submitted string, the
 * key the export groups on and the value a `visibleWhen` condition compares
 * against. No case, no spaces, no punctuation — a value with a space survives
 * a round trip through `FormData` but not through a CSV nobody quoted.
 */
const OPTION_VALUE_SHAPE = /^[a-z0-9_]+$/;

const CHOICE_TYPES: readonly ApplicationFieldType[] = ['select', 'radio', 'multi_select'];

/**
 * Every rule the database enforces on a row, checked against the catalogue.
 *
 * **Not called at module load.** The catalogue is imported by the admin form
 * builder, by the answer-schema compiler and by the submission path, and a
 * throw at import time in any of those turns a typo in a label file into a
 * 500 on a page that has nothing to do with the broken entry. The DB CHECKs
 * are the real guard at write time; this is the guard at review time, and the
 * unit test is what makes it run on every commit.
 *
 * It throws rather than returning a list because there is exactly one correct
 * response to a failure — fix the catalogue — and a returned list invites a
 * caller to carry on with a catalogue that is known to be wrong.
 */
export function assertCatalogInvariants(): void {
  const seenKeys = new Set<string>();
  const seenIdentityRoles = new Map<string, string>();

  for (const field of FIELD_CATALOG) {
    if (seenKeys.has(field.key)) {
      throw new Error(`field-catalog: duplicate key "${field.key}".`);
    }
    seenKeys.add(field.key);

    if (!KEY_SHAPE.test(field.key)) {
      throw new Error(
        `field-catalog: key "${field.key}" does not match ${KEY_SHAPE.source} — ` +
          'the DB CHECK application_form_fields_key_shape would reject it.',
      );
    }

    if (CHOICE_TYPES.includes(field.type) && (field.options?.length ?? 0) === 0) {
      throw new Error(
        `field-catalog: "${field.key}" is a ${field.type} with no options — ` +
          'the DB CHECK application_form_fields_options would reject it.',
      );
    }

    const seenValues = new Set<string>();
    for (const option of field.options ?? []) {
      if (!OPTION_VALUE_SHAPE.test(option.value)) {
        throw new Error(
          `field-catalog: option value "${option.value}" on "${field.key}" must match ` +
            `${OPTION_VALUE_SHAPE.source}.`,
        );
      }
      if (seenValues.has(option.value)) {
        throw new Error(
          `field-catalog: "${field.key}" repeats the option value "${option.value}".`,
        );
      }
      seenValues.add(option.value);
    }

    if (field.type === 'section' && (field.defaultRequired === true || field.sensitive === true)) {
      throw new Error(
        `field-catalog: section "${field.key}" cannot be required or sensitive — ` +
          'the DB CHECK application_form_fields_section would reject it.',
      );
    }

    if (field.identityRole) {
      const taken = seenIdentityRoles.get(field.identityRole);
      if (taken) {
        throw new Error(
          `field-catalog: identityRole "${field.identityRole}" is claimed by both ` +
            `"${taken}" and "${field.key}". Exactly one field may fill each of ` +
            'applications.applicantName / Email / Phone.',
        );
      }
      seenIdentityRoles.set(field.identityRole, field.key);
    }
  }
}
