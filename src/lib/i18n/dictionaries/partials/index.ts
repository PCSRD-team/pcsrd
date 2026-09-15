import { admin_uiAr, admin_uiEn } from './admin-ui';
import { forms_uiAr, forms_uiEn } from './forms-ui';
import { site_contentAr, site_contentEn } from './site-content';
import { site_coreAr, site_coreEn } from './site-core';

/**
 * Every partial, merged. Namespaces must not collide with each other or with
 * the root dictionaries — a collision would be silently last-wins, so the
 * root files spread these *first* and their own namespaces after.
 */
export const partialsAr = {
  ...site_coreAr,
  ...site_contentAr,
  ...admin_uiAr,
  ...forms_uiAr,
};

export const partialsEn = {
  ...site_coreEn,
  ...site_contentEn,
  ...admin_uiEn,
  ...forms_uiEn,
};
