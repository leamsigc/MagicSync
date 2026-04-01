CREATE TABLE `user_llm_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text DEFAULT 'ollama' NOT NULL,
	`model` text DEFAULT 'qwen3.5' NOT NULL,
	`api_key` text,
	`api_base_url` text,
	`is_default` integer DEFAULT true NOT NULL,
	`temperature` real DEFAULT 0.7 NOT NULL,
	`max_tokens` integer DEFAULT 2048 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
