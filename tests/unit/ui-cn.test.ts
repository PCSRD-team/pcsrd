import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';
import { buttonClasses } from '@/components/ui/button';

/**
 * `cn()` is `clsx` + `tailwind-merge`. The property the kit relies on is
 * that a caller's `className` wins over the component's default for the
 * same utility — so a `Card` can be given `p-0` without the kit exposing a
 * prop for every possible override.
 */
describe('cn', () => {
  it('drops falsy inputs', () => {
    expect(cn('a', false, null, undefined, 0, '', 'b')).toBe('a b');
  });

  it('lets the later class win for the same utility', () => {
    expect(cn('p-6 md:p-8', 'p-0')).toBe('md:p-8 p-0');
    expect(cn('bg-paper text-ink', 'bg-paper-alt')).toBe('text-ink bg-paper-alt');
  });

  it('keeps the two inline sides distinct', () => {
    // `ps-4` and `pe-4` are different sides; neither should erase the other.
    expect(cn('ps-4', 'pe-4')).toBe('ps-4 pe-4');
    expect(cn('ps-4', 'ps-6')).toBe('ps-6');
  });

  it('merges the design tokens registered in globals.css', () => {
    expect(cn('text-small', 'text-caption')).toBe('text-caption');
    expect(cn('text-ink-55', 'text-destructive')).toBe('text-destructive');
    expect(cn('min-h-target', 'min-h-11')).toBe('min-h-11');
    expect(cn('max-w-narrow', 'max-w-xl')).toBe('max-w-xl');
  });

  it('keeps a size token beside a colour token — they are not in conflict', () => {
    // Without `extendTailwindMerge` this returned 'text-ink': the merger
    // took `text-small` for a colour and dropped it.
    expect(cn('text-small text-ink')).toBe('text-small text-ink');
    expect(cn('font-mono text-eyebrow', 'text-gold-700')).toBe('font-mono text-eyebrow text-gold-700');
    expect(cn('text-h2', 'text-ink', 'text-h1')).toBe('text-ink text-h1');
  });
});

describe('buttonClasses', () => {
  it('keeps the 44px minimum on every size', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      expect(buttonClasses({ size })).toContain('min-h-target');
    }
  });

  it('resolves the older tone names to the canonical four', () => {
    expect(buttonClasses({ tone: 'outline' })).toBe(buttonClasses({ tone: 'secondary' }));
    expect(buttonClasses({ tone: 'ghost' })).toBe(buttonClasses({ tone: 'quiet' }));
    expect(buttonClasses({ tone: 'destructive' })).toBe(buttonClasses({ tone: 'danger' }));
  });

  it('never fills with gold, rounds a corner or casts a shadow', () => {
    for (const tone of ['primary', 'secondary', 'quiet', 'danger', 'marked'] as const) {
      const classes = buttonClasses({ tone });
      expect(classes).not.toMatch(/\bbg-gold-(600|500)\b/);
      expect(classes).not.toMatch(/\brounded/);
      expect(classes).not.toMatch(/\bshadow/);
      expect(classes).not.toMatch(/\btext-gold-600\b/);
    }
  });

  it('applies the caller class last', () => {
    expect(buttonClasses({ className: 'w-full' })).toMatch(/w-full$/);
  });
});
