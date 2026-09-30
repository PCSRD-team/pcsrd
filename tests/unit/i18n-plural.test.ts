import { describe, expect, it } from 'vitest';
import { ar } from '@/lib/i18n/dictionaries/ar';
import { en } from '@/lib/i18n/dictionaries/en';
import { plural } from '@/lib/i18n/plural';

/**
 * Arabic counts agree with their number in six ways; a single `'{n} مشروع'`
 * template is right for one of them. These pin the CLDR category each count
 * lands in, using the dictionary's own forms.
 */
describe('plural', () => {
  const projects = ar.programs.projectsCount;

  it('picks every Arabic form', () => {
    expect(plural('ar', 0, projects)).toBe('لا مشاريع');
    expect(plural('ar', 1, projects)).toBe('مشروع واحد');
    expect(plural('ar', 2, projects)).toBe('مشروعان');
    expect(plural('ar', 3, projects)).toBe('3 مشاريع');
    expect(plural('ar', 10, projects)).toBe('10 مشاريع');
    expect(plural('ar', 11, projects)).toBe('11 مشروعاً');
    expect(plural('ar', 99, projects)).toBe('99 مشروعاً');
    expect(plural('ar', 100, projects)).toBe('100 مشروع');
    expect(plural('ar', 103, projects)).toBe('103 مشاريع');
  });

  it('uses zero in English too, and "other" from two up', () => {
    const forms = en.programs.projectsCount;
    expect(plural('en', 0, forms)).toBe('No projects');
    expect(plural('en', 1, forms)).toBe('One project');
    expect(plural('en', 2, forms)).toBe('2 projects');
  });

  it('fills {n} with the display string when one is given', () => {
    expect(plural('ar', 1200, ar.projects.resultsCount, '1,200')).toBe('1,200 نتيجة');
  });

  it('agrees the retention period with its months', () => {
    expect(plural('ar', 12, ar.apply.retentionNoticeCount)).toContain('12 شهراً');
    expect(plural('ar', 6, ar.apply.retentionNoticeCount)).toContain('6 أشهر');
    expect(plural('ar', 2, ar.apply.retentionNoticeCount)).toContain('شهرين');
  });
});
