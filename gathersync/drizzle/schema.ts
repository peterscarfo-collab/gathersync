import {
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  subscriptionTier: mysqlEnum("subscriptionTier", ["free", "lite", "pro", "enterprise"]).default("free").notNull(),
  subscriptionStatus: mysqlEnum("subscriptionStatus", ["active", "cancelled", "expired", "trialing"]).default("active").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  subscriptionStartDate: timestamp("subscriptionStartDate"),
  subscriptionEndDate: timestamp("subscriptionEndDate"),
  eventsCreatedThisMonth: int("eventsCreatedThisMonth").default(0).notNull(),
  lastMonthReset: timestamp("lastMonthReset").defaultNow().notNull(),
  // Promotional and trial fields
  trialStartDate: timestamp("trialStartDate"),
  trialEndDate: timestamp("trialEndDate"),
  trialUsed: boolean("trialUsed").default(false).notNull(),
  appliedPromoCode: varchar("appliedPromoCode", { length: 100 }),
  promoExpiry: timestamp("promoExpiry"),
  isLifetimePro: boolean("isLifetimePro").default(false).notNull(),
  grantedBy: varchar("grantedBy", { length: 320 }), // Admin email who granted access
  grantedAt: timestamp("grantedAt"),
  subscriptionSource: mysqlEnum("subscriptionSource", ["trial", "promo", "stripe", "admin", "free"]).default("free").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const events = mysqlTable("events", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  eventType: mysqlEnum("eventType", ["flexible", "fixed", "conference"]).notNull(),
  month: int("month").notNull(), // 1-12
  year: int("year").notNull(),
  fixedDate: varchar("fixedDate", { length: 10 }), // YYYY-MM-DD
  fixedTime: varchar("fixedTime", { length: 5 }), // HH:MM
  startDate: varchar("startDate", { length: 10 }), // Conference start YYYY-MM-DD
  endDate: varchar("endDate", { length: 10 }), // Conference end YYYY-MM-DD
  allDay: boolean("allDay").default(false),
  venueCapacity: int("venueCapacity"),
  selectionDeadline: varchar("selectionDeadline", { length: 10 }), // YYYY-MM-DD
  reminderDaysBefore: int("reminderDaysBefore"),
  reminderScheduled: boolean("reminderScheduled").default(false),
  archived: boolean("archived").default(false).notNull(),
  finalized: boolean("finalized").default(false).notNull(),
  finalizedDate: varchar("finalizedDate", { length: 10 }), // YYYY-MM-DD
  teamLeader: varchar("teamLeader", { length: 255 }),
  teamLeaderPhone: varchar("teamLeaderPhone", { length: 50 }),
  meetingType: mysqlEnum("meetingType", ["in-person", "virtual"]),
  venueName: varchar("venueName", { length: 255 }),
  venueContact: varchar("venueContact", { length: 255 }),
  venuePhone: varchar("venuePhone", { length: 50 }),
  meetingLink: text("meetingLink"),
  rsvpDeadline: varchar("rsvpDeadline", { length: 100 }),
  meetingNotes: text("meetingNotes"),
  hideAttendeeNames: boolean("hideAttendeeNames").default(false).notNull(),
  showAttendeeNames: boolean("showAttendeeNames").default(true).notNull(),
  showAttendeeEmails: boolean("showAttendeeEmails").default(false).notNull(),
  showAttendeePhones: boolean("showAttendeePhones").default(false).notNull(),
  digitalTwinUrl: text("digitalTwinUrl"),
  quorumType: mysqlEnum("quorumType", ["number", "percentage"]),
  quorumValue: int("quorumValue"),
  deletedAt: timestamp("deletedAt"), // Soft delete timestamp
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const participants = mysqlTable("participants", {
  id: varchar("id", { length: 64 }).primaryKey(),
  eventId: varchar("eventId", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  availability: json("availability").$type<Record<string, boolean>>().notNull(),
  unavailableAllMonth: boolean("unavailableAllMonth").default(false).notNull(),
  notes: text("notes"),
  source: mysqlEnum("source", ["manual", "contacts", "ai"]),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 320 }),
  designation: varchar("designation", { length: 255 }),
  organization: varchar("organization", { length: 255 }),
  leadSource: varchar("leadSource", { length: 255 }),
  rsvpStatus: mysqlEnum("rsvpStatus", ["attending", "not-attending", "no-response"]),
  digitalTwinUrl: text("digitalTwinUrl"),
  deletedAt: timestamp("deletedAt"), // Soft delete timestamp
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const eventSessions = mysqlTable("eventSessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  eventId: varchar("eventId", { length: 64 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  kind: mysqlEnum("kind", ["talk", "breakfast", "lunch", "dinner", "coffee", "break"]).default("talk"),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  startTime: varchar("startTime", { length: 5 }).notNull(), // HH:MM
  endTime: varchar("endTime", { length: 5 }).notNull(), // HH:MM
  room: varchar("room", { length: 255 }),
  speaker: varchar("speaker", { length: 255 }),
  speakerTopic: varchar("speakerTopic", { length: 500 }),
  description: text("description"),
  capacity: int("capacity"),
  sortOrder: int("sortOrder").default(0),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const eventSnapshots = mysqlTable("eventSnapshots", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  eventId: varchar("eventId", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  eventData: json("eventData").$type<any>().notNull(),
  savedAt: timestamp("savedAt").defaultNow().notNull(),
});

export const groupTemplates = mysqlTable("groupTemplates", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  participantNames: json("participantNames").$type<string[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const pushTokens = mysqlTable("pushTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  deviceId: varchar("deviceId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Influencer / prospect outreach pipeline — synced per user (not browser-only) */
export const influencerProspects = mysqlTable("influencerProspects", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  prospectData: json("prospectData").$type<Record<string, unknown>>().notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Event = typeof events.$inferSelect;
export type EventSession = typeof eventSessions.$inferSelect;
export type Participant = typeof participants.$inferSelect;
export type EventSnapshot = typeof eventSnapshots.$inferSelect;
export type GroupTemplate = typeof groupTemplates.$inferSelect;
export type PushToken = typeof pushTokens.$inferSelect;
export type InfluencerProspectRow = typeof influencerProspects.$inferSelect;

export type InsertEvent = typeof events.$inferInsert;
export type InsertEventSession = typeof eventSessions.$inferInsert;
export type InsertParticipant = typeof participants.$inferInsert;
export type InsertEventSnapshot = typeof eventSnapshots.$inferInsert;
export type InsertGroupTemplate = typeof groupTemplates.$inferInsert;
export type InsertPushToken = typeof pushTokens.$inferInsert;
export type InsertInfluencerProspectRow = typeof influencerProspects.$inferInsert;
