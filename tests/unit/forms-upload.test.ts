import { describe, expect, it } from 'vitest';
import { MAX_UPLOAD_BYTES, storagePath, validateCvUpload } from '@/lib/security/upload';

/**
 * CV validation reads magic bytes, never the filename or the browser's
 * `Content-Type` — both are attacker-controlled. 06-BUILD-PLAN DoD: "the CV
 * upload rejects a `.exe` renamed to `.pdf`".
 */

function file(bytes: Uint8Array | Buffer, name: string, type: string): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

/** A PE executable: `MZ` DOS header, PE offset at 0x3C pointing at `PE\0\0`. */
function fakeExe(): Buffer {
  const buf = Buffer.alloc(512);
  buf.write('MZ', 0, 'ascii');
  buf.writeUInt32LE(0x80, 0x3c);
  buf.write('PE\0\0', 0x80, 'binary');
  return buf;
}

function fakePdf(): Buffer {
  return Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n', 'ascii');
}

describe('validateCvUpload', () => {
  it('rejects a .exe renamed to .pdf, whatever the declared type says', async () => {
    const result = await validateCvUpload(file(fakeExe(), 'cv.pdf', 'application/pdf'));
    expect(result).toEqual({ ok: false, reason: 'bad_type' });
  });

  it('accepts a real PDF and reports the sniffed type, not the filename', async () => {
    const result = await validateCvUpload(file(fakePdf(), 'anything.exe', 'application/octet-stream'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mime).toBe('application/pdf');
      expect(result.ext).toBe('pdf');
    }
  });

  it('rejects an empty file and one over the 4 MB cap before reading it', async () => {
    expect(await validateCvUpload(file(new Uint8Array(0), 'cv.pdf', 'application/pdf'))).toEqual({
      ok: false,
      reason: 'empty',
    });
    const big = Buffer.alloc(MAX_UPLOAD_BYTES + 1);
    big.write('%PDF-1.7', 0, 'ascii');
    expect(await validateCvUpload(file(big, 'cv.pdf', 'application/pdf'))).toEqual({
      ok: false,
      reason: 'too_large',
    });
  });

  it('rejects plain text with a document extension', async () => {
    const result = await validateCvUpload(
      file(Buffer.from('Curriculum vitae\n', 'utf8'), 'cv.docx', 'application/msword'),
    );
    expect(result).toEqual({ ok: false, reason: 'bad_type' });
  });
});

describe('storagePath', () => {
  it('never carries the original filename', () => {
    const path = storagePath('cv', 'pdf');
    expect(path).toMatch(/^cv\/[0-9a-f-]{36}\.pdf$/);
  });
});
