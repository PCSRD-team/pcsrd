'use client';

import { lazy, Suspense } from 'react';

type MediaPickerProps = {
  name: string;
  initialValue?: string;
  kind?: 'image' | 'document';
  describedBy?: string;
  invalid?: boolean;
};

const MediaPickerImpl = lazy(() =>
  import('@/components/admin/media-picker-impl').then((module) => ({
    default: module.MediaPickerImpl,
  })),
);

function MediaPickerFallback({
  name,
  initialValue = '',
  kind,
  describedBy,
  invalid,
}: MediaPickerProps) {
  return (
    <>
      <input
        type="hidden"
        id={name}
        name={name}
        value={initialValue}
        aria-describedby={describedBy}
        aria-invalid={invalid}
      />
      <div className={`rounded-lg border bg-paper p-3 ${invalid ? 'border-gold-600' : 'border-rule'}`}>
        <p className="text-caption text-ink-55">
          {initialValue
            ? 'Loading selected media...'
            : `No ${kind === 'document' ? 'file' : 'image'} selected.`}
        </p>
      </div>
    </>
  );
}

export function MediaPicker(props: MediaPickerProps) {
  return (
    <Suspense fallback={<MediaPickerFallback {...props} />}>
      <MediaPickerImpl {...props} />
    </Suspense>
  );
}
