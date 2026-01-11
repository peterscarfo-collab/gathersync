import { eventsLocalStorage, snapshotsLocalStorage } from './local-storage';
import { eventsCloudStorage, snapshotsCloudStorage } from './cloud-storage';
import * as Auth from './auth';
import type { Event, EventSnapshot } from '@/types/models';

/**
 * Sync Service
 * 
 * Wraps LocalStorageService with cloud sync layer.
 * - Local storage is source of truth (instant, offline-capable)
 * - Cloud storage is backup + cross-device sync layer
 * - All operations happen on local first, then sync to cloud in background
 */

interface SyncResult {
  success: boolean;
  uploaded: number;
  downloaded: number;
  errors: string[];
}

class SyncService {
  /**
   * Sync all local events to cloud
   * Uploads any events that exist locally but not in cloud
   */
  async syncToCloud(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      uploaded: 0,
      downloaded: 0,
      errors: [],
    };

    try {
      // Check if authenticated
      const user = await Auth.getUserInfo();
      const isAuthenticated = user !== null;
      if (!isAuthenticated) {
        console.log('[SyncService] Not authenticated, skipping cloud sync');
        return result;
      }

      console.log('[SyncService] Starting sync to cloud...');

      // Get all local events
      const localEvents = await eventsLocalStorage.getAll();
      console.log(`[SyncService] Found ${localEvents.length} local events`);

      // Get all cloud events to check what's already synced
      const cloudEvents = await eventsCloudStorage.getAll();
      const cloudEventIds = new Set(cloudEvents.map(e => e.id));
      console.log(`[SyncService] Found ${cloudEvents.length} cloud events`);

      // Upload events that don't exist in cloud
      for (const event of localEvents) {
        try {
          if (cloudEventIds.has(event.id)) {
            // Event exists in cloud, update it
            console.log(`[SyncService] Updating event in cloud: ${event.name}`);
            await eventsCloudStorage.update(event.id, event);
          } else {
            // Event doesn't exist in cloud, create it
            console.log(`[SyncService] Uploading new event to cloud: ${event.name}`);
            await eventsCloudStorage.add(event);
          }
          result.uploaded++;
        } catch (error) {
          console.error(`[SyncService] Failed to sync event ${event.name}:`, error);
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`[SyncService] Error details: ${errorMsg}`);
          result.errors.push(`Failed to sync ${event.name}: ${errorMsg}`);
          result.success = false;
        }
      }

      // Sync snapshots - TEMPORARILY DISABLED FOR DEBUGGING
      // const localSnapshots = await snapshotsLocalStorage.getAll();
      // const cloudSnapshots = await snapshotsCloudStorage.getAll();
      // const cloudSnapshotIds = new Set(cloudSnapshots.map(s => s.id));

      // for (const snapshot of localSnapshots) {
      //   try {
      //     if (!cloudSnapshotIds.has(snapshot.id)) {
      //       await snapshotsCloudStorage.add(snapshot);
      //       result.uploaded++;
      //     }
      //   } catch (error) {
      //     console.error(`[SyncService] Failed to sync snapshot:`, error);
      //     result.errors.push('Failed to sync snapshot');
      //   }
      // }
      console.log('[SyncService] Snapshot sync disabled for debugging');

      // TODO: Add template syncing once template system is unified

