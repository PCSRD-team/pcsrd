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
 * and the external-link glyph do not, per 04-DESIGN-SYSTEM §2. Neither do the
 * editor and navigation glyphs below: several of them carry a digit (`h2`,
 * `orderedList`) or a letter, and a mirrored digit is unreadable — so the
 * whole editor toolbar stays unmirrored rather than half of it flipping.
 *
 * A glyph is one `d` string, or an array of them when the shape genuinely
 * needs separate strokes. Circles are written as arcs so the whole set stays
 * one element type and one stroke weight.
 *
 * Three groups:
 *
 * - **interface** — chevron, arrow, close, search… the public site's vocabulary.
 * - **editor** — the rich-text toolbar. Every one is the accessible name of an
 *   `IconButton`, never a label on its own.
 * - **navigation** — the admin sidebar, one per section.
 */

const paths = {
  // ── interface ──────────────────────────────────────────────────────────
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

  // ── editor ─────────────────────────────────────────────────────────────
  bold: ['M7 4h6a4 4 0 0 1 0 8H7V4Z', 'M7 12h7.5a4 4 0 0 1 0 8H7v-8Z'],
  italic: 'M19 4h-7M12 20H5M15.5 4 8.5 20',
  h2: ['M4 6v12M12 6v12M4 12h8', 'M16.5 9.5a2.5 2.5 0 0 1 4.3 1.7c0 1.6-1.6 2.6-2.8 3.6L16 17h5'],
  h3: [
    'M4 6v12M12 6v12M4 12h8',
    'M16.5 9.5a2.5 2.5 0 0 1 4 2c0 1-.9 1.8-2 1.8 1.1 0 2.2.8 2.2 2a2.6 2.6 0 0 1-4.3 2',
  ],
  bulletList: ['M9 6h11M9 12h11M9 18h11', 'M4.5 6h.01M4.5 12h.01M4.5 18h.01'],
  orderedList: ['M10 6h10M10 12h10M10 18h10', 'M4 5h1.5v4M4 9h3', 'M4 15.2a1.4 1.4 0 0 1 2.4 1c0 .9-2.4 1.9-2.4 2.8h2.6'],
  blockquote: ['M5 5v14', 'M10 7h9M10 12h9M10 17h5'],
  link: [
    'M10.5 13.5a4 4 0 0 0 6 .4l2.5-2.5a4 4 0 0 0-5.7-5.7l-1.4 1.4',
    'M13.5 10.5a4 4 0 0 0-6-.4L5 12.6a4 4 0 0 0 5.7 5.7l1.4-1.4',
  ],
  unlink: [
    'M16.5 10.5 19 8a4 4 0 0 0-5.7-5.7L10.8 4.8',
    'M7.5 13.5 5 16a4 4 0 0 0 5.7 5.7l2.5-2.5',
    'M3 3l18 18',
  ],

  // ── navigation ─────────────────────────────────────────────────────────
  home: ['m3 11 9-8 9 8', 'M5 10v10h14V10M9 20v-6h6v6'],
  content: ['M4 3h16v18H4z', 'M8 8h8M8 12h8M8 16h5'],
  project: ['M4 7h6l2 2h8v11H4z', 'M4 7V5h7l2 2'],
  news: ['M5 4h14v16H5z', 'M8 8h8M8 12h8M8 16h5'],
  story: ['M4 5h7a3 3 0 0 1 3 3v12H7a3 3 0 0 0-3 1z', 'M20 5h-4'],
  job: ['M3 7h18v13H3z', 'M9 7V4h6v3M3 12h18'],
  page: ['M6 3h9l4 4v14H6z', 'M15 3v5h4M9 13h7M9 17h5'],
  metric: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  partner: ['M8 12 5 9l3-3 4 4M16 12l3-3-3-3-4 4', 'm9 13 3 3 3-3'],
  people: [
    'M12 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    'M19 9a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
    'M3 20c.5-4 2.5-6 6-6s5.5 2 6 6M15 15c3 0 5 1.7 5.5 5',
  ],
  publication: ['M5 4h14v16H5z', 'M9 4v16M12 8h4M12 12h4'],
  media: ['M3 4h18v16H3z', 'M11 9a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z', 'm3 17 5-5 4 4 3-3 6 5'],
  inbox: ['M4 5h16l2 10v5H2v-5z', 'M3 15h5l2 3h4l2-3h5'],
  shield: ['M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z', 'm9 12 2 2 4-4'],
  organization: ['M4 21h16M6 21V8l6-5 6 5v13', 'M9 11h2M13 11h2M9 15h2M13 15h2'],
  redirect: ['M4 7h11a5 5 0 0 1 5 5v1', 'm16 9 4 4 4-4M20 17H9a5 5 0 0 1-5-5v-1'],
  users: ['M12 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z', 'M3 20c.5-4 2.5-6 6-6s5.5 2 6 6M17 8v6M14 11h6'],
  audit: ['M5 3h14v18H5z', 'M8 8h8M8 12h8M8 16h5'],
} as const satisfies Record<string, string | readonly string[]>;

export type IconName = keyof typeof paths;

const directional = new Set<IconName>(['chevron', 'arrow']);

/** One glyph is one `d`, or several; both render as `<path>` at the same weight. */
function strokesOf(name: IconName): readonly string[] {
  const value: string | readonly string[] = paths[name];
  return typeof value === 'string' ? [value] : value;
}

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
      {strokesOf(name).map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export const iconNames = Object.keys(paths) as IconName[];
