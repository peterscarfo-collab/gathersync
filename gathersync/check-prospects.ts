import * as dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ path: "./.env" });

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const [events] = await connection.execute('SELECT * FROM events WHERE name = "Prospects Directory"');
  const prospectsEvents = events as any[];
  
  if (prospectsEvents.length === 0) {
    console.log("No Prospects Directory event found in DB.");
  } else {
    for (const e of prospectsEvents) {
      const [parts] = await connection.execute('SELECT * FROM participants WHERE eventId = ?', [e.id]);
      const participants = parts as any[];
      console.log(`Prospects Directory event ${e.id} has ${participants.length} participants.`);
      for (const p of participants) {
        console.log(`- ${p.name}: notes=${p.notes}, source=${p.source}, designation=${p.designation}, organization=${p.organization}, leadSource=${p.leadSource}`);
      }
    }
  }
  process.exit(0);
}
main().catch(console.error);
