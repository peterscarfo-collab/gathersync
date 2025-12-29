ALTER TABLE `events` ADD `eventType` enum('flexible','fixed') NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `fixedDate` varchar(10);--> statement-breakpoint
ALTER TABLE `events` ADD `fixedTime` varchar(5);--> statement-breakpoint
ALTER TABLE `events` ADD `reminderDaysBefore` int;--> statement-breakpoint
ALTER TABLE `events` ADD `reminderScheduled` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `events` ADD `archived` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `finalized` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `finalizedDate` varchar(10);--> statement-breakpoint
ALTER TABLE `events` ADD `teamLeader` varchar(255);--> statement-breakpoint
ALTER TABLE `events` ADD `teamLeaderPhone` varchar(50);--> statement-breakpoint
ALTER TABLE `events` ADD `meetingType` enum('in-person','virtual');--> statement-breakpoint
ALTER TABLE `events` ADD `venueName` varchar(255);--> statement-breakpoint
ALTER TABLE `events` ADD `venueContact` varchar(255);--> statement-breakpoint
ALTER TABLE `events` ADD `venuePhone` varchar(50);--> statement-breakpoint
ALTER TABLE `events` ADD `meetingLink` text;--> statement-breakpoint
ALTER TABLE `events` ADD `rsvpDeadline` varchar(100);--> statement-breakpoint
ALTER TABLE `events` ADD `meetingNotes` text;--> statement-breakpoint
ALTER TABLE `participants` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `participants` ADD `source` enum('manual','contacts','ai');--> statement-breakpoint
ALTER TABLE `participants` ADD `phone` varchar(50);--> statement-breakpoint
ALTER TABLE `participants` ADD `email` varchar(320);--> statement-breakpoint
ALTER TABLE `participants` ADD `rsvpStatus` enum('attending','not-attending','no-response');