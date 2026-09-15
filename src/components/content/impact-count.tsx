'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bidi } from '@/components/ui/bidi';

function parseNumber(value: string) {
  const normalized = value.replace(/[,\s\u066C]/g, '').trim();
  if (!/^\+?\d+$/.test(normalized)) return null;
  return Number.parseInt(normalized, 10);
}

function formatCount(value: number, plus: boolean, useGrouping: boolean) {
  const text = new Intl.NumberFormat('en', { useGrouping }).format(value);
  return plus ? `${text}+` : text;
}

export function ImpactCount({ value }: { value: string }) {
  const target = useMemo(() => parseNumber(value.replace(/\+$/, '')), [value]);
  const hasPlus = value.trim().endsWith('+');
  const useGrouping = value.includes(',');
  const [current, setCurrent] = useState(target ? 0 : null);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!target || !ref.current) return;

    const node = ref.current;
    let frame = 0;
    let startedAt = 0;
    const duration = 1300;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();

        const tick = (time: number) => {
          if (!startedAt) startedAt = time;
          const progress = Math.min(1, (time - startedAt) / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          setCurrent(Math.round(target * eased));
          if (progress < 1) frame = window.requestAnimationFrame(tick);
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
  }, [target]);

  return (
    <Bidi>
      <span ref={ref}>{current === null || !target ? value : formatCount(current, hasPlus, useGrouping)}</span>
    </Bidi>
  );
}
