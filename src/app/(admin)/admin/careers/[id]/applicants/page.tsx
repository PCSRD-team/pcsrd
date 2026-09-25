import { notFound } from 'next/navigation';
import { adminDict } from '@/components/admin/admin-dict';
import { adminUi, fill } from '@/components/admin/admin-ui-dict';
import { AdminPagination, DateCell } from '@/components/admin/controls';
import { Flash } from '@/components/admin/flash';
import { AdminHeader } from '@/components/admin/shell';
import { Badge } from '@/components/ui/badge';
import { Bidi } from '@/components/ui/bidi';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Field } from '@/components/ui/field';
import { Checkbox, Input, Select } from '@/components/ui/inputs';
import { Cluster } from '@/components/ui/layout';
import { Table, type Column } from '@/components/ui/table';
import { db } from '@/db';
import { applicationStatus, type ApplicationStatus } from '@/db/schema/enums';
import { requireAuth } from '@/lib/auth/guard';
import { isAppError } from '@/lib/errors';
import { getForm } from '@/services/applications/application-form.service';
import {
  type ApplicantRow,
  listApplicants,
} from '@/services/applications/application.service';

export const dynamic = 'force-dynamic';

/**
 * The applicants table.
 *
 * Search and the filters are a plain `<form method="get">`, like every other
 * list in this admin: the result is a shareable URL, the back button behaves,
 * and the screen needs no JavaScript.
 *
 * The export is an `<a href>` carrying the same query string, so the
 * spreadsheet is the rows the recruiter is looking at rather than the whole
 * table. A separate button asks for the sensitive columns; it is a different
 * link rather than a checkbox on the first, because including them is an
 * audited act and should take its own deliberate click.
 */
export default async function ApplicantsPage({
  params,
  searchParams,
}: PageProps<'/admin/careers/[id]/applicants'>) {
  const [actor, { id }, search] = await Promise.all([requireAuth(), params, searchParams]);

  const form = await getForm(db, actor, id).catch((error) => {
    if (isAppError(error) && error.code === 'not_found') notFound();
    throw error;
  });

  const one = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const query = one(search.q)?.trim() || undefined;
  const rawStatus = one(search.status);
  const status = (applicationStatus.enumValues as readonly string[]).includes(rawStatus ?? '')
    ? (rawStatus as ApplicationStatus)
    : undefined;
  const waitlistedOnly = one(search.waitlisted) === '1';
  const pageNumber = Number(one(search.page));

  const result = await listApplicants(db, actor, id, {
    search: query,
    status,
    waitlistedOnly,
    page: Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1,
  });

  const t = adminUi.careers;

  /** The current filter, as a query string — shared by the pager and the export. */
  const filterQuery = () => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (status) params.set('status', status);
    if (waitlistedOnly) params.set('waitlisted', '1');
    return params;
  };

  const hrefFor = (page: number) => {
    const params = filterQuery();
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    return `/admin/careers/${id}/applicants${qs ? `?${qs}` : ''}`;
  };

  const exportHref = (includeSensitive: boolean) => {
    const params = filterQuery();
    if (includeSensitive) params.set('includeSensitive', '1');
    const qs = params.toString();
    return `/api/admin/careers/${id}/export${qs ? `?${qs}` : ''}`;
  };

  const hasSensitiveFields = form.fields.some((field) => field.sensitive);

  const columns: Column<ApplicantRow>[] = [
    {
      key: 'name',
      header: t.applicantName,
      rowHeader: true,
      cell: (row) => row.applicantName ?? row.reference,
    },
    {
      key: 'reference',
      header: t.reference,
      numeric: true,
      cell: (row) => row.reference,
    },
    {
      key: 'email',
      header: t.applicantEmail,
      // A Latin address inside an Arabic table is reordered by the bidi
      // algorithm without isolation — rule 4.
      cell: (row) => (row.applicantEmail ? <Bidi>{row.applicantEmail}</Bidi> : '—'),
    },
    {
      key: 'phone',
      header: t.applicantPhone,
      cell: (row) => (row.applicantPhone ? <Bidi>{row.applicantPhone}</Bidi> : '—'),
    },
    {
      key: 'status',
      header: adminUi.list.status,
      cell: (row) => (
        <Cluster gap={2}>
          <Badge tone={row.status === 'new' ? 'accent' : 'neutral'}>
            {t.status[row.status]}
          </Badge>
          {row.waitlisted ? <Badge tone="warning">{t.waitlisted}</Badge> : null}
        </Cluster>
      ),
    },
    {
      key: 'attachments',
      header: t.attachments,
      numeric: true,
      cell: (row) => row.attachmentCount,
    },
    {
      key: 'createdAt',
      header: t.submittedAt,
      numeric: true,
      cell: (row) => <DateCell value={row.createdAt} />,
    },
  ];

  return (
    <>
      <AdminHeader
        title={`${t.applicants} — ${form.titleAr}`}
        description={fill(t.applicantCount, { n: result.total })}
        action={
          <Cluster gap={2}>
            <ButtonLink href={`/admin/careers/${id}`} tone="quiet">
              {t.settings}
            </ButtonLink>
            <ButtonLink href={exportHref(false)} download>
              {t.export}
            </ButtonLink>
            {hasSensitiveFields ? (
              <ButtonLink href={exportHref(true)} tone="secondary" download>
                {t.exportSensitive}
              </ButtonLink>
            ) : null}
          </Cluster>
        }
      />

      <Flash searchParams={search} />

      {hasSensitiveFields ? (
        <p className="mbe-4 text-caption text-ink-55">{t.exportSensitiveHint}</p>
      ) : null}

      <form method="get" className="mbe-6">
        <Cluster gap={3} align="end">
          <Field name="q" label={adminUi.list.search} className="min-w-48">
            <Input name="q" type="search" defaultValue={query ?? ''} />
          </Field>
          <Field name="status" label={adminUi.list.status} className="min-w-40">
            <Select
              name="status"
              defaultValue={status ?? ''}
              placeholder={adminUi.list.all}
              options={applicationStatus.enumValues.map((value) => ({
                value,
                label: `${t.status[value]} (${result.statusCounts[value] ?? 0})`,
              }))}
            />
          </Field>
          <Checkbox name="waitlisted" value="1" label={t.waitlistedOnly} defaultChecked={waitlistedOnly} />
          <Button type="submit" tone="secondary">
            {adminUi.list.filter}
          </Button>
          {query || status || waitlistedOnly ? (
            <ButtonLink href={`/admin/careers/${id}/applicants`} tone="quiet">
              {adminUi.list.clearFilter}
            </ButtonLink>
          ) : null}
        </Cluster>
      </form>

      <Table
        caption={t.applicants}
        captionHidden
        rows={result.rows}
        columns={columns}
        rowHref={(row) => `/admin/careers/applicants/${row.id}`}
        actionsLabel={adminDict.form.actions}
        actions={(row) => (
          <ButtonLink href={`/admin/careers/applicants/${row.id}`} tone="quiet">
            {t.openApplicant}
          </ButtonLink>
        )}
        empty={
          query || status || waitlistedOnly ? (
            <EmptyState title={adminUi.list.noResults} body={adminUi.list.noResultsBody} />
          ) : (
            <EmptyState title={t.noApplicants} body={t.noApplicantsBody} />
          )
        }
      />

      <AdminPagination
        page={result.page}
        totalPages={Math.max(1, Math.ceil(result.total / result.pageSize))}
        hrefFor={hrefFor}
      />
    </>
  );
}
