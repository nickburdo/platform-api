import { z } from 'zod';
import { JOB_APPLICATION_STATUSES, REMOTE_TYPES } from '../db/job-tracker/schema';
import { paginationQuerySchema } from './common.schema';

const jobApplicationShape = {
  company: z.string().min(1),
  position: z.string().min(1),
  vacancyUrl: z.string().url().optional(),
  status: z.enum(JOB_APPLICATION_STATUSES).default('SAVED'),
  source: z.string().optional(),
  salaryMin: z.number().int().optional(),
  salaryMax: z.number().int().optional(),
  currency: z.string().min(1).default('USD'),
  location: z.string().optional(),
  remoteType: z.enum(REMOTE_TYPES).optional(),
  notes: z.string().optional(),
  appliedAt: z.string().datetime().optional(),
  nextFollowUpAt: z.string().datetime().optional(),
};

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

export const createJobApplicationSchema = z
  .object(jobApplicationShape)
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
