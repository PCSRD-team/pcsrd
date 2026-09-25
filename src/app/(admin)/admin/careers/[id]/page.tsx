import { notFound } from 'next/navigation';
import {
  deleteApplicationForm,
  setApplicationFormStatus,
  updateApplicationForm,
} from '@/actions/admin/application-forms';
import { adminDict, adminFormDict } from '@/components/admin/admin-dict';
import { adminUi, fill } from '@/components/admin/admin-ui-dict';
import { ApplicationFormEditor } from '@/components/admin/application-form-editor';
import { StatusBadge } from '@/components/admin/controls';
import { FieldBuilder } from '@/components/admin/field-builder';
import { Flash } from '@/components/admin/flash';
import { AdminHeader } from '@/components/admin/shell';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Panel } from '@/components/ui/card';
import { Cluster, Stack } from '@/components/ui/layout';
import { Notice } from '@/components/ui/notice';
import { Tabs } from '@/components/ui/tabs';
import { Eyebrow } from '@/components/ui/typography';
import { db } from '@/db';
import { listVacancyOptions } from '@/db/queries/admin/applications';
import { requireAuth } from '@/lib/auth/guard';
import { DEFAULT_LOCALE, localePath } from '@/lib/i18n/config';
import { isAppError } from '@/lib/errors';
import { getForm, isFormOpen } from '@/services/applications/application-form.service';

export const dynamic = 'force-dynamic';

/**
 * One form: its settings, its fields, and the buttons that publish it.
 *
 * The two halves are tabs rather than one long page because they are edited at
 * different times — the window and the cap are set once, the fields are worked
 * on repeatedly — and a save in one half must not be able to discard unsaved
 * work in the other. They are separate `<form>` elements posting to separate
 * actions, so that is structural rather than a convention anyone has to
 * remember.
 *
 * `Tabs` is server-rendered from the query string, so switching tabs is a
 * navigation and works with scripting off.
 */
export default async function CareersFormPage({
  params,
  searchParams,
}: PageProps<'/admin/careers/[id]'>) {
  const [actor, { id }, search] = await Promise.all([requireAuth(), params, searchParams]);

  // `getForm` throws `not_found` for a row the policy filtered as well as for
  // one that does not exist — the two are meant to be indistinguishable — so
  // both land on the 404 page rather than an error boundary.
  const form = await getForm(db, actor, id).catch((error) => {
    if (isAppError(error) && error.code === 'not_found') notFound();
    throw error;
  });

  const vacancyOptions = await listVacancyOptions(actor, form.vacancyId);
  const t = adminUi.careers;
  const state = isFormOpen(form);

  const tab = (Array.isArray(search.tab) ? search.tab[0] : search.tab) ?? 'fields';

  // Built through `localePath`, never written as a literal: the locale segment
  // belongs to one function so adding a third locale is one change, not a grep.
  const previewHref = localePath(DEFAULT_LOCALE, `/apply/${form.slug}`);

  return (
    <>
      <AdminHeader
        title={form.titleAr}
        description={t.description}
        meta={
          <Cluster gap={2}>
            <StatusBadge status={form.status} />
            {state.open ? (
              <Badge tone="accent">{t.openState.open}</Badge>
            ) : state.reason && state.reason !== 'unpublished' ? (
              <Badge tone="neutral">{t.openState[state.reason]}</Badge>
            ) : null}
            <Badge tone="neutral">{fill(t.applicantCount, { n: form.applicationCount })}</Badge>
          </Cluster>
        }
        action={
          <Cluster gap={2}>
            <ButtonLink href={`/admin/careers/${form.id}/applicants`}>
              {t.applicants}
            </ButtonLink>
            {form.status === 'published' ? (
              <ButtonLink href={previewHref} tone="secondary" external>
                {t.preview}
              </ButtonLink>
            ) : null}
          </Cluster>
        }
      />

      <Flash searchParams={search} />

      <StatusBar form={form} />

      {/* Server-rendered from the query string, so switching tabs is a
          navigation and needs no JavaScript. */}
      <Tabs
        label={t.settings}
        items={[
          {
            href: `/admin/careers/${form.id}?tab=fields`,
            label: t.fields,
            count: form.fields.length,
            current: tab !== 'settings',
          },
          {
            href: `/admin/careers/${form.id}?tab=settings`,
            label: t.settings,
            current: tab === 'settings',
          },
        ]}
      />

      {tab === 'settings' ? (
        <ApplicationFormEditor
          action={updateApplicationForm}
          dict={adminFormDict()}
          vacancyOptions={vacancyOptions}
          values={{
            id: form.id,
            kind: form.kind,
            slug: form.slug,
            titleAr: form.titleAr,
            titleEn: form.titleEn,
            introAr: form.introAr,
            introEn: form.introEn,
            opensAt: form.opensAt,
            closesAt: form.closesAt,
            capacity: form.capacity,
            capacityRule: form.capacityRule,
            confirmationAr: form.confirmationAr,
            confirmationEn: form.confirmationEn,
            notifyEmails: form.notifyEmails,
            retentionMonths: form.retentionMonths,
            allowMultiplePerEmail: form.allowMultiplePerEmail,
            requireConsent: form.requireConsent,
            vacancyId: form.vacancyId,
          }}
        />
      ) : (
        <FieldBuilder
          formId={form.id}
          slug={form.slug}
          fields={form.fields}
          hasApplications={form.applicationCount > 0}
        />
      )}
    </>
  );
}

