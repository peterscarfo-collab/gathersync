/**
 * Local Storage Service - Offline-First Data Layer
 * 
 * This is the source of truth for all app data. All operations happen here first.
 * Cloud sync is a separate layer that mirrors this data.
 * 
 * Principles:
 * - Always read/write to AsyncStorage
 * - Never hide or lose data based on auth state
 * - Instant operations (no network delays)
 * - Works completely offline
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Event, Participant, EventSnapshot, RecurringEventTemplate } from '@/types/models';

const STORAGE_KEYS = {
  EVENTS: '@gathersync_events',
  SNAPSHOTS: '@gathersync_snapshots',
  TEMPLATES: '@gathersync_templates',
  SYNC_STATUS: '@gathersync_sync_status',
} as const;

/**
 * Generate a unique ID for new items
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get current ISO timestamp
 */
function now(): string {
  return new Date().toISOString();
}

// ============================================================================
// EVENTS STORAGE
// ============================================================================

export class EventsLocalStorage {
  /**
   * Get all events including deleted ones (for internal use)
   */
  async getAllRaw(): Promise<Event[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.EVENTS);
      
      if (!data) {
        return [];
      }
      
      return JSON.parse(data) as Event[];
    } catch (error) {
      console.error('[LocalStorage] Error reading events:', error);
      return [];
    }
  }

  /**
   * Get all active events from local storage (filters out deleted)
   */
  async getAll(): Promise<Event[]> {
    try {
      console.log('[LocalStorage] Reading all events...');
      const allEvents = await this.getAllRaw();
      
      // Filter out soft-deleted events
      const events = allEvents.filter(e => !e.deletedAt);
      console.log(`[LocalStorage] Found ${events.length} active events (${allEvents.length - events.length} deleted)`);
      return events;
    } catch (error) {
      console.error('[LocalStorage] Error reading events:', error);
      return [];
    }
  }

  /**
   * Get a single event by ID
   */
  async getById(id: string): Promise<Event | null> {
    try {
      console.log(`[LocalStorage] Reading event ${id}...`);
      const events = await this.getAll();
      const event = events.find(e => e.id === id) || null;
      
      if (event) {
        console.log(`[LocalStorage] Found event: ${event.name}`);
      } else {
        console.log(`[LocalStorage] Event ${id} not found`);
      }
      
      return event;
    } catch (error) {
      console.error('[LocalStorage] Error reading event:', error);
      return null;
    }
  }

  /**
   * Add a new event
   */
  async add(eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Promise<Event> {
    try {
      console.log('[LocalStorage] Adding new event:', eventData.name);
      
      // Create full event object with metadata
      const event: Event = {
        ...eventData,
        id: generateId(),
        createdAt: now(),
        updatedAt: now(),
        // Ready to sync to cloud
      };
      
      // Get existing events
      const events = await this.getAll();
      
      // Add new event
      events.push(event);
      
      // Save back to storage
      await AsyncStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
      console.log(`[LocalStorage] Event added successfully: ${event.id}`);
      
      return event;
    } catch (error) {
      console.error('[LocalStorage] Error adding event:', error);
      throw new Error(`Failed to add event: ${error}`);
    }
  }

  /**
   * Add an event with a specific ID (for syncing from cloud)
   * This preserves the cloud event's ID instead of generating a new one
   */
  async addWithId(event: Event): Promise<Event> {
    try {
      console.log('[LocalStorage] Adding event with existing ID:', event.id);
      
      // Get existing events
      const events = await this.getAll();
      
      // Check if event already exists
      const existingIndex = events.findIndex(e => e.id === event.id);
      if (existingIndex !== -1) {
        console.log('[LocalStorage] Event already exists, skipping duplicate');
        return events[existingIndex];
      }
      
      // Add event with its existing ID
      events.push(event);
      
      // Save back to storage
      await AsyncStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
      console.log(`[LocalStorage] Event added with ID: ${event.id}`);
      
      return event;
    } catch (error) {
      console.error('[LocalStorage] Error adding event with ID:', error);
      throw new Error(`Failed to add event: ${error}`);
    }
  }

  /**
   * Update an existing event
   */
  async update(id: string, changes: Partial<Event>): Promise<Event> {
    try {
      console.log(`[LocalStorage] Updating event ${id}...`);
      
      // Get all events including deleted ones
      const events = await this.getAllRaw();
      
      // Find event to update
      const index = events.findIndex(e => e.id === id);
      
      if (index === -1) {
        throw new Error(`Event ${id} not found`);
      }
      
      // Merge changes
      const updatedEvent: Event = {
        ...events[index],
        ...changes,
        id, // Preserve original ID
        createdAt: events[index].createdAt, // Preserve creation time
        updatedAt: now(), // Update modification time
        // Ready to sync to cloud
      };
      
      // Replace in array
      events[index] = updatedEvent;
      
      // Save back to storage
      await AsyncStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
      console.log(`[LocalStorage] Event updated successfully: ${updatedEvent.name}`);
      
      return updatedEvent;
    } catch (error) {
      console.error('[LocalStorage] Error updating event:', error);
      throw new Error(`Failed to update event: ${error}`);
    }
  }

  /**
   * Delete an event (soft delete - marks as deleted)
   */
  async delete(id: string): Promise<void> {
    try {
      console.log(`[LocalStorage] Soft deleting event ${id}...`);
      
      // Get all events including deleted ones
      const events = await this.getAllRaw();
      
      // Find event to delete
      const index = events.findIndex(e => e.id === id);
      
      if (index === -1) {
        console.warn(`[LocalStorage] Event ${id} not found, nothing to delete`);
        return;
      }
      
      // Mark as deleted instead of removing
      events[index] = {
        ...events[index],
        deletedAt: now(),
        updatedAt: now(),
      };
      
      // Save back to storage
      await AsyncStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
      console.log(`[LocalStorage] Event soft deleted successfully (marked with deletedAt)`);
    } catch (error) {
      console.error('[LocalStorage] Error deleting event:', error);
      throw new Error(`Failed to delete event: ${error}`);
    }
  }

  /**
   * Add multiple events (for import/sync)
   */
  async addMany(newEvents: Event[]): Promise<void> {
    try {
      console.log(`[LocalStorage] Adding ${newEvents.length} events...`);
      
      // Get existing events
      const existing = await this.getAll();
      
      // Merge (avoid duplicates by ID)
      const existingIds = new Set(existing.map(e => e.id));
      const toAdd = newEvents.filter(e => !existingIds.has(e.id));
      
      const merged = [...existing, ...toAdd];
      
      // Save back to storage
      await AsyncStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(merged));
      console.log(`[LocalStorage] Added ${toAdd.length} new events (${newEvents.length - toAdd.length} duplicates skipped)`);
    } catch (error) {
      console.error('[LocalStorage] Error adding multiple events:', error);
      throw new Error(`Failed to add events: ${error}`);
    }
  }

  /**
   * Clear all events (dangerous!)
   */
  async clear(): Promise<void> {
    try {
      console.warn('[LocalStorage] Clearing all events...');
      await AsyncStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify([]));
      console.log('[LocalStorage] All events cleared');
    } catch (error) {
      console.error('[LocalStorage] Error clearing events:', error);
      throw new Error(`Failed to clear events: ${error}`);
    }
  }

  /**
   * Export all data as JSON string
   */
  async export(): Promise<string> {
    try {
      console.log('[LocalStorage] Exporting all data...');
      const events = await this.getAll();
      
      const exportData = {
        events,
        exportedAt: now(),
        version: '2.0',
      };
      
      const json = JSON.stringify(exportData, null, 2);
      console.log(`[LocalStorage] Exported ${events.length} events`);
      
      return json;
    } catch (error) {
      console.error('[LocalStorage] Error exporting data:', error);
      throw new Error(`Failed to export data: ${error}`);
    }
  }

  /**
   * Import data from JSON string
   */
  async import(jsonData: string): Promise<number> {
    try {
      console.log('[LocalStorage] Importing data...');
      
      const data = JSON.parse(jsonData);
      
      if (!data.events || !Array.isArray(data.events)) {
        throw new Error('Invalid import data: missing events array');
      }
      
      // Add all imported events
      await this.addMany(data.events);
      
      console.log(`[LocalStorage] Import complete: ${data.events.length} events`);
      return data.events.length;
    } catch (error) {
      console.error('[LocalStorage] Error importing data:', error);
      throw new Error(`Failed to import data: ${error}`);
    }
  }
}

