import { db } from '@/db';
import type { ApplicationStatus } from '@/db/schema/enums';
import { applicationStatus } from '@/db/schema/enums';
import { requireActor } from '@/lib/auth/guard';
import { isAppError, toActionResult } from '@/lib/errors';
import { buildXlsx, type XlsxCellValue } from '@/lib/export/xlsx';
import {
  EXPORT_ROW_LIMIT,
  buildExportTable,
} from '@/services/applications/application.service';
import { getForm } from '@/services/applications/application-form.service';

export const dynamic = 'force-dynamic';

/**
 * The applicants spreadsheet.
 *
 * A route handler rather than a Server Action because the response **is** the
 * file. A Server Action returns a serialisable value to React; it cannot set
 * `Content-Disposition`, and the alternative — returning bytes and assembling a
 * download in the browser — would put the whole export behind JavaScript. This
 * way the export button is an ordinary `<a href>`, works with scripting off,
 * and the browser's own download manager handles a multi-megabyte file.
 *
 * `includeSensitive=1` is opt-in and audited by the service. A routine export
 * of a shortlist must not put ninety national ID numbers into a file that will
 * be emailed around, so the default leaves those columns out entirely and
 * asking for them is a recorded act.
 *
 * The filename is ASCII-safe in `filename` and UTF-8 in `filename*`, because
 * the form's title is Arabic and a bare `filename=` with non-ASCII bytes is
 * interpreted differently by every browser — some produce mojibake, some
 * truncate at the first high byte.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const url = new URL(_request.url);

    const rawStatus = url.searchParams.get('status') ?? '';
    const status = (applicationStatus.enumValues as readonly string[]).includes(rawStatus)
      ? (rawStatus as ApplicationStatus)
      : undefined;

    const includeSensitive = url.searchParams.get('includeSensitive') === '1';

    // The form is loaded for its title and for the permission check the
    // service performs; the table read is the expensive half and runs after.
    const form = await getForm(db, actor, id);

    const table = await buildExportTable(db, actor, id, {
      includeSensitive,
      filters: {
        status,
        waitlistedOnly: url.searchParams.get('waitlisted') === '1',
      },
    });

    // The five columns the portal owns come first, before the form's own
    // questions: a reviewer opening the file wants the reference and the
    // status without scrolling past forty answers to find them.
    const meta = [
      { key: '__reference', label: 'الرقم المرجعي' },
      { key: '__status', label: 'الحالة' },
      { key: '__waitlisted', label: 'قائمة الانتظار' },
      { key: '__rating', label: 'التقييم' },
      { key: '__createdAt', label: 'تاريخ التقديم' },
      { key: '__attachments', label: 'المرفقات' },
    ];

    const columns = [...meta, ...table.columns];

    const rows: XlsxCellValue[][] = table.rows.map((row) =>
      columns.map(({ key }) => toCell(row[key])),
    );

    const workbook = buildXlsx([
      {
        // Sheet names are capped at 31 characters and may not contain
        // `: \ / ? * [ ]`; `buildXlsx` sanitises rather than throwing, so a
        // form title with a slash in it does not fail an export.
        name: form.titleAr,
        columns: columns.map((column) => ({
          header: column.label,
          width: column.key.startsWith('__') ? 16 : 24,
        })),
        rows,
        rightToLeft: true,
      },
    ]);

    const asciiName = `applicants-${form.slug.replace(/[^\w.-]/g, '_')}.xlsx`;
    const utf8Name = encodeURIComponent(`متقدمو-${form.titleAr}.xlsx`);

    return new Response(new Uint8Array(workbook), {
      headers: {
        'content-type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
        // Never cached, by anything. A spreadsheet of applicants is the last
        // thing that should sit in a shared proxy or a browser's disk cache.
        'cache-control': 'no-store, private',
        // Says plainly whether the file is the whole set. A truncated export
        // that looks complete is how a shortlist quietly loses its last
        // hundred applicants.
        'x-export-complete': String(table.rows.length < EXPORT_ROW_LIMIT),
      },
    });
  } catch (error) {
    const result = toActionResult(error);
    return Response.json(result, { status: isAppError(error) ? error.status : 500 });
  }
}

/**
 * Flattens one stored answer into a single cell.
 *
 * A `multi_select` is an array and a spreadsheet cell is not, so the values are
 * joined with the Arabic comma. A boolean becomes a word rather than TRUE /
 * FALSE, because the file is read by recruitment staff, not by a formula.
 * Attachments become a count — a signed URL expires in sixty seconds and would
 * be dead before anyone opened the file.
 */
function toCell(value: unknown): XlsxCellValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  if (typeof value === 'number') return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    // The attachments column: objects, not answers.
    if (typeof value[0] === 'object' && value[0] !== null) return value.length;
    return value.join('، ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
