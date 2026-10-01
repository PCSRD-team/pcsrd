import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { donationAccounts, donationSettings, mediaAssets, projects } from '@/db/schema';
import { TAGS } from '@/lib/cache/tags';
import type { DonationCurrency } from '@/lib/donations/options';
import type { Locale } from '@/lib/i18n/config';
import { cached } from './_cache';
import { shouldUseDevelopmentPlaceholderData } from './_dev-fallback';

/**
 * What the donate page shows: whether donations are open, how to send money,
 * and the projects a gift can be marked for.
 *
 * No actor, like every public read: `anon` sees the active accounts and the
 * settings row, which `donation_accounts.rt_select` / `donation_settings.
 * rt_select` allow. `notifyEmails` is never selected — it is staff addresses,
 * and this object ends up in the page.
 */

export type DonationAccountView = {
  id: string;
  currency: DonationCurrency;
  bankName: string;
  branch: string | null;
  beneficiary: string;
  accountNumber: string;
  iban: string;
  swift: string | null;
};

export type DonationPage = {
  isEnabled: boolean;
  intro: string | null;
  iburaqAlias: string | null;
  iburaqQr: { path: string; alt: string; width: number | null; height: number | null } | null;
  cardPaymentUrl: string | null;
  thankYou: string | null;
  accounts: DonationAccountView[];
  projects: { id: string; title: string }[];
};

const CLOSED: DonationPage = {
  isEnabled: false,
  intro: null,
  iburaqAlias: null,
  iburaqQr: null,
  cardPaymentUrl: null,
  thankYou: null,
  accounts: [],
  projects: [],
};

const pick = (ar: string | null, en: string | null, locale: Locale) =>
  locale === 'en' ? en?.trim() || ar : ar;

export async function _getDonationPage(locale: Locale): Promise<DonationPage> {
  if (shouldUseDevelopmentPlaceholderData()) return CLOSED;

  try {
    const [settingsRows, accountRows, projectRows] = await Promise.all([
      db
        .select({
          isEnabled: donationSettings.isEnabled,
          introAr: donationSettings.introAr,
          introEn: donationSettings.introEn,
          iburaqAlias: donationSettings.iburaqAlias,
          cardPaymentUrl: donationSettings.cardPaymentUrl,
          thankYouAr: donationSettings.thankYouAr,
          thankYouEn: donationSettings.thankYouEn,
          qrPath: mediaAssets.path,
          qrAltAr: mediaAssets.altAr,
          qrAltEn: mediaAssets.altEn,
          qrWidth: mediaAssets.width,
          qrHeight: mediaAssets.height,
        })
        .from(donationSettings)
        .leftJoin(mediaAssets, eq(mediaAssets.id, donationSettings.iburaqQrMediaId))
        .where(eq(donationSettings.id, 1))
        .limit(1),
      db
        .select()
        .from(donationAccounts)
        .where(eq(donationAccounts.isActive, true))
        .orderBy(asc(donationAccounts.sortOrder), asc(donationAccounts.currency)),
      db
        .select({ id: projects.id, titleAr: projects.titleAr, titleEn: projects.titleEn })
        .from(projects)
        .where(and(eq(projects.status, 'published')))
        .orderBy(desc(projects.publishedAt))
        .limit(100),
    ]);

    const settings = settingsRows[0];
    if (!settings) return CLOSED;

    return {
      isEnabled: settings.isEnabled,
      intro: pick(settings.introAr, settings.introEn, locale),
      iburaqAlias: settings.iburaqAlias,
      iburaqQr: settings.qrPath
        ? {
            path: settings.qrPath,
            alt: pick(settings.qrAltAr, settings.qrAltEn, locale) ?? '',
            width: settings.qrWidth,
            height: settings.qrHeight,
          }
        : null,
      cardPaymentUrl: settings.cardPaymentUrl,
      thankYou: pick(settings.thankYouAr, settings.thankYouEn, locale),
      accounts: accountRows.map((row) => ({
        id: row.id,
        currency: row.currency as DonationCurrency,
        bankName: pick(row.bankNameAr, row.bankNameEn, locale) ?? row.bankNameAr,
        branch: pick(row.branchAr, row.branchEn, locale),
        beneficiary: pick(row.beneficiaryAr, row.beneficiaryEn, locale) ?? row.beneficiaryAr,
        accountNumber: row.accountNumber,
        iban: row.iban,
        swift: row.swift,
      })),
      projects: projectRows.map((row) => ({
        id: row.id,
        title: pick(row.titleAr, row.titleEn, locale) ?? row.titleAr,
      })),
    };
  } catch (error) {
    // Before the donation tables exist (the SQL not yet applied), the page
    // says donations are not open rather than failing the whole route.
    console.error('[donations] page read failed', error);
    return CLOSED;
  }
}

export const getDonationPage = cached(_getDonationPage, ['donation:page'], {
  tags: [TAGS.donationPage, TAGS.projectList],
});

/**
 * Who hears about a new notice, and the thank-you text, for the submission
 * path only. Uncached and never part of `DonationPage`: staff addresses do not
 * belong in a page's markup.
 */
export async function _getDonationNotifySettings(
  locale: Locale,
): Promise<{ notifyEmails: string[]; thankYou: string | null }> {
  const [row] = await db
    .select({
      notifyEmails: donationSettings.notifyEmails,
      thankYouAr: donationSettings.thankYouAr,
      thankYouEn: donationSettings.thankYouEn,
    })
    .from(donationSettings)
    .where(eq(donationSettings.id, 1))
    .limit(1);
  return {
    notifyEmails: row?.notifyEmails ?? [],
    thankYou: row ? pick(row.thankYouAr, row.thankYouEn, locale) : null,
  };
}
