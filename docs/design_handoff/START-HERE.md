# START HERE — turning this design into a running Next.js + Supabase app

Four steps. Do them in order. Everything referenced is in this bundle.

## Step 1 — Scaffold (M0, ~2 days)

Run `spec/06-BUILD-PLAN.md` §2 verbatim: `create-next-app`, the dependency list, the
Supabase project, Vercel, CI. Copy `CLAUDE.md` from this bundle to the repo root, and
`spec/` into `docs/spec/`. Commit before writing any feature code.

Two things to get right on day one, because both fail intermittently and neither error
message points at the cause:

- `postgres(url, { prepare: false })` against the `:6543` pooler.
- CI must fail if `service_role` appears in `.next/static/`.

## Step 2 — Hand Claude Code the repo, not the design

Open Claude Code in the repo and give it this, once:

> Read `docs/spec/00` through `07` and `docs/design_handoff_pcsrd_web/README.md`
> before writing code. The spec docs are the source of truth for architecture, schema,
> routes and security. The handoff README is the source of truth for the visual system.
> The `.dc.html` files in `design/` are design references, not code — recreate them as
> Next.js Server Components with Tailwind v4 tokens; do not port their inline styles.
> Work milestone by milestone from `06-BUILD-PLAN.md`, one PR per milestone, and stop at
> the end of each for review. Start with M1.

Then work **one milestone per session**. Do not ask for the whole site in one prompt —
the build plan is sequenced so each milestone ends in something you can look at, and
that is what keeps the output reviewable.

## Step 3 — Follow the plan's order, and resist two temptations

M1 data → M2 design system + i18n → M3 the 24 routes → M4 forms → M5 admin →
M6 SEO/a11y/perf → M7 content and launch.

- **Build the homepage last** (M3 day 7). It composes components from every other page.
  Built first, everything gets built twice.
- **Build the admin's generic layer before any entity** (M5 days 2–4), then Projects
  completely. The remaining ten entities are field configs after that.

Paste `design/globals.css` in at the start of M2 — it is the `@theme` block, ready.

## Step 4 — Content last, deliberately

Seed fixtures let M1–M6 finish with no real content. The gap is not the code, it is the
six items in the README's *Open items* list — the licence number, the complete channel
list, the photographs and their consent status. Collect those in parallel with the build,
not after it.

At M7 you load the real content **through the admin**, which is also the admin's real
usability test. The definition of done is a non-developer publishing a news post unaided
while you watch.

## What each thing in this bundle is for

| Path | Use it when |
|---|---|
| `spec/00-ARCHITECTURE.md` | Deciding anything structural |
| `spec/01-DATABASE.md` | M1 — schema, RLS, seeds |
| `spec/02-API.md` | Server Actions, queries, cache tags |
| `spec/03-FRONTEND.md` | Every route and component file |
| `spec/04-DESIGN-SYSTEM.md` | Tokens as originally specced |
| `spec/05-ADMIN.md` | M5 |
| `spec/06-BUILD-PLAN.md` | Daily — the sequence and every DoD |
| `spec/07-CLAUDE-CODE-BRIEF.md` | The original operating brief |
| `design/*.dc.html` | Building any screen — open in a browser |
| `design/globals.css` | M2 step 1 |
| `README.md` | The visual system, the RTL rules, the per-screen behaviour |
