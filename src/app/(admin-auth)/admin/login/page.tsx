import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/admin/login-form';
import { getCurrentProfile } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  // Someone already signed in who lands here has bookmarked the wrong page.
  const profile = await getCurrentProfile();
  if (profile?.isActive) redirect('/admin');

  return (
    <main className="mx-auto flex min-h-screen max-w-[26rem] flex-col justify-center p-6">
      <div className="rule-edge bg-paper p-8">
        <p className="eyebrow">لوحة التحكم</p>
        <h1 className="mbs-3 text-h2 font-semibold text-ink">تسجيل الدخول</h1>
        <span className="rule-mark mbs-4 block" aria-hidden="true" />
        <div className="mbs-8">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
