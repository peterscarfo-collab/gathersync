import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export interface BackupData {
  version: string;
  exportedAt: string;
  events: any[];
  snapshots: any[];
  templates: any[];
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

    const backup: BackupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      events: eventsJson ? JSON.parse(eventsJson) : [],
      snapshots: snapshotsJson ? JSON.parse(snapshotsJson) : [],
      templates: templatesJson ? JSON.parse(templatesJson) : [],
    };

    return backup;
  } catch (error) {
    console.error('[Backup] Export failed:', error);
    throw new Error('Failed to export backup');
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

    // Import data to AsyncStorage using the correct keys from hybrid-storage.ts
    if (backup.events && backup.events.length > 0) {
      await AsyncStorage.setItem('@gathersync_events', JSON.stringify(backup.events));
    }
    
    if (backup.snapshots && backup.snapshots.length > 0) {
      await AsyncStorage.setItem('@gathersync_snapshots', JSON.stringify(backup.snapshots));
    }
    
    if (backup.templates && backup.templates.length > 0) {
      await AsyncStorage.setItem('@gathersync_templates', JSON.stringify(backup.templates));
    }

    console.log('[Backup] Import successful:', {
      events: backup.events.length,
      snapshots: backup.snapshots.length,
      templates: backup.templates.length,
    });
  } catch (error) {
    console.error('[Backup] Import failed:', error);
    throw new Error('Failed to import backup');
  }
}

/**
 * Download backup file (mobile and web)
 */
export async function downloadBackup(backup: BackupData): Promise<void> {
  const json = JSON.stringify(backup, null, 2);
  const filename = `gathersync-backup-${new Date().toISOString().split('T')[0]}.json`;

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
  exportDate: string;
} {
  return {
    eventsCount: backup.events?.length || 0,
    snapshotsCount: backup.snapshots?.length || 0,
    templatesCount: backup.templates?.length || 0,
    exportDate: backup.exportedAt,
  };
}
