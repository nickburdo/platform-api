import { z } from 'zod';
import { atLeastOneFieldRule, reasonRequiredWhenIgnoredRule } from './common.schema';

// List queries reuse `dateRangeQuerySchema` from common.schema.ts directly —
// there's no glucose-specific query parameter beyond date_from/date_to.

const glucoseValueShape = {
  fastingValue: z.number().positive('fastingValue must be greater than 0').optional(),
  afterMealValue: z.number().positive('afterMealValue must be greater than 0').optional(),
};

// Exactly one of fastingValue/afterMealValue must be present — never both,
// never neither (v1-plan.md Decision #19).
function hasExactlyOneGlucoseValue(data: { fastingValue?: number; afterMealValue?: number }) {
  return (data.fastingValue !== undefined) !== (data.afterMealValue !== undefined);
}

const exactlyOneGlucoseValueRule = {
  message: 'Exactly one of fastingValue or afterMealValue must be provided',
  path: ['fastingValue'] as PropertyKey[],
};

// Body schemas are `.strict()` — unknown keys are a 400 (Decision #32).
export const createGlucoseSchema = z
  .object({
    measuredAt: z.string().datetime(),
    ...glucoseValueShape,
    note: z.string().optional(),
  })
  .strict()
  .refine(hasExactlyOneGlucoseValue, exactlyOneGlucoseValueRule);

export const updateGlucoseSchema = z
  .object({
    measuredAt: z.string().datetime(),
    ...glucoseValueShape,
    note: z.string().optional(),
    ignored: z.boolean().optional(),
    reason: z.string().optional(),
  })
  .partial()
  .strict()
  .refine(atLeastOneFieldRule.check, atLeastOneFieldRule.options)
  .refine(
    (data) =>
      data.fastingValue === undefined && data.afterMealValue === undefined
        ? true
        : hasExactlyOneGlucoseValue(data),
    exactlyOneGlucoseValueRule,
  )
  .refine(reasonRequiredWhenIgnoredRule.check, reasonRequiredWhenIgnoredRule.options);
