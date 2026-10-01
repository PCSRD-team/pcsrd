import { IBM_Plex_Mono, IBM_Plex_Sans_Arabic } from 'next/font/google';

/**
 * The two faces, defined once.
 *
 * `next/font/google` downloads both at **build time** and serves them from this
 * origin. There is no runtime request to Google, which is what keeps the CSP
 * free of a font host and satisfies the handoff's self-hosting requirement
 * without checking WOFF2 binaries into the repository.
 *
 * One module rather than one call per root layout. There are three root layouts
 * — `(site)`, `(admin)` and `(admin-auth)` — and each used to call
 * `IBM_Plex_Sans_Arabic()` itself. Every call site is a separate `next/font`
 * instance with its own module hash, its own generated `@font-face` block and
 * its own CSS variable value, so the same family was downloaded and served
 * three times over. The login layout had also drifted to a different weight set
 * (400/500/600 and 400/500), which meant a screen rendered in the semibold that
 * layout does not load fell back to a synthesised bold.
 *
 * Importing the same module from several layouts yields **one** instance,
 * because module evaluation is cached.
 */

export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  // No 700: nothing sets it (the heaviest weight in the design is semibold,
  // and globals.css maps <strong>/<b>/<th> to 600), and each weight is a
  // separate download per subset.
  weight: ['400', '500', '600'],
  variable: '--font-plex-arabic',
  display: 'swap',
});

export const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
  // Not preloaded: mono is eyebrows, codes and dates — never the first text
  // a reader needs — and a preload competes with the Arabic text face for the
  // first round trips on a slow connection. `swap` covers the gap.
  preload: false,
});

/** The class pair every root layout puts on `<body>`. */
export const fontVariables = `${plexArabic.variable} ${plexMono.variable}`;
