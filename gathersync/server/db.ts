import { and, eq, ne, or, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  events,
  participants,
  eventSessions,
  eventSnapshots,
  groupTemplates,
  pushTokens,
  influencerProspects,
  type InsertEvent,
  type InsertEventSession,
  type InsertParticipant,
  type InsertEventSnapshot,
  type InsertGroupTemplate,
  type InsertPushToken,
  type InsertInfluencerProspectRow,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import {
  normalizeBusinessName,
  normalizePhone,
  prospectBusinessNameKey,
} from "../lib/bizomedia-letterbox";

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

/** Creates influencerProspects table on TiDB/MySQL if missing — runs on every server start. */
export async function ensureInfluencerProspectsTable(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Skipping influencerProspects setup — DATABASE_URL not configured");
    return;
  }
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS influencerProspects (
        id varchar(64) NOT NULL,
        userId int NOT NULL,
        prospectData json NOT NULL,
        deletedAt timestamp NULL,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY influencerProspects_userId_idx (userId)
      )
    `);
    console.log("[Database] influencerProspects table ready");
  } catch (error) {
    console.error("[Database] Failed to ensure influencerProspects table:", error);
  }
}

/** Conference columns + eventSessions table — runs on server start (idempotent). */
export async function ensureConferenceSchema(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Skipping conference schema setup — DATABASE_URL not configured");
    return;
  }
  try {
    await db.execute(sql`
      ALTER TABLE events
      MODIFY eventType enum('flexible','fixed','conference') NOT NULL
    `);
  } catch (error) {
    console.warn("[Database] eventType enum may already include conference:", error);
  }

  const addColumn = async (columnSql: ReturnType<typeof sql>) => {
    try {
      await db.execute(columnSql);
    } catch {
      // Column likely exists
    }
  };

  await addColumn(sql`ALTER TABLE events ADD COLUMN startDate varchar(10)`);
  await addColumn(sql`ALTER TABLE events ADD COLUMN endDate varchar(10)`);
  await addColumn(sql`ALTER TABLE events ADD COLUMN allDay boolean DEFAULT false`);
  await addColumn(sql`ALTER TABLE events ADD COLUMN venueCapacity int`);
  await addColumn(sql`ALTER TABLE events ADD COLUMN selectionDeadline varchar(10)`);

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS eventSessions (
        id varchar(64) NOT NULL,
        eventId varchar(64) NOT NULL,
        title varchar(255) NOT NULL,
        date varchar(10) NOT NULL,
        startTime varchar(5) NOT NULL,
        endTime varchar(5) NOT NULL,
        room varchar(255),
        speaker varchar(255),
        description text,
        capacity int,
        sortOrder int DEFAULT 0,
        deletedAt timestamp NULL,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY eventSessions_eventId_idx (eventId)
      )
    `);
    console.log("[Database] Conference schema ready");
  } catch (error) {
    console.error("[Database] Failed to ensure conference schema:", error);
  }
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

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;

  const normalized = email.trim().toLowerCase();
  if (!normalized) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${normalized}`)
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/** User who already owns the influencer pipeline (most prospects in DB). */
export async function getPrimaryInfluencerPipelineUserId(): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select({ userId: influencerProspects.userId })
    .from(influencerProspects)
    .where(isNull(influencerProspects.deletedAt));

  const counts = new Map<number, number>();
  for (const row of rows) {
    counts.set(row.userId, (counts.get(row.userId) ?? 0) + 1);
  }

  let bestUserId: number | null = null;
  let bestCount = 0;
  for (const [userId, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestUserId = userId;
    }
  }

  return bestUserId;
}

export type CrmWebhookOwnerResolution = {
  userId: number;
  source:
    | "GATHERSYNC_CRM_WEBHOOK_USER_ID"
    | "OWNER_OPEN_ID"
    | "GATHERSYNC_CRM_OWNER_EMAIL"
    | "primary_pipeline_user";
};

export async function resolveCrmWebhookUserIdWithSource(): Promise<CrmWebhookOwnerResolution | null> {
  const explicit = process.env.GATHERSYNC_CRM_WEBHOOK_USER_ID?.trim();
  if (explicit) {
    const parsed = Number.parseInt(explicit, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return { userId: parsed, source: "GATHERSYNC_CRM_WEBHOOK_USER_ID" };
    }
  }

  const openId =
    ENV.ownerOpenId?.trim() ||
    process.env.EXPO_PUBLIC_OWNER_OPEN_ID?.trim() ||
    "";
  if (openId) {
    const owner = await getUserByOpenId(openId);
    if (owner?.id) {
      return { userId: owner.id, source: "OWNER_OPEN_ID" };
    }
  }

  const ownerEmail = process.env.GATHERSYNC_CRM_OWNER_EMAIL?.trim();
  if (ownerEmail) {
    const byEmail = await getUserByEmail(ownerEmail);
    if (byEmail?.id) {
      return { userId: byEmail.id, source: "GATHERSYNC_CRM_OWNER_EMAIL" };
    }
  }

  const pipelineUserId = await getPrimaryInfluencerPipelineUserId();
  if (pipelineUserId) {
    return { userId: pipelineUserId, source: "primary_pipeline_user" };
  }

  return null;
}

/**
 * Events
 */
export async function getAllEvents() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(events);
}

export async function getUserEvents(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(events).where(eq(events.userId, userId));
}

export async function getInvitedEvents(email: string, name: string, userId: number) {
  const db = await getDb();
  if (!db) return [];

  // Find events where the user is a participant (by email OR exact name match) but NOT the owner
  const invitedEvents = await db.select({ event: events })
    .from(events)
    .innerJoin(participants, eq(events.id, participants.eventId))
    .where(
      and(
        or(
          eq(participants.email, email),
          eq(participants.name, name)
        ),
        ne(events.userId, userId)
      )
    );
    
  return invitedEvents.map(row => row.event);
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

export async function deleteEvent(eventId: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.transaction(async (tx) => {
    const event = await tx
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.userId, userId)))
      .limit(1);

    if (event.length === 0) {
      throw new Error(`Event ${eventId} not found for current user`);
    }

    // Keep participant, session, and event deletion atomic.
    await tx.delete(participants).where(eq(participants.eventId, eventId));
    await tx.delete(eventSessions).where(eq(eventSessions.eventId, eventId));
    await tx.delete(events).where(and(eq(events.id, eventId), eq(events.userId, userId)));
  });
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
 * Conference sessions
 */
export async function getEventSessions(eventId: string) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(eventSessions)
    .where(and(eq(eventSessions.eventId, eventId), isNull(eventSessions.deletedAt)));
}

export async function createEventSession(data: InsertEventSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(eventSessions).values(data);
  return data.id;
}

export async function updateEventSession(sessionId: string, data: Partial<InsertEventSession>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(eventSessions).set(data).where(eq(eventSessions.id, sessionId));
}

export async function deleteEventSession(sessionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(eventSessions)
    .set({ deletedAt: new Date() })
    .where(eq(eventSessions.id, sessionId));
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

/**
 * Influencer / prospect outreach pipeline
 */
export async function getUserInfluencerProspects(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(influencerProspects)
    .where(and(eq(influencerProspects.userId, userId), isNull(influencerProspects.deletedAt)));
}

export async function upsertInfluencerProspect(userId: number, prospect: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const id = String(prospect.id || "");
  if (!id) throw new Error("Prospect id is required");

  const row: InsertInfluencerProspectRow = {
    id,
    userId,
    prospectData: prospect,
    deletedAt: null,
    updatedAt: prospect.updatedAt ? new Date(String(prospect.updatedAt)) : new Date(),
  };

  await db
    .insert(influencerProspects)
    .values(row)
    .onDuplicateKeyUpdate({
      set: {
        prospectData: row.prospectData,
        deletedAt: null,
        updatedAt: row.updatedAt,
      },
    });

  return id;
}

export async function syncInfluencerProspects(userId: number, prospects: Record<string, unknown>[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  for (const prospect of prospects) {
    await upsertInfluencerProspect(userId, prospect);
  }

  const incomingIds = new Set(prospects.map(p => String(p.id)).filter(Boolean));
  const existing = await getUserInfluencerProspects(userId);
  for (const row of existing) {
    if (!incomingIds.has(row.id)) {
      await db
        .update(influencerProspects)
        .set({ deletedAt: new Date() })
        .where(and(eq(influencerProspects.id, row.id), eq(influencerProspects.userId, userId)));
    }
  }

  return prospects.length;
}

export async function deleteInfluencerProspect(prospectId: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(influencerProspects)
    .set({ deletedAt: new Date() })
    .where(and(eq(influencerProspects.id, prospectId), eq(influencerProspects.userId, userId)));
}

function rowToInfluencerProspect(row: { id: string; prospectData: Record<string, unknown> }): Record<string, unknown> {
  return { ...row.prospectData, id: row.id };
}

/** Webhook lookup — contactId first, then email across all users */
export async function findInfluencerProspectForWebhook(opts: {
  contactId?: string | null;
  email?: string;
}): Promise<{ userId: number; prospect: Record<string, unknown> } | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select()
    .from(influencerProspects)
    .where(isNull(influencerProspects.deletedAt));

  const contactId = opts.contactId?.trim();
  const emailLower = opts.email?.trim().toLowerCase();

  if (contactId) {
    const byId = rows.find(r => r.id === contactId);
    if (byId) {
      return { userId: byId.userId, prospect: rowToInfluencerProspect(byId) };
    }
  }

  if (emailLower) {
    for (const row of rows) {
      const data = row.prospectData as Record<string, unknown>;
      const prospectEmail = String(data.contactEmail || '')
        .trim()
        .toLowerCase();
      if (prospectEmail === emailLower) {
        return { userId: row.userId, prospect: rowToInfluencerProspect(row) };
      }
    }
  }

  return null;
}

/** Letterbox prospect webhook — contactId → email → phone → businessName */
export async function findLetterboxProspectForWebhook(opts: {
  contactId?: string | null;
  email?: string | null;
  phone?: string | null;
  businessName?: string | null;
}): Promise<{ userId: number; prospect: Record<string, unknown> } | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select()
    .from(influencerProspects)
    .where(isNull(influencerProspects.deletedAt));

  const contactId = opts.contactId?.trim();
  if (contactId) {
    const byId = rows.find(r => r.id === contactId);
    if (byId) {
      return { userId: byId.userId, prospect: rowToInfluencerProspect(byId) };
    }
  }

  const emailLower = opts.email?.trim().toLowerCase();
  if (emailLower) {
    for (const row of rows) {
      const data = row.prospectData as Record<string, unknown>;
      const prospectEmail = String(data.contactEmail || "")
        .trim()
        .toLowerCase();
      if (prospectEmail && prospectEmail === emailLower) {
        return { userId: row.userId, prospect: rowToInfluencerProspect(row) };
      }
    }
  }

  const phoneKey = opts.phone?.trim() ? normalizePhone(opts.phone) : "";
  if (phoneKey.length >= 8) {
    for (const row of rows) {
      const data = row.prospectData as Record<string, unknown>;
      const prospectPhone = String(data.contactPhone || "").trim();
      if (prospectPhone && normalizePhone(prospectPhone) === phoneKey) {
        return { userId: row.userId, prospect: rowToInfluencerProspect(row) };
      }
    }
  }

  const businessKey = opts.businessName?.trim()
    ? normalizeBusinessName(opts.businessName)
    : "";
  if (businessKey) {
    for (const row of rows) {
      const data = row.prospectData as Record<string, unknown>;
      if (prospectBusinessNameKey(data) === businessKey) {
        return { userId: row.userId, prospect: rowToInfluencerProspect(row) };
      }
    }
  }

  return null;
}

/** Owner user for CRM webhooks that create new letterbox contacts */
export async function resolveCrmWebhookUserId(): Promise<number | null> {
  const resolved = await resolveCrmWebhookUserIdWithSource();
  return resolved?.userId ?? null;
}

export async function applyBizomediaInviteWebhook(userId: number, prospect: Record<string, unknown>) {
  return upsertInfluencerProspect(userId, prospect);
}
