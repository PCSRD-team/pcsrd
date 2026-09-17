export { default, contentType, generateImageMetadata, size } from './opengraph-image';

// Declared here rather than re-exported: Next only reads a route segment's
// config from a literal export in the segment's own file, and warns that a
// re-exported `revalidate` is ignored.
export const revalidate = 3600;
