import 'server-only';
import { fileTypeFromBuffer } from 'file-type';
import { MAX_UPLOAD_BYTES, type UploadRejection } from '@/lib/security/upload';
import { type AttachmentKind, ACCEPT_ATTRIBUTE } from './attachment-kinds';

/**
 * Attachment validation for the careers portal.
 *
 * `security/upload.ts` validates exactly one thing — a CV — because until now
 * exactly one thing could be uploaded by the public. A form built in the admin
 * can ask for a CV, a cover letter, certificates, an ID copy and a portfolio,
 * and the answer to "is this file acceptable" now depends on which field it
 * arrived in.
 *
 * Everything else is unchanged from `validateCvUpload`, and deliberately so:
 *
 * - **Magic bytes, never the filename or the browser's `Content-Type`.** Both
 *   are attacker-controlled; the first few kilobytes of the file are not.
 * - **The 4 MB cap**, imported rather than restated, so it moves in one place.
 * - **`.doc` needs its special case.** It is a compound OLE container and
 *   `file-type` reports it as `application/x-cfb`, which is correct and is not
 *   what any allow-list names. That is the one place the filename is consulted,
 *   and only to *narrow* an already-sniffed container type — a `.pdf`
 *   extension on a Windows executable still sniffs as
 *   `application/x-msdownload` and is refused.
 *
 * The `any` bucket is not "anything". It is documents plus images plus the
 * archive formats a portfolio realistically arrives as. There is no path here
 * that accepts an arbitrary byte stream, because a private bucket full of
 * unknown formats served back to staff browsers is how an upload field becomes
 * a delivery mechanism.
 *
 * **`server-only`, and that import is load-bearing.** `file-type` reaches
 * `sharp` through `security/upload.ts`, and `sharp` is a native module — the
 * public form is a Client Component, and importing anything from here put
 * `require('fs')` in the browser bundle and broke the build. The one thing the
 * browser needs, the `accept` attribute, lives in `./attachment-kinds.ts`,
 * which has no imports at all. This directive turns the same mistake into an
 * immediate error rather than a build failure three files away.
 */

export type { AttachmentKind };

const DOCUMENT_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/rtf',
]);

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

/**
 * Archives, for a portfolio. Accepted only under `any`, and never unpacked —
 * they are stored and handed back to a reviewer as an opaque download.
 */
const ARCHIVE_MIME = new Set(['application/zip']);

const ALLOWED: Record<AttachmentKind, ReadonlySet<string>> = {
  document: DOCUMENT_MIME,
  image: IMAGE_MIME,
  any: new Set([...DOCUMENT_MIME, ...IMAGE_MIME, ...ARCHIVE_MIME]),
};

/** Re-exported so a server caller needs one import, not two. */
export { ACCEPT_ATTRIBUTE };

export type AttachmentResult =
  | { ok: true; mime: string; ext: string }
  | { ok: false; reason: UploadRejection };

export async function validateAttachment(
  file: File,
  kind: AttachmentKind,
): Promise<AttachmentResult> {
  if (file.size === 0) return { ok: false, reason: 'empty' };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, reason: 'too_large' };

  // Only the head is needed to identify a format, and reading 4 KB instead of
  // four megabytes keeps a rejected upload cheap. The full bytes are read once,
  // by the caller, and only for a file that passed.
  const head = Buffer.from(await file.slice(0, 4100).arrayBuffer());
  const sniffed = await fileTypeFromBuffer(head);

  const isLegacyDoc =
    sniffed?.mime === 'application/x-cfb' && file.name.toLowerCase().endsWith('.doc');
  const mime = isLegacyDoc ? 'application/msword' : sniffed?.mime;

  if (!mime || !ALLOWED[kind].has(mime)) return { ok: false, reason: 'bad_type' };

  // The stored extension follows the sniffed type, never the upload's name.
  return { ok: true, mime, ext: isLegacyDoc ? 'doc' : (sniffed?.ext ?? 'bin') };
}
