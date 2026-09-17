import { visibleText } from '@/components/layout/chrome';
import { Bidi } from '@/components/ui/bidi';
import { Panel } from '@/components/ui/card';
import { DefinitionList, type DefinitionItem } from '@/components/ui/definition-list';
import { Eyebrow } from '@/components/ui/typography';
import type { getOrganization } from '@/db/queries/content';
import type { Locale } from '@/lib/i18n/config';
import type { Dictionary } from '@/lib/i18n/get-dictionary';

export type Organization = NonNullable<Awaited<ReturnType<typeof getOrganization>>>;

/**
 * The identity ledger: the facts a due-diligence officer reads first. Every
 * row reads from `organization_settings`; a fact the organisation has not
 * supplied produces no row, not an empty one.
 */
export function identityItems(org: Organization | null, dict: Dictionary, locale: Locale): DefinitionItem[] {
  const legalName = visibleText(org?.legalName);
  const otherLegalName = visibleText(locale === 'ar' ? org?.legalNameEn : org?.legalNameAr);
  const licenseNumber = visibleText(org?.licenseNumber);
  const foundedYear = org?.foundedYear && org.foundedYear > 1900 ? String(org.foundedYear) : null;

  return [
    {
      term: dict.about.legalName,
      value: legalName ? (
        <span className="flex flex-wrap gap-x-3 gap-y-1">
          <span className="font-medium">{legalName}</span>
          {otherLegalName && otherLegalName !== legalName ? (
            <Bidi dir={locale === 'ar' ? 'ltr' : 'rtl'} className="text-ink-55">
              {otherLegalName}
            </Bidi>
          ) : null}
        </span>
      ) : null,
    },
    { term: dict.about.licenseNumber, value: licenseNumber ? <Bidi className="font-mono">{licenseNumber}</Bidi> : null },
    { term: dict.about.licenseAuthority, value: visibleText(org?.licenseAuthority) },
    { term: dict.about.legalForm, value: visibleText(org?.legalForm) },
    { term: dict.about.foundedYear, value: foundedYear ? <Bidi className="font-mono">{foundedYear}</Bidi> : null },
    { term: dict.siteChrome.address, value: visibleText(org?.address) },
  ];
}

export function IdentityRecord({
  org,
  dict,
  locale,
  id = 'about-identity',
}: {
  org: Organization | null;
  dict: Dictionary;
  locale: Locale;
  id?: string;
}) {
  const items = identityItems(org, dict, locale).filter((item) => item.value);

  return (
    <Panel as="aside" tone="paper" padding="none" labelledBy={id} className="rule-section">
      <div className="bg-navy-900 px-6 py-4 text-paper">
        <p id={id} className="text-small font-semibold">
          {dict.about.identity}
        </p>
        <Eyebrow as="p" className="mbs-1 text-paper/70">
          {dict.aboutPages.identityLead}
        </Eyebrow>
      </div>
      <div className="p-6">
        {items.length > 0 ? (
          <DefinitionList items={items} layout="ruled" />
        ) : (
          <p className="text-small text-ink-55">{dict.aboutPages.identityEmpty}</p>
        )}
      </div>
    </Panel>
  );
}
