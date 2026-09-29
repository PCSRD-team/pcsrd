import { describe, expect, it } from 'vitest';
import { decodeParam } from '@/lib/route-params';

/**
 * Arabic slugs reach a page percent-encoded on the server render. Undecoded,
 * the lookup matched nothing and every Arabic detail page shipped its loading
 * skeleton instead of its content (docs/PROGRESS.md §5.1.3).
 */
describe('decodeParam', () => {
  it('decodes a percent-encoded Arabic slug', () => {
    expect(
      decodeParam('%D8%A7%D9%84%D8%AA%D8%B9%D8%A7%D9%81%D9%8A-%D8%A7%D9%84%D9%85%D8%A8%D9%83%D8%B1'),
    ).toBe('التعافي-المبكر');
  });

  it('leaves an already-decoded slug unchanged', () => {
    expect(decodeParam('التعافي-المبكر')).toBe('التعافي-المبكر');
    expect(decodeParam('field-officer')).toBe('field-officer');
  });

  it('returns a malformed escape as given rather than throwing', () => {
    expect(decodeParam('%E0%A4%A')).toBe('%E0%A4%A');
  });
});
