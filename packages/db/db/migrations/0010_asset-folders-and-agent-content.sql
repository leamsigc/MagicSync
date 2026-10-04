CREATE TABLE `asset_folders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `business_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `asset_folders_business_name_unique` ON `asset_folders` (`business_id`,`name`);--> statement-breakpoint
CREATE INDEX `asset_folders_business_idx` ON `asset_folders` (`business_id`);--> statement-breakpoint
CREATE TABLE `business_brand_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `business_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `business_corpus_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`user_id` text NOT NULL,
	`section` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `business_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `agent_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`business_id` text,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`system_prompt` text DEFAULT '' NOT NULL,
	`skill_version_ids` text DEFAULT '[]' NOT NULL,
	`allowed_tool_names` text DEFAULT '[]' NOT NULL,
	`output_kind` text DEFAULT 'social_post_draft' NOT NULL,
	`output_schema` text DEFAULT '{}' NOT NULL,
	`max_steps` integer DEFAULT 10 NOT NULL,
	`max_child_agents` integer DEFAULT 2 NOT NULL,
	`requires_business_context` integer DEFAULT true NOT NULL,
	`requires_human_review` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `business_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `agent_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`version` integer NOT NULL,
	`snapshot` text NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agent_definitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `skill_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`business_id` text,
	`owner_scope` text DEFAULT 'business' NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`input_schema` text DEFAULT '{}' NOT NULL,
	`output_schema` text DEFAULT '{}' NOT NULL,
	`allowed_tools` text DEFAULT '[]' NOT NULL,
	`source_type` text DEFAULT 'authored' NOT NULL,
	`source_uri` text,
	`content_hash` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `business_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `skill_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`version` integer NOT NULL,
	`snapshot` text NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`skill_id`) REFERENCES `skill_definitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `agent_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`business_id` text,
	`pipeline_run_id` text,
	`parent_agent_id` text,
	`agent_name` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`tokens_used` integer DEFAULT 0 NOT NULL,
	`cost` integer,
	`duration_ms` integer,
	`tool_events` text DEFAULT '[]' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `business_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
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
	`graph_snapshot` text,
	`current_node_id` text,
	`node_results` text DEFAULT '[]' NOT NULL,
	`attempts` text DEFAULT '[]' NOT NULL,
	`approval_state` text DEFAULT '{}' NOT NULL,
	`last_checkpoint_at` integer,
	`error` text,
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
	`graph` text DEFAULT '{}' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `business_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
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
CREATE INDEX `agent_goal_runs_business_idx` ON `agent_goal_runs` (`user_id`,`business_id`);--> statement-breakpoint
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
	`revisions` text DEFAULT '[]' NOT NULL,
	`post_id` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `business_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `pipeline_runs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
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
CREATE TABLE `agent_chat_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`seq` integer NOT NULL,
	`entry` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `agent_chat_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_chat_entries_session_seq_unique` ON `agent_chat_entries` (`session_id`,`seq`);--> statement-breakpoint
CREATE TABLE `agent_chat_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`thread_id` text,
	`pi_session_id` text NOT NULL,
	`last_entry_seq` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `business_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `content_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`score` integer,
	`findings` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `content_checks_item_kind_idx` ON `content_checks` (`item_id`,`kind`);--> statement-breakpoint
CREATE TABLE `content_item_events` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`actor_user_id` text,
	`actor_kind` text DEFAULT 'user' NOT NULL,
	`event` text NOT NULL,
	`from_state` text,
	`to_state` text,
	`payload` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `content_item_events_item_created_idx` ON `content_item_events` (`item_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `content_items` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`title` text NOT NULL,
	`brief` text DEFAULT '' NOT NULL,
	`state` text DEFAULT 'idea' NOT NULL,
	`format` text DEFAULT 'social_post' NOT NULL,
	`platforms` text,
	`source_type` text DEFAULT 'manual' NOT NULL,
	`source_ref` text,
	`template_id` text,
	`artifact_id` text,
	`post_id` text,
	`scheduled_at` integer,
	`published_at` integer,
	`priority` integer DEFAULT 0 NOT NULL,
	`created_by` text DEFAULT 'user' NOT NULL,
	`created_by_user_id` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `business_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `content_templates`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`artifact_id`) REFERENCES `content_artifacts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `content_items_business_state_idx` ON `content_items` (`business_id`,`state`);--> statement-breakpoint
CREATE INDEX `content_items_business_updated_idx` ON `content_items` (`business_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `content_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`agent_run_id` text,
	`step` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_run_id`) REFERENCES `agent_runs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `content_runs_item_created_idx` ON `content_runs` (`item_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `publish_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`business_id` text NOT NULL,
	`provider` text NOT NULL,
	`name` text NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`secret` text,
	`secret_ref` text,
	`delivery_mode` text DEFAULT 'commit' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `business_profiles`(`id`) ON UPDATE no action ON DELETE cascade
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
DROP TABLE `subscriptions`;--> statement-breakpoint
DROP TABLE `agent_sessions`;--> statement-breakpoint
DROP TABLE `code_executions`;--> statement-breakpoint
DROP TABLE `sandbox_files`;--> statement-breakpoint
DROP TABLE `skill_files`;--> statement-breakpoint
ALTER TABLE `assets` ADD `folder_id` text REFERENCES asset_folders(id);--> statement-breakpoint
CREATE INDEX `assets_user_folder_idx` ON `assets` (`user_id`,`folder_id`);--> statement-breakpoint
CREATE INDEX `assets_business_folder_idx` ON `assets` (`business_id`,`folder_id`);--> statement-breakpoint
ALTER TABLE `business_profiles` ADD `safe_mode` integer DEFAULT true NOT NULL;