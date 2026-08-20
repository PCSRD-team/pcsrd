import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans_Arabic } from 'next/font/google';
import './globals.css';

/**
 * Root layout.
 *
 * It sets no `lang` or `dir` — those belong to `[locale]/layout.tsx`, which is
 * the first place the locale is known. A root that guessed would have to be
 * corrected downstream, and a wrong `dir` on the html element is not something
 * a nested element can undo.
 *
 * `next/font/google` downloads both faces **at build time** and serves them
 * from this origin. There is no runtime request to Google, which is what keeps
 * the CSP free of a font host and satisfies the handoff's self-hosting
 * requirement without checking WOFF2 binaries into the repository.
 */

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-arabic',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  // Every organisational fact — including the name — comes from
  // organization_settings, so the real title is set per-locale downstream.
  title: { default: 'PCSRD', template: '%s — PCSRD' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <body className={`${plexArabic.variable} ${plexMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
