import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function createAuthDb(binding: D1Database) {
  return drizzle(binding, { schema });
}

export type AuthDb = ReturnType<typeof createAuthDb>;