// ============================================================================
// SNAPSHOTS STORAGE
// ============================================================================

export class SnapshotsLocalStorage {
  async getAll(): Promise<EventSnapshot[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SNAPSHOTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[LocalStorage] Error reading snapshots:', error);
      return [];
    }
  }

  async getByEventId(eventId: string): Promise<EventSnapshot[]> {
    const snapshots = await this.getAll();
    return snapshots.filter(s => s.eventId === eventId);
  }

  async add(snapshot: Omit<EventSnapshot, 'id' | 'createdAt'>): Promise<EventSnapshot> {
    try {
      const newSnapshot: EventSnapshot = {
        ...snapshot,
        id: generateId(),
      };
      
      const snapshots = await this.getAll();
      snapshots.push(newSnapshot);
      
      await AsyncStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(snapshots));
      return newSnapshot;
    } catch (error) {
      console.error('[LocalStorage] Error adding snapshot:', error);
      throw new Error(`Failed to add snapshot: ${error}`);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const snapshots = await this.getAll();
      const filtered = snapshots.filter(s => s.id !== id);
      await AsyncStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(filtered));
    } catch (error) {
      console.error('[LocalStorage] Error deleting snapshot:', error);
      throw new Error(`Failed to delete snapshot: ${error}`);
    }
  }
}

