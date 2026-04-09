CREATE TABLE `agent_todos` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`order_index` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `chat_threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workspace_files` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`user_id` text NOT NULL,
	`filename` text NOT NULL,
	`content` text NOT NULL,
	`mime_type` text DEFAULT 'text/plain' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `chat_threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `harness_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`user_id` text NOT NULL,
	`harness_type` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`current_phase` integer DEFAULT 0 NOT NULL,
	`phase_results` text,
	`metadata` text,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `chat_threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_agent_todos_thread` ON `agent_todos`(`thread_id`);
--> statement-breakpoint
CREATE INDEX `idx_agent_todos_user` ON `agent_todos`(`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_workspace_files_thread` ON `workspace_files`(`thread_id`);
--> statement-breakpoint
CREATE INDEX `idx_workspace_files_user` ON `workspace_files`(`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_harness_runs_thread` ON `harness_runs`(`thread_id`);
--> statement-breakpoint
CREATE INDEX `idx_harness_runs_user` ON `harness_runs`(`user_id`);
