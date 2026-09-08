CREATE TABLE `notification_preferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`event` text DEFAULT 'general' NOT NULL,
	`in_app` integer DEFAULT true NOT NULL,
	`email` integer DEFAULT true NOT NULL,
	`muted_until` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_prefs_user_event_uniq` ON `notification_preferences` (`user_id`,`event`);--> statement-breakpoint
ALTER TABLE `notifications` ADD `event` text DEFAULT 'general' NOT NULL;