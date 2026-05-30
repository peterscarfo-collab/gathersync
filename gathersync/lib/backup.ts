import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { eventsLocalStorage } from './local-storage';
import type { InfluencerProspect } from '@/types/models';

const INFLUENCERS_KEY = '@gathersync_influencers';

export interface BackupData {
  version: string;
  exportedAt: string;
  type?: 'full' | 'single';
  events: any[];
  snapshots: any[];
  templates: any[];
  influencers?: InfluencerProspect[];
}

/**
 * Export all data to a JSON backup file
 */
export async function exportBackup(): Promise<BackupData> {
  try {
    // Get all data from AsyncStorage using the correct keys from hybrid-storage.ts
    const eventsJson = await AsyncStorage.getItem('@gathersync_events');
    const snapshotsJson = await AsyncStorage.getItem('@gathersync_snapshots');
    const templatesJson = await AsyncStorage.getItem('@gathersync_templates');
    const influencersJson = await AsyncStorage.getItem(INFLUENCERS_KEY);

    const backup: BackupData = {
      version: '1.1',
      exportedAt: new Date().toISOString(),
      type: 'full',
      events: eventsJson ? JSON.parse(eventsJson) : [],
      snapshots: snapshotsJson ? JSON.parse(snapshotsJson) : [],
      templates: templatesJson ? JSON.parse(templatesJson) : [],
      influencers: influencersJson ? JSON.parse(influencersJson) : [],
    };

    return backup;
  } catch (error) {
    console.error('[Backup] Export failed:', error);
    throw new Error('Failed to export backup');
  }
}

/**
 * Export a single event to a JSON backup file
 */
export async function exportSingleEventBackup(eventId: string): Promise<BackupData> {
  try {
    const eventsJson = await AsyncStorage.getItem('@gathersync_events');
    const events = eventsJson ? JSON.parse(eventsJson) : [];
    
    const eventToExport = events.find((e: any) => e.id === eventId);
    if (!eventToExport) {
      throw new Error('Event not found');
    }

    const backup: BackupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      type: 'single',
      events: [eventToExport],
      snapshots: [],
      templates: [],
    };

    return backup;
  } catch (error) {
    console.error('[Backup] Single event export failed:', error);
    throw new Error('Failed to export event backup');
  }
}

/**
 * Import data from a backup file
 */
