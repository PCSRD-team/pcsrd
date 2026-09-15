import * as Sentry from '@sentry/nextjs';
import { sharedSentryOptions } from './sentry.scrub.config';

/**
 * Edge runtime. `src/proxy.ts` runs on the Node runtime in Next 16, so in
 * practice nothing in this project executes here; the file exists so a future
 * edge route is covered by the same scrubbing rather than by nothing.
 */
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({ ...sharedSentryOptions, dsn });
}
