import { redirect } from 'next/navigation';
import { adminUi } from '@/components/admin/admin-ui-dict';
import { LoginForm } from '@/components/admin/login-form';
import { Panel } from '@/components/ui/card';
import { Container, PageHeader } from '@/components/ui/layout';
import { getCurrentProfile } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * The sign-in page: one paper panel on the ground, the page's `<h1>` with
 * the gold mark, and the form. Nothing else — there is no self-registration
 * and no marketing here.
 */
export default async function LoginPage() {
  // Someone already signed in who lands here has bookmarked the wrong page.
  const profile = await getCurrentProfile();
  if (profile?.isActive) redirect('/admin');

  const t = adminUi.login;

  return (
    <main id="main" className="flex min-h-screen items-center py-10">
      <Container size="narrow">
        <Panel tone="paper" padding="lg" className="mx-auto max-w-md">
          <PageHeader eyebrow={t.eyebrow} title={t.title} lede={t.lede} className="mbe-8" />
          <LoginForm />
        </Panel>
      </Container>
    </main>
  );
}
