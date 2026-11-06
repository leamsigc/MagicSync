ALTER TABLE `templates` ADD `businessId` text REFERENCES business_profiles(id) ON DELETE CASCADE;--> statement-breakpoint
CREATE INDEX `templates_business_idx` ON `templates` (`businessId`);--> statement-breakpoint
ALTER TABLE `chat_threads` ADD `business_id` text REFERENCES business_profiles(id) ON DELETE CASCADE;--> statement-breakpoint
CREATE INDEX `chat_threads_business_idx` ON `chat_threads` (`business_id`);--> statement-breakpoint
ALTER TABLE `brand_kits` ADD `businessId` text REFERENCES business_profiles(id) ON DELETE CASCADE;--> statement-breakpoint
CREATE INDEX `brand_kits_business_idx` ON `brand_kits` (`businessId`);
