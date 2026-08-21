// Must come first: ES imports are hoisted, so the environment has to be loaded
// as part of the module graph rather than in this file's body.
import './_env';
import { sql } from 'drizzle-orm';
import { organizationSettings, pages, programs } from '@/db/schema';
import { closeOwnerDb, ownerDb } from './_owner-db';

/**
 * The seed.
 *
 * **No organisational fact is invented here.** Not the legal name, not the
 * licence number, not a phone number, not a founding year, not a single impact
 * figure. Every such value is written as an explicit `TODO(org)` placeholder
 * that is obviously wrong on sight, because a plausible-looking placeholder is
 * one that reaches production — and a wrong licence number on a page whose job
 * is proving the organisation is real is worse than an empty one.
 *
 * What this seeds is **structure**: the singleton row so the site has something
 * to read, the three programme keys the schema already fixes, and the four
 * legal page keys the routes look up by. Content arrives through the admin.
 *
 * Idempotent. Safe to re-run; it never overwrites a row that already exists.
 *
 * Runs on the **owner** connection, not the runtime one. `app_runtime` has no
 * `INSERT` grant on `organization_settings` by design — the singleton is a
 * schema fixture, and seeding it is closer to a migration than to a request.
 */

const TODO = (what: string) => `TODO(org): ${what}`;

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.warn('dry run — nothing will be written\n');

  await ownerDb.transaction(async (tx) => {
    // ── organisation singleton ───────────────────────────────────────────
    const [existingOrg] = await tx.select().from(organizationSettings).limit(1);

    if (existingOrg) {
      console.warn('organization_settings: already present, left untouched');
    } else if (!dryRun) {
      await tx.insert(organizationSettings).values({
        id: true,
        legalNameAr: TODO('الاسم القانوني بالعربية'),
        legalNameEn: TODO('legal name in English'),
        shortNameAr: TODO('الاسم المختصر'),
        shortNameEn: TODO('short name'),
        acronym: 'PCSRD',
        alternateNames: [],
        // Deliberately absurd: a real year would look correct in a review and
        // survive to launch.
        foundedYear: 1900,
        licenseNumber: TODO('رقم الترخيص'),
        coreValues: [],
        principles: [],
        strategicObjectives: [],
        additionalPhones: [],
        socials: [],
        officialChannels: [],
        addressIsPublic: false,
      });
      console.warn('organization_settings: inserted with TODO(org) placeholders');
    }

    // ── the three programmes ─────────────────────────────────────────────
    // The keys are fixed by the `program_key` enum; the copy is the
    // organisation's to write.
    const PROGRAMS = [
      { key: 'protection' as const, slugAr: 'الحماية', slugEn: 'protection', accent: '--color-prog-protection', order: 0 },
      { key: 'humanitarian_response' as const, slugAr: 'الاستجابة-الإنسانية', slugEn: 'humanitarian-response', accent: '--color-prog-response', order: 1 },
      { key: 'early_recovery' as const, slugAr: 'التعافي-المبكر', slugEn: 'early-recovery', accent: '--color-prog-recovery', order: 2 },
    ];

    for (const program of PROGRAMS) {
      const [existing] = await tx
        .select({ id: programs.id })
        .from(programs)
        .where(sql`${programs.key} = ${program.key}`)
        .limit(1);

      if (existing) {
        console.warn(`programs.${program.key}: already present`);
        continue;
      }
      if (dryRun) continue;

      await tx.insert(programs).values({
        key: program.key,
        titleAr: TODO(`اسم برنامج ${program.key}`),
        slugAr: program.slugAr,
        slugEn: program.slugEn,
        accentToken: program.accent,
        displayOrder: program.order,
        specificObjectives: [],
        keyInterventions: [],
        targetGroups: [],
        // Draft, always. A seeded programme must not appear on the public site
        // carrying a TODO in its title.
        status: 'draft',
      });
      console.warn(`programs.${program.key}: inserted as draft`);
    }

    // ── the legal pages ──────────────────────────────────────────────────
    // The routes look these up by `key`, so the keys have to exist before the
    // pages can be written. The bodies do not: an empty legal page renders its
    // designed empty state, which is honest.
    const PAGES = [
      { key: 'privacy', titleAr: 'سياسة الخصوصية', slugAr: 'الخصوصية', slugEn: 'privacy' },
      { key: 'accessibility', titleAr: 'إتاحة الوصول', slugAr: 'إتاحة-الوصول', slugEn: 'accessibility' },
      { key: 'terms', titleAr: 'شروط الاستخدام', slugAr: 'الشروط', slugEn: 'terms' },
      { key: 'verify', titleAr: 'التحقّق من القنوات', slugAr: 'تحقق', slugEn: 'verify' },
    ];

    for (const page of PAGES) {
      const [existing] = await tx
        .select({ id: pages.id })
        .from(pages)
        .where(sql`${pages.key} = ${page.key}`)
        .limit(1);

      if (existing) {
        console.warn(`pages.${page.key}: already present`);
        continue;
      }
      if (dryRun) continue;

      await tx.insert(pages).values({
        key: page.key,
        titleAr: page.titleAr,
        slugAr: page.slugAr,
        slugEn: page.slugEn,
        status: 'draft',
      });
      console.warn(`pages.${page.key}: inserted as draft`);
    }
  });

  await closeOwnerDb();

  console.warn('\nseed complete.');
  console.warn('Every TODO(org) value must be replaced through the admin before launch.');
  console.warn('Nothing seeded here is published — publishing is a human decision.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
