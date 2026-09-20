'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { DEFAULT_LOCALE, DIR } from '@/lib/i18n/config';
import { site_coreAr, site_coreEn } from '@/lib/i18n/dictionaries/partials/site-core';
import { fontVariables } from './fonts';
import './globals.css';

/**
 * The last resort.
 *
 * `error.tsx` renders *inside* its layout, so it cannot catch a failure in the
 * layout itself. `global-error.tsx` replaces the whole document, which is why it
 * must render its own `<html>` and `<body>` — nothing above it survives to
 * provide them. That matters more here than in most projects: there is no
 * `src/app/layout.tsx` at all, and all three route groups are root layouts, so
 * a failure in any one of them had nothing to catch it.
 *
 * It is a Client Component because an error boundary has to be, so it cannot
 * call `getDictionary` (`server-only`), and the locale lives in a segment this
 * component has already fallen out of. It reads the `boundary` block of the
 * `site-core` partial directly instead — the copy is still a dictionary
 * lookup (RULE 5), just one that does not need a server. Both languages are
 * shown rather than guessing, each block carrying its own `lang` and `dir` so
 * a screen reader announces each in the right voice — the same approach
 * `not-found.tsx` takes, and for the same reason.
 *
 * `digest` is rendered deliberately. It is the only handle a visitor can quote
 * and an operator can grep for, and it contains no detail of the failure.
 *
 * The error is reported to Sentry from here because a root-layout failure is
 * the one kind that Next's own server-side hook does not see rendered. When
 * no DSN is configured the SDK was never initialised and the call is a no-op;
 * when one is, `beforeSend` in `sentry.scrub.config.ts` strips everything
 * but the message and the stack.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const ar = site_coreAr.boundary;
  const en = site_coreEn.boundary;

  return (
    <html lang={DEFAULT_LOCALE} dir={DIR[DEFAULT_LOCALE]}>
      <body className={`${fontVariables} bg-paper-ground antialiased`}>
        <div className="container-content section-gap">
          <div className="rule-edge bg-paper p-8">
            <p className="eyebrow" dir="ltr">
              500
            </p>

            <h1 className="mbs-4 text-h2 font-semibold text-ink" lang="ar" dir="rtl">
              {ar.errorTitle}
            </h1>
            <p className="mbs-3 text-small text-ink-70" lang="ar" dir="rtl">
              {ar.errorBody}
            </p>
            <p className="mbs-4" lang="ar" dir="rtl">
              <button
                type="button"
                onClick={reset}
                className="border-be-2 border-gold-600 py-1 text-small font-medium text-ink hover:bg-gold-050"
              >
                {ar.retry}
              </button>
            </p>

            <hr className="mbs-8 border-bs border-rule" />

            <h2 className="mbs-8 text-h3 font-semibold text-ink" lang="en" dir="ltr">
              {en.errorTitle}
            </h2>
            <p className="mbs-2 text-small text-ink-70" lang="en" dir="ltr">
              {en.errorBody}
            </p>
            <p className="mbs-4" lang="en" dir="ltr">
              <button
                type="button"
                onClick={reset}
                className="border-be-2 border-gold-600 py-1 text-small font-medium text-ink hover:bg-gold-050"
              >
                {en.retry}
              </button>
            </p>

            {error.digest ? (
              <p className="mbs-8 font-mono text-caption text-mono-muted" dir="ltr">
                {error.digest}
              </p>
            ) : null}
          </div>
        </div>
      </body>
    </html>
  );
}
