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
