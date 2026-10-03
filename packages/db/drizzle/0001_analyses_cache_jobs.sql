CREATE TABLE `analyses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`user_id` text,
	`url` text,
	`source_domain` text,
	`extracted` text,
	`property` text NOT NULL,
	`area_id` integer,
	`lat` real,
	`lng` real,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analyses_public_id_unique` ON `analyses` (`public_id`);--> statement-breakpoint
CREATE INDEX `analyses_user_idx` ON `analyses` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `area_boundaries` (
	`area_id` integer PRIMARY KEY NOT NULL,
	`geometry` text NOT NULL,
	`min_lng` real NOT NULL,
	`min_lat` real NOT NULL,
	`max_lng` real NOT NULL,
	`max_lat` real NOT NULL,
	`source` text NOT NULL,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reference_rates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`date` text NOT NULL,
	`value` real NOT NULL,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reference_rates_key_idx` ON `reference_rates` (`name`,`date`,`source`);--> statement-breakpoint
CREATE TABLE `cache` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`payload` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`run_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`locked_at` integer,
	`last_error` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jobs_pick_idx` ON `jobs` (`status`,`run_at`);--> statement-breakpoint
ALTER TABLE `scenarios` ADD `analysis_id` integer REFERENCES analyses(id);--> statement-breakpoint
ALTER TABLE `scenarios` ADD `share_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `scenarios_share_token_unique` ON `scenarios` (`share_token`);