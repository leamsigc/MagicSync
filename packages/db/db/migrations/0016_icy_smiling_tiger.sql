CREATE TABLE `content_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`business_id` text NOT NULL,
	`source_post_id` text,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`platform` text DEFAULT '' NOT NULL,
	`hook_style` text DEFAULT '' NOT NULL,
	`structure` text DEFAULT '[]' NOT NULL,
	`body_blocks` text DEFAULT '[]' NOT NULL,
	`cta_style` text DEFAULT '' NOT NULL,
	`tone_notes` text DEFAULT '' NOT NULL,
	`visual_pattern` text DEFAULT '' NOT NULL,
	`required_inputs` text DEFAULT '[]' NOT NULL,
	`source_metrics` text DEFAULT '{}' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `business_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `publishing_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`business_id` text NOT NULL,
	`connection_id` text,
	`artifact_id` text,
	`artifact_version` integer,
	`idempotency_key` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`remote_id` text,
	`remote_url` text,
	`commit_sha` text,
	`pull_request_url` text,
	`error_code` text,
	`error_message` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `business_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`) REFERENCES `publish_connections`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `publishing_jobs_idempotency_key_unique` ON `publishing_jobs` (`idempotency_key`);--> statement-breakpoint
ALTER TABLE `publish_connections` ADD `delivery_mode` text DEFAULT 'commit' NOT NULL;