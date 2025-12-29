import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Event, EventSnapshot, GroupTemplate } from '@/types/models';
import { eventsCloudStorage, snapshotsCloudStorage, templatesCloudStorage } from './cloud-storage';
import * as Auth from './auth';

/**
 * Hybrid storage that automatically uses:
 * - Local AsyncStorage for guest users (not logged in)
 * - Cloud database for authenticated users
 * 
 * This allows the app to work immediately without login while still
 * providing cloud sync for users who want it.
 */

const EVENTS_KEY = '@gathersync_events';
const SNAPSHOTS_KEY = '@gathersync_snapshots';
const TEMPLATES_KEY = '@gathersync_templates';

async function isAuthenticated(): Promise<boolean> {
  const token = await Auth.getSessionToken();
  const user = await Auth.getUserInfo();
  return !!(token && user);
}

// Events Storage
export const eventsStorage = {
  async getAll(): Promise<Event[]> {
    const authed = await isAuthenticated();
    console.log('[HybridStorage] getAll - authenticated:', authed);
    
    // Always read local storage first
    const localData = await AsyncStorage.getItem(EVENTS_KEY);
    const localEvents: Event[] = localData ? JSON.parse(localData) : [];
    console.log('[HybridStorage] Local events:', localEvents.length);
    
    if (authed) {
      try {
        const cloudEvents = await eventsCloudStorage.getAll();
        console.log('[HybridStorage] Cloud events:', cloudEvents.length);
        
        // If we have local events but cloud is empty, auto-sync local to cloud
        if (localEvents.length > 0 && cloudEvents.length === 0) {
          console.log('[HybridStorage] Auto-syncing local events to cloud...');
          for (const event of localEvents) {
            try {
              await eventsCloudStorage.add(event);
            } catch (error) {
              console.error('[HybridStorage] Failed to sync event:', event.name, error);
            }
          }
          return localEvents;
        }
        
        // Merge local and cloud events (prefer cloud for duplicates)
        const mergedMap = new Map<string, Event>();
        localEvents.forEach(e => mergedMap.set(e.id, e));
        cloudEvents.forEach(e => mergedMap.set(e.id, e)); // Cloud overwrites local
        return Array.from(mergedMap.values());
      } catch (error) {
        console.error('[HybridStorage] Cloud storage failed, using local:', error);
        return localEvents;
      }
    }
    
    // Use local storage for guests
    return localEvents;
  },

  async getById(id: string): Promise<Event | null> {
    const authed = await isAuthenticated();
    
    if (authed) {
      try {
        return await eventsCloudStorage.getById(id);
      } catch (error) {
        console.error('[HybridStorage] Cloud storage failed, falling back to local:', error);
      }
    }
    
    const events = await this.getAll();
    return events.find(e => e.id === id) || null;
  },

  async add(event: Event): Promise<void> {
    const authed = await isAuthenticated();
    
    // Always save to local storage as backup
    const localData = await AsyncStorage.getItem(EVENTS_KEY);
    const localEvents: Event[] = localData ? JSON.parse(localData) : [];
    localEvents.push(event);
    await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(localEvents));
    console.log('[HybridStorage] Saved to local storage');
    
    if (authed) {
      try {
        await eventsCloudStorage.add(event);
        console.log('[HybridStorage] Saved to cloud storage');
      } catch (error) {
        console.error('[HybridStorage] Cloud storage failed, but local backup exists:', error);
      }
    }
  },

  async update(id: string, updates: Partial<Event>): Promise<void> {
    const authed = await isAuthenticated();
    
    // Get the full event first (from cloud or local)
    const fullEvent = await this.getById(id);
    if (!fullEvent) {
      console.error('[HybridStorage] Cannot update - event not found:', id);
      throw new Error('Event not found');
    }
    
    // Merge updates with full event
    const updatedEvent = { ...fullEvent, ...updates };
    
    // Always save to local storage as backup
    const localData = await AsyncStorage.getItem(EVENTS_KEY);
    const localEvents: Event[] = localData ? JSON.parse(localData) : [];
    const index = localEvents.findIndex(e => e.id === id);
    
    if (index !== -1) {
      // Update existing local event
      localEvents[index] = updatedEvent;
      console.log('[HybridStorage] Updated existing local event');
    } else {
      // Add to local storage if not present (cloud-only event)
      localEvents.push(updatedEvent);
      console.log('[HybridStorage] Added cloud event to local storage');
    }
    
    await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(localEvents));
    console.log('[HybridStorage] Saved to local storage');
    
    // Update cloud if authenticated
    if (authed) {
      try {
        await eventsCloudStorage.update(id, updates);
        console.log('[HybridStorage] Updated in cloud storage');
      } catch (error) {
        console.error('[HybridStorage] Cloud storage failed, but local backup exists:', error);
      }
    }
  },

  async delete(id: string): Promise<void> {
    const authed = await isAuthenticated();
    
    // Always delete from local storage
    const localData = await AsyncStorage.getItem(EVENTS_KEY);
    const localEvents: Event[] = localData ? JSON.parse(localData) : [];
    const filtered = localEvents.filter(e => e.id !== id);
    await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(filtered));
    console.log('[HybridStorage] Deleted from local storage');
    
    if (authed) {
      try {
        await eventsCloudStorage.delete(id);
        console.log('[HybridStorage] Deleted from cloud storage');
      } catch (error) {
        console.error('[HybridStorage] Cloud storage failed:', error);
      }
    }
  },
};

