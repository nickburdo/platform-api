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
} from '../db/auth/users.repository';
import { deleteHealthDataByUserId } from '../db/health-monitor/account-data.repository';
import { deleteJobApplicationsByUserId } from '../db/job-tracker/job-applications.repository';
import type { loginSchema, registerSchema } from '../schemas/auth.schema';
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

// TEMPORARY minimal form (Task 6 rewrites the Google flow): looks the user up
// by Google sub and never creates one.
export async function loginWithGoogle(
  db: AuthDb,
  googleSub: string,
  jwtSecret: string,
): Promise<LoginResult | null> {
  const user = await findUserByGoogleSub(db, googleSub);
  if (!user) {
    return null;
  }
  const token = await issueToken(user.id, jwtSecret);
  return { token, user: toPublicUser(user) };
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
