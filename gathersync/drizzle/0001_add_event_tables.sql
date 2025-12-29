CREATE TABLE `events` (
`id` varchar(64) NOT NULL,
`userId` int NOT NULL,
`name` varchar(255) NOT NULL,
`month` int NOT NULL,
`year` int NOT NULL,
`createdAt` timestamp NOT NULL DEFAULT (now()),
`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
CONSTRAINT `events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `participants` (
`id` varchar(64) NOT NULL,
`eventId` varchar(64) NOT NULL,
`name` varchar(255) NOT NULL,
`availability` json NOT NULL,
`unavailableAllMonth` boolean NOT NULL DEFAULT false,
`createdAt` timestamp NOT NULL DEFAULT (now()),
`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
CONSTRAINT `participants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `eventSnapshots` (
`id` varchar(64) NOT NULL,
`userId` int NOT NULL,
`eventId` varchar(64) NOT NULL,
`name` varchar(255) NOT NULL,
`eventData` json NOT NULL,
`savedAt` timestamp NOT NULL DEFAULT (now()),
CONSTRAINT `eventSnapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `groupTemplates` (
`id` varchar(64) NOT NULL,
`userId` int NOT NULL,
`name` varchar(255) NOT NULL,
`participantNames` json NOT NULL,
`createdAt` timestamp NOT NULL DEFAULT (now()),
CONSTRAINT `groupTemplates_id` PRIMARY KEY(`id`)
);
