'use server';

import { db } from '@/db';
import type { ContentStatus } from '@/db/schema/enums';
import { requireActor } from '@/lib/auth/guard';
import { revalidateEntity } from '@/lib/cache/revalidate';
import type { Entity } from '@/lib/cache/tags';
import { type ActionResult, ok, runAction } from '@/lib/errors';
import { fieldErrorsFrom } from '@/lib/validation/common';
import {
  pageService,
  postService,
  programService,
  publicationService,
  storyService,
  vacancyService,
} from '@/services/content';
import type { ContentMutationResult, ContentService, ContentInputBase } from '@/services/_shared/content-service';
import {
  deleteProject,
  setProjectStatus,
  upsertProject,
} from '@/services/content/project.service';
import {
  pageSchema,
  postSchema,
  programSchema,
  projectSchema,
  publicationSchema,
  storySchema,
  vacancySchema,
} from '@/lib/validation/admin';
import { err } from '@/lib/errors';
import type { z } from 'zod';

/**
 * CMS mutations.
 *
 * Every one of these is the same six lines: guard, validate, call the service,
 * revalidate, return. There is no `if` here that is not about HTTP or shape —
 * permissions, consent gates, slug uniqueness and audit entries all live in the
 * services, where a cron job or a seed script reaches them too.
 *
 * `revalidateTag` is called **here** rather than in the service on purpose: it
 * is a Next runtime API, and importing `next/cache` into a service would make
 * that service unusable outside a request scope — which is exactly what the
 * integration tests rely on.
 */

type Mutation = ActionResult<{ id: string }>;

/**
 * Both the new and the previous slugs are invalidated. Renaming a page leaves
 * the old URL cached otherwise, and a stale page at the old address is
 * indistinguishable from a deployment that did not happen.
 */
function revalidateResult(entity: Entity, result: ContentMutationResult) {
  revalidateEntity(entity, { ar: result.slugAr, en: result.slugEn });
  if (result.previousSlugs) {
    revalidateEntity(entity, { ar: result.previousSlugs.ar, en: result.previousSlugs.en });
  }
}

/** Builds the three actions an entity needs from its service and schema. */
function contentActions<TSchema extends z.ZodType<ContentInputBase>>(
  entity: Entity,
  service: ContentService<z.infer<TSchema>>,
  schema: TSchema,
) {
  return {
    save: (input: unknown): Promise<Mutation> =>
      runAction(async () => {
        const actor = await requireActor();
        const parsed = schema.safeParse(input);
        if (!parsed.success) {
          return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
        }
        const result = await service.upsert(db, actor, parsed.data);
        revalidateResult(entity, result);
        return ok({ id: result.id }, 'admin.saved');
      }),

    setStatus: (id: string, status: ContentStatus): Promise<Mutation> =>
      runAction(async () => {
        const actor = await requireActor();
        const result = await service.setStatus(db, actor, id, status);
        revalidateResult(entity, result);
        return ok({ id: result.id }, 'admin.statusChanged');
      }),

    remove: (id: string): Promise<Mutation> =>
      runAction(async () => {
        const actor = await requireActor();
        const result = await service.remove(db, actor, id);
        revalidateResult(entity, result);
        return ok({ id: result.id }, 'admin.deleted');
      }),
  };
}

const postActions = contentActions('post', postService, postSchema);
const storyActions = contentActions('story', storyService, storySchema);
const programActions = contentActions('program', programService, programSchema);
const vacancyActions = contentActions('vacancy', vacancyService, vacancySchema);
const publicationActions = contentActions('publication', publicationService, publicationSchema);
const pageActions = contentActions('page', pageService, pageSchema);

// A module marked 'use server' may only export async functions, so each one is
// re-exported explicitly rather than as an object.

export async function savePost(input: unknown) {
  return postActions.save(input);
}
export async function setPostStatus(id: string, status: ContentStatus) {
  return postActions.setStatus(id, status);
}
export async function deletePost(id: string) {
  return postActions.remove(id);
}

export async function saveStory(input: unknown) {
  return storyActions.save(input);
}
export async function setStoryStatus(id: string, status: ContentStatus) {
  return storyActions.setStatus(id, status);
}
export async function deleteStory(id: string) {
  return storyActions.remove(id);
}

export async function saveProgram(input: unknown) {
  return programActions.save(input);
}
export async function setProgramStatus(id: string, status: ContentStatus) {
  return programActions.setStatus(id, status);
}

export async function saveVacancy(input: unknown) {
  return vacancyActions.save(input);
}
export async function setVacancyStatus(id: string, status: ContentStatus) {
  return vacancyActions.setStatus(id, status);
}
export async function deleteVacancy(id: string) {
  return vacancyActions.remove(id);
}

export async function savePublication(input: unknown) {
  return publicationActions.save(input);
}
export async function setPublicationStatus(id: string, status: ContentStatus) {
  return publicationActions.setStatus(id, status);
}
export async function deletePublication(id: string) {
  return publicationActions.remove(id);
}

export async function savePage(input: unknown) {
  return pageActions.save(input);
}
export async function setPageStatus(id: string, status: ContentStatus) {
  return pageActions.setStatus(id, status);
}

// ── Projects ─────────────────────────────────────────────────────────────
// Written out rather than generated: projects carry partner and media
// junctions, and publishing one also changes what its programme page shows.

export async function saveProject(input: unknown): Promise<Mutation> {
  return runAction(async () => {
    const actor = await requireActor();
    const parsed = projectSchema.safeParse(input);
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }
    const result = await upsertProject(db, actor, parsed.data);
    revalidateResult('project', result);
    return ok({ id: result.id }, 'admin.saved');
  });
}

export async function setProjectStatusAction(
  id: string,
  status: ContentStatus,
): Promise<Mutation> {
  return runAction(async () => {
    const actor = await requireActor();
    const result = await setProjectStatus(db, actor, id, status);
    revalidateResult('project', result);
    return ok({ id: result.id }, 'admin.statusChanged');
  });
}

export async function deleteProjectAction(id: string): Promise<Mutation> {
  return runAction(async () => {
    const actor = await requireActor();
    const result = await deleteProject(db, actor, id);
    revalidateResult('project', result);
    return ok({ id: result.id }, 'admin.deleted');
  });
}
