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
      tone: 'bg-white border-navy-700/15',
      accent: 'bg-navy-700',
    },
    ...(actor.canViewSensitive
      ? [
          {
            label: 'شكاوى سرّية جديدة',
            value: data.sensitiveNew,
            href: '/admin/submissions/sensitive',
            action: 'فتح',
            tone: 'bg-destructive-soft border-destructive/30',
            accent: 'bg-destructive',
          },
        ]
      : []),
    {
      label: 'وسائط تنتظر موافقة',
      value: data.consentGaps,
      href: '/admin/media?needsConsent=1',
      action: 'مراجعة',
      tone: data.consentGaps > 0 ? 'bg-gold-050 border-gold-600/50' : 'bg-white border-navy-700/15',
      accent: 'bg-gold-600',
    },
  ];

  return (
    <>
      <AdminHeader
        title="لوحة التحكم"
        description="نظرة تشغيلية سريعة على المحتوى والوارد وسلامة النشر."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/posts/new"
              className="inline-flex min-h-10 items-center rounded-xl bg-navy-700 px-4 text-caption font-medium text-paper no-underline shadow-[0_8px_20px_rgb(37_66_132/0.18)] transition hover:bg-navy-900"
            >
              + خبر جديد
            </Link>
            <Link
              href="/admin/media"
              className="inline-flex min-h-10 items-center rounded-xl border border-rule bg-white px-4 text-caption font-medium text-ink no-underline transition hover:border-gold-600 hover:bg-gold-050"
            >
              رفع صورة
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <article
            key={card.label}
            className={`relative animate-slide-fade overflow-hidden rounded-2xl border p-6 shadow-[0_18px_45px_rgb(20_33_63/0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgb(20_33_63/0.12)] ${card.tone}`}
          >
            <span className={`absolute inset-bs-0 inset-e-0 h-1 w-full ${card.accent}`} aria-hidden="true" />
            <p className="text-caption font-semibold text-ink-55">{card.label}</p>
            <p className="mbs-3 font-mono text-h1 text-ink">{card.value}</p>
            <Link
              href={card.href}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-ink/15 bg-white/70 px-3 text-caption font-medium text-ink no-underline transition hover:border-gold-600 hover:bg-white hover:text-gold-700"
            >
              {card.action}
              <span aria-hidden="true">←</span>
            </Link>
          </article>
        ))}
      </div>

      <section className="mbs-10">
        <h2 className="text-h3 font-semibold text-navy-900">صحة المحتوى</h2>
        <p className="mbs-1 mbe-5 text-caption text-ink-55">ملخص حالات النشر في أقسام الموقع.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white bg-white/90 p-6 shadow-[0_14px_38px_rgb(20_33_63/0.06)]">
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
          <div className="rounded-2xl border border-white bg-white/90 p-6 shadow-[0_14px_38px_rgb(20_33_63/0.06)]">
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
        <h2 className="text-h3 font-semibold text-navy-900">آخر النشاط</h2>
        <p className="mbs-1 mbe-5 text-caption text-ink-55">أحدث العمليات المسجلة في لوحة التحكم.</p>
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
