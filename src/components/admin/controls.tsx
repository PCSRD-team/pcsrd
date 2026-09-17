import type { ReactNode } from 'react';
import { Badge, StatusBadge as KitStatusBadge } from '@/components/ui/badge';
import { Panel } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { SubmitButton } from '@/components/ui/submit-button';
import { TimeCell } from '@/components/ui/table';
import type { ContentStatus } from '@/db/schema/enums';
import { formatDate } from '@/lib/format';
import { adminDict } from './admin-dict';
import { adminUi, fill } from './admin-ui-dict';

/**
 * Shared admin controls.
 *
 * Everything here is a thin wrapper that binds a kit component to the
 * admin's Arabic copy — nothing draws its own surface. The table, the
 * fields, the inputs, the badges and the pagination are the kit's; what
 * the admin adds is the dictionary lookup and the capability logic of the
 * publish bar.
 *
 * Server Components except `PublishBar`/`SaveBar`, which render the kit's
 * `SubmitButton` (a Client Component) and are themselves plain markup.
 */

// ── Status ───────────────────────────────────────────────────────────────

/** `content_status` → the admin's word for it. */
export const STATUS_LABEL: Record<ContentStatus, string> = adminUi.status;

export function StatusBadge({ status }: { status: ContentStatus }) {
  return <KitStatusBadge status={status} label={STATUS_LABEL[status]} />;
}

/**
 * Shown when a record has some English fields filled and others empty.
 *
 * `translation_status` has no `partial` value and should not gain one: a
 * half-translated page is a state to fix, not a state to record. The badge
 * exists so the editor sees it in the list rather than discovering it on the
 * public site.
 */
export function TranslationBadge({ partial }: { partial: boolean }) {
  if (!partial) return null;
  return <Badge tone="warning">{adminUi.translationPartial}</Badge>;
}

// ── Table cells ──────────────────────────────────────────────────────────

/** `updated_at` in a list, formatted once so every table agrees. */
export function DateCell({ value }: { value: Date }) {
  return (
    <TimeCell dateTime={value.toISOString()}>
      {formatDate(value, 'ar', { year: 'numeric', month: 'short', day: 'numeric' })}
    </TimeCell>
  );
}

// ── Pagination ───────────────────────────────────────────────────────────

/** The kit's pagination with the admin's labels bound. */
export function AdminPagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  return (
    <Pagination
      page={page}
      totalPages={totalPages}
      hrefFor={hrefFor}
      label={adminUi.pagination.label}
      previousLabel={adminUi.pagination.previous}
      nextLabel={adminUi.pagination.next}
      pageLabel={(n) => fill(adminUi.pagination.page, { n })}
    />
  );
}

// ── Action bars ──────────────────────────────────────────────────────────

const barClass = 'sticky inset-be-0 z-20 mbs-10 flex flex-wrap items-center gap-3 rule-section';

/**
 * The sticky action bar.
 *
 * Publish is rendered only when the actor holds the capability, and the
 * actions guard again. A disabled button an editor can see but not use
 * teaches them the tool is broken; an absent one teaches them the boundary.
 *
 * Every button is a submit with `name="status"`, so "save as draft" and
 * "publish" are one submission with a different value rather than two code
 * paths that can drift apart. Delete is not here: it is a separate form
 * (`DeleteAction`) rendered below the editor, because a form cannot nest
 * inside another form.
 */
export function PublishBar({
  status,
  canPublish,
  children,
}: {
  status: ContentStatus;
  canPublish: boolean;
  children?: ReactNode;
}) {
  const t = adminDict.form;
  const pending = adminUi.form.saving;

  return (
    <Panel tone="paper" padding="sm" className={barClass}>
      <StatusBadge status={status} />
      <div className="flex-1" />
      {children}
      <SubmitButton
        tone="secondary"
        name="status"
        value="draft"
        label={t.saveDraft}
        pendingLabel={pending}
      />
      <SubmitButton
        tone="secondary"
        name="status"
        value="in_review"
        label={t.submitReview}
        pendingLabel={pending}
      />
      {canPublish ? (
        <SubmitButton
          tone="primary"
          name="status"
          value="published"
          label={t.publish}
          pendingLabel={pending}
        />
      ) : null}
      {canPublish && status === 'published' ? (
        <SubmitButton
          tone="danger"
          name="status"
          value="archived"
          label={t.archive}
          pendingLabel={pending}
        />
      ) : null}
    </Panel>
  );
}

/**
 * The single-button bar for records with no lifecycle — a person, an impact
 * figure, a media asset, the organisation record. `pending` comes from the
 * form's `useActionState` when it has one; otherwise `SubmitButton` reads
 * `useFormStatus` itself.
 */
export function SaveBar({
  label = adminDict.form.save,
  pending,
  note,
}: {
  label?: string;
  pending?: boolean;
  note?: string;
}) {
  return (
    <Panel tone="paper" padding="sm" className={barClass}>
      {pending === undefined ? (
        <SubmitButton label={label} pendingLabel={adminUi.form.saving} />
      ) : (
        <Button type="submit" loading={pending}>
          {pending ? adminUi.form.saving : label}
        </Button>
      )}
      {note ? <p className="text-caption text-ink-55">{note}</p> : null}
    </Panel>
  );
}
