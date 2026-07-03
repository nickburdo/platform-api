import { z } from 'zod';
import { JOB_APPLICATION_STATUSES, REMOTE_TYPES } from '../db/job-tracker/schema';
import { atLeastOneFieldRule, paginationQuerySchema } from './common.schema';

// No `.default()` here — defaults are applied only in createJobApplicationSchema
// below. Zod's `.partial()` (used by updateJobApplicationSchema) strips the
// "required" constraint from a field but NOT its `.default()`, so a defaulted
// field here would silently reappear with its default value on every partial
// update that omits it (e.g. a PATCH touching only `notes` would reset
// `status`/`currency` back to SAVED/USD).
const jobApplicationShape = {
  company: z.string('company is required').min(1, 'company is required'),
  position: z.string('position is required').min(1, 'position is required'),
  vacancyUrl: z.string().url().optional(),
  status: z.enum(JOB_APPLICATION_STATUSES),
  source: z.string().optional(),
  salaryMin: z.number().int('salaryMin must be a whole number').optional(),
  salaryMax: z.number().int('salaryMax must be a whole number').optional(),
  currency: z.string('currency is required').min(1, 'currency is required'),
  location: z.string().optional(),
  remoteType: z.enum(REMOTE_TYPES).optional(),
  notes: z.string().optional(),
  appliedAt: z.string().datetime().optional(),
  nextFollowUpAt: z.string().datetime().optional(),
};

// Written as explicit, un-abstracted checks (not a shared generic helper) —
// a previous consolidation into a generic `optionalFieldOrderRule<TData>`
// that took getter functions type-checked identically regardless of which
// field was passed as "A" vs "B", so a swapped getter pair would silently
// invert a rule's direction with no compiler error (confirmed by live
// reproduction during code review). Explicit field access here is longer but
// impossible to swap without the mistake being visible at the call site.
const salaryRangeRule = {
  check: (data: { salaryMin?: number; salaryMax?: number }) =>
    data.salaryMin == null || data.salaryMax == null || data.salaryMin <= data.salaryMax,
  options: {
    message: 'salaryMin must be less than or equal to salaryMax',
    path: ['salaryMin'] as PropertyKey[],
  },
};

const followUpRule = {
  check: (data: { appliedAt?: string; nextFollowUpAt?: string }) =>
    !data.appliedAt || !data.nextFollowUpAt || data.appliedAt <= data.nextFollowUpAt,
  options: {
    message: 'appliedAt must be less than or equal to nextFollowUpAt',
    path: ['appliedAt'] as PropertyKey[],
  },
};

// Body schemas are `.strict()` — unknown keys (server-managed fields, typos)
// are a 400, not silently dropped (Decision #32). Query schemas stay lax.
export const createJobApplicationSchema = z
  .object(jobApplicationShape)
  .extend({
    status: z.enum(JOB_APPLICATION_STATUSES).default('SAVED'),
    currency: z.string('currency is required').min(1, 'currency is required').default('USD'),
  })
  .strict()
  .refine(salaryRangeRule.check, salaryRangeRule.options)
  .refine(followUpRule.check, followUpRule.options);

export const updateJobApplicationSchema = z
  .object(jobApplicationShape)
  .partial()
  .strict()
  .refine(atLeastOneFieldRule.check, atLeastOneFieldRule.options)
  .refine(salaryRangeRule.check, salaryRangeRule.options)
  .refine(followUpRule.check, followUpRule.options);

export const listJobApplicationsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(JOB_APPLICATION_STATUSES).optional(),
  company: z.string().optional(),
  search: z.string().optional(),
});
