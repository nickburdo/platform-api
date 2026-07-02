import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Only 'ADMIN' is ever stored in V2 — the column is an enum for schema
// durability if multi-role support ever lands (ADR-012). GUEST is not a
// persisted value; it is the absence of a valid token.
export const USER_ROLES = ['ADMIN'] as const;

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    // Stored lowercase — normalization happens in the bootstrap script and
    // at login before lookup (v2-plan.md Decision #12).
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: USER_ROLES }).notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('users_email_idx').on(table.email)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
