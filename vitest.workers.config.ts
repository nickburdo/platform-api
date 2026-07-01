import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';

const jobTrackerMigrations = await readD1Migrations('./src/db/job-tracker/migrations');
const healthMonitorMigrations = await readD1Migrations('./src/db/health-monitor/migrations');

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          TEST_JOB_TRACKER_MIGRATIONS: jobTrackerMigrations,
          TEST_HEALTH_MONITOR_MIGRATIONS: healthMonitorMigrations,
        },
      },
    }),
  ],
  test: {
    include: ['src/**/*.repo.test.ts'],
    setupFiles: ['./src/db/test-setup.ts'],
  },
});