/**
 * Publish, unpublish, archive, delete — and the public link.
 *
 * Rendered above the tabs because it applies to the form as a whole rather
 * than to either half of it. `setFormStatus` refuses a publish that would put
 * a broken form in front of an applicant (no fields, sensitive fields without
 * consent, a deadline already past), and the refusal arrives here as a flash.
 */
function StatusBar({
  form,
}: {
  form: Awaited<ReturnType<typeof getForm>>;
}) {
  const t = adminUi.careers;
  const returnTo = `/admin/careers/${form.id}`;

  return (
    <Panel tone="alt" padding="sm" className="mbe-6">
      <Stack gap={3}>
        {form.status === 'published' ? (
          <div>
            <Eyebrow>{t.publicLink}</Eyebrow>
            <p className="mbs-1 font-mono text-caption text-ink" dir="ltr">
              {localePath(DEFAULT_LOCALE, `/apply/${form.slug}`)}
            </p>
          </div>
        ) : null}

        {form.fields.filter((field) => field.type !== 'section').length === 0 ? (
          <Notice tone="warning">{t.noFieldsBody}</Notice>
        ) : null}

        <Cluster gap={2}>
          {form.status !== 'published' ? (
            <StatusForm id={form.id} returnTo={returnTo} status="published" label={adminDict.form.publish} />
          ) : (
            <StatusForm id={form.id} returnTo={returnTo} status="draft" label={adminDict.form.unpublish} tone="secondary" />
          )}
          {form.status !== 'archived' ? (
            <StatusForm id={form.id} returnTo={returnTo} status="archived" label={adminDict.form.archive} tone="quiet" />
          ) : null}

          {/* Deleting cascades to every application on the form, so the hint
              says how many before the click, not after. */}
          <form action={deleteApplicationForm}>
            <input type="hidden" name="id" value={form.id} />
            <input type="hidden" name="slug" value={form.slug} />
            <Button type="submit" tone="danger" size="sm">
              {adminDict.form.delete}
            </Button>
          </form>
        </Cluster>

        <p className="text-caption text-ink-55">{adminDict.form.deleteHint}</p>
      </Stack>
    </Panel>
  );
}

function StatusForm({
  id,
  returnTo,
  status,
  label,
  tone,
}: {
  id: string;
  returnTo: string;
  status: string;
  label: string;
  tone?: 'secondary' | 'quiet';
}) {
  return (
    <form action={setApplicationFormStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <Button type="submit" tone={tone} size="sm">
        {label}
      </Button>
    </form>
  );
}
