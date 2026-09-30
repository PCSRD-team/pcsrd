import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ContentBreadcrumbs } from '@/components/content/page-chrome';
import { RichText } from '@/components/content/rich-text';
import { getSiteName } from '@/components/content/site';
import { DynamicApplicationForm } from '@/components/forms/dynamic-form';
import { Badge } from '@/components/ui/badge';
import { DateText } from '@/components/ui/bidi';
import { ButtonLink } from '@/components/ui/button';
import { Panel } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Container, PageHeader, Section } from '@/components/ui/layout';
import { Prose } from '@/components/ui/typography';
import { getApplicationForm } from '@/db/queries/applications';
import { getApplyFormContext } from '@/db/queries/content';
import { formatInstant, toDateTimeAttr } from '@/lib/format';
import { type Locale, isLocale, localePath } from '@/lib/i18n/config';
import { formSlice } from '@/lib/i18n/form-dict';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { richTextToPlainText } from '@/lib/seo/json-ld';
import { buildMetadata, seoFallback } from '@/lib/seo/metadata';
import { isFormOpen } from '@/services/applications/application-form.service';
import { decodeParam } from '@/lib/route-params';
import { plural } from '@/lib/i18n/plural';

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
  const { locale, slug: rawSlug } = await params;
  const slug = decodeParam(rawSlug);
  if (!isLocale(locale)) return {};

  const [form, siteName, context] = await Promise.all([
    getApplicationForm(slug, locale),
    getSiteName(locale),
    getApplyFormContext(slug, locale),
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
    // A form with no English title renders the Arabic form on /en: that URL
    // is the untranslated case, not an English alternate (noindex, canonical
    // to Arabic, no `en` hreflang on either side).
    translationStatus: context?.hasEnglish === false ? 'ar_only' : 'human_translated',
    // A closed form stays reachable but leaves the index — the same rule the
    // vacancy page applies to a closed vacancy.
    noIndex: !state.open,
  });
}

export default async function ApplyPage({ params }: PageProps<'/[locale]/apply/[slug]'>) {
  const { locale, slug: rawSlug } = await params;
  const slug = decodeParam(rawSlug);
  if (!isLocale(locale)) notFound();

  const [dict, form, context] = await Promise.all([
    getDictionary(locale),
    getApplicationForm(slug, locale),
    getApplyFormContext(slug, locale),
  ]);
  if (!form) notFound();

  // A form behind a vacancy sits under that vacancy in the trail, and links
  // back to it: an applicant who landed here from a shared link has not read
  // the posting yet.
  const vacancy = form.vacancyId ? (context?.vacancy ?? null) : null;
  const vacancyPath = vacancy ? `/careers/${vacancy.slug}` : null;

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
        trail={[
          { path: '/careers', label: dict.careers.title },
          ...(vacancy && vacancyPath ? [{ path: vacancyPath, label: vacancy.title ?? dict.careers.vacancyDetails }] : []),
          { label: form.title },
        ]}
        currentPath={`/apply/${form.slug}`}
      />

      <PageHeader
        eyebrow={t.kind[form.kind]}
        title={form.title}
        meta={
          <>
            {closesAt ? (
              // A form closes at an instant, shown on the Palestine clock with
              // the zone named — "23:59" alone would be read in the reader's.
              <Badge tone="neutral">
                {t.deadline}:{' '}
                <time dateTime={toDateTimeAttr(closesAt)}>
                  <DateText locale={locale}>{formatInstant(closesAt, locale)}</DateText>
                </time>{' '}
                {t.siteTimeZone}
              </Badge>
            ) : null}
            {slotsLeft !== null && state.open && !waitlisting ? (
              <Badge tone="neutral">{fill(t.slotsLeft, { n: slotsLeft })}</Badge>
            ) : null}
          </>
        }
      />

      <Section>
        {vacancyPath ? (
          <p className="mbe-6">
            <ButtonLink href={localePath(locale, vacancyPath)} tone="secondary" size="sm">
              {dict.careers.vacancyDetails}
            </ButtonLink>
          </p>
        ) : null}
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
                retentionNotice: plural(locale, form.retentionMonths, t.retentionNoticeCount),
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
  copy: {
    notYetTitle: string;
    notYetBody: string;
    fullTitle: string;
    fullBody: string;
    closedTitle: string;
    closedBody: string;
    siteTimeZone: string;
  };
  opensAt: Date | null;
  locale: Locale;
  careersHref: string;
  careersLabel: string;
}) {
  const careersLink = (
    <div className="mbs-6">
      <ButtonLink href={careersHref} tone="secondary">
        {careersLabel}
      </ButtonLink>
    </div>
  );

  if (reason === 'not_yet') {
    // The opening date is its own isolated node, not text spliced into the
    // sentence: an Arabic sentence carrying a Latin-digit date and time
    // reorders around it unless the date is a bidi island. Same markup as
    // `EmptyState`, whose `body` takes only a string.
    const [before, after] = copy.notYetBody.split('{date}');
    return (
      <div className="mbs-8">
        <Panel tone="alt" padding="lg" className="text-center">
          <p className="text-h3 font-semibold text-ink text-balance">{copy.notYetTitle}</p>
          <p className="measure-lead mx-auto mbs-3 text-small text-ink-55">
            {before}
            {opensAt ? (
              <>
                <time dateTime={toDateTimeAttr(opensAt)}>
                  <DateText locale={locale}>{formatInstant(opensAt, locale)}</DateText>
                </time>{' '}
                {copy.siteTimeZone}
              </>
            ) : null}
            {after}
          </p>
        </Panel>
        {careersLink}
      </div>
    );
  }

  const content =
    reason === 'full'
      ? { title: copy.fullTitle, body: copy.fullBody }
      : { title: copy.closedTitle, body: copy.closedBody };

  return (
    <div className="mbs-8">
      <EmptyState title={content.title} body={content.body} />
      {careersLink}
    </div>
  );
}
