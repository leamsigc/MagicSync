CREATE TABLE `agent_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`pipeline_run_id` text,
	`agent_name` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`tokens_used` integer DEFAULT 0 NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`pipeline_run_id`) REFERENCES `pipeline_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `pipeline_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`pipeline_id` text NOT NULL,
	`user_id` text NOT NULL,
	`business_id` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`current_step` integer DEFAULT 0 NOT NULL,
	`input` text,
	`step_results` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`pipeline_id`) REFERENCES `pipelines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `business_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `pipelines` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`steps` text DEFAULT '[]' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `business_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
