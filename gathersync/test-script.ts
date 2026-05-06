import { config } from 'dotenv';
config();
import { db } from './server/db.ts';

// Test script to check database functionality
async function test() {
  console.log("Checking DB...");
  const events = await db.getEventParticipants("123");
  console.log("Events:", events);
}

test().catch(console.error);