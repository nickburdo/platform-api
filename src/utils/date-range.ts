export interface DateRangeInput {
  date_from?: string;
  date_to?: string;
}

export interface DateRangeBounds {
  from?: string;
  to?: string;
}

// Widens the YYYY-MM-DD date_from/date_to query params (Decision #21) into
// full ISO-8601 instant bounds for comparison against the stored datetime
// columns. date_to is inclusive of the entire day, not just midnight.
export function toDateRangeBounds({ date_from, date_to }: DateRangeInput): DateRangeBounds {
  return {
    from: date_from ? `${date_from}T00:00:00.000Z` : undefined,
    to: date_to ? `${date_to}T23:59:59.999Z` : undefined,
  };
}
