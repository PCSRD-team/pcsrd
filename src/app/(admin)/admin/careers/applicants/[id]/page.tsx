import { notFound } from 'next/navigation';
import { deleteApplicant, reviewApplicant } from '@/actions/admin/applications';
import { adminDict, adminFormDict } from '@/components/admin/admin-dict';
import { adminUi, fill } from '@/components/admin/admin-ui-dict';
import { DateCell } from '@/components/admin/controls';
import { Flash } from '@/components/admin/flash';
import { ApplicantReview } from '@/components/admin/applicant-review';
import { AdminHeader } from '@/components/admin/shell';
import { Badge } from '@/components/ui/badge';
import { Bidi } from '@/components/ui/bidi';
import { Button, ButtonLink } from '@/components/ui/button';
import { Panel } from '@/components/ui/card';
import { DefinitionList } from '@/components/ui/definition-list';
import { Cluster, Stack } from '@/components/ui/layout';
import { Table } from '@/components/ui/table';
import { Eyebrow } from '@/components/ui/typography';
import { db } from '@/db';
import type { ApplicationFormField } from '@/db/schema/applications';
import { requireAuth } from '@/lib/auth/guard';
import { isAppError } from '@/lib/errors';
import { getApplication } from '@/services/applications/application.service';

export const dynamic = 'force-dynamic';

/**
 * One applicant.
 *
 * The answers are rendered against the form's **current** fields, so each one
 * gets its label, its order and its option labels rather than a raw key and a
 * raw value. An answer whose field has since been deleted still appears, under
 * its key, marked as a deleted field — dropping it would quietly hide a real
 * answer a real person gave, and the reviewer has no other way to see it.
 */
