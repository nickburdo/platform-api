import type { z } from 'zod';
import type { AuthDb } from '../db/auth/client';
import type { HealthMonitorDb } from '../db/health-monitor/client';
import type { JobTrackerDb } from '../db/job-tracker/client';
import type { User } from '../db/auth/schema';
import {
  deleteUserById,
  findUserByGoogleSub,
  findUserById,
  findUserByUsername,
  insertUser,
  isUniqueViolation,
  setGoogleSub,
  setInitialPassword,
} from '../db/auth/users.repository';
import { deleteHealthDataByUserId } from '../db/health-monitor/account-data.repository';
import { deleteJobApplicationsByUserId } from '../db/job-tracker/job-applications.repository';
import type { loginSchema, registerSchema, setPasswordSchema } from '../schemas/auth.schema';
import { issueToken } from '../utils/jwt';
import { hashPassword, verifyPassword } from '../utils/password';

// The public shape of a user — passwordHash and googleSub never leave the
// service layer; hasPassword tells the frontend whether the account is
// Google-only.
export interface PublicUser {
  id: string;
  username: string;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    hasPassword: user.passwordHash !== null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export interface LoginResult {
  token: string;
  user: PublicUser;
}

// Decision 6: no availability pre-check — insert and map the unique
// violation, which is race-free.
export async function register(
  db: AuthDb,
  input: z.infer<typeof registerSchema>,
  jwtSecret: string,
): Promise<LoginResult | 'username_taken'> {
  const now = new Date().toISOString();
  let user: User;
  try {
    user = await insertUser(db, {
      id: crypto.randomUUID(),
      username: input.username,
      passwordHash: await hashPassword(input.password),
      googleSub: null,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return 'username_taken';
    }
    throw err;
  }
  const token = await issueToken(user.id, jwtSecret);
  return { token, user: toPublicUser(user) };
}

// A fixed, pre-computed stored hash (real self-describing format, no
// corresponding real password) verified against when the username is unknown
// or the account has no password. Without this, those cases would return
// before ever calling verifyPassword while a known password account always
// pays the ~100k-iteration PBKDF2 cost — a timing side channel that leaks
// which usernames exist even though every case returns the identical 401.
const DUMMY_PASSWORD_HASH =
  'pbkdf2-sha256:100000:qe5pSrFIwhct7g7escrAwg==:A3bKG+lWUl+5dxOMlifCo+o11nYOVyNuYcakfelMFNM=';

// Returns null for unknown username, wrong password and Google-only accounts
// alike — the route maps all of them to the same generic 401.
export async function login(
  db: AuthDb,
  input: z.infer<typeof loginSchema>,
  jwtSecret: string,
): Promise<LoginResult | null> {
  const user = await findUserByUsername(db, input.username);
  const storedHash = user?.passwordHash ?? null;
  const passwordOk = await verifyPassword(input.password, storedHash ?? DUMMY_PASSWORD_HASH);
  if (!user || storedHash === null || !passwordOk) {
    return null;
  }
  const token = await issueToken(user.id, jwtSecret);
  return { token, user: toPublicUser(user) };
}

// Always reads fresh from auth-db. Returns undefined if the user row no
// longer exists.
export async function getMe(db: AuthDb, userId: string): Promise<PublicUser | undefined> {
  const user = await findUserById(db, userId);
  return user ? toPublicUser(user) : undefined;
}

const GENERATED_USERNAME_ATTEMPTS = 5;

function generateUsername(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(3));
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `user-${hex}`;
}

// Decision 15: find the account by Google `sub`, or create it (no password)
// with a generated username. A unique violation is either a username
// collision (retry with a new name) or a concurrent first login with the same
// sub (the row now exists — use it). After 5 collisions it throws.
export async function loginWithGoogle(
  db: AuthDb,
  googleSub: string,
  jwtSecret: string,
): Promise<LoginResult> {
  let user = await findUserByGoogleSub(db, googleSub);
  for (let attempt = 0; !user && attempt < GENERATED_USERNAME_ATTEMPTS; attempt++) {
    const now = new Date().toISOString();
    try {
      user = await insertUser(db, {
        id: crypto.randomUUID(),
        username: generateUsername(),
        passwordHash: null,
        googleSub,
        createdAt: now,
        updatedAt: now,
      });
    } catch (err) {
      if (!isUniqueViolation(err)) {
        throw err;
      }
      user = await findUserByGoogleSub(db, googleSub);
    }
  }
  if (!user) {
    throw new Error('Could not generate a unique username for a Google account');
  }
  const token = await issueToken(user.id, jwtSecret);
  return { token, user: toPublicUser(user) };
}

// Pre-check for POST /auth/google/link, before a Google URL is handed out.
export async function startGoogleLink(
  db: AuthDb,
  userId: string,
): Promise<'ok' | 'already_linked' | 'no_user'> {
  const user = await findUserById(db, userId);
  if (!user) {
    return 'no_user';
  }
  return user.googleSub === null ? 'ok' : 'already_linked';
}

// Decision 19: runs at callback time, up to 10 minutes after the state was
// issued, so everything is re-checked. 'already_used' = the sub belongs to
// another account; 'failed' = the user is gone or already linked.
export async function linkGoogle(
  db: AuthDb,
  userId: string,
  googleSub: string,
): Promise<'ok' | 'already_used' | 'failed'> {
  const owner = await findUserByGoogleSub(db, googleSub);
  if (owner) {
    return owner.id === userId ? 'failed' : 'already_used';
  }
  try {
    return (await setGoogleSub(db, userId, googleSub)) ? 'ok' : 'failed';
  } catch (err) {
    if (!isUniqueViolation(err)) {
      throw err;
    }
    // Race: another account claimed the sub after the check above. The only
    // unique index touched by setGoogleSub is google_sub.
    const winner = await findUserByGoogleSub(db, googleSub);
    return winner && winner.id !== userId ? 'already_used' : 'failed';
  }
}

// Decision 21. Returns the updated public user, or a reason.
export async function setPassword(
  db: AuthDb,
  userId: string,
  input: z.infer<typeof setPasswordSchema>,
): Promise<PublicUser | 'already_set' | 'username_taken' | 'no_user'> {
  const result = await setInitialPassword(
    db,
    userId,
    await hashPassword(input.password),
    input.username,
  );
  if (result !== 'ok') {
    return result;
  }
  const user = await findUserById(db, userId);
  return user ? toPublicUser(user) : 'no_user';
}

export interface AccountDeletionDbs {
  authDb: AuthDb;
  jobTrackerDb: JobTrackerDb;
  healthMonitorDb: HealthMonitorDb;
}

// C6: business data first, the user row last. The databases cannot share a
// transaction, so if a step fails the user row still exists and the caller
// can retry the whole deletion.
export async function deleteAccount(dbs: AccountDeletionDbs, userId: string): Promise<void> {
  await deleteJobApplicationsByUserId(dbs.jobTrackerDb, userId);
  await deleteHealthDataByUserId(dbs.healthMonitorDb, userId);
  await deleteUserById(dbs.authDb, userId);
}
