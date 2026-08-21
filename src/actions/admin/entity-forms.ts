'use server';

import { redirect } from 'next/navigation';
import { db } from '@/db';
import { requireActor } from '@/lib/auth/guard';
import { revalidateEntity } from '@/lib/cache/revalidate';
import type { Entity } from '@/lib/cache/tags';
import { type ActionResult, err, ok, runAction } from '@/lib/errors';
import type { Actor } from '@/services/_shared/actor';
import { fieldErrorsFrom } from '@/lib/validation/common';
import { parseAdminForm, type FormShape } from '@/lib/validation/form-data';
import {
  metricSchema,
  pageSchema,
  partnerSchema,
  personSchema,
  postSchema,
  programSchema,
  projectSchema,
  publicationSchema,
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
import type { z } from 'zod';

/**
 * The `FormData` entry points for the admin forms.
 *
 * These are a thin shell over `src/actions/admin/content.ts`, which takes an
 * already-parsed object. The split is deliberate: a form posts `FormData`, but
 * a bulk import, a seed script and a test all have an object already, and
 * making them build a `FormData` to reach the same code would be theatre.
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
} satisfies Record<string, FormShape>;

/**
 * `partners` and `donors` arrive as two lists but the service takes one list of
 * `{ partnerId, role }`. Reshaping here keeps the service's contract about the
 * junction rather than about the form that happened to produce it.
 */
function shapeProjectLinks(input: Record<string, unknown>) {
  const implementing = (input.implementingPartners as string[]) ?? [];
  const donors = (input.donors as string[]) ?? [];
  const gallery = (input.gallery as string[]) ?? [];

  return {
    ...input,
    partners: [
      ...implementing.map((partnerId) => ({ partnerId, role: 'implementing' as const })),
      ...donors.map((partnerId) => ({ partnerId, role: 'donor' as const })),
    ],
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
  ) => Promise<{ id: string; slugAr?: string; slugEn?: string }>,
): Promise<EntityResult> {
  return runAction(async () => {
    // Guard first, always — before the body is even parsed.
    const actor = await requireActor();

    const raw = parseAdminForm(formData, SHAPES[shapeKey]);
    const parsed = schema.safeParse(shapeKey === 'project' ? shapeProjectLinks(raw) : raw);

    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }

    const result = await run(actor, parsed.data);
    revalidateEntity(entity, { ar: result.slugAr, en: result.slugEn });
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
  if (result.ok) redirect('/admin/partners?saved=1');
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
  if (result.ok) redirect('/admin/people?saved=1');
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
  if (result.ok) redirect('/admin/metrics?saved=1');
  return result;
}
