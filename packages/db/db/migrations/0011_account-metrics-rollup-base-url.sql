ALTER TABLE `social_media_accounts` ADD `base_url` text;--> statement-breakpoint
ALTER TABLE `account_metrics` ADD `snapshot_date` text(10);--> statement-breakpoint
-- Backfill the day bucket for pre-existing rows. `collected_at` is a Drizzle
-- `mode: 'timestamp'` integer (Unix SECONDS), so `unixepoch` is required —
-- plain date(collected_at) returns NULL.
UPDATE `account_metrics` SET `snapshot_date` = date(`collected_at`, 'unixepoch');--> statement-breakpoint
-- Collapse historical per-collection rows to one per account per day, keeping
-- the newest snapshot of each day so the unique index below is valid.
DELETE FROM `account_metrics`
WHERE `id` NOT IN (
  SELECT `id` FROM (
    SELECT `id`,
           ROW_NUMBER() OVER (
             PARTITION BY `social_account_id`, `snapshot_date`
             ORDER BY `collected_at` DESC
           ) AS rn
    FROM `account_metrics`
  ) WHERE rn = 1
);--> statement-breakpoint
CREATE UNIQUE INDEX `account_metrics_account_day_unique` ON `account_metrics` (`social_account_id`,`snapshot_date`);
