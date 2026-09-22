import { describe, expect, it } from 'vitest';
import { safeReturnPath, withFlash } from '@/actions/admin/flash';

/**
 * `returnTo` is attacker-controllable: it arrives as a form field on a POST.
 * The rule that keeps it same-origin had no test at all, and it was written
 * out twice — once here and once as a Zod regex in `src/lib/validation/admin.ts`
 * — so the two could drift and the Zod copy, which runs first, would win
 * silently. There is one pattern now, and these are its cases.
 */

describe('safeReturnPath — what it refuses', () => {
  for (const hostile of [
    'https://evil.example/admin',
    'http://evil.example',
    '//evil.example',
    '//evil.example/admin',
    '/admin/../../etc',
    '/adminsomething-else',
    '/dashboard',
    'javascript:alert(1)',
    '/admin#/../evil',
    '/admin/posts?next=https://evil.example',
    '',
  ]) {
    it(`replaces ${JSON.stringify(hostile)} with /admin`, () => {
      expect(safeReturnPath(hostile)).toBe('/admin');
    });
  }

  it('replaces a non-string', () => {
    expect(safeReturnPath(undefined)).toBe('/admin');
    expect(safeReturnPath(null)).toBe('/admin');
    expect(safeReturnPath(42)).toBe('/admin');
    expect(safeReturnPath(['/admin'])).toBe('/admin');
  });
});

describe('safeReturnPath — what it allows', () => {
  for (const ok of [
    '/admin',
    '/admin/',
    '/admin/posts',
    '/admin/posts/',
    '/admin/media/new',
    // The case the rule used to reject, which sent an editor publishing from
    // page 3 of a filtered list back to page 1 of an unfiltered one.
    '/admin/posts?page=3',
    '/admin/posts?q=gaza&status=draft&page=2',
    '/admin/posts?q=%D8%BA%D8%B2%D8%A9',
  ]) {
    it(`keeps ${ok}`, () => {
      expect(safeReturnPath(ok)).toBe(ok);
    });
  }
});

describe('withFlash', () => {
  it('merges the outcome into an existing query rather than concatenating', () => {
    const href = withFlash('/admin/posts?page=3', { ok: true, data: null, messageKey: 'admin.saved' });
    const url = new URL(href, 'https://example.invalid');
    expect(url.pathname).toBe('/admin/posts');
    // The bug this replaces produced `?page=3?ok=admin.saved`, losing both.
    expect(url.searchParams.get('page')).toBe('3');
    expect(url.searchParams.get('ok')).toBe('admin.saved');
  });

  it('carries an error as a dictionary key, never prose', () => {
    const href = withFlash('/admin/pages', {
      ok: false,
      code: 'conflict',
      messageKey: 'errors.content.keyTaken',
    });
    expect(href).toBe('/admin/pages?err=errors.content.keyTaken');
  });

  it('falls back to admin.saved when an ok result names no message', () => {
    expect(withFlash('/admin', { ok: true, data: null })).toBe('/admin?ok=admin.saved');
  });

  it('does not follow a hostile returnTo even with a valid result', () => {
    const href = withFlash('https://evil.example/admin', { ok: true, data: null });
    expect(href.startsWith('/admin?')).toBe(true);
  });
});
