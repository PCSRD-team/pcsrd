import type { Locale } from '@/lib/i18n/config';

let didWarn = false;

export function shouldUseDevelopmentPlaceholderData(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.DATABASE_URL === 'postgresql://postgres:postgres@localhost:5432/pcsrd'
  );
}

export function shouldUseDevelopmentDatabaseFallback(error: unknown): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  const url = process.env.DATABASE_URL ?? '';
  const isLocalPlaceholder =
    url.includes('localhost') || url.includes('127.0.0.1') || url.includes('@localhost:');
  if (!isLocalPlaceholder) return false;

  if (!didWarn) {
    didWarn = true;
    console.warn(
      '[dev] Database is unavailable, rendering placeholder content. ' +
        'Set DATABASE_URL and DIRECT_URL in .env.local for real data.',
      error,
    );
  }

  return true;
}

export function developmentOrganization(locale: Locale) {
  const mission = 'Local development placeholder. Connect the database to show published content.';

  return {
    id: true,
    legalNameAr: 'PCSRD',
    legalNameEn: 'PCSRD',
    shortNameAr: 'PCSRD',
    shortNameEn: 'PCSRD',
    acronym: 'PCSRD',
    shortDescriptionAr: null,
    shortDescriptionEn: null,
    alternateNames: [],
    foundedYear: new Date().getUTCFullYear(),
    licenseNumber: '',
    licenseAuthorityAr: null,
    licenseAuthorityEn: null,
    legalFormAr: null,
    legalFormEn: null,
    visionAr: null,
    visionEn: null,
    missionAr: mission,
    missionEn: mission,
    coreValues: [],
    principles: [],
    strategicObjectives: [],
    primaryPhone: null,
    additionalPhones: [],
    whatsappNumber: null,
    email: null,
    secondaryEmail: null,
    addressAr: null,
    addressEn: null,
    addressIsPublic: false,
    officeHoursAr: null,
    officeHoursEn: null,
    socials: [],
    officialChannels: [],
    footerCtaTitleAr: null,
    footerCtaTitleEn: null,
    footerCtaDescriptionAr: null,
    footerCtaDescriptionEn: null,
    footerCtaButtonLabelAr: null,
    footerCtaButtonLabelEn: null,
    footerCtaUrl: null,
    footerCtaEnabled: false,
    logoPrimaryId: null,
    logoMonoId: null,
    defaultOgId: null,
    logoPrimaryBucket: null,
    logoPrimaryPath: null,
    logoPrimaryAlt: null,
    footerLogoBucket: null,
    footerLogoPath: null,
    footerLogoAlt: null,
    updatedAt: new Date(0),
    updatedBy: null,
    legalName: 'PCSRD',
    shortName: 'PCSRD',
    shortDescription: null,
    vision: null,
    mission: locale === 'en' ? mission : mission,
    licenseAuthority: null,
    legalForm: null,
    officeHours: null,
    footerCta: {
      enabled: false,
      fieldsAvailable: false,
      title: null,
      description: null,
      buttonLabel: null,
      url: null,
    },
    address: null,
  };
}
