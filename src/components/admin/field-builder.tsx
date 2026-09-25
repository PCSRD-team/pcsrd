import {
  addCatalogField,
  deleteApplicationField,
  moveApplicationField,
} from '@/actions/admin/application-forms';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Panel } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Field } from '@/components/ui/field';
import { Cluster, Stack } from '@/components/ui/layout';
import { Eyebrow } from '@/components/ui/typography';
import type { ApplicationFormField } from '@/db/schema/applications';
import {
  CATALOG_GROUPS,
  FIELD_CATALOG,
  GROUP_LABEL_AR,
} from '@/lib/applications/field-catalog';
import { adminDict } from './admin-dict';
import { adminUi, fill } from './admin-ui-dict';

/**
 * The field builder.
 *
 * **Server Components throughout, and no JavaScript anywhere.** Every
 * interaction is a `<form>` posting to a Server Action: adding a field,
 * removing one, moving one up or down. That is not a limitation worked around
 * — it is rule 7 held on the screen where it is hardest to hold, and the
 * alternative (a drag-and-drop list backed by client state) would have been a
 * builder that silently does nothing on a filtered connection in Gaza.
 *
 * Reordering is a pair of arrows rather than a drag. The current order travels
 * with each button as a hidden input, so the action reorders against the list
 * the editor was actually looking at rather than re-reading one that may have
 * changed in another tab.
 */

export type FieldBuilderProps = {
  formId: string;
  slug: string;
  fields: ApplicationFormField[];
  /** Locks the key editor: answers are already stored under these keys. */
  hasApplications: boolean;
};