      console.log(`[SyncService] Sync to cloud complete: ${result.uploaded} uploaded, ${result.errors.length} errors`);
      return result;
    } catch (error) {
      console.error('[SyncService] Sync to cloud failed:', error);
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return result;
    }
  }

  /**
   * Sync all cloud events to local
   * Downloads any events that exist in cloud but not locally
   */
  async syncFromCloud(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      uploaded: 0,
      downloaded: 0,
      errors: [],
    };

    try {
      // Check if authenticated
      const user = await Auth.getUserInfo();
      const isAuthenticated = user !== null;
      if (!isAuthenticated) {
        console.log('[SyncService] Not authenticated, skipping cloud sync');
        return result;
      }

      console.log('[SyncService] Starting sync from cloud...');

      // Get all cloud events
      const cloudEvents = await eventsCloudStorage.getAll();
      console.log(`[SyncService] Found ${cloudEvents.length} cloud events`);

      // Get all local events to check what's already synced
      const localEvents = await eventsLocalStorage.getAll();
      const localEventIds = new Set(localEvents.map(e => e.id));
      console.log(`[SyncService] Found ${localEvents.length} local events`);

      // Download events that don't exist locally
      for (const event of cloudEvents) {
        try {
          if (!localEventIds.has(event.id)) {
            console.log(`[SyncService] Downloading new event from cloud: ${event.name}`);
            await eventsLocalStorage.add(event);
            result.downloaded++;
          } else {
            // Event exists locally, check if cloud version is newer
            const localEvent = localEvents.find(e => e.id === event.id);
            if (localEvent && new Date(event.updatedAt) > new Date(localEvent.updatedAt)) {
              console.log(`[SyncService] Updating local event with newer cloud version: ${event.name}`);
              await eventsLocalStorage.update(event.id, event);
              result.downloaded++;
            }
          }
        } catch (error) {
          console.error(`[SyncService] Failed to download event ${event.name}:`, error);
          result.errors.push(`Failed to download ${event.name}`);
          result.success = false;
        }
      }

      // Sync snapshots - TEMPORARILY DISABLED FOR DEBUGGING
      // const cloudSnapshots = await snapshotsCloudStorage.getAll();
      // const localSnapshots = await snapshotsLocalStorage.getAll();
      // const localSnapshotIds = new Set(localSnapshots.map(s => s.id));

      // for (const snapshot of cloudSnapshots) {
      //   try {
      //     if (!localSnapshotIds.has(snapshot.id)) {
      //       await snapshotsLocalStorage.add(snapshot);
      //       result.downloaded++;
      //     }
      //   } catch (error) {
      //     console.error(`[SyncService] Failed to download snapshot:`, error);
      //     result.errors.push('Failed to download snapshot');
      //   }
      // }
      console.log('[SyncService] Snapshot sync disabled for debugging');

      // TODO: Add template syncing once template system is unified

      console.log(`[SyncService] Sync from cloud complete: ${result.downloaded} downloaded, ${result.errors.length} errors`);
      return result;
    } catch (error) {
      console.error('[SyncService] Sync from cloud failed:', error);
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return result;
    }
  }

  /**
   * Full bidirectional sync
   * Uploads local changes and downloads cloud changes
   */
  async fullSync(): Promise<SyncResult> {
    console.log('[SyncService] Starting full bidirectional sync...');

    // First sync to cloud (upload local changes)
    const uploadResult = await this.syncToCloud();

    // Then sync from cloud (download cloud changes)
    const downloadResult = await this.syncFromCloud();

    // Combine results
    const result: SyncResult = {
      success: uploadResult.success && downloadResult.success,
      uploaded: uploadResult.uploaded,
      downloaded: downloadResult.downloaded,
      errors: [...uploadResult.errors, ...downloadResult.errors],
    };

    console.log(`[SyncService] Full sync complete: ${result.uploaded} uploaded, ${result.downloaded} downloaded, ${result.errors.length} errors`);
    return result;
  }

  /**
   * Auto-sync on app launch
   * Call this when the app starts to sync latest data
   */
  async autoSyncOnLaunch(): Promise<void> {
    try {
      const user = await Auth.getUserInfo();
      const isAuthenticated = user !== null;
      if (!isAuthenticated) {
        console.log('[SyncService] Not authenticated, skipping auto-sync');
        return;
      }

      console.log('[SyncService] Running auto-sync on launch...');
      await this.fullSync();
    } catch (error) {
      console.error('[SyncService] Auto-sync on launch failed:', error);
      // Don't throw - app should still work with local data
    }
  }

  /**
   * Auto-sync after save
   * Call this after creating/updating an event to sync to cloud
   */
  async autoSyncAfterSave(eventId: string): Promise<void> {
    try {
      const user = await Auth.getUserInfo();
      const isAuthenticated = user !== null;
      if (!isAuthenticated) {
        console.log('[SyncService] Not authenticated, skipping auto-sync after save');
        return;
      }

      console.log(`[SyncService] Auto-syncing event ${eventId} to cloud...`);
      
      const event = await eventsLocalStorage.getById(eventId);
      if (!event) {
        console.error(`[SyncService] Event ${eventId} not found in local storage`);
        return;
      }

      // Check if event exists in cloud
      const cloudEvents = await eventsCloudStorage.getAll();
      const cloudEvent = cloudEvents.find(e => e.id === eventId);

      if (cloudEvent) {
        // Update existing cloud event
        await eventsCloudStorage.update(eventId, event);
        console.log(`[SyncService] Updated event ${event.name} in cloud`);
      } else {
        // Create new cloud event
        await eventsCloudStorage.add(event);
        console.log(`[SyncService] Created event ${event.name} in cloud`);
      }
    } catch (error) {
      console.error('[SyncService] Auto-sync after save failed:', error);
      // Don't throw - local save already succeeded
    }
  }
}

// Export singleton instance
export const syncService = new SyncService();
