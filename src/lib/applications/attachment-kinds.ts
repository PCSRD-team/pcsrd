/**
 * The file-type vocabulary, shared by the browser and the server.
 *
 * Separate from `./attachments.ts` for one concrete reason: that module
 * imports `file-type`, which imports `sharp`'s dependency tree through
 * `security/upload.ts`, and `sharp` is a native Node module. The public form is
 * a Client Component and renders an `accept` attribute, so importing the
 * constant from there dragged `detect-libc` — and `require('fs')` — into the
 * browser bundle and failed the build outright.
 *
 * Everything here is a plain value with no imports at all. The validation that
 * actually decides whether a file is acceptable stays server-side, where it
 * belongs: `accept` is a hint to the file picker and is trivially bypassed.
 */

export type AttachmentKind = 'document' | 'image' | 'any';

/**
 * What the `accept` attribute should say for each kind.
 *
 * Extensions rather than MIME types, deliberately. A browser matches both, but
 * a `.docx` uploaded from a phone often arrives with a generic or empty
 * `Content-Type`, and matching on that hides the file the applicant is trying
 * to attach behind a greyed-out picker.
 */
export const ACCEPT_ATTRIBUTE: Record<AttachmentKind, string> = {
  document: '.pdf,.doc,.docx,.rtf',
  image: '.jpg,.jpeg,.png,.webp,.avif',
  any: '.pdf,.doc,.docx,.rtf,.jpg,.jpeg,.png,.webp,.avif,.zip',
};
