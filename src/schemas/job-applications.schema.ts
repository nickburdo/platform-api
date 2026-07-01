import { z } from 'zod';
import { JOB_APPLICATION_STATUSES, REMOTE_TYPES } from '../db/job-tracker/schema';
import { optionalFieldOrderRule, paginationQuerySchema } from './common.schema';

// No `.default()` here — defaults are applied only in createJobApplicationSchema
// below. Zod's `.partial()` (used by updateJobApplicationSchema) strips the
// "required" constraint from a field but NOT its `.default()`, so a defaulted
// field here would silently reappear with its default value on every partial
// update that omits it (e.g. a PATCH touching only `notes` would reset
// `status`/`currency` back to SAVED/USD).
const jobApplicationShape = {
  company: z.string().min(1),
  position: z.string().min(1),
  vacancyUrl: z.string().url().optional(),
  status: z.enum(JOB_APPLICATION_STATUSES),
  source: z.string().optional(),
  salaryMin: z.number().int().optional(),
  salaryMax: z.number().int().optional(),
  currency: z.string().min(1),
  location: z.string().optional(),
  remoteType: z.enum(REMOTE_TYPES).optional(),
  notes: z.string().optional(),
  appliedAt: z.string().datetime().optional(),
  nextFollowUpAt: z.string().datetime().optional(),
};

const salaryRangeRule = optionalFieldOrderRule<{ salaryMin?: number; salaryMax?: number }>(
  (data) => data.salaryMin,
  (data) => data.salaryMax,
  (a, b) => a <= b,
  'salaryMin must be less than or equal to salaryMax',
  ['salaryMin'],
);

const followUpRule = optionalFieldOrderRule<{ appliedAt?: string; nextFollowUpAt?: string }>(
  (data) => data.appliedAt,
  (data) => data.nextFollowUpAt,
  (a, b) => a <= b,
  'appliedAt must be less than or equal to nextFollowUpAt',
  ['appliedAt'],
);

export const createJobApplicationSchema = z
  .object(jobApplicationShape)
  .extend({
    status: z.enum(JOB_APPLICATION_STATUSES).default('SAVED'),
    currency: z.string().min(1).default('USD'),
  })
  .refine(salaryRangeRule.check, salaryRangeRule.options)
  .refine(followUpRule.check, followUpRule.options);

export const updateJobApplicationSchema = z
  .object(jobApplicationShape)
  .partial()
  .refine(salaryRangeRule.check, salaryRangeRule.options)
  .refine(followUpRule.check, followUpRule.options);

export const listJobApplicationsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(JOB_APPLICATION_STATUSES).optional(),
  company: z.string().optional(),
  search: z.string().optional(),
});
