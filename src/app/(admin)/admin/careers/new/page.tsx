import { createApplicationForm } from '@/actions/admin/application-forms';
import { adminFormDict } from '@/components/admin/admin-dict';
import { adminUi } from '@/components/admin/admin-ui-dict';
import { ApplicationFormEditor } from '@/components/admin/application-form-editor';
import { AdminHeader } from '@/components/admin/shell';
import { Notice } from '@/components/ui/notice';
import { listVacancyOptions } from '@/db/queries/admin/applications';
import { requireAuth } from '@/lib/auth/guard';

export const dynamic = 'force-dynamic';

/**
 * A new application form.
 *
 * Settings only — the fields come next. A new form is created with the starter
 * set for its kind (`STARTER_FIELDS`, applied by the service), so the builder
 * on the following screen opens with the fields the kind almost always needs
 * rather than empty.
 */
export default async function NewCareersFormPage() {
  const actor = await requireAuth();
  const vacancyOptions = await listVacancyOptions(actor);
  const t = adminUi.careers;

  return (
    <>
      <AdminHeader title={t.newForm} description={t.description} />

      <Notice tone="info" className="mbe-6">
        {t.noFieldsBody}
      </Notice>

      <ApplicationFormEditor
        action={createApplicationForm}
        dict={adminFormDict()}
        vacancyOptions={vacancyOptions}
        values={{
          kind: 'job',
          slug: '',
          titleAr: '',
          titleEn: null,
          introAr: null,
          introEn: null,
          opensAt: null,
          closesAt: null,
          capacity: null,
          capacityRule: 'close',
          confirmationAr: null,
          confirmationEn: null,
          notifyEmails: [],
          retentionMonths: 12,
          allowMultiplePerEmail: false,
          requireConsent: true,
          vacancyId: null,
        }}
      />
    </>
  );
}
