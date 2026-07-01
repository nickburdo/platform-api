import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().min(1),
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
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

type Comparable = number | string;

// Shared by every cross-field ".refine()" that only fires when both optional
// fields are present (e.g. salaryMin/salaryMax, appliedAt/nextFollowUpAt,
// systolic/diastolic) — absent on either side means "nothing to compare yet",
// not a validation failure.
export function optionalFieldOrderRule<TData>(
  getA: (data: TData) => Comparable | undefined,
  getB: (data: TData) => Comparable | undefined,
  compare: (a: Comparable, b: Comparable) => boolean,
  message: string,
  path: PropertyKey[],
) {
  return {
    check: (data: TData) => {
      const a = getA(data);
      const b = getB(data);
      return a == null || b == null || compare(a, b);
    },
    options: { message, path },
  };
}
