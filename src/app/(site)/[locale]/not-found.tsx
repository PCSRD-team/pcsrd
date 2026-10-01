import { NotFoundBody } from '@/components/layout/not-found-body';

/**
 * The 404 for a URL that matched this route group — a slug that does not
 * resolve, or an unknown locale. It renders inside `[locale]/layout.tsx`, so
 * the document, `lang`, `dir` and the site chrome are already in place.
 *
 * There is no `src/app/not-found.tsx` — there is no root layout above the
 * route groups for it to render in. A path under a known locale that matches
 * no route is caught by `[...notFound]/page.tsx` instead, which renders this
 * same body; a path with no locale is redirected to one by `src/proxy.ts`.
 */
export default function NotFound() {
  return <NotFoundBody />;
}
