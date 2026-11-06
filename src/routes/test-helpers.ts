import { env } from 'cloudflare:test';
import app from '../app';
import { createAuthDb } from '../db/auth/client';
import { users } from '../db/auth/schema';
import { issueToken } from '../utils/jwt';
import { hashPassword } from '../utils/password';

// Response-envelope shapes shared by all route test files — one definition
// instead of a per-file copy that could drift from the real contract.
export interface DataEnvelope {
  data: Record<string, unknown>;
}

export interface ListEnvelope {
  data: Record<string, unknown>[];
  meta: Record<string, unknown>;
}

export interface ErrorEnvelope {
  error: { message: string; details?: Record<string, unknown> };
}

// Drives the real, fully-wired Hono app (middleware, routers, error
// handlers) against the ephemeral test D1 bindings (Decision #36).
export async function request(path: string, init?: RequestInit): Promise<Response> {
  return app.request(path, init, env);
}

export async function requestJson(
  method: 'POST' | 'PATCH',
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return app.request(
    path,
    {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    },
    env,
  );
}

// Inserts a user directly into the ephemeral test auth-db and issues a real
// token for it — the fast path for route tests that need an authenticated
// request without exercising /auth/login itself.
export async function seedUserAndGetToken(
  overrides: { username?: string; password?: string } = {},
): Promise<{ userId: string; token: string; username: string; password: string }> {
  const userId = crypto.randomUUID();
  const username = overrides.username ?? 'testuser';
  const password = overrides.password ?? 'super-secret-password';
  const now = new Date().toISOString();
  const authDb = createAuthDb(env.AUTH_DB);
  await authDb.insert(users).values({
    id: userId,
    username,
    passwordHash: await hashPassword(password),
    googleSub: null,
    createdAt: now,
    updatedAt: now,
  });
  const token = await issueToken(userId, env.JWT_SECRET);
  return { userId, token, username, password };
}

export function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
