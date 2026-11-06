import { and, eq, isNull, sql } from 'drizzle-orm';
import type { AuthDb } from './client';
import { users, type NewUser, type User } from './schema';

// Case-insensitive lookup through the same lower(username) expression the
// unique index is built on (v4-plan.md Decision 5).
export async function findUserByUsername(db: AuthDb, username: string): Promise<User | undefined> {
  const [row] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username})`);
  return row;
}

export async function findUserByGoogleSub(db: AuthDb, sub: string): Promise<User | undefined> {
  const [row] = await db.select().from(users).where(eq(users.googleSub, sub));
  return row;
}

export async function findUserById(db: AuthDb, id: string): Promise<User | undefined> {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row;
}

// Throws on a unique violation (username or google_sub) — callers map it with
// isUniqueViolation (Decision 6: insert, never pre-check).
export async function insertUser(db: AuthDb, row: NewUser): Promise<User> {
  const [inserted] = await db.insert(users).values(row).returning();
  return inserted!;
}

export async function deleteUserById(db: AuthDb, id: string): Promise<void> {
  await db.delete(users).where(eq(users.id, id));
}

// Links a Google identity to an existing account, only while it has none.
// Returns false when no row matched (user gone or already linked). Throws a
// unique violation when the sub belongs to another user — callers must tell
// that apart from the false case.
export async function setGoogleSub(db: AuthDb, userId: string, sub: string): Promise<boolean> {
  const updated = await db
    .update(users)
    .set({ googleSub: sub, updatedAt: new Date().toISOString() })
    .where(and(eq(users.id, userId), isNull(users.googleSub)))
    .returning({ id: users.id });
  return updated.length > 0;
}

// Decision 21: one atomic UPDATE, guarded by password_hash IS NULL. google_sub
// is not touched, so the only unique index that can fire here is the username
// one.
export async function setInitialPassword(
  db: AuthDb,
  userId: string,
  passwordHash: string,
  username?: string,
): Promise<'ok' | 'already_set' | 'username_taken'> {
  try {
    const updated = await db
      .update(users)
      .set({
        passwordHash,
        ...(username === undefined ? {} : { username }),
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(users.id, userId), isNull(users.passwordHash)))
      .returning({ id: users.id });
    return updated.length > 0 ? 'ok' : 'already_set';
  } catch (err) {
    if (isUniqueViolation(err)) {
      return 'username_taken';
    }
    throw err;
  }
}

// D1 surfaces SQLite constraint errors wrapped (the driver error carries the
// SQLite message in its own message and/or in `cause`), so the whole cause
// chain is inspected.
export function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < 5 && current !== undefined && current !== null; depth++) {
    const message = current instanceof Error ? current.message : String(current);
    if (message.includes('UNIQUE constraint failed')) {
      return true;
    }
    current = current instanceof Error ? current.cause : undefined;
  }
  return false;
}
