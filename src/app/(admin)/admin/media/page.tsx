import Image from 'next/image';
import Link from 'next/link';
import { adminDict } from '@/components/admin/admin-dict';
import { Pagination } from '@/components/admin/controls';
import { Flash } from '@/components/admin/flash';
import { MediaUploader } from '@/components/admin/media-uploader';
import { AdminHeader } from '@/components/admin/shell';
import { listAdminMedia } from '@/db/queries/admin';
import { requireAuth } from '@/lib/auth/guard';
import { publicEnv } from '@/lib/env.public';
import { formatFileSize, storageUrl } from '@/lib/format';

export const dynamic = 'force-dynamic';

const CONSENT_LABEL: Record<string, string> = {
  not_required: 'غير مطلوبة',
  obtained: 'مُوثَّقة',
  pending: 'قيد الانتظار',
};

export default async function MediaPage({ searchParams }: PageProps<'/admin/media'>) {
  const [actor, search] = await Promise.all([requireAuth(), searchParams]);
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const needsConsent = one(search.needsConsent) === '1';
  const q = one(search.q)?.trim() || undefined;
  const page = Number(one(search.page));

  const result = await listAdminMedia(actor, {
    search: q,
    needsConsent,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  });

  return (
    <>
      <AdminHeader title="مكتبة الوسائط" description={`${result.total} ملف`} />

      <Flash searchParams={search} />

      <MediaUploader />

      <form method="get" className="mbs-7 mbe-5 grid items-end gap-4 rounded-2xl border border-white bg-white/75 p-4 shadow-[0_10px_28px_rgb(20_33_63/0.05)] md:grid-cols-[minmax(240px,1fr)_auto_auto]">
        <div className="space-y-2">
          <label htmlFor="q" className="block text-caption font-medium text-ink">
            بحث في النص البديل
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q ?? ''}
            placeholder="اكتب وصف الصورة…"
            className="block min-h-11 w-full rounded-xl border border-rule bg-white px-3 py-2 text-small text-ink outline-none focus:border-navy-700 focus:shadow-[0_0_0_4px_rgb(37_66_132/0.10)]"
          />
        </div>
        <label className="flex min-h-11 items-center gap-3 rounded-xl border border-rule bg-paper-alt/60 px-4 text-small text-ink">
          <input
            type="checkbox"
            name="needsConsent"
            value="1"
            defaultChecked={needsConsent}
            className="size-5 rounded accent-navy-700"
          />
          تنتظر موافقة فقط
        </label>
        <button type="submit" className="min-h-11 rounded-xl bg-navy-700 px-6 text-small font-medium text-paper hover:bg-navy-900">
          تصفية
        </button>
      </form>

      {result.items.length === 0 ? (
        <div className="rounded-2xl border border-white bg-white/75 p-10 text-center shadow-[0_12px_32px_rgb(20_33_63/0.05)]">
          <p className="text-small text-ink-55">لا وسائط.</p>
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {result.items.map((asset) => {
            const blocked = asset.hasIdentifiableMinors && asset.consent !== 'obtained';

            return (
              <li
                key={asset.id}
                className={`group flex min-h-full flex-col overflow-hidden rounded-2xl border bg-white p-3 shadow-[0_10px_28px_rgb(20_33_63/0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgb(20_33_63/0.10)] ${blocked ? 'border-gold-600' : 'border-white'}`}
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-paper-alt">
                  {asset.kind === 'image' ? (
                    <Image
                      src={storageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, asset.bucket, asset.path)}
                      alt={asset.altAr}
                      fill
                      sizes="240px"
                      className="object-cover transition duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center font-mono text-caption text-mono-muted">
                      {asset.mimeType}
                    </div>
                  )}
                </div>

                <div className="mbs-3 flex items-center gap-2">
                  <span className="rounded-full bg-navy-100 px-2.5 py-1 text-eyebrow font-medium text-navy-700">{asset.kind === 'image' ? 'صورة' : 'مستند'}</span>
                  <span className="text-eyebrow text-ink-55">{formatFileSize(asset.fileSize, 'ar')}</span>
                </div>
                <p className="line-clamp-2 min-h-10 text-caption font-medium leading-relaxed text-ink">{asset.altAr}</p>
                <p className="mbs-2 font-mono text-eyebrow text-mono-muted" dir="ltr">
                  {asset.width ? `${asset.width}×${asset.height}` : asset.mimeType}
                </p>

                {/*
                  The consent state is on the card, not behind a click. An asset
                  that will refuse a publish has to be visible as such while
                  someone is choosing an image — not at the moment they publish.
                */}
                {asset.hasIdentifiableMinors ? (
                  <p className={`mbs-2 text-eyebrow ${blocked ? 'text-gold-700' : 'text-ink-55'}`}>
                    يظهر فيها قُصّر — الموافقة {CONSENT_LABEL[asset.consent]}
                  </p>
                ) : null}

                {!asset.exifStripped && asset.kind === 'image' ? (
                  <p className="mbs-1 text-eyebrow text-gold-700">بيانات EXIF لم تُجرَّد</p>
                ) : null}

                {/* The id is what a content form's media field takes. */}
                <p className="mbs-auto overflow-hidden text-ellipsis whitespace-nowrap border-bs border-rule pbs-2 font-mono text-eyebrow text-mono-muted" dir="ltr" title={asset.id}>
                  {asset.id}
                </p>
                <Link
                  href={`/admin/media/${asset.id}`}
                  className="mbs-2 inline-block rule-edge px-3 py-1 text-caption text-ink no-underline hover:bg-paper-alt"
                >
                  {adminDict.media.openDetail}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        hrefFor={(n) => (n > 1 ? `/admin/media?page=${n}` : '/admin/media')}
      />
    </>
  );
}
