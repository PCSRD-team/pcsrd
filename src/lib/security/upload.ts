import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';

/**
 * Upload validation and image processing (02-API §5.4).
 *
 * **The cap is 4 MB, not the spec's 5/10 MB.** Vercel's request body limit is
 * 4.5 MB, so a larger file is rejected with an opaque 413 by the platform
 * *before* any of this code runs — the user sees a network error instead of a
 * sentence telling them the file is too big. Rejecting at 4 MB means the
 * message always comes from us. `next.config.ts` raises the Server Action body
 * limit to match; the bucket-level `file_size_limit` is a second wall behind
 * this one, not the primary check.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const CV_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const IMAGE_EXT = new Set(['jpg', 'png', 'webp', 'avif']);

export type UploadRejection = 'too_large' | 'bad_type' | 'empty' | 'unreadable';

export type CvUpload =
  | { ok: true; buffer: Buffer; mime: string; ext: string }
  | { ok: false; reason: UploadRejection };

/**
 * Validates a CV by **magic bytes**, never by filename or the browser-supplied
 * `Content-Type`. Both are attacker-controlled; the first 4 KB of the file are
 * not.
 */
export async function validateCvUpload(file: File): Promise<CvUpload> {
  if (file.size === 0) return { ok: false, reason: 'empty' };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, reason: 'too_large' };

  const buffer = Buffer.from(await file.arrayBuffer());
  const sniffed = await fileTypeFromBuffer(buffer);

  // .doc is a compound OLE container; file-type reports it as
  // application/x-cfb, which is correct but not what the allow-list names.
  //
  // That is the one place the filename is consulted, and only to *narrow* an
  // already-sniffed container type — a `.pdf` extension on a PE executable
  // (`MZ…`) still sniffs as `application/x-msdownload` and is refused.
  const isLegacyDoc =
    sniffed?.mime === 'application/x-cfb' && file.name.toLowerCase().endsWith('.doc');
  const mime = isLegacyDoc ? 'application/msword' : sniffed?.mime;

  if (!mime || !CV_MIME.has(mime)) return { ok: false, reason: 'bad_type' };
  // The stored extension follows the sniffed type, never the upload's name.
  return { ok: true, buffer, mime, ext: isLegacyDoc ? 'doc' : (sniffed?.ext ?? 'bin') };
}

export type ImageUpload =
  | {
      ok: true;
      buffer: Buffer;
      mime: 'image/webp';
      width: number | null;
      height: number | null;
      blurDataUrl: string;
      exifStripped: true;
    }
  | { ok: false; reason: UploadRejection };

/**
 * Normalises an image to WebP and strips **all** metadata — DNH-1.
 *
 * `.rotate()` applies the EXIF orientation and then discards the tag, so the
 * picture stays the right way up while the camera model, the timestamp and the
 * GPS coordinates do not survive. sharp drops metadata unless `withMetadata()`
 * is called, which is why it never is.
 */
export async function processImageUpload(file: File): Promise<ImageUpload> {
  if (file.size === 0) return { ok: false, reason: 'empty' };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, reason: 'too_large' };

  const input = Buffer.from(await file.arrayBuffer());
  const sniffed = await fileTypeFromBuffer(input);
  if (!sniffed || !IMAGE_EXT.has(sniffed.ext)) return { ok: false, reason: 'bad_type' };

  try {
    const image = sharp(input, { failOn: 'error' });
    const meta = await image.metadata();
    const buffer = await image.rotate().webp({ quality: 82 }).toBuffer();

    const blur = (await sharp(buffer).resize(16).webp({ quality: 40 }).toBuffer()).toString(
      'base64',
    );

    return {
      ok: true,
      buffer,
      mime: 'image/webp',
      width: meta.width ?? null,
      height: meta.height ?? null,
      blurDataUrl: `data:image/webp;base64,${blur}`,
      exifStripped: true,
    };
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
}

/**
 * Storage object path.
 *
 * The original filename never appears: it can carry the applicant's full name,
 * and a public bucket path is effectively public information. A UUID carries
 * nothing.
 */
export function storagePath(prefix: string, ext: string): string {
  return `${prefix}/${crypto.randomUUID()}.${ext}`;
}
