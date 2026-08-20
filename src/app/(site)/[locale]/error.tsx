'use client';

/**
 * Route-group error boundary.
 *
 * A Client Component because React requires it — an error boundary needs
 * `componentDidCatch`, which has no server equivalent.
 *
 * The copy is passed in through neither props nor a dictionary: an error
 * boundary renders when something upstream already failed, so it cannot depend
 * on a fetch succeeding. Both languages are shown, which is the honest answer
 * when the locale itself may be what failed to resolve.
 */
export default function SiteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container-content section-gap">
      <div className="rule-edge border-gold-600 bg-gold-050 p-8">
        <h1 className="text-h2 font-semibold text-ink" lang="ar" dir="rtl">
          تعذّر عرض هذه الصفحة
        </h1>
        <p className="mbs-3 text-small text-ink-70" lang="ar" dir="rtl">
          حدث خطأ غير متوقّع. حاول مجدداً، وإن تكرّر فأخبرنا.
        </p>

        <hr className="mbs-6 border-bs border-rule" />

        <h2 className="mbs-6 text-h3 font-semibold text-ink" lang="en" dir="ltr">
          This page could not be shown
        </h2>
        <p className="mbs-2 text-small text-ink-70" lang="en" dir="ltr">
          Something went wrong. Please try again.
        </p>

        <button
          type="button"
          onClick={reset}
          className="mbs-8 bg-navy-700 px-6 py-3 text-small font-medium text-paper hover:bg-navy-900"
        >
          <span lang="ar" dir="rtl">
            إعادة المحاولة
          </span>
        </button>
      </div>
    </div>
  );
}
