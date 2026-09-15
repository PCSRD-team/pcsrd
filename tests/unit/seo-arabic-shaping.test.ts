import { describe, expect, it } from 'vitest';
import { hasArabic, shapeArabicWord, shapeArabicWords } from '@/lib/seo/arabic-shaping';

/**
 * The shaper is what makes Arabic legible on the Open Graph card, so the
 * joining rules are pinned here character by character. Presentation Forms-B
 * code points are written out so a wrong form is visible in the diff.
 */

const cps = (value: string) => Array.from(value, (ch) => ch.codePointAt(0)?.toString(16).padStart(4, '0'));

describe('hasArabic', () => {
  it('detects Arabic-script characters and nothing else', () => {
    expect(hasArabic('غزة')).toBe(true);
    expect(hasArabic('Gaza 2024')).toBe(false);
    expect(hasArabic('')).toBe(false);
  });
});

describe('shapeArabicWord', () => {
  it('passes Latin through untouched', () => {
    expect(shapeArabicWord('UNICEF')).toBe('UNICEF');
    expect(shapeArabicWord('2024')).toBe('2024');
  });

  it('shapes a dual-joining run into initial/medial/final, in visual order', () => {
    // ببب → initial ب, medial ب, final ب — then reversed for left-to-right drawing.
    expect(cps(shapeArabicWord('ببب'))).toEqual(['fe90', 'fe92', 'fe91']);
  });

  it('breaks the chain after a right-joining letter', () => {
    // برنامج: ب(initial) ر(final) ن(initial) ا(final) م(initial) ج(final),
    // reversed into visual order.
    expect(cps(shapeArabicWord('برنامج'))).toEqual(['fe9e', 'fee3', 'fe8e', 'fee7', 'feae', 'fe91']);
  });

  it('renders a lone letter in its isolated form', () => {
    expect(cps(shapeArabicWord('و'))).toEqual(['feed']);
    expect(cps(shapeArabicWord('ب'))).toEqual(['fe8f']);
  });

  it('collapses lam-alef into the ligature, isolated or final', () => {
    // لا alone → isolated ligature
    expect(cps(shapeArabicWord('لا'))).toEqual(['fefb']);
    // بلا → ب initial, then the *final* ligature because ب joins into it
    expect(cps(shapeArabicWord('بلا'))).toEqual(['fefc', 'fe91']);
    // الأسر: ا isolated (nothing joins into it and it does not join forward),
    // so the ل+أ ligature is isolated too; then س initial, ر final.
    expect(cps(shapeArabicWord('الأسر'))).toEqual(['feae', 'feb3', 'fef7', 'fe8d']);
  });

  it('gives ة only a final form and never joins forward', () => {
    // غزة: غ initial, ز final, ة isolated (ز does not join forward)
    expect(cps(shapeArabicWord('غزة'))).toEqual(['fe93', 'feb0', 'fecf']);
  });

  it('strips tashkeel so marks are never measured as glyphs', () => {
    expect(shapeArabicWord('مُحَمَّد')).toBe(shapeArabicWord('محمد'));
  });

  it('keeps a digit run in reading order inside an Arabic word', () => {
    // كوفيد-19 drawn left-to-right: the digits first and in order, then the
    // hyphen, then the letters reversed — the bidi outcome for a number in
    // Arabic text.
    const shaped = shapeArabicWord('كوفيد-19');
    expect(shaped.startsWith('19-')).toBe(true);
    expect(cps(shaped).slice(3)).toEqual(['feaa', 'fef4', 'fed3', 'feee', 'fedb']);
  });

  it('keeps Arabic-Indic digits in reading order too', () => {
    expect(shapeArabicWord('٢٠٢٤')).toBe('٢٠٢٤');
    expect(shapeArabicWord('عام٢٠٢٤').startsWith('٢٠٢٤')).toBe(true);
  });

  it('mirrors brackets so the drawn word still reads as (word)', () => {
    // Logical "(" is first, so it sits at the right edge; the renderer draws
    // left-to-right, so the visual string must open on the left and close on
    // the right after mirroring each glyph.
    const shaped = shapeArabicWord('(الثانية)');
    expect(shaped.startsWith('(')).toBe(true);
    expect(shaped.endsWith(')')).toBe(true);
  });

  it('leaves tatweel in the chain', () => {
    // بـب: ب initial, tatweel, ب final
    expect(cps(shapeArabicWord('بـب'))).toEqual(['fe90', '0640', 'fe91']);
  });
});

describe('shapeArabicWords', () => {
  it('splits on any whitespace and drops empties', () => {
    expect(shapeArabicWords('  برنامج   تمكين\nالشباب ')).toHaveLength(3);
    expect(shapeArabicWords('')).toEqual([]);
  });

  it('keeps Latin words inside an Arabic title intact', () => {
    const words = shapeArabicWords('بالشراكة مع UNICEF');
    expect(words[2]).toBe('UNICEF');
  });
});
