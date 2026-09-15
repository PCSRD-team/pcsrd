'use client';

import { lazy, Suspense } from 'react';
import type { RichText } from '@/db/schema/_shared';

type RichTextEditorProps = {
  /** The hidden input this writes its JSON into. */
  name: string;
  label: string;
  dir?: 'rtl' | 'ltr';
  defaultValue?: RichText | null;
};

const RichTextEditorImpl = lazy(() =>
  import('@/components/admin/rich-text-editor-impl').then((module) => ({
    default: module.RichTextEditorImpl,
  })),
);

function RichTextEditorFallback({ name, label, defaultValue }: RichTextEditorProps) {
  return (
    <div className="space-y-2">
      <p className="text-small font-medium text-ink">{label}</p>
      <div className="min-h-40 rule-control bg-paper p-4 text-caption text-ink-55">
        Loading editor...
      </div>
      <input type="hidden" name={name} value={defaultValue ? JSON.stringify(defaultValue) : ''} />
    </div>
  );
}

export function RichTextEditor(props: RichTextEditorProps) {
  return (
    <Suspense fallback={<RichTextEditorFallback {...props} />}>
      <RichTextEditorImpl {...props} />
    </Suspense>
  );
}
