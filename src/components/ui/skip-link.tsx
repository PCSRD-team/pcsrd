import { cn } from '@/lib/utils';

/**
 * Skip link — the first focusable element on every page (04-DESIGN-SYSTEM §5).
 *
 * Off-canvas on the inline-start side until focused (the `skip-link`
 * utility), then pulled in at `start-4` so it lands on the correct side in
 * both directions. A plain `<a href="#main">`: no JavaScript, and the target
 * needs `id="main"` and `tabIndex={-1}` so focus actually moves.
 */
export function SkipLink({
  label,
  href = '#main',
  className,
}: {
  label: string;
  href?: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        'skip-link inline-flex min-h-target items-center bg-ink px-4 text-small font-medium text-paper no-underline focus:start-4 focus:inset-bs-4',
        className,
      )}
    >
      {label}
    </a>
  );
}
