import { notFound } from 'next/navigation';
import { saveVacancyForm } from '@/actions/admin/entity-forms';
import { adminFormDict } from '@/components/admin/admin-dict';
import { adminUi } from '@/components/admin/admin-ui-dict';
import { ContentForm } from '@/components/admin/content-form';
import { StatusBadge } from '@/components/admin/controls';
import { VACANCY_FIELDS } from '@/components/admin/field-configs';
import { Flash } from '@/components/admin/flash';
import { DeletePanel } from '@/components/admin/row-actions';
import { AdminHeader } from '@/components/admin/shell';
import { Bidi } from '@/components/ui/bidi';
import { Cluster } from '@/components/ui/layout';
import { Meta } from '@/components/ui/typography';
import { getAdminRow } from '@/db/queries/admin';
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

      <DeletePanel entity="vacancy" id={id} status={status} actor={actor} returnTo="/admin/vacancies" label={title} />
    </>
  );
}
