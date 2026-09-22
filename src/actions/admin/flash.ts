import type { ActionResult } from '@/lib/errors';
import { ADMIN_RETURN_PATH } from '@/lib/validation/admin';

/**
 * Carries an action's outcome across a redirect.
 *
 * A Server Component `<form action>` has no `useActionState`, and with
 * JavaScript disabled the next page is the only place a message can appear.
 * The outcome is encoded as a **dictionary key** — `ok=admin.deleted`,
 * `err=errors.content.unpublishFirst` — never as prose, so the page that
 * renders it resolves it through the same dictionary as everything else.
 *
 * Not a Server Action: this module has no `'use server'` directive, so nothing
 * here is a POST endpoint.
 */

/** A `returnTo` that is not an admin path is replaced, never followed. */
export function safeReturnPath(value: unknown): string {
  return typeof value === 'string' && ADMIN_RETURN_PATH.test(value) ? value : '/admin';
}

/**
 * Appends the outcome to `returnTo`, **merging** with any query it carries.
 *
 * This concatenated — `${path}?${query}` — which was correct only for as long
 * as the pattern rejected every path with a query. Now that a list page can
 * send its own `?page=3`, concatenating would produce `?page=3?ok=admin.saved`
 * and lose both.
 */
export function withFlash(returnTo: unknown, result: ActionResult<unknown>): string {
  const path = safeReturnPath(returnTo);
  const [base = '/admin', existing] = path.split('?');
  const query = new URLSearchParams(existing);
  if (result.ok) query.set('ok', result.messageKey ?? 'admin.saved');
  else query.set('err', result.messageKey);
  return `${base}?${query}`;
}