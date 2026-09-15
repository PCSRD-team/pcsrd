/**
 * Arabic shaping for Satori.
 *
 * **Why this file exists.** `next/og` renders through Satori 0.25, which has
 * no bidirectional text support and measures text one grapheme at a time
 * (`measureText` sums `measure(grapheme)` — verified in
 * `node_modules/next/dist/compiled/@vercel/og/index.node.js`). For Arabic that
 * produces two visible defects on every card:
 *
 * 1. Words are laid out left-to-right in logical order, so a multi-word Arabic
 *    title reads backwards.
 * 2. Each letter is measured in its *isolated* form while the drawn path uses
 *    the connected form, which is narrower — so every word sits in a box 30–60%
 *    wider than its glyphs and the gaps between words look justified.
 *
 * The fix is to hand Satori text it cannot get wrong: every Arabic word is
 * converted to Unicode **Presentation Forms-B** (U+FE70–U+FEFF), one code point
 * per contextual glyph, in **visual** (reversed) order. Measurement and drawing
 * then agree exactly, and the caller lays words out as flex items in a
 * `row-reverse` wrapping container so line order is right-to-left.
 *
 * Deliberately narrow: this shapes the Arabic block letters IBM Plex Sans
 * Arabic covers, handles the four lam-alef ligatures, strips tashkeel (an OG
 * card does not need vowel marks and Satori would measure them as full
 * glyphs), and mirrors brackets. Anything outside that — Persian and Urdu
 * letters, Arabic-Indic digits, Latin — passes through unchanged. Numbers and
 * Latin runs keep their internal left-to-right order.
 *
 * Zero imports. Pure. Unit-tested in `tests/unit/seo-arabic-shaping.test.ts`.
 */

type Forms = readonly [isolated: number, final: number, initial?: number, medial?: number];

/**
 * Presentation Forms-B for the Arabic block. A two-entry tuple is a letter
 * that joins only to the letter *before* it (right-joining); a four-entry
 * tuple joins on both sides.
 */
const FORMS: ReadonlyMap<number, Forms> = new Map<number, Forms>([
  [0x0621, [0xfe80, 0xfe80]], // ء — non-joining; the "final" is the same glyph
  [0x0622, [0xfe81, 0xfe82]], // آ
  [0x0623, [0xfe83, 0xfe84]], // أ
  [0x0624, [0xfe85, 0xfe86]], // ؤ
  [0x0625, [0xfe87, 0xfe88]], // إ
  [0x0626, [0xfe89, 0xfe8a, 0xfe8b, 0xfe8c]], // ئ
  [0x0627, [0xfe8d, 0xfe8e]], // ا
  [0x0628, [0xfe8f, 0xfe90, 0xfe91, 0xfe92]], // ب
  [0x0629, [0xfe93, 0xfe94]], // ة
  [0x062a, [0xfe95, 0xfe96, 0xfe97, 0xfe98]], // ت
  [0x062b, [0xfe99, 0xfe9a, 0xfe9b, 0xfe9c]], // ث
  [0x062c, [0xfe9d, 0xfe9e, 0xfe9f, 0xfea0]], // ج
  [0x062d, [0xfea1, 0xfea2, 0xfea3, 0xfea4]], // ح
  [0x062e, [0xfea5, 0xfea6, 0xfea7, 0xfea8]], // خ
  [0x062f, [0xfea9, 0xfeaa]], // د
  [0x0630, [0xfeab, 0xfeac]], // ذ
  [0x0631, [0xfead, 0xfeae]], // ر
  [0x0632, [0xfeaf, 0xfeb0]], // ز
  [0x0633, [0xfeb1, 0xfeb2, 0xfeb3, 0xfeb4]], // س
  [0x0634, [0xfeb5, 0xfeb6, 0xfeb7, 0xfeb8]], // ش
  [0x0635, [0xfeb9, 0xfeba, 0xfebb, 0xfebc]], // ص
  [0x0636, [0xfebd, 0xfebe, 0xfebf, 0xfec0]], // ض
  [0x0637, [0xfec1, 0xfec2, 0xfec3, 0xfec4]], // ط
  [0x0638, [0xfec5, 0xfec6, 0xfec7, 0xfec8]], // ظ
  [0x0639, [0xfec9, 0xfeca, 0xfecb, 0xfecc]], // ع
  [0x063a, [0xfecd, 0xfece, 0xfecf, 0xfed0]], // غ
  [0x0641, [0xfed1, 0xfed2, 0xfed3, 0xfed4]], // ف
  [0x0642, [0xfed5, 0xfed6, 0xfed7, 0xfed8]], // ق
  [0x0643, [0xfed9, 0xfeda, 0xfedb, 0xfedc]], // ك
  [0x0644, [0xfedd, 0xfede, 0xfedf, 0xfee0]], // ل
  [0x0645, [0xfee1, 0xfee2, 0xfee3, 0xfee4]], // م
  [0x0646, [0xfee5, 0xfee6, 0xfee7, 0xfee8]], // ن
  [0x0647, [0xfee9, 0xfeea, 0xfeeb, 0xfeec]], // ه
  [0x0648, [0xfeed, 0xfeee]], // و
  [0x0649, [0xfeef, 0xfef0]], // ى
  [0x064a, [0xfef1, 0xfef2, 0xfef3, 0xfef4]], // ي
  // Tatweel joins on both sides and is its own glyph in every position.
  [0x0640, [0x0640, 0x0640, 0x0640, 0x0640]],
]);

