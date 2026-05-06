import * as dotenv from 'dotenv';
dotenv.config();
import { appRouter } from './server/routers';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from './drizzle/schema';
import fs from 'fs';
import path from 'path';

async function testRouter() {
  const connection = await mysql.createConnection({
    uri: process.env.DATABASE_URL
  });
  const db = drizzle(connection, { schema, mode: 'default' });

  const users = await db.select().from(schema.users).limit(1);
  const user = users[0];

  const backupPath = path.resolve(process.cwd(), '../backups/gathersync-backup-2026-02-24T20-52-43-843Z.json');
  const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  
  const syncTesting = backupData.data.events.find((e: any) => e.name === 'Sync Testing');
  const eventToImport = {
    ...syncTesting,
    id: 'test-event-' + Date.now(), // Generate a new ID to avoid conflicts
    updatedAt: new Date().toISOString(),
    deletedAt: null
  };

  const eventPayload: any = {
    id: eventToImport.id,
    name: eventToImport.name,
    eventType: eventToImport.eventType || 'flexible',
  };
  if (eventToImport.month !== null && eventToImport.month !== undefined) eventPayload.month = eventToImport.month;
  if (eventToImport.year !== null && eventToImport.year !== undefined) eventPayload.year = eventToImport.year;

  // Create a caller with a mock context
  const caller = appRouter.createCaller({ user, req: null as any, res: null as any });

  try {
    console.log("Calling events.create...");
    await caller.events.create(eventPayload);
    console.log("Success!");
  } catch (e: any) {
    console.error("Failed:", e.message);
  }

  // Now test participants
  const parts = backupData.data.participants.filter((p: any) => p.eventId === syncTesting.id || (p.event && p.event.id === syncTesting.id));
  if (parts.length > 0) {
    const part = parts[0];
    const participantPayload: any = {
      id: 'test-part-' + Date.now(),
      eventId: eventToImport.id,
      name: part.name,
      availability: part.availability || {},
      unavailableAllMonth: part.unavailableAllMonth || false,
      source: part.source || 'manual',
      rsvpStatus: part.rsvpStatus || 'no-response',
    };
    try {
      console.log("Calling participants.create...");
      await caller.participants.create(participantPayload);
      console.log("Success!");
    } catch (e: any) {
      console.error("Failed:", e.message);
    }
  }

  await connection.end();
}
testRouter().catch(console.error);