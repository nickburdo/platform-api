import { z } from 'zod';
import { reasonRequiredWhenIgnoredRule } from './common.schema';

// List queries reuse `dateRangeQuerySchema` from common.schema.ts directly.

// Written as an explicit, un-abstracted check — see job-applications.schema.ts
// for why the shared generic this used to go through was removed.
const systolicOverDiastolicRule = {
  check: (data: { systolic?: number; diastolic?: number }) =>
    data.systolic == null || data.diastolic == null || data.systolic > data.diastolic,
  options: {
    message: 'systolic must be greater than diastolic',
    path: ['systolic'] as PropertyKey[],
  },
};

export const createBloodPressureSchema = z
  .object({
    measuredAt: z.string().datetime(),
    systolic: z.number().int().positive(),
    diastolic: z.number().int().positive(),
    pulse: z.number().int().positive(),
    note: z.string().optional(),
  })
  .refine(systolicOverDiastolicRule.check, systolicOverDiastolicRule.options);

export const updateBloodPressureSchema = z
  .object({
    measuredAt: z.string().datetime(),
    systolic: z.number().int().positive(),
    diastolic: z.number().int().positive(),
    pulse: z.number().int().positive(),
    note: z.string().optional(),
    ignored: z.boolean().optional(),
    reason: z.string().optional(),
  })
  .partial()
  .refine(systolicOverDiastolicRule.check, systolicOverDiastolicRule.options)
  .refine(reasonRequiredWhenIgnoredRule.check, reasonRequiredWhenIgnoredRule.options);