export function FieldBuilder({ formId, slug, fields, hasApplications }: FieldBuilderProps) {
  const t = adminUi.careers;
  const order = fields.map((field) => field.id).join(',');

  // Catalogue entries not already on the form. Offering one that is already
  // there means a click that can only fail on a unique index.
  const used = new Set(fields.map((field) => field.catalogKey ?? field.key));
  const available = FIELD_CATALOG.filter((entry) => !used.has(entry.key));

  return (
    <Stack gap={6}>
      <Cluster gap={3} align="end">
        <AddFromCatalog formId={formId} slug={slug} available={available} />
        <ButtonLink href={`/admin/careers/${formId}/fields/new`} tone="secondary">
          {t.addCustomField}
        </ButtonLink>
      </Cluster>

      {fields.length === 0 ? (
        <EmptyState title={t.noFields} body={t.noFieldsBody} />
      ) : (
        <Stack gap={3}>
          {fields.map((field, index) => (
            <FieldCard
              key={field.id}
              field={field}
              formId={formId}
              slug={slug}
              order={order}
              isFirst={index === 0}
              isLast={index === fields.length - 1}
              keyLocked={hasApplications}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

/**
 * The catalogue picker.
 *
 * One `<select>` with `<optgroup>` per catalogue group, rather than eleven
 * collapsible panels. Eighty-seven options is a lot for a dropdown, and it is
 * still less to navigate than eleven accordions — the browser's own type-ahead
 * finds "رقم الجوال" faster than any widget this screen could build.
 */
function AddFromCatalog({
  formId,
  slug,
  available,
}: {
  formId: string;
  slug: string;
  available: typeof FIELD_CATALOG;
}) {
  const t = adminUi.careers;
  if (available.length === 0) return null;

  return (
    <form action={addCatalogField} className="contents">
      <input type="hidden" name="formId" value={formId} />
      <input type="hidden" name="slug" value={slug} />
      <Field name="catalogKey" label={t.addFromCatalog} className="min-w-72">
        <select name="catalogKey" id="catalogKey" className="control" required>
          {CATALOG_GROUPS.map((group) => {
            const entries = available.filter((entry) => entry.group === group);
            if (entries.length === 0) return null;
            return (
              <optgroup key={group} label={GROUP_LABEL_AR[group]}>
                {entries.map((entry) => (
                  <option key={entry.key} value={entry.key}>
                    {entry.labelAr}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </Field>
      <Button type="submit" tone="secondary">
        {adminUi.careers.addFromCatalog}
      </Button>
    </form>
  );
}

/**
 * One field's row.
 *
 * A section heading renders differently from a question on purpose: it is the
 * structure of the form rather than a part of it, and a builder where the two
 * look identical is a builder where nobody notices the headings are in the
 * wrong places.
 */
function FieldCard({
  field,
  formId,
  slug,
  order,
  isFirst,
  isLast,
  keyLocked,
}: {
  field: ApplicationFormField;
  formId: string;
  slug: string;
  order: string;
  isFirst: boolean;
  isLast: boolean;
  keyLocked: boolean;
}) {
  const t = adminUi.careers;
  const isSection = field.type === 'section';

  return (
    <Panel tone={isSection ? 'alt' : 'paper'} padding="sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {isSection ? (
            <Eyebrow>{field.labelAr}</Eyebrow>
          ) : (
            <p className="text-small font-medium text-ink">{field.labelAr}</p>
          )}

          <Cluster gap={2} className="mbs-2">
            <code className="font-mono text-caption text-ink-55" dir="ltr">
              {field.key}
            </code>
            {/* Said on the card rather than only when the save fails: an
                editor who has already retyped a key and lost the change is
                being told too late. */}
            {keyLocked && !isSection ? (
              <Badge tone="neutral">{adminUi.careers.fieldKeyHint}</Badge>
            ) : null}
            <Badge tone="neutral">{t.fieldTypes[field.type]}</Badge>
            {field.required ? <Badge tone="accent">{t.required}</Badge> : null}
            {field.sensitive ? <Badge tone="warning">{t.sensitive}</Badge> : null}
            {field.catalogKey ? (
              <Badge tone="info">{t.fromCatalog}</Badge>
            ) : (
              <Badge tone="neutral">{t.custom}</Badge>
            )}
            {field.visibleWhen ? (
              <Badge tone="neutral">
                {t.condition}: {field.visibleWhen.field}
              </Badge>
            ) : null}
          </Cluster>

          {field.helpAr ? (
            <p className="mbs-2 text-caption text-ink-70">{field.helpAr}</p>
          ) : null}
          {field.options.length > 0 ? (
            <p className="mbs-2 text-caption text-ink-55">
              {fill(t.fieldCount, { n: field.options.length })} —{' '}
              {field.options
                .slice(0, 6)
                .map((option) => option.labelAr)
                .join('، ')}
              {field.options.length > 6 ? '…' : ''}
            </p>
          ) : null}
        </div>

        <Cluster gap={2}>
          {/* Three one-button forms rather than one form with three submits:
              a native `formAction` on a submit button is well supported, but
              each of these posts a different payload, and separate forms keep
              the hidden inputs beside the button that uses them. */}
          <MoveForm
            formId={formId}
            slug={slug}
            fieldId={field.id}
            order={order}
            direction="up"
            disabled={isFirst}
            label={t.moveUp}
          />
          <MoveForm
            formId={formId}
            slug={slug}
            fieldId={field.id}
            order={order}
            direction="down"
            disabled={isLast}
            label={t.moveDown}
          />

          <ButtonLink href={`/admin/careers/${formId}/fields/${field.id}`} tone="quiet">
            {t.editField}
          </ButtonLink>

          <form action={deleteApplicationField}>
            <input type="hidden" name="formId" value={formId} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="fieldId" value={field.id} />
            <Button type="submit" tone="danger" size="sm">
              {adminDict.form.delete}
            </Button>
          </form>
        </Cluster>
      </div>

    </Panel>
  );
}

function MoveForm({
  formId,
  slug,
  fieldId,
  order,
  direction,
  disabled,
  label,
}: {
  formId: string;
  slug: string;
  fieldId: string;
  order: string;
  direction: 'up' | 'down';
  disabled: boolean;
  label: string;
}) {
  return (
    <form action={moveApplicationField}>
      <input type="hidden" name="formId" value={formId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="fieldId" value={fieldId} />
      <input type="hidden" name="order" value={order} />
      <input type="hidden" name="direction" value={direction} />
      <Button type="submit" tone="quiet" size="sm" disabled={disabled} aria-label={label}>
        {direction === 'up' ? '↑' : '↓'}
      </Button>
    </form>
  );
}
