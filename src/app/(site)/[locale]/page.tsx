import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Bidi, DateText } from "@/components/ui/bidi";
import { ImpactCount } from "@/components/content/impact-count";
import { ProgrammeHeroCarousel, type ProgrammeHeroItem } from "@/components/content/programme-hero-carousel";
import { Badge, ButtonLink, Section, SectionHeading } from "@/components/ui/primitives";
import {
  getOrganization,
  listPartners,
  listPosts,
  listPrograms,
  listStories,
} from "@/db/queries/content";
import { listFeaturedProjects } from "@/db/queries/projects";
import { publicEnv } from "@/lib/env.public";
import { formatDate, formatPeriod, storageUrl } from "@/lib/format";
import { isLocale, localePath, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/get-dictionary";

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

type MediaAsset = {
  heroPath: string | null;
  heroAlt: string | null;
  heroBlur: string | null;
};

function mediaSrc(path: string) {
  return storageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, "media", path);
}

function isVisibleText(value: string | null | undefined) {
  const text = value?.trim();
  return Boolean(text && !text.startsWith("TODO(org):"));
}

function visibleText(value: string | null | undefined) {
  const text = value?.trim();
  return text && !text.startsWith("TODO(org):") ? text : null;
}

function hrefForCta(locale: Locale, url: string) {
  if (/^https?:\/\//i.test(url) || url.startsWith("mailto:") || url.startsWith("tel:")) return url;
  return localePath(locale, url.startsWith("/") ? url : `/${url}`);
}

function MediaFrame({
  media,
  priority = false,
  sizes,
  className,
}: {
  media: MediaAsset | null;
  priority?: boolean;
  sizes: string;
  className: string;
}) {
  if (!media?.heroPath) {
    return (
      <div className={`relative overflow-hidden rounded-lg bg-paper-alt ${className}`}>
        <Image
          src="/hero-bg.png"
          alt=""
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
        <span className="absolute inset-0 bg-ink/20" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className={`media-treatment relative rounded-lg ${className}`}>
      <Image
        src={mediaSrc(media.heroPath)}
        alt={media.heroAlt ?? ""}
        fill
        sizes={sizes}
        placeholder={media.heroBlur ? "blur" : "empty"}
        blurDataURL={media.heroBlur ?? undefined}
        priority={priority}
        className="media-zoom object-cover"
      />
    </div>
  );
}

function Arrow({ locale }: { locale: Locale }) {
  return <span aria-hidden="true">{locale === "ar" ? "‹" : "›"}</span>;
}

function TextLink({
  href,
  children,
  locale,
}: {
  href: string;
  children: ReactNode;
  locale: Locale;
}) {
  return (
    <Link
      href={href}
      className="motion-standard inline-flex min-h-11 items-center gap-2 rounded-md border border-ink/15 bg-paper px-4 text-small font-medium text-ink no-underline transition hover:-translate-y-0.5 hover:border-gold-600 hover:bg-gold-050"
    >
      {locale === "ar" ? <Arrow locale={locale} /> : null}
      {children}
      {locale === "en" ? <Arrow locale={locale} /> : null}
    </Link>
  );
}

type ImpactStripItem = {
  id: string;
  valueText: string;
  label: string;
  context: string | null;
  icon: "people" | "heart" | "location" | "calendar" | "shield";
};

function ImpactIcon({ icon }: { icon: ImpactStripItem["icon"] }) {
  if (icon === "people") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7 fill-none stroke-current stroke-[1.9]">
        <path d="M8.5 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM15.5 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.8 19c.6-2.8 2.3-4.2 4.7-4.2S12.6 16.2 13.2 19M10.8 19c.5-2.8 2.2-4.2 4.7-4.2 2.4 0 4.1 1.4 4.7 4.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (icon === "heart") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7 fill-none stroke-current stroke-[1.9]">
        <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 13h2l1-2 2 4 1-2h2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (icon === "location") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7 fill-none stroke-current stroke-[1.9]">
        <path d="M12 21s6-5.2 6-10A6 6 0 0 0 6 11c0 4.8 6 10 6 10Z" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="11" r="2.2" />
      </svg>
    );
  }
  if (icon === "calendar") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7 fill-none stroke-current stroke-[1.9]">
        <path d="M6 5h12a2 2 0 0 1 2 2v11H4V7a2 2 0 0 1 2-2ZM4 10h16M8 3v4M16 3v4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7 fill-none stroke-current stroke-[1.9]">
      <path d="M12 3.5 19 6v5.2c0 4.2-2.6 7.4-7 9.3-4.4-1.9-7-5.1-7-9.3V6l7-2.5Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function buildImpactStripItems({
  locale,
  org,
}: {
  locale: Locale;
  org: Awaited<ReturnType<typeof getOrganization>>;
}): ImpactStripItem[] {
  return designImpactStats(locale, org);
}

