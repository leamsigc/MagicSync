PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_knowledge_folders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`parent_id` text,
	`path` text NOT NULL,
	`is_global` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `knowledge_folders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_knowledge_folders`("id", "user_id", "name", "parent_id", "path", "is_global", "created_at") SELECT "id", "user_id", "name", "parent_id", "path", "is_global", "created_at" FROM `knowledge_folders`;--> statement-breakpoint
DROP TABLE `knowledge_folders`;--> statement-breakpoint
ALTER TABLE `__new_knowledge_folders` RENAME TO `knowledge_folders`;--> statement-breakpoint
PRAGMA foreign_keys=ON;