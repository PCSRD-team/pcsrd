import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MetricCard,
  PostCard,
  ProgramCard,
  ProjectCard,
} from "@/components/content/cards";
import { Bidi } from "@/components/ui/bidi";
import {
  ButtonLink,
  Panel,
  Prose,
  Section,
  SectionHeading,
} from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/states";
import {
  listMetrics,
  listPartners,
  listPosts,
  listPrograms,
  getOrganization,
} from "@/db/queries/content";
import { listProjects } from "@/db/queries/projects";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import Image from "next/image";

/**
 * The homepage.
 *
 * Built **last** in the route order, and composed entirely from components the
 * other pages already own — building it first would have meant writing every
 * card twice.
 *
 * Its two doors, per principle 4: the partnership CTA and the verified-channels
 * panel. Both are above the fold on mobile as well as desktop.
 */

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const [dict, org] = await Promise.all([
    getDictionary(locale),
    getOrganization(locale),
  ]);

  return {
    title: org?.legalName ?? org?.acronym,
    description: org?.mission ?? dict.home.programsLead,
    alternates: {
      canonical: `/${locale}`,
      languages: { ar: "/ar", en: "/en" },
    },
  };
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, org, programs, metrics, posts, projects, partners] =
    await Promise.all([
      getDictionary(locale),
      getOrganization(locale),
      listPrograms(locale),
      listMetrics(locale, { featuredOnly: true }),
      listPosts(locale, { limit: 4 }),
      listProjects(locale, { page: 1 }),
      listPartners(locale),
    ]);

  const featuredProjects = projects.items.slice(0, 3);
  const officialChannels = (org?.officialChannels ?? []).filter(
    (c) => c.is_official,
  );

  return (
    <>
      {/* Hero — the identity claim, stated plainly. */}
      <div className="relative min-h-[calc(100vh-9rem)] w-full overflow-hidden bg-[#faf9f6] mb-10">
        <Image
          src="/hero-bg.png"
          alt="People supporting each other"
          fill
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-linear-to-r rtl:bg-linear-to-l from-[#F7F4EE] via-[#FBFAF6] via-45%  to-transparent" />
        <div className="container-content relative z-10 flex  min-h-[calc(100vh-9rem)] items-center ">
          <div className="max-w-[560px]">
            <p className="eyebrow">{dict.home.heroEyebrow}</p>
            <h1 className="mbs-6 max-w-[20ch] text-h1 font-semibold text-ink md:text-[3.25rem] md:leading-[1.15]">
              {org?.legalName ?? org?.acronym ?? ""}
            </h1>
            <span className="rule-mark mbs-6 block" aria-hidden="true" />
            {org?.mission ? (
              <Prose className="mbs-8">
                <p className="text-lead text-ink-70">{org.mission}</p>
              </Prose>
            ) : null}

            <div className="mbs-10 flex flex-wrap gap-4 ">
              <ButtonLink
                className="rounded-3xl hover:shadow-md shadow-gray-400/50"
                href={localePath(locale, "/get-involved/partner")}
              >
                {dict.nav.partner}
              </ButtonLink>
              <ButtonLink
                className="rounded-3xl hover:border-blue-950 hover:shadow-md shadow-gray-400/50"
                href={localePath(locale, "/verify")}
                tone="secondary"
              >
                {dict.nav.verify}
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>

      {/* Programmes */}
      <div className="container-content">
        <Section labelledBy="home-programs">
          <SectionHeading
            id="home-programs"
            title={dict.home.programsTitle}
            lead={dict.home.programsLead}
          />
          {programs.length === 0 ? (
            <EmptyState
              title={dict.states.emptyTitle}
              body={dict.states.emptyBody}
            />
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {programs.map((program) => (
                <ProgramCard
                  key={program.id}
                  program={program}
                  locale={locale}
                />
              ))}
            </div>
          )}
        </Section>

        {/* Impact — every figure with its period and status. */}
        <Section labelledBy="home-impact">
          <SectionHeading
            id="home-impact"
            title={dict.home.impactTitle}
            lead={dict.home.impactLead}
          />
          {metrics.length === 0 ? (
            <EmptyState
              title={dict.states.emptyTitle}
              body={dict.states.emptyBody}
            />
          ) : (
            <ul className="grid gap-6 md:grid-cols-3">
              {metrics.map((metric) => (
                <MetricCard
                  key={metric.id}
                  metric={metric}
                  locale={locale}
                  dict={dict}
                />
              ))}
            </ul>
          )}
          <div className="mbs-8">
            <Link href={localePath(locale, "/impact")}>
              {dict.common.viewAll}
            </Link>
          </div>
        </Section>

        {/* Projects */}
        {featuredProjects.length > 0 ? (
          <Section labelledBy="home-projects">
            <SectionHeading
              id="home-projects"
              title={dict.projects.title}
              lead={dict.projects.lead}
            />
            <div className="grid gap-6 md:grid-cols-3">
              {featuredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  locale={locale}
                  dict={dict}
                />
              ))}
            </div>
            <div className="mbs-8">
              <Link href={localePath(locale, "/projects")}>
                {dict.common.viewAll}
              </Link>
            </div>
          </Section>
        ) : null}

        {/* Latest */}
        {posts.items.length > 0 ? (
          <Section labelledBy="home-news">
            <SectionHeading id="home-news" title={dict.home.latestTitle} />
            <div className="grid gap-4">
              {posts.items.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  locale={locale}
                  dict={dict}
                />
              ))}
            </div>
            <div className="mbs-8">
              <Link href={localePath(locale, "/news")}>
                {dict.common.viewAll}
              </Link>
            </div>
          </Section>
        ) : null}

        {/* Verified channels — the anti-impersonation door. */}
        <Section labelledBy="home-verify">
          <SectionHeading
            id="home-verify"
            title={dict.home.verifyTitle}
            lead={dict.home.verifyLead}
          />
          <Panel tone="gold">
            {officialChannels.length === 0 ? (
              <p className="text-small text-ink-70">{dict.states.emptyBody}</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {officialChannels.map((channel) => (
                  <li
                    key={`${channel.platform}:${channel.handle}`}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-3"
                  >
                    <span className="text-small font-medium text-ink">
                      {channel.platform}
                    </span>
                    <a
                      href={channel.url}
                      rel="noopener noreferrer me"
                      target="_blank"
                      className="font-mono text-caption"
                    >
                      <Bidi>{channel.handle}</Bidi>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <div className="mbs-6">
              <ButtonLink href={localePath(locale, "/verify")} tone="marked">
                {dict.verify.title}
              </ButtonLink>
            </div>
          </Panel>
        </Section>

        {/* Partners */}
        {partners.length > 0 ? (
          <Section labelledBy="home-partners">
            <SectionHeading
              id="home-partners"
              title={dict.home.partnersTitle}
            />
            <ul className="flex flex-wrap gap-x-8 gap-y-3 text-small text-ink-70">
              {partners.slice(0, 12).map((partner) => (
                <li key={partner.id}>{partner.name}</li>
              ))}
            </ul>
            <div className="mbs-8">
              <Link href={localePath(locale, "/partners")}>
                {dict.common.viewAll}
              </Link>
            </div>
          </Section>
        ) : null}
      </div>
    </>
  );
}
