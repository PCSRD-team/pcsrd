import { adminUi, count, fill } from '@/components/admin/admin-ui-dict';
import { AdminPagination, DateCell } from '@/components/admin/controls';
import { Flash } from '@/components/admin/flash';
import { AdminHeader } from '@/components/admin/shell';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Bidi, Code } from '@/components/ui/bidi';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardFooter } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/inputs';
import { Cluster, Grid, Stack } from '@/components/ui/layout';
import { Table } from '@/components/ui/table';
import { Tabs } from '@/components/ui/tabs';
import { Caption, Eyebrow, Meta } from '@/components/ui/typography';
import { db } from '@/db';
import type { DonationStatus } from '@/db/schema/enums';
import { requireAuth } from '@/lib/auth/guard';
import { formatNumber } from '@/lib/format';
import { donationFilterSchema } from '@/lib/validation/donations';
import { can } from '@/services/_shared/permissions';
import {
  DONATIONS_PAGE_SIZE,
  getDonationSummary,
  listDonations,
} from '@/services/donations/donation.service';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<DonationStatus, BadgeTone> = {
  pending: 'warning',
  confirmed: 'success',
  rejected: 'neutral',
};

const FILTERS = ['pending', 'confirmed', 'rejected', 'all'] as const;
type Filter = (typeof FILTERS)[number];

/**
 * The donation notices.
 *
 * Opens on **pending**, not on everything: the job this screen exists for is
 * matching notices against the bank statement, and a list that mixed the
 * waiting ones with two years of confirmed gifts would bury the work. The
 * totals strip counts confirmed money only — a notice is a claim until
 * someone has seen the transfer arrive.
 *
 * The filters are links and a GET form, so the screen works with JavaScript
 * off and every view is a URL a colleague can be sent.
 */
