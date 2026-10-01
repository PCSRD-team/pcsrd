'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { adminUi } from '@/components/admin/admin-ui-dict';
import { Button, ButtonLink } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/feedback';

/**
 * The admin's error boundary.
 *
 * **A Client Component because React requires it** — an error boundary needs
 * `componentDidCatch`, which has no server equivalent.
 *
 * It renders *inside* `admin/layout.tsx`, so the shell and its navigation
 * survive a failing page: an editor whose list query failed can still move to
 * another screen instead of landing on the bare global error document. A
 * failure in the layout itself (the auth guard) is not caught here — that one
 * reaches `global-error.tsx`.
 *
 * `retry` (Next 16.3) re-fetches the segment's server data and re-renders it,
 * which is what a transient database error needs; `reset` would only re-render
 * the same failed payload. The digest is shown because it is the only handle
 * an editor can quote and an operator can search the logs for.
 */
export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const t = adminUi.boundary;

  return (
    <ErrorState
      title={t.errorTitle}
      body={t.errorBody}
      reference={error.digest ?? null}
      referenceLabel={t.referenceLabel}
      action={
        <>
          <Button type="button" onClick={retry}>
            {t.retry}
          </Button>
          <ButtonLink href="/admin" tone="secondary">
            {t.toDashboard}
          </ButtonLink>
        </>
      }
    />
  );
}
