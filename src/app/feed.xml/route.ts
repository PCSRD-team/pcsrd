import { listFeedPosts, getOrganization } from '@/db/queries/content';
import { publicEnv } from '@/lib/env.public';
import { prerenderData } from '@/lib/build-time';

/**
 * The news feed. Arabic, latest twenty published posts.
 *
 * Arabic only, deliberately: a feed reader subscribes once, and offering two
 * feeds for the same newsroom splits the subscriber list for no benefit on a
 * site whose source language is Arabic. An English feed would also have to
 * skip every `ar_only` post, which at launch is most of them, and a feed
 * that is mostly empty is worse than none.
 *
 * `guid` is the canonical Arabic URL with `isPermaLink="true"`, so a reader
 * that already has the item does not show it again after a title edit.
 * `<language>` is `ar`; `lastBuildDate` is the newest item's date, not the
 * render time, so an unchanged feed stays byte-identical across revalidations.
 */
export const revalidate = 3600;

const BASE = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');

/** XML escaping. Post titles are editor input and reach this file unrendered. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const [posts, org] = await Promise.all([
    prerenderData('feed posts', () => listFeedPosts(20), []),
    prerenderData('feed organisation', () => getOrganization('ar'), null),
  ]);

  const newest = posts[0]?.publishedAt ?? null;

  const items = posts
    .map((post) => {
      const url = `${BASE}/ar/news/${post.slugAr}`;
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      ${post.publishedAt ? `<pubDate>${post.publishedAt.toUTCString()}</pubDate>` : ''}
      <category>${escapeXml(post.category)}</category>
      ${post.excerpt ? `<description>${escapeXml(post.excerpt)}</description>` : ''}
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(org?.legalNameAr ?? org?.acronym ?? '')}</title>
    <link>${BASE}/ar/news</link>
    <language>ar</language>
    <description>${escapeXml(org?.missionAr ?? '')}</description>
    ${newest ? `<lastBuildDate>${newest.toUTCString()}</lastBuildDate>` : ''}
    <ttl>60</ttl>
    <atom:link href="${BASE}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
