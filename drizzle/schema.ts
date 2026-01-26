import {
  boolean,
  integer,
  json,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */

// PostgreSQL enums must be defined before tables
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const subscriptionTierEnum = pgEnum("subscriptionTier", ["free", "lite", "pro", "enterprise"]);
export const subscriptionStatusEnum = pgEnum("subscriptionStatus", ["active", "cancelled", "expired", "trialing"]);
export const subscriptionSourceEnum = pgEnum("subscriptionSource", ["trial", "promo", "stripe", "admin", "free"]);
export const eventTypeEnum = pgEnum("eventType", ["flexible", "fixed"]);
export const meetingTypeEnum = pgEnum("meetingType", ["in-person", "virtual"]);
export const sourceEnum = pgEnum("source", ["manual", "contacts", "ai"]);
export const rsvpStatusEnum = pgEnum("rsvpStatus", ["attending", "not-attending", "no-response"]);

export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: serial("id").primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  subscriptionTier: subscriptionTierEnum("subscriptionTier").default("free").notNull(),
  subscriptionStatus: subscriptionStatusEnum("subscriptionStatus").default("active").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  subscriptionStartDate: timestamp("subscriptionStartDate", { mode: "date" }),
  subscriptionEndDate: timestamp("subscriptionEndDate", { mode: "date" }),
  eventsCreatedThisMonth: integer("eventsCreatedThisMonth").default(0).notNull(),
  lastMonthReset: timestamp("lastMonthReset", { mode: "date" }).defaultNow().notNull(),
  // Promotional and trial fields
  trialStartDate: timestamp("trialStartDate", { mode: "date" }),
  trialEndDate: timestamp("trialEndDate", { mode: "date" }),
  trialUsed: boolean("trialUsed").default(false).notNull(),
  appliedPromoCode: varchar("appliedPromoCode", { length: 100 }),
  promoExpiry: timestamp("promoExpiry", { mode: "date" }),
  isLifetimePro: boolean("isLifetimePro").default(false).notNull(),
  grantedBy: varchar("grantedBy", { length: 320 }), // Admin email who granted access
  grantedAt: timestamp("grantedAt", { mode: "date" }),
  subscriptionSource: subscriptionSourceEnum("subscriptionSource").default("free").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { mode: "date" }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const events = pgTable("events", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  eventType: eventTypeEnum("eventType").notNull(),
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  fixedDate: varchar("fixedDate", { length: 10 }), // YYYY-MM-DD
  fixedTime: varchar("fixedTime", { length: 5 }), // HH:MM
  reminderDaysBefore: integer("reminderDaysBefore"),
  reminderScheduled: boolean("reminderScheduled").default(false),
  archived: boolean("archived").default(false).notNull(),
  finalized: boolean("finalized").default(false).notNull(),
  finalizedDate: varchar("finalizedDate", { length: 10 }), // YYYY-MM-DD
  teamLeader: varchar("teamLeader", { length: 255 }),
  teamLeaderPhone: varchar("teamLeaderPhone", { length: 50 }),
  meetingType: meetingTypeEnum("meetingType"),
  venueName: varchar("venueName", { length: 255 }),
  venueAddress: text("venueAddress"),
  venueContact: varchar("venueContact", { length: 255 }),
  venuePhone: varchar("venuePhone", { length: 50 }),
  meetingLink: text("meetingLink"),
  rsvpDeadline: varchar("rsvpDeadline", { length: 100 }),
  meetingNotes: text("meetingNotes"),
  deletedAt: timestamp("deletedAt", { mode: "date" }), // Soft delete timestamp
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export const participants = pgTable("participants", {
  id: varchar("id", { length: 64 }).primaryKey(),
  eventId: varchar("eventId", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  availability: json("availability").$type<Record<string, boolean>>().notNull(),
  unavailableAllMonth: boolean("unavailableAllMonth").default(false).notNull(),
  notes: text("notes"),
  source: sourceEnum("source"),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 320 }),
  rsvpStatus: rsvpStatusEnum("rsvpStatus"),
  deletedAt: timestamp("deletedAt", { mode: "date" }), // Soft delete timestamp
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export const eventSnapshots = pgTable("eventSnapshots", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: integer("userId").notNull(),
  eventId: varchar("eventId", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  eventData: json("eventData").$type<any>().notNull(),
  savedAt: timestamp("savedAt", { mode: "date" }).defaultNow().notNull(),
});

export const groupTemplates = pgTable("groupTemplates", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  participantNames: json("participantNames").$type<string[]>().notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export const pushTokens = pgTable("pushTokens", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  deviceId: varchar("deviceId", { length: 255 }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type Event = typeof events.$inferSelect;
export type Participant = typeof participants.$inferSelect;
export type EventSnapshot = typeof eventSnapshots.$inferSelect;
export type GroupTemplate = typeof groupTemplates.$inferSelect;
export type PushToken = typeof pushTokens.$inferSelect;

export type InsertEvent = typeof events.$inferInsert;
export type InsertParticipant = typeof participants.$inferInsert;
export type InsertEventSnapshot = typeof eventSnapshots.$inferInsert;
export type InsertGroupTemplate = typeof groupTemplates.$inferInsert;
export type InsertPushToken = typeof pushTokens.$inferInsert;
