import { notFound } from 'next/navigation';
import { updateSubmissionState } from '@/actions/admin/catalog';
import { adminDict } from '@/components/admin/admin-dict';
import { DataTable } from '@/components/admin/controls';
import { Flash } from '@/components/admin/flash';
import { AdminHeader } from '@/components/admin/shell';
import { STATE_LABEL, TYPE_LABEL } from '@/components/admin/submission-list';
import { Bidi } from '@/components/ui/bidi';
import { db } from '@/db';
import { submissionState } from '@/db/schema/enums';
import { requireAuth } from '@/lib/auth/guard';
import { isAppError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { can } from '@/services/_shared/permissions';
import { getSubmission } from '@/services/submission/submission.service';

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

/**
 * A payload value is whatever the visitor typed — a phone number, an email,
 * a URL, a Latin name — inside an Arabic page. Every value is isolated
 * (A11Y-007): a Latin run left in the RTL flow reorders its own punctuation,
 * and a complainant's callback number with its country code at the wrong end
 * is a number nobody can call. Direction is inferred from the first strong
 * character so Arabic prose stays RTL and an email stays LTR.
 */
function PayloadValue({ value }: { value: unknown }) {
  const text = Array.isArray(value) ? value.join('، ') : String(value ?? '');
  const startsLatin = /^[\s\p{P}]*[A-Za-z0-9+@/]/u.test(text);
  return (
    <Bidi dir={startsLatin ? 'ltr' : 'rtl'} className="whitespace-pre-wrap break-words">
      {text}
    </Bidi>
  );
}

export default async function SubmissionPage({
  params,
  searchParams,
}: PageProps<'/admin/submissions/[id]'>) {
  const [{ id }, search, actor] = await Promise.all([params, searchParams, requireAuth()]);

  let submission;
  try {
    submission = await getSubmission(db, actor, id);
  } catch (error) {
    if (isAppError(error) && (error.code === 'forbidden' || error.code === 'not_found')) {
      notFound();
    }
    throw error;
  }

  const t = adminDict.submissions;
  const canHandle = can(actor, 'submissions.handle');

  const payloadRows = Object.entries(submission.payload ?? {}).map(([key, value]) => ({
    id: key,
    field: key,
    value,
  }));

  return (
    <>
      <AdminHeader
        title={submission.reference}
        description={`${TYPE_LABEL[submission.type]} — ${STATE_LABEL[submission.state]}`}
      />

      <Flash searchParams={search} />

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
        empty={t.empty}
        columns={[
          {
            key: 'field',
            header: t.field,
            cell: (row) => (
              <span className="font-mono text-caption">
                <Bidi>{row.field}</Bidi>
              </span>
            ),
          },
          { key: 'value', header: t.value, cell: (row) => <PayloadValue value={row.value} /> },
        ]}
      />

      {submission.attachmentPath ? (
        <div className="mbs-6">
          {submission.isSensitive ? (
            <p className="text-small text-ink-55">{t.sensitiveNoDownload}</p>
          ) : (
            <>
              <a
                href={`/api/admin/submissions/${submission.id}/attachment`}
                className="rule-edge inline-block px-5 py-2 text-small no-underline hover:bg-paper-alt"
              >
                {t.download}
              </a>
              <p className="mbs-2 text-caption text-ink-55">{t.downloadHint}</p>
            </>
          )}
        </div>
      ) : null}

      <section className="mbs-10">
        <h2 className="text-h3 font-semibold text-ink">{t.handling}</h2>
        <span className="rule-mark mbs-3 mbe-5 block" aria-hidden="true" />

        <dl className="mbe-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-caption">
          <dt className="text-ink-55">{t.handledBy}</dt>
          <dd>{submission.handledByName ?? t.notHandled}</dd>
          <dt className="text-ink-55">{t.handledAt}</dt>
          <dd>
            {submission.handledAt ? (
              <time dateTime={submission.handledAt.toISOString()}>
                {formatDate(submission.handledAt, 'ar', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            ) : (
              '—'
            )}
          </dd>
        </dl>

        {canHandle ? (
          <form action={updateSubmissionState} className="space-y-4">
            <input type="hidden" name="id" value={submission.id} />
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="state" className="eyebrow">
                  {t.state}
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
                {adminDict.form.save}
              </button>
            </div>

            <div>
              <label htmlFor="internalNote" className="eyebrow">
                {t.internalNote}
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
              <p className="mbs-1 text-caption text-ink-55">{t.noteHint}</p>
            </div>
          </form>
        ) : null}
      </section>

      <p className="mbs-8 font-mono text-caption text-mono-muted">
        {t.purgeAt} <Bidi>{submission.purgeAfter}</Bidi>
      </p>
    </>
  );
}
