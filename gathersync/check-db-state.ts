import * as dotenv from 'dotenv';
dotenv.config();
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from './drizzle/schema';
import { eq } from 'drizzle-orm';

async function checkState() {
  const connection = await mysql.createConnection({
    uri: process.env.DATABASE_URL
  });
  const db = drizzle(connection, { schema, mode: 'default' });

  const ev = await db.select().from(schema.events).where(eq(schema.events.id, '1137f50d-6989-4b65-ac35-b3602c0ba8c9'));
  console.log(`Event in DB:`, ev.length > 0 ? `Yes, deletedAt: ${ev[0].deletedAt}` : `No`);

  await connection.end();
}
checkState().catch(console.error);