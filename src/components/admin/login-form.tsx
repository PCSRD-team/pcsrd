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
  'block w-full rule-control bg-paper px-4 py-3 text-small text-ink focus:border-navy-700';

export function LoginForm() {
  const [state, formAction, pending] = useActionState<AuthResult | null, FormData>(signIn, null);

  return (
    <form action={formAction} className="space-y-5">
      {state && !state.ok ? (
        <div className="rule-edge border-gold-600 bg-gold-050 p-4" role="alert">
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
          className={`${controlClass} text-start`}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-navy-700 px-6 py-3 text-small font-medium text-paper hover:bg-navy-900 disabled:opacity-60"
      >
        {pending ? 'جارٍ الدخول…' : 'دخول'}
      </button>
    </form>
  );
}
