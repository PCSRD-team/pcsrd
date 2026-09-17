import { deleteEntity, setEntityStatus } from '@/actions/admin/content';
import { Button, buttonClasses } from '@/components/ui/button';
import { Panel } from '@/components/ui/card';
import { Cluster } from '@/components/ui/layout';
import { Caption, Heading } from '@/components/ui/typography';
import type { ContentStatus } from '@/db/schema/enums';
import type { DELETE_ENTITIES, STATUS_ENTITIES } from '@/lib/validation/admin';
import type { Actor } from '@/services/_shared/actor';
import { can } from '@/services/_shared/permissions';
import { adminDict } from './admin-dict';
import { adminUi } from './admin-ui-dict';

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
          <Button type="submit" size="sm" tone="primary">
            {t.publish}
          </Button>
        </form>
      ) : null}
      {status === 'published' ? (
        <>
          <form action={setEntityStatus}>
            <Hidden values={{ ...base, status: 'draft' }} />
            <Button type="submit" size="sm" tone="secondary">
              {t.unpublish}
            </Button>
          </form>
          <form action={setEntityStatus}>
            <Hidden values={{ ...base, status: 'archived' }} />
            <Button type="submit" size="sm" tone="marked">
              {t.archive}
            </Button>
          </form>
        </>
      ) : null}
      {status === 'archived' ? (
        <form action={setEntityStatus}>
          <Hidden values={{ ...base, status: 'draft' }} />
          <Button type="submit" size="sm" tone="secondary">
            {t.restore}
          </Button>
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
      <summary
        className={buttonClasses({
          tone: 'secondary',
          size: 'sm',
          className: 'cursor-pointer list-none',
        })}
      >
        {t.delete}
      </summary>
      <Panel tone="paper" padding="sm" className="mbs-2 max-w-sm border-destructive/40">
        {label ? <p className="mbe-2 text-small font-medium text-ink">{label}</p> : null}
        <Caption>{published ? t.deletePublishedHint : t.deleteHint}</Caption>
        {!published ? (
          <form action={deleteEntity} className="mbs-3">
            <Hidden values={{ entity, id, returnTo }} />
            <Button type="submit" size="sm" tone="danger">
              {t.confirmDelete}
            </Button>
          </form>
        ) : null}
      </Panel>
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
    <Cluster gap={2} align="start">
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
    </Cluster>
  );
}

/**
 * The delete zone under an editor — its own form, outside the editor's,
 * because a form cannot nest in a form. Rendered only when the actor may
 * delete; otherwise nothing, for the same reason as the buttons above.
 */
export function DeletePanel(props: {
  entity: DeletableEntity;
  id: string;
  status?: ContentStatus;
  actor: Actor;
  returnTo: string;
  label?: string;
}) {
  if (!can(props.actor, 'content.delete')) return null;
  const t = adminUi.entity;

  return (
    <Panel as="section" tone="paper" padding="sm" className="mbs-8 border-destructive/40" labelledBy="delete-zone">
      <Heading level={2} size="h4" id="delete-zone">
        {t.deleteZone}
      </Heading>
      <Caption className="mbs-1 mbe-3">{t.deleteZoneHint}</Caption>
      <DeleteAction {...props} />
    </Panel>
  );
}

function isStatusEntity(entity: DeletableEntity): entity is StatusEntity {
  return entity !== 'person' && entity !== 'metric';
}
