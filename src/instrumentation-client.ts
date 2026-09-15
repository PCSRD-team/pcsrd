import * as Sentry from '@sentry/nextjs';
import { sharedSentryOptions } from '../sentry.scrub.config';

/**
 * Browser instrumentation (Next 16: `src/instrumentation-client.ts`, runs
 * before hydration).
 *
 * This is the SDK **bundled** into the app's own chunks, served from `'self'`
 * — not a `<script>` from a third-party origin, which `00-ARCHITECTURE §0.9`
 * rule 4 forbids on `(site)`. The only external contact is the event POST to
 * the ingest origin derived from the DSN, allowed in `connect-src` by
 * `src/lib/security/csp.ts` and only when the DSN is set.
 *
 * `NEXT_PUBLIC_SENTRY_DSN` unset ⇒ `init` never runs ⇒ nothing is sent.
 *
 * No session replay, no tracing, no router-transition hook: `(site)` gets
 * error capture and nothing that watches a visitor.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    ...sharedSentryOptions,
    dsn,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}
