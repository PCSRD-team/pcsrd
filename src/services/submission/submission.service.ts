import { and, eq, sql } from 'drizzle-orm';
import type { Db, Tx } from '@/db';
import { readAsActor, rowsOf, withActor } from '@/db/session';
import { formSubmissions, profiles } from '@/db/schema';
import type { LocaleCode, SubmissionState, SubmissionType } from '@/db/schema/enums';
import { notFound } from '@/lib/errors';
import { decryptPayload, encryptPayload } from '@/lib/security/crypto';
import { hashIp } from '@/lib/security/ip';
import { addMonths, toDateString } from '@/lib/utils';
import type { Actor } from '../_shared/actor';
import { writeAudit } from '../_shared/audit';
import { one } from '../_shared/one';
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

export type CreateSubmissionInput = {
  type: SubmissionType;
  locale: LocaleCode;
  payload: Record<string, unknown>;
  attachmentPath?: string | null;
  /** Raw address. Hashed or discarded here — never stored as given. */
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * What the submitter is allowed to learn about their own submission.
 *
 * No `id`. `form_submissions.rt_select` is
 * `CASE WHEN is_sensitive THEN app.can_view_sensitive() ELSE app.can_publish() END`,
 * so a public visitor can never read the row back — the id would have to be
 * fetched by a statement that is guaranteed to return nothing. The reference is
 * the handle a person uses to follow up, and it comes straight out of
 * `app.submit_form`.
 */
export type CreatedSubmission = {
  reference: string;
  isSensitive: boolean;
  purgeAfter: string;
};

export async function createSubmission(
  db: Db,
  input: CreateSubmissionInput,
): Promise<CreatedSubmission> {
  const isSensitive = SENSITIVE[input.type];
  // `app.submit_form` sets the authoritative deadline from its own retention
  // table; this is the same policy restated for the caller, which cannot read
  // the stored row back. `RETENTION_MONTHS` and that table must agree — the
  // duplication is deliberate and load-bearing, not incidental.
  const purgeAfter = toDateString(addMonths(new Date(), RETENTION_MONTHS[input.type]));

  // DNH-8. A complainant must not be re-identifiable from what we keep, so the
  // two fields that could identify them are dropped before they reach the row.
  // `hashIp` is never called for a sensitive type, so the salt never touches a
  // complainant's address at all.
  //
  // The database enforces this again inside `app.submit_form`, and again in the
  // `submissions_sensitive_unlinkable` CHECK constraint. Three layers for one
  // rule is not redundancy — it is the one rule where a single missed branch is
  // a safeguarding incident rather than a bug.
  const ipHash = isSensitive ? null : hashIp(input.ip);
  const userAgent = isSensitive ? null : (input.userAgent?.slice(0, 255) ?? null);

  // A sensitive payload is encrypted here, in the application. The database
  // refuses it otherwise:
  //   PCSRD_SENSITIVE_PLAINTEXT: a sensitive submission must be encrypted
  //   by the application before insert
  const encrypted = isSensitive ? encryptPayload(input.payload) : null;

  // `app.submit_form` is SECURITY DEFINER and owns the retention table, the
  // sensitivity decision and the DNH-8 blanking. Calling it rather than
  // inserting directly keeps one source of truth: a cron job, a seed script or
  // a psql session gets the same policy without importing this file.
  // `app.submit_form` returns exactly one row or raises. `one` turns "it
  // returned nothing" — which would previously have thrown a
  // `TypeError: Cannot read properties of undefined` inside a form submission —
  // into the same refusal every other missing row produces.
  const row = one(
    rowsOf<{ reference: string }>(await db.execute(sql`
    select app.submit_form(
      ${input.type}::submission_type,
      ${input.locale}::locale_code,
      ${encrypted ? null : JSON.stringify(input.payload)}::jsonb,
      ${encrypted?.data ?? null}::bytea,
      ${encrypted?.keyId ?? null}::text,
      ${input.attachmentPath ?? null}::text,
      ${ipHash}::text,
      ${userAgent}::text,
      ${isSensitive}::boolean
    ) as reference
  `)),
    'form_submission',
  );

  return { reference: row.reference, isSensitive, purgeAfter };
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
  /** Display name of `handledBy`, resolved here so the page shows a person, not a uuid. */
  handledByName: string | null;
  handledAt: Date | null;
  createdAt: Date;
  purgeAfter: string;
};

/**
 * Reads one submission, decrypting the payload only for an actor who is
 * permitted to see it.
 *
 * Reading a confidential complaint is itself an auditable event — the read and
 * its audit entry share one transaction, because "who opened this complaint" is
 * a question the organisation must be able to answer, and an entry that could
 * commit without its read would not answer it.
 *
 * The whole body runs inside `withActor`. `form_submissions` is FORCE ROW LEVEL
 * SECURITY and the runtime has no BYPASSRLS, so a statement issued on the bare
 * `db` handle is `anon`: the select matched nothing and this threw `notFound`
 * for every submission in the inbox, including non-sensitive ones.
 */
export async function getSubmission(
  db: Db,
  actor: Actor,
  id: string,
): Promise<SubmissionDetail> {
  assertCan(actor, 'submissions.read');

  return withActor(db, actor, async (tx) => {
    const [found] = await tx
      .select({ row: formSubmissions, handledByName: profiles.fullName })
      .from(formSubmissions)
      .leftJoin(profiles, eq(profiles.id, formSubmissions.handledBy))
      .where(eq(formSubmissions.id, id))
      .limit(1);

    if (!found) throw notFound('submission');
    const row = found.row;
    if (row.isSensitive) assertCanViewSensitive(actor);

    // The row names the key that encrypted it. Passing it is what makes
    // rotation possible: after a rotation the current key cannot decrypt an
    // older row, and defaulting to it would fail on exactly the complaints
    // that were filed before the change.
    const payload = row.payloadEncrypted
      ? decryptPayload(row.payloadEncrypted, row.payloadKeyId)
      : row.payload;

    if (row.isSensitive) {
      await writeAudit(tx, actor, {
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
      handledByName: found.handledByName,
      handledAt: row.handledAt,
      createdAt: row.createdAt,
      purgeAfter: row.purgeAfter,
    };
  });
}

export async function setSubmissionState(
  db: Db,
  actor: Actor,
  id: string,
  next: { state: SubmissionState; internalNote?: string | null },
): Promise<void> {
  assertCan(actor, 'submissions.handle');

  // One transaction for the read, the check and the write. `db.transaction`
  // opens a transaction but binds no actor, so the previous split — an unbound
  // pre-read followed by an unbound transaction — saw nothing and audited
  // nothing.
  await withActor(db, actor, async (tx) => {
    const [existing] = await tx
      .select({ id: formSubmissions.id, isSensitive: formSubmissions.isSensitive })
      .from(formSubmissions)
      .where(eq(formSubmissions.id, id))
      .limit(1);

    if (!existing) throw notFound('submission');
    if (existing.isSensitive) assertCanViewSensitive(actor);

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
export type PurgeResult = {
  deleted: number;
  /** Object paths in the private `applications` bucket, for the caller to remove. */
  attachments: string[];
};

/**
 * Retention purge.
 *
 * Delegates to `app.purge_expired_submissions()` for two reasons, and the
 * second is the one that matters:
 *
 * 1. The function is `SECURITY DEFINER`. A plain `delete` runs as the runtime
 *    role under `FORCE ROW LEVEL SECURITY`, and a cron job has no actor, so the
 *    delete policy refuses every row and the purge silently removes nothing.
 * 2. It returns the **attachment paths** it deleted. Destroying the row while
 *    leaving the applicant's CV in storage is not retention — the file is the
 *    part that carries a name, a phone number and an address.
 */
export async function purgeExpiredSubmissions(db: Db | Tx): Promise<PurgeResult> {
  const [row] = rowsOf<{ result: PurgeResult }>(
    await db.execute(sql`select app.purge_expired_submissions() as result`),
  );
  return {
    deleted: row?.result?.deleted ?? 0,
    attachments: row?.result?.attachments ?? [],
  };
}

/** Counts unhandled submissions for the admin dashboard badge. */
export async function countNewSubmissions(db: Db, actor: Actor): Promise<number> {
  assertCan(actor, 'submissions.read');
  const rows = await readAsActor(db, actor, (tx) =>
    tx
      .select({ id: formSubmissions.id })
      .from(formSubmissions)
      .where(
        and(
          eq(formSubmissions.state, 'new'),
          actor.canViewSensitive ? undefined : eq(formSubmissions.isSensitive, false),
        ),
      ),
  );
  return rows.length;
}
