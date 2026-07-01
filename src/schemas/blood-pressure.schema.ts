import { z } from 'zod';
import { optionalFieldOrderRule, reasonRequiredWhenIgnoredRule } from './common.schema';

// List queries reuse `dateRangeQuerySchema` from common.schema.ts directly.

const systolicOverDiastolicRule = optionalFieldOrderRule<{
  systolic?: number;
  diastolic?: number;
}>(
  (data) => data.systolic,
  (data) => data.diastolic,
  (a, b) => a > b,
  'systolic must be greater than diastolic',
  ['systolic'],
);

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
