import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ContentBreadcrumbs } from '@/components/content/page-chrome';
import { RichText } from '@/components/content/rich-text';
import { getSiteName } from '@/components/content/site';
import { DynamicApplicationForm } from '@/components/forms/dynamic-form';
import { Badge } from '@/components/ui/badge';
import { DateText } from '@/components/ui/bidi';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Container, PageHeader, Section } from '@/components/ui/layout';
import { Prose } from '@/components/ui/typography';
import { getApplicationForm } from '@/db/queries/applications';
import { formatDate } from '@/lib/format';
import { isLocale, localePath } from '@/lib/i18n/config';
import { formSlice } from '@/lib/i18n/form-dict';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { richTextToPlainText } from '@/lib/seo/json-ld';
import { buildMetadata, seoFallback } from '@/lib/seo/metadata';
import { isFormOpen } from '@/services/applications/application-form.service';

/**
 * The public application page.
 *
 * **Five minutes, not an hour.** A form with a cap is a page whose correctness
 * decays as people apply to it, and a visitor who fills in forty fields only to
 * be told at the last step that the last place went half an hour ago has been
 * wasted. `getApplicationForm` is still tag-cached — a builder edit busts it
 * immediately — and this bounds how stale the *count* can get between edits.
 *
 * **Never statically generated.** There is no `generateStaticParams` here, and
 * that is deliberate: the open/closed state depends on `now()` and on a counter
 * that changes without any content edit, so a prerendered page would advertise
 * a closed form until something else happened to invalidate it.
 *
 * The form is rendered only when it is open. When it is not, the page still
 * exists and says which of the four reasons applies — an applicant following a
 * link from a WhatsApp group two days late is owed a sentence, not a 404.
 */
export const revalidate = 300;

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/apply/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};

  const [form, siteName] = await Promise.all([
    getApplicationForm(slug, locale),
    getSiteName(locale),
  ]);
  if (!form) return {};

  const state = isFormOpen({
    status: 'published',
    opensAt: form.opensAt ? new Date(form.opensAt) : null,
    closesAt: form.closesAt ? new Date(form.closesAt) : null,
    capacity: form.capacity,
    capacityRule: form.capacityRule,
    submissionCount: form.submissionCount,
  });

  return buildMetadata({
    locale,
    path: { ar: `/apply/${form.slug}`, en: `/apply/${form.slug}` },
    title: seoFallback(null, form.title, siteName),
    description: seoFallback(null, richTextToPlainText(form.intro, 160)),
    siteName,
    // A closed form stays reachable but leaves the index — the same rule the
    // vacancy page applies to a closed vacancy.
    noIndex: !state.open,
  });
}

export default async function ApplyPage({ params }: PageProps<'/[locale]/apply/[slug]'>) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, form] = await Promise.all([getDictionary(locale), getApplicationForm(slug, locale)]);
  if (!form) notFound();

  const t = dict.apply;

  // `Serialized<T>` — a cache hit returns ISO strings where a miss returns
  // `Date`, so the dates are normalised once here rather than at four call
  // sites that would each have to remember.
  const opensAt = form.opensAt ? new Date(form.opensAt) : null;
  const closesAt = form.closesAt ? new Date(form.closesAt) : null;

  const state = isFormOpen({
    status: 'published',
    opensAt,
    closesAt,
    capacity: form.capacity,
    capacityRule: form.capacityRule,
    submissionCount: form.submissionCount,
  });

  const slotsLeft =
    form.capacity === null ? null : Math.max(0, form.capacity - form.submissionCount);

  // A cap that has been reached on a `waitlist` form keeps the form open and
  // changes what the page promises. The two are different states and the
  // applicant has to be told which one they are in *before* they start.
  const waitlisting = state.open && form.capacity !== null && slotsLeft === 0;

  const fill = (template: string, values: Record<string, string | number>) =>
    template.replace(/\{(\w+)\}/g, (match, key: string) =>
      key in values ? String(values[key]) : match,
    );

  return (
    <Container>
      <ContentBreadcrumbs
        locale={locale}
        dict={dict}
        trail={[{ path: '/careers', label: dict.careers.title }, { label: form.title }]}
      />

      <PageHeader
        eyebrow={t.kind[form.kind]}
        title={form.title}
        meta={
          <>
            {closesAt ? (
              <Badge tone="neutral">
                {t.deadline}: <DateText locale={locale}>{formatDate(closesAt, locale)}</DateText>
              </Badge>
            ) : null}
            {slotsLeft !== null && state.open && !waitlisting ? (
              <Badge tone="neutral">{fill(t.slotsLeft, { n: slotsLeft })}</Badge>
            ) : null}
          </>
        }
      />

      <Section>
        {form.intro ? (
          <Prose>
            <RichText doc={form.intro} />
          </Prose>
        ) : null}

        {state.open ? (
          <div className="mbs-8 max-w-prose">
            <DynamicApplicationForm
              form={{ ...form, opensAt, closesAt }}
              dict={formSlice(dict)}
              locale={locale}
              waitlisting={waitlisting}
              copy={{
                submit: t.submit,
                consentLabel: t.consentLabel,
                consentHelp: t.consentHelp,
                waitlistNotice: t.waitlistNotice,
                successWaitlisted: t.successWaitlisted,
                filesHint: t.filesHint,
                retentionNotice: fill(t.retentionNotice, { months: form.retentionMonths }),
              }}
            />
          </div>
        ) : (
          <ClosedState
            reason={state.reason}
            copy={t}
            opensAt={opensAt}
            locale={locale}
            careersHref={localePath(locale, '/careers')}
            careersLabel={dict.careers.title}
          />
        )}
      </Section>
    </Container>
  );
}

/**
 * Why the form is not accepting applications.
 *
 * Four reasons, four sentences. Collapsing them into one "applications are
 * closed" would be cheaper and would tell an applicant who arrived a day early
 * exactly the wrong thing.
 */
function ClosedState({
  reason,
  copy,
  opensAt,
  locale,
  careersHref,
  careersLabel,
}: {
  reason: 'unpublished' | 'not_yet' | 'closed' | 'full' | undefined;
  copy: { notYetTitle: string; notYetBody: string; fullTitle: string; fullBody: string; closedTitle: string; closedBody: string };
  opensAt: Date | null;
  locale: 'ar' | 'en';
  careersHref: string;
  careersLabel: string;
}) {
  const content =
    reason === 'not_yet'
      ? {
          title: copy.notYetTitle,
          body: copy.notYetBody.replace(
            '{date}',
            opensAt ? formatDate(opensAt, locale) : '',
          ),
        }
      : reason === 'full'
        ? { title: copy.fullTitle, body: copy.fullBody }
        : { title: copy.closedTitle, body: copy.closedBody };

  return (
    <div className="mbs-8">
      <EmptyState title={content.title} body={content.body} />
      <div className="mbs-6">
        <ButtonLink href={careersHref} tone="secondary">
          {careersLabel}
        </ButtonLink>
      </div>
    </div>
  );
}
