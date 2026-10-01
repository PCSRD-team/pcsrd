'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { buttonClasses } from '@/components/ui/button';

/**
 * A small "copy" beside an IBAN or an account number.
 *
 * **A Client Component, and the reason is the clipboard.** Writing to it is
 * script, and nothing else on the donate page needs any. It is a courtesy
 * on top of a value that is already selectable text: a donor copying a
 * 29-character IBAN by eye is where a transfer goes to the wrong account, so
 * one press that copies it exactly is worth the few hundred bytes.
 *
 * **Nothing is rendered until the browser can actually copy.** The server
 * snapshot is `false`, so the HTML carries no button — without JavaScript, or
 * where the Clipboard API is missing (an insecure origin, an old WebView), a
 * visitor never meets a control that does nothing. The value beside it stays
 * selectable either way.
 *
 * The confirmation is announced through a polite live region beside the
 * button, so a screen-reader user hears "copied" without focus moving; the
 * button's own name stays "copy IBAN" and never changes under them.
 */

const subscribe = () => () => {};
const canCopy = () => typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.writeText);
const cannotCopyOnServer = () => false;

export function CopyButton({
  value,
  label,
  ariaLabel,
  copiedLabel,
}: {
  /** Exactly what lands on the clipboard — the IBAN without its display spaces. */
  value: string;
  label: string;
  /** Names what is copied ("Copy IBAN"); the visible label is one word. */
  ariaLabel: string;
  copiedLabel: string;
}) {
  const available = useSyncExternalStore(subscribe, canCopy, cannotCopyOnServer);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!available) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      // Permission refused: the value is still on screen to select by hand,
      // and saying "copied" when it was not would be the one wrong answer.
      setCopied(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={ariaLabel}
        className={buttonClasses({ tone: 'quiet', size: 'sm', className: 'shrink-0 rule-edge' })}
      >
        {copied ? copiedLabel : label}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? copiedLabel : ''}
      </span>
    </>
  );
}
