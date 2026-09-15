import * as Sentry from '@sentry/nextjs';
import { sharedSentryOptions } from './sentry.scrub.config';

/**
 * Node runtime. Loaded once from `src/instrumentation.ts` → `register()`.
 *
 * `SENTRY_DSN` unset ⇒ `init` is never called ⇒ every `capture*` is a no-op
 * and no network request leaves the function. That is the state of every
 * preview deploy without the variable, and of every local run.
 *
 * `process.env` is read directly rather than through `src/lib/env.ts`:
 * instrumentation runs before the first request, and a missing unrelated
 * variable should fail at the first request with the readable message the
 * env module produces, not at boot inside Sentry.
 */
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    ...sharedSentryOptions,
    dsn,
    // Default integrations minus the ones that read data this site must not
    // ship: local variables are off by default, and the console integration
    // stays because `beforeBreadcrumb` reduces it to a first line.
  });
}
