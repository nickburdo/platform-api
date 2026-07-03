import { z } from 'zod';
import { atLeastOneFieldRule, reasonRequiredWhenIgnoredRule } from './common.schema';

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

// Shared between create/update (mirrors glucose.schema.ts's glucoseValueShape)
// — each field's message is on both the base type call and `.int()`/
// `.positive()` so it fires whether the key is missing entirely (an
// `invalid_type` issue on the base call) or present-but-invalid (a
// `too_small`/`invalid_type` issue on the chained checks).
const bloodPressureValueShape = {
  systolic: z
    .number('systolic must be a positive whole number')
    .int('systolic must be a positive whole number')
    .positive('systolic must be a positive whole number'),
  diastolic: z
    .number('diastolic must be a positive whole number')
    .int('diastolic must be a positive whole number')
    .positive('diastolic must be a positive whole number'),
  pulse: z
    .number('pulse must be a positive whole number')
    .int('pulse must be a positive whole number')
    .positive('pulse must be a positive whole number'),
};

// Body schemas are `.strict()` — unknown keys are a 400 (Decision #32).
export const createBloodPressureSchema = z
  .object({
    measuredAt: z.string('measuredAt is required').datetime(),
    ...bloodPressureValueShape,
    note: z.string().optional(),
  })
  .strict()
  .refine(systolicOverDiastolicRule.check, systolicOverDiastolicRule.options);

export const updateBloodPressureSchema = z
  .object({
    measuredAt: z.string('measuredAt is required').datetime(),
    ...bloodPressureValueShape,
    note: z.string().optional(),
    ignored: z.boolean().optional(),
    reason: z.string().optional(),
  })
  .partial()
  .strict()
  .refine(atLeastOneFieldRule.check, atLeastOneFieldRule.options)
  .refine(systolicOverDiastolicRule.check, systolicOverDiastolicRule.options)
  .refine(reasonRequiredWhenIgnoredRule.check, reasonRequiredWhenIgnoredRule.options);