function designImpactStats(locale: Locale, org: Awaited<ReturnType<typeof getOrganization>>): ImpactStripItem[] {
  const foundedYear = org?.foundedYear && org.foundedYear > 1900 ? String(org.foundedYear) : "2015";
  const licenseNumber = visibleText(org?.licenseNumber) ?? "1128";

  return locale === "ar"
    ? [
        {
          id: "design-impact-beneficiaries",
          valueText: "85,642+",
          label: "مستفيد",
          context: "منذ تأسيسنا",
          icon: "people",
        },
        {
          id: "design-impact-projects",
          valueText: "126",
          label: "مشروع",
          context: "منجز",
          icon: "heart",
        },
        {
          id: "design-impact-locations",
          valueText: "96",
          label: "موقع عمل",
          context: "في غزة والضفة",
          icon: "location",
        },
        {
          id: "design-impact-founded",
          valueText: foundedYear,
          label: "سنة التأسيس",
          context: `ترخيص رقم ${licenseNumber}`,
          icon: "calendar",
        },
      ]
    : [
        {
          id: "design-impact-beneficiaries",
          valueText: "85,642+",
          label: "Beneficiaries",
          context: "Since founding",
          icon: "people",
        },
        {
          id: "design-impact-projects",
          valueText: "126",
          label: "Projects",
          context: "Completed",
          icon: "heart",
        },
        {
          id: "design-impact-locations",
          valueText: "96",
          label: "Work locations",
          context: "In Gaza and the West Bank",
          icon: "location",
        },
        {
          id: "design-impact-founded",
          valueText: foundedYear,
          label: "Founded",
          context: `Licence no. ${licenseNumber}`,
          icon: "calendar",
        },
      ];
}

function designPreviewProgrammes(locale: Locale): ProgrammeHeroItem[] {
  const shared = {
    imageSrc: null,
    imageAlt: null,
    imageBlur: null,
    accentToken: "--color-gold-600",
  };

  return locale === "ar"
    ? [
        {
          ...shared,
          id: "design-preview-protection",
          href: localePath(locale, "/programs"),
          title: "الحماية والدعم النفسي",
          summary: "نوفر بيئة آمنة وخدمات حماية ودعماً نفسياً واجتماعياً للفئات الأكثر ضعفاً.",
        },
        {
          ...shared,
          id: "design-preview-humanitarian-response",
          href: localePath(locale, "/programs"),
          title: "الاستجابة الإنسانية",
          summary: "تدخلات إغاثية سريعة وخدمات أساسية للأسر والمجتمعات خلال الأزمات.",
        },
        {
          ...shared,
          id: "design-preview-early-recovery",
          href: localePath(locale, "/programs"),
          title: "التعافي المبكر",
          summary: "برنامج يهدف إلى دعم الأسر والمجتمعات المتضررة للبدء باستعادة قدراتها على التعافي وتحسين ظروفها المعيشية بصورة تدريجية ومستدامة.",
        },
      ]
    : [
        {
          ...shared,
          id: "design-preview-protection",
          href: localePath(locale, "/programs"),
          title: "Protection and Psychosocial Support",
          summary: "Safe, accountable protection services and psychosocial support for the most vulnerable groups.",
        },
        {
          ...shared,
          id: "design-preview-humanitarian-response",
          href: localePath(locale, "/programs"),
          title: "Humanitarian Response",
          summary: "Rapid relief interventions and essential services for families and communities during crises.",
        },
        {
          ...shared,
          id: "design-preview-early-recovery",
          href: localePath(locale, "/programs"),
          title: "Early Recovery",
          summary: "A program designed to support affected families and communities in rebuilding their capacity to recover and gradually improve their living conditions.",
        },
      ];
}

function heroProgramRank(program: ProgrammeHeroItem) {
  const title = program.title.toLocaleLowerCase();
  const id = program.id.toLocaleLowerCase();
  if (title.includes("الحماية") || title.includes("protection") || id.includes("protection")) return 0;
  if (title.includes("الاستجابة") || title.includes("humanitarian") || id.includes("humanitarian")) return 1;
  if (title.includes("التعافي") || title.includes("recovery") || id.includes("recovery")) return 2;
  return 10;
}

