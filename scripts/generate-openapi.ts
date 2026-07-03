// Builds src/openapi/openapi.json from the registry (Decision #10/#15/#16).
//
//   npm run openapi:generate
//
// Targets OpenAPI 3.0.x (Decision #15) so that @hono/swagger-ui (Section 3)
// and @redocly/cli (spec-lint) both have mature support. Writes into
// src/openapi/ (Decision #16) so Section 3 can `import` the result directly
// into the Worker bundle — Cloudflare Workers have no runtime filesystem
// access, so the spec must be bundled in at build time, not read from disk.

import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { registry } from '../src/openapi/registry';

const generator = new OpenApiGeneratorV3(registry.definitions);

const document = generator.generateDocument({
  openapi: '3.0.3',
  info: {
    title: 'Platform API',
    version: '1.0.0',
    description:
      'Job Tracker, Health Monitor, and Auth. See docs/api.md for the human-authored source of truth (ADR-011).',
  },
  servers: [
    { url: 'https://platform-api.nick-burdo.workers.dev', description: 'Production' },
    { url: 'http://127.0.0.1:8787', description: 'Local development' },
  ],
});

const outputPath = join(import.meta.dirname, '../src/openapi/openapi.json');
writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

console.log(`openapi.json written to ${outputPath}`);
