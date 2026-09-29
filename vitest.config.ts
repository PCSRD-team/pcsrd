import { defineConfig } from 'vitest/config';

/**
 * Two projects, deliberately separated.
 *
 * `unit`        — pure functions in src/lib. No database, no Next runtime.
 * `integration` — the service layer against PGlite (in-process Postgres 17).
 *                 This is what makes ~90% of the backend verifiable before any
 *                 Supabase credential exists. See docs/spec/06-BUILD-PLAN.md §10.
 *
 * `@/…` imports resolve through Vite's own `resolve.tsconfigPaths`. It replaced
 * the `vite-tsconfig-paths` plugin, which did the same job and made Vite warn.
 * Set on each project because a project does not inherit the root's `resolve`.
 */
const resolve = { tsconfigPaths: true } as const;

export default defineConfig({
  resolve,
  test: {
    projects: [
      {
        resolve,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['tests/setup/env.ts'],
        },
      },
      {
        resolve,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          // Only the env shim runs as a setup file. The PGlite helpers are
          // imported by the tests that want a database, so a test file that
          // does not touch one does not pay a second of startup for it.
          setupFiles: ['tests/setup/env.ts'],
          // PGlite is a single in-process instance; parallel files would share
          // and corrupt it.
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
