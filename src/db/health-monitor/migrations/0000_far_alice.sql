CREATE TABLE `blood_pressure_measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`ignored` integer DEFAULT false NOT NULL,
	`reason` text,
	`measured_at` text NOT NULL,
	`systolic` integer NOT NULL,
	`diastolic` integer NOT NULL,
	`pulse` integer NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE INDEX `blood_pressure_measurements_measured_at_idx` ON `blood_pressure_measurements` (`measured_at`);--> statement-breakpoint
CREATE TABLE `glucose_measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`ignored` integer DEFAULT false NOT NULL,
	`reason` text,
	`measured_at` text NOT NULL,
	`fasting_value` real,
	`after_meal_value` real,
	`note` text
);
--> statement-breakpoint
CREATE INDEX `glucose_measurements_measured_at_idx` ON `glucose_measurements` (`measured_at`);--> statement-breakpoint
CREATE TABLE `symptom_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`ignored` integer DEFAULT false NOT NULL,
	`reason` text,
	`happened_at` text NOT NULL,
	`type` text NOT NULL,
	`intensity` integer NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE INDEX `symptom_entries_happened_at_idx` ON `symptom_entries` (`happened_at`);--> statement-breakpoint
CREATE INDEX `symptom_entries_type_idx` ON `symptom_entries` (`type`);--> statement-breakpoint
CREATE TABLE `weight_measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`ignored` integer DEFAULT false NOT NULL,
	`reason` text,
	`measured_at` text NOT NULL,
	`value` real NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE INDEX `weight_measurements_measured_at_idx` ON `weight_measurements` (`measured_at`);