import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Must be the first thing registry.ts imports, before any src/schemas/*.ts
// module. extendZodWithOpenApi mutates Zod's shared prototype, but Zod v4
// does not retroactively expose `.openapi()` on schema instances already
// constructed before the patch runs (confirmed empirically) — only schemas
// created afterward pick it up. Since ES modules evaluate imports in
// declaration order, importing this module first guarantees every
// src/schemas/*.ts schema is constructed after this patch is in place.
extendZodWithOpenApi(z);
