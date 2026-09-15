import { Body, Container, Head, Html, Preview, Section, Text } from '@react-email/components';
import type { ReactNode } from 'react';
import { DIR, HTML_LANG, type Locale } from '@/lib/i18n/config';

/**
 * The email frame, shared by both templates.
 *
 * Inline styles, not Tailwind: mail clients read no stylesheet. The tokens are
 * the design system's — paper `#FBFAF6` on ground `#E5E2DA`, navy ink
 * `#14213F`, gold `#DD991C` as a rule only, `#B87B12` for gold text, radius 0,
 * no shadow — so a notification looks like the site that sent it. Fonts are
 * the system stack; a web font in an email is a third-party request the
 * reader did not ask for, and most clients refuse it anyway.
 *
 * `dir` and `lang` are set on `<html>` and on `<body>` both: some clients keep
 * one and drop the other.
 */

export const tokens = {
  paper: '#FBFAF6',
  ground: '#E5E2DA',
  ink: '#14213F',
  ink70: '#4A5470',
  rule: '#D8D3C7',
  gold: '#DD991C',
  goldText: '#B87B12',
  font: "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif",
  mono: "'IBM Plex Mono', Consolas, 'Courier New', monospace",
} as const;

export const styles = {
  body: {
    margin: 0,
    padding: '32px 16px',
    backgroundColor: tokens.ground,
    fontFamily: tokens.font,
    color: tokens.ink,
  },
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    backgroundColor: tokens.paper,
    border: `1px solid ${tokens.rule}`,
    padding: '32px',
  },
  eyebrow: {
    margin: '0 0 8px',
    fontFamily: tokens.mono,
    fontSize: '12px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    color: tokens.goldText,
  },
  /** The 2px × 88px gold heading mark — the one place gold is drawn. */
  headingMark: {
    width: '88px',
    height: '2px',
    backgroundColor: tokens.gold,
    margin: '0 0 16px',
  },
  h1: {
    margin: '0 0 16px',
    fontSize: '22px',
    lineHeight: '1.35',
    fontWeight: 600,
    color: tokens.ink,
  },
  text: {
    margin: '0 0 12px',
    fontSize: '15px',
    lineHeight: '1.7',
    color: tokens.ink,
  },
  muted: {
    margin: '0',
    fontSize: '13px',
    lineHeight: '1.6',
    color: tokens.ink70,
  },
  /** 2px navy section boundary. */
  sectionRule: {
    borderTop: `2px solid ${tokens.ink}`,
    margin: '24px 0 16px',
  },
  /** 1px edge. */
  edgeRule: {
    borderTop: `1px solid ${tokens.rule}`,
    margin: '24px 0 16px',
  },
  /** Latin inside Arabic — reference numbers, URLs — stays LTR and isolated. */
  code: {
    fontFamily: tokens.mono,
    fontSize: '15px',
    fontWeight: 600,
    unicodeBidi: 'isolate' as const,
    direction: 'ltr' as const,
    display: 'inline-block',
  },
  link: {
    color: tokens.ink,
    textDecoration: 'underline',
    textDecorationColor: tokens.gold,
    textUnderlineOffset: '3px',
  },
} as const;

/**
 * Isolates a Latin token — a reference, a URL, an address — inside a
 * bidirectional paragraph. `<bdi>` carries `unicode-bidi: isolate` by
 * definition; the explicit `dir="ltr"` and inline style are belt-and-braces
 * for clients that strip one or the other. The mail counterpart of the site's
 * `Bidi` component.
 */
export function Latin({ children }: { children: ReactNode }) {
  return (
    <bdi dir="ltr" style={styles.code}>
      {children}
    </bdi>
  );
}

export function Frame({
  locale,
  preview,
  children,
}: {
  locale: Locale;
  preview: string;
  children: ReactNode;
}) {
  const dir = DIR[locale];
  const lang = HTML_LANG[locale];
  return (
    <Html lang={lang} dir={dir}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body} dir={dir} lang={lang}>
        <Container style={styles.container}>{children}</Container>
      </Body>
    </Html>
  );
}

export function Footer({ children }: { children: ReactNode }) {
  return (
    <Section>
      <div style={styles.edgeRule} />
      <Text style={styles.muted}>{children}</Text>
    </Section>
  );
}
