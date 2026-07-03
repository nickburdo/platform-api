import { z } from 'zod';
import { atLeastOneFieldRule, reasonRequiredWhenIgnoredRule } from './common.schema';

// List queries reuse `dateRangeQuerySchema` from common.schema.ts directly.

// Body schemas are `.strict()` — unknown keys are a 400 (Decision #32).
export const createWeightSchema = z
  .object({
    measuredAt: z.string().datetime(),
    value: z.number().positive('value must be greater than 0'),
    note: z.string().optional(),
  })
  .strict();

export const updateWeightSchema = z
  .object({
    measuredAt: z.string().datetime(),
    value: z.number().positive('value must be greater than 0'),
    note: z.string().optional(),
    ignored: z.boolean().optional(),
    reason: z.string().optional(),
  })
  .partial()
  .strict()
  .refine(atLeastOneFieldRule.check, atLeastOneFieldRule.options)
  .refine(reasonRequiredWhenIgnoredRule.check, reasonRequiredWhenIgnoredRule.options);
