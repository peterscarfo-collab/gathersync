import * as dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from './drizzle/schema';
import { eq } from 'drizzle-orm';

async function importBackup() {
  const connection = await mysql.createConnection({
    uri: process.env.DATABASE_URL
  });
  const db = drizzle(connection, { schema, mode: 'default' });

  // Get user ID 1 (Assuming Peter is user ID 1 or the only user right now)
  const userRows = await db.select().from(schema.users);
  if (userRows.length === 0) {
    console.error('No users found in database! Please log in once first.');
    await connection.end();
    return;
  }
  const mainUser = userRows[0];
  const userId = mainUser.id;
  console.log(`Importing data for user: ${mainUser.name} (ID: ${userId})`);

  // Read backup file
  const backupPath = path.resolve(process.cwd(), '../backups/gathersync-backup-2026-02-24T20-52-43-843Z.json');
  console.log(`Reading backup from: ${backupPath}`);
  const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

  const { events, participants, snapshots, templates } = backupData.data;

  // Import Events
  let eventsInserted = 0;
  if (events && events.length > 0) {
    for (const evt of events) {
      // Check if exists
      const existing = await db.select().from(schema.events).where(eq(schema.events.id, evt.id));
      if (existing.length === 0) {
        await db.insert(schema.events).values({
          id: evt.id,
          userId: userId,
          name: evt.name || 'Unnamed Event',
          eventType: evt.eventType || 'fixed',
          month: evt.month || new Date().getMonth() + 1,
          year: evt.year || new Date().getFullYear(),
          fixedDate: evt.fixedDate || null,
          fixedTime: evt.fixedTime || null,
          archived: evt.archived || false,
          finalized: evt.finalized || false,
          teamLeader: evt.teamLeader || null,
          venueName: evt.venueName || null,
          meetingType: evt.meetingType || null,
          createdAt: evt.createdAt ? new Date(evt.createdAt) : new Date(),
          updatedAt: evt.updatedAt ? new Date(evt.updatedAt) : new Date()
        });
        eventsInserted++;
      }
    }
  }
  console.log(`Inserted ${eventsInserted} new events out of ${events?.length || 0} in backup.`);

  // Import Participants
  let participantsInserted = 0;
  if (participants && participants.length > 0) {
    for (const part of participants) {
      const existing = await db.select().from(schema.participants).where(eq(schema.participants.id, part.id));
      if (existing.length === 0) {
        // Handle eventId correctly
        let eventId = part.eventId;
        if (!eventId && part.event && part.event.id) {
          eventId = part.event.id;
        }
        
        if (!eventId) {
          console.warn(`Skipping participant ${part.name} - no eventId found.`);
          continue;
        }

        await db.insert(schema.participants).values({
          id: part.id,
          eventId: eventId,
          name: part.name || 'Unknown',
          availability: part.availability || {},
          unavailableAllMonth: part.unavailableAllMonth || false,
          source: part.source || 'manual',
          phone: part.phone || null,
          email: part.email || null,
          rsvpStatus: part.rsvpStatus || 'no-response',
          createdAt: part.createdAt ? new Date(part.createdAt) : new Date(),
          updatedAt: part.updatedAt ? new Date(part.updatedAt) : new Date()
        });
        participantsInserted++;
      }
    }
  }
  console.log(`Inserted ${participantsInserted} new participants out of ${participants?.length || 0} in backup.`);

  await connection.end();
  console.log('Import completed successfully!');
}

importBackup().catch(console.error);
