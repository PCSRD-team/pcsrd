import { notFound } from 'next/navigation';
import { saveApplicationField } from '@/actions/admin/application-forms';
import { adminDict, adminFormDict } from '@/components/admin/admin-dict';
import { adminUi } from '@/components/admin/admin-ui-dict';
import { FieldEditor } from '@/components/admin/field-editor';
import { AdminHeader } from '@/components/admin/shell';
import { ButtonLink } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { db } from '@/db';
import { requireAuth } from '@/lib/auth/guard';
import { isAppError } from '@/lib/errors';
import { getForm } from '@/services/applications/application-form.service';

export const dynamic = 'force-dynamic';

/**
 * Editing one field.
 *
 * Works for a catalogue field as well as a custom one. A catalogue field keeps
 * its provenance through an edit: the vetted `config.pattern` is carried over
 * by the service and is the one property this screen cannot touch, so the
 * label, the hint and the required flag are all that change.
 *
 * The key is read-only once applications exist, and the notice says so before
 * the edit rather than after it: an editor who has already retyped a key and
 * lost the change is being told too late.
 */
export default async function EditFieldPage({
  params,
}: PageProps<'/admin/careers/[id]/fields/[fieldId]'>) {
  const [actor, { id, fieldId }] = await Promise.all([requireAuth(), params]);

  const form = await getForm(db, actor, id).catch((error) => {
    if (isAppError(error) && error.code === 'not_found') notFound();
    throw error;
  });

  const field = form.fields.find((candidate) => candidate.id === fieldId);
  if (!field) notFound();

  const t = adminUi.careers;
  const locked = form.applicationCount > 0;

  return (
    <>
      <AdminHeader
        title={`${t.editField}: ${field.labelAr}`}
        description={form.titleAr}
        action={
          <ButtonLink href={`/admin/careers/${form.id}`} tone="quiet">
            {adminDict.form.back}
          </ButtonLink>
        }
      />

      {locked ? (
        <Notice tone="warning" className="mbe-6">
          {t.fieldKeyHint}
        </Notice>
      ) : null}

      <FieldEditor
        action={saveApplicationField}
        dict={adminFormDict()}
        slug={form.slug}
        siblings={form.fields}
        keyLocked={locked}
        values={{ ...field, formId: form.id }}
      />
    </>
  );
}
