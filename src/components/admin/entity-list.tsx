import Link from 'next/link';
import { DataTable, Pagination, StatusBadge, TimeCell } from '@/components/admin/controls';
import { Flash } from '@/components/admin/flash';
import { RowActions } from '@/components/admin/row-actions';
import { AdminHeader } from '@/components/admin/shell';
import { adminDict } from '@/components/admin/admin-dict';
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
  program: { title: 'البرامج', path: 'programs', canCreate: false },
  project: { title: 'المشاريع', path: 'projects', canCreate: true },
  post: { title: 'الأخبار', path: 'posts', canCreate: true },
  story: { title: 'القصص', path: 'stories', canCreate: true },
  vacancy: { title: 'الوظائف', path: 'vacancies', canCreate: true },
  publication: { title: 'الإصدارات', path: 'publications', canCreate: true },
  page: { title: 'الصفحات', path: 'pages', canCreate: true },
};

const STATUS_OPTIONS = contentStatus.enumValues;
const STATUS_LABEL: Record<ContentStatus, string> = {
  draft: 'مسودة',
  in_review: 'قيد المراجعة',
  published: 'منشور',
  archived: 'مؤرشف',
};

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

  return (
    <>
      <AdminHeader
        title={meta.title}
        description={`${result.total} عنصر`}
        action={
          meta.canCreate ? (
            <Link
              href={`/admin/${meta.path}/new`}
              className="bg-navy-700 px-5 py-2 text-small font-medium text-paper no-underline hover:bg-navy-900"
            >
              إضافة
            </Link>
          ) : undefined
        }
      />

      <Flash searchParams={searchParams} />

      <form method="get" className="mbe-6 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="q" className="eyebrow">
            بحث
          </label>
          <input
            id="q"
            name="q"
            defaultValue={search ?? ''}
            className="mbs-1 rule-edge bg-paper px-3 py-2 text-small"
          />
        </div>
        <div>
          <label htmlFor="status" className="eyebrow">
            الحالة
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status ?? ''}
            className="mbs-1 rule-edge bg-paper px-3 py-2 text-small"
          >
            <option value="">الكل</option>
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rule-edge px-4 py-2 text-small hover:bg-paper-alt">
          تصفية
        </button>
        {search || status ? (
          <Link href={`/admin/${meta.path}`} className="text-small">
            إزالة التصفية
          </Link>
        ) : null}
      </form>

      <DataTable
        rows={result.items}
        rowHref={(row) => `/admin/${meta.path}/${row.id}`}
        empty={search || status ? 'لا نتائج مطابقة.' : 'لا يوجد محتوى بعد.'}
        columns={[
          { key: 'title', header: 'العنوان', cell: (row) => row.title },
          { key: 'status', header: 'الحالة', cell: (row) => <StatusBadge status={row.status} /> },
          { key: 'slug', header: 'المسار', numeric: true, cell: (row) => row.slugAr },
          {
            key: 'updated',
            header: 'آخر تعديل',
            numeric: true,
            cell: (row) => <TimeCell value={row.updatedAt} />,
          },
          {
            key: 'actions',
            header: adminDict.form.actions,
            cell: (row) => (
              <RowActions
                entity={entity}
                id={row.id}
                status={row.status}
                actor={actor}
                returnTo={`/admin/${meta.path}`}
                label={row.title}
                allowDelete={meta.canCreate}
              />
            ),
          },
        ]}
      />

      <Pagination page={result.page} totalPages={result.totalPages} hrefFor={hrefFor} />
    </>
  );
}
