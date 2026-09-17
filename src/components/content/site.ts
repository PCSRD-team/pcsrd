import { getOrganization } from '@/db/queries/content';
import type { Locale } from '@/lib/i18n/config';
import type { TranslationStatus } from '@/lib/seo/metadata';

/**
 * The site name for `buildMetadata`, JSON-LD and the OG cards:
 * `short_name → legal_name → acronym`, all from `organization_settings`.
 * Never a string literal (RULE 6); an unconfigured organisation yields `''`.
 */
export function siteNameOf(
  org: { shortName?: string | null; legalName?: string | null; acronym?: string | null } | null,
): string {
  return org?.shortName ?? org?.legalName ?? org?.acronym ?? '';
}

export async function getSiteName(locale: Locale): Promise<string> {
  return siteNameOf(await getOrganization(locale));
}

/**
 * The schema's `translation_status` enum has a fourth value, `reviewed`,
 * that the metadata builder's `TranslationStatus` does not know. The builder
 * only distinguishes `ar_only` from everything else, so `reviewed` is passed
 * as a translated state. Remove once the builder's type is widened.
 */
export function toTranslationStatus(
  status: 'ar_only' | 'machine_draft' | 'human_translated' | 'reviewed' | null | undefined,
): TranslationStatus | undefined {
  if (!status) return undefined;
  return status === 'reviewed' ? 'human_translated' : status;
}
