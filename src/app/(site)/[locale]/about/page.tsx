import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Bidi } from "@/components/ui/bidi";
import {
  ButtonLink,
  Panel,
  Section,
  SectionHeading,
} from "@/components/ui/primitives";
import { listPeople } from "@/db/queries/content";
import type { PersonCategory } from "@/db/schema/enums";
import { publicEnv } from "@/lib/env.public";
import { storageUrl } from "@/lib/format";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export const revalidate = 3600;

const COPY = {
  en: {
    eyebrow: "Who we are",
    title: "Local action. Lasting dignity.",
    intro:
      "PCSRD is a Palestinian civil society organisation working with communities to strengthen protection, resilience and access to essential support.",
    explore: "Explore our programmes",
    quickFacts: "PCSRD at a glance",
    storyTitle: "Rooted in the community",
    story:
      "Founded in 2015, the Palestinian Crescent Society for Relief and Development responds to humanitarian needs while investing in long-term, community-led development. Our work brings practical support closer to women, children, young people and families affected by crisis.",
    storyNote:
      "We work alongside communities—not only for them—so every response reflects local priorities, dignity and lived experience.",
    facts: [
      ["Founded", "2015"],
      ["Licence", "1128"],
      ["Legal form", "Palestinian non-profit civil society organisation"],
      ["Area of work", "Gaza Strip and West Bank"],
    ],
    vision:
      "A Palestinian society where people can live with dignity, justice and opportunity.",
    mission:
      "To deliver inclusive humanitarian and development programmes that improve quality of life and empower communities through sustainable, accountable action.",
    valuesLead:
      "The principles that shape how we work and how we make decisions.",
    values: [
      ["Humanity", "People and their dignity come first."],
      ["Impartiality", "Support is guided by need without discrimination."],
      ["Neutrality", "We preserve trust and independence in our work."],
      ["Volunteering", "Community service and participation drive change."],
    ],
    strategyLead:
      "Three priorities connect immediate relief with durable recovery.",
    priorities: [
      [
        "Protection and social justice",
        "Protect rights and widen access to fair, essential services for people most at risk.",
      ],
      [
        "Humanitarian response",
        "Strengthen community capacity to respond to emergencies and meet urgent needs.",
      ],
      [
        "Recovery and resilience",
        "Help families and communities restore stability, livelihoods and a dignified future.",
      ],
    ],
    peopleTitle: "Who we work with",
    peopleLead:
      "Our programmes are designed around people facing the greatest barriers.",
    groups: [
      "Women",
      "Children",
      "Young people",
      "Crisis-affected families",
      "Persons with disabilities",
      "Patients and vulnerable people",
    ],
    imageAlt: [
      "A PCSRD team member facilitating a community workshop",
      "A PCSRD team member preparing meals for community distribution",
      "Women participating in a PCSRD community session",
    ],
    governanceLead: "Team members who have consented to be publicly listed.",
    ctaTitle: "Stronger communities are built together.",
    ctaBody:
      "Partner with PCSRD to support practical, accountable and locally led action.",
  },
  ar: {
    eyebrow: "من نحن",
    title: "عمل محلي يصنع كرامة مستدامة.",
    intro:
      "هيئة الهلال الفلسطيني للإغاثة والتنمية مؤسسة أهلية فلسطينية تعمل مع المجتمعات لتعزيز الحماية والصمود والوصول إلى الدعم الأساسي.",
    explore: "استكشف برامجنا",
    quickFacts: "الهيئة في لمحة",
    storyTitle: "من المجتمع ولأجله",
    story:
      "تأسست هيئة الهلال الفلسطيني للإغاثة والتنمية عام 2015 للاستجابة للاحتياجات الإنسانية، بالتوازي مع الاستثمار في تنمية مستدامة يقودها المجتمع. ونقرّب الدعم العملي من النساء والأطفال والشباب والأسر المتأثرة بالأزمات.",
    storyNote:
      "نعمل جنباً إلى جنب مع المجتمعات، لا بالنيابة عنها، لتستند كل استجابة إلى الأولويات المحلية والكرامة والتجربة الحقيقية.",
    facts: [
      ["تأسست", "2015"],
      ["رقم الترخيص", "1128"],
      ["الشكل القانوني", "مؤسسة أهلية فلسطينية غير ربحية"],
      ["نطاق العمل", "قطاع غزة والضفة الغربية"],
    ],
    vision: "مجتمع فلسطيني يعيش أفراده بكرامة وعدالة وفرص متكافئة.",
    mission:
      "تنفيذ برامج إنسانية وتنموية شاملة تحسّن جودة الحياة وتمكّن المجتمعات من خلال عمل مستدام ومسؤول.",
    valuesLead: "المبادئ التي ترسم طريقة عملنا وتوجّه قراراتنا.",
    values: [
      ["الإنسانية", "الإنسان وكرامته في مقدمة أولوياتنا."],
      ["عدم التحيز", "نقدّم الدعم بحسب الحاجة دون تمييز."],
      ["الحياد", "نحافظ على الثقة والاستقلالية في عملنا."],
      ["التطوع", "الخدمة والمشاركة المجتمعية تصنعان التغيير."],
    ],
    strategyLead: "ثلاث أولويات تربط الإغاثة العاجلة بالتعافي المستدام.",
    priorities: [
      [
        "الحماية والعدالة الاجتماعية",
        "حماية الحقوق وتوسيع الوصول العادل إلى الخدمات الأساسية للفئات الأكثر عرضة للمخاطر.",
      ],
      [
        "الاستجابة الإنسانية",
        "تعزيز قدرة المجتمع على مواجهة الطوارئ وتلبية الاحتياجات العاجلة.",
      ],
      [
        "التعافي والصمود",
        "مساندة الأسر والمجتمعات لاستعادة الاستقرار وسبل العيش ومستقبل كريم.",
      ],
    ],
    peopleTitle: "الفئات التي نعمل معها",
    peopleLead:
      "تُصمَّم برامجنا انطلاقاً من احتياجات الأشخاص الذين يواجهون أكبر العوائق.",
    groups: [
      "النساء",
      "الأطفال",
      "الشباب",
      "الأسر المتأثرة بالأزمات",
      "الأشخاص ذوو الإعاقة",
      "المرضى والفئات الأكثر ضعفاً",
    ],
    imageAlt: [
      "عضوة من فريق الهيئة تيسّر ورشة مجتمعية",
      "عضو من فريق الهيئة يجهز وجبات للتوزيع المجتمعي",
      "نساء يشاركن في جلسة مجتمعية للهيئة",
    ],
    governanceLead: "أعضاء الفريق الذين وافقوا على نشر بياناتهم.",
    ctaTitle: "المجتمعات الأقوى نبنيها معاً.",
    ctaBody: "شارك الهيئة في دعم عمل عملي ومسؤول تقوده المجتمعات المحلية.",
  },
} as const;