// ============================================================================
// TEMPLATES STORAGE
// ============================================================================

export class TemplatesLocalStorage {
  async getAll(): Promise<RecurringEventTemplate[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.TEMPLATES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[LocalStorage] Error reading templates:', error);
      return [];
    }
  }

  async getById(id: string): Promise<RecurringEventTemplate | null> {
    const templates = await this.getAll();
    return templates.find(t => t.id === id) || null;
  }

  async add(template: Omit<RecurringEventTemplate, 'id' | 'createdAt'>): Promise<RecurringEventTemplate> {
    try {
      const newTemplate: RecurringEventTemplate = {
        ...template,
        id: generateId(),
        createdAt: now(),
      };
      
      const templates = await this.getAll();
      templates.push(newTemplate);
      
      await AsyncStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
      return newTemplate;
    } catch (error) {
      console.error('[LocalStorage] Error adding template:', error);
      throw new Error(`Failed to add template: ${error}`);
    }
  }

  async update(id: string, changes: Partial<RecurringEventTemplate>): Promise<RecurringEventTemplate> {
    try {
      const templates = await this.getAll();
      const index = templates.findIndex(t => t.id === id);
      
      if (index === -1) {
        throw new Error(`Template ${id} not found`);
      }
      
      const updated: RecurringEventTemplate = {
        ...templates[index],
        ...changes,
        id,
        createdAt: templates[index].createdAt,
      };
      
      templates[index] = updated;
      await AsyncStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
      
      return updated;
    } catch (error) {
      console.error('[LocalStorage] Error updating template:', error);
      throw new Error(`Failed to update template: ${error}`);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const templates = await this.getAll();
      const filtered = templates.filter(t => t.id !== id);
      await AsyncStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(filtered));
    } catch (error) {
      console.error('[LocalStorage] Error deleting template:', error);
      throw new Error(`Failed to delete template: ${error}`);
    }
  }
}

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================

export const eventsLocalStorage = new EventsLocalStorage();
export const snapshotsLocalStorage = new SnapshotsLocalStorage();
export const templatesLocalStorage = new TemplatesLocalStorage();
