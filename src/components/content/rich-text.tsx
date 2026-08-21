import type { ReactNode } from 'react';
import Link from 'next/link';
import type { RichText as RichTextDoc, RichTextNode } from '@/db/schema/_shared';

/**
 * Renders a TipTap document as React elements.
 *
 * **No `dangerouslySetInnerHTML` anywhere.** The document is stored as a node
 * tree rather than HTML precisely so it can be walked and mapped, which means
 * an editor cannot inject markup even if the editor itself is compromised —
 * a node type this renderer does not recognise is dropped, not passed through.
 *
 * Unknown nodes render their children rather than nothing: an unrecognised
 * wrapper should not silently delete the paragraph inside it.
 */

const HEADING_CLASS: Record<number, string> = {
  1: 'text-h1 font-semibold text-ink',
  2: 'text-h2 font-semibold text-ink',
  3: 'text-h3 font-semibold text-ink',
  4: 'text-lead font-semibold text-ink',
};

function renderMarks(text: string, marks: RichTextNode['marks']): ReactNode {
  if (!marks?.length) return text;

  return marks.reduce<ReactNode>((acc, mark) => {
    switch (mark.type) {
      case 'bold':
        return <strong className="font-semibold text-ink">{acc}</strong>;
      case 'italic':
        return <em>{acc}</em>;
      case 'underline':
        return <u>{acc}</u>;
      case 'strike':
        return <s>{acc}</s>;
      case 'code':
        return <code className="bg-paper-alt px-1 font-mono text-caption">{acc}</code>;
      case 'link': {
        const href = typeof mark.attrs?.href === 'string' ? mark.attrs.href : null;
        if (!href) return acc;
        // Only http(s) and mailto survive. A `javascript:` href stored in the
        // document would otherwise become a working script link.
        if (!/^(https?:|mailto:|tel:|\/)/i.test(href)) return acc;
        const external = /^https?:/i.test(href);
        return external ? (
          <a href={href} rel="noopener noreferrer" target="_blank">
            {acc}
          </a>
        ) : (
          <Link href={href}>{acc}</Link>
        );
      }
      default:
        return acc;
    }
  }, text);
}

function renderNode(node: RichTextNode, key: string): ReactNode {
  const children = node.content?.map((child, index) => renderNode(child, `${key}.${index}`));

  switch (node.type) {
    case 'text':
      return <span key={key}>{renderMarks(node.text ?? '', node.marks)}</span>;

    case 'paragraph':
      return (
        <p key={key} className="text-body text-ink-70">
          {children}
        </p>
      );

    case 'heading': {
      const level = Number(node.attrs?.level ?? 2);
      const Tag = (`h${Math.min(Math.max(level, 2), 4)}` as 'h2' | 'h3' | 'h4');
      return (
        <Tag key={key} className={HEADING_CLASS[level] ?? HEADING_CLASS[3]}>
          {children}
        </Tag>
      );
    }

    case 'bulletList':
      return (
        <ul key={key} className="list-disc space-y-2 ps-6 text-body text-ink-70">
          {children}
        </ul>
      );

    case 'orderedList':
      return (
        <ol key={key} className="list-decimal space-y-2 ps-6 text-body text-ink-70">
          {children}
        </ol>
      );

    case 'listItem':
      return <li key={key}>{children}</li>;

    case 'blockquote':
      // A quote is marked by the gold rule on its leading edge — logical, so it
      // lands on the right side in both directions.
      return (
        <blockquote key={key} className="border-s-2 border-gold-600 ps-5 text-lead text-ink">
          {children}
        </blockquote>
      );

    case 'horizontalRule':
      return <hr key={key} className="border-bs border-rule" />;

    case 'hardBreak':
      return <br key={key} />;

    default:
      return <div key={key}>{children}</div>;
  }
}

export function RichText({
  doc,
  className,
}: {
  doc: RichTextDoc | null | undefined;
  className?: string;
}) {
  if (!doc?.content?.length) return null;
  return (
    <div className={`measure space-y-4 ${className ?? ''}`}>
      {doc.content.map((node, index) => renderNode(node, String(index)))}
    </div>
  );
}
