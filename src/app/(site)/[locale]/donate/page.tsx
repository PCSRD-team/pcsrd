import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { mediaSrc } from '@/components/content/media';
import { DonationForm, type DonationFormCopy } from '@/components/forms/donation-form';
import { organizationName } from '@/components/layout/chrome';
import { SiteBreadcrumbs } from '@/components/layout/site-breadcrumbs';
import { Bidi } from '@/components/ui/bidi';
import { ButtonLink } from '@/components/ui/button';
import { Panel } from '@/components/ui/card';
import { DefinitionList } from '@/components/ui/definition-list';
import { EmptyState } from '@/components/ui/feedback';
import { Icon } from '@/components/ui/icon';
import { Container, Grid, PageHeader, Section, SectionHeading } from '@/components/ui/layout';
import { Notice } from '@/components/ui/notice';
import { Heading, Prose } from '@/components/ui/typography';
import { getOrganization } from '@/db/queries/content';
import { type DonationAccountView, getDonationPage } from '@/db/queries/donations';
import { DONATION_CURRENCIES, DONATION_METHODS, formatIban, normalizeIban } from '@/lib/donations/options';
import { type Locale, isLocale, localePath } from '@/lib/i18n/config';
import { formSlice } from '@/lib/i18n/form-dict';
import { type Dictionary, getDictionary } from '@/lib/i18n/get-dictionary';
import { buildMetadata } from '@/lib/seo/metadata';
import { CopyButton } from './_components/copy-button';

/**
 * `/donate` — how money reaches the organisation, and the notice that tells
 * us it did.
 *
 * **The site takes no payment.** It publishes the accounts the admin keeps in
 * `donation_accounts`, the iBuraq alias and the bank's hosted card page from
 * `donation_settings`, and records a donor's notice for a person to match
 * against the statement. Not one account number, IBAN or alias is written in
 * code or in the dictionary: a wrong digit published from a deploy is a
 * transfer lost, and a correction that needs a deploy is a correction that
 * waits.
 *
 * Five minutes of ISR rather than the hour the neighbouring pages use: when
 * the admin withdraws an account it has to stop being shown soon, and the
 * admin's save also revalidates `TAGS.donationPage`, so this is the backstop.
 *
 * When donations are switched off — or before the tables exist — the query
 * returns a closed page and this renders the designed empty state, never a
 * half page with no accounts on it.
 */

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<'/[locale]/donate'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const [dict, org] = await Promise.all([getDictionary(locale), getOrganization(locale)]);
  return buildMetadata({
    locale,
    path: '/donate',
    title: dict.donate.title,
    description: dict.donate.lead,
    siteName: organizationName(org),
  });
}

/** `{currency}` → the dictionary's name for it. */
function accountHeading(dict: Dictionary, account: DonationAccountView) {
  return dict.donate.accountFor.replace('{currency}', dict.donate.currencies[account.currency]);
}

/** Plain-text paragraphs from the admin's intro: a blank line starts a new one. */
function paragraphs(text: string | null): string[] {
  return (text ?? '')
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * A value a donor copies into their bank's form: isolated, mono, selectable
 * as one run, with the copy button beside it once the browser can copy.
 */
function CopyableValue({
  display,
  value,
  term,
  dict,
}: {
  display: string;
  value: string;
  term: string;
  dict: Dictionary;
}) {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Bidi className="font-mono text-ink select-all [overflow-wrap:anywhere]">{display}</Bidi>
      <CopyButton
        value={value}
        label={dict.donate.copy}
        ariaLabel={dict.donate.copyLabel.replace('{field}', term)}
        copiedLabel={dict.donate.copied}
      />
    </span>
  );
}

function AccountPanel({ account, dict }: { account: DonationAccountView; dict: Dictionary }) {
  const headingId = `donate-account-${account.id}`;
  return (
    <Panel as="article" labelledBy={headingId} className="border-bs-2 border-bs-ink">
      <Heading level={4} size="h4" id={headingId}>
        {accountHeading(dict, account)} <Bidi className="font-mono text-small text-ink-55">{account.currency}</Bidi>
      </Heading>
      <DefinitionList
        layout="ruled"
        className="mbs-4"
        items={[
          { term: dict.donate.bankName, value: account.bankName },
          { term: dict.donate.branch, value: account.branch },
          { term: dict.donate.beneficiary, value: account.beneficiary },
          {
            term: dict.donate.accountNumber,
            value: (
              <CopyableValue
                display={account.accountNumber}
                value={account.accountNumber}
                term={dict.donate.accountNumber}
                dict={dict}
              />
            ),
          },
          {
            term: dict.donate.iban,
            value: (
              <CopyableValue
                display={formatIban(account.iban)}
                value={normalizeIban(account.iban)}
                term={dict.donate.iban}
                dict={dict}
              />
            ),
          },
          {
            term: dict.donate.swift,
            value: account.swift ? <Bidi className="font-mono text-ink select-all">{account.swift}</Bidi> : null,
          },
        ]}
      />
    </Panel>
  );
}

