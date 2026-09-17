'use client';

import { useEffect, useRef, useState } from 'react';
import { Bidi } from '@/components/ui/bidi';

/**
 * A figure that counts up once it scrolls into view.
 *
 * **Client Component — justification.** The only thing this adds is a
 * one-off `requestAnimationFrame` sweep from zero to the figure; there is no
 * state a server could render. Two rules keep it honest:
 *
 * 1. **The final figure is what the server renders.** The initial state is
 *    the formatted value the caller passed, so the HTML, a crawler, a reader
 *    with scripting off, and the accessibility tree all see the real number.
 *    The animation replaces it only after hydration, and only when the
 *    element is on screen.
 * 2. **`prefers-reduced-motion` disables the sweep entirely.** A moving
 *    number is motion; a reader who asked for none gets the figure at rest.
 *
 * The value is opaque text: `85,642+`, `126`, `2015`. Only a plain integer
 * (with optional grouping and a trailing `+`) animates; anything else is
 * rendered as given. The formatted figure is the caller's — this component
 * never invents a number — and it renders inside `Bidi` so digits sit
 * correctly in Arabic prose.
 */

function parseCount(value: string): { target: number; plus: boolean; grouped: boolean } | null {
  const trimmed = value.trim();
  const plus = trimmed.endsWith('+');
  const digits = (plus ? trimmed.slice(0, -1) : trimmed).replace(/[,\s٬]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  return { target: Number.parseInt(digits, 10), plus, grouped: trimmed.includes(',') };
}

function formatCount(value: number, plus: boolean, grouped: boolean) {
  const text = new Intl.NumberFormat('en', { useGrouping: grouped }).format(value);
  return plus ? `${text}+` : text;
}

const DURATION_MS = 1300;

export function ImpactCount({ value }: { value: string }) {
  const [shown, setShown] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const parsed = parseCount(value);
    const node = ref.current;
    if (!parsed || !node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    let startedAt = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const tick = (time: number) => {
          if (!startedAt) startedAt = time;
          const progress = Math.min(1, (time - startedAt) / DURATION_MS);
          const eased = 1 - Math.pow(1 - progress, 3);
          setShown(formatCount(Math.round(parsed.target * eased), parsed.plus, parsed.grouped));
          if (progress < 1) frame = window.requestAnimationFrame(tick);
          else setShown(value);
        };
        frame = window.requestAnimationFrame(tick);
      },
      { threshold: 0.35 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <Bidi>
      <span ref={ref}>{shown}</span>
    </Bidi>
  );
}
