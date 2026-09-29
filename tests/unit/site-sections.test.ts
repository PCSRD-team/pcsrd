import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE_SECTIONS, isSiteSection } from '@/lib/site-sections';

/**
 * `src/proxy.ts` answers any first segment missing from `SITE_SECTIONS` with a
 * 404, so a section added to the app but not to the list would 404 in
 * production. This compares the list with the directories themselves.
 */
const SITE_ROOT = join(process.cwd(), 'src', 'app', '(site)', '[locale]');

describe('SITE_SECTIONS', () => {
  it('names exactly the route directories under (site)/[locale]', () => {
    const directories = readdirSync(SITE_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      // Dynamic segments, route groups and private folders are not sections.
      .filter((name) => !/^[[(_]/.test(name))
      .sort();

    expect([...SITE_SECTIONS].sort()).toEqual(directories);
  });

  it('accepts the hashed metadata image segments', () => {
    expect(isSiteSection('opengraph-image-1yhjss')).toBe(true);
    expect(isSiteSection('twitter-image-abc123')).toBe(true);
  });

  it('refuses an unknown segment', () => {
    expect(isSiteSection('no-such-page')).toBe(false);
    expect(isSiteSection('')).toBe(false);
  });
});
