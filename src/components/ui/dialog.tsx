import type { ReactNode } from 'react';
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
 * **Focus containment is the caller's.** A focus trap needs refs, a keydown
 * listener and a restore-on-close, i.e. a Client Component with real state —
 * and the caller already owns the state that opens and closes this. The kit
 * stays server-renderable and does not pretend to trap focus it cannot see.
 * A caller that opens a dialog owns three things: moving focus in, Escape,
 * and returning focus to the trigger.
 */

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
   * Pressing the backdrop itself. Omit for a dialog that may only be closed
   * from its own controls — a destructive confirmation, say.
   */
  onDismiss?: () => void;
  size?: keyof typeof styles.size;
  className?: string;
}) {
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
