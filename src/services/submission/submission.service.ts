import { randomBytes } from 'node:crypto';
import { and, eq, lt } from 'drizzle-orm';
import type { Db, Tx } from '@/db';
import { formSubmissions } from '@/db/schema';
import type { LocaleCode, SubmissionState, SubmissionType } from '@/db/schema/enums';
import { AppError, notFound } from '@/lib/errors';
import { decryptPayload, encryptPayload } from '@/lib/security/crypto';
import { hashIp } from '@/lib/security/ip';
import { addMonths, toDateString } from '@/lib/utils';
import type { Actor } from '../_shared/actor';
import { writeAudit } from '../_shared/audit';
import { assertCan, assertCanViewSensitive } from '../_shared/permissions';

/**
 * One service behind all six public forms.
 *
 * The privacy rules are **structural**, not procedural. `ipHash` and
 * `userAgent` are computed inside this function and zeroed for sensitive types
 * before the insert, so no caller can leak a complainant's identity even by
 * passing the values in — they are ignored. The payload of a sensitive
 * submission is encrypted here too, so the plaintext column stays null and a
 * database dump of a complaint is inert on its own.
 */

/** 02-API §5.3. Only the CFM complaint is confidential. */
const SENSITIVE: Record<SubmissionType, boolean> = {
  partnership: false,
  contact: false,
  volunteer: false,
  job: false,
  complaint: true,
  fraud_report: false,
};

/** 01-DATABASE §10. Months from submission to automatic deletion. */
const RETENTION_MONTHS: Record<SubmissionType, number> = {
  partnership: 24,
  contact: 12,
  volunteer: 12,
  job: 12,
  complaint: 24,
  fraud_report: 24,
};

export const isSensitiveType = (type: SubmissionType) => SENSITIVE[type];
export const retentionMonthsFor = (type: SubmissionType) => RETENTION_MONTHS[type];

/** `PCS-XXXXXX`. Generated here rather than left to the database trigger so the
 * same code path works on a test database that has no triggers installed. */
function generateReference(): string {
  return `PCS-${randomBytes(4).toString('hex').slice(0, 6).toUpperCase()}`;
}

export type CreateSubmissionInput = {
  type: SubmissionType;
  locale: LocaleCode;
  payload: Record<string, unknown>;
  attachmentPath?: string | null;
  /** Raw address. Hashed or discarded here — never stored as given. */
  ip?: string | null;
  userAgent?: string | null;
  /** Injected so the retention deadline is deterministic in tests. */
  now?: Date;
};

export type CreatedSubmission = {
  id: string;
  reference: string;
  isSensitive: boolean;
  purgeAfter: string;
};

export async function createSubmission(
  db: Db,
  input: CreateSubmissionInput,
): Promise<CreatedSubmission> {
  const isSensitive = SENSITIVE[input.type];
  const now = input.now ?? new Date();
  const purgeAfter = toDateString(addMonths(now, RETENTION_MONTHS[input.type]));

  // DNH-8. A complainant must not be re-identifiable from what we keep, so the
  // two fields that could identify them are dropped before they reach the row.
  // `hashIp` is never called for a sensitive type, so the salt never touches a
  // complainant's address at all.
  const ipHash = isSensitive ? null : hashIp(input.ip);
  const userAgent = isSensitive ? null : (input.userAgent?.slice(0, 255) ?? null);

  const encrypted = isSensitive ? encryptPayload(input.payload) : null;

  // Six hex characters is 16.7 million references; a collision is unlikely and
  // not impossible, and the column is unique, so the insert is retried rather
  // than failing a submission the visitor cannot resend.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [row] = await db
        .insert(formSubmissions)
        .values({
          reference: generateReference(),
          type: input.type,
          isSensitive,
          locale: input.locale,
          payload: encrypted ? null : input.payload,
          payloadEncrypted: encrypted?.data ?? null,
          payloadKeyId: encrypted?.keyId ?? null,
          attachmentPath: input.attachmentPath ?? null,
          ipHash,
          userAgent,
          purgeAfter,
        })
        .returning({ id: formSubmissions.id, reference: formSubmissions.reference });

      return { id: row.id, reference: row.reference, isSensitive, purgeAfter };
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === '23505' && attempt < 4) continue;
      throw error;
    }
  }

  throw new AppError('internal', 'errors.unexpected', {
    meta: { reason: 'reference generation exhausted' },
  });
}

