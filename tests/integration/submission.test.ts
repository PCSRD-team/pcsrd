import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { formSubmissions, profiles } from '@/db/schema';
import type { Db } from '@/db';
import { AppError } from '@/lib/errors';
import type { Actor } from '@/services/_shared/actor';
import {
  countNewSubmissions,
  createSubmission,
  getSubmission,
  purgeExpiredSubmissions,
  setSubmissionState,
} from '@/services/submission/submission.service';
import { rowsOf } from '@/db/session';
import { resetTables, useTestDb } from '../setup/pglite';

const getDb = useTestDb();
/** The service signature asks for the app `Db`; PGlite's handle is structurally
 *  the same Drizzle instance over a different driver. */
const db = () => getDb() as unknown as Db;

const ADMIN: Actor = {
  id: '11111111-1111-1111-1111-111111111111',
  role: 'admin',
  canViewSensitive: false,
  isActive: true,
};
const SAFEGUARDING: Actor = { ...ADMIN, id: '22222222-2222-2222-2222-222222222222', canViewSensitive: true };
const EDITOR: Actor = { ...ADMIN, id: '33333333-3333-3333-3333-333333333333', role: 'editor' };

beforeEach(async () => {
  await resetTables(getDb());
  await getDb()
    .insert(profiles)
    .values([
      { id: ADMIN.id, email: 'admin@example.org', fullName: 'Admin', role: 'admin' },
      {
        id: SAFEGUARDING.id,
        email: 'safe@example.org',
        fullName: 'Safeguarding',
        role: 'admin',
        canViewSensitive: true,
      },
      { id: EDITOR.id, email: 'editor@example.org', fullName: 'Editor', role: 'editor' },
    ]);
});

describe('createSubmission', () => {
  it('stores an ordinary submission with a hashed IP and plaintext payload', async () => {
    const created = await createSubmission(db(), {
      type: 'partnership',
      locale: 'ar',
      payload: { organizationName: 'Example', email: 'x@example.org' },
      ip: '203.0.113.9',
      userAgent: 'Mozilla/5.0',
    });

    const [row] = await getDb()
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.id, created.id));

    expect(row.isSensitive).toBe(false);
    expect(row.payload).toEqual({ organizationName: 'Example', email: 'x@example.org' });
    expect(row.payloadEncrypted).toBeNull();
    expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.ipHash).not.toContain('203.0.113.9');
    expect(row.userAgent).toBe('Mozilla/5.0');
    expect(row.reference).toMatch(/^PCS-[0-9A-F]{8}$/);
  });

  it('DNH-8: a complaint stores no IP hash, no user agent and no plaintext', async () => {
    const created = await createSubmission(db(), {
      type: 'complaint',
      locale: 'ar',
      payload: { category: 'safeguarding', description: 'redacted' },
      // Supplied deliberately. The service must ignore both.
      ip: '203.0.113.9',
      userAgent: 'Mozilla/5.0',
    });

    const [row] = await getDb()
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.id, created.id));

    expect(row.isSensitive).toBe(true);
    expect(row.ipHash).toBeNull();
    expect(row.userAgent).toBeNull();
    expect(row.payload).toBeNull();
    expect(row.payloadEncrypted).toBeInstanceOf(Buffer);

    // The ciphertext must not contain the plaintext anywhere in it.
    expect(row.payloadEncrypted!.toString('utf8')).not.toContain('safeguarding');
    expect(row.payloadEncrypted!.toString('utf8')).not.toContain('redacted');
  });

  it('applies the retention table per type', async () => {
    // 24 months for a partnership, 12 for a contact enquiry (01-DATABASE §10).
    // The deadline is computed by app.submit_form from the database clock, so
    // the expectation is derived from the same clock rather than from Date.now
    // in the test process — the two can straddle midnight.
    const [{ in12, in24 }] = await getDb().execute(
      sql`select (current_date + interval '12 months')::date::text as in12,
                 (current_date + interval '24 months')::date::text as in24`,
    ).then((r) => rowsOf<{ in12: string; in24: string }>(r));

    const contact = await createSubmission(db(), { type: 'contact', locale: 'ar', payload: {} });
    const partnership = await createSubmission(db(), {
      type: 'partnership', locale: 'ar', payload: {},
    });

    expect(contact.purgeAfter).toBe(in12);
    expect(partnership.purgeAfter).toBe(in24);
  });
});

