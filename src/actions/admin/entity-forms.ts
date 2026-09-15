'use server';

import { redirect } from 'next/navigation';
import { db } from '@/db';
import { getMediaUsage } from '@/db/queries/admin';
import { requireActor } from '@/lib/auth/guard';
import { publicEnv } from '@/lib/env.public';
import { revalidateEntity } from '@/lib/cache/revalidate';
import type { Entity } from '@/lib/cache/tags';
import { type ActionResult, err, ok, runAction } from '@/lib/errors';
import type { Actor } from '@/services/_shared/actor';
import { fieldErrorsFrom } from '@/lib/validation/common';
import { parseAdminForm, type FormShape } from '@/lib/validation/form-data';
import {
  inviteUserSchema,
  mediaMetadataSchema,
  metricSchema,
  pageSchema,
  partnerSchema,
  personSchema,
  postSchema,
  programSchema,
  projectSchema,
  publicationSchema,
  redirectSchema,
  storySchema,
  vacancySchema,
} from '@/lib/validation/admin';
import {
  pageService,
  postService,
  programService,
  publicationService,
  storyService,
  vacancyService,
} from '@/services/content';
import { upsertMetric, upsertPartner, upsertPerson } from '@/services/content/catalog.service';
import { upsertProject } from '@/services/content/project.service';
import { createRedirect } from '@/services/content/redirect.service';
import { updateMedia } from '@/services/media/media.service';
import { inviteUser } from '@/services/users/user.service';
import type { z } from 'zod';

/**
 * The `FormData` entry points for the admin forms — the only way a record is
 * created or edited from the web.
 *
 * Each one is six lines: guard, parse the form, validate, call the service,
 * revalidate, redirect. There is no parallel object-taking action layer: a
 * bulk import, a seed script or a test calls the **service** directly, which
 * takes an object already. Every export here is a live POST endpoint, so
 * there is exactly one per form and nothing kept "just in case" (DUP-001).
 */

export type EntityResult = ActionResult<{ id: string }>;

const SEO_JSON: readonly string[] = [];
const SEO_BOOLEANS = ['noIndex'] as const;

// `satisfies` rather than `: Record<string, FormShape>`. The annotation checked
// the values and then widened the *keys* to `string`, so `keyof typeof SHAPES`
// was `string` and `SHAPES[shapeKey]` was `FormShape | undefined` — a lookup
// that could miss with nothing to catch it. `satisfies` keeps both: the values
// are still checked against `FormShape`, and the keys stay literal, so
// `shapeKey` can only be one of the entities that actually exists.
const SHAPES = {
  project: {
    multi: ['governorates', 'themes', 'localities', 'implementingPartners', 'donors', 'gallery'],
    json: ['objectiveAr', 'objectiveEn', 'activitiesAr', 'activitiesEn', 'outcomesAr', 'outcomesEn'],
    booleans: [...SEO_BOOLEANS, 'isFeatured'],
    nullable: ['startDate', 'endDate', 'heroMediaId', 'ogMediaId', 'id'],
  },
  post: {
    multi: ['gallery'],
    json: ['bodyAr', 'bodyEn', ...SEO_JSON],
    booleans: [...SEO_BOOLEANS, 'isFeatured'],
    nullable: ['programId', 'projectId', 'heroMediaId', 'ogMediaId', 'expiresAt', 'id'],
  },
  story: {
    multi: ['gallery'],
    json: ['bodyAr', 'bodyEn'],
    booleans: [...SEO_BOOLEANS, 'isFeatured', 'subjectAnonymized', 'consentObtained'],
    nullable: ['programId', 'projectId', 'heroMediaId', 'ogMediaId', 'id'],
  },
  program: {
    multi: ['targetGroups', 'gallery'],
    json: [
      'introductionAr', 'introductionEn', 'rationaleAr', 'rationaleEn',
      'sustainabilityAr', 'sustainabilityEn', 'impactStatementAr', 'impactStatementEn',
      'eligibilityAr', 'eligibilityEn', 'howToAccessAr', 'howToAccessEn',
    ],
    booleans: SEO_BOOLEANS,
    nullable: ['heroMediaId', 'ogMediaId', 'id'],
  },
  vacancy: {
    json: ['descriptionAr', 'descriptionEn', 'requirementsAr', 'requirementsEn'],
    booleans: SEO_BOOLEANS,
    nullable: ['applicationEmail', 'employmentType', 'ogMediaId', 'id'],
  },
  publication: {
    booleans: ['isFeatured'],
    nullable: ['fileArId', 'fileEnId', 'publishedYear', 'id'],
  },
  page: {
    json: ['bodyAr', 'bodyEn'],
    booleans: SEO_BOOLEANS,
    nullable: ['ogMediaId', 'id'],
  },
  partner: {
    booleans: ['isFeatured'],
    nullable: ['membershipLevel', 'logoMediaId', 'website', 'id'],
  },
  person: {
    booleans: ['isPublic'],
    nullable: ['photoMediaId', 'id'],
  },
  metric: {
    booleans: ['isPublic', 'isFeatured'],
    nullable: ['programId', 'projectId', 'displayPrefix', 'verificationSource', 'id'],
  },
  media: {
    booleans: ['hasIdentifiableMinors'],
    nullable: ['altEn', 'captionAr', 'captionEn', 'credit', 'consentReference'],
  },
  redirect: {},
  user: {
    booleans: ['canViewSensitive'],
  },
} satisfies Record<string, FormShape>;