// Snapshots Storage
export const snapshotsStorage = {
  async getAll(): Promise<EventSnapshot[]> {
    const authed = await isAuthenticated();
    
    if (authed) {
      try {
        return await snapshotsCloudStorage.getAll();
      } catch (error) {
        console.error('[HybridStorage] Cloud storage failed, falling back to local:', error);
      }
    }
    
    const data = await AsyncStorage.getItem(SNAPSHOTS_KEY);
    return data ? JSON.parse(data) : [];
  },

  async add(snapshot: EventSnapshot): Promise<void> {
    const authed = await isAuthenticated();
    
    if (authed) {
      try {
        await snapshotsCloudStorage.add(snapshot);
        return;
      } catch (error) {
        console.error('[HybridStorage] Cloud storage failed, falling back to local:', error);
      }
    }
    
    const snapshots = await this.getAll();
    snapshots.push(snapshot);
    await AsyncStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
  },

  async delete(id: string): Promise<void> {
    const authed = await isAuthenticated();
    
    if (authed) {
      try {
        await snapshotsCloudStorage.delete(id);
        return;
      } catch (error) {
        console.error('[HybridStorage] Cloud storage failed, falling back to local:', error);
      }
    }
    
    const snapshots = await this.getAll();
    const filtered = snapshots.filter(s => s.id !== id);
    await AsyncStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(filtered));
  },
};

// Templates Storage
export const templatesStorage = {
  async getAll(): Promise<GroupTemplate[]> {
    const authed = await isAuthenticated();
    
    if (authed) {
      try {
        return await templatesCloudStorage.getAll();
      } catch (error) {
        console.error('[HybridStorage] Cloud storage failed, falling back to local:', error);
      }
    }
    
    const data = await AsyncStorage.getItem(TEMPLATES_KEY);
    return data ? JSON.parse(data) : [];
  },

  async add(template: GroupTemplate): Promise<void> {
    const authed = await isAuthenticated();
    
    if (authed) {
      try {
        await templatesCloudStorage.add(template);
        return;
      } catch (error) {
        console.error('[HybridStorage] Cloud storage failed, falling back to local:', error);
      }
    }
    
    const templates = await this.getAll();
    templates.push(template);
    await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  },

  async delete(id: string): Promise<void> {
    const authed = await isAuthenticated();
    
    if (authed) {
      try {
        await templatesCloudStorage.delete(id);
        return;
      } catch (error) {
        console.error('[HybridStorage] Cloud storage failed, falling back to local:', error);
      }
    }
    
    const templates = await this.getAll();
    const filtered = templates.filter(t => t.id !== id);
    await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(filtered));
  },
};
