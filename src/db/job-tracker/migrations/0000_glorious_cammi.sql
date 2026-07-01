CREATE TABLE `job_applications` (
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
	`is_demo` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `job_applications_status_idx` ON `job_applications` (`status`);--> statement-breakpoint
CREATE INDEX `job_applications_company_idx` ON `job_applications` (`company`);--> statement-breakpoint
CREATE INDEX `job_applications_is_demo_idx` ON `job_applications` (`is_demo`);