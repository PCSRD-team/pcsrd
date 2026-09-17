import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { removeMedia } from '@/actions/admin/catalog';
import { saveMediaForm } from '@/actions/admin/entity-forms';
import { adminDict, adminFormDict } from '@/components/admin/admin-dict';
import { adminUi } from '@/components/admin/admin-ui-dict';
import { ContentForm } from '@/components/admin/content-form';
import { MEDIA_FIELDS } from '@/components/admin/field-configs';
import { Flash } from '@/components/admin/flash';
import { AdminHeader } from '@/components/admin/shell';
import { Bidi, Code, DateText } from '@/components/ui/bidi';
import { Button, ButtonLink, buttonClasses } from '@/components/ui/button';
import { Panel, RuledList, RuledListItem } from '@/components/ui/card';
import { DefinitionList } from '@/components/ui/definition-list';
import { Grid, Rule, Stack } from '@/components/ui/layout';
import { Notice } from '@/components/ui/notice';
import { Caption, Heading } from '@/components/ui/typography';
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
          <ButtonLink href="/admin/media" tone="quiet">
            {adminDict.form.back}
          </ButtonLink>
        }
      />

      <Flash searchParams={search} />

      <Grid cols="sidebar" gap={8}>
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

        <Stack as="aside" gap={6}>
          <Panel as="section" padding="sm" labelledBy="media-details" className={blocked ? 'border-destructive' : undefined}>
            <Heading level={2} size="h4" id="media-details" className="sr-only">
              {adminUi.media.details}
            </Heading>
            <div className="relative aspect-[4/3] bg-paper-alt">
              {asset.kind === 'image' ? (
                <Image
                  src={storageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, asset.bucket, asset.path)}
                  alt={asset.altAr}
                  fill
                  sizes="(min-width: 1024px) 33vw, 100vw"
                  className="object-contain"
                />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <Code className="text-caption text-mono-muted">{asset.mimeType}</Code>
                </div>
              )}
            </div>
            <DefinitionList
              layout="stack"
              className="mbs-4"
              items={[
                { term: t.file, value: <Code className="break-all text-caption">{asset.path}</Code> },
                {
                  term: t.dimensions,
                  value: asset.width ? <Code className="text-caption">{`${asset.width}×${asset.height}`}</Code> : null,
                },
                { term: t.size, value: <Bidi className="font-mono text-caption">{formatFileSize(asset.fileSize, 'ar')}</Bidi> },
                {
                  term: t.uploaded,
                  value: (
                    <time dateTime={asset.createdAt.toISOString()} className="text-caption">
                      <DateText locale="ar">
                        {formatDate(asset.createdAt, 'ar', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </DateText>
                    </time>
                  ),
                },
              ]}
            />
            {blocked ? (
              <Notice tone="warning" live="off" className="mbs-4">
                {t.fields.hasIdentifiableMinors} — {t.consent[asset.consent]}
              </Notice>
            ) : null}
            {!asset.exifStripped && asset.kind === 'image' ? (
              <Notice tone="warning" live="off" className="mbs-2">
                {t.exifNotStripped}
              </Notice>
            ) : null}
          </Panel>

          <Panel as="section" padding="sm" labelledBy="media-usage">
            <Heading level={2} size="h4" id="media-usage">
              {t.usage}
            </Heading>
            <Rule weight="mark" as="span" className="mbs-2 mbe-3" />
            {usage.length === 0 ? (
              <Caption>{t.notUsed}</Caption>
            ) : (
              <RuledList>
                {usage.map((row, index) => {
                  const kind =
                    (t.usageEntity as Record<string, string>)[row.entityType] ?? row.entityType;
                  const text = row.title ? `${kind}: ${row.title}` : kind;
                  return (
                    <RuledListItem
                      key={`${row.entityType}-${row.entityId ?? 'org'}-${row.field}-${index}`}
                      className="gap-2 text-caption"
                    >
                      {row.href ? <Link href={row.href}>{text}</Link> : text}
                      <Code className="text-mono-muted">{row.field}</Code>
                    </RuledListItem>
                  );
                })}
              </RuledList>
            )}
          </Panel>

          {canDelete ? (
            <Panel as="section" padding="sm" labelledBy="media-delete" className="border-destructive/40">
              <Heading level={2} size="h4" id="media-delete">
                {t.delete}
              </Heading>
              <Caption className="mbs-2">{usage.length > 0 ? t.usageHint : t.deleteHint}</Caption>
              {usage.length === 0 ? (
                <details className="mbs-3">
                  <summary
                    className={buttonClasses({ tone: 'secondary', size: 'sm', className: 'cursor-pointer list-none' })}
                  >
                    {adminDict.form.delete}
                  </summary>
                  <form action={removeMedia} className="mbs-3">
                    <input type="hidden" name="id" value={asset.id} />
                    <input type="hidden" name="returnTo" value={`/admin/media/${asset.id}`} />
                    <Button type="submit" size="sm" tone="danger">
                      {adminDict.form.confirmDelete}
                    </Button>
                  </form>
                </details>
              ) : null}
            </Panel>
          ) : null}
        </Stack>
      </Grid>
    </>
  );
}
