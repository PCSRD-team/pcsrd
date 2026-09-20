/**
 * The contract between the service layer and the action layer.
 *
 * Services **throw** `AppError`. Actions **catch** it and return an
 * `ActionResult`. A service never constructs an `ActionResult`, because the
 * shape of a result is an HTTP concern and a service must stay callable from a
 * cron job, a seed script or a test.
 *
 * Every message is a **dictionary key**, never English prose. The action layer
 * has no locale and the form that renders the error does, so the string has to
 * survive the trip untranslated.
 */

export const ERROR_CODES = [
  'validation',
  'captcha',
  'rate_limited',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'upload_rejected',
  /**
   * Not in 02-API §3. Added because the publish gate needs to be distinguished
   * from ordinary validation: "this photograph has no documented consent" is a
   * different conversation from "this field is too short".
   */
  'consent_required',
  'internal',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * Zod reports several problems per field, so the value is an array — matching
 * `z.flattenError(...).fieldErrors` exactly, with no reshaping at the boundary.
 */
export type FieldErrors = Record<string, string[]>;

/** HTTP status per code, for the route handlers that need one. */
const HTTP_STATUS: Record<ErrorCode, number> = {
  validation: 422,
  captcha: 400,
  rate_limited: 429,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  upload_rejected: 415,
  consent_required: 422,
  internal: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  /** Per-field dictionary keys, e.g. `{ email: ['errors.invalidEmail'] }`. */
  readonly fieldErrors?: FieldErrors;
  /** Structured detail for logs. Never rendered, never contains form values. */
  readonly meta?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    /** A dictionary key such as `errors.rateLimited`. */
    messageKey: string,
    options?: { fieldErrors?: FieldErrors; meta?: Record<string, unknown>; cause?: unknown },
  ) {
    super(messageKey, { cause: options?.cause });
    this.name = 'AppError';
    this.code = code;
    this.fieldErrors = options?.fieldErrors;
    this.meta = options?.meta;
  }

  get status(): number {
    return HTTP_STATUS[this.code];
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

// ── Result ───────────────────────────────────────────────────────────────

export type ActionOk<T> = {
  ok: true;
  data: T;
  /** Dictionary key for a success toast, when the form wants one. */
  messageKey?: string;
};

export type ActionErr = {
  ok: false;
  code: ErrorCode;
  messageKey: string;
  fieldErrors?: FieldErrors;
};

export type ActionResult<T = void> = ActionOk<T> | ActionErr;

export function ok<T>(data: T, messageKey?: string): ActionOk<T> {
  return { ok: true, data, messageKey };
}

export function err(
  code: ErrorCode,
  messageKey: string,
  fieldErrors?: FieldErrors,
): ActionErr {
  return { ok: false, code, messageKey, fieldErrors };
}

/** Maps a thrown value onto the wire shape. Nothing else may do this. */
export function toActionResult(e: unknown): ActionErr {
  if (isAppError(e)) return err(e.code, e.message, e.fieldErrors);

  // An unexpected throw is a bug, not a user-facing condition. It is logged
  // with its stack and reported as a generic failure: an internal message could
  // carry a connection string or a row's contents into a rendered page.
  console.error('[unhandled]', e);
  return err('internal', 'errors.unexpected');
}

/**
 * The wrapper every Server Action's body goes through.
 *
 * Keeping the try/catch here rather than in each action is what makes "actions
 * contain no business logic" checkable: an action that needs its own catch
 * block is doing something a service should be doing.
 */
export async function runAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    return toActionResult(e);
  }
}

// ── Constructors for the conditions that recur ───────────────────────────

export const notFound = (entity: string) =>
  new AppError('not_found', 'errors.notFound', { meta: { entity } });

export const forbidden = (reason: string) =>
  new AppError('forbidden', 'errors.forbidden', { meta: { reason } });

export const unauthorized = () => new AppError('unauthorized', 'errors.unauthorized');

export const rateLimited = (retryAfterSeconds?: number) =>
  new AppError('rate_limited', 'errors.rateLimited', { meta: { retryAfterSeconds } });

export const conflict = (messageKey: string, fieldErrors?: FieldErrors) =>
  new AppError('conflict', messageKey, { fieldErrors });
