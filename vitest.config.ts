import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Two projects, deliberately separated.
 *
 * `unit`        — pure functions in src/lib. No database, no Next runtime.
 * `integration` — the service layer against PGlite (in-process Postgres 17).
 *                 This is what makes ~90% of the backend verifiable before any
 *                 Supabase credential exists. See docs/spec/06-BUILD-PLAN.md §10.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    projects: [
      {
        plugins: [tsconfigPaths()],
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['tests/setup/env.ts'],
        },
      },
      {
        plugins: [tsconfigPaths()],
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
