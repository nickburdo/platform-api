import { env } from 'cloudflare:test';
import app from '../app';

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
): Promise<Response> {
  return app.request(
    path,
    { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    env,
  );
}
