import { cn } from '@/lib/utils';

/**
 * Inline SVG glyphs.
 *
 * No icon library: the public routes carry a 110 KB JS budget and the handful
 * of glyphs the site needs fit in one file. Every icon is `aria-hidden` — an
 * icon never carries meaning on its own; the adjacent text or the control's
 * `aria-label` does.
 *
 * `directional` icons (chevron, arrow) flip in RTL. Checkmarks, close crosses
 * and the external-link glyph do not, per 04-DESIGN-SYSTEM §2.
 */

const paths = {
  chevron: 'm9 6 6 6-6 6',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  close: 'M18 6 6 18M6 6l12 12',
  check: 'm5 12 5 5L20 7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  info: 'M12 16v-4M12 8h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
  warning: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  error: 'M12 8v4M12 16h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
  external: 'M14 4h6v6M20 4l-9 9M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6',
  search: 'm21 21-4.3-4.3M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  download: 'M12 4v12M6 11l6 6 6-6M4 20h16',
  upload: 'M12 16V4M6 9l6-6 6 6M4 20h16',
  file: 'M14 3v5h5M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z',
  calendar: 'M8 3v3M16 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  image: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM9 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM20 16l-5-5-9 9',
  user: 'M20 21a8 8 0 0 0-16 0M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  clock: 'M12 7v5l3 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
  pin: 'M12 22s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12ZM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6.2 6.2l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z',
  mail: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM3 7l9 6 9-6',
} as const;

export type IconName = keyof typeof paths;

const directional = new Set<IconName>(['chevron', 'arrow']);

const styles = {
  size: {
    16: 'icon-16',
    20: 'icon-20',
    24: 'icon-24',
  },
};

export type IconSize = keyof typeof styles.size;

export function Icon({
  name,
  size = 20,
  className,
}: {
  name: IconName;
  size?: IconSize;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        'shrink-0',
        styles.size[size],
        directional.has(name) && 'rtl:-scale-x-100',
        className,
      )}
    >
      <path d={paths[name]} />
    </svg>
  );
}

export const iconNames = Object.keys(paths) as IconName[];
