import { inArray } from 'drizzle-orm';
import type { Db, Tx } from '@/db';
import { mediaAssets } from '@/db/schema';
import type { ContentStatus } from '@/db/schema/enums';
import { AppError } from '@/lib/errors';
import type { Actor } from './actor';
import { assertCan } from './permissions';

/**
 * The gates that stand between a draft and a published page.
 *
 * These are the rules the organisation cannot afford to get wrong once, so they
 * live in the service layer where every caller passes through them — an action,
 * a bulk import, a seed script and a cron job all hit the same check.
 */

/** A transition an editor may not make is refused here, not in the UI. */
export function assertCanTransition(
  actor: Actor,
  from: ContentStatus,
  to: ContentStatus,
): void {
  if (from === to) return;

  const entersPublic = to === 'published';
  const leavesPublic = from === 'published' && to !== 'published';

  if (entersPublic || leavesPublic) {
    assertCan(actor, 'content.publish');
  } else {
    assertCan(actor, 'content.write');
  }
}

/**
 * Media consent gate — the rule with the highest cost of failure on the site.
 *
 * Publishing a photograph of an identifiable child without documented consent
 * is not a content mistake; it is a safeguarding incident. The check runs over
 * **every** asset a record references, and it runs on publish rather than on
 * upload, because consent can be recorded after the file arrives and can also
 * be withdrawn after it was granted.
 */
export async function assertMediaConsent(
  tx: Db | Tx,
  mediaIds: (string | null | undefined)[],
): Promise<void> {
  const ids = [...new Set(mediaIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return;

  const assets = await tx
    .select({
      id: mediaAssets.id,
      altAr: mediaAssets.altAr,
      consent: mediaAssets.consent,
      hasIdentifiableMinors: mediaAssets.hasIdentifiableMinors,
    })
    .from(mediaAssets)
    .where(inArray(mediaAssets.id, ids));

  for (const asset of assets) {
    // RULE 7 — no published media without Arabic alt text.
    if (!asset.altAr?.trim()) {
      throw new AppError('consent_required', 'errors.media.altRequired', {
        meta: { mediaId: asset.id },
      });
    }
    if (asset.hasIdentifiableMinors && asset.consent !== 'obtained') {
      throw new AppError('consent_required', 'errors.media.minorConsentRequired', {
        meta: { mediaId: asset.id, consent: asset.consent },
      });
    }
  }
}

/**
 * Story consent gate.
 *
 * A story that names or shows its subject needs a recorded consent reference,
 * not merely a ticked box: "we have consent" with nothing to point at is what
 * every retrospective review finds insufficient.
 */
export function assertStoryConsent(story: {
  subjectAnonymized: boolean;
  consentObtained: boolean;
  consentReference: string | null;
}): void {
  if (story.subjectAnonymized) return;

  if (!story.consentObtained || !story.consentReference?.trim()) {
    throw new AppError('consent_required', 'errors.story.consentRequired');
  }
}

/**
 * Impact-figure gate — no published figure without its period and verification
 * status. The columns are already `not null`, so what is checked here is the
 * part a schema cannot express: a figure shown publicly must be `verified`, not
 * a target someone forgot to reclassify.
 */
export function assertMetricPublishable(metric: {
  isPublic: boolean;
  status: 'target' | 'reported' | 'verified';
  verificationSource: string | null;
}): void {
  if (!metric.isPublic) return;

  if (metric.status !== 'verified') {
    throw new AppError('validation', 'errors.metric.mustBeVerified', {
      fieldErrors: { status: ['errors.metric.mustBeVerified'] },
    });
  }
  if (!metric.verificationSource?.trim()) {
    throw new AppError('validation', 'errors.metric.sourceRequired', {
      fieldErrors: { verificationSource: ['errors.metric.sourceRequired'] },
    });
  }
}

/**
 * A person is named on the site only by explicit decision, and a named person
 * with a photograph needs that photograph to clear the same consent gate as any
 * other asset (DNH-5).
 */
export async function assertPersonPublishable(
  tx: Db | Tx,
  person: { isPublic: boolean; photoMediaId: string | null },
): Promise<void> {
  if (!person.isPublic) return;
  await assertMediaConsent(tx, [person.photoMediaId]);
}
