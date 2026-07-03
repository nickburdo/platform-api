import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';

const jobTrackerMigrations = await readD1Migrations('./src/db/job-tracker/migrations');
const healthMonitorMigrations = await readD1Migrations('./src/db/health-monitor/migrations');
const authMigrations = await readD1Migrations('./src/db/auth/migrations');

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          TEST_JOB_TRACKER_MIGRATIONS: jobTrackerMigrations,
          TEST_HEALTH_MONITOR_MIGRATIONS: healthMonitorMigrations,
          TEST_AUTH_MIGRATIONS: authMigrations,
          // Fixed dummy secrets for token/OAuth tests — never used outside vitest.
          JWT_SECRET: 'test-only-jwt-secret',
          GOOGLE_CLIENT_ID: 'test-only-google-client-id',
          GOOGLE_CLIENT_SECRET: 'test-only-google-client-secret',
        },
      },
    }),
  ],
  test: {
    include: ['src/**/*.repo.test.ts', 'src/**/*.service.test.ts', 'src/**/*.routes.test.ts'],
    setupFiles: ['./src/db/test-setup.ts'],
  },
});
