import { fontVariables } from '@/app/fonts';
import '../../../globals.css';

/**
 * The login page's own root layout.
 *
 * Separate from `(admin)` so `requireAuth()` in that layout cannot redirect
 * this page to itself. Same fonts, same tokens, no shell and no guard.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'تسجيل الدخول — لوحة التحكم',
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${fontVariables} bg-paper-ground antialiased`}>
        {children}
      </body>
    </html>
  );
}
