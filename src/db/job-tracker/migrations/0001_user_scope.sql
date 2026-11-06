-- V4 (Decision 9): is_demo -> user_id (NULL = demo). Table rebuild; existing rows are
-- copied with user_id NULL because every pre-V4 row is demo data.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_job_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`company` text NOT NULL,
	`position` text NOT NULL,
	`vacancy_url` text,
	`status` text DEFAULT 'SAVED' NOT NULL,
	`source` text,
	`salary_min` integer,
	`salary_max` integer,
	`currency` text DEFAULT 'USD' NOT NULL,
	`location` text,
	`remote_type` text,
	`notes` text,
	`applied_at` text,
	`next_follow_up_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`user_id` text
);
--> statement-breakpoint
INSERT INTO `__new_job_applications`("id", "company", "position", "vacancy_url", "status", "source", "salary_min", "salary_max", "currency", "location", "remote_type", "notes", "applied_at", "next_follow_up_at", "created_at", "updated_at", "user_id") SELECT "id", "company", "position", "vacancy_url", "status", "source", "salary_min", "salary_max", "currency", "location", "remote_type", "notes", "applied_at", "next_follow_up_at", "created_at", "updated_at", NULL FROM `job_applications`;--> statement-breakpoint
DROP TABLE `job_applications`;--> statement-breakpoint
ALTER TABLE `__new_job_applications` RENAME TO `job_applications`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `job_applications_status_idx` ON `job_applications` (`status`);--> statement-breakpoint
CREATE INDEX `job_applications_company_idx` ON `job_applications` (`company`);--> statement-breakpoint
CREATE INDEX `job_applications_user_id_idx` ON `job_applications` (`user_id`);
