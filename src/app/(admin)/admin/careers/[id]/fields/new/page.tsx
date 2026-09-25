import { notFound } from 'next/navigation';
import { saveApplicationField } from '@/actions/admin/application-forms';
import { adminDict, adminFormDict } from '@/components/admin/admin-dict';
import { adminUi } from '@/components/admin/admin-ui-dict';
import { FieldEditor } from '@/components/admin/field-editor';
import { AdminHeader } from '@/components/admin/shell';
import { ButtonLink } from '@/components/ui/button';
import { db } from '@/db';
import { requireAuth } from '@/lib/auth/guard';
import { isAppError } from '@/lib/errors';
import { getForm } from '@/services/applications/application-form.service';

export const dynamic = 'force-dynamic';

/**
 * A custom field.
 *
 * On its own screen rather than inline in the builder list: it has twenty
 * inputs, and twenty inputs inside a row of cards is a list nobody can scan.
 */
export default async function NewFieldPage({
  params,
}: PageProps<'/admin/careers/[id]/fields/new'>) {
  const [actor, { id }] = await Promise.all([requireAuth(), params]);

  const form = await getForm(db, actor, id).catch((error) => {
    if (isAppError(error) && error.code === 'not_found') notFound();
    throw error;
  });

  const t = adminUi.careers;

  return (
    <>
      <AdminHeader
        title={t.addCustomField}
        description={form.titleAr}
        action={
          <ButtonLink href={`/admin/careers/${form.id}`} tone="quiet">
            {adminDict.form.back}
          </ButtonLink>
        }
      />

      <FieldEditor
        action={saveApplicationField}
        dict={adminFormDict()}
        slug={form.slug}
        siblings={form.fields}
        keyLocked={false}
        values={{ formId: form.id }}
      />
    </>
  );
}
