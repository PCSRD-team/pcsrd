import { adminUi } from '@/components/admin/admin-ui-dict';
import { DateCell, STATUS_LABEL } from '@/components/admin/controls';
import { AdminHeader } from '@/components/admin/shell';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardFooter } from '@/components/ui/card';
import { DefinitionList } from '@/components/ui/definition-list';
import { EmptyState } from '@/components/ui/feedback';
import { Cluster, Grid, Section, SectionHeading } from '@/components/ui/layout';
import { Table } from '@/components/ui/table';
import { Caption, Eyebrow, Meta } from '@/components/ui/typography';
import { getDashboard } from '@/db/queries/admin';
import { requireAuth } from '@/lib/auth/guard';

export const dynamic = 'force-dynamic';

/**
 * The dashboard.
 *
 * The count tiles are `Card` + `Meta`, not `Stat`: a `Stat` is an impact
 * figure locked to a period and a verification status, and "new submissions
 * today" is neither — it is an operational count that points at a screen.
 */
export default async function DashboardPage() {
  const actor = await requireAuth();
  const data = await getDashboard(actor);
  const t = adminUi.dashboard;

  const published = data.content.filter((row) => row.status === 'published');
  const drafts = data.content.filter((row) => row.status !== 'published');
  const entityLabel = (entity: string) =>
    (t.entities as Record<string, string>)[entity] ?? entity;
  const statusLabel = (status: string) =>
    (STATUS_LABEL as Record<string, string>)[status] ?? status;

  const cards: {
    label: string;
    value: number;
    href: string;
    action: string;
    accent: string;
  }[] = [
    {
      label: t.newSubmissions,
      value: data.newSubmissions,
      href: '/admin/submissions',
      action: t.openInbox,
      accent: 'var(--color-navy-700)',
    },
    ...(actor.canViewSensitive
      ? [
          {
            label: t.sensitiveNew,
            value: data.sensitiveNew,
            href: '/admin/submissions/sensitive',
            action: t.open,
            accent: 'var(--color-destructive)',
          },
        ]
      : []),
    {
      label: t.consentGaps,
      value: data.consentGaps,
      href: '/admin/media?needsConsent=1',
      action: t.review,
      accent: data.consentGaps > 0 ? 'var(--color-gold-600)' : 'var(--color-ink)',
    },
  ];

  return (
    <>
      <AdminHeader
        title={t.title}
        description={t.lede}
        action={
          <Cluster gap={2}>
            <ButtonLink href="/admin/posts/new" size="sm">
              {t.newPost}
            </ButtonLink>
            <ButtonLink href="/admin/media" tone="secondary" size="sm">
              {t.uploadImage}
            </ButtonLink>
          </Cluster>
        }
      />

      <Grid as="ul" cols={3} gap={4}>
        {cards.map((card) => (
          <Card key={card.label} as="li" accent={card.accent} padding="md">
            <CardBody>
              <Eyebrow>{card.label}</Eyebrow>
              <Meta className="mbs-3 text-h1 text-ink">{card.value}</Meta>
            </CardBody>
            <CardFooter>
              <ButtonLink href={card.href} tone="quiet" size="sm">
                {card.action}
              </ButtonLink>
            </CardFooter>
          </Card>
        ))}
      </Grid>

      <Section bounded spacing="tight" labelledBy="dashboard-health" className="mbs-10">
        <SectionHeading as="h2" id="dashboard-health" title={t.health} lead={t.healthLede} />
        <Grid cols={2} gap={4}>
          <Card as="div" padding="md">
            <Eyebrow className="mbe-3">{t.published}</Eyebrow>
            {published.length ? (
              <DefinitionList
                layout="ruled"
                items={published.map((row) => ({
                  term: entityLabel(row.entity),
                  value: <Meta as="span">{row.n}</Meta>,
                }))}
              />
            ) : (
              <Caption>{t.nothing}</Caption>
            )}
          </Card>
          <Card as="div" padding="md">
            <Eyebrow className="mbe-3">{t.unpublished}</Eyebrow>
            {drafts.length ? (
              <DefinitionList
                layout="ruled"
                items={drafts.map((row) => ({
                  term: `${entityLabel(row.entity)} — ${statusLabel(row.status)}`,
                  value: <Meta as="span">{row.n}</Meta>,
                }))}
              />
            ) : (
              <Caption>{t.nothing}</Caption>
            )}
          </Card>
        </Grid>
      </Section>

      <Section bounded spacing="tight" labelledBy="dashboard-activity">
        <SectionHeading as="h2" id="dashboard-activity" title={t.activity} lead={t.activityLede} />
        <Table
          caption={t.activity}
          captionHidden
          rows={data.recentAudit}
          empty={<EmptyState title={t.noActivity} body={t.activityLede} />}
          columns={[
            {
              key: 'action',
              header: adminUi.audit.columns.action,
              cell: (r) => (adminUi.audit.actions as Record<string, string>)[r.action] ?? r.action,
            },
            { key: 'entity', header: adminUi.audit.columns.entity, cell: (r) => r.entityType },
            {
              key: 'actor',
              header: adminUi.audit.columns.actor,
              cell: (r) => r.actorName ?? adminUi.audit.system,
            },
            {
              key: 'at',
              header: adminUi.audit.columns.at,
              numeric: true,
              align: 'start',
              cell: (r) => <DateCell value={r.createdAt} />,
            },
          ]}
        />
      </Section>
    </>
  );
}
