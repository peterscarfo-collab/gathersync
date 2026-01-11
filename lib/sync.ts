import AsyncStorage from '@react-native-async-storage/async-storage';
import { eventsCloudStorage, snapshotsCloudStorage, templatesCloudStorage } from './cloud-storage';
import type { Event, EventSnapshot, GroupTemplate } from '@/types/models';

const EVENTS_KEY = '@gathersync_events';
const SNAPSHOTS_KEY = '@gathersync_snapshots';
const TEMPLATES_KEY = '@gathersync_templates';
const LAST_SYNC_KEY = '@gathersync_last_sync';

/**
 * Sync local data to cloud storage
 * This runs automatically after login to upload any local data to the cloud
 */
export async function syncLocalToCloud(): Promise<{
  success: boolean;
  eventsSynced: number;
  snapshotsSynced: number;
  templatesSynced: number;
  error?: string;
}> {
  console.log('[Sync] Starting local to cloud sync...');
  
  let eventsSynced = 0;
  let snapshotsSynced = 0;
  let templatesSynced = 0;

  try {
    // Debug: List all AsyncStorage keys
    const allKeys = await AsyncStorage.getAllKeys();
    console.log('[Sync] All AsyncStorage keys:', allKeys);
    
    // Sync Events
    console.log('[Sync] Looking for events at key:', EVENTS_KEY);
    const localEventsData = await AsyncStorage.getItem(EVENTS_KEY);
    console.log('[Sync] Raw events data:', localEventsData ? `${localEventsData.substring(0, 100)}...` : 'null');
    if (localEventsData) {
      const localEvents: Event[] = JSON.parse(localEventsData);
      console.log(`[Sync] Found ${localEvents.length} local events`);
      
      // Get existing cloud events
      const cloudEvents = await eventsCloudStorage.getAll();
      const cloudEventIds = new Set(cloudEvents.map(e => e.id));
      
      // Upload events that don't exist in cloud
      for (const event of localEvents) {
        if (!cloudEventIds.has(event.id)) {
          await eventsCloudStorage.add(event);
          eventsSynced++;
          console.log(`[Sync] Uploaded event: ${event.name}`);
        } else {
          // Update existing event with latest local data
          await eventsCloudStorage.update(event.id, event);
          console.log(`[Sync] Updated event: ${event.name}`);
        }
      }
    }

    // Sync Snapshots
    const localSnapshotsData = await AsyncStorage.getItem(SNAPSHOTS_KEY);
    if (localSnapshotsData) {
      const localSnapshots: EventSnapshot[] = JSON.parse(localSnapshotsData);
      console.log(`[Sync] Found ${localSnapshots.length} local snapshots`);
      
      const cloudSnapshots = await snapshotsCloudStorage.getAll();
      const cloudSnapshotIds = new Set(cloudSnapshots.map(s => s.id));
      
      for (const snapshot of localSnapshots) {
        if (!cloudSnapshotIds.has(snapshot.id)) {
          await snapshotsCloudStorage.add(snapshot);
          snapshotsSynced++;
          console.log(`[Sync] Uploaded snapshot: ${snapshot.id}`);
        }
      }
    }

    // Sync Templates
    const localTemplatesData = await AsyncStorage.getItem(TEMPLATES_KEY);
    if (localTemplatesData) {
      const localTemplates: GroupTemplate[] = JSON.parse(localTemplatesData);
      console.log(`[Sync] Found ${localTemplates.length} local templates`);
      
      const cloudTemplates = await templatesCloudStorage.getAll();
      const cloudTemplateIds = new Set(cloudTemplates.map(t => t.id));
      
      for (const template of localTemplates) {
        if (!cloudTemplateIds.has(template.id)) {
          await templatesCloudStorage.add(template);
          templatesSynced++;
          console.log(`[Sync] Uploaded template: ${template.name}`);
        }
      }
    }

    // Record sync timestamp
    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    
    console.log('[Sync] Sync completed successfully', {
      eventsSynced,
      snapshotsSynced,
      templatesSynced,
    });

    return {
      success: true,
      eventsSynced,
      snapshotsSynced,
      templatesSynced,
    };
  } catch (error) {
    console.error('[Sync] Sync failed:', error);
    return {
      success: false,
      eventsSynced,
      snapshotsSynced,
      templatesSynced,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Sync cloud data to local storage
 * This downloads cloud data to the device
 */
export async function syncCloudToLocal(): Promise<{
  success: boolean;
  eventsDownloaded: number;
  snapshotsDownloaded: number;
  templatesDownloaded: number;
  error?: string;
}> {
  console.log('[Sync] Starting cloud to local sync...');
  
  let eventsDownloaded = 0;
  let snapshotsDownloaded = 0;
  let templatesDownloaded = 0;

  try {
    // Download Events and merge with local
    const cloudEvents = await eventsCloudStorage.getAll();
    if (cloudEvents.length > 0) {
      // Get existing local events
      const localEventsData = await AsyncStorage.getItem(EVENTS_KEY);
      const localEvents: Event[] = localEventsData ? JSON.parse(localEventsData) : [];
      
      // Create a map of local events by ID
      const localEventMap = new Map(localEvents.map(e => [e.id, e]));
      
      // Merge cloud events with local, preferring cloud data for conflicts
      for (const cloudEvent of cloudEvents) {
        localEventMap.set(cloudEvent.id, cloudEvent);
      }
      
      // Convert back to array
      const mergedEvents = Array.from(localEventMap.values());
      
      await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(mergedEvents));
      eventsDownloaded = cloudEvents.length;
      console.log(`[Sync] Downloaded ${eventsDownloaded} events, merged with ${localEvents.length} local events, total: ${mergedEvents.length}`);
    }

    // Download Snapshots and merge with local
    const cloudSnapshots = await snapshotsCloudStorage.getAll();
    if (cloudSnapshots.length > 0) {
      const localSnapshotsData = await AsyncStorage.getItem(SNAPSHOTS_KEY);
      const localSnapshots: EventSnapshot[] = localSnapshotsData ? JSON.parse(localSnapshotsData) : [];
      
      const localSnapshotMap = new Map(localSnapshots.map(s => [s.id, s]));
      for (const cloudSnapshot of cloudSnapshots) {
        localSnapshotMap.set(cloudSnapshot.id, cloudSnapshot);
      }
      
      const mergedSnapshots = Array.from(localSnapshotMap.values());
      await AsyncStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(mergedSnapshots));
      snapshotsDownloaded = cloudSnapshots.length;
      console.log(`[Sync] Downloaded ${snapshotsDownloaded} snapshots, merged with ${localSnapshots.length} local snapshots, total: ${mergedSnapshots.length}`);
    }

    // Download Templates and merge with local
    const cloudTemplates = await templatesCloudStorage.getAll();
    if (cloudTemplates.length > 0) {
      const localTemplatesData = await AsyncStorage.getItem(TEMPLATES_KEY);
      const localTemplates: GroupTemplate[] = localTemplatesData ? JSON.parse(localTemplatesData) : [];
      
      const localTemplateMap = new Map(localTemplates.map(t => [t.id, t]));
      for (const cloudTemplate of cloudTemplates) {
        localTemplateMap.set(cloudTemplate.id, cloudTemplate);
      }
      
      const mergedTemplates = Array.from(localTemplateMap.values());
      await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(mergedTemplates));
      templatesDownloaded = cloudTemplates.length;
      console.log(`[Sync] Downloaded ${templatesDownloaded} templates, merged with ${localTemplates.length} local templates, total: ${mergedTemplates.length}`);
    }

    // Record sync timestamp
    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    
    console.log('[Sync] Cloud to local sync completed', {
      eventsDownloaded,
      snapshotsDownloaded,
      templatesDownloaded,
    });

    return {
      success: true,
      eventsDownloaded,
      snapshotsDownloaded,
      templatesDownloaded,
    };
  } catch (error) {
    console.error('[Sync] Cloud to local sync failed:', error);
    return {
      success: false,
      eventsDownloaded,
      snapshotsDownloaded,
      templatesDownloaded,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Full bidirectional sync
 * Merges local and cloud data intelligently
 */
export async function fullSync(): Promise<{
  success: boolean;
  uploaded: number;
  downloaded: number;
  error?: string;
}> {
  console.log('[Sync] Starting full bidirectional sync...');
  
  try {
    // First upload local data to cloud
    const uploadResult = await syncLocalToCloud();
    
    // Then download any cloud data we don't have locally
    const downloadResult = await syncCloudToLocal();
    
    const success = uploadResult.success && downloadResult.success;
    const uploaded = uploadResult.eventsSynced + uploadResult.snapshotsSynced + uploadResult.templatesSynced;
    const downloaded = downloadResult.eventsDownloaded + downloadResult.snapshotsDownloaded + downloadResult.templatesDownloaded;
    
    console.log('[Sync] Full sync completed', { success, uploaded, downloaded });
    
    return {
      success,
      uploaded,
      downloaded,
      error: uploadResult.error || downloadResult.error,
    };
  } catch (error) {
    console.error('[Sync] Full sync failed:', error);
    return {
      success: false,
      uploaded: 0,
      downloaded: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get last sync timestamp
 */
export async function getLastSyncTime(): Promise<Date | null> {
  const timestamp = await AsyncStorage.getItem(LAST_SYNC_KEY);
  return timestamp ? new Date(timestamp) : null;
}
