import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthDb } from './client';
import type { NewUser } from './schema';
import { freshAuthDb } from './test-helpers';
import {
  deleteUserById,
  findUserByGoogleSub,
  findUserById,
  findUserByUsername,
  insertUser,
  isUniqueViolation,
} from './users.repository';

let db: AuthDb;

beforeEach(async () => {
  db = await freshAuthDb();
});

function makeUser(overrides: Partial<NewUser> = {}): NewUser {
  return {
    id: crypto.randomUUID(),
    username: 'Nick',
    passwordHash: 'pbkdf2-sha256:100000:c2FsdA==:aGFzaA==',
    googleSub: null,
    createdAt: '2026-11-06T00:00:00.000Z',
    updatedAt: '2026-11-06T00:00:00.000Z',
    ...overrides,
  };
}

async function captureError(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn();
  } catch (err) {
    return err;
  }
  return undefined;
}

describe('findUserByUsername', () => {
  it('is case-insensitive and keeps the stored casing', async () => {
    await insertUser(db, makeUser({ username: 'Nick' }));
    expect((await findUserByUsername(db, 'nick'))?.username).toBe('Nick');
    expect((await findUserByUsername(db, 'NICK'))?.username).toBe('Nick');
  });

  it('returns undefined for an unknown username', async () => {
    expect(await findUserByUsername(db, 'nobody')).toBeUndefined();
  });
});

describe('findUserById / findUserByGoogleSub', () => {
  it('finds a user by id', async () => {
    await insertUser(db, makeUser({ id: 'user-1' }));
    expect((await findUserById(db, 'user-1'))?.id).toBe('user-1');
    expect(await findUserById(db, 'does-not-exist')).toBeUndefined();
  });

  it('finds a Google-only user by sub', async () => {
    await insertUser(db, makeUser({ id: 'g-1', passwordHash: null, googleSub: 'sub-123' }));
    const found = await findUserByGoogleSub(db, 'sub-123');
    expect(found?.id).toBe('g-1');
    expect(found?.passwordHash).toBeNull();
    expect(await findUserByGoogleSub(db, 'other')).toBeUndefined();
  });
});

describe('insertUser', () => {
  it('returns the inserted row', async () => {
    const row = makeUser({ id: 'user-1' });
    expect((await insertUser(db, row)).id).toBe('user-1');
  });

  it('throws a unique violation for a username differing only in case', async () => {
    await insertUser(db, makeUser({ username: 'Nick' }));
    const err = await captureError(() => insertUser(db, makeUser({ username: 'nick' })));
    expect(err).toBeDefined();
    expect(isUniqueViolation(err)).toBe(true);
  });

  it('throws a unique violation for a duplicate google_sub', async () => {
    await insertUser(db, makeUser({ username: 'a1b', googleSub: 'sub-1' }));
    const err = await captureError(() =>
      insertUser(db, makeUser({ username: 'c2d', googleSub: 'sub-1' })),
    );
    expect(isUniqueViolation(err)).toBe(true);
  });

  it('rejects a row with neither passwordHash nor googleSub (CHECK), not as a unique violation', async () => {
    const err = await captureError(() =>
      insertUser(db, makeUser({ passwordHash: null, googleSub: null })),
    );
    expect(err).toBeDefined();
    expect(isUniqueViolation(err)).toBe(false);
  });
});

describe('deleteUserById', () => {
  it('deletes the row', async () => {
    await insertUser(db, makeUser({ id: 'user-1' }));
    await deleteUserById(db, 'user-1');
    expect(await findUserById(db, 'user-1')).toBeUndefined();
  });
});

describe('isUniqueViolation', () => {
  it('is false for unrelated values', () => {
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });

  it('inspects the cause chain', () => {
    const wrapped = new Error('Failed query', {
      cause: new Error('D1_ERROR: UNIQUE constraint failed: users.username'),
    });
    expect(isUniqueViolation(wrapped)).toBe(true);
  });
});
