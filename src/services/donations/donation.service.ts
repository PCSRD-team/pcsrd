import { and, asc, count, desc, eq, ilike, or, sql, sum, type SQL } from 'drizzle-orm';
import type { Db } from '@/db';
import {
  donationAccounts,
  donations,
  donationSettings,
  projects,
  type Donation,
  type DonationAccount,
  type DonationSettings,
} from '@/db/schema';
import type { DonationMethod, DonationStatus, LocaleCode } from '@/db/schema/enums';
import { readAsActor, rowsOf, withActor } from '@/db/session';
import { AppError, notFound } from '@/lib/errors';
import { hashIp } from '@/lib/security/ip';
import type {
  DonationAccountInput,
  DonationReviewInput,
  DonationSettingsInput,
} from '@/lib/validation/donations';
import type { Actor } from '../_shared/actor';
import { writeAudit } from '../_shared/audit';
import { computeDiff } from '../_shared/diff';
import { one } from '../_shared/one';
import { assertCan } from '../_shared/permissions';

/**
 * Donations: the notices donors send after transferring, and the settings and
 * accounts the donate page shows.
 *
 * The site never handles money. A notice is a claim — "I sent 100 USD on this
 * date" — and its only path to `confirmed` is a person who has checked the bank
 * statement. Nothing here, and nothing in the database, turns a notice into a
 * confirmed gift by itself.
 *
 * Nothing imports from `next/*`, like every service.
 */

// ── The public notice ────────────────────────────────────────────────────

export type SubmitDonationInput = {
  locale: LocaleCode;
  method: DonationMethod;
  amount: string;
  currency: string;
  accountId: string | null;
  transferredOn: string | null;
  bankReference: string | null;
  projectId: string | null;
  donorName: string | null;
  donorEmail: string | null;
  donorPhone: string | null;
  isAnonymous: boolean;
  wantsReceipt: boolean;
  message: string | null;
  attachmentPath: string | null;
  ip: string | null;
  userAgent: string | null;
};

/** `app.submit_donation()` refusals → dictionary keys. Matched on the prefix. */
const REFUSALS: { marker: string; code: 'conflict' | 'validation'; key: string; field?: string }[] = [
  { marker: 'PCSRD_DONATIONS_CLOSED', code: 'conflict', key: 'errors.donation.closed' },
  { marker: 'PCSRD_DONATION_ACCOUNT', code: 'validation', key: 'errors.donation.account', field: 'accountId' },
  { marker: 'PCSRD_DONATION_PROJECT', code: 'validation', key: 'errors.donation.project', field: 'projectId' },
];

/** The message of an error and of every error it wraps — Drizzle hangs the driver's off `cause`. */
function messageChain(error: unknown, depth = 0): string {
  if (depth > 5 || error === null || error === undefined) return '';
  const own = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error ? error.cause : undefined;
  return cause === undefined ? own : `${own}\n${messageChain(cause, depth + 1)}`;
}

/**
 * Records one notice. No actor: the donor is a member of the public, and
 * `donations` has no INSERT grant — `app.submit_donation()` (SECURITY DEFINER)
 * is the only door, and it checks that donations are open and that the account
 * and project named are live.
 */
export async function submitDonation(
  db: Db,
  input: SubmitDonationInput,
): Promise<{ id: string; reference: string }> {
  try {
    return one(
      rowsOf<{ id: string; reference: string }>(
        await db.execute(sql`
          select * from app.submit_donation(
            ${input.locale}::locale_code,
            ${input.method}::donation_method,
            ${input.amount}::numeric,
            ${input.currency}::text,
            ${input.accountId}::uuid,
            ${input.transferredOn}::date,
            ${input.bankReference}::text,
            ${input.projectId}::uuid,
            ${input.donorName}::text,
            ${input.donorEmail}::text,
            ${input.donorPhone}::text,
            ${input.isAnonymous}::boolean,
            ${input.wantsReceipt}::boolean,
            ${input.message}::text,
            ${input.attachmentPath}::text,
            ${hashIp(input.ip)}::text,
            ${input.userAgent?.slice(0, 255) ?? null}::text
          )
        `),
      ),
      'donation',
    );
  } catch (error) {
    const message = messageChain(error);
    const match = REFUSALS.find((refusal) => message.includes(refusal.marker));
    if (match) {
      throw new AppError(match.code, match.key, {
        cause: error,
        ...(match.field ? { fieldErrors: { [match.field]: [match.key] } } : {}),
      });
    }
    throw error;
  }
}

