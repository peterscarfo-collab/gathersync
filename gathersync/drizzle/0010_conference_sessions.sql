ALTER TABLE `events` MODIFY `eventType` enum('flexible','fixed','conference') NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `startDate` varchar(10);--> statement-breakpoint
ALTER TABLE `events` ADD `endDate` varchar(10);--> statement-breakpoint
ALTER TABLE `events` ADD `allDay` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `events` ADD `venueCapacity` int;--> statement-breakpoint
ALTER TABLE `events` ADD `selectionDeadline` varchar(10);--> statement-breakpoint
CREATE TABLE `eventSessions` (
	`id` varchar(64) NOT NULL,
	`eventId` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`date` varchar(10) NOT NULL,
	`startTime` varchar(5) NOT NULL,
	`endTime` varchar(5) NOT NULL,
	`room` varchar(255),
	`speaker` varchar(255),
	`description` text,
	`capacity` int,
	`sortOrder` int DEFAULT 0,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `eventSessions_id` PRIMARY KEY(`id`)
);
