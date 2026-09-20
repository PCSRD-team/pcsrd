import { notFound } from 'next/navigation';
import { updateSubmissionState } from '@/actions/admin/catalog';
import { adminDict } from '@/components/admin/admin-dict';
import { adminUi } from '@/components/admin/admin-ui-dict';
import { Flash } from '@/components/admin/flash';
import { AdminHeader } from '@/components/admin/shell';
import { STATE_LABEL, SubmissionStateBadge, TYPE_LABEL } from '@/components/admin/submission-list';
import { Badge } from '@/components/ui/badge';
import { Bidi, Code, DateText } from '@/components/ui/bidi';
import { Button, buttonClasses } from '@/components/ui/button';
import { DefinitionList } from '@/components/ui/definition-list';
import { EmptyState } from '@/components/ui/feedback';
import { Field, FormStack } from '@/components/ui/field';
import { Select, Textarea } from '@/components/ui/inputs';
import { Cluster, Section, SectionHeading } from '@/components/ui/layout';
import { Notice } from '@/components/ui/notice';
import { Table } from '@/components/ui/table';
import { Caption, Meta } from '@/components/ui/typography';
import { db } from '@/db';
import { submissionState } from '@/db/schema/enums';
import { requireAuth } from '@/lib/auth/guard';
import { isAppError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { ar } from '@/lib/i18n/dictionaries/ar';
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
 *
 * The attachment link is a plain `<a>` wearing `buttonClasses`, not a
 * `ButtonLink`: `next/link` may prefetch a route handler, and a prefetch of
 * an audited download would write an audit entry nobody asked for.
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
  const text = Array.isArray(value) ? value.join(ar.common.listSeparator) : String(value ?? '');
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
  const ui = adminUi.submissions;
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
        meta={
          <Cluster gap={3}>
            <Badge tone="neutral">{TYPE_LABEL[submission.type]}</Badge>
            <SubmissionStateBadge state={submission.state} />
          </Cluster>
        }
      />

      <Flash searchParams={search} />

      {submission.isSensitive ? (
        <Notice tone="warning" live="off" className="mbe-6">
          {ui.sensitiveNotice}
        </Notice>
      ) : null}

      <Table
        caption={ui.payloadCaption}
        captionHidden
        rows={payloadRows}
        empty={<EmptyState title={t.empty} body={ui.emptyBody} />}
        columns={[
          {
            key: 'field',
            header: t.field,
            rowHeader: true,
            cell: (row) => <Code className="text-caption">{row.field}</Code>,
          },
          { key: 'value', header: t.value, cell: (row) => <PayloadValue value={row.value} /> },
        ]}
      />

      {submission.attachmentPath ? (
        <div className="mbs-6">
          {submission.isSensitive ? (
            <Caption>{t.sensitiveNoDownload}</Caption>
          ) : (
            <>
              <a
                href={`/api/admin/submissions/${submission.id}/attachment`}
                className={buttonClasses({ tone: 'secondary' })}
              >
                {t.download}
              </a>
              <Caption className="mbs-2">{t.downloadHint}</Caption>
            </>
          )}
        </div>
      ) : null}

      <Section bounded spacing="tight" labelledBy="submission-handling" className="mbs-10">
        <SectionHeading as="h2" id="submission-handling" title={t.handling} />

        <DefinitionList
          layout="grid"
          className="mbe-6"
          items={[
            { term: t.handledBy, value: submission.handledByName ?? t.notHandled },
            {
              term: t.handledAt,
              value: submission.handledAt ? (
                <time dateTime={submission.handledAt.toISOString()}>
                  <DateText locale="ar">
                    {formatDate(submission.handledAt, 'ar', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </DateText>
                </time>
              ) : (
                '—'
              ),
            },
          ]}
        />

        {canHandle ? (
          <form action={updateSubmissionState}>
            <input type="hidden" name="id" value={submission.id} />
            <FormStack>
              <Cluster gap={3} align="end">
                <Field name="state" label={t.state} className="min-w-48">
                  <Select
                    name="state"
                    defaultValue={submission.state}
                    placeholder={null}
                    options={submissionState.enumValues.map((value) => ({
                      value,
                      label: STATE_LABEL[value],
                    }))}
                  />
                </Field>
                <Button type="submit">{adminDict.form.save}</Button>
              </Cluster>

              {/* The note is stored on the row but never written into the audit
                  diff — an audit entry that quotes a case note turns the log into
                  a second copy of the case file. */}
              <Field name="internalNote" label={t.internalNote} hint={t.noteHint}>
                <Textarea
                  name="internalNote"
                  rows={3}
                  defaultValue={submission.internalNote ?? ''}
                  hint={t.noteHint}
                />
              </Field>
            </FormStack>
          </form>
        ) : null}
      </Section>

      <Meta className="mbs-8 text-mono-muted">
        {t.purgeAt} <Bidi>{submission.purgeAfter}</Bidi>
      </Meta>
    </>
  );
}
