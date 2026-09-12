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
