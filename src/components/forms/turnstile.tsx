'use client';

import { useEffect, useRef } from 'react';
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
 * ## Explicit rendering — why not the `cf-turnstile` class
 *
 * Implicit rendering scans the document for `.cf-turnstile` **once**, when the
 * script first loads. After a client-side navigation from one form page to
 * another the script is already there, nothing scans again, the new container
 * stays empty, no token is posted — and every submission is refused as a
 * failed captcha. So the script is loaded with `render=explicit`, once per
 * page lifetime, and each mount renders its own widget into its own ref and
 * removes it on unmount. The widget still injects its hidden input under the
 * default name `cf-turnstile-response`, which is what the actions read.
 *
 * ## Resetting after a refusal
 *
 * A token is single-use: Cloudflare rejects one it has already verified. When
 * the action verified the token and then refused for another reason (rate
 * limit, captcha, an unexpected failure), resubmitting the same token is
 * certain to fail. `resetKey` changes on every such refusal and the widget is
 * reset, so the next submit carries a fresh token.
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

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: { sitekey: string; language?: string; theme?: 'light' | 'dark' | 'auto' },
  ) => string | undefined;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptLoad: Promise<TurnstileApi> | null = null;

/** Loads the API once per page lifetime; later mounts reuse the same promise. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptLoad) {
    scriptLoad = new Promise<TurnstileApi>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () =>
        window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile'));
      script.onerror = () => {
        // A failed load (a filtered connection) may succeed on the next mount.
        scriptLoad = null;
        script.remove();
        reject(new Error('turnstile'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptLoad;
}

export function Turnstile({
  locale,
  dict,
  resetKey,
}: {
  locale: 'ar' | 'en';
  dict: FormDict;
  /** Changes whenever the token must be replaced — after a refused submission. */
  resetKey?: unknown;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        const container = containerRef.current;
        if (cancelled || !container) return;
        widgetRef.current =
          api.render(container, {
            sitekey: publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
            language: locale,
            theme: 'light',
          }) ?? null;
      })
      .catch(() => {
        // Nothing to render; the action refuses the submission with the
        // captcha message, which is the honest outcome.
      });

    return () => {
      cancelled = true;
      const id = widgetRef.current;
      widgetRef.current = null;
      if (id) window.turnstile?.remove(id);
    };
  }, [locale]);

  // Skip the first run: a fresh widget needs no reset.
  const firstReset = useRef(true);
  useEffect(() => {
    if (firstReset.current) {
      firstReset.current = false;
      return;
    }
    const id = widgetRef.current;
    if (id) window.turnstile?.reset(id);
  }, [resetKey]);

  return (
    <>
      {/* The class is a hook for the e2e and axe specs only: with
          `render=explicit` the script never scans for it. */}
      <div ref={containerRef} className="cf-turnstile" />
      <noscript>
        <Notice tone="warning" live="off">
          {dict.formsUi.noScriptCaptcha}
        </Notice>
      </noscript>
    </>
  );
}
