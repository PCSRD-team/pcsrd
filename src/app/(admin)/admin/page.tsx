import Link from 'next/link';
import { AdminHeader } from '@/components/admin/shell';
import { DataTable, TimeCell } from '@/components/admin/controls';
import { getDashboard } from '@/db/queries/admin';
import { requireAuth } from '@/lib/auth/guard';

export const dynamic = 'force-dynamic';

const ENTITY_LABEL: Record<string, string> = {
  project: 'مشاريع',
  post: 'أخبار',
  story: 'قصص',
  vacancy: 'وظائف',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'مسودة',
  in_review: 'قيد المراجعة',
  published: 'منشور',
  archived: 'مؤرشف',
};

const ACTION_LABEL: Record<string, string> = {
  create: 'إنشاء',
  update: 'تعديل',
  publish: 'نشر',
  unpublish: 'إلغاء نشر',
  archive: 'أرشفة',
  delete: 'حذف',
  view_sensitive: 'فتح شكوى سرّية',
  download_attachment: 'تنزيل مرفق',
};

export default async function DashboardPage() {
  const actor = await requireAuth();
  const data = await getDashboard(actor);

  const published = data.content.filter((row) => row.status === 'published');
  const drafts = data.content.filter((row) => row.status !== 'published');

  return (
    <>
      <AdminHeader title="لوحة التحكم" />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rule-edge bg-paper p-6">
          <p className="eyebrow">طلبات جديدة</p>
          <p className="mbs-3 font-mono text-h1 text-ink">{data.newSubmissions}</p>
          <Link href="/admin/submissions" className="mbs-3 block text-caption">
            فتح الوارد
          </Link>
        </div>

        {actor.canViewSensitive ? (
          <div className="rule-edge border-gold-600 bg-gold-050 p-6">
            <p className="eyebrow">شكاوى سرّية جديدة</p>
            <p className="mbs-3 font-mono text-h1 text-ink">{data.sensitiveNew}</p>
            <Link href="/admin/submissions/sensitive" className="mbs-3 block text-caption">
              فتح
            </Link>
          </div>
        ) : null}

        {/*
          The one operational number worth a dashboard slot: assets that would
          refuse a publish. Discovering this at publish time is discovering it
          at the worst possible moment.
        */}
        <div
          className={`rule-edge p-6 ${data.consentGaps > 0 ? 'border-gold-600 bg-gold-050' : 'bg-paper'}`}
        >
          <p className="eyebrow">وسائط تنتظر موافقة</p>
          <p className="mbs-3 font-mono text-h1 text-ink">{data.consentGaps}</p>
          <Link href="/admin/media?needsConsent=1" className="mbs-3 block text-caption">
            مراجعة
          </Link>
        </div>
      </div>

      <section className="mbs-10">
        <h2 className="text-h3 font-semibold text-ink">المحتوى</h2>
        <span className="rule-mark mbs-3 mbe-5 block" aria-hidden="true" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rule-edge bg-paper p-6">
            <p className="eyebrow mbe-3">منشور</p>
            <ul className="space-y-1 text-small">
              {published.map((row) => (
                <li key={row.entity} className="flex justify-between">
                  <span>{ENTITY_LABEL[row.entity] ?? row.entity}</span>
                  <span className="font-mono text-caption">{row.n}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rule-edge bg-paper p-6">
            <p className="eyebrow mbe-3">غير منشور</p>
            <ul className="space-y-1 text-small">
              {drafts.map((row) => (
                <li key={`${row.entity}-${row.status}`} className="flex justify-between">
                  <span>
                    {ENTITY_LABEL[row.entity] ?? row.entity} — {STATUS_LABEL[row.status] ?? row.status}
                  </span>
                  <span className="font-mono text-caption">{row.n}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mbs-10">
        <h2 className="text-h3 font-semibold text-ink">آخر النشاط</h2>
        <span className="rule-mark mbs-3 mbe-5 block" aria-hidden="true" />
        <DataTable
          rows={data.recentAudit}
          empty="لا نشاط بعد."
          columns={[
            { key: 'action', header: 'الإجراء', cell: (r) => ACTION_LABEL[r.action] ?? r.action },
            { key: 'entity', header: 'العنصر', cell: (r) => r.entityType },
            { key: 'actor', header: 'المستخدم', cell: (r) => r.actorName ?? 'النظام' },
            {
              key: 'at',
              header: 'التاريخ',
              numeric: true,
              cell: (r) => <TimeCell value={r.createdAt} />,
            },
          ]}
        />
      </section>
    </>
  );
}