/** Lam + alef ligatures, keyed by the alef variant: [isolated, final]. */
const LAM_ALEF: ReadonlyMap<number, readonly [number, number]> = new Map([
  [0x0622, [0xfef5, 0xfef6]], // لآ
  [0x0623, [0xfef7, 0xfef8]], // لأ
  [0x0625, [0xfef9, 0xfefa]], // لإ
  [0x0627, [0xfefb, 0xfefc]], // لا
]);

const LAM = 0x0644;

/** Brackets are mirrored in a right-to-left run. */
const MIRROR: ReadonlyMap<string, string> = new Map([
  ['(', ')'],
  [')', '('],
  ['[', ']'],
  [']', '['],
  ['{', '}'],
  ['}', '{'],
  ['<', '>'],
  ['>', '<'],
  ['«', '»'],
  ['»', '«'],
]);

/** Tashkeel and other combining marks that carry no width of their own. */
function isTashkeel(cp: number): boolean {
  return (
    (cp >= 0x064b && cp <= 0x065f) ||
    cp === 0x0670 ||
    (cp >= 0x06d6 && cp <= 0x06ed) ||
    (cp >= 0x08d3 && cp <= 0x08ff)
  );
}

/** Every Arabic-script code point, including the ones this file does not shape. */
export function isArabicLetter(cp: number): boolean {
  return (
    (cp >= 0x0600 && cp <= 0x06ff) ||
    (cp >= 0x0750 && cp <= 0x077f) ||
    (cp >= 0x08a0 && cp <= 0x08ff) ||
    (cp >= 0xfb50 && cp <= 0xfdff) ||
    (cp >= 0xfe70 && cp <= 0xfeff)
  );
}

/** True when the string has any Arabic-script character at all. */
export function hasArabic(text: string): boolean {
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && isArabicLetter(cp)) return true;
  }
  return false;
}

const joinsNext = (cp: number): boolean => (FORMS.get(cp)?.length ?? 0) === 4;
const joinsPrev = (cp: number): boolean => FORMS.has(cp) && cp !== 0x0621;

/**
 * Shapes one Arabic **word** — a run with no spaces — into Presentation
 * Forms-B in logical order. Non-Arabic characters pass through and break the
 * joining chain.
 */
function shapeLogical(cps: readonly number[]): number[] {
  const out: number[] = [];
  const letters = cps.filter((cp) => !isTashkeel(cp));

  for (let i = 0; i < letters.length; i++) {
    const cp = letters[i];
    if (cp === undefined) continue;
    const forms = FORMS.get(cp);
    if (!forms) {
      out.push(cp);
      continue;
    }

    const prev = i > 0 ? letters[i - 1] : undefined;
    const next = letters[i + 1];
    const prevJoins = prev !== undefined && joinsNext(prev);

    // Lam-alef is a single glyph; consume the alef.
    if (cp === LAM && next !== undefined && LAM_ALEF.has(next)) {
      const lig = LAM_ALEF.get(next);
      if (lig) {
        out.push(prevJoins ? lig[1] : lig[0]);
        i += 1;
        continue;
      }
    }

    const nextJoins = next !== undefined && joinsPrev(next) && joinsNext(cp);
    const [isolated, final, initial, medial] = forms;

    if (prevJoins && nextJoins && medial !== undefined) out.push(medial);
    else if (prevJoins) out.push(final);
    else if (nextJoins && initial !== undefined) out.push(initial);
    else out.push(isolated);
  }

  return out;
}

/** Digits (ASCII, Arabic-Indic, Extended) and Latin letters read left-to-right even inside Arabic. */
function isLtrChar(cp: number): boolean {
  return (
    (cp >= 0x30 && cp <= 0x39) ||
    (cp >= 0x41 && cp <= 0x5a) ||
    (cp >= 0x61 && cp <= 0x7a) ||
    (cp >= 0x0660 && cp <= 0x0669) ||
    (cp >= 0x06f0 && cp <= 0x06f9)
  );
}

/**
 * Converts a word to the string Satori should draw: shaped, in visual order.
 *
 * The word is reversed as a whole (the renderer draws left-to-right), except
 * that runs of digits and Latin letters keep their internal order — the
 * Unicode bidi outcome for a number inside Arabic text. Punctuation travels
 * with the Arabic and is mirrored where it has a mirror, so a hyphen before
 * a number and a bracket around a word both land where a reader expects.
 */
export function shapeArabicWord(word: string): string {
  if (!hasArabic(word)) return word;

  const cps = Array.from(word, (ch) => ch.codePointAt(0) ?? 0);
  const shaped = shapeLogical(cps);

  const runs: { ltr: boolean; cps: number[] }[] = [];
  for (const cp of shaped) {
    const ltr = isLtrChar(cp);
    const last = runs[runs.length - 1];
    if (last && last.ltr === ltr) last.cps.push(cp);
    else runs.push({ ltr, cps: [cp] });
  }

  return runs
    .reverse()
    .map((run) => {
      if (run.ltr) return String.fromCodePoint(...run.cps);
      return run.cps
        .slice()
        .reverse()
        .map((cp) => {
          const ch = String.fromCodePoint(cp);
          return MIRROR.get(ch) ?? ch;
        })
        .join('');
    })
    .join('');
}

/**
 * Splits a title into the words the card lays out as flex items, each
 * already shaped. Whitespace collapses; an empty title yields no words.
 */
export function shapeArabicWords(text: string): string[] {
  return text
    .split(/\s+/u)
    .filter((word) => word.length > 0)
    .map(shapeArabicWord);
}
