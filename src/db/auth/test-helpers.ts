import { env } from 'cloudflare:test';
import { createAuthDb, type AuthDb } from './client';
import { users } from './schema';

// Storage isolation is per test *file*, not per `it()` (v1-plan.md Decision
// #23) — every repo/service test needs a clean table before each test.
export async function freshAuthDb(): Promise<AuthDb> {
  const db = createAuthDb(env.AUTH_DB);
  await db.delete(users);
  return db;
}
