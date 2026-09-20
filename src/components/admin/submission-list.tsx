import Link from 'next/link';
import { adminDict } from '@/components/admin/admin-dict';
import { adminUi, fill } from '@/components/admin/admin-ui-dict';
import { AdminPagination, DateCell } from '@/components/admin/controls';
import { AdminHeader } from '@/components/admin/shell';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Bidi, Code } from '@/components/ui/bidi';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/inputs';
import { Cluster } from '@/components/ui/layout';
import { Table } from '@/components/ui/table';
import { Caption } from '@/components/ui/typography';
import { listSubmissions } from '@/db/queries/admin';
import {
  type SubmissionState,
  type SubmissionType,
  submissionState,
  submissionType,
} from '@/db/schema/enums';
import type { Actor } from '@/services/_shared/actor';

/**
 * The inbox.
 *
 * The list shows the **reference and the type, never the content**. Opening a
 * submission is a deliberate act, and for a confidential complaint it is an
 * audited one — a list that previewed the first line of every message would
 * make that audit meaningless.
 */

export const TYPE_LABEL: Record<SubmissionType, string> = adminUi.submissions.types;
export const STATE_LABEL: Record<SubmissionState, string> = adminDict.submissions.states;

const STATE_TONE: Record<SubmissionState, BadgeTone> = {
  new: 'info',
  in_progress: 'active',
  handled: 'success',
  archived: 'complete',
};

/** The state in words, with the tone as reinforcement. */
export function SubmissionStateBadge({ state }: { state: SubmissionState }) {
  return <Badge tone={STATE_TONE[state]}>{STATE_LABEL[state]}</Badge>;
}

/**
 * Reads the inbox's filters off the query string, once, for both routes.
 *
 * A value outside its enum becomes `undefined` rather than reaching the query:
 * the string is user-controlled and would otherwise be compared against an
 * enum column, which Postgres refuses with an error rather than an empty list.
 */
export function submissionFilters(searchParams: Record<string, string | string[] | undefined>): {
  page: number;
  type?: SubmissionType;
  state?: SubmissionState;
} {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const page = Number(one(searchParams.page));
  const type = one(searchParams.type);
  const state = one(searchParams.state);

  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    type: (submissionType.enumValues as readonly string[]).includes(type ?? '')
      ? (type as SubmissionType)
      : undefined,
    state: (submissionState.enumValues as readonly string[]).includes(state ?? '')
      ? (state as SubmissionState)
      : undefined,
  };
}

export async function SubmissionListPage({
  actor,
  sensitive,
  page,
  type,
  state,
}: {
  actor: Actor;
  sensitive: boolean;
  page: number;
  type?: SubmissionType;
  state?: SubmissionState;
}) {
  const result = await listSubmissions(actor, { sensitive, page, type, state });
  const base = sensitive ? '/admin/submissions/sensitive' : '/admin/submissions';
  const t = adminUi.submissions;
  const list = adminUi.list;
  const title = sensitive ? t.sensitiveTitle : t.title;
  const filtered = Boolean(type || state);

  // 05-ADMIN §7 lists type and state as the inbox's filters. `is_sensitive`
  // is not among them and never will be: it is a hard filter on the query, so
  // the confidential rows are absent from the result set rather than hidden
  // behind a control someone could flip.
  const hrefFor = (n: number) => {
    const query = new URLSearchParams();
    if (type) query.set('type', type);
    if (state) query.set('state', state);
    if (n > 1) query.set('page', String(n));
    const qs = query.toString();
    return qs ? `${base}?${qs}` : base;
  };

  return (
    <>
      <AdminHeader
        title={title}
        description={sensitive ? t.sensitiveLede : fill(t.count, { n: result.total })}
      />

      <form method="get" className="mbe-6">
        <Cluster gap={3} align="end">
          <Field name="type" label={t.filterType} className="min-w-48">
            <Select
              name="type"
              defaultValue={type ?? ''}
              placeholder={list.all}
              options={submissionType.enumValues.map((value) => ({
                value,
                label: TYPE_LABEL[value],
              }))}
            />
          </Field>
          <Field name="state" label={t.filterState} className="min-w-40">
            <Select
              name="state"
              defaultValue={state ?? ''}
              placeholder={list.all}
              options={submissionState.enumValues.map((value) => ({
                value,
                label: STATE_LABEL[value],
              }))}
            />
          </Field>
          <Button type="submit" tone="secondary">
            {list.filter}
          </Button>
          {filtered ? (
            <ButtonLink href={base} tone="quiet">
              {list.clearFilter}
            </ButtonLink>
          ) : null}
        </Cluster>
      </form>

      <Table
        caption={title}
        captionHidden
        rows={result.items}
        rowHref={(row) => `/admin/submissions/${row.id}`}
        empty={
          <EmptyState
            title={filtered ? t.noResults : t.empty}
            body={filtered ? t.noResultsBody : t.emptyBody}
            action={
              filtered ? (
                <ButtonLink href={base} tone="secondary">
                  {list.clearFilter}
                </ButtonLink>
              ) : undefined
            }
          />
        }
        columns={[
          {
            key: 'reference',
            header: t.columns.reference,
            rowHeader: true,
            cell: (row) => <Code>{row.reference}</Code>,
          },
          { key: 'type', header: t.columns.type, cell: (row) => TYPE_LABEL[row.type] },
          {
            key: 'state',
            header: t.columns.state,
            cell: (row) => <SubmissionStateBadge state={row.state} />,
          },
          {
            key: 'attachment',
            header: t.columns.attachment,
            cell: (row) => (row.hasAttachment ? adminUi.list.columns.yes : '—'),
          },
          { key: 'handled', header: t.columns.handledBy, cell: (row) => row.handledBy ?? '—' },
          {
            key: 'created',
            header: t.columns.createdAt,
            numeric: true,
            align: 'start',
            cell: (row) => <DateCell value={row.createdAt} />,
          },
          {
            key: 'purge',
            header: t.columns.purgeAfter,
            numeric: true,
            align: 'start',
            cell: (row) => <Bidi>{row.purgeAfter}</Bidi>,
          },
        ]}
      />

      <AdminPagination page={result.page} totalPages={result.totalPages} hrefFor={hrefFor} />

      {!sensitive ? (
        <Caption className="mbs-6">
          {t.sensitiveFootnote} <Link href="/admin/submissions/sensitive">{t.sensitiveFootnoteLink}</Link>{' '}
          {t.sensitiveFootnoteTail}
        </Caption>
      ) : null}
    </>
  );
}
