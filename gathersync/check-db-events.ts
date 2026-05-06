import * as dotenv from 'dotenv';
dotenv.config();
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from './drizzle/schema';

async function checkLatestEvents() {
  const connection = await mysql.createConnection({
    uri: process.env.DATABASE_URL
  });
  const db = drizzle(connection, { schema, mode: 'default' });

  const allEvents = await db.select().from(schema.events);
  console.log(`Total events in DB: ${allEvents.length}`);
  for (const e of allEvents) {
    console.log(`- ${e.name} (id: ${e.id}, deletedAt: ${e.deletedAt})`);
  }

  await connection.end();
}
checkLatestEvents().catch(console.error);