import { z } from 'zod';

// List queries reuse `dateRangeQuerySchema` from common.schema.ts directly.

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
    systolic: z.number().int(),
    diastolic: z.number().int(),
    pulse: z.number().int().positive(),
    note: z.string().optional(),
  })
  .refine(systolicOverDiastolicRule.check, systolicOverDiastolicRule.options);

export const updateBloodPressureSchema = z
  .object({
    measuredAt: z.string().datetime(),
    systolic: z.number().int(),
    diastolic: z.number().int(),
    pulse: z.number().int().positive(),
    note: z.string().optional(),
    ignored: z.boolean().optional(),
    reason: z.string().optional(),
  })
  .partial()
  .refine(systolicOverDiastolicRule.check, systolicOverDiastolicRule.options);
