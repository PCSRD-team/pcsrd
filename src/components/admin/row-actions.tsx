import { deleteEntity, setEntityStatus } from '@/actions/admin/content';
import type { ContentStatus } from '@/db/schema/enums';
import type { DELETE_ENTITIES, STATUS_ENTITIES } from '@/lib/validation/admin';
import type { Actor } from '@/services/_shared/actor';
import { can } from '@/services/_shared/permissions';
import { cn } from '@/lib/utils';
import { adminDict } from './admin-dict';

/**
 * Publish / unpublish / archive and delete, as plain forms.
 *
 * Server Components: every button is a `<form action>` posting to one of the
 * two row actions, so a list works with JavaScript disabled. Delete is a
 * two-step confirm built from `<details>` — the confirm button is not in the
 * page until the disclosure is opened, and opening it needs no script.
 *
 * Permission-aware in the honest sense: a button the actor cannot use is not
 * rendered rather than disabled. An editor sees no publish button, a content
 * manager sees no delete button, and the actions guard again regardless.
 */

export type StatusEntity = (typeof STATUS_ENTITIES)[number];
export type DeletableEntity = (typeof DELETE_ENTITIES)[number];

const button = 'rule-edge px-3 py-1 text-caption text-ink hover:bg-paper-alt whitespace-nowrap';
const primary = 'bg-navy-700 px-3 py-1 text-caption font-medium text-paper hover:bg-navy-900 whitespace-nowrap';
const marked = 'rule-edge border-gold-600 px-3 py-1 text-caption text-gold-700 hover:bg-gold-050 whitespace-nowrap';

function Hidden({ values }: { values: Record<string, string> }) {
  return (
    <>
      {Object.entries(values).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

export function StatusActions({
  entity,
  id,
  status,
  actor,
  returnTo,
}: {
  entity: StatusEntity;
  id: string;
  status: ContentStatus;
  actor: Actor;
  returnTo: string;
}) {
  if (!can(actor, 'content.publish')) return null;
  const t = adminDict.form;
  const base = { entity, id, returnTo };

  return (
    <>
      {status !== 'published' ? (
        <form action={setEntityStatus}>
          <Hidden values={{ ...base, status: 'published' }} />
          <button type="submit" className={primary}>
            {t.publish}
          </button>
        </form>
      ) : null}
      {status === 'published' ? (
        <>
          <form action={setEntityStatus}>
            <Hidden values={{ ...base, status: 'draft' }} />
            <button type="submit" className={button}>
              {t.unpublish}
            </button>
          </form>
          <form action={setEntityStatus}>
            <Hidden values={{ ...base, status: 'archived' }} />
            <button type="submit" className={marked}>
              {t.archive}
            </button>
          </form>
        </>
      ) : null}
      {status === 'archived' ? (
        <form action={setEntityStatus}>
          <Hidden values={{ ...base, status: 'draft' }} />
          <button type="submit" className={button}>
            {t.restore}
          </button>
        </form>
      ) : null}
    </>
  );
}

export function DeleteAction({
  entity,
  id,
  status,
  actor,
  returnTo,
  label,
}: {
  entity: DeletableEntity;
  id: string;
  /** Omitted for entities with no lifecycle (people, metrics). */
  status?: ContentStatus;
  actor: Actor;
  returnTo: string;
  /** Names the record in the confirm step so the step is a real decision. */
  label?: string;
}) {
  if (!can(actor, 'content.delete')) return null;
  const t = adminDict.form;
  const published = status === 'published';

  return (
    <details className="group relative">
      <summary className={cn(button, 'inline-block cursor-pointer list-none')}>{t.delete}</summary>
      <div className="rule-edge mbs-2 max-w-sm border-gold-600 bg-paper p-3">
        {label ? <p className="mbe-2 text-small font-medium text-ink">{label}</p> : null}
        <p className="text-caption text-ink-55">
          {published ? t.deletePublishedHint : t.deleteHint}
        </p>
        {!published ? (
          <form action={deleteEntity} className="mbs-3">
            <Hidden values={{ entity, id, returnTo }} />
            <button type="submit" className={marked}>
              {t.confirmDelete}
            </button>
          </form>
        ) : null}
      </div>
    </details>
  );
}

/** The cell a list row renders: status buttons and delete side by side. */
export function RowActions({
  entity,
  id,
  status,
  actor,
  returnTo,
  label,
  allowDelete = true,
}: {
  entity: DeletableEntity;
  id: string;
  status?: ContentStatus;
  actor: Actor;
  returnTo: string;
  label?: string;
  /** Off for a fixed set — the three programmes are seeded by key, not created or deleted. */
  allowDelete?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      {status && isStatusEntity(entity) ? (
        <StatusActions entity={entity} id={id} status={status} actor={actor} returnTo={returnTo} />
      ) : null}
      {allowDelete ? (
        <DeleteAction
          entity={entity}
          id={id}
          status={status}
          actor={actor}
          returnTo={returnTo}
          label={label}
        />
      ) : null}
    </div>
  );
}

function isStatusEntity(entity: DeletableEntity): entity is StatusEntity {
  return entity !== 'person' && entity !== 'metric';
}
