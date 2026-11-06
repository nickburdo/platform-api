import { sql } from 'drizzle-orm';
import { check, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// V4 (ADR-014): open username accounts, no email, no roles. A user signs in
// with a password, with Google (google_sub), or both. The username is stored
// as entered; uniqueness and lookup are case-insensitive through the
// expression index on lower(username) (v4-plan.md Decision 5). Usernames are
// ASCII-only, so SQLite's ASCII-only lower() is sufficient.
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull(),
    passwordHash: text('password_hash'),
    googleSub: text('google_sub'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('users_username_lower_idx').on(sql`lower(${table.username})`),
    uniqueIndex('users_google_sub_idx').on(table.googleSub),
    // Decision 7: an account must always be able to sign in somehow.
    check(
      'users_credential_check',
      sql`${table.passwordHash} IS NOT NULL OR ${table.googleSub} IS NOT NULL`,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