/**
 * `partners` and `donors` arrive as two lists but the service takes one list of
 * `{ partnerId, role }`. Reshaping here keeps the service's contract about the
 * junction rather than about the form that happened to produce it.
 */
function shapeProjectLinks(input: Record<string, unknown>, hasGallery: boolean) {
  const implementing = (input.implementingPartners as string[]) ?? [];
  const donors = (input.donors as string[]) ?? [];

  return {
    ...shapeGallery(input, hasGallery),
    partners: [
      ...implementing.map((partnerId) => ({ partnerId, role: 'implementing' as const })),
      ...donors.map((partnerId) => ({ partnerId, role: 'donor' as const })),
    ],
    // One locality per line in a textarea; `multi` collected the single
    // field into a one-element array, so it is split here.
    localities: ((input.localities as string[] | undefined) ?? [])
      .flatMap((line) => line.split(/[\n,،]/))
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

/**
 * `gallery` arrives as repeated ids in DOM order; the services take
 * `{ mediaId, displayOrder }[]`. Only a form that renders a `GalleryPicker`
 * posts the field at all (the picker carries an always-present sentinel, so an
 * emptied gallery still posts) — for any other form `media` stays `undefined`
 * and the service keeps the stored junction rows untouched. `hasGallery` is
 * `formData.has('gallery')`, checked before `parseAdminForm` fills a missing
 * multi field with `[]`.
 */
function shapeGallery(input: Record<string, unknown>, hasGallery: boolean) {
  if (!hasGallery) return input;
  const gallery = (input.gallery as string[]) ?? [];
  return {
    ...input,
    media: gallery.map((mediaId, index) => ({ mediaId, displayOrder: index })),
  };
}

async function handle<TSchema extends z.ZodType>(
  entity: Entity,
  formData: FormData,
  shapeKey: keyof typeof SHAPES,
  schema: TSchema,
  run: (
    actor: Actor,
    input: z.infer<TSchema>,
  ) => Promise<{
    id: string;
    slugAr?: string;
    slugEn?: string;
    previousSlugs?: { ar: string; en: string };
    key?: string;
  }>,
): Promise<EntityResult> {
  return runAction(async () => {
    // Guard first, always — before the body is even parsed.
    const actor = await requireActor();

    const hasGallery = formData.has('gallery');
    const raw = parseAdminForm(formData, SHAPES[shapeKey]);
    const parsed = schema.safeParse(
      shapeKey === 'project' ? shapeProjectLinks(raw, hasGallery) : shapeGallery(raw, hasGallery),
    );

    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }

    const result = await run(actor, parsed.data);
    revalidateEntity(entity, { ar: result.slugAr, en: result.slugEn });
    // A renamed record leaves its old URL cached otherwise.
    if (result.previousSlugs) {
      revalidateEntity(entity, { ar: result.previousSlugs.ar, en: result.previousSlugs.en });
    }
    // Pages and programmes are cached by `key`, not slug.
    if (result.key && (entity === 'page' || entity === 'program')) {
      revalidateEntity(entity, { ar: result.key });
    }
    // A partner logo appears on project pages.
    if (entity === 'partner') revalidateEntity('project');
    return ok({ id: result.id }, 'admin.saved');
  });
}

export async function saveProjectForm(_prev: EntityResult | null, formData: FormData) {
  const result = await handle(
    'project',
    formData,
    'project',
    projectSchema,
    (actor, input) => upsertProject(db, actor, input),
  );
  if (result.ok) redirect(`/admin/projects/${result.data.id}?saved=1`);
  return result;
}

export async function savePostForm(_prev: EntityResult | null, formData: FormData) {
  const result = await handle(
    'post',
    formData,
    'post',
    postSchema,
    (actor, input) => postService.upsert(db, actor, input),
  );
  if (result.ok) redirect(`/admin/posts/${result.data.id}?saved=1`);
  return result;
}

export async function saveStoryForm(_prev: EntityResult | null, formData: FormData) {
  const result = await handle(
    'story',
    formData,
    'story',
    storySchema,
    (actor, input) => storyService.upsert(db, actor, input),
  );
  if (result.ok) redirect(`/admin/stories/${result.data.id}?saved=1`);
  return result;
}

export async function saveProgramForm(_prev: EntityResult | null, formData: FormData) {
  const result = await handle(
    'program',
    formData,
    'program',
    programSchema,
    (actor, input) => programService.upsert(db, actor, input),
  );
  if (result.ok) redirect(`/admin/programs/${result.data.id}?saved=1`);
  return result;
}

export async function saveVacancyForm(_prev: EntityResult | null, formData: FormData) {
  const result = await handle(
    'vacancy',
    formData,
    'vacancy',
    vacancySchema,
    (actor, input) => vacancyService.upsert(db, actor, input),
  );
  if (result.ok) redirect(`/admin/vacancies/${result.data.id}?saved=1`);
  return result;
}

export async function savePublicationForm(_prev: EntityResult | null, formData: FormData) {
  const result = await handle(
    'publication',
    formData,
    'publication',
    publicationSchema,
    (actor, input) => publicationService.upsert(db, actor, input),
  );
  if (result.ok) redirect(`/admin/publications/${result.data.id}?saved=1`);
  return result;
}

export async function savePageForm(_prev: EntityResult | null, formData: FormData) {
  const result = await handle(
    'page',
    formData,
    'page',
    pageSchema,
    (actor, input) => pageService.upsert(db, actor, input),
  );
  if (result.ok) redirect(`/admin/pages/${result.data.id}?saved=1`);
  return result;
}

export async function savePartnerForm(_prev: EntityResult | null, formData: FormData) {
  const result = await handle(
    'partner',
    formData,
    'partner',
    partnerSchema,
    (actor, input) => upsertPartner(db, actor, input),
  );
  if (result.ok) redirect(`/admin/partners/${result.data.id}?saved=1`);
  return result;
}

export async function savePersonForm(_prev: EntityResult | null, formData: FormData) {
  const result = await handle(
    'person',
    formData,
    'person',
    personSchema,
    (actor, input) => upsertPerson(db, actor, input),
  );
  if (result.ok) redirect(`/admin/people/${result.data.id}?saved=1`);
  return result;
}

export async function saveMetricForm(_prev: EntityResult | null, formData: FormData) {
  const result = await handle(
    'metric',
    formData,
    'metric',
    metricSchema,
    (actor, input) => upsertMetric(db, actor, input),
  );
  if (result.ok) redirect(`/admin/metrics/${result.data.id}?saved=1`);
  return result;
}

// ── Media, redirects, users ──────────────────────────────────────────────
// Not content entities: no slug, no status, a different service each — but
// the same shape of action, so the same helper carries them.

export async function saveMediaForm(_prev: EntityResult | null, formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const result = await handle(
    'media',
    formData,
    'media',
    // `kind` is fixed at upload; the form edits the descriptive fields only.
    mediaMetadataSchema.omit({ kind: true }),
    async (actor, input) => {
      await updateMedia(db, actor, id, input);
      // Alt text, caption and consent state render on every page that embeds
      // the asset, and those pages are cached by their own slug or key — the
      // `media` list tag alone does not reach them.
      for (const usage of await getMediaUsage(actor, id)) {
        if (usage.cacheEntity) revalidateEntity(usage.cacheEntity, usage.cacheKeys);
      }
      return { id };
    },
  );
  if (result.ok) redirect(`/admin/media/${id}?saved=1`);
  return result;
}

export async function saveRedirectForm(_prev: EntityResult | null, formData: FormData) {
  const result = await handle(
    'redirect',
    formData,
    'redirect',
    redirectSchema,
    (actor, input) => createRedirect(db, actor, input),
  );
  if (result.ok) redirect('/admin/redirects?ok=admin.created');
  return result;
}

/**
 * The auth call is made here, not in the service. Creating an `auth.users` row
 * is an HTTP request to Supabase with the service-role key — a runtime
 * concern, like the storage delete in `catalog.ts` — and `supabase-server.ts`
 * imports `next/headers`, which a service may not. The service receives it as
 * a port and owns everything that is a rule: who may invite, the least-
 * privilege default, the audit entry.
 */
export async function inviteUserForm(_prev: EntityResult | null, formData: FormData) {
  const result = await runAction(async () => {
    const actor = await requireActor();
    const raw = parseAdminForm(formData, SHAPES.user);
    const parsed = inviteUserSchema.safeParse(raw);
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }

    const { createSupabaseAdminClient } = await import('@/lib/auth/supabase-server');
    const user = await inviteUser(db, actor, parsed.data, {
      async inviteByEmail(email, fullName) {
        const { data, error } = await createSupabaseAdminClient().auth.admin.inviteUserByEmail(
          email,
          // `handle_new_user` reads `full_name` from the user metadata.
          { data: { full_name: fullName }, redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/admin/login` },
        );
        if (error || !data.user) throw error ?? new Error('invite returned no user');
        return { id: data.user.id };
      },
    });
    return ok({ id: user.id }, 'admin.invited');
  });
  if (result.ok) redirect('/admin/users?ok=admin.invited');
  return result;
}
