import * as Sentry from '@sentry/nextjs';

/**
 * Server instrumentation (Next 16: `src/instrumentation.ts`, `register()`
 * once per server instance, `onRequestError` for every uncaught server
 * error).
 *
 * The Sentry configs are imported dynamically per runtime so the Node bundle
 * never carries the edge one and vice versa.
 *
 * `captureRequestError` reports uncaught errors from route handlers, Server
 * Components and Server Actions, with the request attached. `beforeSend` in
 * `sentry.scrub.config.ts` reduces that request to a method and a path
 * before it leaves — no headers, no body, no query string. Public form
 * actions run inside `runAction()` and never throw out, so they do not
 * reach this path at all; see the note at the top of that file.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
