import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/health-monitor/schema.ts',
  out: './src/db/health-monitor/migrations',
});
