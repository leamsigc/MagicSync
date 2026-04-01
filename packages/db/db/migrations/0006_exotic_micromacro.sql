CREATE TABLE `agent_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`parent_message_id` text NOT NULL,
	`thread_id` text,
	`task` text NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`task_type` text,
	`max_steps` integer DEFAULT 10 NOT NULL,
	`step_count` integer DEFAULT 0 NOT NULL,
	`result` text,
	`error_message` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`thread_id`) REFERENCES `chat_threads`(`id`) ON UPDATE no action ON DELETE cascade
);
