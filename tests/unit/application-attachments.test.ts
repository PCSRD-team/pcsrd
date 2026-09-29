import { describe, expect, it, vi } from 'vitest';

// `server-only` throws outside a React Server Component build; the module under
// test is server code and this is a server-side test.
vi.mock('server-only', () => ({}));

const { validateAttachment } = await import('@/lib/applications/attachments');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const RTF = Buffer.from('{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Arial;}} Hello}');

const file = (bytes: Buffer, name: string) => new File([new Uint8Array(bytes)], name);

describe('validateAttachment', () => {
  it('accepts an RTF document, which file-type cannot sniff', async () => {
    await expect(validateAttachment(file(RTF, 'cv.rtf'), 'document')).resolves.toEqual({
      ok: true,
      mime: 'application/rtf',
      ext: 'rtf',
    });
  });

  it('accepts a photographed document under `scan`, and refuses it under `document`', async () => {
    await expect(validateAttachment(file(PNG, 'id.png'), 'scan')).resolves.toMatchObject({
      ok: true,
      mime: 'image/png',
    });
    await expect(validateAttachment(file(PNG, 'id.png'), 'document')).resolves.toEqual({
      ok: false,
      reason: 'bad_type',
    });
  });

  it('accepts a PDF under `scan` as well', async () => {
    await expect(validateAttachment(file(PDF, 'id.pdf'), 'scan')).resolves.toMatchObject({
      ok: true,
      mime: 'application/pdf',
    });
  });

  it('does not trust the filename: a text file named .pdf is refused', async () => {
    await expect(
      validateAttachment(file(Buffer.from('not a pdf at all'), 'cv.pdf'), 'document'),
    ).resolves.toEqual({ ok: false, reason: 'bad_type' });
  });
});
