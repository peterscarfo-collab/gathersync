import * as dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ path: "./.env" });

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const [rows] = await connection.execute('SELECT * FROM participants WHERE notes IS NOT NULL AND notes != ""');
  const parts = rows as any[];

  console.log(`Found ${parts.length} participants with notes:`);
  for (const p of parts) {
    console.log(`- ${p.name}: notes=${p.notes}`);
  }
  process.exit(0);
}
main().catch(console.error);
