import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/admin/login-form';
import { getCurrentProfile } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  // Someone already signed in who lands here has bookmarked the wrong page.
  const profile = await getCurrentProfile();
  if (profile?.isActive) redirect('/admin');

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      <div
        className="absolute inset-0 -z-20 bg-[linear-gradient(145deg,#f7f3e9_0%,#eef1f7_52%,#f8f5ed_100%)]"
        aria-hidden="true"
      />
      <div
        className="absolute -start-28 -inset-bs-28 -z-10 size-80 rounded-full bg-gold-600/15 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute -inset-be-36 -end-24 -z-10 size-96 rounded-full bg-navy-700/15 blur-3xl"
        aria-hidden="true"
      />

      <div className="w-full max-w-[28rem] overflow-hidden rounded-3xl border border-paper bg-paper/95 shadow-[0_28px_80px_rgba(24,46,93,0.16)] backdrop-blur-sm">
        <div className="p-7 sm:p-10">
          <div className="flex flex-col items-center text-center">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-navy-700 text-paper shadow-[0_12px_30px_rgba(37,66,132,0.25)]">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="size-8"
              >
                <rect x="5" y="10" width="14" height="10" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" />
              </svg>
            </span>
            <p className="mbs-5 text-caption font-semibold tracking-wide text-gold-700">
              لوحة تحكم PCSRD
            </p>
            <h1 className="mbs-2 text-h2 font-semibold text-navy-900">
              أهلاً بعودتك
            </h1>
            <p className="max-w-xs text-small leading-relaxed text-ink-55">
              سجّل الدخول لإدارة محتوى الموقع والصفحات.
            </p>
          </div>

          <div className="mbs-8">
          <LoginForm />
          </div>
        </div>
      </div>
    </main>
  );
}
