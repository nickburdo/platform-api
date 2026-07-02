import type { z } from 'zod';
import type { AuthDb } from '../db/auth/client';
import { findUserByEmail, findUserById } from '../db/auth/users.repository';
import type { User } from '../db/auth/schema';
import type { loginSchema } from '../schemas/auth.schema';
import { issueToken } from '../utils/jwt';
import { verifyPassword } from '../utils/password';

// The public shape of a user — passwordHash never leaves the service layer.
export type PublicUser = Omit<User, 'passwordHash'>;

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export interface LoginResult {
  token: string;
  user: PublicUser;
}

// A fixed, pre-computed stored hash (real self-describing format, no
// corresponding real password) verified against when the email is unknown.
// Without this, an unknown email would return before ever calling
// verifyPassword while a known email always pays the ~100k-iteration PBKDF2
// cost — a timing side channel that leaks which emails are registered even
// though both cases return the identical 401 body. Verifying against this
// constant keeps the two paths' cost equal.
const DUMMY_PASSWORD_HASH =
  'pbkdf2-sha256:100000:qe5pSrFIwhct7g7escrAwg==:A3bKG+lWUl+5dxOMlifCo+o11nYOVyNuYcakfelMFNM=';

// Returns null for unknown email and wrong password alike — the route maps
// both to the same generic 401 "Invalid credentials" (no user enumeration).
export async function login(
  db: AuthDb,
  input: z.infer<typeof loginSchema>,
  jwtSecret: string,
): Promise<LoginResult | null> {
  const email = input.email.toLowerCase();
  const user = await findUserByEmail(db, email);
  const passwordOk = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordOk) {
    return null;
  }
  const token = await issueToken(user.id, jwtSecret);
  return { token, user: toPublicUser(user) };
}

// Always reads fresh from auth-db (the token's claims may be up to 30 days
// stale). Returns undefined if the user row no longer exists.
export async function getMe(db: AuthDb, userId: string): Promise<PublicUser | undefined> {
  const user = await findUserById(db, userId);
  return user ? toPublicUser(user) : undefined;
}
