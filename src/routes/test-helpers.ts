import { env } from 'cloudflare:test';
import app from '../app';

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
