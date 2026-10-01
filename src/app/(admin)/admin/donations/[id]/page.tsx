import { notFound } from 'next/navigation';
import { deleteDonationAction, reviewDonationAction } from '@/actions/admin/donations';
import { adminFormDict } from '@/components/admin/admin-dict';
import { adminUi } from '@/components/admin/admin-ui-dict';
import { DateCell } from '@/components/admin/controls';
import { DonationReview } from '@/components/admin/donation-review';
import { Flash } from '@/components/admin/flash';
import { AdminHeader } from '@/components/admin/shell';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Bidi, Code } from '@/components/ui/bidi';
import { Button, ButtonLink, buttonClasses } from '@/components/ui/button';
import { Panel } from '@/components/ui/card';
import { DefinitionList } from '@/components/ui/definition-list';
import { Cluster, Stack } from '@/components/ui/layout';
import { Caption, Eyebrow, Heading } from '@/components/ui/typography';
import { db } from '@/db';
import type { DonationStatus } from '@/db/schema/enums';
import { requireAuth } from '@/lib/auth/guard';
import { formatIban } from '@/lib/donations/options';
import { isAppError } from '@/lib/errors';
import { formatDate, formatNumber } from '@/lib/format';
import { can } from '@/services/_shared/permissions';
import { getDonation } from '@/services/donations/donation.service';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<DonationStatus, BadgeTone> = {
  pending: 'warning',
  confirmed: 'success',
  rejected: 'neutral',
};

/**
 * One donation notice.
 *
 * What the donor said, then what we found. The notice is laid out in the
 * order a reviewer reads a bank statement line — amount, account, date,
 * transfer reference — so matching is a top-to-bottom scan, not a hunt.
 *
 * The transfer slip is never linked directly: the button goes to a route that
 * mints a sixty-second signed URL and writes the audit entry, because the slip
 * shows the donor's own account.
 */
