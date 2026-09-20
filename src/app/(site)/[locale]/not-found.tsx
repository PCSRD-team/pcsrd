import { NotFoundBody } from '@/components/layout/not-found-body';

/**
 * The 404 for a URL that matched this route group — a slug that does not
 * resolve, or an unknown locale. It renders inside `[locale]/layout.tsx`, so
 * the document, `lang`, `dir` and the site chrome are already in place.
 *
 * A URL that matches no route at all never reaches here; `src/app/not-found.tsx`
 * handles that one, and has to emit its own document.
 */
export default function NotFound() {
  return <NotFoundBody />;
}
