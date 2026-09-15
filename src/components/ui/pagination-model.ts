import { paginationRange, type PageToken } from '@/lib/utils';

/**
 * The pure model behind `Pagination` — everything the component decides
 * that is not markup, so it can be tested without a DOM.
 *
 * The window itself comes from `paginationRange` in `src/lib/utils.ts`
 * (first, last, current ± radius, no gap standing in for a single page).
 */

export type PaginationLink =
  | { kind: 'page'; page: number; current: boolean; href: string }
  | { kind: 'gap'; key: string };

export type PaginationModel = {
  /** `null` when there is nothing to paginate or only one page. */
  previous: { page: number; href: string } | null;
  next: { page: number; href: string } | null;
  items: PaginationLink[];
  /** True when the control should not render at all. */
  empty: boolean;
};

export function paginationModel(
  page: number,
  totalPages: number,
  hrefFor: (page: number) => string,
  radius = 1,
): PaginationModel {
  const total = Math.max(0, Math.floor(totalPages));
  const current = Math.min(Math.max(1, Math.floor(page)), Math.max(1, total));

  if (total <= 1) return { previous: null, next: null, items: [], empty: true };

  const tokens: PageToken[] = paginationRange(current, total, radius);
  let gaps = 0;
  const items: PaginationLink[] = tokens.map((token) =>
    token === 'gap'
      ? { kind: 'gap', key: `gap-${(gaps += 1)}` }
      : { kind: 'page', page: token, current: token === current, href: hrefFor(token) },
  );

  return {
    previous: current > 1 ? { page: current - 1, href: hrefFor(current - 1) } : null,
    next: current < total ? { page: current + 1, href: hrefFor(current + 1) } : null,
    items,
    empty: false,
  };
}

/** The `<link rel="prev|next">` hrefs a page should emit in `generateMetadata`. */
export function paginationRels(
  page: number,
  totalPages: number,
  hrefFor: (page: number) => string,
): { prev?: string; next?: string } {
  const model = paginationModel(page, totalPages, hrefFor);
  return {
    ...(model.previous ? { prev: model.previous.href } : {}),
    ...(model.next ? { next: model.next.href } : {}),
  };
}
