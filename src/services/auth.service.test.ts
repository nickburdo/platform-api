import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthDb } from '../db/auth/client';
import { users } from '../db/auth/schema';
import { freshAuthDb } from '../db/auth/test-helpers';
import { hashPassword } from '../utils/password';
import { verifyToken } from '../utils/jwt';
import { getMe, login, loginWithGoogle, register, toPublicUser } from './auth.service';

let db: AuthDb;

const SECRET = 'auth-service-test-secret';

beforeEach(async () => {
  db = await freshAuthDb();
});

async function seedUser(overrides: { username?: string; password?: string } = {}) {
  const username = overrides.username ?? 'Nick';
  const password = overrides.password ?? 'super-secret-password';
  const now = new Date().toISOString();
  await db.insert(users).values({
    id: 'user-1',
    username,
    passwordHash: await hashPassword(password),
    googleSub: null,
    createdAt: now,
    updatedAt: now,
  });
  return { username, password };
}

async function seedGoogleOnlyUser() {
  const now = new Date().toISOString();
  await db.insert(users).values({
    id: 'google-1',
    username: 'user-abc123',
    passwordHash: null,
    googleSub: 'sub-123',
    createdAt: now,
    updatedAt: now,
  });
}

describe('toPublicUser', () => {
  it('exposes only id, username, hasPassword and timestamps', async () => {
    await seedUser();
    const [user] = await db.select().from(users);
    const publicUser = toPublicUser(user!);
    expect(Object.keys(publicUser).sort()).toEqual([
      'createdAt',
      'hasPassword',
      'id',
      'updatedAt',
      'username',
    ]);
    expect(publicUser.hasPassword).toBe(true);
  });

  it('reports hasPassword false for a Google-only account', async () => {
    await seedGoogleOnlyUser();
    const [user] = await db.select().from(users);
    expect(toPublicUser(user!).hasPassword).toBe(false);
  });
});

describe('register', () => {
  it('creates the user with a hashed password and issues a verifiable token', async () => {
    const result = await register(db, { username: 'Nick', password: 'password1' }, SECRET);
    expect(result).not.toBe('username_taken');
    if (result === 'username_taken') return;
    expect(result.user.username).toBe('Nick');
    expect(result.user.hasPassword).toBe(true);
    expect(await verifyToken(result.token, SECRET)).toEqual({ sub: result.user.id });
    const [row] = await db.select().from(users);
    expect(row?.passwordHash).not.toBe('password1');
    expect(row?.googleSub).toBeNull();
  });

  it('returns username_taken for a case-insensitive duplicate', async () => {
    await register(db, { username: 'Nick', password: 'password1' }, SECRET);
    expect(await register(db, { username: 'nick', password: 'password2' }, SECRET)).toBe(
      'username_taken',
    );
    expect(await db.select().from(users)).toHaveLength(1);
  });
});

describe('login', () => {
  it('issues a verifiable token and the public user on correct credentials', async () => {
    const { username, password } = await seedUser();
    const result = await login(db, { username, password }, SECRET);
    expect(result?.user.username).toBe(username);
    expect(await verifyToken(result!.token, SECRET)).toEqual({ sub: 'user-1' });
  });

  it('matches the username case-insensitively', async () => {
    const { password } = await seedUser({ username: 'Nick' });
    expect(await login(db, { username: 'NICK', password }, SECRET)).not.toBeNull();
  });

  it('returns null for an unknown username', async () => {
    await seedUser();
    expect(await login(db, { username: 'nobody', password: 'x' }, SECRET)).toBeNull();
  });

  it('returns null for a wrong password', async () => {
    const { username } = await seedUser();
    expect(await login(db, { username, password: 'wrong password' }, SECRET)).toBeNull();
  });

  it('returns null for a Google-only account', async () => {
    await seedGoogleOnlyUser();
    expect(await login(db, { username: 'user-abc123', password: 'anything1' }, SECRET)).toBeNull();
  });
});

describe('loginWithGoogle (temporary sub lookup)', () => {
  it('issues a token for the matching sub', async () => {
    await seedGoogleOnlyUser();
    const result = await loginWithGoogle(db, 'sub-123', SECRET);
    expect(await verifyToken(result!.token, SECRET)).toEqual({ sub: 'google-1' });
  });

  it('returns null for an unknown sub and creates no user', async () => {
    await seedGoogleOnlyUser();
    expect(await loginWithGoogle(db, 'other', SECRET)).toBeNull();
    expect(await db.select().from(users)).toHaveLength(1);
  });
});

describe('getMe', () => {
  it('returns the public user for a valid id', async () => {
    await seedUser();
    const me = await getMe(db, 'user-1');
    expect(me?.id).toBe('user-1');
    expect(me).not.toHaveProperty('passwordHash');
  });

  it('returns undefined for an unknown id', async () => {
    expect(await getMe(db, 'does-not-exist')).toBeUndefined();
  });
});
