import { notFound } from 'next/navigation';
import { updateSubmissionState } from '@/actions/admin/catalog';
import { DataTable } from '@/components/admin/controls';
import { AdminHeader } from '@/components/admin/shell';
import { STATE_LABEL, TYPE_LABEL } from '@/components/admin/submission-list';
import { Bidi } from '@/components/ui/bidi';
import { db } from '@/db';
import { requireAuth } from '@/lib/auth/guard';
import { isAppError } from '@/lib/errors';
import { getSubmission } from '@/services/submission/submission.service';
import { submissionState } from '@/db/schema/enums';

export const dynamic = 'force-dynamic';

/**
 * One submission.
 *
 * `getSubmission` is what enforces access: it refuses an actor without
 * `submissions.read`, refuses a sensitive row to an actor without
 * `canViewSensitive`, decrypts the payload only when permitted, and **writes an
 * audit entry for every sensitive read**. This page renders what that service
 * returns and adds nothing to the decision.
 *
 * There is no attachment link for a confidential complaint. `02-API §6.5` and
 * `05-ADMIN §7` disagree; the stricter one wins, and the route handler refuses
 * it as well — a file that leaves the audited system is a file outside every
 * protection the rest of this design provides.
 */
export default async function SubmissionPage({ params }: PageProps<'/admin/submissions/[id]'>) {
  const [{ id }, actor] = await Promise.all([params, requireAuth()]);

  let submission;
  try {
    submission = await getSubmission(db, actor, id);
  } catch (error) {
    if (isAppError(error) && (error.code === 'forbidden' || error.code === 'not_found')) {
      notFound();
    }
    throw error;
  }

  const payloadRows = Object.entries(submission.payload ?? {}).map(([key, value]) => ({
    id: key,
    field: key,
    value: Array.isArray(value) ? value.join('، ') : String(value ?? ''),
  }));

  return (
    <>
      <AdminHeader
        title={submission.reference}
        description={`${TYPE_LABEL[submission.type]} — ${STATE_LABEL[submission.state]}`}
      />

      {submission.isSensitive ? (
        <div className="rule-edge mbe-6 border-gold-600 bg-gold-050 p-4">
          <p className="text-small text-ink">
            شكوى سرّية. لم يُسجَّل عنوان الجهاز ولا بيانات المتصفّح مع هذا الطلب، والمحتوى مخزَّن
            مشفّراً. تم تسجيل فتحك لها في سجل التدقيق.
          </p>
        </div>
      ) : null}

      <DataTable
        rows={payloadRows}
        empty="لا محتوى."
        columns={[
          { key: 'field', header: 'الحقل', cell: (row) => row.field },
          { key: 'value', header: 'القيمة', cell: (row) => row.value },
        ]}
      />

      {submission.attachmentPath ? (
        <div className="mbs-6">
          {submission.isSensitive ? (
            <p className="text-small text-ink-55">
              لا يُتاح تنزيل مرفقات الشكاوى السرّية.
            </p>
          ) : (
            <a
              href={`/api/admin/submissions/${submission.id}/attachment`}
              className="rule-edge inline-block px-5 py-2 text-small no-underline hover:bg-paper-alt"
            >
              تنزيل المرفق
            </a>
          )}
        </div>
      ) : null}

      <section className="mbs-10">
        <h2 className="text-h3 font-semibold text-ink">المعالجة</h2>
        <span className="rule-mark mbs-3 mbe-5 block" aria-hidden="true" />

        <form
          action={async (formData: FormData) => {
            'use server';
            const next = String(formData.get('state') ?? 'new');
            const note = String(formData.get('internalNote') ?? '');
            await updateSubmissionState(
              id,
              next as (typeof submissionState.enumValues)[number],
              note || undefined,
            );
          }}
          className="space-y-4"
        >
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="state" className="eyebrow">
                الحالة
              </label>
              <select
                id="state"
                name="state"
                defaultValue={submission.state}
                className="mbs-1 rule-edge bg-paper px-3 py-2 text-small"
              >
                {submissionState.enumValues.map((value) => (
                  <option key={value} value={value}>
                    {STATE_LABEL[value]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="bg-navy-700 px-5 py-2 text-small font-medium text-paper hover:bg-navy-900"
            >
              حفظ
            </button>
          </div>

          <div>
            <label htmlFor="internalNote" className="eyebrow">
              ملاحظة داخلية
            </label>
            <textarea
              id="internalNote"
              name="internalNote"
              rows={3}
              defaultValue={submission.internalNote ?? ''}
              className="mbs-1 block w-full rule-edge bg-paper px-3 py-2 text-small"
            />
            {/* The note is stored on the row but never written into the audit
                diff — an audit entry that quotes a case note turns the log into
                a second copy of the case file. */}
            <p className="mbs-1 text-caption text-ink-55">
              لا تُنسخ هذه الملاحظة إلى سجل التدقيق.
            </p>
          </div>
        </form>
      </section>

      <p className="mbs-8 font-mono text-caption text-mono-muted">
        يُحذف تلقائياً في <Bidi>{submission.purgeAfter}</Bidi>
      </p>
    </>
  );
}
