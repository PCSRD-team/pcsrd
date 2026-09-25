import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { buildXlsx, columnLetter, type XlsxSheet } from '@/lib/export/xlsx';

/**
 * The XLSX writer is hand-rolled, so nothing external vouches for its output.
 * These tests stand in for the three programs that will actually open the file
 * and cannot be run here.
 *
 * Two kinds of failure are being defended against, and they fail differently:
 *
 * - **Structural.** A wrong CRC, a wrong offset or a missing part gives Excel's
 *   repair dialog. Loud, and caught by reading the archive back.
 * - **Silent.** Mojibake instead of Arabic, or an applicant's `=HYPERLINK(...)`
 *   executing on the admin's machine. The file opens perfectly and is wrong.
 *   That is what most of this file is about.
 */

// ─────────────────────────────────────────────────────────────────────────────
// A minimal unzip, so the assertions read the real bytes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Walks the central directory and inflates every entry.
 *
 * Deliberately reads the **central directory** rather than scanning for local
 * headers: the central directory is what Excel reads, so verifying it verifies
 * the thing that matters. A file whose local headers are perfect and whose
 * central offsets are off by six bytes would pass a local-header scan and fail
 * in Excel — which is exactly the `deflateSync`-instead-of-`deflateRawSync`
 * mistake this is here to catch.
 */
function unzip(buffer: Buffer): Map<string, string> {
  // The EOCD is 22 bytes plus a comment of up to 65,535. We write no comment,
  // but scanning backwards for the signature is what a real reader does and it
  // keeps the helper honest if that ever changes.
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  expect(eocd, 'end-of-central-directory record not found').toBeGreaterThanOrEqual(0);

  const entryCount = buffer.readUInt16LE(eocd + 10);
  let pointer = buffer.readUInt32LE(eocd + 16);

  const parts = new Map<string, string>();

  for (let n = 0; n < entryCount; n += 1) {
    expect(buffer.readUInt32LE(pointer), 'central directory header signature').toBe(
      0x02014b50,
    );

    const method = buffer.readUInt16LE(pointer + 10);
    const compressedSize = buffer.readUInt32LE(pointer + 20);
    const uncompressedSize = buffer.readUInt32LE(pointer + 24);
    const nameLength = buffer.readUInt16LE(pointer + 28);
    const extraLength = buffer.readUInt16LE(pointer + 30);
    const commentLength = buffer.readUInt16LE(pointer + 32);
    const localOffset = buffer.readUInt32LE(pointer + 42);
    const name = buffer.toString('utf8', pointer + 46, pointer + 46 + nameLength);

    expect(method, `${name} must be deflated`).toBe(8);
    expect(buffer.readUInt32LE(localOffset), `${name} local header signature`).toBe(
      0x04034b50,
    );

    // The data starts after the local header, whose own name and extra-field
    // lengths are authoritative — they are allowed to differ from the central
    // directory's, so they must be read from the local header itself.
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;

    const deflated = buffer.subarray(dataStart, dataStart + compressedSize);
    const inflated = inflateRawSync(deflated);

    // If this holds, the sizes in the header agree with what actually
    // decompresses — which is the property a corrupt archive violates.
    expect(inflated.length, `${name} uncompressed size`).toBe(uncompressedSize);

    parts.set(name, inflated.toString('utf8'));
    pointer += 46 + nameLength + extraLength + commentLength;
  }

  return parts;
}

/** A small, ordinary workbook used by most of the assertions below. */
function sampleSheet(overrides: Partial<XlsxSheet> = {}): XlsxSheet {
  return {
    name: 'المتقدمون',
    columns: [{ header: 'الاسم الرباعي' }, { header: 'الحالة', width: 24 }],
    rows: [['محمد أحمد', 'قيد المراجعة']],
    ...overrides,
  };
}

function sheet1Of(sheets: XlsxSheet[]): string {
  const part = unzip(buildXlsx(sheets)).get('xl/worksheets/sheet1.xml');
  expect(part, 'sheet1.xml missing').toBeDefined();
  return part ?? '';
}

// ─────────────────────────────────────────────────────────────────────────────

