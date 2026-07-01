import { applyD1Migrations, env } from 'cloudflare:test';

await applyD1Migrations(
  env.JOB_TRACKER_DB,
  (env as unknown as { TEST_JOB_TRACKER_MIGRATIONS: never }).TEST_JOB_TRACKER_MIGRATIONS,
);
await applyD1Migrations(
  env.HEALTH_MONITOR_DB,
  (env as unknown as { TEST_HEALTH_MONITOR_MIGRATIONS: never }).TEST_HEALTH_MONITOR_MIGRATIONS,
);
