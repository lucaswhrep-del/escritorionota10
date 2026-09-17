CREATE TABLE `campaign` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`task` text NOT NULL,
	`person` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	`created` text NOT NULL
);
