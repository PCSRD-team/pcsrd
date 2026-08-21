import { describe, expect, it } from 'vitest';
import { paginationRange } from '@/lib/utils';

/**
 * The first unit tests in the repository. `test:unit` passed with zero test
 * files because of `--passWithNoTests`, which is a green check that asserts
 * nothing.
 *
 * `paginationRange` is a good first subject: pure, total, and with edge cases
 * that are easy to get subtly wrong — the single-skipped-page rule in
 * particular, where a `…` hiding one number costs a click and saves nothing.
 */
describe('paginationRange', () => {
  it('returns nothing for an empty result and a single page for one', () => {
    expect(paginationRange(1, 0)).toEqual([]);
    expect(paginationRange(1, 1)).toEqual([1]);
  });

  it('lists every page while they still fit', () => {
    expect(paginationRange(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(paginationRange(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('elides the middle on a long run', () => {
    expect(paginationRange(10, 40)).toEqual([1, 'gap', 9, 10, 11, 'gap', 40]);
  });

  it('keeps the first and last page reachable from anywhere', () => {
    const tokens = paginationRange(20, 40);
    expect(tokens[0]).toBe(1);
    expect(tokens.at(-1)).toBe(40);
  });

  it('renders a single skipped page rather than eliding it', () => {
    // 1 … 3 4 5 … 7  would hide exactly one number on each side; show it.
    expect(paginationRange(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('never emits two adjacent gaps', () => {
    for (let total = 1; total <= 60; total += 1) {
      for (let page = 1; page <= total; page += 1) {
        const tokens = paginationRange(page, total);
        for (let i = 1; i < tokens.length; i += 1) {
          expect(tokens[i] === 'gap' && tokens[i - 1] === 'gap').toBe(false);
        }
      }
    }
  });

  it('always includes the current page', () => {
    for (let total = 1; total <= 60; total += 1) {
      for (let page = 1; page <= total; page += 1) {
        expect(paginationRange(page, total)).toContain(page);
      }
    }
  });

  it('stays inside the range it was given', () => {
    for (let total = 1; total <= 40; total += 1) {
      for (let page = 1; page <= total; page += 1) {
        for (const token of paginationRange(page, total)) {
          if (token !== 'gap') {
            expect(token).toBeGreaterThanOrEqual(1);
            expect(token).toBeLessThanOrEqual(total);
          }
        }
      }
    }
  });
});
