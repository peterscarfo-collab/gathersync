import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  events,
  participants,
  eventSnapshots,
  groupTemplates,
  pushTokens,
  type InsertEvent,
  type InsertParticipant,
  type InsertEventSnapshot,
  type InsertGroupTemplate,
  type InsertPushToken,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Events
 */
export async function getUserEvents(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(events).where(eq(events.userId, userId));
}

export async function getEventById(eventId: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  return result[0] || null;
}

export async function createEvent(data: InsertEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(events).values(data);
  return data.id;
}

export async function updateEvent(eventId: string, data: Partial<InsertEvent>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(events).set(data).where(eq(events.id, eventId));
}

export async function deleteEvent(eventId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete participants first
  await db.delete(participants).where(eq(participants.eventId, eventId));
  // Then delete event
  await db.delete(events).where(eq(events.id, eventId));
}

/**
 * Participants
 */
export async function getEventParticipants(eventId: string) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(participants).where(eq(participants.eventId, eventId));
}

export async function createParticipant(data: InsertParticipant) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(participants).values(data);
  return data.id;
}

export async function updateParticipant(participantId: string, data: Partial<InsertParticipant>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(participants).set(data).where(eq(participants.id, participantId));
}

export async function deleteParticipant(participantId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(participants).where(eq(participants.id, participantId));
}

/**
 * Event Snapshots
 */
export async function getUserSnapshots(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(eventSnapshots).where(eq(eventSnapshots.userId, userId));
}

export async function createSnapshot(data: InsertEventSnapshot) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(eventSnapshots).values(data);
  return data.id;
}

export async function deleteSnapshot(snapshotId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(eventSnapshots).where(eq(eventSnapshots.id, snapshotId));
}

/**
 * Group Templates
 */
export async function getUserTemplates(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(groupTemplates).where(eq(groupTemplates.userId, userId));
}

export async function createTemplate(data: InsertGroupTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(groupTemplates).values(data);
  return data.id;
}

export async function deleteTemplate(templateId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(groupTemplates).where(eq(groupTemplates.id, templateId));
}

/**
 * Push Tokens
 */
export async function registerPushToken(data: InsertPushToken) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Upsert: update if exists, insert if not
  await db.insert(pushTokens).values(data).onDuplicateKeyUpdate({
    set: {
      deviceId: data.deviceId,
      updatedAt: new Date(),
    },
  });
}

export async function unregisterPushToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(pushTokens).where(eq(pushTokens.token, token));
}

export async function getUserPushTokens(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(pushTokens).where(eq(pushTokens.userId, userId));
}

export async function getEventParticipantTokens(eventId: string, excludeUserId?: number) {
  const db = await getDb();
  if (!db) return [];

  // Get the event to find the owner
  const event = await getEventById(eventId);
  if (!event) return [];

  // Get push tokens for the event owner (excluding the user who made the change)
  const tokens = await db
    .select()
    .from(pushTokens)
    .where(eq(pushTokens.userId, event.userId));

  if (excludeUserId) {
    return tokens.filter((t) => t.userId !== excludeUserId);
  }

  return tokens;
}
