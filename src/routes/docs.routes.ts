import { swaggerUI } from '@hono/swagger-ui';
import { Hono } from 'hono';
import type { AppEnv } from '../app';
import openApiDocument from '../openapi/openapi.json';

// Serialized once at module scope, not per request — the document is a
// static, build-time-generated artifact (Decision #16) that never changes
// for the life of the deployment.
const openApiDocumentJson = JSON.stringify(openApiDocument);

// GET /openapi.json — serves the build-time-generated spec as-is (Decision
// #16/#18; regenerate via `npm run openapi:generate`, never rebuilt at
// request time). GET /docs — Swagger UI, pointed at the sibling route above,
// pinned to a specific swagger-ui-dist release (Decision #19) rather than
// floating to whatever the CDN currently resolves as "latest". Neither
// requires auth to view (roadmap.md Swagger UI section); "try it out" calls
// against real endpoints still need a real admin token, entered via the
// Authorize dialog Swagger UI renders from the spec's bearerAuth scheme.
export const docsRoutes = new Hono<AppEnv>()
  .get('/openapi.json', (c) =>
    c.body(openApiDocumentJson, 200, { 'Content-Type': 'application/json' }),
  )
  .get('/docs', swaggerUI({ url: '/openapi.json', version: '5.32.8' }));
