import type { Metadata } from 'next';
import { fontVariables } from '@/app/fonts';
import { NotFoundBody } from '@/components/layout/not-found-body';
import { DEFAULT_LOCALE, DIR } from '@/lib/i18n/config';
import { ar } from '@/lib/i18n/dictionaries/ar';
import { en } from '@/lib/i18n/dictionaries/en';
import './globals.css';

/**
 * The 404 for a URL that matches **no route at all** — `/ar/no-such-page`,
 * `/nonsense`, a link from an old sitemap.
 *
 * `global-not-found` rather than `not-found`, and `experimental.globalNotFound`
 * is on in `next.config.ts` because of it. Next's documentation names the two
 * cases this convention exists for and this project is both at once: several
 * root layouts, and the root layout under a top-level dynamic segment. A plain
 * `app/not-found.tsx` renders *inside* a root layout, and an unmatched URL has
 * none — so Next served its built-in 404, a bare `<html>` with no `lang`. axe
 * reports that as `html-has-lang`: WCAG 2.2 SC 3.1.1, Level A. It was the only
 * failure in the first browser run of the accessibility suite; all 29 other
 * routes passed in both locales.
 *
 * This file bypasses layout rendering entirely, so it imports the stylesheet
 * and the fonts itself and emits its own `<html>` and `<body>`.
 *
 * `lang` is Arabic because Arabic is the default locale and the path that
 * brought a visitor here carries no reliable locale of its own. The English
 * half of the page carries its own `lang="en" dir="ltr"`, so a screen reader
 * still announces each language in its own voice.
 *
 * No header, no footer, no database: this page has to render when the route
 * table, the content or the connection is the thing that is wrong.
 */
export const metadata: Metadata = {
  // Both locales, for the same reason the body shows both: the URL that
  // brought a visitor here names no locale. The words come from the
  // dictionaries, not from this file (RULE 5).
  title: `${ar.states.notFoundTitle} · ${en.states.notFoundTitle}`,
  robots: { index: false, follow: false },
};

export default function GlobalNotFound() {
  return (
    <html lang={DEFAULT_LOCALE} dir={DIR[DEFAULT_LOCALE]}>
      <body
        className={`${fontVariables} flex min-h-screen flex-col justify-center bg-paper-ground antialiased`}
      >
        <main id="main">
          <NotFoundBody />
        </main>
      </body>
    </html>
  );
}
