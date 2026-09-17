import Image from 'next/image';
import { adminDict } from '@/components/admin/admin-dict';
import { adminUi, fill } from '@/components/admin/admin-ui-dict';
import { AdminPagination } from '@/components/admin/controls';
import { Flash } from '@/components/admin/flash';
import { MediaUploader } from '@/components/admin/media-uploader';
import { AdminHeader } from '@/components/admin/shell';
import { Badge } from '@/components/ui/badge';
import { Bidi, Code } from '@/components/ui/bidi';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardFooter, CardMedia } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Field } from '@/components/ui/field';
import { Checkbox, Input } from '@/components/ui/inputs';
import { Cluster, Grid } from '@/components/ui/layout';
import { Caption, Meta } from '@/components/ui/typography';
import { listAdminMedia } from '@/db/queries/admin';
import { requireAuth } from '@/lib/auth/guard';
import { publicEnv } from '@/lib/env.public';
import { formatFileSize, storageUrl } from '@/lib/format';

export const dynamic = 'force-dynamic';

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

  const t = adminUi.media;
  const consentLabel = adminDict.media.consent;

  return (
    <>
      <AdminHeader title={t.title} description={fill(t.fileCount, { n: result.total })} />

      <Flash searchParams={search} />

      <MediaUploader />

      <form method="get" className="mbs-8 mbe-6">
        <Cluster gap={3} align="end">
          <Field name="q" label={t.search} className="min-w-64 flex-1">
            <Input name="q" type="search" defaultValue={q ?? ''} placeholder={t.searchPlaceholder} />
          </Field>
          <Checkbox name="needsConsent" value="1" label={t.needsConsent} defaultChecked={needsConsent} />
          <Button type="submit" tone="secondary">
            {adminUi.list.filter}
          </Button>
        </Cluster>
      </form>

      {result.items.length === 0 ? (
        <EmptyState title={t.empty} body={t.emptyBody} />
      ) : (
        <Grid as="ul" cols={4} gap={5}>
          {result.items.map((asset) => {
            const blocked = asset.hasIdentifiableMinors && asset.consent !== 'obtained';

            return (
              <Card
                key={asset.id}
                as="li"
                padding="sm"
                accent={blocked ? 'var(--color-destructive)' : undefined}
              >
                <CardMedia ratio="wide" className="-mx-4 -mbs-4 mbe-4 md:-mx-4 md:-mbs-4">
                  {asset.kind === 'image' ? (
                    <Image
                      src={storageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, asset.bucket, asset.path)}
                      alt={asset.altAr}
                      fill
                      sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-paper-alt">
                      <Code className="text-caption text-mono-muted">{asset.mimeType}</Code>
                    </div>
                  )}
                </CardMedia>

                <CardBody>
                  <Cluster gap={2}>
                    <Badge tone={asset.kind === 'image' ? 'info' : 'neutral'}>
                      {asset.kind === 'image' ? t.image : t.document}
                    </Badge>
                    <Meta as="span">{formatFileSize(asset.fileSize, 'ar')}</Meta>
                  </Cluster>
                  <p className="mbs-2 line-clamp-2 text-caption font-medium text-ink">{asset.altAr}</p>
                  <Meta className="mbs-1">
                    <Bidi>{asset.width ? `${asset.width}×${asset.height}` : asset.mimeType}</Bidi>
                  </Meta>

                  {/*
                    The consent state is on the card, not behind a click. An asset
                    that will refuse a publish has to be visible as such while
                    someone is choosing an image — not at the moment they publish.
                  */}
                  {asset.hasIdentifiableMinors ? (
                    <Caption className={blocked ? 'mbs-2 text-destructive' : 'mbs-2'}>
                      {fill(t.minorsConsent, { status: consentLabel[asset.consent] })}
                    </Caption>
                  ) : null}

                  {!asset.exifStripped && asset.kind === 'image' ? (
                    <Caption className="mbs-1 text-destructive">{adminDict.media.exifNotStripped}</Caption>
                  ) : null}
                </CardBody>

                <CardFooter className="mbs-4">
                  {/* The id is what a content form's media field takes. */}
                  <Code className="min-w-0 truncate text-eyebrow text-mono-muted">{asset.id}</Code>
                  <ButtonLink href={`/admin/media/${asset.id}`} tone="secondary" size="sm">
                    {adminDict.media.openDetail}
                  </ButtonLink>
                </CardFooter>
              </Card>
            );
          })}
        </Grid>
      )}

      <AdminPagination
        page={result.page}
        totalPages={result.totalPages}
        hrefFor={(n) => (n > 1 ? `/admin/media?page=${n}` : '/admin/media')}
      />
    </>
  );
}