describe('getSubmission', () => {
  it('decrypts a complaint for an actor with sensitive access and audits the read', async () => {
    const created = await createSubmission(db(), {
      type: 'complaint',
      locale: 'ar',
      payload: { category: 'corruption', description: 'the details' },
    });

    const detail = await getSubmission(db(), SAFEGUARDING, created.id);
    expect(detail.payload).toEqual({ category: 'corruption', description: 'the details' });

    const audit = await getDb().query.auditLogs.findMany();
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe('view_sensitive');
    expect(audit[0].actorId).toBe(SAFEGUARDING.id);
    // The audit entry records that it was read, never what was read.
    expect(JSON.stringify(audit[0].diff)).not.toContain('corruption');
  });

  it('refuses an admin who is not on the sensitive-access list', async () => {
    const created = await createSubmission(db(), {
      type: 'complaint',
      locale: 'ar',
      payload: { category: 'corruption' },
    });

    await expect(getSubmission(db(), ADMIN, created.id)).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('refuses an editor outright', async () => {
    const created = await createSubmission(db(), {
      type: 'contact',
      locale: 'ar',
      payload: {},
    });

    await expect(getSubmission(db(), EDITOR, created.id)).rejects.toBeInstanceOf(AppError);
  });
});

describe('setSubmissionState', () => {
  it('records the handler and writes an audit entry without the note', async () => {
    const created = await createSubmission(db(), {
      type: 'contact',
      locale: 'ar',
      payload: {},
    });

    await setSubmissionState(db(), ADMIN, created.id, {
      state: 'handled',
      internalNote: 'called the sender back',
    });

    const [row] = await getDb()
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.id, created.id));
    expect(row.state).toBe('handled');
    expect(row.handledBy).toBe(ADMIN.id);
    expect(row.handledAt).toBeInstanceOf(Date);

    const audit = await getDb().query.auditLogs.findMany();
    expect(JSON.stringify(audit)).not.toContain('called the sender back');
  });
});

describe('purgeExpiredSubmissions', () => {
  it('deletes only rows past their deadline and reports their attachments', async () => {
    const expired = await createSubmission(db(), {
      type: 'job', locale: 'ar', payload: {}, attachmentPath: 'cv/expired.pdf',
    });
    const fresh = await createSubmission(db(), { type: 'contact', locale: 'ar', payload: {} });

    // The deadline is the database's to set, so the test moves it rather than
    // asking the service to lie about the date.
    await getDb()
      .update(formSubmissions)
      .set({ purgeAfter: '2020-01-01' })
      .where(eq(formSubmissions.id, expired.id));

    const purged = await purgeExpiredSubmissions(db());
    expect(purged.deleted).toBe(1);
    // The CV must be named so the caller can remove it from storage; deleting
    // the row and keeping the file is not retention.
    expect(purged.attachments).toEqual(['cv/expired.pdf']);

    const remaining = await getDb().select().from(formSubmissions);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(fresh.id);
  });
});

describe('countNewSubmissions', () => {
  it('hides sensitive rows from an actor without access', async () => {
    await createSubmission(db(), { type: 'contact', locale: 'ar', payload: {} });
    await createSubmission(db(), { type: 'complaint', locale: 'ar', payload: {} });

    expect(await countNewSubmissions(db(), ADMIN)).toBe(1);
    expect(await countNewSubmissions(db(), SAFEGUARDING)).toBe(2);
  });
});
