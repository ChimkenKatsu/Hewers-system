CREATE TABLE `workspaces` (
	`owner` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
