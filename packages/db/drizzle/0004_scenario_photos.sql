CREATE TABLE `scenario_photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scenario_id` integer NOT NULL,
	`file_name` text NOT NULL,
	`original_name` text,
	`mime_type` text NOT NULL,
	`bytes` integer NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scenario_photos_file_name_unique` ON `scenario_photos` (`file_name`);--> statement-breakpoint
CREATE INDEX `scenario_photos_scenario_idx` ON `scenario_photos` (`scenario_id`,`id`);