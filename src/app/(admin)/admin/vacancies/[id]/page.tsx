import { notFound } from 'next/navigation';
import { saveVacancyForm } from '@/actions/admin/entity-forms';
import { adminFormDict } from '@/components/admin/admin-dict';
import { ContentForm } from '@/components/admin/content-form';
import { VACANCY_FIELDS } from '@/components/admin/field-configs';
import { Flash } from '@/components/admin/flash';
import { DeleteAction } from '@/components/admin/row-actions';
import { AdminHeader } from '@/components/admin/shell';
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
  const title = String(values.titleAr ?? 'وظيفة');
  // `posted_at` is set once on creation and never posted by the form — the
  // service keeps it. Shown here so the editor can see what the site shows.
  const postedAt = typeof values.postedAt === 'string' ? values.postedAt : null;

  return (
    <>
      <AdminHeader title={title} description={postedAt ? `نُشرت في ${postedAt}` : undefined} />

      <Flash searchParams={search} />

      <ContentForm
        action={saveVacancyForm}
        fields={VACANCY_FIELDS}
        values={values}
        canPublish={can(actor, 'content.publish')}
        includeSeo={true}
        dict={adminFormDict()}
      />

      {/* Its own form, outside the editor: a form cannot nest in a form. */}
      <div className="mbs-8">
        <DeleteAction
          entity="vacancy"
          id={id}
          status={values.status as ContentStatus}
          actor={actor}
          returnTo="/admin/vacancies"
          label={title}
        />
      </div>
    </>
  );
}
