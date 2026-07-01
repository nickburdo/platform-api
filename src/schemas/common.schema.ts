import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().min(1),
});

const isoDateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a date in YYYY-MM-DD format');

// date_to is inclusive of the whole day — widened to end-of-day by the
// repository/service layer before comparison (see v1-plan.md Decision #21).
export const dateRangeQuerySchema = z
  .object({
    date_from: isoDateOnly.optional(),
    date_to: isoDateOnly.optional(),
  })
  .refine((data) => !data.date_from || !data.date_to || data.date_from <= data.date_to, {
    message: 'date_from must be less than or equal to date_to',
    path: ['date_from'],
  });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
