'use client';
// Client Component: TipTap is a contenteditable editor and lives in the
// browser by definition. The hidden input keeps the form submittable
// before it mounts.

import Link from '@tiptap/extension-link';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useId, useState } from 'react';
import { IconButton } from '@/components/ui/button';
import type { RichText } from '@/db/schema/_shared';
import { adminUi } from './admin-ui-dict';

/**
 * The rich-text editor.
 *
 * **The extension set is an allow-list, not a default.** Every node type here
 * has a matching branch in `components/content/rich-text.tsx`; a node the
 * renderer does not know is dropped when the page renders, so enabling an
 * extension without adding its branch produces content that saves fine and
 * disappears on the public site.
 *
 * The document is stored as JSON rather than HTML, which is what lets the
 * renderer stay a Server Component with no `dangerouslySetInnerHTML`.
 *
 * The toolbar is a row of the kit's `IconButton`s. The kit's `Icon` set has
 * no formatting glyphs, so each button shows its label as text; the
 * accessible name and the visible label are the same word.
 */

type ToolbarKey = keyof Pick<
  typeof adminUi.richText,
  'bold' | 'italic' | 'h2' | 'h3' | 'bulletList' | 'orderedList' | 'blockquote' | 'link'
>;

export function RichTextEditorImpl({
  name,
  label,
  dir = 'rtl',
  defaultValue,
}: {
  /** The hidden input this writes its JSON into. */
  name: string;
  label: string;
  dir?: 'rtl' | 'ltr';
  defaultValue?: RichText | null;
}) {
  const [doc, setDoc] = useState<RichText | null>(defaultValue ?? null);
  const labelId = useId();
  const t = adminUi.richText;

  const editor = useEditor({
    // Server-rendering a contenteditable produces a hydration mismatch; the
    // editor is deliberately client-only and the hidden input carries the value
    // regardless, so a submit before the editor mounts still posts the original.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        // Not rendered by the public renderer, so not offered here.
        codeBlock: false,
        horizontalRule: {},
      }),
      Link.configure({
        openOnClick: false,
        autolink: false,
        // Mirrors the renderer's scheme check. A `javascript:` href would be
        // dropped at render time anyway; refusing it here means the editor
        // never shows a link that will silently vanish.
        protocols: ['http', 'https', 'mailto', 'tel'],
      }),
    ],
    content: defaultValue ?? '',
    editorProps: {
      attributes: {
        dir,
        lang: dir === 'rtl' ? 'ar' : 'en',
        // The contenteditable needs an accessible name of its own: two of
        // these render side by side per rich-text field, and without it a
        // screen-reader user hears two identical unnamed editable regions.
        // WCAG 2.2 SC 4.1.2.
        'aria-labelledby': labelId,
        role: 'textbox',
        'aria-multiline': 'true',
        class: 'control min-h-40 text-body',
      },
    },
    onUpdate: ({ editor: instance }) => setDoc(instance.getJSON() as RichText),
  });

  const button = (key: ToolbarKey, active: boolean, onClick: () => void) => (
    <IconButton
      key={key}
      label={t[key]}
      size="sm"
      tone={active ? 'primary' : 'quiet'}
      aria-pressed={active}
      onClick={onClick}
      className="font-mono text-eyebrow"
    >
      {t[key]}
    </IconButton>
  );

  return (
    <div className="space-y-2">
      <p id={labelId} className="text-small font-medium text-ink">
        {label}
      </p>

      {editor ? (
        <div
          role="toolbar"
          aria-label={`${label} — ${t.toolbar}`}
          className="rule-edge flex flex-wrap bg-paper-alt"
        >
          {button('bold', editor.isActive('bold'), () =>
            editor.chain().focus().toggleBold().run(),
          )}
          {button('italic', editor.isActive('italic'), () =>
            editor.chain().focus().toggleItalic().run(),
          )}
          {button('h2', editor.isActive('heading', { level: 2 }), () =>
            editor.chain().focus().toggleHeading({ level: 2 }).run(),
          )}
          {button('h3', editor.isActive('heading', { level: 3 }), () =>
            editor.chain().focus().toggleHeading({ level: 3 }).run(),
          )}
          {button('bulletList', editor.isActive('bulletList'), () =>
            editor.chain().focus().toggleBulletList().run(),
          )}
          {button('orderedList', editor.isActive('orderedList'), () =>
            editor.chain().focus().toggleOrderedList().run(),
          )}
          {button('blockquote', editor.isActive('blockquote'), () =>
            editor.chain().focus().toggleBlockquote().run(),
          )}
          {button('link', editor.isActive('link'), () => {
            const href = window.prompt(t.linkPrompt, editor.getAttributes('link').href ?? 'https://');
            if (href === null) return;
            if (href === '') {
              editor.chain().focus().unsetLink().run();
              return;
            }
            editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
          })}
        </div>
      ) : null}

      <EditorContent editor={editor} />

      {/*
        The value travels as JSON in a hidden input rather than through React
        state on the form, so the form still submits correctly with a native
        POST — the editor enhances the field, it does not own it.
      */}
      <input type="hidden" name={name} value={doc ? JSON.stringify(doc) : ''} />
    </div>
  );
}
