'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Panel } from './card';
import { Caption, Heading } from './typography';

/**
 * The modal surface.
 *
 * **Why a `Dialog` and not `role`/`modal` props on `Panel`.** `Panel` is a
 * *surface*: an edge, a ground and a padding step. A modal is not a surface
 * variant — it is a backdrop, a scroll container, a stacking context, a
 * heading that is also the accessible name, and a close control. Handing
 * `Panel` a `role="dialog"` prop would have let any call site declare
 * modality while supplying none of that, and the failure mode is silent: an
 * unnamed dialog that a screen reader announces as "dialog", a body that
 * cannot scroll on a phone, and a stack order that depends on where the
 * panel happens to sit in the tree. `title` being required here is the whole
 * argument — it is the one thing a hand-rolled wrapper forgets.
 *
 * **No `<dialog>` element.** `showModal()` is script, and the admin's forms
 * must survive without it; a `<dialog>` rendered in the markup without
 * `showModal()` is inert and closed, so the content would simply not appear.
 * This is ordinary markup the caller renders conditionally, which is what
 * every caller here already does with `useState`.
 *
 * **Why this is a Client Component** — the kit's one standing exception, and
 * non-negotiable #1 wants the reason stated. This file used to document a
 * contract instead: "a caller that opens a dialog owns three things: moving
 * focus in, Escape, and returning focus to the trigger." Its only caller
 * implemented one of the three. With `aria-modal="true"` set, that meant a
 * screen-reader user's virtual cursor was confined to the dialog while
 * keyboard focus stayed on the trigger behind it — Tab then walked a subtree
 * assistive technology had been told was inert. WCAG 2.4.3, failed by a
 * component whose own comment said whose job it was.
 *
 * A contract that its only caller does not meet is not a contract, it is a
 * bug with documentation. Focus containment needs a ref, a keydown listener
 * and a restore-on-close, so it needs a client boundary — and a modal is
 * never server-only anyway, because something has to open and close it.
 */

/**
 * Tabbable descendants, in document order.
 *
 * `:not([disabled])` and the `tabindex="-1"` exclusion matter: a disabled
 * submit button and a programmatically-focusable container are both focusable
 * in some sense and neither is a Tab stop, so including them makes the cycle
 * land somewhere the user cannot see a focus ring.
 */
const TABBABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function tabbableWithin(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

const styles = {
  backdrop: 'fixed inset-0 z-[100] flex items-center justify-center bg-navy-900/60 p-4',
  box: 'max-h-[90vh] w-full overflow-y-auto',
  size: {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-5xl',
  },
};

export function Dialog({
  title,
  titleId,
  description,
  close,
  children,
  onDismiss,
  size = 'lg',
  className,
}: {
  /** The visible heading, and the dialog's accessible name. */
  title: string;
  /** The heading's id. The caller owns it so two dialogs on one page cannot collide. */
  titleId: string;
  /** A line under the heading — what a choice here will do. */
  description?: ReactNode;
  /** The close control, on the inline-end of the heading row. An `IconButton`, normally. */
  close?: ReactNode;
  children: ReactNode;
  /**
   * Pressing the backdrop itself, or Escape. Omit for a dialog that may only
   * be closed from its own controls — a destructive confirmation, say. A
   * dialog with no `onDismiss` still traps focus and still restores it; it
   * simply has no dismissal gesture.
   */
  onDismiss?: () => void;
  size?: keyof typeof styles.size;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  // Read once, on mount. Reading it at close time would find whatever the
  // dialog itself last focused.
  const returnTo = useRef<HTMLElement | null>(null);
  // Held in a ref so the trap effect does not re-subscribe on every render of
  // a caller that passes a fresh closure — which every caller does.
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Focus the first real control, falling back to the container. Without
    // this the keyboard stays on the trigger behind an `aria-modal` subtree.
    const first = tabbableWithin(box)[0];
    if (first) first.focus();
    else {
      box.tabIndex = -1;
      box.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dismiss.current?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const stops = tabbableWithin(box);
      if (stops.length === 0) {
        // Nothing to cycle through, but Tab must still not escape the modal.
        event.preventDefault();
        return;
      }

      const firstStop = stops[0]!;
      const lastStop = stops[stops.length - 1]!;
      const active = document.activeElement;

      // Focus outside the dialog entirely — a click on the backdrop, or a
      // browser that moved it — is pulled back rather than left to wander.
      if (!(active instanceof HTMLElement) || !box.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? lastStop : firstStop).focus();
        return;
      }
      if (event.shiftKey && active === firstStop) {
        event.preventDefault();
        lastStop.focus();
      } else if (!event.shiftKey && active === lastStop) {
        event.preventDefault();
        firstStop.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // The trigger is normally still mounted; `isConnected` covers the case
      // where the action that closed this dialog also removed it.
      const target = returnTo.current;
      if (target?.isConnected) target.focus();
    };
  }, []);

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={
        onDismiss
          ? (event) => {
              if (event.target === event.currentTarget) onDismiss();
            }
          : undefined
      }
    >
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(styles.box, styles.size[size], className)}
      >
        <Panel as="section" tone="paper" padding="md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Heading level={2} size="h3" id={titleId}>
                {title}
              </Heading>
              {description ? <Caption className="mbs-1">{description}</Caption> : null}
            </div>
            {close ? <div className="shrink-0">{close}</div> : null}
          </div>
          {children}
        </Panel>
      </div>
    </div>
  );
}

/** The block under a dialog's heading, at the kit's own rhythm. */
export function DialogBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mbs-5', className)}>{children}</div>;
}