export default async function ApplicantPage({
  params,
  searchParams,
}: PageProps<'/admin/careers/applicants/[id]'>) {
  const [actor, { id }, search] = await Promise.all([requireAuth(), params, searchParams]);

  const application = await getApplication(db, actor, id).catch((error) => {
    if (isAppError(error) && error.code === 'not_found') notFound();
    throw error;
  });

  const t = adminUi.careers;
  const byKey = new Map(application.fields.map((field) => [field.key, field]));

  // The form's own order first, then anything answered under a key the form no
  // longer declares.
  const answered = application.fields
    .filter((field) => field.type !== 'section' && field.key in application.answers)
    .map((field) => ({ field, key: field.key }));

  const orphaned = Object.keys(application.answers)
    .filter((key) => !byKey.has(key))
    .map((key) => ({ field: null, key }));

  return (
    <>
      <AdminHeader
        title={application.applicantName ?? application.reference}
        description={application.form.titleAr}
        meta={
          <Cluster gap={2}>
            <Badge tone={application.status === 'new' ? 'accent' : 'neutral'}>
              {t.status[application.status]}
            </Badge>
            {application.waitlisted ? <Badge tone="warning">{t.waitlisted}</Badge> : null}
            <span className="font-mono text-caption text-ink-55" dir="ltr">
              {application.reference}
            </span>
          </Cluster>
        }
        action={
          <ButtonLink href={`/admin/careers/${application.form.id}/applicants`} tone="quiet">
            {adminDict.form.back}
          </ButtonLink>
        }
      />

      <Flash searchParams={search} />

      <Stack gap={8}>
        <Panel tone="alt" padding="sm">
          <DefinitionList
            items={[
              { term: t.applicantEmail, value: <Bidi>{application.applicantEmail ?? '—'}</Bidi> },
              { term: t.applicantPhone, value: <Bidi>{application.applicantPhone ?? '—'}</Bidi> },
              { term: t.submittedAt, value: <DateCell value={application.createdAt} /> },
              { term: t.retentionMonths, value: <Bidi>{String(application.purgeAfter)}</Bidi> },
            ]}
          />
        </Panel>

        {application.attachments.length > 0 ? (
          <section>
            <Eyebrow className="mbe-3">
              {fill(t.attachmentCount, { n: application.attachments.length })}
            </Eyebrow>
            <Stack gap={2}>
              {application.attachments.map((file) => (
                <Cluster key={file.path} gap={3}>
                  <span className="text-small text-ink">
                    {byKey.get(file.fieldKey)?.labelAr ?? file.fieldKey}
                  </span>
                  {/* A signed URL, minted on click and valid for sixty seconds.
                      Minting it here would put a live link to a stranger's ID
                      copy into the page's HTML. */}
                  <ButtonLink
                    href={`/api/admin/careers/applicants/${application.id}/attachment?path=${encodeURIComponent(file.path)}`}
                    tone="quiet"
                    external
                  >
                    <Bidi>{file.originalName}</Bidi>
                  </ButtonLink>
                  <span className="font-mono text-caption text-ink-55" dir="ltr">
                    {Math.round(file.size / 1024)} KB
                  </span>
                </Cluster>
              ))}
            </Stack>
          </section>
        ) : null}

        <section>
          <Eyebrow className="mbe-3">{t.answers}</Eyebrow>
          <DefinitionList
            items={[...answered, ...orphaned].map(({ field, key }) => ({
              term: field ? field.labelAr : `${key} (${t.deletedField})`,
              value: renderAnswer(application.answers[key], field),
            }))}
          />
        </section>

        <section>
          <Eyebrow className="mbe-3">{t.history}</Eyebrow>
          <Table
            caption={t.history}
            captionHidden
            rows={application.events}
            columns={[
              {
                key: 'to',
                header: adminUi.list.status,
                cell: (row) => t.status[row.toStatus],
              },
              {
                key: 'from',
                header: t.history,
                cell: (row) => (row.fromStatus ? t.status[row.fromStatus] : '—'),
              },
              { key: 'note', header: t.internalNote, cell: (row) => row.note ?? '—' },
              {
                key: 'at',
                header: t.submittedAt,
                numeric: true,
                cell: (row) => <DateCell value={row.createdAt} />,
              },
            ]}
            empty="—"
          />
        </section>

        <ApplicantReview
          action={reviewApplicant}
          dict={adminFormDict()}
          values={{
            id: application.id,
            status: application.status,
            rating: application.rating,
            internalNote: application.internalNote,
          }}
          returnTo={`/admin/careers/applicants/${application.id}`}
        />

        {/* Erasure. Its own form, at the bottom, away from the review buttons:
            a destructive action beside a routine one is a misclick waiting to
            happen. */}
        <Panel tone="alt" padding="sm">
          <form action={deleteApplicant}>
            <input type="hidden" name="id" value={application.id} />
            <input type="hidden" name="formId" value={application.form.id} />
            <Stack gap={2}>
              <p className="text-caption text-ink-70">{t.deleteApplicantConfirm}</p>
              <div>
                <Button type="submit" tone="danger" size="sm">
                  {t.deleteApplicant}
                </Button>
              </div>
            </Stack>
          </form>
        </Panel>
      </Stack>
    </>
  );
}

/**
 * One answer, as the reviewer should read it.
 *
 * Option values are machine keys — `khan_younis`, not `خان يونس` — so a select
 * or a checkbox group is mapped back through its own options. A value that is
 * no longer among them is shown raw rather than dropped: the applicant did
 * answer, and an option removed from the form afterwards is the form's change,
 * not theirs.
 */
function renderAnswer(value: unknown, field: ApplicationFormField | null) {
  if (value === null || value === undefined || value === '') return adminUi.careers.noAnswer;

  const label = (raw: string) =>
    field?.options.find((option) => option.value === raw)?.labelAr ?? raw;

  if (typeof value === 'boolean') return value ? adminUi.careers.yes : adminUi.careers.no;
  if (Array.isArray(value)) {
    return value.length === 0
      ? adminUi.careers.noAnswer
      : value.map((entry) => label(String(entry))).join('، ');
  }
  if (typeof value === 'number') return <Bidi>{String(value)}</Bidi>;

  const text = String(value);
  // A Latin run inside Arabic prose — an email, a URL, a licence number — is
  // reordered by the bidi algorithm without isolation. Rule 4.
  return /[A-Za-z0-9@._-]{4,}/.test(text) ? <Bidi>{label(text)}</Bidi> : label(text);
}