/**
 * The form's copy and option lists, built here because the dictionary does
 * not reach the browser.
 *
 * The currency and method lists are narrowed to what this page actually
 * offers — a currency with no published account, or iBuraq with no alias,
 * is a choice that would only be matched against nothing. With nothing
 * published at all, every value is offered: the notice still has to be
 * possible for a gift made through a channel the page does not list.
 */
function formProps(locale: Locale, dict: Dictionary, page: Awaited<ReturnType<typeof getDonationPage>>) {
  const d = dict.donate;
  const copy: DonationFormCopy = {
    submit: d.submit,
    success: d.success,
    successNext: d.successNext,
    keepReference: dict.forms.keepReference,
    transferGroup: d.transferGroup,
    donorGroup: d.donorGroup,
    generalPurpose: d.generalPurpose,
    fields: { ...d.fields, message: d.messageLabel, attachment: d.attachmentLabel },
    hints: d.hints,
  };

  const published = new Set(page.accounts.map((account) => account.currency));
  const currencies = DONATION_CURRENCIES.filter((code) => published.size === 0 || published.has(code)).map(
    (code) => ({ value: code, label: `${d.currencies[code]} (${code})` }),
  );

  const offered = {
    bank_transfer: page.accounts.length > 0,
    iburaq: Boolean(page.iburaqAlias || page.iburaqQr),
    card: Boolean(page.cardPaymentUrl),
    other: true,
  } as const;
  const anyPublished = offered.bank_transfer || offered.iburaq || offered.card;
  const methods = DONATION_METHODS.filter((method) => !anyPublished || offered[method]).map((method) => ({
    value: method,
    label: d.methods[method],
  }));

  // `<option>` text cannot hold a `<bdi>`; U+2066/U+2069 (LRI/PDI) isolate
  // the IBAN tail the same way inside Arabic.
  const accounts = page.accounts.map((account) => ({
    value: account.id,
    label: `${d.currencies[account.currency]} — ⁦…${normalizeIban(account.iban).slice(-4)}⁩`,
  }));

  const projects = page.projects.map((project) => ({ value: project.id, label: project.title }));

  return {
    dict: formSlice(dict),
    locale,
    copy,
    currencies,
    methods,
    accounts,
    projects,
    thankYou: page.thankYou,
  };
}

