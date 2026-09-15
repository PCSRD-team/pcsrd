import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectCard } from "@/components/content/cards";
import { RichText } from "@/components/content/rich-text";
import {
  Panel,
  Prose,
  Section,
  SectionHeading,
} from "@/components/ui/primitives";
import { UntranslatedNotice } from "@/components/ui/states";
import { getProgramBySlug, listPrograms } from "@/db/queries/content";
import { listProjects } from "@/db/queries/projects";
import { LOCALES, isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { prerenderData } from "@/lib/build-time";
import { Cover } from "@/components/content/cards";

export const revalidate = 3600;

/**
 * Both locales are pre-rendered for every published programme. There are three
 * programmes, so this is six pages — cheap enough to build eagerly, and it
 * means the first visitor never waits.
 */
export async function generateStaticParams() {
  const params: { locale: string; slug: string }[] = [];
  for (const locale of LOCALES) {
    const programs = await prerenderData(
      `programmes (${locale})`,
      () => listPrograms(locale),
      [],
    );
    for (const program of programs) {
      if (program.slug) params.push({ locale, slug: program.slug });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/programs/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const program = await getProgramBySlug(slug, locale);
  if (!program) return {};

  return {
    title:
      program.seoTitleAr && locale === "ar"
        ? program.seoTitleAr
        : program.title,
    description:
      (locale === "ar" ? program.seoDescriptionAr : program.seoDescriptionEn) ??
      program.tagline,
    robots: program.noIndex ? { index: false, follow: false } : undefined,
    alternates: {
      canonical: `/${locale}/programs/${slug}`,
      languages: {
        ar: `/ar/programs/${program.slugAr}`,
        en: `/en/programs/${program.slugEn}`,
      },
    },
  };
}

export default async function ProgramPage({
  params,
}: PageProps<"/[locale]/programs/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, program] = await Promise.all([
    getDictionary(locale),
    getProgramBySlug(slug, locale),
  ]);
  if (!program) notFound();

  const projects = await listProjects(locale, {
    program: program.key,
    page: 1,
  });

  return (
    <div className="container-content section-gap ">
      {!program.isTranslated ? (
        <UntranslatedNotice
          title={dict.states.untranslatedTitle}
          body={dict.states.untranslatedBody}
        />
      ) : null}
      <Cover
        path={program.hero?.path ?? null}
        alt={program.hero?.alt ?? null}
        blur={program.hero?.blur}
        className="mbe-10 h-64 w-full"
      />
      {/*
        Programme identity is a 2px rule in the programme's own colour — the
        only colour outside ink/gold/paper on the page, and a mark rather than
        a fill.
      */}
      <h1 className="mbe-5 block text-center text-3xl font-semibold leading-[1.1] text-[#0F1B33] md:text-4xl lg:text-5xl xl:text-6xl">
        {program.title}
      </h1>
      {program.tagline ? (
        <p className="mbe-6 w-full text-center text-lead text-ink">
          {program.tagline}
        </p>
      ) : null}{" "}
      {program.introduction ? (
        <div className="w-full bg-white p-7 border border-stone-300 border-s-2 border-s-[#c9a16f] transition-all duration-200 hover:bg-gray-50 mbs-10 mbe-25">
          <Prose className="w-full max-w-none">
            <RichText doc={program.introduction} />
          </Prose>
        </div>
      ) : null}
      {/*
        Eligibility and access come before the rationale. A beneficiary reading
        this page needs to know whether the service is for them and how to reach
        it; the strategic argument is for a different reader.
      */}
      {program.eligibility || program.howToAccess ? (
        <Section labelledBy="program-access">
          <SectionHeading
            id="program-access"
            title={dict.programs.eligibility}
          />
          <div className="grid gap-6 md:grid-cols-2 ">
            {program.eligibility ? (
              <Panel className="hover:bg-gray-50">
                <h3 className="text-h3 font-semibold">
                  {dict.programs.eligibility}
                </h3>
                <div className="mbs-4">
                  <RichText doc={program.eligibility} />
                </div>
              </Panel>
            ) : null}
            {program.howToAccess ? (
              <Panel className="motion-standard transition-colors hover:bg-gold-050" tone="gold">
                <h3 className="text-h3 font-semibold">
                  {dict.programs.howToAccess}
                </h3>
                <div className="mbs-4">
                  <RichText doc={program.howToAccess} />
                </div>
              </Panel>
            ) : null}
          </div>
        </Section>
      ) : null}
      {program.rationale ? (
        <Section labelledBy="program-rationale">
          <SectionHeading
            id="program-rationale"
            title={dict.programs.objectives}
          />
          {program.strategicObjective ? (
            <p className="measure mbe-6 text-lead text-ink">
              {program.strategicObjective}
            </p>
          ) : null}
          <Prose>
            <RichText doc={program.rationale} />
          </Prose>
        </Section>
      ) : null}
      {program.impactStatement ? (
        <Section labelledBy="program-impact">
          <SectionHeading id="program-impact" title={dict.impact.title} />
          <Prose>
            <RichText doc={program.impactStatement} />
          </Prose>
        </Section>
      ) : null}
      {projects.items.length > 0 ? (
        <Section labelledBy="program-projects">
          <SectionHeading
            id="program-projects"
            title={dict.programs.projectsInProgram}
          />
          <div className="grid gap-6 md:grid-cols-3">
            {projects.items.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                locale={locale}
                dict={dict}
              />
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
