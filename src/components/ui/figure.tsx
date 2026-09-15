import type { ReactNode } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Icon } from './icon';

/**
 * Images.
 *
 * Every image frame on this site was designed to work with the image absent
 * — no photography was supplied at launch, and a photograph of an
 * identifiable child needs documented consent before it can ever be
 * supplied. So every component here has a designed no-image state: the
 * alternate paper, the 1px edge, a glyph and the caller's label. Nothing
 * collapses, nothing shows a broken-image icon.
 *
 * `alt` is required by the types. Pass `alt=""` only through `decorative`,
 * so the omission is a decision rather than an oversight. Logos and
 * photographs never flip in RTL.
 */

const styles = {
  frame: 'media-treatment relative overflow-hidden bg-paper-alt',
  ratio: {
    wide: 'aspect-video',
    square: 'aspect-square',
    portrait: 'aspect-[4/5]',
    auto: '',
  },
  fallback:
    'flex size-full flex-col items-center justify-center gap-2 rule-edge bg-paper-alt text-mono-muted',
  caption: 'mbs-3 text-caption text-ink-55',
  credit: 'font-mono text-eyebrow text-mono-muted',
};

export type ImageSource = {
  src: string;
  width?: number;
  height?: number;
  /** Blur placeholder data URL when the pipeline produced one. */
  blurDataURL?: string;
};

/**
 * A content image with its caption and credit.
 *
 * `sizes` is required: without it `next/image` requests the largest
 * candidate on every viewport, which on the connections this site targets
 * is the difference between a page that loads and one that does not.
 */
export function Figure({
  image,
  alt,
  decorative,
  sizes,
  ratio = 'wide',
  caption,
  credit,
  preload,
  fallbackLabel,
  className,
  imageClassName,
}: {
  image: ImageSource | null | undefined;
  alt: string;
  /** Renders `alt=""` — only for an image that adds nothing the text lacks. */
  decorative?: boolean;
  sizes: string;
  ratio?: keyof typeof styles.ratio;
  caption?: ReactNode;
  credit?: string | null;
  /** Above-the-fold hero only. */
  preload?: boolean;
  /** Shown in the frame when there is no image — a dictionary string. */
  fallbackLabel?: string;
  className?: string;
  imageClassName?: string;
}) {
  const frame = (
    <div className={cn(styles.frame, styles.ratio[ratio], !image && 'rule-edge')}>
      {image ? (
        <Image
          src={image.src}
          alt={decorative ? '' : alt}
          fill={ratio !== 'auto' || !image.width || !image.height}
          width={ratio === 'auto' ? image.width : undefined}
          height={ratio === 'auto' ? image.height : undefined}
          sizes={sizes}
          preload={preload}
          placeholder={image.blurDataURL ? 'blur' : undefined}
          blurDataURL={image.blurDataURL}
          className={cn('object-cover', imageClassName)}
        />
      ) : (
        <NoImage label={fallbackLabel} />
      )}
    </div>
  );

  if (!caption && !credit) return <div className={className}>{frame}</div>;

  return (
    <figure className={className}>
      {frame}
      <figcaption className={styles.caption}>
        {caption}
        {credit ? (
          <span className={cn(styles.credit, caption && 'ms-2')}>{credit}</span>
        ) : null}
      </figcaption>
    </figure>
  );
}

/** The designed no-image state. Fills its parent. */
export function NoImage({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn(styles.fallback, className)} aria-hidden={label ? undefined : true}>
      <Icon name="image" size={24} />
      {label ? <span className="font-mono text-eyebrow uppercase">{label}</span> : null}
    </div>
  );
}

const avatarSize = {
  sm: 'size-8 text-caption',
  md: 'size-11 text-small',
  lg: 'size-16 text-h4',
};

/** The first letters of up to two words — the initials fallback. */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();
}

/**
 * A person. Square — the system has no radius, and a square portrait reads
 * as a record photograph, which is what it is. Falls back to initials.
 */
export function Avatar({
  image,
  name,
  size = 'md',
  className,
}: {
  image: ImageSource | null | undefined;
  name: string;
  size?: keyof typeof avatarSize;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rule-edge bg-paper-alt font-mono font-medium text-ink-70',
        avatarSize[size],
        className,
      )}
    >
      {image ? (
        <Image src={image.src} alt={name} fill sizes="64px" className="object-cover" />
      ) : (
        <span aria-hidden="true">{initialsOf(name)}</span>
      )}
      {!image ? <span className="sr-only">{name}</span> : null}
    </span>
  );
}

/**
 * A partner or member logo in a ruled tile. When there is no logo — or no
 * permission to show one — the name is set in type instead, which is the
 * honest rendering and also the one that survives a missing file.
 */
export function LogoTile({
  image,
  name,
  href,
  className,
}: {
  image: ImageSource | null | undefined;
  name: string;
  /** External partner site; opens in a new tab. */
  href?: string | null;
  className?: string;
}) {
  const inner = image ? (
    <Image
      src={image.src}
      alt={name}
      fill
      sizes="(min-width: 1024px) 180px, 40vw"
      className="object-contain p-4"
    />
  ) : (
    <span className="px-4 text-center text-small font-medium text-ink-70 text-balance">{name}</span>
  );

  const classes = cn(
    'relative flex aspect-[3/2] items-center justify-center rule-edge bg-paper no-underline',
    href && 'interactive-surface',
    className,
  );

  if (href) {
    return (
      <a href={href} className={classes} rel="noopener noreferrer" target="_blank" aria-label={name}>
        {inner}
      </a>
    );
  }
  return <div className={classes}>{inner}</div>;
}
