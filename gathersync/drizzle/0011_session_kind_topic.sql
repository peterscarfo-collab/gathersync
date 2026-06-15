ALTER TABLE `eventSessions` ADD `kind` enum('talk','breakfast','lunch','dinner','coffee','break') DEFAULT 'talk';--> statement-breakpoint
ALTER TABLE `eventSessions` ADD `speakerTopic` varchar(500);
