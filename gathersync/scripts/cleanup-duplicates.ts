/**
 * Cleanup script to remove duplicate events from the database
 * 
 * This script identifies events with the same name, month, and year,
 * keeps the oldest one (by createdAt), and deletes the duplicates.
 */

import { drizzle } from "drizzle-orm/mysql2";
import { events, participants } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function cleanupDuplicates() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error("DATABASE_URL not found in environment");
    process.exit(1);
  }

  console.log("[Cleanup] Connecting to database...");
  const db = drizzle(DATABASE_URL);

  try {
    // Get all events
    console.log("[Cleanup] Fetching all events...");
    const allEvents = await db.select().from(events);
    console.log(`[Cleanup] Found ${allEvents.length} total events`);

    // Group events by name + month + year
    const eventGroups = new Map<string, typeof allEvents>();
    
    for (const event of allEvents) {
      const key = `${event.name}|${event.month}|${event.year}`;
      if (!eventGroups.has(key)) {
        eventGroups.set(key, []);
      }
      eventGroups.get(key)!.push(event);
    }

    console.log(`[Cleanup] Found ${eventGroups.size} unique event groups`);

    // Find duplicates
    let totalDuplicates = 0;
    const eventsToDelete: string[] = [];

    for (const [key, group] of eventGroups) {
      if (group.length > 1) {
        console.log(`\n[Cleanup] Found ${group.length} duplicates for: ${key}`);
        
        // Sort by createdAt (oldest first)
        group.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        
        // Keep the first one (oldest), mark rest for deletion
        const [keep, ...duplicates] = group;
        console.log(`  ✓ Keeping: ${keep.id} (created: ${keep.createdAt.toISOString()})`);
        
        for (const duplicate of duplicates) {
          console.log(`  ✗ Deleting: ${duplicate.id} (created: ${duplicate.createdAt.toISOString()})`);
          eventsToDelete.push(duplicate.id);
          totalDuplicates++;
        }
      }
    }

    if (eventsToDelete.length === 0) {
      console.log("\n[Cleanup] No duplicates found! Database is clean.");
      process.exit(0);
    }

    console.log(`\n[Cleanup] Found ${totalDuplicates} duplicate events to delete`);
    console.log("[Cleanup] Deleting duplicates...");

    // Delete participants first (foreign key constraint)
    for (const eventId of eventsToDelete) {
      const deletedParticipants = await db.delete(participants).where(eq(participants.eventId, eventId));
      console.log(`  - Deleted participants for event ${eventId}`);
    }

    // Delete duplicate events
    for (const eventId of eventsToDelete) {
      await db.delete(events).where(eq(events.id, eventId));
      console.log(`  - Deleted event ${eventId}`);
    }

    console.log(`\n[Cleanup] ✅ Successfully deleted ${totalDuplicates} duplicate events`);
    
    // Verify final count
    const remainingEvents = await db.select().from(events);
    console.log(`[Cleanup] Final event count: ${remainingEvents.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error("[Cleanup] Error:", error);
    process.exit(1);
  }
}

cleanupDuplicates();
