'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Locale } from '@/lib/i18n/config';

export type ProgrammeHeroItem = {
  id: string;
  href: string;
  title: string;
  summary: string | null;
  imageSrc: string | null;
  imageAlt: string | null;
  imageBlur: string | null;
  accentToken: string;
};

export type ProgrammeHeroIdentity = {
  acronym: string | null;
  name: string | null;
  label: string;
};

const COPY = {
  ar: {
    eyebrow: 'برامجنا',
    explore: 'اكتشف البرنامج',
    previous: 'البرنامج السابق',
    next: 'البرنامج التالي',
    goTo: 'عرض البرنامج',
    slide: 'البرنامج المعروض',
  },
  en: {
    eyebrow: 'Our programmes',
    explore: 'Explore programme',
    previous: 'Previous programme',
    next: 'Next programme',
    goTo: 'Show programme',
    slide: 'Current programme',
  },
} as const;

function wrap(index: number, length: number) {
  return ((index % length) + length) % length;
}

function displayNumber(index: number) {
  return String(index + 1).padStart(2, '0');
}

function trimSummary(summary: string | null) {
  if (!summary) return null;
  const clean = summary.replace(/\s+/g, ' ').trim();
  return clean.length > 150 ? `${clean.slice(0, 147).trim()}...` : clean;
}

function FallbackImage({ className = '' }: { className?: string }) {
  return (
    <Image
      src="/hero-bg.png"
      alt=""
      fill
      sizes="(min-width: 1024px) 60vw, 100vw"
      className={`object-cover ${className}`}
    />
  );
}

function ProgrammeImage({
  item,
  priority,
  sizes,
  className = '',
}: {
  item: ProgrammeHeroItem;
  priority?: boolean;
  sizes: string;
  className?: string;
}) {
  if (!item.imageSrc) return <FallbackImage className={className} />;

  return (
    <Image
      src={item.imageSrc}
      alt={item.imageAlt ?? ''}
      fill
      sizes={sizes}
      priority={priority}
      placeholder={item.imageBlur ? 'blur' : 'empty'}
      blurDataURL={item.imageBlur ?? undefined}
      className={`object-cover ${className}`}
    />
  );
}

