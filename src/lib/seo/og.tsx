import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import { publicEnv } from '@/lib/env.public';
import { storageUrl } from '@/lib/format';
import type { Locale } from '@/lib/i18n/config';
import { hasArabic, shapeArabicWords } from './arabic-shaping';

/**
 * The one Open Graph card, rendered by every `opengraph-image.tsx`.
 *
 * Navy ground, paper text, a gold 2px rule as the only marking, radius 0, no
 * shadow — the design system at 1200×630. The organisation's name is a
 * parameter, never a string in this file (RULE 6).
 *
 * **Arabic.** Satori cannot lay out Arabic text on its own — it has no bidi
 * and measures letters in isolation (see `./arabic-shaping.ts` for the
 * evidence). Every line of text on the card is therefore rendered as one flex
 * item per word, pre-shaped into presentation forms, inside a `row-reverse`
 * wrapping row for Arabic and a `row` for English. That is the only layout
 * that produced correctly ordered, correctly spaced Arabic in the proof
 * render, and it is why this file does not contain a single multi-word text
 * node.
 *
 * **Fonts.** Satori needs the font as an `ArrayBuffer`, and it cannot read
 * WOFF2 — which is all `next/font` leaves on disk. The two WOFF files in
 * `src/assets/fonts/` (94 KB Arabic semibold, 52 KB mono medium, both under
 * the SIL OFL, see `OFL.txt` beside them) are read once at module scope with
 * `process.cwd()` so Next's file tracer bundles them into the serverless
 * function, exactly as the Next docs show for `opengraph-image`.
 */

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = 'image/png';

/** `programs.accent_token` → the hex the token resolves to in `globals.css`. */
const ACCENT_TOKENS: Record<string, string> = {
  '--color-prog-protection': '#254284',
  '--color-prog-response': '#B3591B',
  '--color-prog-recovery': '#1F6B54',
};

const COLOR = {
  navy: '#14213F',
  paper: '#FBFAF6',
  paperMuted: 'rgba(251, 250, 246, 0.72)',
  gold: '#DD991C',
} as const;

const FONT_DIR = join(process.cwd(), 'src/assets/fonts');

const toArrayBuffer = (buffer: Buffer): ArrayBuffer =>
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

/** Read once per process; every card after the first pays nothing. */
const fontsPromise = Promise.all([
  readFile(join(FONT_DIR, 'ibm-plex-sans-arabic-600.woff')),
  readFile(join(FONT_DIR, 'ibm-plex-mono-500.woff')),
]).then(([arabic, mono]) => [
  { name: 'IBM Plex Sans Arabic', data: toArrayBuffer(arabic), weight: 600 as const, style: 'normal' as const },
  { name: 'IBM Plex Mono', data: toArrayBuffer(mono), weight: 500 as const, style: 'normal' as const },
]);

export type OgImageInput = {
  /** The record title, or the site name for the default card. Wraps to three lines. */
  title: string;
  /** Small mono line above the title: a section name, a programme, a category. */
  eyebrow?: string | null;
  locale: Locale;
  /** From `organization_settings.short_name_*`, resolved for the locale. */
  siteName: string;
  /** A programme accent token (`--color-prog-*`) or a hex colour for the rule. Gold by default. */
  accent?: string | null;
};

/** Title length drives the size: a long headline drops a step rather than clipping. */
function titleFontSize(title: string): number {
  const length = title.length;
  if (length <= 36) return 76;
  if (length <= 64) return 62;
  if (length <= 96) return 50;
  return 42;
}

/** Keep a runaway headline to roughly three lines at the smallest size. */
function clampTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed.length > 140 ? `${trimmed.slice(0, 139).trimEnd()}…` : trimmed;
}

function resolveAccent(accent: string | null | undefined): string {
  if (!accent) return COLOR.gold;
  return ACCENT_TOKENS[accent] ?? (accent.startsWith('#') ? accent : COLOR.gold);
}

