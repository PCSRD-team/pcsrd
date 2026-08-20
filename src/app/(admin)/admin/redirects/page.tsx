import { DataTable } from '@/components/admin/controls';
import { AdminHeader } from '@/components/admin/shell';
import { listAdminRedirects } from '@/db/queries/admin';
import { requireRole } from '@/lib/auth/guard';

export const dynamic = 'force-dynamic';

/**
 * Redirects are read at **build time** by `next.config.ts`, not per request —
 * a database call in the proxy would put a round trip in front of every
 * navigation. A new redirect therefore takes effect on the next deploy, and
 * this page says so rather than letting an editor wonder.
 */
export default async function RedirectsPage() {
  const actor = await requireRole(['admin']);
  const rows = await listAdminRedirects(actor);

  return (
    <>
      <AdminHeader
        title="التحويلات"
        description="تُقرأ عند البناء، فتسري بعد النشر التالي وليس فوراً."
      />

      <DataTable
        rows={rows}
        empty="لا تحويلات."
        columns={[
          { key: 'source', header: 'من', numeric: true, cell: (r) => r.sourcePath },
          { key: 'destination', header: 'إلى', numeric: true, cell: (r) => r.destinationPath },
          { key: 'code', header: 'الرمز', numeric: true, cell: (r) => r.statusCode },
        ]}
      />
    </>
  );
}
