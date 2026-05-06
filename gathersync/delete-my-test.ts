import * as dotenv from 'dotenv';
dotenv.config();
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from './drizzle/schema';
import { eq, like } from 'drizzle-orm';

async function deleteMyTestEvent() {
  const connection = await mysql.createConnection({
    uri: process.env.DATABASE_URL
  });
  const db = drizzle(connection, { schema, mode: 'default' });

  console.log("Deleting the test event I made...");
  const events = await db.select().from(schema.events).where(like(schema.events.id, 'test-event-%'));
  for (const e of events) {
    console.log(`Deleting ${e.id}`);
    await db.delete(schema.participants).where(eq(schema.participants.eventId, e.id));
    await db.delete(schema.events).where(eq(schema.events.id, e.id));
  }

  await connection.end();
  console.log("Done.");
}
deleteMyTestEvent().catch(console.error);