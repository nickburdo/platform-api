-- V4 (Decision 8): drop and recreate without copying rows. The V2 admin row has
-- no username and U8 removes it, so there is nothing to carry over.
DROP INDEX `users_email_idx`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text,
	`google_sub` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "users_credential_check" CHECK("users"."password_hash" IS NOT NULL OR "users"."google_sub" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_lower_idx` ON `users` (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_sub_idx` ON `users` (`google_sub`);