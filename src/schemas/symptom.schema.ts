import { z } from 'zod';

// List queries reuse `dateRangeQuerySchema` from common.schema.ts directly.

export const createSymptomSchema = z.object({
  happenedAt: z.string().datetime(),
  type: z.string().min(1),
  intensity: z.number().int().min(1).max(10),
  note: z.string().optional(),
});

export const updateSymptomSchema = z
  .object({
    happenedAt: z.string().datetime(),
    type: z.string().min(1),
    intensity: z.number().int().min(1).max(10),
    note: z.string().optional(),
    ignored: z.boolean().optional(),
    reason: z.string().optional(),
  })
  .partial();