export default async function DonatePage({ params }: PageProps<'/[locale]/donate'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, page] = await Promise.all([getDictionary(locale), getDonationPage(locale)]);
  const d = dict.donate;

  const header = (
    <PageHeader
      eyebrow={d.eyebrow}
      title={d.title}
      lede={d.lead}
      breadcrumbs={<SiteBreadcrumbs locale={locale} dict={dict} trail={[{ label: d.title, path: '/donate' }]} />}
    />
  );

  if (!page.isEnabled) {
    return (
      <Container className="section-gap">
        {header}
        <EmptyState
          bounded
          title={d.closedTitle}
          body={d.closedBody}
          action={
            <>
              <ButtonLink href={localePath(locale, '/contact')} tone="primary">
                {dict.nav.contact}
              </ButtonLink>
              <ButtonLink href={localePath(locale, '/verify')} tone="secondary">
                {dict.nav.verify}
              </ButtonLink>
            </>
          }
        />
      </Container>
    );
  }

  const intro = paragraphs(page.intro);
  const hasIburaq = Boolean(page.iburaqAlias || page.iburaqQr);
  const hasCard = Boolean(page.cardPaymentUrl);

  return (
    <>
      <Container className="section-gap">
        {header}

        {intro.length > 0 ? (
          <Prose measure="reading" className="mbe-12">
            {intro.map((text, index) => (
              <p key={index} className="whitespace-pre-line">
                {text}
              </p>
            ))}
          </Prose>
        ) : null}

        <Section spacing="none" bounded={false} labelledBy="donate-methods">
          <SectionHeading
            id="donate-methods"
            title={d.methodsTitle}
            actions={
              <ButtonLink href="#notify" tone="secondary" size="sm">
                {d.notifyCta}
              </ButtonLink>
            }
          />

          {/* (a) Bank transfer — one record per published account. */}
          <section aria-labelledby="donate-bank">
            <Heading level={3} id="donate-bank">
              {d.bankTitle}
            </Heading>
            <p className="mbs-2 max-w-prose text-small text-ink-70">{d.bankLead}</p>
            {page.accounts.length > 0 ? (
              <Grid as="div" cols={2} gap={6} className="mbs-6">
                {page.accounts.map((account) => (
                  <AccountPanel key={account.id} account={account} dict={dict} />
                ))}
              </Grid>
            ) : (
              <Notice tone="info" live="off" className="mbs-6">
                {d.noAccounts}
              </Notice>
            )}
          </section>

          {hasIburaq || hasCard ? (
            <Grid as="div" cols={2} gap={6} className="mbs-12">
              {/* (b) iBuraq — only when the admin has published an alias or a code. */}
              {hasIburaq ? (
                <Panel as="section" labelledBy="donate-iburaq" className="border-bs-2 border-bs-ink">
                  <Heading level={3} size="h4" id="donate-iburaq">
                    {d.iburaqTitle}
                  </Heading>
                  <p className="mbs-2 text-small text-ink-70">{d.iburaqLead}</p>
                  {page.iburaqAlias ? (
                    <DefinitionList
                      layout="ruled"
                      className="mbs-4"
                      items={[
                        {
                          term: d.iburaqAlias,
                          value: (
                            <CopyableValue
                              display={page.iburaqAlias}
                              value={page.iburaqAlias}
                              term={d.iburaqAlias}
                              dict={dict}
                            />
                          ),
                        },
                      ]}
                    />
                  ) : null}
                  {page.iburaqQr ? (
                    <figure className="mbs-6">
                      {/* Never flipped, never cropped: a QR code read mirrored or
                          clipped is not read at all. White ground behind it for
                          the scanner's contrast. */}
                      <Image
                        src={mediaSrc(page.iburaqQr.path)}
                        alt={page.iburaqQr.alt || d.iburaqTitle}
                        width={page.iburaqQr.width ?? 240}
                        height={page.iburaqQr.height ?? 240}
                        sizes="240px"
                        className="size-60 rule-edge bg-white object-contain p-3"
                      />
                      <figcaption className="mbs-2 text-caption text-ink-55">{d.iburaqQr}</figcaption>
                    </figure>
                  ) : null}
                </Panel>
              ) : null}

              {/* (c) Card — the bank's hosted page. Our site never sees a card number. */}
              {hasCard && page.cardPaymentUrl ? (
                <Panel as="section" labelledBy="donate-card" className="border-bs-2 border-bs-ink">
                  <Heading level={3} size="h4" id="donate-card">
                    {d.cardTitle}
                  </Heading>
                  <p className="mbs-2 text-small text-ink-70">{d.cardLead}</p>
                  <p className="mbs-6">
                    <ButtonLink href={page.cardPaymentUrl} external tone="primary">
                      {d.cardCta}
                      <Icon name="external" size={16} />
                    </ButtonLink>
                  </p>
                  <p className="mbs-3 text-caption text-ink-55">{d.cardExternal}</p>
                </Panel>
              ) : null}
            </Grid>
          ) : null}
        </Section>

        {/* The verify callout: the attestation ground, opened by the 2px gold rule.
            A donate page is the one a fraudster copies first. */}
        <Panel as="aside" tone="gold" className="mbs-12 border-bs-2 border-bs-gold-600" labelledBy="donate-verify">
          <Heading level={2} size="h4" id="donate-verify">
            {d.verifyTitle}
          </Heading>
          <p className="mbs-2 max-w-prose text-small text-ink-70">{d.verifyBody}</p>
          <p className="mbs-4">
            <ButtonLink href={localePath(locale, '/verify')} tone="marked" size="sm">
              {dict.getInvolved.verifyCalloutCta}
            </ButtonLink>
          </p>
        </Panel>
      </Container>

      {/* The notice. Anchored for the "already transferred?" link above and
          for anyone the admin sends straight here. */}
      <Section id="notify" tone="alt" labelledBy="donate-notify" className="scroll-mbs-28">
        <Container size="narrow">
          <SectionHeading id="donate-notify" title={d.notifyTitle} lead={d.notifyLead} />
          <Panel tone="white" className="rule-section">
            <DonationForm {...formProps(locale, dict, page)} />
          </Panel>
        </Container>
      </Section>
    </>
  );
}