describe('the ZIP container', () => {
  it('starts with the ZIP local file header magic', () => {
    const buffer = buildXlsx([sampleSheet()]);
    expect(buffer.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  });

  it('carries every part an xlsx needs, each well-formed enough to name its root', () => {
    const parts = unzip(buildXlsx([sampleSheet()]));

    const expected: Array<[string, string]> = [
      ['[Content_Types].xml', '<Types'],
      ['_rels/.rels', '<Relationships'],
      ['xl/workbook.xml', '<workbook'],
      ['xl/_rels/workbook.xml.rels', '<Relationships'],
      ['xl/styles.xml', '<styleSheet'],
      ['xl/worksheets/sheet1.xml', '<worksheet'],
    ];

    for (const [name, root] of expected) {
      const xml = parts.get(name);
      expect(xml, `${name} is missing from the archive`).toBeDefined();
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
      expect(xml).toContain(root);
      // Closing tag present means the part was not truncated mid-write.
      expect(xml).toContain(`</${root.slice(1)}>`);
    }

    expect(parts.size).toBe(expected.length);
  });

  it('writes one worksheet part per sheet and relates them all', () => {
    const parts = unzip(
      buildXlsx([sampleSheet(), sampleSheet({ name: 'الشواغر' })]),
    );

    expect(parts.has('xl/worksheets/sheet1.xml')).toBe(true);
    expect(parts.has('xl/worksheets/sheet2.xml')).toBe(true);
    // The styles relationship has to move past the last sheet, not collide with it.
    expect(parts.get('xl/_rels/workbook.xml.rels')).toContain('Id="rId3"');
    expect(parts.get('xl/_rels/workbook.xml.rels')).toContain('Target="styles.xml"');
    expect(parts.get('[Content_Types].xml')).toContain('/xl/worksheets/sheet2.xml');
  });
});

describe('Arabic', () => {
  it('round-trips verbatim through the archive', () => {
    const xml = sheet1Of([sampleSheet()]);

    // Verbatim: not escaped, not transliterated, not turned into mojibake by a
    // Latin-1 round trip somewhere in the Buffer handling.
    expect(xml).toContain('الاسم الرباعي');
    expect(xml).toContain('محمد أحمد');
  });

  it('survives in the sheet tab name too', () => {
    expect(unzip(buildXlsx([sampleSheet()])).get('xl/workbook.xml')).toContain(
      'name="المتقدمون"',
    );
  });

  it('defaults to a right-to-left sheet, and honours an explicit opt-out', () => {
    expect(sheet1Of([sampleSheet()])).toContain('rightToLeft="1"');
    expect(sheet1Of([sampleSheet({ rightToLeft: false })])).not.toContain('rightToLeft');
  });
});

describe('formula injection', () => {
  it("prefixes every leading character Excel would read as a formula with '", () => {
    const xml = sheet1Of([
      {
        name: 'x',
        columns: [{ header: 'a' }, { header: 'b' }, { header: 'c' }],
        rows: [['=SUM(A1)', '+1234', '@foo']],
      },
    ]);

    expect(xml).toContain("<t xml:space=\"preserve\">'=SUM(A1)</t>");
    expect(xml).toContain("<t xml:space=\"preserve\">'+1234</t>");
    expect(xml).toContain("<t xml:space=\"preserve\">'@foo</t>");
  });

  it('also guards a leading minus, tab and carriage return', () => {
    const xml = sheet1Of([
      {
        name: 'x',
        columns: [{ header: 'a' }, { header: 'b' }, { header: 'c' }],
        rows: [['-2+3', '\tcmd', '\rx']],
      },
    ]);

    expect(xml).toContain("'-2+3");
    expect(xml).toContain("'\tcmd");
    expect(xml).toContain("'\rx");
  });

  it('leaves an ordinary value alone', () => {
    const xml = sheet1Of([{ name: 'x', columns: [{ header: 'a' }], rows: [['محمد']] }]);
    expect(xml).toContain('<t xml:space="preserve">محمد</t>');
    expect(xml).not.toContain("'محمد");
  });

  it('pairs the guard with the quotePrefix style so the apostrophe is not read as a name', () => {
    const parts = unzip(buildXlsx([sampleSheet()]));
    expect(parts.get('xl/styles.xml')).toContain('quotePrefix="1"');
    // Style 3 is that xf; every text cell must carry it.
    expect(parts.get('xl/worksheets/sheet1.xml')).toContain('s="3" t="inlineStr"');
  });

  it('never guards a real number, which is not attacker-controlled text', () => {
    const xml = sheet1Of([{ name: 'x', columns: [{ header: 'n' }], rows: [[-42]] }]);
    expect(xml).toContain('<v>-42</v>');
    expect(xml).not.toContain("'-42");
  });
});

describe('XML safety', () => {
  it('escapes markup rather than emitting it', () => {
    const xml = sheet1Of([
      { name: 'x', columns: [{ header: 'a' }], rows: [['<script>&"']] },
    ]);

    expect(xml).not.toContain('<script>');
    expect(xml).toContain('&lt;script&gt;&amp;&quot;');
  });

  it('drops control characters that XML 1.0 cannot represent at all', () => {
    const xml = sheet1Of([
      { name: 'x', columns: [{ header: 'a' }], rows: [['ok\u0000\u0001\u001fbad']] },
    ]);

    expect(xml).toContain('<t xml:space="preserve">okbad</t>');
    for (const forbidden of ['\u0000', '\u0001', '\u001f']) {
      expect(xml).not.toContain(forbidden);
    }
    // The archive still decompresses to its declared size, i.e. the byte
    // accounting did not drift when characters were removed.
    expect(xml.length).toBeGreaterThan(0);
  });

  it('drops a lone surrogate but keeps a properly paired one', () => {
    const xml = sheet1Of([
      {
        name: 'x',
        columns: [{ header: 'a' }, { header: 'b' }],
        rows: [['a\uD800b', 'ok \u{1F600}']],
      },
    ]);

    expect(xml).toContain('<t xml:space="preserve">ab</t>');
    expect(xml).toContain('ok \u{1F600}');
  });

  it('sanitises a sheet name instead of throwing', () => {
    const workbook = unzip(
      buildXlsx([{ name: 'a/b:c*[d]', columns: [{ header: 'h' }], rows: [] }]),
    );
    const xml = workbook.get('xl/workbook.xml') ?? '';

    for (const forbidden of [':', '\\', '/', '?', '*', '[', ']']) {
      expect(xml).not.toContain(forbidden + 'b');
      expect(xml.includes(`name="a${forbidden}`)).toBe(false);
    }
    expect(xml).toContain('<sheet name=');
  });

  it('caps a sheet name at 31 characters and never leaves it empty', () => {
    const workbook = unzip(
      buildXlsx([
        { name: 'x'.repeat(80), columns: [], rows: [] },
        { name: '///', columns: [], rows: [] },
      ]),
    );
    const xml = workbook.get('xl/workbook.xml') ?? '';

    expect(xml).toContain(`name="${'x'.repeat(31)}"`);
    expect(xml).not.toContain(`name="${'x'.repeat(32)}"`);
    expect(xml).toContain('name="Sheet2"');
  });
});

describe('column letters', () => {
  it('counts in bijective base-26', () => {
    expect(columnLetter(1)).toBe('A');
    expect(columnLetter(26)).toBe('Z');
    // The two boundaries every naive implementation gets wrong.
    expect(columnLetter(27)).toBe('AA');
    expect(columnLetter(703)).toBe('AAA');

    expect(columnLetter(28)).toBe('AB');
    expect(columnLetter(52)).toBe('AZ');
    expect(columnLetter(53)).toBe('BA');
    expect(columnLetter(702)).toBe('ZZ');
    expect(columnLetter(16_384)).toBe('XFD'); // Excel's last column.
  });

  it('addresses the thirtieth column of a real sheet as AD', () => {
    const columns = Array.from({ length: 30 }, (_, i) => ({ header: `h${i + 1}` }));
    const xml = sheet1Of([
      { name: 'wide', columns, rows: [Array.from({ length: 30 }, (_, i) => i)] },
    ]);

    expect(xml).toContain('r="AD1"');
    expect(xml).toContain('r="AD2"');
    expect(xml).toContain('ref="A1:AD2"'); // dimension and autofilter both.
  });
});

describe('cell types', () => {
  it('converts a Date to its Excel serial against the 1899-12-30 epoch', () => {
    // Computed, not trusted: days from 1899-12-30 to each date, in UTC.
    // Cross-checked against the two serials everyone knows — 2000-01-01 is
    // 36526, and 1900-03-01 is 61 because of Excel's phantom 1900-02-29.
    const cases: Array<[string, number]> = [
      ['1900-03-01T00:00:00Z', 61],
      ['1970-01-01T00:00:00Z', 25569],
      ['2000-01-01T00:00:00Z', 36526],
      ['2026-09-22T00:00:00Z', 46287],
      ['2026-09-22T12:00:00Z', 46287.5],
    ];

    for (const [iso, serial] of cases) {
      const xml = sheet1Of([
        { name: 'd', columns: [{ header: 'when' }], rows: [[new Date(iso)]] },
      ]);
      expect(xml, iso).toContain(`<v>${serial}</v>`);
    }
  });

  it('gives a date cell the date number format, not the text style', () => {
    const parts = unzip(
      buildXlsx([
        {
          name: 'd',
          columns: [{ header: 'when' }],
          rows: [[new Date('2026-09-22T00:00:00Z')]],
        },
      ]),
    );

    expect(parts.get('xl/worksheets/sheet1.xml')).toContain('s="2"><v>46287</v>');
    expect(parts.get('xl/styles.xml')).toContain('numFmtId="164"');
  });

  it('writes numbers as values and booleans as t="b" with 1/0', () => {
    const xml = sheet1Of([
      {
        name: 't',
        columns: [{ header: 'n' }, { header: 'yes' }, { header: 'no' }],
        rows: [[3.5, true, false]],
      },
    ]);

    expect(xml).toContain('<v>3.5</v>');
    expect(xml).toContain('r="B2" s="0" t="b"><v>1</v>');
    expect(xml).toContain('r="C2" s="0" t="b"><v>0</v>');
  });

  it('emits no cell at all for null or undefined, leaving the address blank', () => {
    const xml = sheet1Of([
      {
        name: 'gaps',
        columns: [{ header: 'a' }, { header: 'b' }, { header: 'c' }],
        rows: [['x', null, undefined]],
      },
    ]);

    expect(xml).toContain('r="A2"');
    // The sparse-row contract: B2 and C2 are genuinely absent, so ISBLANK is
    // true and COUNTA skips them. An empty <c> would be a counted value.
    expect(xml).not.toContain('r="B2"');
    expect(xml).not.toContain('r="C2"');
    // Still declared within the dimension, so Excel reserves the width.
    expect(xml).toContain('ref="A1:C2"');
  });

  it('does not let NaN or Infinity reach a <v>, which would be a repair prompt', () => {
    const xml = sheet1Of([
      {
        name: 'bad',
        columns: [{ header: 'a' }, { header: 'b' }, { header: 'c' }],
        rows: [[Number.NaN, Number.POSITIVE_INFINITY, new Date('nonsense')]],
      },
    ]);

    expect(xml).not.toContain('<v>NaN</v>');
    expect(xml).not.toContain('<v>Infinity</v>');
    expect(xml).not.toContain('r="C2"'); // Invalid Date is treated as absent.
  });
});

describe('the header row', () => {
  it('is frozen, filtered, styled and sized', () => {
    const parts = unzip(buildXlsx([sampleSheet()]));
    const xml = parts.get('xl/worksheets/sheet1.xml') ?? '';

    expect(xml).toContain(
      '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>',
    );
    expect(xml).toContain('<autoFilter ref="A1:B2"/>');
    expect(xml).toContain('s="1" t="inlineStr"'); // the bold header style
    expect(xml).toContain('<col min="2" max="2" width="24" customWidth="1"/>');
    expect(xml).toContain('width="18"'); // the default for a column with none

    // autoFilter is invalid before sheetData; a sequence validator — which is
    // what Excel runs — rejects the file rather than reordering it.
    expect(xml.indexOf('<autoFilter')).toBeGreaterThan(xml.indexOf('</sheetData>'));
    expect(xml.indexOf('<cols>')).toBeLessThan(xml.indexOf('<sheetData>'));
  });

  it('omits an empty <cols>, which would fail the schema', () => {
    const xml = sheet1Of([{ name: 'bare', columns: [], rows: [] }]);
    expect(xml).not.toContain('<cols>');
    expect(xml).toContain('<sheetData>');
  });
});

describe('determinism', () => {
  it('produces byte-identical output for identical input', () => {
    const build = () =>
      buildXlsx([
        sampleSheet(),
        {
          name: 'أرقام',
          columns: [{ header: 'n' }, { header: 'when' }],
          rows: [
            [1, new Date('2026-09-22T00:00:00Z')],
            [2, null],
          ],
        },
      ]);

    // Not just equal content — equal bytes. Nothing may read the clock, which
    // is what the fixed DOS timestamp is for, and it is what lets a caching
    // layer hash the result.
    expect(build().equals(build())).toBe(true);
  });

  it('still returns a valid workbook when asked for nothing', () => {
    const parts = unzip(buildXlsx([]));
    expect(parts.get('xl/workbook.xml')).toContain('<sheet name="Sheet1"');
    expect(parts.has('xl/worksheets/sheet1.xml')).toBe(true);
  });

  it('deduplicates tab names, which Excel refuses to open', () => {
    const xml =
      unzip(
        buildXlsx([
          { name: 'تقرير', columns: [], rows: [] },
          { name: 'تقرير', columns: [], rows: [] },
        ]),
      ).get('xl/workbook.xml') ?? '';

    expect(xml).toContain('name="تقرير"');
    expect(xml).toContain('name="تقرير (2)"');
  });
});
