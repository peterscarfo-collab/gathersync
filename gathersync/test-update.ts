import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { events } from "./drizzle/schema";
dotenv.config();

async function main() {
  const connection = await mysql.createConnection({
    uri: process.env.DATABASE_URL,
  });
  const db = drizzle(connection);
  
  const eventId = '1778127424563-wxzsddugb'; // GatherSync Launch Meeting
  
  console.log("Updating event...");
  await db.update(events).set({ hideAttendeeNames: true }).where(eq(events.id, eventId));
  
  const [rows] = await connection.execute("SELECT id, name, hideAttendeeNames FROM events WHERE id = ?", [eventId]);
  console.log("After update:", rows);
  
  await connection.end();
}
main();
