/**
 * `requireConsent` on a form renders and requires this, even with no such row.
 *
 * Its own import-free module because the portal form is a Client Component:
 * reading it from `./answer-schema` pulled Zod into the browser bundle for one
 * string. `./answer-schema` re-exports it for server code.
 */
export const CONSENT_FIELD_KEY = 'data_processing_consent';
