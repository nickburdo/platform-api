CREATE TABLE `demo_refresh_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`refreshed_at` text NOT NULL,
	CONSTRAINT "demo_refresh_state_single_row" CHECK("demo_refresh_state"."id" = 1)
);
