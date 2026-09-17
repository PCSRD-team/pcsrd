'use client';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/feedback';
import { Container } from '@/components/ui/layout';

/**
 * Route-group error boundary.
 *
 * **A Client Component because React requires it** — an error boundary needs
 * `componentDidCatch`, which has no server equivalent. It is the only client
 * file among the core routes.
 *
 * The copy is passed in through neither props nor a dictionary: an error
 * boundary renders when something upstream already failed, so it cannot depend
 * on a fetch succeeding. Both languages are shown, which is the honest answer
 * when the locale itself may be what failed to resolve.
 */
export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Container size="narrow" className="section-gap">
      <div className="grid gap-6 md:grid-cols-2">
        <div lang="ar" dir="rtl">
          <ErrorState
            title="تعذّر عرض هذه الصفحة"
            body="حدث خطأ غير متوقّع. حاول مجدداً، وإن تكرّر فأخبرنا."
            reference={error.digest ?? null}
            referenceLabel="رقم المرجع"
            action={
              <Button type="button" onClick={reset}>
                إعادة المحاولة
              </Button>
            }
          />
        </div>
        <div lang="en" dir="ltr">
          <ErrorState
            title="This page could not be shown"
            body="Something went wrong. Please try again, and let us know if it keeps happening."
            reference={error.digest ?? null}
            referenceLabel="Reference"
            action={
              <Button type="button" onClick={reset} tone="secondary">
                Try again
              </Button>
            }
          />
        </div>
      </div>
    </Container>
  );
}
