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
 *
 * `retry`, not `reset` (stable since Next 16.3): `reset` only re-renders the
 * children from the payload already on the client, so a failed server fetch
 * failed again identically; `retry` re-fetches the segment first.
 */
export default function SiteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
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
              <Button type="button" onClick={() => retry()}>
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
              <Button type="button" onClick={() => retry()} tone="secondary">
                {en.retry}
              </Button>
            }
          />
        </div>
      </div>
    </Container>
  );
}
