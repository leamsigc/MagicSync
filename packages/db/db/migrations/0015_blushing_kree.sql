CREATE TABLE `approval_records` (
	`id` text PRIMARY KEY NOT NULL,
	`artifact_id` text NOT NULL,
	`run_id` text,
	`thread_id` text,
	`decision` text NOT NULL,
	`feedback` text DEFAULT '' NOT NULL,
	`actor` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`artifact_id`) REFERENCES `content_artifacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `pipeline_runs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `content_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`business_id` text NOT NULL,
	`run_id` text,
	`thread_id` text,
	`kind` text NOT NULL,
	`output_kind` text DEFAULT 'social_post_draft' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'generating' NOT NULL,
	`output` text DEFAULT '{}' NOT NULL,
	`post_id` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `business_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `pipeline_runs`(`id`) ON UPDATE no action ON DELETE set null
);
