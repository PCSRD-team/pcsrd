import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The core visual vocabulary.
 *
 * Everything here obeys the same three constraints from the design system:
 * **radius 0, no shadows, three rule weights**. Hierarchy comes from rules and
 * ground colour, never from elevation. A fourth rule weight or a shadow added
 * here would propagate to every screen at once, which is exactly why they live
 * in one file.
 */

// ── Section heading ──────────────────────────────────────────────────────

/**
 * H2 with the 88px gold mark beneath it.
 *
 * The mark is the third rule weight and has one meaning: this is a section
 * heading. It is a `<span>` rather than a border on the heading so its width
 * stays 88px regardless of how long the text is.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  as: Tag = "h2",
  id,
  className,
}: {
  eyebrow?: string;
  title: string;
  lead?: string | null;
  as?: "h1" | "h2" | "h3";
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("mbe-8", className)}>
      {eyebrow ? <p className="eyebrow mbe-3">{eyebrow}</p> : null}

      {/* الحاوية تكون inline-block ليُحسب عرض الكلمة/الكلمتين بدقة */}
      <div className="inline-block">
        <Tag
          id={id}
          className={cn(
            "font-semibold text-ink",
            Tag === "h1" ? "text-h1" : Tag === "h2" ? "text-h2" : "text-h3",
          )}
        >
          {title}
        </Tag>

        {/* 
          - العرض المبدئي الثابت: w-12 (يمكنكِ تغييره لـ w-16 حسب ما كان عاجبك)
          - عند الهوفر: group-hover:w-full يتمدد ليكون بطول الكلام تماماً
        */}
        <span className="rule-mark mbs-3 block" aria-hidden="true" />
      </div>

      {lead ? (
        <p className="measure-lead mbs-5 text-lead text-ink-70">{lead}</p>
      ) : null}
    </div>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────

/** Paper surface with the 1px container-edge rule. */
export function Panel({
  children,
  className,
  tone = "paper",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  tone?: "paper" | "alt" | "gold" | "navy";
  as?: "div" | "article" | "section" | "aside" | "li";
}) {
  const tones = {
    paper: "bg-paper text-ink",
    alt: "bg-paper-alt text-ink",
    gold: "bg-gold-050 text-ink",
    navy: "bg-navy-900 text-paper",
  };
  return (
    <Tag className={cn("rule-edge p-6 md:p-8", tones[tone], className)}>
      {children}
    </Tag>
  );
}

// ── Section boundary ─────────────────────────────────────────────────────

/** 2px ink rule: a new record begins. */
export function Section({
  children,
  className,
  bounded = true,
  id,
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  bounded?: boolean;
  id?: string;
  labelledBy?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn("section-gap", bounded && "rule-section", className)}
    >
      {children}
    </section>
  );
}

// ── Buttons and links ────────────────────────────────────────────────────

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 px-6 py-3 text-small font-medium " +
  "motion-standard transition-colors active:translate-y-px disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60";

const buttonTones = {
  primary: "bg-navy-700 text-paper hover:bg-navy-900",
  secondary: "rule-control bg-paper text-ink hover:bg-paper-alt",
  outline: "rule-control bg-transparent text-ink hover:bg-paper-alt",
  ghost: "bg-transparent text-ink hover:bg-paper-alt",
  destructive: "rule-control border-gold-600 bg-gold-050 text-gold-700 hover:bg-paper",
  // Gold as a marking colour: the rule, not the fill. Text stays ink.
  marked:
    "border-b-2 border-gold-600 bg-transparent text-ink hover:bg-gold-050",
};

export type ButtonTone = keyof typeof buttonTones;

export function Button({
  children,
  tone = "primary",
  type = "button",
  className,
  disabled,
  loading,
  name,
  value,
}: {
  children: ReactNode;
  tone?: ButtonTone;
  type?: "button" | "submit" | "reset";
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  name?: string;
  value?: string;
}) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      name={name}
      value={value}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(buttonBase, buttonTones[tone], className)}
    >
      {children}
    </button>
  );
}

export function IconSlot({ children }: { children: ReactNode }) {
  return (
    <span className="icon-20 inline-flex shrink-0 items-center justify-center" aria-hidden="true">
      {children}
    </span>
  );
}

export function IconButton({
  children,
  label,
  type = "button",
  className,
  disabled,
}: {
  children: ReactNode;
  label: string;
  type?: "button" | "submit" | "reset";
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      aria-label={label}
      disabled={disabled}
      className={cn("icon-button disabled:cursor-not-allowed disabled:opacity-60", className)}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  href,
  tone = "primary",
  className,
  external,
}: {
  children: ReactNode;
  href: string;
  tone?: ButtonTone;
  className?: string;
  external?: boolean;
}) {
  const classes = cn(buttonBase, buttonTones[tone], "no-underline", className);
  if (external) {
    return (
      <a
        href={href}
        className={classes}
        rel="noopener noreferrer"
        target="_blank"
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

// ── Status badge ─────────────────────────────────────────────────────────

/**
 * The one place a border radius is permitted in the whole system: a pill on a
 * status badge, because a square status chip reads as a button.
 */
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "active" | "complete" | "planned" | "verified" | "warning";
}) {
  const tones = {
    neutral: "bg-paper-alt text-ink-70 border-rule",
    active: "bg-navy-100 text-navy-900 border-navy-700/30",
    complete: "bg-paper-alt text-ink-55 border-rule-strong",
    planned: "bg-paper text-ink-55 border-rule",
    verified: "bg-success-soft text-success border-success",
    warning: "bg-warning-soft text-warning border-warning",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 font-mono text-eyebrow tracking-wide uppercase",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

// ── Definition list ──────────────────────────────────────────────────────

/**
 * The identity record shape, reused across the footer, `/about` and every
 * detail page. Terms are mono because they are labels, not prose.
 */
export function DefinitionList({
  items,
  className,
}: {
  items: { term: string; value: ReactNode }[];
  className?: string;
}) {
  const shown = items.filter(
    (item) =>
      item.value !== null && item.value !== undefined && item.value !== "",
  );
  if (shown.length === 0) return null;

  return (
    <dl
      className={cn(
        "grid gap-x-8 gap-y-4 sm:grid-cols-[max-content_1fr]",
        className,
      )}
    >
      {shown.map((item) => (
        <div key={item.term} className="contents">
          <dt className="eyebrow pbs-1">{item.term}</dt>
          <dd className="text-small text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ── Prose ────────────────────────────────────────────────────────────────

/** Constrains a text column to the 52–78ch measure. */
export function Prose({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("measure space-y-4 text-body text-ink-70", className)}>
      {children}
    </div>
  );
}
