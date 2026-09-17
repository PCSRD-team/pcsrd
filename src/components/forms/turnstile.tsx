'use client';

import Script from 'next/script';
import { Notice } from '@/components/ui/notice';
import { publicEnv } from '@/lib/env.public';
import type { FormDict } from './fields';

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
 * ## Without JavaScript — the decision
 *
 * The widget cannot render and no token is posted. 02-API §5.1 is explicit
 * that a missing or failed token is **rejected** (`fail('captcha', …)`), and
 * the action keeps that: it does not fall back to "rate limit + honeypot
 * only", because that would make disabling JavaScript the documented way
 * around the captcha on the one write path a stranger has. What degrades
 * instead is the *explanation*: the `<noscript>` block below renders where the
 * widget would, in the page's language, before the visitor types a word. The
 * fields still validate server-side on that path (the action validates before
 * it verifies), so a no-JavaScript visitor gets real field feedback and one
 * honest captcha message — never a silent discard.
 *
 * `live="off"` on that notice: it is page content, not a response to
 * anything the visitor did.
 */
export function Turnstile({ locale, dict }: { locale: 'ar' | 'en'; dict: FormDict }) {
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
      <noscript>
        <Notice tone="warning" live="off">
          {dict.formsUi.noScriptCaptcha}
        </Notice>
      </noscript>
    </>
  );
}
