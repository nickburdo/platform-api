import { z } from 'zod';
import { reasonRequiredWhenIgnoredRule } from './common.schema';

// List queries reuse `dateRangeQuerySchema` from common.schema.ts directly.

export const createWeightSchema = z.object({
  measuredAt: z.string().datetime(),
  value: z.number().positive(),
  note: z.string().optional(),
});

export const updateWeightSchema = z
  .object({
    measuredAt: z.string().datetime(),
    value: z.number().positive(),
    note: z.string().optional(),
    ignored: z.boolean().optional(),
    reason: z.string().optional(),
  })
  .partial()
  .refine(reasonRequiredWhenIgnoredRule.check, reasonRequiredWhenIgnoredRule.options);
