import * as dotenv from 'dotenv';
dotenv.config();
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from './drizzle/schema';
import { like } from 'drizzle-orm';

async function check50th() {
  const connection = await mysql.createConnection({
    uri: process.env.DATABASE_URL
  });
  const db = drizzle(connection, { schema, mode: 'default' });

  const events = await db.select().from(schema.events).where(like(schema.events.name, '%50th%'));
  console.log(`Found ${events.length} 50th birthday events in DB.`);
  for (const e of events) {
    console.log(`- ${e.id} : ${e.name}`);
  }

  await connection.end();
}
check50th().catch(console.error);