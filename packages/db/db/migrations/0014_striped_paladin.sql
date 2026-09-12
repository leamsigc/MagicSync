ALTER TABLE `agent_runs` ADD `business_id` text REFERENCES business_profiles(id);--> statement-breakpoint
ALTER TABLE `agent_runs` ADD `parent_agent_id` text;--> statement-breakpoint
ALTER TABLE `agent_runs` ADD `cost` integer;--> statement-breakpoint
ALTER TABLE `agent_runs` ADD `duration_ms` integer;--> statement-breakpoint
ALTER TABLE `agent_runs` ADD `tool_events` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `graph_snapshot` text;--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `current_node_id` text;--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `node_results` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `attempts` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `approval_state` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `last_checkpoint_at` integer;--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `error` text;--> statement-breakpoint
ALTER TABLE `pipelines` ADD `graph` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `pipelines` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `pipelines` ADD `status` text DEFAULT 'draft' NOT NULL;