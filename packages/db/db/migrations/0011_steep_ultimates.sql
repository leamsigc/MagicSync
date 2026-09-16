CREATE TABLE `agent_goal_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`business_id` text NOT NULL,
	`goal` text NOT NULL,
	`status` text DEFAULT 'planning' NOT NULL,
	`plan` text DEFAULT '{}' NOT NULL,
	`steps` text DEFAULT '[]' NOT NULL,
	`result` text,
	`error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `business_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_goal_runs_business_idx` ON `agent_goal_runs` (`user_id`,`business_id`);