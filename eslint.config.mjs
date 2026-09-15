import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import betterTailwind from "eslint-plugin-better-tailwindcss";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Ours:
    "drizzle/**",
    "docs/**",
  ]),

  // ── RTL: logical CSS properties only ─────────────────────────────────
  // 00-ARCHITECTURE §0.9 rule 2. A physical property silently breaks RTL and
  // is invisible to an LTR-reading reviewer, so it has to be caught by machine.
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "better-tailwindcss": betterTailwind },
    settings: {
      "better-tailwindcss": {
        // Tailwind v4 is CSS-first: the @theme block IS the config.
        entryPoint: "src/app/globals.css",
      },
    },
    rules: {
      "better-tailwindcss/enforce-logical-properties": [
        "error",
        {
          // The plugin also rewrites size utilities (`w-` → `inline-`,
          // `h-` → `block-`). Those are not direction-sensitive, so they are
          // not what 04-DESIGN-SYSTEM §2 bans and rewriting them buys nothing
          // while making every layout unreadable. What must stay flagged is
          // the directional set: ms/me, ps/pe, start/end, text-start/end,
          // border-s/e, rounded-s/e.
          ignore: ["(^|:)-?(min-|max-)?[wh]-", "(^|:)size-"],
        },
      ],
      "better-tailwindcss/no-conflicting-classes": "error",
      // A class that does not exist compiles to nothing and looks fine in a
      // diff. Eleven did, across 18 call sites: `mis-1/2/3`, `mie-4`,
      // `pis-4/5/6`, `border-is-2`, `border-ie`, `object-start` and
      // `focus:inset-inline-start-4` — all generalised from Tailwind's real
      // *block*-axis names (`mbs`, `pbe`, `border-be`), which do exist, to an
      // inline-axis set that does not. Tailwind names that axis
      // `ms`/`me`/`ps`/`pe`/`border-s`/`border-e`/`start`/`end`.
      //
      // Nothing caught them. They read as logical properties, so
      // `enforce-logical-properties` was satisfied; they are syntactically
      // valid class strings, so the type checker and the build were too. The
      // cost was invisible: blockquotes with no rule, lists with no indent, an
      // admin sidebar with no boundary, and a skip link that stayed 9999px
      // off-screen while focused.
      //
      // This is the rule that makes that a build failure rather than a visual
      // regression nobody reading LTR would notice.
      "better-tailwindcss/no-unknown-classes": [
        "error",
        {
          // Turnstile's own hook. Cloudflare's script queries for
          // `.cf-turnstile` to find its mount point, so it is a third-party API
          // surface that happens to be spelled as a class, not a utility.
          ignore: ["^cf-turnstile$"],
        },
      ],

      // ── Design system: radius 0, no shadows, gold is a marking colour ──
      // 04-DESIGN-SYSTEM and docs/design_handoff/README.md. Hierarchy comes
      // from three rule weights and ground colour, never from elevation or
      // rounding; gold-600 is a rule, a stamp and a focus ring, never a fill
      // and never text on paper (text is gold-700, 5.75:1).
      //
      // Severity is "warn" DELIBERATELY AND TEMPORARILY. The shared kit in
      // src/components/ui is clean; the pages, admin, forms and layout
      // components are being migrated onto it in the next phase. Flip this to
      // "error" once `eslint` reports zero warnings from this rule. Each
      // pattern matches the full class including variants (`md:rounded-lg`,
      // `hover:shadow-md`), so the only escape is `-none`.
      "better-tailwindcss/no-restricted-classes": [
        "warn",
        {
          restrict: [
            {
              pattern: "^(?:[^:]*:)*-?rounded(?!(?:-[a-z]+)?-none$)(?:-.*)?$",
              message:
                'Radius 0 by system: "$0" is not allowed. Use `rounded-none` or nothing.',
            },
            {
              pattern: "^(?:[^:]*:)*-?(?:inset-)?shadow(?!-none$)(?:-.*)?$",
              message:
                'No shadows: "$0" is not allowed. Elevation is a rule weight and a ground colour.',
            },
            {
              pattern: "^(?:[^:]*:)*-?drop-shadow(?!-none$)(?:-.*)?$",
              message: 'No shadows: "$0" is not allowed.',
            },
            {
              pattern: "^(?:[^:]*:)*-?(?:backdrop-)?blur(?!-none$)(?:-.*)?$",
              message:
                'No decorative blur: "$0" is not allowed. There is no motion or elevation vocabulary in this system.',
            },
            {
              pattern: "^(?:[^:]*:)*bg-gold-(?:600|500)(?:/\d+)?$",
              message:
                'Gold is a marking colour, never a fill: "$0". Use a rule (`rule-mark`, `border-gold-600`) or the attestation ground `bg-gold-050`.',
            },
            {
              pattern: "^((?:[^:]*:)*)text-gold-600(?:/\d+)?$",
              fix: "$1text-gold-700",
              message:
                'gold-600 is 2.3:1 on paper and never carries text: "$0". Use `text-gold-700`.',
            },
          ],
        },
      ],
    },
  },

  // ── Layer boundary: services must stay framework-free ────────────────
  // This is what makes the service layer testable — `revalidateTag`,
  // `headers()` and `after()` all throw outside a Next request scope, so a
  // service that imports them cannot be exercised by a plain Vitest run.
  {
    files: ["src/services/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next/*", "next"],
              message:
                "Services must not import from next/*. Move the Next-specific concern (cookies, headers, revalidateTag, after) into src/actions/ or a route handler. See CLAUDE.md → Layering.",
            },
          ],
        },
      ],
    },
  },

  // ── Global bans ──────────────────────────────────────────────────────
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // 00-ARCHITECTURE §0.9 rule 1. The single permitted exception is
      // JSON-LD in src/components/seo/*, which overrides this below.
      "react/no-danger": "error",
      // 02-API §10 — a form payload must never reach a log.
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },

  // JSON-LD is the one place `dangerouslySetInnerHTML` is allowed:
  // JSON.stringify output inside a ld+json script is not an HTML parsing
  // context. 04-DESIGN-SYSTEM §3.6.
  {
    files: ["src/components/seo/**/*.tsx"],
    rules: { "react/no-danger": "off" },
  },

  // Scripts and tests run outside the app; console output is the point.
  //
  // `react-hooks/rules-of-hooks` is off here because it matches on the `use`
  // prefix alone: `useTestDb()` is a Vitest fixture that registers beforeAll,
  // not a React hook, and there is no React in this directory at all.
  {
    files: ["scripts/**/*.ts", "tests/**/*.ts"],
    rules: {
      "no-console": "off",
      "react-hooks/rules-of-hooks": "off",
    },
  },
]);

export default eslintConfig;
