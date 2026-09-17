'use client';
// Client Component: lazy-loads the picker (which fetches the library) so a
// form without a media field never ships it; the fallback keeps the hidden
// input so a submit before hydration still posts the stored id.

import { lazy, Suspense } from 'react';
import { Panel } from '@/components/ui/card';
import { Caption } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import { adminUi } from './admin-ui-dict';

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
  const t = adminUi.mediaPicker;
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
      <Panel padding="sm" className={cn(invalid && 'border-destructive')}>
        <Caption>
          {initialValue ? t.loadingSelected : kind === 'document' ? t.noneFile : t.noneImage}
        </Caption>
      </Panel>
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
