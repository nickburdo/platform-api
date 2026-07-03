import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string('id is required').min(1, 'id is required'),
});

// The regex only checks digit-grouping shape; the refine below rejects
// shape-valid-but-calendar-invalid values (e.g. month 13, day 99, Feb 30) by
// round-tripping through Date and checking the ISO date component matches.
const isoDateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a date in YYYY-MM-DD format')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Must be a valid calendar date');

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
  page: z.coerce
    .number('page must be a number')
    .int('page must be a whole number')
    .min(1, 'page must be at least 1')
    .default(1),
  limit: z.coerce
    .number('limit must be a number')
    .int('limit must be a whole number')
    .min(1, 'limit must be between 1 and 100')
    .max(100, 'limit must be between 1 and 100')
    .default(20),
});

// Shared by every Health Monitor update schema: `reason` must be a non-empty
// string whenever `ignored: true` is set (Decision #26). No constraint is
// placed on `reason` when `ignored` is false/absent — restoring a record
// sends `reason: ""` by convention (api.md), but that's the client's choice,
// not something this rule enforces.
export const reasonRequiredWhenIgnoredRule = {
  check: (data: { ignored?: boolean; reason?: string }) =>
    !data.ignored || Boolean(data.reason && data.reason.trim().length > 0),
  options: {
    message: 'reason is required when ignored is true',
    path: ['reason'] as PropertyKey[],
  },
};

// Shared by every update (PATCH) schema: an empty body `{}` is a client
// error, not a no-op that silently bumps `updatedAt` (Decision #33). No
// `path` — this is an object-wide error, reported at the root.
export const atLeastOneFieldRule = {
  check: (data: Record<string, unknown>) => Object.keys(data).length > 0,
  options: {
    message: 'At least one field must be provided',
  },
};
