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
  const cards = [
    {
      label: 'طلبات جديدة',
      value: data.newSubmissions,
      href: '/admin/submissions',
      action: 'فتح الوارد',
      tone: 'bg-paper',
    },
    ...(actor.canViewSensitive
      ? [
          {
            label: 'شكاوى سرّية جديدة',
            value: data.sensitiveNew,
            href: '/admin/submissions/sensitive',
            action: 'فتح',
            tone: 'bg-destructive-soft border-destructive/40',
          },
        ]
      : []),
    {
      label: 'وسائط تنتظر موافقة',
      value: data.consentGaps,
      href: '/admin/media?needsConsent=1',
      action: 'مراجعة',
      tone: data.consentGaps > 0 ? 'bg-gold-050 border-gold-600' : 'bg-paper',
    },
  ];

  return (
    <>
      <AdminHeader
        title="لوحة التحكم"
        description="نظرة تشغيلية سريعة على المحتوى والوارد وسلامة النشر."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <article
            key={card.label}
            className={`rule-edge animate-slide-fade rounded-lg p-6 shadow-[0_14px_38px_rgb(20_33_63/0.07)] ${card.tone}`}
          >
            <p className="eyebrow">{card.label}</p>
            <p className="mbs-3 font-mono text-h1 text-ink">{card.value}</p>
            <Link
              href={card.href}
              className="inline-flex min-h-9 items-center rounded-md border border-ink/15 px-3 text-caption text-ink no-underline hover:border-gold-600 hover:bg-white"
            >
              {card.action}
            </Link>
          </article>
        ))}
      </div>

      <section className="mbs-10">
        <h2 className="text-h3 font-semibold text-ink">صحة المحتوى</h2>
        <span className="rule-mark mbs-3 mbe-5 block" aria-hidden="true" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rule-edge rounded-lg bg-paper p-6 shadow-[0_14px_38px_rgb(20_33_63/0.06)]">
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
          <div className="rule-edge rounded-lg bg-paper p-6 shadow-[0_14px_38px_rgb(20_33_63/0.06)]">
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
