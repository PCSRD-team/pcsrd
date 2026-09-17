'use client';
// Client Component: lazy-loads the TipTap editor so its bundle is fetched
// only on pages that have a rich-text field, and only after hydration.

import { lazy, Suspense } from 'react';
import { Caption } from '@/components/ui/typography';
import type { RichText } from '@/db/schema/_shared';
import { adminUi } from './admin-ui-dict';

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

/**
 * What stands in for the editor until its bundle arrives — and what a
 * submit before then posts: the hidden input carries the original value,
 * so a slow connection never loses the document.
 */
function RichTextEditorFallback({ name, label, defaultValue }: RichTextEditorProps) {
  return (
    <div className="space-y-2">
      <p className="text-small font-medium text-ink">{label}</p>
      <div className="control min-h-40" aria-busy="true">
        <Caption as="span">{adminUi.richText.loading}</Caption>
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
