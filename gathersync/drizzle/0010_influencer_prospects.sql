CREATE TABLE IF NOT EXISTS `influencerProspects` (
  `id` varchar(64) NOT NULL,
  `userId` int NOT NULL,
  `prospectData` json NOT NULL,
  `deletedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `influencerProspects_userId_idx` (`userId`)
);
