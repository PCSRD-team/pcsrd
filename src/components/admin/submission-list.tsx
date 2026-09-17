import Link from 'next/link';
import { adminDict } from '@/components/admin/admin-dict';
import { adminUi, fill } from '@/components/admin/admin-ui-dict';
import { AdminPagination, DateCell } from '@/components/admin/controls';
import { AdminHeader } from '@/components/admin/shell';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Bidi, Code } from '@/components/ui/bidi';
import { EmptyState } from '@/components/ui/feedback';
import { Table } from '@/components/ui/table';
import { Caption } from '@/components/ui/typography';
import { listSubmissions } from '@/db/queries/admin';
import type { SubmissionState, SubmissionType } from '@/db/schema/enums';
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

export async function SubmissionListPage({
  actor,
  sensitive,
  page,
}: {
  actor: Actor;
  sensitive: boolean;
  page: number;
}) {
  const result = await listSubmissions(actor, { sensitive, page });
  const base = sensitive ? '/admin/submissions/sensitive' : '/admin/submissions';
  const t = adminUi.submissions;
  const title = sensitive ? t.sensitiveTitle : t.title;

  return (
    <>
      <AdminHeader
        title={title}
        description={sensitive ? t.sensitiveLede : fill(t.count, { n: result.total })}
      />

      <Table
        caption={title}
        captionHidden
        rows={result.items}
        rowHref={(row) => `/admin/submissions/${row.id}`}
        empty={<EmptyState title={t.empty} body={t.emptyBody} />}
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

      <AdminPagination
        page={result.page}
        totalPages={result.totalPages}
        hrefFor={(n) => (n > 1 ? `${base}?page=${n}` : base)}
      />

      {!sensitive ? (
        <Caption className="mbs-6">
          {t.sensitiveFootnote} <Link href="/admin/submissions/sensitive">{t.sensitiveFootnoteLink}</Link>{' '}
          {t.sensitiveFootnoteTail}
        </Caption>
      ) : null}
    </>
  );
}
