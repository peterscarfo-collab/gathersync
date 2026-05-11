import * as dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ path: "./.env" });

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const [rows] = await connection.execute('SELECT * FROM participants');
  const allParts = rows as any[];
  const realEstateParts = allParts.filter(p => 
    JSON.stringify(p).toLowerCase().includes('real') || JSON.stringify(p).toLowerCase().includes('estate')
  );

  console.log(`Found ${realEstateParts.length} participants with 'real' or 'estate' anywhere in their data:`);
  for (const p of realEstateParts) {
    console.log(`- ${p.name}: source=${p.source}, notes=${p.notes}, email=${p.email}, leadSource=${p.leadSource}`);
  }
  process.exit(0);
}
main().catch(console.error);
