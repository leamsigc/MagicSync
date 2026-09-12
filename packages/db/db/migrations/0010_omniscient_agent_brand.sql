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
