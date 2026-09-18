import { adminDict } from '@/components/admin/admin-dict';
import { adminUi, fill } from '@/components/admin/admin-ui-dict';
import { AdminPagination, DateCell, STATUS_LABEL, StatusBadge } from '@/components/admin/controls';
import { Flash } from '@/components/admin/flash';
import { RowActions } from '@/components/admin/row-actions';
import { AdminHeader } from '@/components/admin/shell';
import { Bidi } from '@/components/ui/bidi';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/inputs';
import { Cluster } from '@/components/ui/layout';
import { Table } from '@/components/ui/table';
import { type AdminEntity, listAdminRows } from '@/db/queries/admin';
import { contentStatus, type ContentStatus } from '@/db/schema/enums';
import type { Actor } from '@/services/_shared/actor';

/**
 * The list screen, once.
 *
 * Seven content entities share this. A twelfth is a config entry here plus a
 * form config — not a new screen, which is the whole point of the generic layer
 * in 05-ADMIN §3.
 *
 * Search and the status filter are a plain `<form method="get">`: the result is
 * a shareable URL, the back button behaves, and the screen needs no JavaScript.
 */

export const ENTITY_META: Record<
  AdminEntity,
  { title: string; path: string; canCreate: boolean }
> = {
  program: { title: adminUi.nav.programs, path: 'programs', canCreate: false },
  project: { title: adminUi.nav.projects, path: 'projects', canCreate: true },
  post: { title: adminUi.nav.posts, path: 'posts', canCreate: true },
  story: { title: adminUi.nav.stories, path: 'stories', canCreate: true },
  vacancy: { title: adminUi.nav.vacancies, path: 'vacancies', canCreate: true },
  publication: { title: adminUi.nav.publications, path: 'publications', canCreate: true },
  page: { title: adminUi.nav.pages, path: 'pages', canCreate: true },
};

const STATUS_OPTIONS = contentStatus.enumValues;

export async function EntityListPage({
  actor,
  entity,
  searchParams,
}: {
  actor: Actor;
  entity: AdminEntity;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const meta = ENTITY_META[entity];
  const t = adminUi.list;

  const one = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const search = one(searchParams.q)?.trim() || undefined;
  const rawStatus = one(searchParams.status);
  const status = (STATUS_OPTIONS as readonly string[]).includes(rawStatus ?? '')
    ? (rawStatus as ContentStatus)
    : undefined;
  const pageNumber = Number(one(searchParams.page));

  const result = await listAdminRows(actor, entity, {
    search,
    status,
    page: Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1,
  });

  const hrefFor = (page: number) => {
    const query = new URLSearchParams();
    if (search) query.set('q', search);
    if (status) query.set('status', status);
    if (page > 1) query.set('page', String(page));
    const qs = query.toString();
    return `/admin/${meta.path}${qs ? `?${qs}` : ''}`;
  };

  const filtered = Boolean(search || status);

  return (
    <>
      <AdminHeader
        title={meta.title}
        description={fill(t.itemCount, { n: result.total })}
        action={
          meta.canCreate ? (
            <ButtonLink href={`/admin/${meta.path}/new`}>{adminDict.form.add}</ButtonLink>
          ) : undefined
        }
      />

      <Flash searchParams={searchParams} />

      <form method="get" className="mbe-6">
        <Cluster gap={3} align="end">
          <Field name="q" label={t.search} className="min-w-48">
            <Input name="q" type="search" defaultValue={search ?? ''} />
          </Field>
          <Field name="status" label={t.status} className="min-w-40">
            <Select
              name="status"
              defaultValue={status ?? ''}
              placeholder={t.all}
              options={STATUS_OPTIONS.map((value) => ({ value, label: STATUS_LABEL[value] }))}
            />
          </Field>
          <Button type="submit" tone="secondary">
            {t.filter}
          </Button>
          {filtered ? (
            <ButtonLink href={`/admin/${meta.path}`} tone="quiet">
              {t.clearFilter}
            </ButtonLink>
          ) : null}
        </Cluster>
      </form>

      <Table
        caption={meta.title}
        captionHidden
        rows={result.items}
        rowHref={(row) => `/admin/${meta.path}/${row.id}`}
        actionsLabel={adminDict.form.actions}
        actions={(row) => (
          <RowActions
            entity={entity}
            id={row.id}
            status={row.status}
            actor={actor}
            returnTo={`/admin/${meta.path}`}
            label={row.title}
            allowDelete={meta.canCreate}
          />
        )}
        empty={
          <EmptyState
            title={filtered ? t.noResults : t.empty}
            body={filtered ? t.noResultsBody : t.emptyBody}
            action={
              filtered ? (
                <ButtonLink href={`/admin/${meta.path}`} tone="secondary">
                  {t.clearFilter}
                </ButtonLink>
              ) : meta.canCreate ? (
                <ButtonLink href={`/admin/${meta.path}/new`}>{adminDict.form.add}</ButtonLink>
              ) : undefined
            }
          />
        }
        columns={[
          { key: 'title', header: t.columns.title, rowHeader: true, cell: (row) => row.title },
          { key: 'status', header: t.columns.status, cell: (row) => <StatusBadge status={row.status} /> },
          {
            key: 'slug',
            header: t.columns.slug,
            numeric: true,
            align: 'start',
            cell: (row) => <Bidi>{row.slugAr}</Bidi>,
          },
          {
            key: 'updated',
            header: t.columns.updatedAt,
            numeric: true,
            align: 'start',
            cell: (row) => <DateCell value={row.updatedAt} />,
          },
        ]}
      />

      <AdminPagination page={result.page} totalPages={result.totalPages} hrefFor={hrefFor} />
    </>
  );
}
