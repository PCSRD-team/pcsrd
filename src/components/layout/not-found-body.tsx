import Link from 'next/link';
import { Panel, RuledList, RuledListItem } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Container } from '@/components/ui/layout';
import { Eyebrow } from '@/components/ui/typography';

/**
 * The body of the 404, shared by the two places that can render one.
 *
 * `not-found.tsx` cannot read `params`, so it does not know the locale and
 * cannot open a dictionary. Both languages are shown rather than guessing —
 * and each block carries its own `lang` and `dir`, so a screen reader
 * announces each in the right voice instead of reading Arabic with English
 * phonemes. This is the one page whose copy lives in code, for that reason.
 *
 * It is a component rather than a page because the two callers need different
 * wrappers: the locale route's 404 renders inside a layout that already emits
 * `<html>` and the site chrome, while the app-level 404 has no layout above it
 * at all and must emit its own document.
 */
const COPY = {
  ar: {
    title: 'الصفحة غير موجودة',
    body: 'قد يكون الرابط قديماً أو أن الصفحة أُزيلت.',
    links: [
      { label: 'الرئيسية', href: '/ar' },
      { label: 'من نحن', href: '/ar/about' },
      { label: 'قنواتنا الرسمية', href: '/ar/verify' },
      { label: 'تواصل معنا', href: '/ar/contact' },
    ],
  },
  en: {
    title: 'Page not found',
    body: 'The link may be out of date, or the page may have been removed.',
    links: [
      { label: 'Home', href: '/en' },
      { label: 'About', href: '/en/about' },
      { label: 'Official channels', href: '/en/verify' },
      { label: 'Contact', href: '/en/contact' },
    ],
  },
} as const;

function NotFoundBlock({ locale, heading: Heading }: { locale: 'ar' | 'en'; heading: 'h1' | 'h2' }) {
  const copy = COPY[locale];
  return (
    <div lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <Heading
        className={
          Heading === 'h1' ? 'text-h2 font-semibold text-ink' : 'text-h3 font-semibold text-ink'
        }
      >
        {copy.title}
      </Heading>
      <p className="mbs-2 text-small text-ink-70">{copy.body}</p>
      <RuledList className="mbs-4">
        {copy.links.map((link) => (
          <RuledListItem key={link.href} className="py-0">
            <Link
              href={link.href}
              className="inline-flex min-h-target items-center gap-2 no-underline hover:underline"
            >
              {link.label}
              <Icon name="arrow" size={16} />
            </Link>
          </RuledListItem>
        ))}
      </RuledList>
    </div>
  );
}

export function NotFoundBody() {
  return (
    <Container size="narrow" className="section-gap">
      <Panel padding="lg" className="rule-section">
        <Eyebrow as="p" className="mbe-4">
          <span dir="ltr">404</span>
        </Eyebrow>
        <div className="grid gap-10 md:grid-cols-2">
          <NotFoundBlock locale="ar" heading="h1" />
          <NotFoundBlock locale="en" heading="h2" />
        </div>
      </Panel>
    </Container>
  );
}