export default async function DonationsPage({ searchParams }: PageProps<'/admin/donations'>) {
  const [actor, search] = await Promise.all([requireAuth(), searchParams]);
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const filter = donationFilterSchema.parse({
    status: one(search.status) ?? 'pending',
    q: one(search.q) ?? '',
    page: one(search.page) ?? 1,
  });

  const [result, summary] = await Promise.all([
    listDonations(db, actor, filter),
    getDonationSummary(db, actor),
  ]);

  const t = adminUi.donations;
  const totalPages = Math.max(1, Math.ceil(result.total / DONATIONS_PAGE_SIZE));

  const hrefFor = (next: { status?: Filter; q?: string; page?: number }) => {
    const status = next.status ?? filter.status;
    const q = next.q ?? filter.q;
    const page = next.page ?? 1;
    const query = new URLSearchParams();
    if (status !== 'pending') query.set('status', status);
    if (q) query.set('q', q);
    if (page > 1) query.set('page', String(page));
    const qs = query.toString();
    return qs ? `/admin/donations?${qs}` : '/admin/donations';
  };

  const label = (status: Filter) => (status === 'all' ? t.allStatuses : t.status[status]);
  const empty = emptyCopy(filter.status, Boolean(filter.q));

  return (
    <>
      <AdminHeader
        title={t.title}
        description={t.description}
        meta={count(t.noticeCount, result.total)}
        action={
          <Cluster gap={2}>
            {/* A file download, not a navigation: a plain anchor so the
                browser saves the workbook instead of the router fetching it. */}
            <ButtonLink href="/api/admin/donations/export" tone="secondary" size="sm" download>
              {t.export}
            </ButtonLink>
            {can(actor, 'donations.settings') ? (
              <ButtonLink href="/admin/donations/settings" tone="quiet" size="sm">
                {t.openSettings}
              </ButtonLink>
            ) : null}
          </Cluster>
        }
      />

      <Flash searchParams={search} />

      <Stack gap={8}>
        <section aria-label={t.summaryLabel}>
          <Grid as="ul" cols={3} gap={4}>
            <Card as="li" accent="var(--color-navy-700)" padding="md">
              <CardBody>
                <Eyebrow>{t.summaryPending}</Eyebrow>
                <Meta className="mbs-3 text-h1 text-ink">{summary.pending}</Meta>
              </CardBody>
              {filter.status !== 'pending' ? (
                <CardFooter>
                  <ButtonLink href="/admin/donations" tone="quiet" size="sm">
                    {t.summaryPendingAction}
                  </ButtonLink>
                </CardFooter>
              ) : null}
            </Card>
            {summary.confirmed.length > 0 ? (
              summary.confirmed.map((row) => (
                <Card key={row.currency} as="li" padding="md">
                  <CardBody>
                    <Eyebrow>{fill(t.summaryConfirmed, { currency: row.currency })}</Eyebrow>
                    <Meta className="mbs-3 text-h2 text-ink">
                      <Bidi>
                        {formatNumber(row.total, 'ar')} {row.currency}
                      </Bidi>
                    </Meta>
                    <Caption className="mbs-1">{count(t.giftCount, row.count)}</Caption>
                  </CardBody>
                </Card>
              ))
            ) : (
              <Card as="li" padding="md">
                <CardBody>
                  <Eyebrow>{t.summaryNoConfirmed}</Eyebrow>
                  <Caption className="mbs-3">{t.summaryNoConfirmedBody}</Caption>
                </CardBody>
              </Card>
            )}
          </Grid>
        </section>

        <Stack gap={4}>
          <Tabs
            label={t.statusTabsLabel}
            items={FILTERS.map((status) => ({
              label: label(status),
              href: hrefFor({ status }),
              current: filter.status === status,
              count: status === 'pending' ? summary.pending : undefined,
            }))}
          />

          <form method="get" action="/admin/donations">
            {filter.status !== 'pending' ? (
              <input type="hidden" name="status" value={filter.status} />
            ) : null}
            <Cluster gap={3} align="end">
              <Field name="q" label={t.search} hint={t.searchHint} className="min-w-64 flex-1">
                <Input name="q" type="search" defaultValue={filter.q} hint={t.searchHint} />
              </Field>
              <Button type="submit" tone="secondary">
                {t.searchSubmit}
              </Button>
              {filter.q ? (
                <ButtonLink href={hrefFor({ q: '' })} tone="quiet">
                  {t.clearSearch}
                </ButtonLink>
              ) : null}
            </Cluster>
          </form>
        </Stack>

        <Table
          caption={`${t.title} — ${label(filter.status)}`}
          captionHidden
          rows={result.rows}
          rowHref={(row) => `/admin/donations/${row.id}`}
          empty={
            <EmptyState
              title={empty.title}
              body={empty.body}
              action={
                filter.q ? (
                  <ButtonLink href={hrefFor({ q: '' })} tone="secondary">
                    {t.clearSearch}
                  </ButtonLink>
                ) : undefined
              }
            />
          }
          columns={[
            {
              key: 'reference',
              header: t.columns.reference,
              rowHeader: true,
              cell: (row) => <Code>{row.reference}</Code>,
            },
            {
              key: 'createdAt',
              header: t.columns.createdAt,
              numeric: true,
              align: 'start',
              cell: (row) => <DateCell value={row.createdAt} />,
            },
            {
              key: 'donor',
              header: t.columns.donor,
              cell: (row) => (
                <Cluster gap={2}>
                  <span>{row.donorName ?? t.anonymousDonor}</span>
                  {row.isAnonymous && row.donorName ? (
                    <Badge tone="neutral">{t.columns.anonymous}</Badge>
                  ) : null}
                </Cluster>
              ),
            },
            {
              key: 'amount',
              header: t.columns.amount,
              numeric: true,
              cell: (row) => (
                <Bidi>
                  {formatNumber(row.amount, 'ar')} {row.currency}
                </Bidi>
              ),
            },
            { key: 'method', header: t.columns.method, cell: (row) => t.methods[row.method] },
            {
              key: 'project',
              header: t.columns.project,
              cell: (row) => row.projectTitle ?? t.generalPurpose,
            },
            {
              key: 'status',
              header: t.columns.status,
              cell: (row) => <Badge tone={STATUS_TONE[row.status]}>{t.status[row.status]}</Badge>,
            },
          ]}
        />
      </Stack>

      <AdminPagination
        page={filter.page}
        totalPages={totalPages}
        hrefFor={(page) => hrefFor({ page })}
      />
    </>
  );
}

/** Nothing at all, nothing waiting, nothing in this tab, or nothing matching the search. */
function emptyCopy(status: Filter, searching: boolean): { title: string; body: string } {
  const t = adminUi.donations;
  if (searching) return { title: t.noResults, body: t.noResultsBody };
  if (status === 'pending') return { title: t.emptyPending, body: t.emptyPendingBody };
  if (status === 'all') return { title: t.empty, body: t.emptyBody };
  return { title: t.emptyStatus, body: t.emptyStatusBody };
}
