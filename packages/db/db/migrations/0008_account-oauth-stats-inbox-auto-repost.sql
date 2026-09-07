CREATE TABLE `jwks` (
	`id` text PRIMARY KEY NOT NULL,
	`public_key` text NOT NULL,
	`private_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	`alg` text,
	`crv` text
);
--> statement-breakpoint
CREATE TABLE `oauth_access_token` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text,
	`client_id` text NOT NULL,
	`session_id` text,
	`user_id` text,
	`reference_id` text,
	`authorization_code_id` text,
	`resources` text,
	`requested_user_info_claims` text,
	`refresh_id` text,
	`expires_at` integer,
	`created_at` integer,
	`revoked` integer,
	`confirmation` text,
	`scopes` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_client`(`client_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`refresh_id`) REFERENCES `oauth_refresh_token`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_access_token_token_unique` ON `oauth_access_token` (`token`);--> statement-breakpoint
CREATE TABLE `oauth_client` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`client_secret` text,
	`client_discovery_id` text,
	`disabled` integer DEFAULT false,
	`skip_consent` integer,
	`enable_end_session` integer,
	`subject_type` text,
	`scopes` text,
	`client_credentials_scopes` text,
	`user_id` text,
	`created_at` integer,
	`updated_at` integer,
	`name` text,
	`uri` text,
	`icon` text,
	`contacts` text,
	`tos` text,
	`policy` text,
	`software_id` text,
	`software_version` text,
	`software_statement` text,
	`redirect_uris` text NOT NULL,
	`post_logout_redirect_uris` text,
	`backchannel_logout_uri` text,
	`backchannel_logout_session_required` integer,
	`token_endpoint_auth_method` text,
	`application_type` text,
	`jwks` text,
	`jwks_uri` text,
	`grant_types` text,
	`response_types` text,
	`require_pkce` integer,
	`dpop_bound_access_tokens` integer DEFAULT false,
	`reference_id` text,
	`metadata` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_client_client_id_unique` ON `oauth_client` (`client_id`);--> statement-breakpoint
CREATE TABLE `oauth_client_assertion` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `oauth_client_resource` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`resource_id` text NOT NULL,
	`metadata` text,
	`created_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_client`(`client_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resource_id`) REFERENCES `oauth_resource`(`identifier`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_client_resource_client_resource` ON `oauth_client_resource` (`client_id`,`resource_id`);--> statement-breakpoint
CREATE TABLE `oauth_consent` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`user_id` text,
	`reference_id` text,
	`resources` text,
	`requested_user_info_claims` text,
	`scopes` text NOT NULL,
	`business_id` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_client`(`client_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `business_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `oauth_refresh_token` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`client_id` text NOT NULL,
	`session_id` text,
	`user_id` text NOT NULL,
	`reference_id` text,
	`authorization_code_id` text,
	`resources` text,
	`requested_user_info_claims` text,
	`expires_at` integer,
	`created_at` integer,
	`revoked` integer,
	`rotated_at` integer,
	`rotation_replay_response` text,
	`rotation_replay_expires_at` integer,
	`auth_time` integer,
	`confirmation` text,
	`scopes` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_client`(`client_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_refresh_token_token_unique` ON `oauth_refresh_token` (`token`);--> statement-breakpoint
CREATE TABLE `oauth_resource` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`name` text NOT NULL,
	`access_token_ttl` integer,
	`refresh_token_ttl` integer,
	`signing_algorithm` text,
	`signing_key_id` text,
	`allowed_scopes` text,
	`custom_claims` text,
	`dpop_bound_access_tokens_required` integer DEFAULT false,
	`disabled` integer DEFAULT false,
	`created_at` integer,
	`updated_at` integer,
	`policy_version` integer DEFAULT 1,
	`metadata` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_resource_identifier_unique` ON `oauth_resource` (`identifier`);--> statement-breakpoint
CREATE TABLE `account_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`social_account_id` text NOT NULL,
	`platform` text NOT NULL,
	`followers` integer,
	`following` integer,
	`posts` integer,
	`engagement` text,
	`raw_payload` text,
	`source` text DEFAULT 'auto' NOT NULL,
	`status` text DEFAULT 'success' NOT NULL,
	`error` text,
	`collected_at` integer NOT NULL,
	FOREIGN KEY (`social_account_id`) REFERENCES `social_media_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_metrics_account_collected_idx` ON `account_metrics` (`social_account_id`,`collected_at`);--> statement-breakpoint
CREATE INDEX `account_metrics_platform_idx` ON `account_metrics` (`platform`);--> statement-breakpoint
CREATE TABLE `post_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`platform_post_id` text,
	`social_account_id` text NOT NULL,
	`platform` text NOT NULL,
	`external_post_id` text,
	`metrics` text NOT NULL,
	`raw_payload` text,
	`status` text DEFAULT 'success' NOT NULL,
	`error` text,
	`collected_at` integer NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`platform_post_id`) REFERENCES `platform_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`social_account_id`) REFERENCES `social_media_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_metrics_post_collected_idx` ON `post_metrics` (`post_id`,`collected_at`);--> statement-breakpoint
CREATE INDEX `post_metrics_platform_post_idx` ON `post_metrics` (`platform_post_id`);--> statement-breakpoint
CREATE INDEX `post_metrics_account_collected_idx` ON `post_metrics` (`social_account_id`,`collected_at`);--> statement-breakpoint
CREATE TABLE `stats_sync_state` (
	`id` text PRIMARY KEY NOT NULL,
	`social_account_id` text NOT NULL,
	`last_attempt_at` integer,
	`last_success_at` integer,
	`next_due_at` integer,
	`status` text DEFAULT 'idle' NOT NULL,
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`backoff_until` integer,
	FOREIGN KEY (`social_account_id`) REFERENCES `social_media_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stats_sync_state_social_account_id_unique` ON `stats_sync_state` (`social_account_id`);--> statement-breakpoint
CREATE TABLE `inbox_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`platform` text NOT NULL,
	`social_account_id` text,
	`post_id` text,
	`external_post_id` text,
	`author_id` text,
	`author_name` text,
	`author_avatar` text,
	`content` text NOT NULL,
	`parent_id` text,
	`read` integer DEFAULT false NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`social_account_id`) REFERENCES `social_media_accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `inbox_user_read_idx` ON `inbox_items` (`user_id`,`read`);--> statement-breakpoint
CREATE INDEX `inbox_user_platform_idx` ON `inbox_items` (`user_id`,`platform`);--> statement-breakpoint
CREATE INDEX `inbox_user_type_idx` ON `inbox_items` (`user_id`,`type`);--> statement-breakpoint
CREATE INDEX `inbox_post_idx` ON `inbox_items` (`post_id`);--> statement-breakpoint
ALTER TABLE `account` ADD `issuer` text;--> statement-breakpoint
ALTER TABLE `session` ADD `active_organization_id` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `auto_repost` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `repost_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `repost_parent_id` text;