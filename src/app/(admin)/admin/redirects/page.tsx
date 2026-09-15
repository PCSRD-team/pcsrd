import { removeRedirect } from '@/actions/admin/catalog';
import { adminDict, adminFormDict } from '@/components/admin/admin-dict';
import { DataTable } from '@/components/admin/controls';
import { Flash } from '@/components/admin/flash';
import { RedirectForm } from '@/components/admin/redirect-form';
import { AdminHeader } from '@/components/admin/shell';
import { listAdminRedirects } from '@/db/queries/admin';
import { requireAuth } from '@/lib/auth/guard';
import { assertCan } from '@/services/_shared/permissions';

export const dynamic = 'force-dynamic';

/**
 * Redirects.
 *
 * Read at **request time** by `src/proxy.ts` from one cached array (tag
 * `redirect:list`) that the actions here drop on every save — so a redirect
 * takes effect on the next request, not the next deploy. There is no edit: a
 * redirect is two paths and a code, and replacing one is delete-then-add.
 */
export default async function RedirectsPage({ searchParams }: PageProps<'/admin/redirects'>) {
  const [actor, search] = await Promise.all([requireAuth(), searchParams]);
  assertCan(actor, 'redirects.manage');

  const rows = await listAdminRedirects(actor);
  const t = adminDict.redirects;

  return (
    <>
      <AdminHeader title={t.title} description={t.description} />

      <Flash searchParams={search} />

      <div className="mbe-8">
        <RedirectForm dict={adminFormDict()} />
      </div>

      <DataTable
        rows={rows}
        empty={t.empty}
        columns={[
          { key: 'source', header: t.source, numeric: true, cell: (r) => r.sourcePath },
          { key: 'destination', header: t.destination, numeric: true, cell: (r) => r.destinationPath },
          { key: 'code', header: t.code, numeric: true, cell: (r) => r.statusCode },
          {
            key: 'actions',
            header: adminDict.form.actions,
            cell: (r) => (
              <details>
                <summary className="rule-edge inline-block cursor-pointer list-none px-3 py-1 text-caption text-ink hover:bg-paper-alt whitespace-nowrap">
                  {adminDict.form.delete}
                </summary>
                <form action={removeRedirect} className="mbs-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="returnTo" value="/admin/redirects" />
                  <button
                    type="submit"
                    className="rule-edge border-gold-600 px-3 py-1 text-caption text-gold-700 hover:bg-gold-050 whitespace-nowrap"
                  >
                    {adminDict.form.confirmDelete}
                  </button>
                </form>
              </details>
            ),
          },
        ]}
      />
    </>
  );
}
