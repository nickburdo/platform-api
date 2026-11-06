import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthDb } from '../db/auth/client';
import { users } from '../db/auth/schema';
import { freshAuthDb } from '../db/auth/test-helpers';
import { hashPassword } from '../utils/password';
import { verifyToken } from '../utils/jwt';
import { findUserById } from '../db/auth/users.repository';
import { createHealthMonitorDb } from '../db/health-monitor/client';
import { createJobTrackerDb } from '../db/job-tracker/client';
import {
  deleteAccount,
  getMe,
  linkGoogle,
  login,
  loginWithGoogle,
  register,
  setPassword,
  startGoogleLink,
  toPublicUser,
} from './auth.service';

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

describe('loginWithGoogle', () => {
  it('logs in the existing account with that sub', async () => {
    await seedGoogleOnlyUser();
    const result = await loginWithGoogle(db, 'sub-123', SECRET);
    expect(await verifyToken(result.token, SECRET)).toEqual({ sub: 'google-1' });
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it('creates a password-less account with a generated username for an unknown sub', async () => {
    const result = await loginWithGoogle(db, 'brand-new-sub', SECRET);
    expect(result.user.username).toMatch(/^user-[0-9a-f]{6}$/);
    expect(result.user.hasPassword).toBe(false);
    const row = await findUserById(db, result.user.id);
    expect(row?.passwordHash).toBeNull();
    expect(row?.googleSub).toBe('brand-new-sub');
    expect((await verifyToken(result.token, SECRET))?.sub).toBe(result.user.id);
  });

  it('returns the same account on a second login with the same sub (no second row)', async () => {
    const first = await loginWithGoogle(db, 'brand-new-sub', SECRET);
    const second = await loginWithGoogle(db, 'brand-new-sub', SECRET);
    expect(second.user.id).toBe(first.user.id);
    expect(await db.select().from(users)).toHaveLength(1);
  });
});

describe('linkGoogle', () => {
  it('links a sub to a user without one', async () => {
    await seedUser();
    expect(await linkGoogle(db, 'user-1', 'sub-1')).toBe('ok');
    expect((await findUserById(db, 'user-1'))?.googleSub).toBe('sub-1');
  });

  it('returns already_used when another account owns the sub', async () => {
    await seedUser();
    const other = await loginWithGoogle(db, 'sub-1', SECRET);
    expect(await linkGoogle(db, 'user-1', 'sub-1')).toBe('already_used');
    expect((await findUserById(db, 'user-1'))?.googleSub).toBeNull();
    expect((await findUserById(db, other.user.id))?.googleSub).toBe('sub-1');
  });

  it('returns failed when the user is gone or already linked', async () => {
    expect(await linkGoogle(db, 'missing', 'sub-1')).toBe('failed');
    await seedUser();
    await linkGoogle(db, 'user-1', 'sub-1');
    expect(await linkGoogle(db, 'user-1', 'sub-2')).toBe('failed');
    expect(await linkGoogle(db, 'user-1', 'sub-1')).toBe('failed');
    expect((await findUserById(db, 'user-1'))?.googleSub).toBe('sub-1');
  });
});

describe('startGoogleLink', () => {
  it('reports ok, already_linked and no_user', async () => {
    expect(await startGoogleLink(db, 'user-1')).toBe('no_user');
    await seedUser();
    expect(await startGoogleLink(db, 'user-1')).toBe('ok');
    await linkGoogle(db, 'user-1', 'sub-1');
    expect(await startGoogleLink(db, 'user-1')).toBe('already_linked');
  });
});

describe('setPassword', () => {
  it('sets the password of a Google-only user and returns the public user', async () => {
    const g = await loginWithGoogle(db, 'sub-1', SECRET);
    const result = await setPassword(db, g.user.id, { password: 'brand-new-password' });
    expect(result).toMatchObject({ id: g.user.id, hasPassword: true });
    const logged = await login(
      db,
      { username: g.user.username, password: 'brand-new-password' },
      SECRET,
    );
    expect(logged?.user.id).toBe(g.user.id);
  });

  it('returns already_set for a password account', async () => {
    await seedUser();
    expect(await setPassword(db, 'user-1', { password: 'another-password' })).toBe('already_set');
  });

  it('returns username_taken and leaves the account password-less', async () => {
    await seedUser({ username: 'Nick' });
    const g = await loginWithGoogle(db, 'sub-1', SECRET);
    expect(
      await setPassword(db, g.user.id, { password: 'brand-new-password', username: 'nick' }),
    ).toBe('username_taken');
    expect(toPublicUser((await findUserById(db, g.user.id))!).hasPassword).toBe(false);
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

describe('deleteAccount', () => {
  it('leaves the user row in place when the health-monitor step fails, so a retry can finish', async () => {
    await seedUser();
    const realHealthDb = createHealthMonitorDb(env.HEALTH_MONITOR_DB);
    const failingHealthDb = Object.assign(Object.create(realHealthDb), {
      batch: async () => {
        throw new Error('batch failed');
      },
    }) as typeof realHealthDb;
    const dbs = {
      authDb: db,
      jobTrackerDb: createJobTrackerDb(env.JOB_TRACKER_DB),
      healthMonitorDb: failingHealthDb,
    };

    await expect(deleteAccount(dbs, 'user-1')).rejects.toThrow('batch failed');
    expect(await findUserById(db, 'user-1')).toBeDefined();

    await deleteAccount(
      { ...dbs, healthMonitorDb: createHealthMonitorDb(env.HEALTH_MONITOR_DB) },
      'user-1',
    );
    expect(await findUserById(db, 'user-1')).toBeUndefined();
  });
});
