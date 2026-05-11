import * as dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ path: "./.env" });

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const [rows] = await connection.execute('SELECT DISTINCT name FROM participants');
  const parts = rows as any[];

  console.log(`Found ${parts.length} unique participants.`);
  process.exit(0);
}
main().catch(console.error);