export async function importBackup(backup: BackupData): Promise<void> {
  try {
    // Validate backup structure
    if (!backup.version || !backup.exportedAt) {
      throw new Error('Invalid backup file format');
    }

    const isSingleEvent = backup.type === 'single' || 
      (backup.type === undefined && backup.events?.length === 1 && (!backup.snapshots || backup.snapshots.length === 0) && (!backup.templates || backup.templates.length === 0));

    // Import data to AsyncStorage using the correct keys from hybrid-storage.ts
    if (backup.events && backup.events.length > 0) {
      if (isSingleEvent) {
        const importedEvent = backup.events[0];
        
        // Force the imported event to be the newest version so it overwrites any cloud data
        // and clears any soft-deleted status
        importedEvent.updatedAt = new Date().toISOString();
        importedEvent.deletedAt = null;
        
        // Ensure all participants also have cleared deletedAt and updated timestamps
        if (importedEvent.participants) {
          importedEvent.participants = importedEvent.participants.map((p: any) => ({
            ...p,
            deletedAt: null,
            updatedAt: new Date().toISOString()
          }));
        }
        
        // We MUST use direct AsyncStorage here instead of eventsLocalStorage.update()
        // because update() uses object spreading which will NOT remove the deletedAt flag
        // if it already exists on the soft-deleted local event.
        const currentEvents = await eventsLocalStorage.getAllRaw();
        const existingIndex = currentEvents.findIndex((e: any) => e.id === importedEvent.id);
        
        if (existingIndex !== -1) {
          currentEvents[existingIndex] = importedEvent;
          await AsyncStorage.setItem('@gathersync_events', JSON.stringify(currentEvents));
        } else {
          await eventsLocalStorage.addWithId(importedEvent);
        }
        
        // Force push the restored event to the cloud database to ensure it's not immediately
        // deleted again by auto-sync pulling a stale tombstone
        try {
          const { eventsCloudStorage } = await import('./cloud-storage');
          // Check if event exists using getById since getAll() filters out soft-deleted events
          const cloudEvent = await eventsCloudStorage.getById(importedEvent.id);
          const existsInCloud = !!cloudEvent;
          
          if (existsInCloud) {
            await eventsCloudStorage.update(importedEvent.id, importedEvent);
            console.log('[Backup] Force updated single event in cloud');
          } else {
            await eventsCloudStorage.add(importedEvent);
            console.log('[Backup] Force created single event in cloud');
          }
        } catch (cloudError) {
          console.error('[Backup] Failed to force push to cloud (will rely on auto-sync):', cloudError);
        }
      } else {
        // Force all imported events to be the newest version so they overwrite the cloud
        const eventsToSave = backup.events.map(e => ({
          ...e,
          deletedAt: null,
          updatedAt: new Date().toISOString()
        }));
        await AsyncStorage.setItem('@gathersync_events', JSON.stringify(eventsToSave));
      }
    }
    
    if (backup.snapshots && backup.snapshots.length > 0) {
      await AsyncStorage.setItem('@gathersync_snapshots', JSON.stringify(backup.snapshots));
    }
    
    if (backup.templates && backup.templates.length > 0) {
      await AsyncStorage.setItem('@gathersync_templates', JSON.stringify(backup.templates));
    }

    if (!isSingleEvent && backup.influencers !== undefined) {
      await AsyncStorage.setItem(INFLUENCERS_KEY, JSON.stringify(backup.influencers));
      if (backup.influencers.length > 0) {
        try {
          const { influencersCloudStorage } = await import('@/lib/cloud-storage');
          await influencersCloudStorage.syncAll(backup.influencers);
          console.log('[Backup] Pushed influencer prospects to cloud');
        } catch (cloudError) {
          console.error('[Backup] Failed to push influencers to cloud:', cloudError);
        }
      }
    }

    console.log('[Backup] Import successful:', {
      events: backup.events.length,
      snapshots: backup.snapshots.length,
      templates: backup.templates.length,
      influencers: backup.influencers?.length ?? 'unchanged',
    });
  } catch (error) {
    console.error('[Backup] Import failed:', error);
    throw new Error('Failed to import backup');
  }
}

/**
 * Download backup file (mobile and web)
 */
export async function downloadBackup(backup: BackupData, customFilename?: string): Promise<void> {
  const json = JSON.stringify(backup, null, 2);
  const filename = customFilename || `gathersync-backup-${new Date().toISOString().split('T')[0]}.json`;

  if (Platform.OS === 'web') {
    // Web: trigger download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  } else {
    // Mobile: Write to app's document directory and share
    // This works on both iOS and Android without special permissions
    const fileUri = (FileSystem.documentDirectory || '') + filename;
    
    // Write the JSON file
    await FileSystem.writeAsStringAsync(fileUri, json);
    
    // Share the file so user can save it wherever they want
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Save GatherSync Backup',
        UTI: 'public.json',
      });
    } else {
      console.log('[Backup] Sharing not available. File saved to:', fileUri);
    }
  }
}

/**
 * Read backup file from user selection
 */
export async function readBackupFile(fileUri: string): Promise<BackupData> {
  try {
    let json: string;

    if (Platform.OS === 'web') {
      // Web: read from File object (passed as data URI)
      const response = await fetch(fileUri);
      json = await response.text();
    } else {
      // Mobile: read from file system
      json = await FileSystem.readAsStringAsync(fileUri);
    }

    const backup = JSON.parse(json) as BackupData;
    
    // Validate backup structure
    if (!backup.version || !backup.exportedAt || !backup.events) {
      throw new Error('Invalid backup file format');
    }

    return backup;
  } catch (error) {
    console.error('[Backup] Read file failed:', error);
    throw new Error('Failed to read backup file');
  }
}

/**
 * Get backup statistics
 */
export function getBackupStats(backup: BackupData): {
  eventsCount: number;
  snapshotsCount: number;
  templatesCount: number;
  influencersCount: number | null;
  exportDate: string;
} {
  return {
    eventsCount: backup.events?.length || 0,
    snapshotsCount: backup.snapshots?.length || 0,
    templatesCount: backup.templates?.length || 0,
    influencersCount: backup.influencers !== undefined ? backup.influencers.length : null,
    exportDate: backup.exportedAt,
  };
}
