'use client';

import Script from 'next/script';
import { publicEnv } from '@/lib/env.public';

/**
 * The Turnstile widget.
 *
 * This is the **only** third-party script on the site, and it is the documented
 * exception to the no-third-party-scripts rule: the six public forms are the
 * one place an unauthenticated stranger can write to the database, and the CSP
 * in `next.config.ts` allows exactly this origin and no other.
 *
 * `strategy="lazyOnload"` because the widget is not needed until someone starts
 * filling in a form, and the pages carrying forms are also the pages a
 * beneficiary on a slow connection is most likely to open.
 *
 * With JavaScript disabled the widget never renders and no token is posted. The
 * action then fails the captcha check rather than accepting the submission —
 * failing closed. That is a real limitation of the no-JS path, and the right
 * trade: the alternative is an unprotected write endpoint.
 */
export function Turnstile({ locale }: { locale: 'ar' | 'en' }) {
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="lazyOnload"
      />
      <div
        className="cf-turnstile"
        data-sitekey={publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
        data-language={locale}
        data-theme="light"
      />
    </>
  );
}