// ── Reading notices ──────────────────────────────────────────────────────

export type DonationRow = Pick<
  Donation,
  | 'id'
  | 'reference'
  | 'status'
  | 'method'
  | 'amount'
  | 'currency'
  | 'confirmedAmount'
  | 'donorName'
  | 'isAnonymous'
  | 'transferredOn'
  | 'createdAt'
> & { projectTitle: string | null };

export type DonationFilter = {
  status: DonationStatus | 'all';
  q: string;
  page: number;
};

export const DONATIONS_PAGE_SIZE = 50;

export async function listDonations(
  db: Db,
  actor: Actor,
  filter: DonationFilter,
): Promise<{ rows: DonationRow[]; total: number }> {
  assertCan(actor, 'donations.manage');

  const conditions: SQL[] = [];
  if (filter.status !== 'all') conditions.push(eq(donations.status, filter.status));
  if (filter.q) {
    const term = `%${filter.q.replace(/[%_\\]/g, '\\$&')}%`;
    const match = or(
      ilike(donations.reference, term),
      ilike(donations.donorName, term),
      ilike(donations.donorEmail, term),
      ilike(donations.bankReference, term),
    );
    if (match) conditions.push(match);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return readAsActor(db, actor, async (tx) => {
    const [rows, [counted]] = await Promise.all([
      tx
        .select({
          id: donations.id,
          reference: donations.reference,
          status: donations.status,
          method: donations.method,
          amount: donations.amount,
          currency: donations.currency,
          confirmedAmount: donations.confirmedAmount,
          donorName: donations.donorName,
          isAnonymous: donations.isAnonymous,
          transferredOn: donations.transferredOn,
          createdAt: donations.createdAt,
          projectTitle: projects.titleAr,
        })
        .from(donations)
        .leftJoin(projects, eq(projects.id, donations.projectId))
        .where(where)
        .orderBy(desc(donations.createdAt))
        .limit(DONATIONS_PAGE_SIZE)
        .offset((filter.page - 1) * DONATIONS_PAGE_SIZE),
      tx.select({ n: count() }).from(donations).where(where),
    ]);
    return { rows, total: counted?.n ?? 0 };
  });
}

/** Confirmed totals per currency, and how many notices are waiting. */
export async function getDonationSummary(
  db: Db,
  actor: Actor,
): Promise<{ pending: number; confirmed: { currency: string; total: string; count: number }[] }> {
  assertCan(actor, 'donations.manage');

  return readAsActor(db, actor, async (tx) => {
    const [[pending], confirmed] = await Promise.all([
      tx.select({ n: count() }).from(donations).where(eq(donations.status, 'pending')),
      tx
        .select({
          currency: donations.currency,
          total: sum(donations.confirmedAmount),
          count: count(),
        })
        .from(donations)
        .where(eq(donations.status, 'confirmed'))
        .groupBy(donations.currency)
        .orderBy(asc(donations.currency)),
    ]);
    return {
      pending: pending?.n ?? 0,
      confirmed: confirmed.map((row) => ({
        currency: row.currency,
        total: row.total ?? '0',
        count: row.count,
      })),
    };
  });
}

export type DonationDetail = Donation & {
  projectTitle: string | null;
  account: Pick<DonationAccount, 'currency' | 'iban' | 'bankNameAr'> | null;
};

export async function getDonation(db: Db, actor: Actor, id: string): Promise<DonationDetail> {
  assertCan(actor, 'donations.manage');

  return readAsActor(db, actor, async (tx) => {
    const row = one(
      await tx
        .select({
          donation: donations,
          projectTitle: projects.titleAr,
          accountCurrency: donationAccounts.currency,
          accountIban: donationAccounts.iban,
          accountBank: donationAccounts.bankNameAr,
        })
        .from(donations)
        .leftJoin(projects, eq(projects.id, donations.projectId))
        .leftJoin(donationAccounts, eq(donationAccounts.id, donations.accountId))
        .where(eq(donations.id, id))
        .limit(1),
      'donation',
    );
    return {
      ...row.donation,
      projectTitle: row.projectTitle,
      account:
        row.accountIban && row.accountCurrency && row.accountBank
          ? { currency: row.accountCurrency, iban: row.accountIban, bankNameAr: row.accountBank }
          : null,
    };
  });
}

// ── Deciding a notice ────────────────────────────────────────────────────

/**
 * Confirm, reject, or only note.
 *
 * Confirming records the amount that actually arrived, which is not always
 * the amount the donor typed — bank charges come off an international
 * transfer — and the receipt number, if one was issued. A decision can be
 * revised (a reject that turns out to be a late transfer), and every change is
 * in the audit log with what it was before.
 */
export async function reviewDonation(
  db: Db,
  actor: Actor,
  input: DonationReviewInput,
): Promise<Donation> {
  assertCan(actor, 'donations.manage');

  return withActor(db, actor, async (tx) => {
    const before = one(
      await tx.select().from(donations).where(eq(donations.id, input.id)).limit(1),
      'donation',
    );

    const note = input.internalNote === undefined ? before.internalNote : input.internalNote || null;
    const changes: Partial<typeof donations.$inferInsert> = { internalNote: note };

    if (input.decision === 'confirm') {
      changes.status = 'confirmed';
      changes.confirmedAmount = input.confirmedAmount || null;
      changes.receiptNumber = input.receiptNumber || null;
      changes.reviewedBy = actor.id;
      changes.reviewedAt = new Date();
    } else if (input.decision === 'reject') {
      changes.status = 'rejected';
      changes.reviewedBy = actor.id;
      changes.reviewedAt = new Date();
    }

    const after = one(
      await tx.update(donations).set(changes).where(eq(donations.id, input.id)).returning(),
      'donation',
    );

    await writeAudit(tx, actor, {
      action: input.decision === 'note' ? 'update' : 'set_state',
      entityType: 'donation',
      entityId: after.id,
      diff: computeDiff(
        {
          status: before.status,
          confirmedAmount: before.confirmedAmount,
          receiptNumber: before.receiptNumber,
          internalNote: before.internalNote,
        },
        {
          status: after.status,
          confirmedAmount: after.confirmedAmount,
          receiptNumber: after.receiptNumber,
          internalNote: after.internalNote,
        },
      ),
    });

    return after;
  });
}

/**
 * The transfer slip, for download. Audited as `view_sensitive`: it shows the
 * donor's own account and name.
 */
export async function resolveDonationAttachment(
  db: Db,
  actor: Actor,
  id: string,
): Promise<{ path: string; reference: string }> {
  assertCan(actor, 'donations.manage');

  return withActor(db, actor, async (tx) => {
    const row = one(
      await tx
        .select({ path: donations.attachmentPath, reference: donations.reference })
        .from(donations)
        .where(eq(donations.id, id))
        .limit(1),
      'donation',
    );
    if (!row.path) throw notFound('attachment');

    await writeAudit(tx, actor, {
      action: 'view_sensitive',
      entityType: 'donation',
      entityId: id,
      diff: { download: { from: null, to: 'transfer_slip' } },
    });

    return { path: row.path, reference: row.reference };
  });
}

/** Erasure on request. Admin only (`donations.rt_delete`); returns the slip's path to remove. */
export async function deleteDonation(
  db: Db,
  actor: Actor,
  id: string,
): Promise<{ attachmentPath: string | null }> {
  assertCan(actor, 'donations.settings');

  return withActor(db, actor, async (tx) => {
    const [removed] = await tx
      .delete(donations)
      .where(eq(donations.id, id))
      .returning({ reference: donations.reference, attachmentPath: donations.attachmentPath });
    if (!removed) throw notFound('donation');

    await writeAudit(tx, actor, {
      action: 'delete',
      entityType: 'donation',
      entityId: id,
      diff: { reference: { from: removed.reference, to: null } },
    });

    return { attachmentPath: removed.attachmentPath };
  });
}

/** Every confirmed gift, oldest first, for the accounts. Audited: it lists donors. */
export async function exportConfirmedDonations(
  db: Db,
  actor: Actor,
): Promise<(Donation & { projectTitle: string | null })[]> {
  assertCan(actor, 'donations.manage');

  return withActor(db, actor, async (tx) => {
    const rows = await tx
      .select({ donation: donations, projectTitle: projects.titleAr })
      .from(donations)
      .leftJoin(projects, eq(projects.id, donations.projectId))
      .where(eq(donations.status, 'confirmed'))
      .orderBy(asc(donations.reviewedAt))
      .limit(20_000);

    await writeAudit(tx, actor, {
      action: 'view_sensitive',
      entityType: 'donation',
      entityId: null,
      diff: { export: { from: null, to: `${rows.length} confirmed` } },
    });

    return rows.map((row) => ({ ...row.donation, projectTitle: row.projectTitle }));
  });
}

// ── Settings and accounts (admin only) ───────────────────────────────────

export async function getDonationAdmin(
  db: Db,
  actor: Actor,
): Promise<{ settings: DonationSettings | null; accounts: DonationAccount[] }> {
  assertCan(actor, 'donations.manage');

  return readAsActor(db, actor, async (tx) => {
    const [[settings], accounts] = await Promise.all([
      tx.select().from(donationSettings).where(eq(donationSettings.id, 1)).limit(1),
      tx
        .select()
        .from(donationAccounts)
        .orderBy(asc(donationAccounts.sortOrder), asc(donationAccounts.currency)),
    ]);
    return { settings: settings ?? null, accounts };
  });
}

export async function updateDonationSettings(
  db: Db,
  actor: Actor,
  input: DonationSettingsInput,
): Promise<DonationSettings> {
  assertCan(actor, 'donations.settings');

  const columns = {
    isEnabled: input.isEnabled,
    introAr: input.introAr || null,
    introEn: input.introEn || null,
    iburaqAlias: input.iburaqAlias || null,
    iburaqQrMediaId: input.iburaqQrMediaId || null,
    cardPaymentUrl: input.cardPaymentUrl || null,
    thankYouAr: input.thankYouAr || null,
    thankYouEn: input.thankYouEn || null,
    notifyEmails: input.notifyEmails,
    updatedBy: actor.id,
  };

  return withActor(db, actor, async (tx) => {
    const [before] = await tx.select().from(donationSettings).where(eq(donationSettings.id, 1)).limit(1);

    const after = one(
      await tx
        .insert(donationSettings)
        .values({ id: 1, ...columns })
        .onConflictDoUpdate({ target: donationSettings.id, set: columns })
        .returning(),
      'donation_settings',
    );

    await writeAudit(tx, actor, {
      action: 'update',
      entityType: 'donation_settings',
      entityId: null,
      diff: computeDiff(
        (before ?? null) as unknown as Record<string, unknown> | null,
        after as unknown as Record<string, unknown>,
      ),
    });

    return after;
  });
}

export async function saveDonationAccount(
  db: Db,
  actor: Actor,
  input: DonationAccountInput,
): Promise<DonationAccount> {
  assertCan(actor, 'donations.settings');

  const columns = {
    currency: input.currency,
    bankNameAr: input.bankNameAr,
    bankNameEn: input.bankNameEn || null,
    branchAr: input.branchAr || null,
    branchEn: input.branchEn || null,
    beneficiaryAr: input.beneficiaryAr,
    beneficiaryEn: input.beneficiaryEn || null,
    accountNumber: input.accountNumber,
    iban: input.iban,
    swift: input.swift || null,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
    updatedBy: actor.id,
  };

  return withActor(db, actor, async (tx) => {
    if (input.id) {
      const before = one(
        await tx.select().from(donationAccounts).where(eq(donationAccounts.id, input.id)).limit(1),
        'donation_account',
      );
      const after = one(
        await tx
          .update(donationAccounts)
          .set(columns)
          .where(eq(donationAccounts.id, input.id))
          .returning(),
        'donation_account',
      );
      // The IBAN is where the money goes: its change is always in the log,
      // old value beside new, so a tampered account can be traced.
      await writeAudit(tx, actor, {
        action: 'update',
        entityType: 'donation_account',
        entityId: after.id,
        diff: computeDiff(
          before as unknown as Record<string, unknown>,
          after as unknown as Record<string, unknown>,
        ),
      });
      return after;
    }

    const created = one(
      await tx
        .insert(donationAccounts)
        .values({ ...columns, createdBy: actor.id })
        .returning(),
      'donation_account',
    );
    await writeAudit(tx, actor, {
      action: 'create',
      entityType: 'donation_account',
      entityId: created.id,
      diff: computeDiff(null, created as unknown as Record<string, unknown>),
    });
    return created;
  });
}

export async function deleteDonationAccount(db: Db, actor: Actor, id: string): Promise<void> {
  assertCan(actor, 'donations.settings');

  await withActor(db, actor, async (tx) => {
    const [removed] = await tx
      .delete(donationAccounts)
      .where(eq(donationAccounts.id, id))
      .returning({ iban: donationAccounts.iban, currency: donationAccounts.currency });
    if (!removed) throw notFound('donation_account');

    await writeAudit(tx, actor, {
      action: 'delete',
      entityType: 'donation_account',
      entityId: id,
      diff: { iban: { from: removed.iban, to: null }, currency: { from: removed.currency, to: null } },
    });
  });
}
