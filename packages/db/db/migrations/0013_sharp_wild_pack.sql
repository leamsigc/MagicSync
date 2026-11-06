CREATE TABLE `brand_kits` (
	`id` text PRIMARY KEY NOT NULL,
	`ownerId` text NOT NULL,
	`name` text NOT NULL,
	`colors` text DEFAULT '[]' NOT NULL,
	`fonts` text DEFAULT '{}' NOT NULL,
	`logoUrl` text,
	`defaults` text DEFAULT '{}' NOT NULL,
	`isDefault` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `design_render_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`ownerId` text NOT NULL,
	`kind` text NOT NULL,
	`templateId` text,
	`status` text NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`warnings` text DEFAULT '[]' NOT NULL,
	`durationMs` real,
	`renderingMs` real,
	`requestedAt` integer NOT NULL,
	FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `design_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`templateId` text NOT NULL,
	`authorId` text NOT NULL,
	`version` integer NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`templateId`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `design_webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`ownerId` text NOT NULL,
	`businessId` text,
	`url` text NOT NULL,
	`secret` text NOT NULL,
	`events` text DEFAULT '[]' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`description` text,
	`lastAttempts` text DEFAULT '[]' NOT NULL,
	`deliveryCount` integer DEFAULT 0 NOT NULL,
	`failureCount` integer DEFAULT 0 NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
