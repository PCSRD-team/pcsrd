/**
 * Dictionary partial — `site-content`.
 *
 * Partials exist so several areas of the site can grow their copy at once
 * without editing the two root dictionaries. Each partial owns one top-level
 * namespace per key below; the root files spread them in. The English object
 * is typed from the Arabic one, so a key added on one side and forgotten on
 * the other is a build error.
 *
 * Namespaces here belong to the content routes (`/programs`, `/projects`,
 * `/impact`, `/news`, `/careers`, `/resources`, `/partners`) and the
 * components in `src/components/content`. The Arabic object is deliberately
 * **not** `as const`: `typeof` then widens every value to `string`, which is
 * what lets the English object carry different text under the same keys.
 */
export const site_contentAr = {
  /** Chrome around content records: figure fallbacks, links, labels. */
  contentUi: {
    noImage: 'لا توجد صورة',
    readStory: 'اقرأ القصة',
    viewVacancy: 'تفاصيل الشاغر',
    toProgram: 'إلى صفحة البرنامج',
    viewArabicOriginal: 'اعرض النسخة العربية',
    updatedOn: 'آخر تحديث',
    partnerWebsite: 'الموقع الإلكتروني',
    vacancyJob: 'وظيفة',
    vacancyVolunteer: 'تطوّع',
    vacancyType: 'النوع',
    metricsTitle: 'الأرقام',
    methodTitle: 'كيف نقرأ الأرقام',
    methodVerified: 'رقم راجعته جهة مستقلة أو وثّقه تقرير منشور.',
    methodReported: 'رقم أبلغ عنه فريق التنفيذ ولم يُراجَع خارجياً بعد.',
    methodTarget: 'رقم مستهدف في الخطة، وليس نتيجة محقّقة.',
    generalMetrics: 'أرقام عامة',
    storiesLead: 'قصص من الميدان، بموافقة أصحابها أو مع إخفاء هويتهم.',
    programmeProjectsCount: 'مشروع',
    relatedProjects: 'مشاريع ذات صلة',
    inProgram: 'ضمن برنامج',
    closedNotice: 'أُغلق باب التقديم لهذا الشاغر. الشواغر المفتوحة حالياً معروضة في صفحة الوظائف.',
    backToCareers: 'كل الشواغر',
    year: 'السنة',
    file: 'الملف',
    download: 'تنزيل الملف',
  },

  /** `<caption>` text for every data table in the content routes. */
  tableCaptions: {
    openVacancies: 'الشواغر المفتوحة مرتّبة بحسب آخر موعد للتقديم',
    publications: 'الإصدارات المنشورة مع سنة النشر وحجم الملف',
  },

  /** The faceted project filter and the news category tabs. */
  filters: {
    apply: 'تطبيق التصفية',
    all: 'الكل',
    activeFilters: 'التصفية الفعّالة',
    newsCategories: 'تصنيف الأخبار',
  },
} satisfies Record<string, Record<string, unknown>>;

type Shape = typeof site_contentAr;

export const site_contentEn: Shape = {
  contentUi: {
    noImage: 'No image',
    readStory: 'Read the story',
    viewVacancy: 'Vacancy details',
    toProgram: 'Programme page',
    viewArabicOriginal: 'View the Arabic original',
    updatedOn: 'Last updated',
    partnerWebsite: 'Website',
    vacancyJob: 'Job',
    vacancyVolunteer: 'Volunteer',
    vacancyType: 'Type',
    metricsTitle: 'Figures',
    methodTitle: 'How to read the figures',
    methodVerified: 'A figure reviewed by an independent party or documented in a published report.',
    methodReported: 'A figure reported by the implementing team and not yet externally reviewed.',
    methodTarget: 'A figure planned for, not a result achieved.',
    generalMetrics: 'General figures',
    storiesLead: 'Stories from the field, told with consent or with identities withheld.',
    programmeProjectsCount: 'projects',
    relatedProjects: 'Related projects',
    inProgram: 'Part of',
    closedNotice: 'Applications for this position have closed. Open positions are listed on the careers page.',
    backToCareers: 'All vacancies',
    year: 'Year',
    file: 'File',
    download: 'Download file',
  },

  tableCaptions: {
    openVacancies: 'Open vacancies, ordered by application deadline',
    publications: 'Published documents with year and file size',
  },

  filters: {
    apply: 'Apply filters',
    all: 'All',
    activeFilters: 'Active filters',
    newsCategories: 'News category',
  },
};
