'use client';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/feedback';
import { Container } from '@/components/ui/layout';
import { site_coreAr, site_coreEn } from '@/lib/i18n/dictionaries/partials/site-core';

/**
 * Route-group error boundary.
 *
 * **A Client Component because React requires it** — an error boundary needs
 * `componentDidCatch`, which has no server equivalent. It is the only client
 * file among the core routes.
 *
 * The copy cannot come from `getDictionary`: that is `server-only`, and this
 * boundary renders when something upstream has already failed, possibly the
 * locale resolution itself. The two `boundary` blocks of the `site-core`
 * partial are imported directly instead — still a dictionary lookup, not a
 * literal (RULE 5) — and both languages are shown, each with its own `lang`
 * and `dir`, which is the honest answer when the locale is unknown.
 */
export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const ar = site_coreAr.boundary;
  const en = site_coreEn.boundary;

  return (
    <Container size="narrow" className="section-gap">
      <div className="grid gap-6 md:grid-cols-2">
        <div lang="ar" dir="rtl">
          <ErrorState
            title={ar.errorTitle}
            body={ar.errorBody}
            reference={error.digest ?? null}
            referenceLabel={ar.referenceLabel}
            action={
              <Button type="button" onClick={reset}>
                {ar.retry}
              </Button>
            }
          />
        </div>
        <div lang="en" dir="ltr">
          <ErrorState
            title={en.errorTitle}
            body={en.errorBody}
            reference={error.digest ?? null}
            referenceLabel={en.referenceLabel}
            action={
              <Button type="button" onClick={reset} tone="secondary">
                {en.retry}
              </Button>
            }
          />
        </div>
      </div>
    </Container>
  );
}
