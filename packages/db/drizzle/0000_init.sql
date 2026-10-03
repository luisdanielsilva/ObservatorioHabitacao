CREATE TABLE `areas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text,
	`level` text NOT NULL,
	`parent_id` integer,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`path` text NOT NULL,
	`region` text NOT NULL,
	`lat` real,
	`lng` real,
	FOREIGN KEY (`parent_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `areas_code_unique` ON `areas` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `areas_path_unique` ON `areas` (`path`);--> statement-breakpoint
CREATE INDEX `areas_parent_idx` ON `areas` (`parent_id`);--> statement-breakpoint
CREATE INDEX `areas_level_idx` ON `areas` (`level`);--> statement-breakpoint
CREATE TABLE `scenarios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`listing_id` integer,
	`duplicated_from_id` integer,
	`name` text NOT NULL,
	`property` text NOT NULL,
	`inputs` text NOT NULL,
	`parameter_set_id` integer NOT NULL,
	`results` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`duplicated_from_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`parameter_set_id`) REFERENCES `parameter_sets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `scenarios_user_idx` ON `scenarios` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `valuation_comparables` (
	`valuation_id` integer NOT NULL,
	`listing_id` integer NOT NULL,
	`weight` real NOT NULL,
	`distance_m` real,
	PRIMARY KEY(`valuation_id`, `listing_id`),
	FOREIGN KEY (`valuation_id`) REFERENCES `valuations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `valuations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`listing_id` integer,
	`area_id` integer,
	`input` text NOT NULL,
	`low` integer NOT NULL,
	`likely` integer NOT NULL,
	`high` integer NOT NULL,
	`eur_per_m2` real NOT NULL,
	`monthly_rent` integer,
	`confidence` real NOT NULL,
	`model_version` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `valuations_user_idx` ON `valuations` (`user_id`);--> statement-breakpoint
CREATE TABLE `listing_photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer NOT NULL,
	`url` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`alt` text,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `listing_photos_listing_idx` ON `listing_photos` (`listing_id`,`position`);--> statement-breakpoint
CREATE TABLE `listing_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer NOT NULL,
	`source_id` integer NOT NULL,
	`external_id` text NOT NULL,
	`url` text,
	`last_seen_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `listing_sources_external_idx` ON `listing_sources` (`source_id`,`external_id`);--> statement-breakpoint
CREATE TABLE `listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`area_id` integer,
	`property_type` text NOT NULL,
	`bedrooms` integer,
	`area_m2` real,
	`condition` text,
	`price` integer NOT NULL,
	`title` text,
	`description` text,
	`address` text,
	`lat` real,
	`lng` real,
	`has_garage` integer DEFAULT false NOT NULL,
	`has_elevator` integer DEFAULT false NOT NULL,
	`has_balcony` integer DEFAULT false NOT NULL,
	`has_pool` integer DEFAULT false NOT NULL,
	`energy_rating` text,
	`year_built` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`first_seen_at` text DEFAULT (datetime('now')) NOT NULL,
	`last_seen_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `listings_area_idx` ON `listings` (`area_id`);--> statement-breakpoint
CREATE INDEX `listings_search_idx` ON `listings` (`status`,`property_type`,`price`);--> statement-breakpoint
CREATE TABLE `price_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer NOT NULL,
	`price` integer NOT NULL,
	`observed_at` text NOT NULL,
	`source_id` integer,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `price_history_listing_idx` ON `price_history` (`listing_id`,`observed_at`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`base_url` text,
	`permitted` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sources_name_unique` ON `sources` (`name`);--> statement-breakpoint
CREATE TABLE `al_indicators` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`area_id` integer NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`adr` real NOT NULL,
	`occupancy` real NOT NULL,
	`active_listings` integer,
	`source` text NOT NULL,
	`synthetic` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `al_indicators_key_idx` ON `al_indicators` (`area_id`,`year`,`month`,`source`);--> statement-breakpoint
CREATE TABLE `al_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`area_id` integer NOT NULL,
	`status` text NOT NULL,
	`valid_from` text NOT NULL,
	`source_url` text,
	`notes` text,
	`verified` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `al_rules_area_from_idx` ON `al_rules` (`area_id`,`valid_from`);--> statement-breakpoint
CREATE TABLE `imi_rates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`area_id` integer NOT NULL,
	`year` integer NOT NULL,
	`rate` real NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `imi_rates_area_year_idx` ON `imi_rates` (`area_id`,`year`);--> statement-breakpoint
CREATE TABLE `market_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`area_id` integer NOT NULL,
	`period` text NOT NULL,
	`metric` text NOT NULL,
	`value` real NOT NULL,
	`sample_size` integer,
	`source` text NOT NULL,
	`synthetic` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `market_stats_key_idx` ON `market_stats` (`area_id`,`period`,`metric`,`source`);--> statement-breakpoint
CREATE INDEX `market_stats_metric_period_idx` ON `market_stats` (`metric`,`period`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`user_id` text,
	`area_id` integer,
	`payload` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `events_type_idx` ON `events` (`type`,`created_at`);--> statement-breakpoint
CREATE TABLE `ingestion_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer,
	`kind` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`started_at` text,
	`finished_at` text,
	`items_seen` integer DEFAULT 0 NOT NULL,
	`items_new` integer DEFAULT 0 NOT NULL,
	`items_updated` integer DEFAULT 0 NOT NULL,
	`error` text,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ingestion_jobs_source_idx` ON `ingestion_jobs` (`source_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`user_id` text,
	`name` text,
	`email` text,
	`phone` text,
	`area_id` integer,
	`message` text,
	`payload` text,
	`contact_consent` integer NOT NULL,
	`assignee_id` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `leads_status_idx` ON `leads` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `parameter_sets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`year` integer NOT NULL,
	`region` text NOT NULL,
	`version` integer NOT NULL,
	`status` text NOT NULL,
	`data` text NOT NULL,
	`notes` text,
	`verified_by` text,
	`verified_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `parameter_sets_version_idx` ON `parameter_sets` (`year`,`region`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `parameter_sets_one_active_idx` ON `parameter_sets` (`year`,`region`) WHERE "parameter_sets"."status" = 'active';--> statement-breakpoint
CREATE TABLE `alerts_sent` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`saved_search_id` integer NOT NULL,
	`listing_id` integer NOT NULL,
	`channel` text NOT NULL,
	`sent_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`saved_search_id`) REFERENCES `saved_searches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alerts_sent_once_idx` ON `alerts_sent` (`saved_search_id`,`listing_id`,`channel`);--> statement-breakpoint
CREATE TABLE `consents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`purpose` text NOT NULL,
	`granted` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `consents_user_idx` ON `consents` (`user_id`,`purpose`,`created_at`);--> statement-breakpoint
CREATE TABLE `favourites` (
	`user_id` text NOT NULL,
	`listing_id` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`user_id`, `listing_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `saved_searches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`filters` text NOT NULL,
	`alert` text,
	`frequency` text DEFAULT 'off' NOT NULL,
	`last_run_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `saved_searches_user_idx` ON `saved_searches` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`role` text DEFAULT 'user' NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`locale` text DEFAULT 'pt' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);