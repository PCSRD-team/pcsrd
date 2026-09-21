import { NotFoundBody } from '@/components/layout/not-found-body';

/**
 * The not-found boundary for the catch-all segment.
 *
 * `[locale]/not-found.tsx` sits one level up and ought to cover this segment,
 * but a `notFound()` raised from a **catch-all** page did not resolve to it —
 * the request fell through to Next's built-in error document instead, losing
 * the chrome and the `lang`. Giving the segment its own boundary is one line
 * of indirection and removes the question.
 *
 * Both files render the same `NotFoundBody`, so there is one designed 404, not
 * two.
 */
export default function CatchAllNotFoundBoundary() {
  return <NotFoundBody />;
}