/**
 * One line of words as flex items. `row-reverse` for Arabic puts the first
 * word at the inline start (the right edge); wrapping keeps subsequent lines
 * in reading order because yoga wraps `row-reverse` top-to-bottom.
 */
function WordRow({
  text,
  fontSize,
  style,
}: {
  text: string;
  fontSize: number;
  style: Record<string, string | number>;
}) {
  // Decided per line, not per locale: an English card whose organisation name
  // has no English form still gets the Arabic name shaped and ordered.
  const rtl = hasArabic(text);
  const words = rtl ? shapeArabicWords(text) : text.split(/\s+/u).filter(Boolean);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: rtl ? 'row-reverse' : 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        columnGap: Math.round(fontSize * 0.28),
        rowGap: Math.round(fontSize * 0.18),
        fontSize,
        ...style,
      }}
    >
      {words.map((word, index) => (
        <div key={`${index}-${word}`} style={{ display: 'flex' }}>
          {word}
        </div>
      ))}
    </div>
  );
}

/**
 * Renders the card. Call it from an `opengraph-image.tsx` default export and
 * return the result; `OG_SIZE` and `OG_CONTENT_TYPE` are the matching
 * `size` / `contentType` exports.
 */
export async function renderOgImage(input: OgImageInput): Promise<ImageResponse> {
  const fonts = await fontsPromise;
  const rtl = input.locale === 'ar';
  const title = clampTitle(input.title);
  const eyebrow = input.eyebrow?.trim() || null;
  const accent = resolveAccent(input.accent);
  const fontSize = titleFontSize(title);

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: rtl ? 'flex-end' : 'flex-start',
          width: '100%',
          height: '100%',
          padding: 72,
          background: COLOR.navy,
          color: COLOR.paper,
          fontFamily: 'IBM Plex Sans Arabic',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: rtl ? 'flex-end' : 'flex-start',
            width: '100%',
          }}
        >
          {eyebrow ? (
            <WordRow
              text={hasArabic(eyebrow) ? eyebrow : eyebrow.toUpperCase()}
              fontSize={26}
              style={{
                fontFamily: 'IBM Plex Mono',
                color: COLOR.gold,
                letterSpacing: hasArabic(eyebrow) ? 0 : 2,
                marginBottom: 36,
                width: '100%',
              }}
            />
          ) : null}
          <WordRow
            text={title}
            fontSize={fontSize}
            style={{ lineHeight: 1.25, width: '100%', maxHeight: fontSize * 1.25 * 3 + 40, overflow: 'hidden' }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: rtl ? 'flex-end' : 'flex-start',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', width: 88, height: 2, background: accent, marginBottom: 20 }} />
          <WordRow
            text={input.siteName}
            fontSize={28}
            style={{ color: COLOR.paperMuted, width: '100%' }}
          />
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}

/**
 * Serves an editor-chosen card (`og_media_id`) in place of the rendered one.
 *
 * The stored image is fetched from public storage, cover-cropped to the
 * card's 1200×630 and re-encoded as PNG, so the `size` and `contentType`
 * exports of the route stay truthful whatever was uploaded. Returns `null`
 * when the object cannot be fetched, and the route falls back to
 * `renderOgImage` — a missing file must not produce a broken preview on a
 * site whose /verify page exists to counter impersonation.
 */
export async function serveStoredOgImage(media: {
  bucket: string;
  path: string;
}): Promise<Response | null> {
  try {
    const response = await fetch(storageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, media.bucket, media.path), {
      cache: 'force-cache',
    });
    if (!response.ok) return null;
    const png = await sharp(Buffer.from(await response.arrayBuffer()))
      .resize(OG_SIZE.width, OG_SIZE.height, { fit: 'cover', position: 'attention' })
      .png()
      .toBuffer();
    return new Response(new Uint8Array(png), {
      headers: {
        'content-type': OG_CONTENT_TYPE,
        'cache-control': 'public, max-age=0, must-revalidate',
      },
    });
  } catch (error) {
    console.warn('[og] stored card image unavailable, rendering the default card', error);
    return null;
  }
}
