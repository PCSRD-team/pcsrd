'use client';

import { useActionState } from 'react';
import { type AuthResult, signIn } from '@/actions/admin/auth';

/**
 * The sign-in form.
 *
 * A Client Component for `useActionState`, and it still submits natively before
 * hydration. The error message is deliberately the same for a wrong password
 * and an unknown address — see `signIn`.
 */
const MESSAGES: Record<string, string> = {
  'admin.auth.invalid': 'بيانات الدخول غير صحيحة.',
  'admin.auth.deactivated': 'هذا الحساب موقوف. راجع مدير النظام.',
  'errors.validation': 'أدخل البريد الإلكتروني وكلمة المرور.',
  'errors.unexpected': 'حدث خطأ غير متوقّع. حاول مجدداً.',
};

const controlClass =
  'block min-h-12 w-full rounded-xl border border-rule bg-paper-alt/45 px-4 py-3 text-small text-ink outline-none transition-[border-color,box-shadow,background-color] placeholder:text-ink-55/55 hover:border-navy-700/45 focus:border-navy-700 focus:bg-paper focus:shadow-[0_0_0_4px_rgba(37,66,132,0.12)]';

export function LoginForm() {
  const [state, formAction, pending] = useActionState<AuthResult | null, FormData>(signIn, null);

  return (
    <form action={formAction} className="space-y-5">
      {state && !state.ok ? (
        <div
          className="rounded-xl border border-gold-600/40 bg-gold-050 p-4"
          role="alert"
        >
          <p className="text-small text-ink">
            {MESSAGES[state.messageKey] ?? MESSAGES['errors.unexpected']}
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="email" className="block text-small font-medium text-ink">
          البريد الإلكتروني
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          dir="ltr"
          placeholder="name@example.com"
          className={`${controlClass} text-start`}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="block text-small font-medium text-ink">
          كلمة المرور
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          dir="ltr"
          placeholder="••••••••"
          className={`${controlClass} text-start`}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-xl bg-navy-700 px-6 py-3 text-small font-semibold text-paper shadow-[0_10px_24px_rgba(37,66,132,0.22)] transition-[transform,background-color,box-shadow] hover:-translate-y-0.5 hover:bg-navy-900 hover:shadow-[0_14px_28px_rgba(24,46,93,0.26)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold-600/35 active:translate-y-0 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
      >
        {pending ? 'جارٍ الدخول…' : 'دخول'}
      </button>

      <p className="flex items-center justify-center gap-2 text-caption text-ink-55">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="size-4 text-gold-700"
        >
          <path d="M12 3 5 6v5c0 4.6 2.8 8.1 7 10 4.2-1.9 7-5.4 7-10V6l-7-3Z" />
          <path d="m9.5 12 1.7 1.7 3.6-4" />
        </svg>
        دخول آمن ومخصّص للمستخدمين المصرّح لهم
      </p>
    </form>
  );
}
