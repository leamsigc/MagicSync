ALTER TABLE `posts` ADD `retry_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `next_retry_at` integer;--> statement-breakpoint
ALTER TABLE `posts` ADD `last_error` text;--> statement-breakpoint
ALTER TABLE `social_media_accounts` ADD `access_token_encrypted` text;--> statement-breakpoint
ALTER TABLE `social_media_accounts` ADD `refresh_token_encrypted` text;