import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthDb } from './client';
import { findUserByEmail, findUserById } from './users.repository';
import type { NewUser } from './schema';
import { users } from './schema';
import { freshAuthDb } from './test-helpers';

let db: AuthDb;

beforeEach(async () => {
  db = await freshAuthDb();
});

function makeUser(overrides: Partial<NewUser> = {}): NewUser {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    email: 'admin@example.com',
    passwordHash: 'pbkdf2-sha256:100000:c2FsdA==:aGFzaA==',
    role: 'ADMIN',
    createdAt: '2026-07-02T00:00:00.000Z',
    updatedAt: '2026-07-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('findUserByEmail', () => {
  it('finds a user by exact (already-normalized) email', async () => {
    await db.insert(users).values(makeUser());
    const found = await findUserByEmail(db, 'admin@example.com');
    expect(found?.email).toBe('admin@example.com');
  });

  it('returns undefined for an unknown email', async () => {
    expect(await findUserByEmail(db, 'nobody@example.com')).toBeUndefined();
  });
});

describe('findUserById', () => {
  it('finds a user by id', async () => {
    await db.insert(users).values(makeUser({ id: 'user-1' }));
    expect((await findUserById(db, 'user-1'))?.id).toBe('user-1');
  });

  it('returns undefined for an unknown id', async () => {
    expect(await findUserById(db, 'does-not-exist')).toBeUndefined();
  });
});
