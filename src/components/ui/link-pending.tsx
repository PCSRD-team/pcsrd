'use client';

import { useLinkStatus } from 'next/link';

export function LinkPendingMark() {
  const { pending } = useLinkStatus();

  return (
    <span
      className="link-pending"
      aria-hidden="true"
      data-pending={pending ? 'true' : 'false'}
    />
  );
}
