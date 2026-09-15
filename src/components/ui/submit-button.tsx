'use client';

import { useFormStatus } from 'react-dom';
import { Button, type ButtonSize, type ButtonTone } from './button';

/**
 * Client Component — the one form control in the kit that needs JavaScript,
 * and only for a courtesy: `useFormStatus()` disables the button and swaps
 * the label while a Server Action is in flight, so a slow connection cannot
 * submit twice. With JavaScript off it is a plain `<button type="submit">`
 * and the form posts exactly as it would with it on (non-negotiable #7).
 *
 * Both labels are props: the kit carries no copy.
 */
export function SubmitButton({
  label,
  pendingLabel,
  tone = 'primary',
  size = 'md',
  name,
  value,
  className,
  formAction,
}: {
  label: string;
  pendingLabel: string;
  tone?: ButtonTone;
  size?: ButtonSize;
  /** For forms with more than one submit (save draft / send for review). */
  name?: string;
  value?: string;
  className?: string;
  formAction?: string | ((formData: FormData) => void | Promise<void>);
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      tone={tone}
      size={size}
      name={name}
      value={value}
      className={className}
      formAction={formAction}
      loading={pending}
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}
