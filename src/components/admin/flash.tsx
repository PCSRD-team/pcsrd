import { Notice } from '@/components/ui/notice';
import { adminFormDict, isAdminKey, resolveAdminKey } from './admin-dict';

/**
 * The outcome of the previous action, read from the query string.
 *
 * Three spellings are accepted because three generations of action wrote
 * them: `?saved=1` from the entity forms, and `?ok=<key>` / `?err=<key>` from
 * the row actions (`src/actions/admin/flash.ts`). A key that is not in the
 * dictionary is not rendered — the query string is user-controlled, and this
 * component must not become a way to put arbitrary text on an admin page.
 *
 * A Server Component: it reads params the page already has and ships nothing.
 * `Notice` carries the live semantics: `danger` is `role="alert"`, `success`
 * is `role="status"`.
 */
export function Flash({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const dict = adminFormDict();
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const okKey = one(searchParams.saved) ? 'admin.saved' : one(searchParams.ok);
  const errKey = one(searchParams.err);

  if (errKey) {
    const text = isAdminKey(dict, errKey)
      ? resolveAdminKey(dict, errKey)
      : resolveAdminKey(dict, 'admin.flash.error');
    return (
      <Notice tone="danger" className="mbe-6">
        {text}
      </Notice>
    );
  }

  if (okKey && isAdminKey(dict, okKey)) {
    return (
      <Notice tone="success" className="mbe-6">
        {resolveAdminKey(dict, okKey)}
      </Notice>
    );
  }

  return null;
}
