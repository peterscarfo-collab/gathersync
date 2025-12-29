/**
 * Test script to verify participant insert works without SQL errors
 */

import { drizzle } from "drizzle-orm/mysql2";
import { events, participants } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function testParticipantInsert() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error("DATABASE_URL not found in environment");
    process.exit(1);
  }

  console.log("[Test] Connecting to database...");
  const db = drizzle(DATABASE_URL);

  try {
    // Get first event
    const allEvents = await db.select().from(events).limit(1);
    if (allEvents.length === 0) {
      console.error("[Test] No events found in database");
      process.exit(1);
    }

    const testEvent = allEvents[0];
    console.log(`[Test] Using event: ${testEvent.name} (${testEvent.id})`);

    // Create test participant with minimal data
    const testParticipant = {
      id: `test-${Date.now()}`,
      eventId: testEvent.id,
      name: "Test Participant",
      availability: {},
      unavailableAllMonth: false,
    };

    console.log("[Test] Inserting test participant...");
    await db.insert(participants).values(testParticipant);
    console.log("[Test] ✅ Insert successful!");

    // Clean up - delete test participant
    console.log("[Test] Cleaning up test participant...");
    await db.delete(participants).where(eq(participants.id, testParticipant.id));
    console.log("[Test] ✅ Cleanup complete");

    // Test with optional fields
    const testParticipant2 = {
      id: `test-${Date.now()}-2`,
      eventId: testEvent.id,
      name: "Test Participant 2",
      availability: { "2026-01-15": true },
      unavailableAllMonth: false,
      notes: "Test notes",
      source: "manual" as const,
      phone: "+61400000000",
      email: "test@example.com",
      rsvpStatus: "attending" as const,
    };

    console.log("[Test] Inserting test participant with optional fields...");
    await db.insert(participants).values(testParticipant2);
    console.log("[Test] ✅ Insert with optional fields successful!");

    // Clean up
    console.log("[Test] Cleaning up test participant 2...");
    await db.delete(participants).where(eq(participants.id, testParticipant2.id));
    console.log("[Test] ✅ All tests passed!");

    process.exit(0);
  } catch (error) {
    console.error("[Test] ❌ Test failed:", error);
    process.exit(1);
  }
}

testParticipantInsert();