function ArrowIcon({ direction }: { direction: 'previous' | 'next' }) {
  const path = direction === 'next' ? 'm8 4 8 8-8 8' : 'm16 4-8 8 8 8';
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="icon-20 fill-none stroke-current stroke-2">
      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PreviewButton({
  item,
  index,
  side,
  label,
  onClick,
}: {
  item: ProgrammeHeroItem;
  index: number;
  side: 'previous' | 'next';
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      data-testid={`programme-hero-${side}`}
      onClick={onClick}
      className="animate-hero-preview-in group relative hidden min-h-[29rem] overflow-hidden rounded-2xl border border-ink/10 bg-ink text-start text-paper shadow-[0_18px_50px_rgb(20_33_63/0.16)] md:block lg:min-h-[31rem]"
    >
      <ProgrammeImage
        item={item}
        sizes="(min-width: 1024px) 17vw, 0px"
        className="opacity-52 transition duration-700 group-hover:scale-[1.025] group-hover:opacity-68"
      />
      <span className="absolute inset-0 bg-ink/42" aria-hidden="true" />
      <span className="absolute inset-x-5 inset-be-5">
        <span className="mbe-3 block font-mono text-h3 text-paper/80">{displayNumber(index)}</span>
        <span
          className="mbe-4 block h-0.5 w-12 transition-all duration-300 group-hover:w-20"
          style={{ background: `var(${item.accentToken})` }}
          aria-hidden="true"
        />
        <span className="block text-h4 font-semibold leading-snug text-paper">{item.title}</span>
        {item.summary ? (
          <span className="mbs-2 line-clamp-2 block text-caption leading-6 text-paper/76">
            {trimSummary(item.summary)}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function ProgrammeHeroCarousel({
  locale,
  programmes,
}: {
  locale: Locale;
  programmes: ProgrammeHeroItem[];
  identity?: ProgrammeHeroIdentity;
}) {
  const text = COPY[locale];
  const isRtl = locale === 'ar';
  const count = programmes.length;
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);
  const [interactedAt, setInteractedAt] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const prefersReducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const move = useCallback(
    (step: number) => {
      if (count <= 1) return;
      setDirection(step);
      setActive((current) => wrap(current + step, count));
      setInteractedAt(Date.now());
    },
    [count],
  );

  const choose = useCallback(
    (index: number) => {
      setDirection(index >= active ? 1 : -1);
      setActive(wrap(index, count));
      setInteractedAt(Date.now());
    },
    [active, count],
  );

  useEffect(() => {
    if (count <= 1 || paused || prefersReducedMotion) return;
    const timer = window.setInterval(() => {
      setDirection(1);
      setActive((current) => wrap(current + 1, count));
    }, 6000);
    return () => window.clearInterval(timer);
  }, [count, paused, interactedAt, prefersReducedMotion]);

  const previousIndex = count > 1 ? wrap(active - 1, count) : active;
  const nextIndex = count > 1 ? wrap(active + 1, count) : active;
  const activeItem = programmes[active] ?? null;
  if (!activeItem) return null;

  const previousItem = count > 2 ? programmes[previousIndex] : null;
  const nextItem = count > 1 ? programmes[nextIndex] : null;
  const inlineStartItem = isRtl ? nextItem : previousItem;
  const inlineStartIndex = isRtl ? nextIndex : previousIndex;
  const inlineStartSide = isRtl ? 'next' : 'previous';
  const inlineEndItem = isRtl ? previousItem : nextItem;
  const inlineEndIndex = isRtl ? previousIndex : nextIndex;
  const inlineEndSide = isRtl ? 'previous' : 'next';
  const trackClass =
    count > 2
      ? 'md:grid-cols-[minmax(9rem,0.17fr)_minmax(0,0.66fr)_minmax(9rem,0.17fr)]'
      : count === 2
        ? 'md:grid-cols-[minmax(0,0.72fr)_minmax(11rem,0.28fr)]'
        : 'md:grid-cols-1';

  function onTouchEnd(event: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || count <= 1) return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY)) return;

    const visualStep = deltaX > 0 ? -1 : 1;
    move(isRtl ? -visualStep : visualStep);
  }

  return (
    <section
      data-testid="programme-hero"
      data-slide-count={count}
      data-active-index={active}
      className="overflow-hidden bg-paper pbs-4 pbe-5 md:pbs-4 md:pbe-0"
      aria-roledescription="carousel"
      aria-label={text.eyebrow}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') move(isRtl ? 1 : -1);
        if (event.key === 'ArrowRight') move(isRtl ? -1 : 1);
      }}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
      }}
      onTouchEnd={onTouchEnd}
    >
      <div className="mx-auto max-w-[1460px] px-4 sm:px-6 lg:px-8">
        <div className="relative">
          <div className={`grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 md:items-stretch md:gap-5 ${trackClass}`}>
              {inlineStartItem ? (
                <PreviewButton
                  item={inlineStartItem}
                  index={inlineStartIndex}
                  side={inlineStartSide}
                  label={`${text.goTo} ${inlineStartItem.title}`}
                  onClick={() => choose(inlineStartIndex)}
                />
              ) : null}

              <article
                key={activeItem.id}
                data-testid="programme-hero-active"
                className="animate-hero-slide-in relative min-h-[27rem] min-w-0 max-w-full overflow-hidden rounded-2xl bg-ink text-paper shadow-[0_26px_80px_rgb(20_33_63/0.22)] md:min-h-[29rem] lg:min-h-[31rem]"
                style={{ '--slide-x': `${direction * (isRtl ? -1 : 1) * 26}px` } as CSSProperties}
                aria-live="polite"
                aria-label={`${text.slide} ${displayNumber(active)} ${count}`}
              >
                <ProgrammeImage
                  item={activeItem}
                  priority={active === 0}
                  sizes="(min-width: 1366px) 760px, (min-width: 768px) 66vw, 100vw"
                  className="animate-hero-image-in scale-[1.02] transition duration-700"
                />
                <span className="absolute inset-0 bg-ink/54 md:bg-linear-to-l md:from-ink/88 md:via-ink/42 md:to-ink/8" aria-hidden="true" />

                <div
                  className={`animate-hero-text-in relative z-10 flex min-h-[27rem] min-w-0 max-w-2xl flex-col justify-end p-6 md:min-h-[29rem] md:p-10 lg:min-h-[31rem] ${
                    isRtl ? 'text-start' : 'ms-auto text-end'
                  }`}
                >
                  <p className="mbe-3 inline-flex w-fit items-center gap-3 border-bs border-gold-600 pbe-2 text-small font-medium text-paper/84">
                    {text.eyebrow}
                  </p>
                  <h2 className="max-w-full break-words text-h2 font-semibold leading-tight text-paper sm:max-w-[13ch] sm:text-h1 md:text-display">
                    {activeItem.title}
                  </h2>
                  {activeItem.summary ? (
                    <p className="mbs-4 max-w-xl text-small leading-7 text-paper/86 sm:text-body-large sm:leading-8">
                      {trimSummary(activeItem.summary)}
                    </p>
                  ) : null}
                  <Link
                    href={activeItem.href}
                    className="mbs-6 inline-flex min-h-12 w-fit items-center gap-3 rounded-md bg-gold-600 px-6 text-small font-semibold text-paper no-underline shadow-[0_12px_28px_rgb(211_144_15/0.24)] hover:bg-gold-700 hover:text-paper"
                  >
                    {isRtl ? <ArrowIcon direction="previous" /> : null}
                    {text.explore}
                    {isRtl ? null : <ArrowIcon direction="next" />}
                  </Link>

                  {count > 1 ? (
                    <div className="mbs-12 flex items-center gap-2" aria-label={text.slide}>
                      {programmes.map((item, index) => (
                        <button
                          key={item.id}
                          type="button"
                          aria-label={`${text.goTo} ${item.title}`}
                          data-testid="programme-hero-indicator"
                          aria-current={index === active ? 'true' : undefined}
                          onClick={() => choose(index)}
                          className="relative h-1.5 w-9 overflow-hidden rounded-full bg-paper/55 transition-all hover:bg-paper aria-current:w-16"
                        >
                          {index === active ? (
                            <span key={activeItem.id} className="animate-hero-progress absolute inset-y-0 start-0 rounded-full bg-gold-600" />
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>

              {inlineEndItem ? (
                <PreviewButton
                  item={inlineEndItem}
                  index={inlineEndIndex}
                  side={inlineEndSide}
                  label={`${text.goTo} ${inlineEndItem.title}`}
                  onClick={() => choose(inlineEndIndex)}
                />
              ) : null}
          </div>

          {count > 1 ? (
            <>
              <button
                type="button"
                aria-label={text.previous}
                data-testid="programme-hero-previous"
                onClick={() => move(-1)}
                className="programme-arrow-start absolute z-20 flex size-11 items-center justify-center rounded-full bg-white/96 text-ink shadow-[0_10px_30px_rgb(20_33_63/0.18)] transition hover:bg-gold-050 hover:text-gold-700 md:size-12"
              >
                <ArrowIcon direction={isRtl ? 'next' : 'previous'} />
              </button>
              <button
                type="button"
                aria-label={text.next}
                data-testid="programme-hero-next"
                onClick={() => move(1)}
                className="programme-arrow-end absolute z-20 flex size-11 items-center justify-center rounded-full bg-white/96 text-ink shadow-[0_10px_30px_rgb(20_33_63/0.18)] transition hover:bg-gold-050 hover:text-gold-700 md:size-12"
              >
                <ArrowIcon direction={isRtl ? 'previous' : 'next'} />
              </button>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
