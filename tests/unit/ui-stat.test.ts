import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { canRenderStat, Stat, type StatPeriod, type StatVerification } from '@/components/ui/stat';

/**
 * "Never publish an impact figure without its period and verification
 * status." The types make both required; these tests cover the runtime
 * half — a seed row with an empty string type-checks and must still not
 * render a bare number.
 *
 * Rendered with `react-dom/server` in the `node` environment: no DOM, no
 * hooks, no `next/*` import in `stat.tsx`, so static markup is enough.
 */
const period: StatPeriod = { start: '2024-01-01', end: '2024-12-31', label: 'Jan 2024 – Dec 2024' };
const verification: StatVerification = { status: 'verified', label: 'Verified' };

describe('canRenderStat', () => {
  it('accepts a complete figure', () => {
    expect(canRenderStat({ value: '12,480', period, verification })).toBe(true);
    expect(canRenderStat({ value: 0, period, verification })).toBe(true);
  });

  it('refuses a missing or empty period', () => {
    expect(canRenderStat({ value: '1', period: null, verification })).toBe(false);
    expect(canRenderStat({ value: '1', period: undefined, verification })).toBe(false);
    expect(canRenderStat({ value: '1', period: { ...period, label: '' }, verification })).toBe(false);
    expect(canRenderStat({ value: '1', period: { ...period, label: '   ' }, verification })).toBe(false);
    expect(canRenderStat({ value: '1', period: { ...period, start: '' }, verification })).toBe(false);
    expect(canRenderStat({ value: '1', period: { ...period, end: '' }, verification })).toBe(false);
  });

  it('refuses a missing or unlabelled verification status', () => {
    expect(canRenderStat({ value: '1', period, verification: null })).toBe(false);
    expect(canRenderStat({ value: '1', period, verification: { status: 'verified', label: '' } })).toBe(false);
  });

  it('refuses an empty or non-finite value', () => {
    expect(canRenderStat({ value: '', period, verification })).toBe(false);
    expect(canRenderStat({ value: Number.NaN, period, verification })).toBe(false);
    expect(canRenderStat({ value: Number.POSITIVE_INFINITY, period, verification })).toBe(false);
  });
});

describe('<Stat>', () => {
  it('renders the figure with its period as text and its status as text', () => {
    const html = renderToStaticMarkup(
      createElement(Stat, {
        value: '12,480',
        unit: 'people',
        label: 'Protection services',
        period,
        verification,
        locale: 'en',
        prefix: '+',
      }),
    );
    expect(html).toContain('+12,480');
    expect(html).toContain('Protection services');
    expect(html).toMatch(/<time datetime="2024-01-01" data-period-end="2024-12-31">Jan 2024 – Dec 2024<\/time>/i);
    expect(html).toContain('data-verification="verified"');
    expect(html).toContain('Verified');
    // The figure is isolated LTR inside an Arabic paragraph.
    expect(html).toMatch(/<bdi dir="ltr"[^>]*>\+12,480<\/bdi>/);
    // The gold rule is a border (a rule), never a fill.
    expect(html).toContain('border-gold-600');
    expect(html).not.toContain('bg-gold-600');
    expect(html).not.toMatch(/\brounded/);
    expect(html).not.toMatch(/\bshadow/);
  });

  it('renders nothing when the period label is empty, even though the prop is present', () => {
    const html = renderToStaticMarkup(
      createElement(Stat, {
        value: '12,480',
        label: 'Protection services',
        period: { ...period, label: '' },
        verification,
        locale: 'ar',
      }),
    );
    expect(html).toBe('');
  });

  it('renders nothing when the verification label is empty', () => {
    const html = renderToStaticMarkup(
      createElement(Stat, {
        value: '12,480',
        label: 'Protection services',
        period,
        verification: { status: 'reported', label: '' },
        locale: 'ar',
      }),
    );
    expect(html).toBe('');
  });

  it('sets the period direction from the locale', () => {
    const ar = renderToStaticMarkup(
      createElement(Stat, { value: '1', label: 'x', period, verification, locale: 'ar' }),
    );
    expect(ar).toMatch(/<bdi dir="rtl"[^>]*><time/);
  });
});
