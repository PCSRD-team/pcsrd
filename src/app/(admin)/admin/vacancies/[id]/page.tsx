import { notFound } from 'next/navigation';
import { createVacancyApplicationForm } from '@/actions/admin/application-forms';
import { saveVacancyForm } from '@/actions/admin/entity-forms';
import { adminFormDict } from '@/components/admin/admin-dict';
import { adminUi, fill } from '@/components/admin/admin-ui-dict';
import { ContentForm } from '@/components/admin/content-form';
import { StatusBadge } from '@/components/admin/controls';
import { VACANCY_FIELDS } from '@/components/admin/field-configs';
import { Flash } from '@/components/admin/flash';
import { DeletePanel } from '@/components/admin/row-actions';
import { AdminHeader } from '@/components/admin/shell';
import { Badge } from '@/components/ui/badge';
import { Bidi } from '@/components/ui/bidi';
import { Button, ButtonLink } from '@/components/ui/button';
import { Panel } from '@/components/ui/card';
import { Cluster } from '@/components/ui/layout';
import { Caption, Heading, Meta } from '@/components/ui/typography';
import { getAdminRow } from '@/db/queries/admin';
import { getFormForVacancy } from '@/db/queries/admin/applications';
import type { ContentStatus } from '@/db/schema/enums';
import { requireAuth } from '@/lib/auth/guard';
import { can } from '@/services/_shared/permissions';

export const dynamic = 'force-dynamic';

export default async function Page({ params, searchParams }: PageProps<'/admin/vacancies/[id]'>) {
  const [{ id }, search, actor] = await Promise.all([params, searchParams, requireAuth()]);

  const row = await getAdminRow(actor, 'vacancy', id);
  if (!row) notFound();
  const values = row as Record<string, unknown>;
  const title = String(values.titleAr ?? adminUi.entity.fallbackVacancy);
  const status = values.status as ContentStatus;
  // Also an editable field on the form below; repeated in the header because
  // it is what the public page shows as the posting date.
  const postedAt = typeof values.postedAt === 'string' ? values.postedAt : null;

  return (
    <>
      <AdminHeader
        title={title}
        meta={
          <Cluster gap={3}>
            <StatusBadge status={status} />
            {postedAt ? (
              <Meta as="span">
                {adminUi.entity.postedAt} <Bidi>{postedAt}</Bidi>
              </Meta>
            ) : null}
          </Cluster>
        }
      />

      <Flash searchParams={search} />

      <ContentForm
        action={saveVacancyForm}
        fields={VACANCY_FIELDS}
        values={values}
        canPublish={can(actor, 'content.publish')}
        includeSeo={true}
        dict={adminFormDict()}
      />

      <VacancyFormPanel
        vacancyId={id}
        byEmail={values.applicationMethod === 'email'}
        form={await getFormForVacancy(actor, id)}
      />

      <DeletePanel entity="vacancy" id={id} status={status} actor={actor} returnTo="/admin/vacancies" label={title} />
    </>
  );
}

/**
 * Where the vacancy meets the careers portal — the one place its applications
 * are received. The vacancy says what the job is; the form, one click away,
 * says what to ask and collects the answers.
 */
function VacancyFormPanel({
  vacancyId,
  byEmail,
  form,
}: {
  vacancyId: string;
  byEmail: boolean;
  form: Awaited<ReturnType<typeof getFormForVacancy>>;
}) {
  const t = adminUi.careers;

  return (
    <Panel as="section" tone="paper" padding="sm" className="mbs-8" labelledBy="vacancy-form">
      <Heading level={2} size="h4" id="vacancy-form">
        {t.vacancyForm}
      </Heading>

      {form ? (
        <>
          <Caption className="mbs-1 mbe-3">{t.vacancyFormBody}</Caption>
          <Cluster gap={2} className="mbe-3">
            <StatusBadge status={form.status} />
            <Badge tone="neutral">{fill(t.applicantCount, { n: form.applicationCount })}</Badge>
            {form.newCount > 0 ? (
              <Badge tone="accent">{fill(t.newApplicantCount, { n: form.newCount })}</Badge>
            ) : null}
          </Cluster>
          <Cluster gap={2}>
            <ButtonLink href={`/admin/careers/${form.id}`} size="sm">
              {t.manageForm}
            </ButtonLink>
            <ButtonLink href={`/admin/careers/${form.id}/applicants`} tone="secondary" size="sm">
              {t.applicants}
            </ButtonLink>
          </Cluster>
        </>
      ) : byEmail ? (
        <Caption className="mbs-1">{t.vacancyFormByEmail}</Caption>
      ) : (
        <>
          <Caption className="mbs-1 mbe-3">{t.vacancyFormNone}</Caption>
          <form action={createVacancyApplicationForm}>
            <input type="hidden" name="vacancyId" value={vacancyId} />
            <Button type="submit" size="sm">
              {t.createVacancyForm}
            </Button>
          </form>
        </>
      )}
    </Panel>
  );
}
