CREATE TABLE `publish_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`business_id` text NOT NULL,
	`provider` text NOT NULL,
	`name` text NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`secret` text,
	`secret_ref` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `business_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
