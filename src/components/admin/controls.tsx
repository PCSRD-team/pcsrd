import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ContentStatus } from '@/db/schema/enums';
import { formatDate } from '@/lib/format';
import { paginationRange } from '@/lib/utils';
import { cn } from '@/lib/utils';

/**
 * Shared admin controls.
 *
 * Server Components except where interactivity genuinely requires otherwise —
 * the table, the badges and the field wrappers are all markup, so they render
 * on the server and ship no JavaScript.
 */

// ── Status ───────────────────────────────────────────────────────────────

export const STATUS_LABEL: Record<ContentStatus, string> = {
  draft: 'مسودة',
  in_review: 'قيد المراجعة',
  published: 'منشور',
  archived: 'مؤرشف',
};

const STATUS_TONE: Record<ContentStatus, string> = {
  draft: 'bg-paper-alt text-ink-55 border-rule',
  in_review: 'bg-navy-100 text-navy-900 border-navy-700/30',
  published: 'bg-gold-050 text-gold-700 border-gold-600',
  archived: 'bg-paper text-ink-55 border-rule-strong',
};

export function StatusBadge({ status }: { status: ContentStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-0.5 font-mono text-eyebrow',
        STATUS_TONE[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
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
  return (
    <span className="inline-flex items-center rounded-full border border-gold-600 bg-gold-050 px-3 py-0.5 font-mono text-eyebrow text-gold-700">
      ترجمة ناقصة
    </span>
  );
}

// ── Table ────────────────────────────────────────────────────────────────

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Mono, LTR and narrow — dates, counts, references. */
  numeric?: boolean;
};

export function DataTable<T extends { id: string | number }>({
  rows,
  columns,
  empty,
  rowHref,
}: {
  rows: T[];
  columns: Column<T>[];
  empty: string;
  rowHref?: (row: T) => string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rule-edge bg-paper-alt p-10 text-center">
        <p className="text-small text-ink-55">{empty}</p>
      </div>
    );
  }

  return (
    <div className="rule-edge overflow-x-auto bg-paper">
      <table className="w-full">
        <thead>
          <tr className="border-be-2 border-ink">
            {columns.map((column) => (
              <th key={column.key} scope="col" className="eyebrow p-3 text-start whitespace-nowrap">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-be border-hairline hover:bg-paper-alt">
              {columns.map((column, index) => (
                <td
                  key={column.key}
                  // The admin is unconditionally `dir="rtl"`, so a Latin or
                  // numeric run in a cell — a reference, a slug, a date, a
                  // phone number — is reordered by the bidi algorithm and its
                  // trailing punctuation jumps to the front. `PCS-2026-0041.`
                  // renders as `.PCS-2026-0041`, and a complainant's callback
                  // number comes out with the country code at the wrong end.
                  //
                  // `dir` on an element is sufficient isolation: the UA
                  // stylesheet applies `unicode-bidi: isolate` to `[dir]`. The
                  // `numeric` column type already promised "Mono, LTR and
                  // narrow" and delivered only the first and the third.
                  dir={column.numeric ? 'ltr' : undefined}
                  className={cn(
                    'p-3 text-small text-ink align-top',
                    column.numeric && 'font-mono text-caption whitespace-nowrap',
                  )}
                >
                  {/* The first cell carries the row link, so the whole row is
                      not a link — that would make every cell's text
                      unselectable and swallow nested controls. */}
                  {index === 0 && rowHref ? (
                    <Link href={rowHref(row)} className="text-ink hover:text-gold-700">
                      {column.cell(row)}
                    </Link>
                  ) : (
                    column.cell(row)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** `updated_at` in a list, formatted once so every table agrees. */
export function TimeCell({ value }: { value: Date }) {
  return (
    <time dateTime={value.toISOString()} dir="ltr">
      {formatDate(value, 'ar', { year: 'numeric', month: 'short', day: 'numeric' })}
    </time>
  );
}

// ── Pagination ───────────────────────────────────────────────────────────

export function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="ترقيم الصفحات" className="mbs-6">
      <ul className="flex flex-wrap gap-2">
        {paginationRange(page, totalPages).map((token, index) =>
          token === 'gap' ? (
            <li
              key={`gap-${index}`}
              aria-hidden="true"
              className="px-2 py-1 font-mono text-caption text-mono-muted"
            >
              …
            </li>
          ) : (
            <li key={token}>
              <Link
                href={hrefFor(token)}
                aria-current={token === page ? 'page' : undefined}
                className={cn(
                  'rule-edge px-3 py-1 font-mono text-caption no-underline',
                  token === page ? 'border-ink bg-ink text-paper' : 'text-ink hover:bg-paper-alt',
                )}
              >
                {token}
              </Link>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}

// ── Form scaffolding ─────────────────────────────────────────────────────

export const inputClass =
  'block w-full rule-control bg-paper px-3 py-2 text-small text-ink focus:border-navy-700';

/**
 * The ids `Field` renders, joined for `aria-describedby`.
 *
 * The public forms have `describedBy` in `components/forms/fields.tsx`; this is
 * the admin's half of the same contract. They are deliberately not shared —
 * that module is a Client Component boundary for the public site and importing
 * across would drag it into the admin bundle for four lines.
 */
export function fieldDescribedBy(name: string, hint?: string, error?: string) {
  return (
    [hint ? `${name}-hint` : null, error ? `${name}-error` : null].filter(Boolean).join(' ') ||
    undefined
  );
}

export function Field({
  name,
  label,
  hint,
  error,
  required,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  /** Rendered with a stable id so the control can reference it. */
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={name} className="block text-small font-medium text-ink">
        {label}
        {required ? (
          <span className="ms-1 text-gold-700" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {hint ? (
        <p id={`${name}-hint`} className="text-caption text-ink-55">
          {hint}
        </p>
      ) : null}
      {children}
      {/* `Field` rendered no error at all, so `ContentForm` rendered one itself
          for text inputs and nothing whatsoever for textareas and selects — an
          editor got a rejected save with no indication which field was wrong.
          Owning it here means every branch gets it, and gets the id that makes
          `aria-describedby` possible. */}
      {error ? (
        <p id={`${name}-error`} className="text-caption text-gold-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function EnumSelect({
  name,
  label,
  options,
  defaultValue,
  required,
  hint,
  multiple,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string | string[];
  required?: boolean;
  hint?: string;
  multiple?: boolean;
}) {
  return (
    <Field name={name} label={label} hint={hint} required={required}>
      <select
        id={name}
        name={name}
        required={required}
        multiple={multiple}
        defaultValue={defaultValue}
        size={multiple ? Math.min(options.length, 6) : undefined}
        className={inputClass}
      >
        {!multiple ? <option value="">—</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function CheckboxField({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-3 text-small text-ink">
        <input
          id={name}
          name={name}
          type="checkbox"
          defaultChecked={defaultChecked}
          className="size-4 accent-navy-700"
        />
        {label}
      </label>
      {hint ? <p className="text-caption text-ink-55">{hint}</p> : null}
    </div>
  );
}

/**
 * The sticky action bar.
 *
 * Publish and delete are rendered only when the actor holds the capability,
 * and the actions guard again. A disabled button an editor can see but not use
 * teaches them the tool is broken; an absent one teaches them the boundary.
 */
export function PublishBar({
  status,
  canPublish,
  canDelete,
  children,
}: {
  status: ContentStatus;
  canPublish: boolean;
  canDelete: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="sticky inset-be-0 mbs-10 flex flex-wrap items-center gap-3 border-bs-2 border-ink bg-paper p-4">
      <StatusBadge status={status} />
      <div className="flex-1" />
      {children}
      <button
        type="submit"
        name="status"
        value="draft"
        className="rule-edge px-5 py-2 text-small text-ink hover:bg-paper-alt"
      >
        حفظ كمسودة
      </button>
      <button
        type="submit"
        name="status"
        value="in_review"
        className="rule-edge px-5 py-2 text-small text-ink hover:bg-paper-alt"
      >
        إرسال للمراجعة
      </button>
      {canPublish ? (
        <button
          type="submit"
          name="status"
          value="published"
          className="bg-navy-700 px-5 py-2 text-small font-medium text-paper hover:bg-navy-900"
        >
          نشر
        </button>
      ) : null}
      {canPublish && status === 'published' ? (
        <button
          type="submit"
          name="status"
          value="archived"
          className="rule-edge border-gold-600 px-5 py-2 text-small text-gold-700 hover:bg-gold-050"
        >
          أرشفة
        </button>
      ) : null}
      {canDelete ? <span className="text-caption text-ink-55">الحذف من صفحة القائمة</span> : null}
    </div>
  );
}
