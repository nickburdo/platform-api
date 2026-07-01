import { z } from 'zod';

// List queries reuse `dateRangeQuerySchema` from common.schema.ts directly —
// there's no glucose-specific query parameter beyond date_from/date_to.

const glucoseValueShape = {
  fastingValue: z.number().positive().optional(),
  afterMealValue: z.number().positive().optional(),
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

export const createGlucoseSchema = z
  .object({
    measuredAt: z.string().datetime(),
    ...glucoseValueShape,
    note: z.string().optional(),
  })
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
  .refine(
    (data) =>
      data.fastingValue === undefined && data.afterMealValue === undefined
        ? true
        : hasExactlyOneGlucoseValue(data),
    exactlyOneGlucoseValueRule,
  );
