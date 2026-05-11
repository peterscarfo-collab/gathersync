import * as dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ path: "./.env" });

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const [rows] = await connection.execute('SHOW COLUMNS FROM participants');
  console.log(rows);
  process.exit(0);
}
main().catch(console.error);
