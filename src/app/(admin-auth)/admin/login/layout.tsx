import { IBM_Plex_Mono, IBM_Plex_Sans_Arabic } from 'next/font/google';
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

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-arabic',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${plexArabic.variable} ${plexMono.variable} bg-paper-ground`}>
        {children}
      </body>
    </html>
  );
}
