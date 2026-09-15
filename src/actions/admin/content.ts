'use server';

import { redirect } from 'next/navigation';
import { db } from '@/db';
import type { ContentStatus } from '@/db/schema/enums';
import { requireActor } from '@/lib/auth/guard';
import { revalidateEntity } from '@/lib/cache/revalidate';
import type { Entity } from '@/lib/cache/tags';
import { type ActionResult, err, ok, runAction } from '@/lib/errors';
import { fieldErrorsFrom } from '@/lib/validation/common';
import { rowDeleteSchema, rowStatusSchema } from '@/lib/validation/admin';
import type { Actor } from '@/services/_shared/actor';
import type { ContentMutationResult } from '@/services/_shared/content-service';
import {
  pageService,
  postService,
  programService,
  publicationService,
  storyService,
  vacancyService,
} from '@/services/content';
import {
  deleteMetric,
  deletePartner,
  deletePerson,
  setPartnerStatus,
} from '@/services/content/catalog.service';
import { deleteProject, setProjectStatus } from '@/services/content/project.service';
import { safeReturnPath, withFlash } from './flash';

/**
 * Row actions: publish / unpublish / archive and delete, from a list row or an
 * edit page.
 *
 * Two actions cover every entity rather than two per entity. Each is a plain
 * `<form action>` target that takes `FormData` — the entity, the id, the target
 * status and where to go back to — so a row button works with JavaScript
 * disabled. The entity name is validated against a closed enum before it is
 * used to pick a service, which is what makes one endpoint for eight tables
 * safe.
 *
 * The action **redirects** rather than returning a result: a Server Component
 * form has no `useActionState` to receive one, and without JavaScript the only
 * feedback channel is the next page. The outcome travels as a dictionary key in
 * the query string and `<Flash>` renders it. Same discipline as every other
 * action here: guard, validate, call the service, revalidate. No business
 * logic — the unpublish-first rule, the consent gate and the permission check
 * all live in the services.
 */

type StatusEntity =
  | 'program'
  | 'project'
  | 'post'
  | 'story'
  | 'vacancy'
  | 'publication'
  | 'page'
  | 'partner';

type Runner<T> = (actor: Actor, id: string) => Promise<T>;

const STATUS_RUNNERS: Record<
  StatusEntity,
  (status: ContentStatus) => Runner<ContentMutationResult | { id: string }>
> = {
  program: (status) => (actor, id) => programService.setStatus(db, actor, id, status),
  project: (status) => (actor, id) => setProjectStatus(db, actor, id, status),
  post: (status) => (actor, id) => postService.setStatus(db, actor, id, status),
  story: (status) => (actor, id) => storyService.setStatus(db, actor, id, status),
  vacancy: (status) => (actor, id) => vacancyService.setStatus(db, actor, id, status),
  publication: (status) => (actor, id) => publicationService.setStatus(db, actor, id, status),
  page: (status) => (actor, id) => pageService.setStatus(db, actor, id, status),
  partner: (status) => (actor, id) => setPartnerStatus(db, actor, id, status),
};

const DELETE_RUNNERS: Record<StatusEntity | 'person' | 'metric', Runner<unknown>> = {
  program: (actor, id) => programService.remove(db, actor, id),
  project: (actor, id) => deleteProject(db, actor, id),
  post: (actor, id) => postService.remove(db, actor, id),
  story: (actor, id) => storyService.remove(db, actor, id),
  vacancy: (actor, id) => vacancyService.remove(db, actor, id),
  publication: (actor, id) => publicationService.remove(db, actor, id),
  page: (actor, id) => pageService.remove(db, actor, id),
  partner: (actor, id) => deletePartner(db, actor, id),
  person: (actor, id) => deletePerson(db, actor, id),
  metric: (actor, id) => deleteMetric(db, actor, id),
};

/**
 * Both the new and the previous slugs are invalidated. Renaming a page leaves
 * the old URL cached otherwise, and a stale page at the old address is
 * indistinguishable from a deployment that did not happen.
 */
function revalidateResult(entity: Entity, result: unknown) {
  const r = result as Partial<ContentMutationResult> | undefined;
  revalidateEntity(entity, { ar: r?.slugAr, en: r?.slugEn });
  if (r?.previousSlugs) {
    revalidateEntity(entity, { ar: r.previousSlugs.ar, en: r.previousSlugs.en });
  }
  // Pages and programmes are read by `key` (`getPageByKey` registers
  // `page:<key>`), so the slug tags above miss the entry the legal route
  // actually holds. `tagsFor` builds the item tag from whatever is passed as
  // `ar`, which is the key here.
  if (r?.key && (entity === 'page' || entity === 'program')) {
    revalidateEntity(entity, { ar: r.key });
  }
  // A partner logo appears on project pages, so those go stale too.
  if (entity === 'partner') revalidateEntity('project');
}

function fields(formData: FormData) {
  return Object.fromEntries(
    ['entity', 'id', 'status', 'returnTo'].map((key) => [key, formData.get(key) ?? undefined]),
  );
}

export async function setEntityStatus(formData: FormData): Promise<void> {
  const raw = fields(formData);
  const result: ActionResult<{ id: string }> = await runAction(async () => {
    const actor = await requireActor();
    const parsed = rowStatusSchema.safeParse(raw);
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }
    const { entity, id, status } = parsed.data;
    const mutated = await STATUS_RUNNERS[entity](status)(actor, id);
    revalidateResult(entity, mutated);
    return ok({ id }, 'admin.statusChanged');
  });

  redirect(withFlash(safeReturnPath(raw.returnTo), result));
}

export async function deleteEntity(formData: FormData): Promise<void> {
  const raw = fields(formData);
  const result: ActionResult<{ id: string }> = await runAction(async () => {
    const actor = await requireActor();
    const parsed = rowDeleteSchema.safeParse(raw);
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }
    const { entity, id } = parsed.data;
    const removed = await DELETE_RUNNERS[entity](actor, id);
    revalidateResult(entity, removed);
    return ok({ id }, 'admin.deleted');
  });

  redirect(withFlash(safeReturnPath(raw.returnTo), result));
}
