import type { ActionResult } from '@/lib/errors';

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

const ADMIN_PATH = /^\/admin(?:\/[\w-]+)*\/?$/;

/** A `returnTo` that is not an admin path is replaced, never followed. */
export function safeReturnPath(value: unknown): string {
  return typeof value === 'string' && ADMIN_PATH.test(value) ? value : '/admin';
}

export function withFlash(returnTo: unknown, result: ActionResult<unknown>): string {
  const path = safeReturnPath(returnTo);
  const query = new URLSearchParams();
  if (result.ok) query.set('ok', result.messageKey ?? 'admin.saved');
  else query.set('err', result.messageKey);
  return `${path}?${query}`;
}