export default async function DonationPage({
  params,
  searchParams,
}: PageProps<'/admin/donations/[id]'>) {
  const [actor, { id }, search] = await Promise.all([requireAuth(), params, searchParams]);

  const donation = await getDonation(db, actor, id).catch((error) => {
    if (isAppError(error) && error.code === 'not_found') notFound();
    throw error;
  });

  const t = adminUi.donations;
  const yesNo = (value: boolean) => (value ? adminUi.list.columns.yes : adminUi.list.columns.no);
  const money = (amount: string, currency: string) => (
    <Bidi>
      {formatNumber(amount, 'ar')} {currency}
    </Bidi>
  );
  const latin = (value: string | null) => (value ? <Bidi>{value}</Bidi> : '—');

  return (
    <>
      <AdminHeader
        title={donation.reference}
        description={t.methods[donation.method]}
        meta={
          <Cluster gap={2}>
            <Badge tone={STATUS_TONE[donation.status]}>{t.status[donation.status]}</Badge>
            {donation.isAnonymous ? <Badge tone="neutral">{t.columns.anonymous}</Badge> : null}
          </Cluster>
        }
        action={
          <ButtonLink href="/admin/donations" tone="quiet">
            {t.backToList}
          </ButtonLink>
        }
      />

      <Flash searchParams={search} />

      <Stack gap={8}>
        <section aria-labelledby="donation-notice">
          <Eyebrow className="mbe-3" id="donation-notice">
            {t.noticeSection}
          </Eyebrow>
          <Panel tone="alt" padding="sm">
            <DefinitionList
              labelledBy="donation-notice"
              items={[
                { term: t.columns.reference, value: <Code>{donation.reference}</Code> },
                { term: t.columns.amount, value: money(donation.amount, donation.currency) },
                { term: t.columns.method, value: t.methods[donation.method] },
                {
                  term: t.account,
                  value: donation.account ? (
                    <span>
                      {donation.account.bankNameAr} — <Code>{formatIban(donation.account.iban)}</Code>{' '}
                      <Bidi>({donation.account.currency})</Bidi>
                    </span>
                  ) : (
                    t.accountUnknown
                  ),
                },
                {
                  term: t.columns.transferredOn,
                  value: donation.transferredOn
                    ? formatDate(donation.transferredOn, 'ar', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—',
                },
                { term: t.columns.bankReference, value: latin(donation.bankReference) },
                { term: t.columns.project, value: donation.projectTitle ?? t.generalPurpose },
                { term: t.columns.createdAt, value: <DateCell value={donation.createdAt} /> },
                { term: t.locale, value: t.locales[donation.locale] },
              ]}
            />
          </Panel>
        </section>

        <section aria-labelledby="donation-donor">
          <Eyebrow className="mbe-3" id="donation-donor">
            {t.donorSection}
          </Eyebrow>
          <Panel tone="alt" padding="sm">
            <DefinitionList
              labelledBy="donation-donor"
              items={[
                {
                  term: t.columns.donor,
                  value: (
                    <Stack gap={1}>
                      <span>{donation.donorName ?? t.anonymousDonor}</span>
                      {donation.isAnonymous ? (
                        <Caption as="span">{t.anonymousNote}</Caption>
                      ) : null}
                    </Stack>
                  ),
                },
                { term: t.columns.email, value: latin(donation.donorEmail) },
                { term: t.columns.phone, value: latin(donation.donorPhone) },
                { term: t.wantsReceipt, value: yesNo(donation.wantsReceipt) },
                {
                  term: t.message,
                  value: donation.message ? (
                    <span className="whitespace-pre-wrap break-words">{donation.message}</span>
                  ) : (
                    '—'
                  ),
                },
              ]}
            />
          </Panel>
        </section>

        <section aria-labelledby="donation-slip">
          <Eyebrow className="mbe-3" id="donation-slip">
            {t.slip}
          </Eyebrow>
          {donation.attachmentPath ? (
            <Stack gap={2}>
              <div>
                {/* Minted on click, valid for sixty seconds, audited. Minting
                    it here would put a live link to a stranger's bank slip
                    into the page's HTML. */}
                <ButtonLink
                  href={`/api/admin/donations/${donation.id}/slip`}
                  tone="secondary"
                  size="sm"
                  external
                >
                  {t.slipDownload}
                </ButtonLink>
              </div>
              <Caption>{t.slipHint}</Caption>
            </Stack>
          ) : (
            <Caption>{t.noSlip}</Caption>
          )}
        </section>

        {donation.reviewedAt ? (
          <section aria-labelledby="donation-reviewed">
            <Eyebrow className="mbe-3" id="donation-reviewed">
              {t.reviewedSection}
            </Eyebrow>
            <Panel tone="alt" padding="sm">
              <DefinitionList
                labelledBy="donation-reviewed"
                items={[
                  { term: t.columns.status, value: t.status[donation.status] },
                  {
                    term: t.columns.confirmedAmount,
                    value: donation.confirmedAmount
                      ? money(donation.confirmedAmount, donation.currency)
                      : '—',
                  },
                  { term: t.columns.receiptNumber, value: latin(donation.receiptNumber) },
                  { term: t.columns.reviewedAt, value: <DateCell value={donation.reviewedAt} /> },
                ]}
              />
            </Panel>
          </section>
        ) : null}

        <DonationReview
          action={reviewDonationAction}
          dict={adminFormDict()}
          values={{
            id: donation.id,
            currency: donation.currency,
            amount: donation.amount,
            confirmedAmount: donation.confirmedAmount,
            receiptNumber: donation.receiptNumber,
            internalNote: donation.internalNote,
          }}
        />

        {/* Erasure, admin only. Its own form, at the bottom, away from the
            review buttons, and behind a disclosure: the confirm button is not
            in the page until the reviewer has opened it and read the sentence
            that names the notice. */}
        {can(actor, 'donations.settings') ? (
          <Panel
            as="section"
            tone="paper"
            padding="sm"
            className="border-destructive/40"
            labelledBy="donation-delete"
          >
            <Heading level={2} size="h4" id="donation-delete">
              {t.deleteZone}
            </Heading>
            <Caption className="mbs-1 mbe-3">{t.deleteZoneHint}</Caption>
            <details>
              <summary
                className={buttonClasses({
                  tone: 'secondary',
                  size: 'sm',
                  className: 'cursor-pointer list-none',
                })}
              >
                {t.deleteOpen}
              </summary>
              <form action={deleteDonationAction} className="mbs-3 max-w-md">
                <input type="hidden" name="id" value={donation.id} />
                <p className="mbe-3 text-small text-ink">
                  {/* The reference is a Latin run inside an Arabic sentence,
                      so it is spliced in as an isolate, not filled as text. */}
                  {t.deleteConfirmSentence.split('{reference}').map((part, index) => (
                    <span key={`part-${index}`}>
                      {index > 0 ? <Code>{donation.reference}</Code> : null}
                      {part}
                    </span>
                  ))}
                </p>
                <Button type="submit" size="sm" tone="danger">
                  {t.deleteConfirm}
                </Button>
              </form>
            </details>
          </Panel>
        ) : null}
      </Stack>
    </>
  );
}
