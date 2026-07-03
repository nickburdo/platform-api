import { z } from 'zod';
import { atLeastOneFieldRule, reasonRequiredWhenIgnoredRule } from './common.schema';

// List queries reuse `dateRangeQuerySchema` from common.schema.ts directly.

// Body schemas are `.strict()` — unknown keys are a 400 (Decision #32).
export const createSymptomSchema = z
  .object({
    happenedAt: z.string().datetime(),
    type: z.string().min(1, 'type is required'),
    intensity: z
      .number()
      .int('intensity must be a whole number between 1 and 10')
      .min(1, 'intensity must be a whole number between 1 and 10')
      .max(10, 'intensity must be a whole number between 1 and 10'),
    note: z.string().optional(),
  })
  .strict();

export const updateSymptomSchema = z
  .object({
    happenedAt: z.string().datetime(),
    type: z.string().min(1, 'type is required'),
    intensity: z
      .number()
      .int('intensity must be a whole number between 1 and 10')
      .min(1, 'intensity must be a whole number between 1 and 10')
      .max(10, 'intensity must be a whole number between 1 and 10'),
    note: z.string().optional(),
    ignored: z.boolean().optional(),
    reason: z.string().optional(),
  })
  .partial()
  .strict()
  .refine(atLeastOneFieldRule.check, atLeastOneFieldRule.options)
  .refine(reasonRequiredWhenIgnoredRule.check, reasonRequiredWhenIgnoredRule.options);
