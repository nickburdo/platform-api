-- V4 (Decision 9): is_demo -> user_id (NULL = demo). Table rebuilds; existing rows are
-- copied with user_id NULL because every pre-V4 row is demo data.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_blood_pressure_measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`user_id` text,
	`ignored` integer DEFAULT false NOT NULL,
	`reason` text,
	`measured_at` text NOT NULL,
	`systolic` integer NOT NULL,
	`diastolic` integer NOT NULL,
	`pulse` integer NOT NULL,
	`note` text
);
--> statement-breakpoint
INSERT INTO `__new_blood_pressure_measurements`("id", "created_at", "updated_at", "user_id", "ignored", "reason", "measured_at", "systolic", "diastolic", "pulse", "note") SELECT "id", "created_at", "updated_at", NULL, "ignored", "reason", "measured_at", "systolic", "diastolic", "pulse", "note" FROM `blood_pressure_measurements`;--> statement-breakpoint
DROP TABLE `blood_pressure_measurements`;--> statement-breakpoint
ALTER TABLE `__new_blood_pressure_measurements` RENAME TO `blood_pressure_measurements`;--> statement-breakpoint
CREATE TABLE `__new_glucose_measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`user_id` text,
	`ignored` integer DEFAULT false NOT NULL,
	`reason` text,
	`measured_at` text NOT NULL,
	`fasting_value` real,
	`after_meal_value` real,
	`note` text
);
--> statement-breakpoint
INSERT INTO `__new_glucose_measurements`("id", "created_at", "updated_at", "user_id", "ignored", "reason", "measured_at", "fasting_value", "after_meal_value", "note") SELECT "id", "created_at", "updated_at", NULL, "ignored", "reason", "measured_at", "fasting_value", "after_meal_value", "note" FROM `glucose_measurements`;--> statement-breakpoint
DROP TABLE `glucose_measurements`;--> statement-breakpoint
ALTER TABLE `__new_glucose_measurements` RENAME TO `glucose_measurements`;--> statement-breakpoint
CREATE TABLE `__new_symptom_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`user_id` text,
	`ignored` integer DEFAULT false NOT NULL,
	`reason` text,
	`happened_at` text NOT NULL,
	`type` text NOT NULL,
	`intensity` integer NOT NULL,
	`note` text
);
--> statement-breakpoint
INSERT INTO `__new_symptom_entries`("id", "created_at", "updated_at", "user_id", "ignored", "reason", "happened_at", "type", "intensity", "note") SELECT "id", "created_at", "updated_at", NULL, "ignored", "reason", "happened_at", "type", "intensity", "note" FROM `symptom_entries`;--> statement-breakpoint
DROP TABLE `symptom_entries`;--> statement-breakpoint
ALTER TABLE `__new_symptom_entries` RENAME TO `symptom_entries`;--> statement-breakpoint
CREATE TABLE `__new_weight_measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`user_id` text,
	`ignored` integer DEFAULT false NOT NULL,
	`reason` text,
	`measured_at` text NOT NULL,
	`value` real NOT NULL,
	`note` text
);
--> statement-breakpoint
INSERT INTO `__new_weight_measurements`("id", "created_at", "updated_at", "user_id", "ignored", "reason", "measured_at", "value", "note") SELECT "id", "created_at", "updated_at", NULL, "ignored", "reason", "measured_at", "value", "note" FROM `weight_measurements`;--> statement-breakpoint
DROP TABLE `weight_measurements`;--> statement-breakpoint
ALTER TABLE `__new_weight_measurements` RENAME TO `weight_measurements`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `blood_pressure_measurements_measured_at_idx` ON `blood_pressure_measurements` (`measured_at`);--> statement-breakpoint
CREATE INDEX `blood_pressure_measurements_user_id_idx` ON `blood_pressure_measurements` (`user_id`);--> statement-breakpoint
CREATE INDEX `glucose_measurements_measured_at_idx` ON `glucose_measurements` (`measured_at`);--> statement-breakpoint
CREATE INDEX `glucose_measurements_user_id_idx` ON `glucose_measurements` (`user_id`);--> statement-breakpoint
CREATE INDEX `symptom_entries_happened_at_idx` ON `symptom_entries` (`happened_at`);--> statement-breakpoint
CREATE INDEX `symptom_entries_type_idx` ON `symptom_entries` (`type`);--> statement-breakpoint
CREATE INDEX `symptom_entries_user_id_idx` ON `symptom_entries` (`user_id`);--> statement-breakpoint
CREATE INDEX `weight_measurements_measured_at_idx` ON `weight_measurements` (`measured_at`);--> statement-breakpoint
CREATE INDEX `weight_measurements_user_id_idx` ON `weight_measurements` (`user_id`);
