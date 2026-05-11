import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const connection = await mysql.createConnection({
    uri: process.env.DATABASE_URL,
  });
  const db = drizzle(connection);
  const [rows] = await connection.execute("SELECT id, name, hideAttendeeNames FROM events ORDER BY updatedAt DESC LIMIT 5");
  console.log(rows);
  await connection.end();
}
main();
