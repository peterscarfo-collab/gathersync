ALTER TABLE `users` ADD `trialStartDate` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `trialEndDate` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `trialUsed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `appliedPromoCode` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `promoExpiry` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `isLifetimePro` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `grantedBy` varchar(320);--> statement-breakpoint
ALTER TABLE `users` ADD `grantedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionSource` enum('trial','promo','stripe','admin','free') DEFAULT 'free' NOT NULL;