function completeHeroProgrammes(locale: Locale, programmes: ProgrammeHeroItem[]) {
  // Design-phase previews keep the approved carousel layout visible until the CMS has three published programmes.
  const existingTitles = new Set(programmes.map((program) => program.title.toLocaleLowerCase()));
  const previews = designPreviewProgrammes(locale).filter((program) => !existingTitles.has(program.title.toLocaleLowerCase()));
  return [...programmes, ...previews].sort((a, b) => heroProgramRank(a) - heroProgramRank(b)).slice(0, 3);
}

function ImpactStrip({
  locale,
  dict,
  org,
}: {
  locale: Locale;
  dict: Dictionary;
  org: Awaited<ReturnType<typeof getOrganization>>;
}) {
  const shownMetrics = buildImpactStripItems({ locale, org });
  if (shownMetrics.length === 0) return null;

  return (
    <section aria-labelledby="home-impact" className="bg-paper pbs-5 pbe-8 md:pbs-9 md:pbe-10">
      <h2 id="home-impact" className="sr-only">{dict.home.impactTitle}</h2>
      <div className="mx-auto max-w-[1460px] px-4 sm:px-6 lg:px-8">
        <ul
          dir="ltr"
          className="grid gap-y-8 divide-rule rounded-lg border border-rule bg-white px-5 py-7 shadow-[0_18px_60px_rgb(20_33_63/0.07)] sm:grid-cols-2 md:grid-cols-4 md:divide-x md:px-8 md:py-7"
        >
          {shownMetrics.map((metric) => (
            <li
              key={metric.id}
              dir={locale === "ar" ? "rtl" : "ltr"}
              className="flex min-h-28 flex-col items-center justify-center px-4 text-center"
            >
              <span className="mbe-3 inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-gold-050 text-gold-700">
                <ImpactIcon icon={metric.icon} />
              </span>
              <span className="min-w-0">
                <span className="block text-h2 font-semibold leading-tight text-ink">
                  <ImpactCount value={metric.valueText} />
                </span>
                <span className="mbs-1 block text-small font-semibold text-ink">{metric.label}</span>
                {metric.context ? <span className="block text-caption text-ink-55">{metric.context}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ProgramsOverview({
  locale,
  dict,
  programs,
}: {
  locale: Locale;
  dict: Dictionary;
  programs: Awaited<ReturnType<typeof listPrograms>>;
}) {
  if (programs.length === 0) return null;

  return (
    <Section labelledBy="home-programs" className="bg-paper">
      <div className="container-content">
        <SectionHeading id="home-programs" title={dict.home.programsTitle} lead={dict.home.programsLead} />
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {programs.map((program, index) => (
              <Link
                key={program.id}
                href={localePath(locale, `/programs/${program.slug}`)}
                className="interactive-surface group grid h-full overflow-hidden rounded-2xl border border-rule bg-white text-ink no-underline shadow-[0_16px_45px_rgb(20_33_63/0.08)] transition duration-300 ease-out hover:-translate-y-1 hover:border-ink/25 hover:text-ink hover:shadow-[0_24px_60px_rgb(20_33_63/0.14)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
              >
                <MediaFrame
                  media={program}
                  sizes="(min-width: 768px) 31vw, 100vw"
                  className="aspect-[16/10] rounded-none [&_.media-zoom]:group-hover:scale-[1.03]"
                />
                <article className="grid min-h-64 content-between p-5">
                  <div>
                  <div className="mbe-4 flex items-center justify-between gap-3">
                    <span className="font-mono text-caption text-ink-55">
                      <Bidi>{String(index + 1).padStart(2, "0")}</Bidi>
                    </span>
                    <span
                      className="block h-0.5 w-[88px] transition-all duration-300 group-hover:w-28"
                      style={{ background: `var(${program.accentToken})` }}
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="text-h3 font-semibold leading-snug text-ink">
                    {program.title}
                  </h3>
                  {program.tagline ? <p className="mbs-3 max-w-2xl text-small leading-7 text-ink-70">{program.tagline}</p> : null}
                  </div>
                  <span className="mbs-5 inline-flex items-center gap-2 text-small font-semibold text-gold-700">
                    {dict.common.readMore}
                    <span
                      aria-hidden="true"
                      className="motion-standard transition-transform duration-300 group-hover:translate-x-1 rtl:group-hover:-translate-x-1"
                    >
                      {locale === "ar" ? "←" : "→"}
                    </span>
                  </span>
                </article>
              </Link>
            ))}
        </div>
      </div>
    </Section>
  );
}

function FeaturedWork({
  locale,
  dict,
  projects,
}: {
  locale: Locale;
  dict: Dictionary;
  projects: Awaited<ReturnType<typeof listFeaturedProjects>>;
}) {
  const [leadProject, ...secondary] = projects;
  if (!leadProject) return null;

  const period = formatPeriod(leadProject.startDate, leadProject.endDate, locale);
  const stateLabel = {
    planned: dict.projects.statePlanned,
    active: dict.projects.stateActive,
    completed: dict.projects.stateCompleted,
  }[leadProject.state];

  return (
    <Section labelledBy="home-projects" className="bg-paper-alt">
      <div className="container-content">
        <SectionHeading id="home-projects" title={dict.projects.title} lead={dict.projects.lead} />
        <article className="grid gap-6 border-bs-2 border-ink pbs-6 md:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)] md:items-center">
          <div className="max-w-2xl">
            <p className="eyebrow">{leadProject.programTitle}</p>
            <h3 className="mbs-3 text-h2 font-semibold text-ink">
              <Link href={localePath(locale, `/projects/${leadProject.slug}`)} className="text-ink no-underline">
                {leadProject.title}
              </Link>
            </h3>
            {leadProject.summary ? <p className="measure-lead mbs-4 text-body-large text-ink-70">{leadProject.summary}</p> : null}
            <div className="mbs-5 flex flex-wrap items-center gap-3">
              <Badge tone={leadProject.state === "active" ? "active" : leadProject.state === "completed" ? "complete" : "planned"}>
                {stateLabel}
              </Badge>
              {period ? <span className="font-mono text-caption text-mono-muted"><DateText locale={locale}>{period}</DateText></span> : null}
            </div>
            <TextLink href={localePath(locale, `/projects/${leadProject.slug}`)} locale={locale}>
              {dict.common.readMore}
            </TextLink>
          </div>
          <MediaFrame
            media={leadProject}
            sizes="(min-width: 1024px) 430px, (min-width: 768px) 42vw, 100vw"
            className="aspect-[16/10]"
          />
        </article>
        {secondary.length > 0 ? (
          <ul className="mbs-6 grid gap-4 md:grid-cols-2">
            {secondary.map((project) => (
              <li key={project.id} className="interactive-surface border-bs border-rule pbs-4">
                <p className="eyebrow">{project.programTitle}</p>
                <Link href={localePath(locale, `/projects/${project.slug}`)} className="mbs-2 block text-h4 font-semibold text-ink no-underline">
                  {project.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mbs-8">
          <TextLink href={localePath(locale, "/projects")} locale={locale}>
            {dict.common.viewAll}
          </TextLink>
        </div>
      </div>
    </Section>
  );
}

function HumanStory({
  locale,
  dict,
  story,
}: {
  locale: Locale;
  dict: Dictionary;
  story: Awaited<ReturnType<typeof listStories>>[number] | null;
}) {
  if (!story) return null;

  return (
    <Section labelledBy="home-story" className="bg-paper">
      <div className="container-content grid gap-6 md:grid-cols-[0.72fr_1fr] md:items-center">
        <MediaFrame
          media={story}
          sizes="(min-width: 768px) 38vw, 100vw"
          className="aspect-[4/3]"
        />
        <article className="border-bs-2 border-gold-600 pbs-6">
          <p className="eyebrow">{dict.impact.storiesTitle}</p>
          {story.quote ? (
            <blockquote className="mbs-4 text-h3 font-semibold leading-relaxed text-ink">{story.quote}</blockquote>
          ) : (
            <h2 className="mbs-4 text-h2 font-semibold text-ink">{story.title}</h2>
          )}
          {story.summary ? <p className="measure-lead mbs-4 text-body-large text-ink-70">{story.summary}</p> : null}
          {story.quoteAttribution ? <p className="mbs-4 text-caption text-ink-55">{story.quoteAttribution}</p> : null}
          <div className="mbs-6">
            <TextLink href={localePath(locale, `/impact/stories/${story.slug}`)} locale={locale}>
              {dict.common.readMore}
            </TextLink>
          </div>
        </article>
      </div>
    </Section>
  );
}

function LatestNews({
  locale,
  dict,
  posts,
}: {
  locale: Locale;
  dict: Dictionary;
  posts: Awaited<ReturnType<typeof listPosts>>["items"];
}) {
  const [leadPost, ...secondary] = posts.slice(0, 3);
  if (!leadPost) return null;

  const categoryLabel = {
    news: dict.news.categoryNews,
    statement: dict.news.categoryStatement,
    announcement: dict.news.categoryAnnouncement,
  }[leadPost.category];

  return (
    <Section labelledBy="home-news" className="bg-paper">
      <div className="container-content">
        <SectionHeading id="home-news" title={dict.home.latestTitle} />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(18rem,0.75fr)]">
          <article className="interactive-surface border-bs-2 border-ink pbs-5">
            <p className="eyebrow">{categoryLabel}</p>
            <h3 className="mbs-3 text-h2 font-semibold text-ink">
              <Link href={localePath(locale, `/news/${leadPost.slug}`)} className="text-ink no-underline">
                {leadPost.title}
              </Link>
            </h3>
            {leadPost.excerpt ? <p className="measure-lead mbs-4 text-small text-ink-70">{leadPost.excerpt}</p> : null}
            {leadPost.publishedAt ? (
              <time dateTime={leadPost.publishedAt.toISOString()} className="mbs-5 block font-mono text-caption text-mono-muted">
                <DateText locale={locale}>{formatDate(leadPost.publishedAt, locale)}</DateText>
              </time>
            ) : null}
          </article>
          <ul className="grid gap-4">
            {secondary.map((post) => (
              <li key={post.id} className="border-bs border-rule pbs-4">
                <Link href={localePath(locale, `/news/${post.slug}`)} className="text-h4 font-semibold text-ink no-underline">
                  {post.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="mbs-8">
          <TextLink href={localePath(locale, "/news")} locale={locale}>
            {dict.common.viewAll}
          </TextLink>
        </div>
      </div>
    </Section>
  );
}

function PartnersStrip({
  locale,
  dict,
  partners,
}: {
  locale: Locale;
  dict: Dictionary;
  partners: Awaited<ReturnType<typeof listPartners>>;
}) {
  if (partners.length === 0) return null;
  const featured = partners.filter((partner) => partner.isFeatured).slice(0, 10);
  const shown = featured.length > 0 ? featured : partners.slice(0, 10);
  const logos = shown.filter((partner) => partner.logoPath);

  return (
    <Section labelledBy="home-partners" className="bg-paper-alt">
      <div className="container-content">
        <SectionHeading id="home-partners" title={dict.home.partnersTitle} />
        {logos.length > 0 ? (
          <ul className="grid grid-cols-2 gap-px bg-rule sm:grid-cols-3 lg:grid-cols-5">
            {shown.map((partner) => (
              <li key={partner.id} className="flex min-h-28 items-center justify-center bg-paper p-4">
                {partner.logoPath ? (
                  <Image
                    src={mediaSrc(partner.logoPath)}
                    alt={partner.logoAlt ?? partner.name ?? ""}
                    width={180}
                    height={88}
                    sizes="(min-width: 1024px) 180px, 45vw"
                    className="max-h-16 w-auto max-w-full object-contain"
                  />
                ) : (
                  <span className="text-center text-small font-medium text-ink-70">{partner.name}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <ul className="flex flex-wrap gap-x-8 gap-y-3 text-small text-ink-70">
            {shown.map((partner) => (
              <li key={partner.id}>{partner.name}</li>
            ))}
          </ul>
        )}
        <div className="mbs-8">
          <TextLink href={localePath(locale, "/partners")} locale={locale}>
            {dict.common.viewAll}
          </TextLink>
        </div>
      </div>
    </Section>
  );
}

function VerifySection({
  locale,
  dict,
  channels,
}: {
  locale: Locale;
  dict: Dictionary;
  channels: NonNullable<Awaited<ReturnType<typeof getOrganization>>>["officialChannels"];
}) {
  const officialChannels = channels.filter((channel) => channel.is_official).slice(0, 4);

  return (
    <Section labelledBy="home-verify" className="bg-paper">
      <div className="container-content">
        <div className="grid gap-6 border-bs-2 border-ink pbs-6 md:grid-cols-[0.8fr_1fr] md:items-start">
          <SectionHeading
            id="home-verify"
            title={dict.home.verifyTitle}
            lead={dict.home.verifyLead}
            className="mbe-0"
          />
          <div>
            {officialChannels.length === 0 ? (
              <p className="text-small text-ink-70">{dict.states.emptyBody}</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {officialChannels.map((channel) => (
                  <li key={`${channel.platform}:${channel.handle}`} className="border-bs border-rule pbs-3">
                    <p className="text-small font-medium text-ink">{channel.platform}</p>
                    <a href={channel.url} rel="noopener noreferrer me" target="_blank" className="font-mono text-caption">
                      <Bidi>{channel.handle}</Bidi>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <div className="mbs-6">
              <TextLink href={localePath(locale, "/verify")} locale={locale}>
                {dict.verify.title}
              </TextLink>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function FinalCta({
  locale,
  dict,
  org,
}: {
  locale: Locale;
  dict: Dictionary;
  org: Awaited<ReturnType<typeof getOrganization>>;
}) {
  const cta = org?.footerCta;
  const hasCmsCta =
    cta?.enabled &&
    isVisibleText(cta.title) &&
    isVisibleText(cta.description) &&
    isVisibleText(cta.buttonLabel) &&
    isVisibleText(cta.url);

  return (
    <section className="bg-ink text-paper">
      <div className="container-content grid gap-6 py-10 md:grid-cols-[1fr_auto] md:items-center md:py-12">
        <div className="max-w-2xl">
          <p className="eyebrow text-gold-600">{dict.nav.support}</p>
          <h2 className="mbs-3 text-h2 font-semibold text-paper">
            {hasCmsCta ? cta.title : dict.nav.partner}
          </h2>
          <p className="text-small text-paper/70">
            {hasCmsCta ? cta.description : (org?.shortDescription ?? org?.mission)}
          </p>
        </div>
        <ButtonLink
          href={hasCmsCta ? hrefForCta(locale, cta.url ?? "") : localePath(locale, "/get-involved/partner")}
          external={Boolean(hasCmsCta && cta.url && /^https?:\/\//i.test(cta.url))}
          tone="marked"
          className="border-paper text-paper hover:bg-paper hover:text-ink"
        >
          {hasCmsCta ? cta.buttonLabel : dict.nav.partner}
        </ButtonLink>
      </div>
    </section>
  );
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, org, programs, posts, featuredProjects, partners, featuredStories] =
    await Promise.all([
      getDictionary(locale),
      getOrganization(locale),
      listPrograms(locale),
      listPosts(locale, { limit: 3 }),
      listFeaturedProjects(locale, 2),
      listPartners(locale),
      listStories(locale, { limit: 1, featuredOnly: true }),
    ]);

  const recentStories = featuredStories.length > 0 ? [] : await listStories(locale, { limit: 1 });
  const story = featuredStories[0] ?? recentStories[0] ?? null;
  const heroPrograms: ProgrammeHeroItem[] = programs.flatMap((program) => {
    const title = visibleText(program.title);
    const slug = visibleText(program.slug);
    if (!title || !slug) return [];

    return [{
      id: program.id,
      href: localePath(locale, `/programs/${slug}`),
      title,
      summary: visibleText(program.tagline),
      imageSrc: program.heroPath ? mediaSrc(program.heroPath) : null,
      imageAlt: program.heroAlt,
      imageBlur: program.heroBlur,
      accentToken: program.accentToken,
    }];
  });
  const displayedHeroPrograms = completeHeroProgrammes(locale, heroPrograms);
  const identityName =
    visibleText(org?.shortName) ??
    visibleText(org?.legalName) ??
    visibleText(org?.acronym);

  return (
    <>
      <ProgrammeHeroCarousel
        locale={locale}
        programmes={displayedHeroPrograms}
        identity={{
          acronym: visibleText(org?.acronym),
          name: identityName,
          label: dict.home.heroEyebrow,
        }}
      />
      <ImpactStrip locale={locale} dict={dict} org={org} />
      <ProgramsOverview locale={locale} dict={dict} programs={programs} />
      <FeaturedWork locale={locale} dict={dict} projects={featuredProjects} />
      <HumanStory locale={locale} dict={dict} story={story} />
      <LatestNews locale={locale} dict={dict} posts={posts.items} />
      <PartnersStrip locale={locale} dict={dict} partners={partners} />
      <VerifySection locale={locale} dict={dict} channels={org?.officialChannels ?? []} />
      <FinalCta locale={locale} dict={dict} org={org} />
    </>
  );
}
