import Image from 'next/image';
import { Pagination } from '@/components/admin/controls';
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

      <MediaUploader />

      <form method="get" className="mbs-8 mbe-6 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="q" className="eyebrow">
            بحث في النص البديل
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q ?? ''}
            className="rule-edge mbs-1 bg-paper px-3 py-2 text-small"
          />
        </div>
        <label className="flex items-center gap-2 text-small">
          <input
            type="checkbox"
            name="needsConsent"
            value="1"
            defaultChecked={needsConsent}
            className="size-4 accent-navy-700"
          />
          تنتظر موافقة فقط
        </label>
        <button type="submit" className="rule-edge px-4 py-2 text-small hover:bg-paper-alt">
          تصفية
        </button>
      </form>

      {result.items.length === 0 ? (
        <div className="rule-edge bg-paper-alt p-10 text-center">
          <p className="text-small text-ink-55">لا وسائط.</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {result.items.map((asset) => {
            const blocked = asset.hasIdentifiableMinors && asset.consent !== 'obtained';

            return (
              <li
                key={asset.id}
                className={`rule-edge bg-paper p-3 ${blocked ? 'border-gold-600' : ''}`}
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-paper-alt">
                  {asset.kind === 'image' ? (
                    <Image
                      src={storageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, asset.bucket, asset.path)}
                      alt={asset.altAr}
                      fill
                      sizes="240px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center font-mono text-caption text-mono-muted">
                      {asset.mimeType}
                    </div>
                  )}
                </div>

                <p className="mbs-3 line-clamp-2 text-caption text-ink">{asset.altAr}</p>
                <p className="mbs-1 font-mono text-eyebrow text-mono-muted" dir="ltr">
                  {formatFileSize(asset.fileSize, 'ar')}
                  {asset.width ? ` · ${asset.width}×${asset.height}` : ''}
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
                <p className="mbs-2 font-mono text-eyebrow text-mono-muted" dir="ltr">
                  {asset.id}
                </p>
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
