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

const AUTOPLAY_DELAY_MS = 4500;

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
      data-testid={`programme-hero-preview-${side}`}
      onClick={onClick}
      className="group relative hidden min-h-[29rem] overflow-hidden rounded-2xl border border-ink/10 bg-ink text-start text-paper shadow-[0_18px_50px_rgb(20_33_63/0.16)] md:block lg:min-h-[31rem]"
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
  const [paused, setPaused] = useState(false);
  const [interactedAt, setInteractedAt] = useState(0);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const prefersReducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const changeActive = useCallback(
    (next: number) => {
      setActive(wrap(next, count));
      setInteractedAt(Date.now());
    },
    [count],
  );

  const move = useCallback(
    (step: number) => {
      if (count <= 1) return;
      changeActive(active + step);
    },
    [active, changeActive, count],
  );

  const choose = useCallback(
    (index: number) => {
      changeActive(index);
    },
    [changeActive],
  );

  useEffect(() => {
    if (count <= 1 || paused || prefersReducedMotion) return;
    const timer = window.setTimeout(() => changeActive(active + 1), AUTOPLAY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [active, changeActive, count, paused, interactedAt, prefersReducedMotion]);

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

  function onPointerEnd(event: React.PointerEvent) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || count <= 1) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY)) return;

    const visualStep = deltaX > 0 ? -1 : 1;
    move(isRtl ? -visualStep : visualStep);
  }

  return (
    <section
      data-testid="programme-hero"
      data-slide-count={count}
      data-active-index={active}
      className="cursor-grab overflow-hidden bg-paper pbs-4 pbe-5 active:cursor-grabbing md:pbs-4 md:pbe-0"
      style={{ touchAction: 'pan-y' }}
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
      onPointerDown={(event) => {
        pointerStart.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={onPointerEnd}
      onPointerCancel={() => {
        pointerStart.current = null;
      }}
    >
      <div className="mx-auto max-w-[1460px] px-4 sm:px-6 lg:px-8">
        <div className="relative">
          <div className="relative hidden min-h-[29rem] md:block lg:min-h-[31rem]">
            {programmes.map((item, index) => {
              const isActive = index === active;
              const isInlineStart = index === inlineStartIndex;
              const position = isActive
                ? { insetInlineStart: '18%', inlineSize: '64%', zIndex: 2 }
                : isInlineStart
                  ? { insetInlineStart: '0%', inlineSize: '16.5%', zIndex: 1 }
                  : { insetInlineStart: '83.5%', inlineSize: '16.5%', zIndex: 1 };

              return (
                <div
                  key={item.id}
                  data-testid={isActive ? 'programme-hero-active' : undefined}
                  className="absolute inset-bs-0 min-h-[29rem] overflow-hidden rounded-2xl border border-ink/10 bg-ink text-paper shadow-[0_18px_50px_rgb(20_33_63/0.16)] transition-[inset-inline-start,inline-size,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:min-h-[31rem]"
                  style={position as CSSProperties}
                  aria-live={isActive ? 'polite' : undefined}
                >
                  <ProgrammeImage
                    item={item}
                    priority={index === 0}
                    sizes={isActive ? '(min-width: 1366px) 760px, 64vw' : '17vw'}
                    className="scale-[1.02] transition duration-700"
                  />
                  <span
                    className={`absolute inset-0 transition-colors duration-500 ${
                      isActive
                        ? isRtl
                          ? 'bg-ink/54 md:bg-linear-to-l md:from-ink/88 md:via-ink/42 md:to-ink/8'
                          : 'bg-ink/54 md:bg-linear-to-r md:from-ink/88 md:via-ink/42 md:to-ink/8'
                        : 'bg-ink/58'
                    }`}
                    aria-hidden="true"
                  />

                  {isActive ? (
                    <article
                      className="relative z-10 me-auto flex min-h-[29rem] max-w-2xl flex-col justify-end p-10 text-start lg:min-h-[31rem]"
                      aria-label={`${text.slide} ${displayNumber(index)} ${count}`}
                    >
                      <p className="mbe-3 inline-flex w-fit items-center gap-3 border-bs border-gold-600 pbe-2 text-small font-medium text-paper/84">
                        {text.eyebrow}
                      </p>
                      <h2 className="max-w-[13ch] break-words text-h1 font-semibold leading-tight text-paper md:text-display">
                        {item.title}
                      </h2>
                      {item.summary ? (
                        <p className="mbs-4 max-w-xl text-body-large leading-8 text-paper/86">
                          {trimSummary(item.summary)}
                        </p>
                      ) : null}
                      <Link
                        href={item.href}
                        className="mbs-6 inline-flex min-h-12 w-fit items-center gap-3 rounded-md bg-gold-600 px-6 text-small font-semibold text-paper no-underline shadow-[0_12px_28px_rgb(211_144_15/0.24)] hover:bg-gold-700 hover:text-paper"
                      >
                        {isRtl ? <ArrowIcon direction="previous" /> : null}
                        {text.explore}
                        {isRtl ? null : <ArrowIcon direction="next" />}
                      </Link>
                      <div className="mbs-8 flex items-center gap-2" aria-label={text.slide}>
                        {programmes.map((dotItem, dotIndex) => (
                          <button
                            key={dotItem.id}
                            type="button"
                            aria-label={`${text.goTo} ${dotItem.title}`}
                            aria-current={dotIndex === active ? 'true' : undefined}
                            onClick={() => choose(dotIndex)}
                            className="relative h-1.5 w-9 overflow-hidden rounded-full bg-paper/55 transition-all hover:bg-paper aria-current:w-16"
                          >
                            {dotIndex === active ? (
                              <span className="animate-hero-progress absolute inset-y-0 start-0 rounded-full bg-gold-600" />
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </article>
                  ) : (
                    <button
                      type="button"
                      aria-label={`${text.goTo} ${item.title}`}
                      onClick={() => choose(index)}
                      className="absolute inset-0 z-10 flex flex-col justify-end p-5 text-start"
                    >
                      <span className="mbe-3 block font-mono text-h3 text-paper/80">
                        {displayNumber(index)}
                      </span>
                      <span className="mbe-4 block h-0.5 w-12 bg-gold-600" aria-hidden="true" />
                      <span className="block text-h4 font-semibold leading-snug text-paper">{item.title}</span>
                      {item.summary ? (
                        <span className="mbs-2 line-clamp-3 block text-caption leading-6 text-paper/76">
                          {trimSummary(item.summary)}
                        </span>
                      ) : null}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className={`grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 md:hidden ${trackClass}`}>
              {inlineStartItem ? (
                <PreviewButton
                  key={inlineStartItem.id}
                  item={inlineStartItem}
                  index={inlineStartIndex}
                  side={inlineStartSide}
                  label={`${text.goTo} ${inlineStartItem.title}`}
                  onClick={() => choose(inlineStartIndex)}
                />
              ) : null}

              <article
                data-testid="programme-hero-active"
                className="relative min-h-[27rem] min-w-0 max-w-full overflow-hidden rounded-2xl bg-ink text-paper shadow-[0_26px_80px_rgb(20_33_63/0.22)] md:min-h-[29rem] lg:min-h-[31rem]"
                aria-live="polite"
                aria-label={`${text.slide} ${displayNumber(active)} ${count}`}
              >
                <ProgrammeImage
                  item={activeItem}
                  priority={active === 0}
                  sizes="(min-width: 1366px) 760px, (min-width: 768px) 66vw, 100vw"
                  className="animate-hero-image-in scale-[1.02] transition duration-700"
                />
                <span
                  className={`absolute inset-0 bg-ink/54 ${
                    isRtl
                      ? 'md:bg-linear-to-l md:from-ink/88 md:via-ink/42 md:to-ink/8'
                      : 'md:bg-linear-to-r md:from-ink/88 md:via-ink/42 md:to-ink/8'
                  }`}
                  aria-hidden="true"
                />

                <div
                  className="animate-hero-text-in relative z-10 me-auto flex min-h-[27rem] min-w-0 max-w-2xl flex-col justify-end p-6 text-start md:min-h-[29rem] md:p-10 lg:min-h-[31rem]"
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
                  key={inlineEndItem.id}
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
