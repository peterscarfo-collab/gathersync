/**
 * Cleanup utility to remove duplicate events
 * This is a one-time fix for the sync bug that created duplicates
 */

import { eventsLocalStorage } from './local-storage';
import { recurringTemplatesStorage } from './recurring-storage';

export async function removeDuplicateRecurringTemplates(): Promise<{
  removed: number;
  kept: number;
  duplicates: string[];
}> {
  const result = {
    removed: 0,
    kept: 0,
    duplicates: [] as string[],
  };

  try {
    const templates = await recurringTemplatesStorage.getAll();
    console.log(`[Cleanup] Found ${templates.length} total recurring templates`);

    // Group templates by name
    const templatesByName = new Map<string, typeof templates>();
    for (const template of templates) {
      const existing = templatesByName.get(template.name) || [];
      existing.push(template);
      templatesByName.set(template.name, existing);
    }

    // Find duplicates (same name, multiple entries)
    for (const [name, duplicateTemplates] of templatesByName.entries()) {
      if (duplicateTemplates.length > 1) {
        console.log(`[Cleanup] Found ${duplicateTemplates.length} duplicate templates of "${name}"`);
        result.duplicates.push(name);

        // Sort by creation date, keep the oldest (first created)
        duplicateTemplates.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        // Keep the first one (oldest), delete the rest
        const [keep, ...remove] = duplicateTemplates;
        
        console.log(`[Cleanup] Keeping template ${keep.id} (created ${keep.createdAt})`);
        result.kept++;

        for (const template of remove) {
          console.log(`[Cleanup] Removing duplicate template ${template.id} (created ${template.createdAt})`);
          await recurringTemplatesStorage.delete(template.id);
          result.removed++;
        }
      }
    }

    console.log(`[Cleanup] Template cleanup complete: removed ${result.removed}, kept ${result.kept}`);
    return result;
  } catch (error) {
    console.error('[Cleanup] Template cleanup failed:', error);
    throw error;
  }
}

export async function removeDuplicateEvents(): Promise<{
  removed: number;
  kept: number;
  duplicates: string[];
}> {
  const result = {
    removed: 0,
    kept: 0,
    duplicates: [] as string[],
  };

  try {
    const events = await eventsLocalStorage.getAll();
    console.log(`[Cleanup] Found ${events.length} total events`);

    // Group events by name
    const eventsByName = new Map<string, typeof events>();
    for (const event of events) {
      const existing = eventsByName.get(event.name) || [];
      existing.push(event);
      eventsByName.set(event.name, existing);
    }

    // Find duplicates (same name, multiple entries)
    for (const [name, duplicateEvents] of eventsByName.entries()) {
      if (duplicateEvents.length > 1) {
        console.log(`[Cleanup] Found ${duplicateEvents.length} duplicates of "${name}"`);
        result.duplicates.push(name);

        // Sort by creation date, keep the oldest (first created)
        duplicateEvents.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        // Keep the first one (oldest), delete the rest
        const [keep, ...remove] = duplicateEvents;
        
        console.log(`[Cleanup] Keeping event ${keep.id} (created ${keep.createdAt})`);
        result.kept++;

        for (const event of remove) {
          console.log(`[Cleanup] Removing duplicate ${event.id} (created ${event.createdAt})`);
          await eventsLocalStorage.delete(event.id);
          result.removed++;
        }
      }
    }

    console.log(`[Cleanup] Complete: removed ${result.removed}, kept ${result.kept}`);
    return result;
  } catch (error) {
    console.error('[Cleanup] Failed:', error);
    throw error;
  }
}
