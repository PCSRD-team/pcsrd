import { describe, expect, it } from 'vitest';
import { paginationModel, paginationRels } from '@/components/ui/pagination-model';

/**
 * The model behind `Pagination`: what the component decides that is not
 * markup. `paginationRange` (the window itself) has its own tests in
 * `pagination.test.ts`; these cover what is layered on top — prev/next,
 * the current page, hrefs, and the degenerate inputs a URL can carry.
 */
const href = (n: number) => `/ar/news?page=${n}`;

describe('paginationModel', () => {
  it('is empty for zero or one page', () => {
    expect(paginationModel(1, 0, href).empty).toBe(true);
    expect(paginationModel(1, 1, href).empty).toBe(true);
    expect(paginationModel(1, 1, href).items).toEqual([]);
  });

  it('marks the current page and gives every other page an href', () => {
    const model = paginationModel(2, 3, href);
    expect(model.items).toEqual([
      { kind: 'page', page: 1, current: false, href: '/ar/news?page=1' },
      { kind: 'page', page: 2, current: true, href: '/ar/news?page=2' },
      { kind: 'page', page: 3, current: false, href: '/ar/news?page=3' },
    ]);
  });

  it('has no previous on the first page and no next on the last', () => {
    expect(paginationModel(1, 5, href).previous).toBeNull();
    expect(paginationModel(1, 5, href).next).toEqual({ page: 2, href: '/ar/news?page=2' });
    expect(paginationModel(5, 5, href).next).toBeNull();
    expect(paginationModel(5, 5, href).previous).toEqual({ page: 4, href: '/ar/news?page=4' });
  });

  it('elides the middle of a long run with uniquely keyed gaps', () => {
    const model = paginationModel(10, 40, href);
    const kinds = model.items.map((item) => (item.kind === 'gap' ? '…' : item.page));
    expect(kinds).toEqual([1, '…', 9, 10, 11, '…', 40]);
    const keys = model.items.filter((item) => item.kind === 'gap').map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('clamps a page that is out of range instead of rendering a phantom', () => {
    const current = (page: number, total: number) =>
      paginationModel(page, total, href).items.find((i) => i.kind === 'page' && i.current);
    expect(current(99, 5)).toMatchObject({ page: 5 });
    expect(current(0, 5)).toMatchObject({ page: 1 });
    expect(paginationModel(-3, 5, href).previous).toBeNull();
  });

  it('never returns two adjacent gaps or a gap standing in for a single page', () => {
    for (let total = 2; total <= 60; total += 1) {
      for (let page = 1; page <= total; page += 1) {
        const items = paginationModel(page, total, href).items;
        for (let i = 1; i < items.length; i += 1) {
          const prev = items[i - 1];
          const here = items[i];
          expect(prev?.kind === 'gap' && here?.kind === 'gap').toBe(false);
          if (prev?.kind === 'page' && here?.kind === 'page') {
            expect(here.page - prev.page).toBe(1);
          }
        }
      }
    }
  });
});

describe('paginationRels', () => {
  it('emits only the rels that exist', () => {
    expect(paginationRels(1, 3, href)).toEqual({ next: '/ar/news?page=2' });
    expect(paginationRels(3, 3, href)).toEqual({ prev: '/ar/news?page=2' });
    expect(paginationRels(2, 3, href)).toEqual({ prev: '/ar/news?page=1', next: '/ar/news?page=3' });
    expect(paginationRels(1, 1, href)).toEqual({});
  });
});
