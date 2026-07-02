import { eq } from 'drizzle-orm';
import type { AuthDb } from './client';
import { users, type User } from './schema';

// No create function is exposed to the app runtime — the single admin row
// is written directly to auth-db by scripts/create-admin.ts (v2-plan.md
// Decision #8). Callers pass an already-normalized (lowercase) email.

export async function findUserByEmail(db: AuthDb, email: string): Promise<User | undefined> {
  const [row] = await db.select().from(users).where(eq(users.email, email));
  return row;
}

export async function findUserById(db: AuthDb, id: string): Promise<User | undefined> {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row;
}
