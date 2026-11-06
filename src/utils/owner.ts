import { eq, isNull, type Column, type SQL } from 'drizzle-orm';

// null means the demo scope (rows with user_id IS NULL); v4-plan.md Decision 1.
export type OwnerId = string | null;

// The only place the demo/user branch exists.
export function ownerFilter(column: Column, ownerId: OwnerId): SQL {
  return ownerId === null ? isNull(column) : eq(column, ownerId);
}

// userId is never exposed in business responses (Decision 10).
export function omitUserId<T extends { userId: unknown }>(row: T): Omit<T, 'userId'> {
  const { userId, ...rest } = row;
  void userId;
  return rest;
}
