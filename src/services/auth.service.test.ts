import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthDb } from '../db/auth/client';
import { users } from '../db/auth/schema';
import { freshAuthDb } from '../db/auth/test-helpers';
import { hashPassword } from '../utils/password';
import { verifyToken } from '../utils/jwt';
import { getMe, login, loginWithGoogle, toPublicUser } from './auth.service';

let db: AuthDb;

const SECRET = 'auth-service-test-secret';

beforeEach(async () => {
  db = await freshAuthDb();
});

async function seedAdmin(overrides: { email?: string; password?: string } = {}) {
  const email = overrides.email ?? 'admin@example.com';
  const password = overrides.password ?? 'super-secret-password';
  const now = new Date().toISOString();
  await db.insert(users).values({
    id: 'admin-1',
    email,
    passwordHash: await hashPassword(password),
    role: 'ADMIN',
    createdAt: now,
    updatedAt: now,
  });
  return { email, password };
}

describe('toPublicUser', () => {
  it('strips passwordHash', async () => {
    await seedAdmin();
    const [user] = await db.select().from(users);
    const publicUser = toPublicUser(user!);
    expect(publicUser).not.toHaveProperty('passwordHash');
    expect(publicUser.id).toBe('admin-1');
  });
});

describe('login', () => {
  it('issues a verifiable token and the public user on correct credentials', async () => {
    const { email, password } = await seedAdmin();
    const result = await login(db, { email, password }, SECRET);
    expect(result).not.toBeNull();
    expect(result?.user.email).toBe(email);
    expect(result?.user).not.toHaveProperty('passwordHash');

    const payload = await verifyToken(result!.token, SECRET);
    expect(payload).toEqual({ sub: 'admin-1', role: 'ADMIN' });
  });

  it('normalizes email case before lookup', async () => {
    const { password } = await seedAdmin({ email: 'admin@example.com' });
    const result = await login(db, { email: 'Admin@Example.com', password }, SECRET);
    expect(result).not.toBeNull();
  });

  it('returns null for an unknown email', async () => {
    await seedAdmin();
    expect(await login(db, { email: 'nobody@example.com', password: 'x' }, SECRET)).toBeNull();
  });

  it('returns null for a wrong password', async () => {
    const { email } = await seedAdmin();
    expect(await login(db, { email, password: 'wrong password' }, SECRET)).toBeNull();
  });
});

describe('loginWithGoogle', () => {
  it('issues a token for the matching email, no password involved', async () => {
    const { email } = await seedAdmin();
    const result = await loginWithGoogle(db, email, SECRET);
    expect(result).not.toBeNull();
    expect(result?.user.email).toBe(email);
    expect(result?.user).not.toHaveProperty('passwordHash');

    const payload = await verifyToken(result!.token, SECRET);
    expect(payload).toEqual({ sub: 'admin-1', role: 'ADMIN' });
  });

  it('normalizes email case before lookup', async () => {
    await seedAdmin({ email: 'admin@example.com' });
    expect(await loginWithGoogle(db, 'Admin@Example.com', SECRET)).not.toBeNull();
  });

  it('returns null for an email with no matching account, and creates no user', async () => {
    await seedAdmin();
    expect(await loginWithGoogle(db, 'nobody@example.com', SECRET)).toBeNull();
    const rows = await db.select().from(users);
    expect(rows).toHaveLength(1);
  });
});

describe('getMe', () => {
  it('returns the public user for a valid id', async () => {
    await seedAdmin();
    const me = await getMe(db, 'admin-1');
    expect(me?.id).toBe('admin-1');
    expect(me).not.toHaveProperty('passwordHash');
  });

  it('returns undefined for an unknown id', async () => {
    expect(await getMe(db, 'does-not-exist')).toBeUndefined();
  });
});
