import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/job-tracker/schema.ts',
  out: './src/db/job-tracker/migrations',
});
