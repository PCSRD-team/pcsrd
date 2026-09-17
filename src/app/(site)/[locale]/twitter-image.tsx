/**
 * The Twitter card is the Open Graph card. Re-exported rather than
 * duplicated so the two can never drift; `summary_large_image` uses the same
 * 1200×630 frame.
 */
export { default, contentType, generateImageMetadata, size } from './opengraph-image';

// Declared here rather than re-exported: Next only reads a route segment's
// config from a literal export in the segment's own file, and warns that a
// re-exported `revalidate` is ignored.
export const revalidate = 3600;
