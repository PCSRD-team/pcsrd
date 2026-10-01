import { adminUi } from '@/components/admin/admin-ui-dict';
import { db } from '@/db';
import { requireActor } from '@/lib/auth/guard';
import { isAppError, toActionResult } from '@/lib/errors';
import { buildXlsx, type XlsxCellValue } from '@/lib/export/xlsx';
import { ar } from '@/lib/i18n/dictionaries/ar';
import { exportConfirmedDonations } from '@/services/donations/donation.service';

export const dynamic = 'force-dynamic';

/**
 * Every confirmed gift as a spreadsheet, for the accounts.
 *
 * A route handler because the response is the file — an ordinary `<a href>`
 * that works with scripting off. The service audits the export: it lists
 * donors by name. Amounts are numbers, not text, so the accountant can sum
 * them; `buildXlsx` neutralises any cell that looks like a formula.
 */
export async function GET() {
  try {
    const actor = await requireActor();
    const rows = await exportConfirmedDonations(db, actor);
    const t = adminUi.donations;
    const c = t.columns;

    const columns = [
      c.reference,
      c.reviewedAt,
      c.transferredOn,
      c.confirmedAmount,
      c.amount,
      c.currency,
      c.method,
      c.donor,
      c.email,
      c.phone,
      c.project,
      c.bankReference,
      c.receiptNumber,
      c.anonymous,
    ];

    const data: XlsxCellValue[][] = rows.map((row) => [
      row.reference,
      row.reviewedAt,
      row.transferredOn,
      row.confirmedAmount === null ? null : Number(row.confirmedAmount),
      Number(row.amount),
      row.currency,
      ar.donate.methods[row.method],
      row.donorName,
      row.donorEmail,
      row.donorPhone,
      row.projectTitle ?? ar.donate.generalPurpose,
      row.bankReference,
      row.receiptNumber,
      row.isAnonymous ? adminUi.careers.yes : adminUi.careers.no,
    ]);

    const workbook = buildXlsx([
      {
        name: t.title,
        columns: columns.map((header) => ({ header, width: 20 })),
        rows: data,
        rightToLeft: true,
      },
    ]);

    const stamp = new Date().toISOString().slice(0, 10);
    const asciiName = `confirmed-donations-${stamp}.xlsx`;
    const utf8Name = encodeURIComponent(`${t.exportName}-${stamp}.xlsx`);

    return new Response(new Uint8Array(workbook), {
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
        'cache-control': 'no-store, private',
      },
    });
  } catch (error) {
    const result = toActionResult(error);
    return Response.json(result, { status: isAppError(error) ? error.status : 500 });
  }
}
