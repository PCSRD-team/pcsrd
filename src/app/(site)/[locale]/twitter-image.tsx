/**
 * The Twitter card is the Open Graph card. Re-exported rather than
 * duplicated so the two can never drift; `summary_large_image` uses the same
 * 1200×630 frame.
 */
export { default, contentType, generateImageMetadata, revalidate, size } from './opengraph-image';