const CATEGORIES: PersonCategory[] = ["board", "executive", "staff"];

function FactIcon({ index }: { index: number }) {
  const paths = [
    <>
      <path d="M7 3v3M17 3v3M4 9h16" />
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="m9 15 2 2 4-5" />
    </>,
    <>
      <path d="M12 3 5 6v5c0 4.6 2.8 8.1 7 10 4.2-1.9 7-5.4 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>,
    <>
      <path d="M4 21h16M6 21V8l6-5 6 5v13M9 11h2M13 11h2M9 15h2M13 15h2" />
    </>,
    <>
      <path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>,
  ];
  return (
    <span className="flex size-12 items-center justify-center rounded-full bg-gold-050 text-gold-700">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        className="size-6"
      >
        {paths[index]}
      </svg>
    </span>
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return {
    title: dict.about.title,
    description: COPY[locale].intro,
    alternates: {
      canonical: `/${locale}/about`,
      languages: { ar: "/ar/about", en: "/en/about" },
    },
  };
}

export default async function AboutPage({
  params,
}: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [dict, people] = await Promise.all([
    getDictionary(locale),
    listPeople(locale),
  ]);
  const copy = COPY[locale];

  return (
    <main>
      <section className="bg-paper py-8 md:py-12">
        <div className="container-content grid gap-8 px-5 py-4 md:px-8 md:py-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12 lg:px-10 lg:py-8">
          <div className="flex items-center lg:ps-4">
            <div className="max-w-2xl">
              <p className="eyebrow mbe-4 text-gold-700">{copy.eyebrow}</p>
              <h1 className="max-w-xl text-h1 font-semibold text-ink">
                {copy.title}
              </h1>
              <p className="mbs-5 max-w-xl text-body text-ink-70">
                {copy.intro}
              </p>
              <div className="mbs-7 flex flex-wrap gap-3">
                <ButtonLink
                  href={localePath(locale, "/programs")}
                  className="rounded-md bg-gold-600 text-navy-900 hover:bg-gold-700"
                >
                  {copy.explore}
                </ButtonLink>
                <ButtonLink
                  href={localePath(locale, "/get-involved/partner")}
                  tone="outline"
                  className="rounded-md"
                >
                  {dict.nav.partner}
                </ButtonLink>
              </div>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-navy-900 lg:aspect-[5/4]">
            <Image
              src="/about/team-workshop.jpg"
              alt={copy.imageAlt[0]}
              fill
              priority
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover object-top"
            />
          </div>
        </div>
      </section>

      <section className="bg-navy-900 py-10 md:py-12">
        <div className="container-content">
          <p className="eyebrow mbe-6 text-gold-600">{copy.quickFacts}</p>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {copy.facts.map(([term, value], index) => (
              <div
                key={term}
                className="group rounded-xl border border-rule border-bs-4 border-bs-gold-600 bg-paper p-6 shadow-[0_10px_24px_rgba(10,28,59,0.08)] motion-standard transition-transform hover:-translate-y-1"
              >
                <div className="mbe-8 flex items-start justify-between">
                  <FactIcon index={index} />
                  <span className="font-mono text-caption text-ink-55">
                    0{index + 1}
                  </span>
                </div>
                <dt className="eyebrow mbe-3 text-gold-700">{term}</dt>
                <dd className="text-body font-semibold leading-snug text-ink">
                  <Bidi>{value}</Bidi>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="container-content section-gap">
        <Section
          bounded={false}
          labelledBy="about-story"
          className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16"
        >
          <div>
            <SectionHeading id="about-story" title={copy.storyTitle} />
            <p className="max-w-2xl text-lead text-ink-70">{copy.story}</p>
            <blockquote className="mbs-8 border-s-4 border-gold-600 ps-6 text-body font-medium text-ink">
              {copy.storyNote}
            </blockquote>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-paper-alt">
            <Image
              src="/about/meal-preparation.jpg"
              alt={copy.imageAlt[1]}
              fill
              sizes="(min-width: 1024px) 42vw, 100vw"
              className="object-cover object-top"
            />
          </div>
        </Section>

        <Section labelledBy="about-vision">
          <SectionHeading id="about-vision" title={dict.about.vision} />
          <div className="grid gap-6 md:grid-cols-2">
            <Panel
              tone="navy"
              className="rounded-xl border-0 p-8 shadow-[0_10px_24px_rgba(10,28,59,0.10)] motion-standard transition-transform hover:-translate-y-1 md:p-10"
            >
              <span
                className="font-mono text-display text-gold-600/35"
                aria-hidden="true"
              >
                01
              </span>
              <h3 className="mbs-8 text-h2 font-semibold text-paper">
                {dict.about.vision}
              </h3>
              <p className="mbs-4 text-lead text-paper/80">{copy.vision}</p>
            </Panel>
            <Panel
              tone="gold"
              className="rounded-xl border-0 p-8 shadow-[0_10px_24px_rgba(10,28,59,0.10)] motion-standard transition-transform hover:-translate-y-1 md:p-10"
            >
              <span
                className="font-mono text-display text-gold-700/25"
                aria-hidden="true"
              >
                02
              </span>
              <h3 className="mbs-8 text-h2 font-semibold">
                {dict.about.mission}
              </h3>
              <p className="mbs-4 text-lead text-ink-70">{copy.mission}</p>
            </Panel>
          </div>
        </Section>

        <Section labelledBy="about-values">
          <SectionHeading
            id="about-values"
            title={dict.about.values}
            lead={copy.valuesLead}
          />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {copy.values.map(([title, body], index) => (
              <li
                key={title}
                className="group flex min-h-64 flex-col overflow-hidden rounded-xl border border-rule border-bs-4 border-bs-gold-600 bg-gradient-to-br from-paper to-gold-050 p-7 shadow-[0_10px_24px_rgba(10,28,59,0.08)] motion-standard transition-[transform,box-shadow] hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(10,28,59,0.13)]"
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-navy-100 font-mono text-small font-semibold text-navy-700 motion-standard transition-colors group-hover:bg-navy-700 group-hover:text-paper">
                  0{index + 1}
                </span>
                <div className="mbs-auto pbs-10">
                  <span
                    className="mbe-4 block h-0.5 w-10 bg-gold-600"
                    aria-hidden="true"
                  />
                  <h3 className="text-h3 font-semibold text-navy-900">
                    {title}
                  </h3>
                  <p className="mbs-3 text-small leading-relaxed text-ink-70">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section labelledBy="about-strategy">
          <SectionHeading
            id="about-strategy"
            title={dict.about.strategy}
            lead={copy.strategyLead}
          />
          <ol className="grid gap-6 lg:grid-cols-3">
            {copy.priorities.map(([title, body], index) => (
              <Panel
                as="li"
                key={title}
                tone={index === 1 ? "navy" : "gold"}
                className="group flex min-h-72 flex-col rounded-xl border-bs-4 border-bs-gold-600 shadow-[0_10px_24px_rgba(10,28,59,0.08)] motion-standard transition-[transform,box-shadow] hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(10,28,59,0.13)]"
              >
                <span
                  className={
                    index === 1
                      ? "flex size-12 items-center justify-center rounded-full bg-gold-600 font-mono text-small font-semibold text-navy-900"
                      : "flex size-12 items-center justify-center rounded-full bg-navy-100 font-mono text-small font-semibold text-navy-700 motion-standard transition-colors group-hover:bg-navy-700 group-hover:text-paper"
                  }
                >
                  0{index + 1}
                </span>
                <h3
                  className={
                    index === 1
                      ? "mbs-auto pbs-8 text-h3 font-semibold text-paper"
                      : "mbs-auto pbs-8 text-h3 font-semibold text-navy-900"
                  }
                >
                  {title}
                </h3>
                <p
                  className={
                    index === 1
                      ? "mbs-5 text-small leading-relaxed text-paper/75"
                      : "mbs-5 text-small leading-relaxed text-ink-70"
                  }
                >
                  {body}
                </p>
              </Panel>
            ))}
          </ol>
        </Section>

        <Section
          labelledBy="about-people"
          className="grid items-stretch gap-0 overflow-hidden rounded-xl bg-navy-900 !py-0 shadow-[0_10px_24px_rgba(10,28,59,0.10)] lg:grid-cols-2"
        >
          <div className="bg-navy-900 p-8 text-paper md:p-12">
            <SectionHeading
              id="about-people"
              title={copy.peopleTitle}
              lead={copy.peopleLead}
              className="[&_h2]:text-paper [&_p]:text-paper/70"
            />
            <ul className="grid gap-3 sm:grid-cols-2">
              {copy.groups.map((group) => (
                <li
                  key={group}
                  className="border-be border-paper/20 py-4 text-small font-medium"
                >
                  {group}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative min-h-[500px] overflow-hidden bg-paper-alt">
            <Image
              src="/about/women-session.jpg"
              alt={copy.imageAlt[2]}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        </Section>

        {people.length > 0 ? (
          <Section labelledBy="about-governance">
            <SectionHeading
              id="about-governance"
              title={dict.about.governance}
              lead={copy.governanceLead}
            />
            {CATEGORIES.map((category) => {
              const group = people.filter(
                (person) => person.category === category,
              );
              if (group.length === 0) return null;
              return (
                <div key={category} className="mbe-10">
                  <h3 className="eyebrow mbe-4">
                    {dict.enums.personCategory[category]}
                  </h3>
                  <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                    {group.map((person) => (
                      <Panel
                        as="li"
                        key={person.id}
                        className="flex gap-4 rounded-xl shadow-[0_10px_24px_rgba(10,28,59,0.08)] motion-standard transition-transform hover:-translate-y-1"
                      >
                        {person.photoPath ? (
                          <div className="relative size-16 shrink-0 overflow-hidden bg-paper-alt">
                            <Image
                              src={storageUrl(
                                publicEnv.NEXT_PUBLIC_SUPABASE_URL,
                                "media",
                                person.photoPath,
                              )}
                              alt={person.photoAlt ?? person.name ?? ""}
                              fill
                              sizes="64px"
                              className="object-cover"
                            />
                          </div>
                        ) : null}
                        <div>
                          <p className="text-small font-medium text-ink">
                            {person.name}
                          </p>
                          <p className="mbs-1 text-caption text-ink-55">
                            {person.role}
                          </p>
                        </div>
                      </Panel>
                    ))}
                  </ul>
                </div>
              );
            })}
          </Section>
        ) : null}

        <section className="mbs-8 mbe-20 grid gap-8 rounded-xl bg-gold-050 p-8 shadow-[0_10px_24px_rgba(10,28,59,0.08)] md:mbs-10 md:grid-cols-[1fr_auto] md:items-center md:p-12">
          <div>
            <h2 className="text-h2 font-semibold text-ink">{copy.ctaTitle}</h2>
            <p className="mbs-3 max-w-2xl text-body text-ink-70">
              {copy.ctaBody}
            </p>
          </div>
          <ButtonLink
            href={localePath(locale, "/get-involved/partner")}
            className="rounded-md"
          >
            {dict.nav.partner}
          </ButtonLink>
        </section>
      </div>
    </main>
  );
}
