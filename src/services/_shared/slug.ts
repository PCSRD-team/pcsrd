import { and, eq, ne, or, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Db, Tx } from '@/db';
import { conflict } from '@/lib/errors';

/**
 * Slug generation and uniqueness.
 *
 * Arabic slugs are kept in Arabic. Transliterating them to Latin would make
 * every URL on an Arabic-first site unreadable to its primary audience, and
 * modern browsers display percent-encoded UTF-8 paths as the original script.
 */

const ARABIC_DIACRITICS = /[ً-ْٰـ]/g;

export function slugify(input: string): string {
  return input
    .normalize('NFKC')
    .replace(ARABIC_DIACRITICS, '')
    .toLowerCase()
    .trim()
    // Anything that is not a letter or a digit becomes a separator.
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/, '');
}

/**
 * Both slugs must exist on every row, so an English slug is derived from the
 * Arabic title when no English title was given. The alternative — a null slug —
 * makes `/en/projects/<id>` unroutable and turns the untranslated-content state
 * into a 404.
 */
export function deriveSlugs(input: {
  titleAr: string;
  titleEn?: string | null;
  slugAr?: string | null;
  slugEn?: string | null;
}): { slugAr: string; slugEn: string } {
  const slugAr = input.slugAr?.trim() ? slugify(input.slugAr) : slugify(input.titleAr);
  const slugEn = input.slugEn?.trim()
    ? slugify(input.slugEn)
    : input.titleEn?.trim()
      ? slugify(input.titleEn)
      : slugAr;
  return { slugAr, slugEn };
}

type SlugTable = PgTable & {
  id: PgColumn;
  slugAr: PgColumn;
  slugEn: PgColumn;
};

/**
 * Rejects a slug collision **before** the insert, so the caller gets a field
 * error naming which slug clashed rather than a Postgres unique-violation
 * message that no form can render.
 *
 * `excludeId` is what makes this usable on update: a row is allowed to keep its
 * own slug.
 */
export async function assertSlugsUnique(
  tx: Db | Tx,
  table: SlugTable,
  slugs: { slugAr: string; slugEn: string },
  excludeId?: string,
): Promise<void> {
  const clash: SQL | undefined = or(
    eq(table.slugAr, slugs.slugAr),
    eq(table.slugEn, slugs.slugEn),
  );

  const rows = await tx
    .select({ id: table.id, slugAr: table.slugAr, slugEn: table.slugEn })
    .from(table)
    .where(excludeId ? and(clash, ne(table.id, excludeId)) : clash)
    .limit(2);

  if (rows.length === 0) return;

  const fieldErrors: Record<string, string[]> = {};
  for (const row of rows) {
    if (row.slugAr === slugs.slugAr) fieldErrors.slugAr = ['errors.slug.taken'];
    if (row.slugEn === slugs.slugEn) fieldErrors.slugEn = ['errors.slug.taken'];
  }
  throw conflict('errors.slug.taken', fieldErrors);
}
