import {
  governorate,
  partnerType,
  personCategory,
  postCategory,
  programKey,
  projectStatus,
  publicationType,
  targetGroup,
  themeTag,
  vacancyType,
} from '@/db/schema/enums';

/**
 * Arabic labels for the admin's enum selects.
 *
 * Separate from the public dictionaries: the admin is Arabic-only, so these
 * need no locale parameter, and the wording differs — an editor picking a
 * status wants the internal term, a visitor reading a card wants the public
 * one.
 *
 * Every list is derived from its `pgEnum`, so a value added to the database
 * appears here as a missing key rather than as a silently absent option.
 */
const label = <T extends string>(values: readonly T[], map: Record<T, string>) =>
  values.map((value) => ({ value, label: map[value] }));

export const ADMIN_OPTIONS = {
  projectState: label(projectStatus.enumValues, {
    planned: 'مخطَّط',
    active: 'جارٍ',
    completed: 'مكتمل',
  }),
  governorate: label(governorate.enumValues, {
    north_gaza: 'شمال غزة',
    gaza: 'غزة',
    middle: 'الوسطى',
    khan_younis: 'خان يونس',
    rafah: 'رفح',
  }),
  theme: label(themeTag.enumValues, {
    women: 'النساء',
    children: 'الأطفال',
    youth_adolescents: 'الشباب واليافعون',
    psychosocial_health: 'الصحة النفسية',
    relief: 'الإغاثة',
  }),
  targetGroup: label(targetGroup.enumValues, {
    children: 'الأطفال',
    youth: 'الشباب',
    women: 'النساء',
    poor_families: 'الأسر الفقيرة',
    elderly: 'كبار السن',
    pwd: 'ذوو الإعاقة',
  }),
  programKey: label(programKey.enumValues, {
    protection: 'الحماية',
    humanitarian_response: 'الاستجابة الإنسانية',
    early_recovery: 'التعافي المبكر',
  }),
  postCategory: label(postCategory.enumValues, {
    news: 'خبر',
    statement: 'بيان',
    announcement: 'إعلان',
  }),
  vacancyType: label(vacancyType.enumValues, { job: 'وظيفة', volunteer: 'تطوّع' }),
  partnerType: label(partnerType.enumValues, {
    implementing: 'شريك تنفيذ',
    donor: 'جهة مموّلة',
    network: 'شبكة',
    membership: 'عضوية',
  }),
  personCategory: label(personCategory.enumValues, {
    board: 'مجلس الإدارة',
    executive: 'الإدارة التنفيذية',
    staff: 'الطاقم',
  }),
  publicationType: label(publicationType.enumValues, {
    report: 'تقرير',
    policy: 'سياسة',
    profile: 'ملف تعريفي',
    strategy: 'خطة استراتيجية',
    evaluation: 'تقييم',
    other: 'أخرى',
  }),
} as const;
