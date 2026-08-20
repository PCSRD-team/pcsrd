import Link from 'next/link';

/**
 * The 404.
 *
 * `not-found.tsx` cannot read `params`, so it does not know the locale. Both
 * languages are shown rather than guessing — and each block carries its own
 * `lang` and `dir`, so a screen reader announces each in the right voice
 * instead of reading Arabic with English phonemes.
 */
export default function NotFound() {
  return (
    <div className="container-content section-gap">
      <div className="rule-edge bg-paper p-8">
        <p className="eyebrow">404</p>

        <h1 className="mbs-4 text-h2 font-semibold text-ink" lang="ar" dir="rtl">
          الصفحة غير موجودة
        </h1>
        <p className="mbs-3 text-small text-ink-70" lang="ar" dir="rtl">
          قد يكون الرابط قديماً أو أن الصفحة أُزيلت.
        </p>
        <p className="mbs-4" lang="ar" dir="rtl">
          <Link href="/ar">الرئيسية</Link>
        </p>

        <hr className="mbs-8 border-bs border-rule" />

        <h2 className="mbs-8 text-h3 font-semibold text-ink" lang="en" dir="ltr">
          Page not found
        </h2>
        <p className="mbs-2 text-small text-ink-70" lang="en" dir="ltr">
          The link may be out of date, or the page may have been removed.
        </p>
        <p className="mbs-4" lang="en" dir="ltr">
          <Link href="/en">Home</Link>
        </p>
      </div>
    </div>
  );
}
