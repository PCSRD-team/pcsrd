import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { removeMedia } from '@/actions/admin/catalog';
import { saveMediaForm } from '@/actions/admin/entity-forms';
import { adminDict, adminFormDict } from '@/components/admin/admin-dict';
import { ContentForm } from '@/components/admin/content-form';
import { MEDIA_FIELDS } from '@/components/admin/field-configs';
import { Flash } from '@/components/admin/flash';
import { AdminHeader } from '@/components/admin/shell';
import { Bidi } from '@/components/ui/bidi';
import { getAdminMedia, getMediaUsage } from '@/db/queries/admin';
import { requireAuth } from '@/lib/auth/guard';
import { publicEnv } from '@/lib/env.public';
import { formatDate, formatFileSize, storageUrl } from '@/lib/format';
import { can } from '@/services/_shared/permissions';

export const dynamic = 'force-dynamic';

/**
 * One media asset: its metadata form, where it is used, and delete.
 *
 * The usage list is not decoration. `deleteMedia` refuses an asset that is
 * referenced anywhere (05-ADMIN §5), so this is the list of what has to be
 * changed before the delete button does anything — and each entry links to
 * the record that holds the reference.
 */
export default async function MediaDetailPage({ params, searchParams }: PageProps<'/admin/media/[id]'>) {
  const [{ id }, search, actor] = await Promise.all([params, searchParams, requireAuth()]);

  const [asset, usage] = await Promise.all([getAdminMedia(actor, id), getMediaUsage(actor, id)]);
  if (!asset) notFound();

  const t = adminDict.media;
  const blocked = asset.hasIdentifiableMinors && asset.consent !== 'obtained';
  const canDelete = can(actor, 'media.delete');

  return (
    <>
      <AdminHeader
        title={asset.altAr}
        description={t.edit}
        action={
          <Link href="/admin/media" className="text-small">
            {adminDict.form.back}
          </Link>
        }
      />

      <Flash searchParams={search} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <ContentForm
            action={saveMediaForm}
            fields={MEDIA_FIELDS}
            values={{ ...asset, id: asset.id }}
            canPublish={false}
            includeSeo={false}
            bar="save"
            dict={adminFormDict()}
          />
        </div>

        <aside className="space-y-6">
          <div className={`rule-edge bg-paper p-4 ${blocked ? 'border-gold-600' : ''}`}>
            <div className="relative aspect-[4/3] bg-paper-alt">
              {asset.kind === 'image' ? (
                <Image
                  src={storageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, asset.bucket, asset.path)}
                  alt={asset.altAr}
                  fill
                  sizes="400px"
                  className="object-contain"
                />
              ) : (
                <div className="flex size-full items-center justify-center font-mono text-caption text-mono-muted">
                  <Bidi>{asset.mimeType}</Bidi>
                </div>
              )}
            </div>
            <dl className="mbs-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-caption">
              <dt className="text-ink-55">{t.file}</dt>
              <dd className="truncate font-mono">
                <Bidi>{asset.path}</Bidi>
              </dd>
              {asset.width ? (
                <>
                  <dt className="text-ink-55">{t.dimensions}</dt>
                  <dd className="font-mono">
                    <Bidi>{`${asset.width}×${asset.height}`}</Bidi>
                  </dd>
                </>
              ) : null}
              <dt className="text-ink-55">{t.size}</dt>
              <dd className="font-mono">
                <Bidi>{formatFileSize(asset.fileSize, 'ar')}</Bidi>
              </dd>
              <dt className="text-ink-55">{t.uploaded}</dt>
              <dd>
                <time dateTime={asset.createdAt.toISOString()}>
                  {formatDate(asset.createdAt, 'ar', { year: 'numeric', month: 'short', day: 'numeric' })}
                </time>
              </dd>
            </dl>
            {blocked ? (
              <p className="mbs-3 text-caption text-gold-700">
                {t.fields.hasIdentifiableMinors} — {t.consent[asset.consent]}
              </p>
            ) : null}
            {!asset.exifStripped && asset.kind === 'image' ? (
              <p className="mbs-1 text-caption text-gold-700">{t.exifNotStripped}</p>
            ) : null}
          </div>

          <section className="rule-edge bg-paper p-4">
            <h2 className="text-small font-semibold text-ink">{t.usage}</h2>
            <span className="rule-mark mbs-2 mbe-3 block" aria-hidden="true" />
            {usage.length === 0 ? (
              <p className="text-caption text-ink-55">{t.notUsed}</p>
            ) : (
              <ul className="space-y-2 text-caption">
                {usage.map((row, index) => {
                  const kind =
                    (t.usageEntity as Record<string, string>)[row.entityType] ?? row.entityType;
                  const text = row.title ? `${kind}: ${row.title}` : kind;
                  return (
                    <li key={`${row.entityType}-${row.entityId ?? 'org'}-${row.field}-${index}`}>
                      {row.href ? <Link href={row.href}>{text}</Link> : text}{' '}
                      <span className="font-mono text-mono-muted">
                        <Bidi>{row.field}</Bidi>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {canDelete ? (
            <section className="rule-edge border-gold-600 bg-paper p-4">
              <h2 className="text-small font-semibold text-ink">{t.delete}</h2>
              <p className="mbs-2 text-caption text-ink-55">
                {usage.length > 0 ? t.usageHint : t.deleteHint}
              </p>
              {usage.length === 0 ? (
                <details className="mbs-3">
                  <summary className="rule-edge inline-block cursor-pointer list-none px-3 py-1 text-caption text-ink hover:bg-paper-alt">
                    {adminDict.form.delete}
                  </summary>
                  <form action={removeMedia} className="mbs-3">
                    <input type="hidden" name="id" value={asset.id} />
                    <input type="hidden" name="returnTo" value={`/admin/media/${asset.id}`} />
                    <button
                      type="submit"
                      className="rule-edge border-gold-600 px-3 py-1 text-caption text-gold-700 hover:bg-gold-050"
                    >
                      {adminDict.form.confirmDelete}
                    </button>
                  </form>
                </details>
              ) : null}
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}
