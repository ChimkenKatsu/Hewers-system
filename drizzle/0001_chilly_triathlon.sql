CREATE TABLE `face_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`user_id` text NOT NULL,
	`worker_id` text NOT NULL,
	`purpose` text NOT NULL,
	`created` integer NOT NULL,
	`expires` integer NOT NULL,
	`used` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `face_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`worker_id` text NOT NULL,
	`descriptor` text NOT NULL,
	`created` text NOT NULL,
	`actor` text NOT NULL,
	`consent` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `face_owner_worker` ON `face_templates` (`owner`,`worker_id`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`email` text NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`site_ids` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_owner_email` ON `memberships` (`owner`,`email`);