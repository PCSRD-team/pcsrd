import {
  consentStatus,
  governorate,
  logoPermission,
  membershipLevel,
  metricStatus,
  partnerType,
  personCategory,
  postCategory,
  programKey,
  projectStatus,
  publicationType,
  targetGroup,
  themeTag,
  translationStatus,
  userRole,
  vacancyType,
} from '@/db/schema/enums';
import { ar } from '@/lib/i18n/dictionaries/ar';

/**
 * Labels for the admin's enum selects.
 *
 * **No copy of its own.** The admin is Arabic-only (05-ADMIN §2), so the
 * Arabic dictionary is read directly — `getDictionary` is `server-only` and
 * some of these selects render inside Client Components. Every label that the
 * public site already names is reused from the namespace that names it, so a
 * governorate is spelled once in the repository and an edit lands in both
 * places. The two enums that appear nowhere on the public site — logo
 * permission and translation status — live in `adminUi.enums`.
 *
 * Every list is derived from its `pgEnum`, so a value added to the database
 * appears here as a missing key rather than as a silently absent option.
 */
const label = <T extends string>(values: readonly T[], map: Record<T, string>) =>
  values.map((value) => ({ value, label: map[value] }));

export const ADMIN_OPTIONS = {
  projectState: label(projectStatus.enumValues, {
    planned: ar.projects.statePlanned,
    active: ar.projects.stateActive,
    completed: ar.projects.stateCompleted,
  }),
  governorate: label(governorate.enumValues, ar.enums.governorate),
  theme: label(themeTag.enumValues, ar.enums.theme),
  targetGroup: label(targetGroup.enumValues, ar.enums.targetGroup),
  programKey: label(programKey.enumValues, ar.enums.program),
  postCategory: label(postCategory.enumValues, {
    news: ar.news.categoryNews,
    statement: ar.news.categoryStatement,
    announcement: ar.news.categoryAnnouncement,
  }),
  vacancyType: label(vacancyType.enumValues, {
    job: ar.contentUi.vacancyJob,
    volunteer: ar.contentUi.vacancyVolunteer,
  }),
  partnerType: label(partnerType.enumValues, ar.enums.partnerType),
  personCategory: label(personCategory.enumValues, ar.enums.personCategory),
  publicationType: label(publicationType.enumValues, ar.enums.publicationType),
  membershipLevel: label(membershipLevel.enumValues, {
    full: ar.aboutPages.membershipFull,
    observer: ar.aboutPages.membershipObserver,
  }),
  logoPermission: label(logoPermission.enumValues, ar.adminUi.enums.logoPermission),
  metricStatus: label(metricStatus.enumValues, {
    target: ar.impact.target,
    reported: ar.impact.reported,
    verified: ar.impact.verified,
  }),
  consentStatus: label(consentStatus.enumValues, ar.admin.media.consent),
  translationStatus: label(translationStatus.enumValues, ar.adminUi.enums.translationStatus),
  userRole: label(userRole.enumValues, ar.admin.users.roles),
} as const;
