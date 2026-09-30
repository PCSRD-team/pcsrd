import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
// The function Next's own metadata-image loader calls to build the card URL.
import { fillMetadataSegment } from 'next/dist/lib/metadata/get-metadata-route';
import { SITE_CARD_SEGMENT } from '@/lib/seo/metadata';

/**
 * `SITE_CARD_SEGMENT` is written out in `src/lib/seo/metadata.ts` because a
 * static page must name the `[locale]` card explicitly (a page-level
 * `openGraph` replaces the layout's, file card included). The segment carries
 * a hash Next derives from the parent path; this recomputes it with Next's own
 * function so an upgrade that changes the scheme, or a move of the file, fails
 * here instead of silently shipping cards that 404.
 */
describe('site-wide Open Graph card URL', () => {
  it('matches the segment Next generates for (site)/[locale]/opengraph-image', () => {
    const url = fillMetadataSegment('/(site)/[locale]', { locale: 'ar' }, 'opengraph-image', false);
    expect(url).toBe(`/ar/${SITE_CARD_SEGMENT}`);
  });

  it('points at a file that exists', () => {
    expect(existsSync(path.join(process.cwd(), 'src/app/(site)/[locale]/opengraph-image.tsx'))).toBe(true);
  });
});
