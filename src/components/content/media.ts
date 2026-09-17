import type { ImageSource } from '@/components/ui/figure';
import { publicEnv } from '@/lib/env.public';
import { storageUrl } from '@/lib/format';

/**
 * Storage paths → `ImageSource` for the kit's `Figure` / `LogoTile`.
 *
 * Every public query returns a media *path* (and, when the pipeline produced
 * one, a blur placeholder); the public URL is assembled here, once, so no
 * route repeats the bucket name. A `null` path returns `null`, which the kit
 * renders as its designed no-image frame — the normal case at launch.
 */

export function mediaSrc(path: string, bucket = 'media'): string {
  return storageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, bucket, path);
}

export function mediaImage(
  path: string | null | undefined,
  blur?: string | null,
  dimensions?: { width?: number | null; height?: number | null } | null,
): ImageSource | null {
  if (!path) return null;
  return {
    src: mediaSrc(path),
    blurDataURL: blur ?? undefined,
    width: dimensions?.width ?? undefined,
    height: dimensions?.height ?? undefined,
  };
}