// ── Admin-side reads ─────────────────────────────────────────────────────

export type SubmissionDetail = {
  id: string;
  reference: string;
  type: SubmissionType;
  isSensitive: boolean;
  locale: LocaleCode;
  state: SubmissionState;
  payload: Record<string, unknown> | null;
  attachmentPath: string | null;
  internalNote: string | null;
  handledBy: string | null;
  handledAt: Date | null;
  createdAt: Date;
  purgeAfter: string;
};

/**
 * Reads one submission, decrypting the payload only for an actor who is
 * permitted to see it.
 *
 * Reading a confidential complaint is itself an auditable event — the audit
 * entry is written by the caller that has a transaction, or here when reading
 * standalone, because "who opened this complaint" is a question the
 * organisation must be able to answer.
 */
export async function getSubmission(
  db: Db,
  actor: Actor,
  id: string,
): Promise<SubmissionDetail> {
  assertCan(actor, 'submissions.read');

  const [row] = await db
    .select()
    .from(formSubmissions)
    .where(eq(formSubmissions.id, id))
    .limit(1);

  if (!row) throw notFound('submission');
  if (row.isSensitive) assertCanViewSensitive(actor);

  const payload = row.payloadEncrypted ? decryptPayload(row.payloadEncrypted) : row.payload;

  if (row.isSensitive) {
    await writeAudit(db, actor, {
      action: 'view_sensitive',
      entityType: 'form_submission',
      entityId: row.id,
    });
  }

  return {
    id: row.id,
    reference: row.reference,
    type: row.type,
    isSensitive: row.isSensitive,
    locale: row.locale,
    state: row.state,
    payload,
    attachmentPath: row.attachmentPath,
    internalNote: row.internalNote,
    handledBy: row.handledBy,
    handledAt: row.handledAt,
    createdAt: row.createdAt,
    purgeAfter: row.purgeAfter,
  };
}

export async function setSubmissionState(
  db: Db,
  actor: Actor,
  id: string,
  next: { state: SubmissionState; internalNote?: string | null },
): Promise<void> {
  assertCan(actor, 'submissions.handle');

  const [existing] = await db
    .select({ id: formSubmissions.id, isSensitive: formSubmissions.isSensitive })
    .from(formSubmissions)
    .where(eq(formSubmissions.id, id))
    .limit(1);

  if (!existing) throw notFound('submission');
  if (existing.isSensitive) assertCanViewSensitive(actor);

  await db.transaction(async (tx) => {
    await tx
      .update(formSubmissions)
      .set({
        state: next.state,
        internalNote: next.internalNote ?? null,
        handledBy: actor.id,
        handledAt: new Date(),
      })
      .where(eq(formSubmissions.id, id));

    // The note is not recorded in the diff: on a confidential complaint it can
    // quote the complaint itself, and the audit log has a wider readership than
    // the submission does.
    await writeAudit(tx, actor, {
      action: 'update',
      entityType: 'form_submission',
      entityId: id,
      diff: { state: { from: null, to: next.state } },
    });
  });
}

/**
 * Deletes everything past its retention deadline.
 *
 * Called by the daily cron. Returns the count only — never the rows, because a
 * purge log listing what was purged defeats the purge.
 */
export async function purgeExpiredSubmissions(
  db: Db | Tx,
  now: Date = new Date(),
): Promise<number> {
  const deleted = await db
    .delete(formSubmissions)
    .where(lt(formSubmissions.purgeAfter, toDateString(now)))
    .returning({ id: formSubmissions.id });
  return deleted.length;
}

/** Counts unhandled submissions for the admin dashboard badge. */
export async function countNewSubmissions(db: Db, actor: Actor): Promise<number> {
  assertCan(actor, 'submissions.read');
  const rows = await db
    .select({ id: formSubmissions.id })
    .from(formSubmissions)
    .where(
      and(
        eq(formSubmissions.state, 'new'),
        actor.canViewSensitive ? undefined : eq(formSubmissions.isSensitive, false),
      ),
    );
  return rows.length;
}
