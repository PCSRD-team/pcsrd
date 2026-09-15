import type * as Sentry from '@sentry/nextjs';
import type { Breadcrumb, ErrorEvent, Event } from '@sentry/nextjs';

/** The union `Sentry.init` accepts; the SDK does not re-export `Options` itself. */
type InitOptions = NonNullable<Parameters<typeof Sentry.init>[0]>;

/**
 * What a Sentry event is allowed to carry — one function, three runtimes.
 *
 * The site collects personal data through six forms, one of which is a
 * confidential complaints channel. An error tracker is a third party that
 * keeps whatever it is sent for ninety days, searchable, outside the
 * audited system. So the rule is not "scrub the payload"; it is **an event
 * carries a message, a stack trace and a route, and nothing else**:
 *
 * - no `user` — not an id, not an IP, not a username
 * - no request headers, cookies, body or query string — a query string on a
 *   `(site)` route can be a search term; on `/admin/submissions?ref=…` it is
 *   a reference number; a body is a form payload
 * - no `extra`, no `contexts` beyond the runtime/OS/browser blocks the SDK
 *   fills itself — `extra` is where a caller might have put a payload
 * - breadcrumbs keep a method, a path and a status; never a body, never
 *   console arguments (a Postgres error's `parameters` are the query values)
 * - no session replay, no tracing (`tracesSampleRate: 0` in every config)
 *
 * **A complaint can never be identified from what reaches Sentry.** The
 * complaint action runs inside `runAction()`, which catches every throw and
 * returns an `ActionResult`, so nothing from `submitComplaint` or
 * `submitFraudReport` reaches Sentry as an event at all. If that ever changes
 * — an uncaught throw, a deliberate `captureException` — the scrubbing here
 * still reduces it to an error message and a stack: no IP (DNH-8 already
 * stores none), no payload, no reference. That is the documented ceiling.
 */

/** Strips the query string and fragment from a URL; keeps origin and path. */
export function stripQuery(url: string | undefined): string | undefined {
  if (!url) return url;
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

/** The subset of a request the SDK may keep: method and query-less URL. */
function scrubRequest(request: Event['request']): Event['request'] {
  if (!request) return undefined;
  const kept: NonNullable<Event['request']> = {};
  if (request.method) kept.method = request.method;
  const url = stripQuery(request.url);
  if (url) kept.url = url;
  return kept;
}

/**
 * `beforeBreadcrumb`. A breadcrumb records what happened before the error;
 * the parts that could carry data are the parts dropped.
 */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  const category = breadcrumb.category ?? '';

  if (category === 'fetch' || category === 'xhr' || category === 'http') {
    const data = breadcrumb.data ?? {};
    return {
      ...breadcrumb,
      data: {
        method: data.method,
        url: stripQuery(typeof data.url === 'string' ? data.url : undefined),
        status_code: data.status_code,
      },
    };
  }

  if (category === 'navigation') {
    const data = breadcrumb.data ?? {};
    return {
      ...breadcrumb,
      data: {
        from: stripQuery(typeof data.from === 'string' ? data.from : undefined),
        to: stripQuery(typeof data.to === 'string' ? data.to : undefined),
      },
    };
  }

  if (category === 'console') {
    // `console.error('[unhandled]', e)` in `toActionResult` serialises the
    // whole error object into `data.arguments` — for a Postgres error that
    // includes the statement's parameters. Keep the first line only.
    const message = breadcrumb.message?.split('\n')[0];
    return { ...breadcrumb, message, data: undefined };
  }

  if (category.startsWith('ui.')) {
    // Click and input breadcrumbs carry a DOM selector and, for inputs,
    // could carry text. There is no debugging value in them for a form site.
    return null;
  }

  return { ...breadcrumb, data: undefined };
}

/**
 * `beforeSend`. Applied to every error event in every runtime. Returns the
 * same event object, reduced.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  delete event.extra;
  delete event.server_name;

  event.request = scrubRequest(event.request);

  if (event.contexts) {
    // Keep only the blocks the SDK fills from the runtime itself.
    const { runtime, os, browser, device, app } = event.contexts;
    event.contexts = { runtime, os, browser, device, app };
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map(scrubBreadcrumb)
      .filter((crumb): crumb is Breadcrumb => crumb !== null);
  }

  // Tags are allowed — they are set by this codebase only and never from
  // input — except the ones the SDK derives from the request.
  if (event.tags) {
    delete event.tags['url'];
    delete event.tags['transaction'];
  }

  if (event.transaction) event.transaction = stripQuery(event.transaction);

  return event;
}

/**
 * The options every `Sentry.init` shares. Each runtime spreads these and adds
 * only its `dsn`. Nothing here may be loosened per runtime.
 */
export const sharedSentryOptions = {
  sendDefaultPii: false,
  /** No tracing anywhere. The public site is static + ISR; Vercel's own analytics cover the rest. */
  tracesSampleRate: 0,
  /** Fewer crumbs means fewer places for something to hide. */
  maxBreadcrumbs: 20,
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
} satisfies Partial<InitOptions>;
