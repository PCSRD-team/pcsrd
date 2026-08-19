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
        },
      },
      {
        plugins: [tsconfigPaths()],
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['tests/setup/pglite.ts'],
          // PGlite is a single in-process instance; parallel files would share
          // and corrupt it.
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
