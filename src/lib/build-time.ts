/**
 * Data a build would like to have, but must not depend on.
 *
 * `generateStaticParams`, the sitemap and the feed all query the database while
 * the site is being built. A build is not a request: it runs in CI, where there
 * is no database at all, and on Vercel, where there is one but it can be
 * unreachable for a few seconds. In both cases an unhandled rejection here
 * fails the **entire build**, which meant:
 *
 *   Error: Failed to collect page data for /[locale]/projects/[slug]
 *
 * and, in CI, that the service-role-leak assertion — the check
 * `00-ARCHITECTURE §0.9 rule 10` calls a total compromise if it fails — never
 * ran, because it is a later step in the same job.
 *
 * Degrading to an empty list is safe here, and specifically here. `dynamicParams`
 * is not set anywhere in the app and defaults to `true`, so a slug that was not
 * pre-rendered is rendered on demand at first request and cached from then on.
 * The cost of the fallback is a cold first hit on each page; the cost of the
 * alternative is a failed deploy. For a sitemap or a feed the same reasoning
 * holds even more plainly: `revalidate = 3600` means a thin document is
 * replaced within the hour.
 *
 * It warns rather than staying silent. An empty sitemap in production is not a
 * crisis, but it is also not something anyone should discover from Search
 * Console three weeks later.
 *
 * This is **not** a general-purpose error swallower. Use it only where an empty
 * result is a correct, self-healing answer — never on a request path, where an
 * empty list is a lie told to a visitor.
 */
export async function prerenderData<T>(label: string, load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch (error) {
    console.warn(
      `[build] ${label}: the database was unreachable during prerender, ` +
        `continuing with an empty result. Pages will render on demand instead.\n` +
        `  ${error instanceof Error ? error.message : String(error)}`,
    );
    return fallback;
  }
}
