/**
 * Automatic backup system to prevent data loss
 * Creates timestamped backups before risky operations
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { eventsStorage, snapshotsStorage, templatesStorage } from './hybrid-storage';

const AUTO_BACKUP_KEY = '@gathersync_auto_backups';
const MAX_AUTO_BACKUPS = 10; // Keep last 10 automatic backups

export interface AutoBackup {
  id: string;
  timestamp: string;
  reason: string;
  data: {
    events: any[];
    snapshots: any[];
    templates: any[];
  };
}

/**
 * Create an automatic backup before a risky operation
 */
export async function createAutoBackup(reason: string): Promise<string> {
  try {
    console.log('[AutoBackup] Creating automatic backup:', reason);
    
    // Get all current data
    const events = await eventsStorage.getAll();
    const snapshots = await snapshotsStorage.getAll();
    const templates = await templatesStorage.getAll();
    
    const backup: AutoBackup = {
      id: `auto_${Date.now()}`,
      timestamp: new Date().toISOString(),
      reason,
      data: {
        events,
        snapshots,
        templates,
      },
    };
    
    console.log('[AutoBackup] Backup contains:', {
      events: events.length,
      snapshots: snapshots.length,
      templates: templates.length,
    });
    
    // Get existing backups
    const existingBackupsJson = await AsyncStorage.getItem(AUTO_BACKUP_KEY);
    const existingBackups: AutoBackup[] = existingBackupsJson 
      ? JSON.parse(existingBackupsJson) 
      : [];
    
    // Add new backup
    existingBackups.unshift(backup);
    
    // Keep only the most recent backups
    const trimmedBackups = existingBackups.slice(0, MAX_AUTO_BACKUPS);
    
    // Save back to storage
    await AsyncStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(trimmedBackups));
    
    console.log('[AutoBackup] Backup created successfully:', backup.id);
    return backup.id;
  } catch (error) {
    console.error('[AutoBackup] Failed to create backup:', error);
    throw error;
  }
}

/**
 * Get all automatic backups
 */
export async function getAutoBackups(): Promise<AutoBackup[]> {
  try {
    const backupsJson = await AsyncStorage.getItem(AUTO_BACKUP_KEY);
    return backupsJson ? JSON.parse(backupsJson) : [];
  } catch (error) {
    console.error('[AutoBackup] Failed to get backups:', error);
    return [];
  }
}

/**
 * Restore from an automatic backup
 */
export async function restoreFromAutoBackup(backupId: string): Promise<boolean> {
  try {
    console.log('[AutoBackup] Restoring from backup:', backupId);
    
    const backups = await getAutoBackups();
    const backup = backups.find(b => b.id === backupId);
    
    if (!backup) {
      console.error('[AutoBackup] Backup not found:', backupId);
      return false;
    }
    
    // Restore events
    for (const event of backup.data.events) {
      await eventsStorage.add(event);
    }
    
    // Restore snapshots
    for (const snapshot of backup.data.snapshots) {
      await snapshotsStorage.add(snapshot);
    }
    
    // Restore templates
    for (const template of backup.data.templates) {
      await templatesStorage.add(template);
    }
    
    console.log('[AutoBackup] Restore completed:', {
      events: backup.data.events.length,
      snapshots: backup.data.snapshots.length,
      templates: backup.data.templates.length,
    });
    
    return true;
  } catch (error) {
    console.error('[AutoBackup] Failed to restore backup:', error);
    return false;
  }
}

/**
 * Delete an automatic backup
 */
export async function deleteAutoBackup(backupId: string): Promise<void> {
  try {
    const backups = await getAutoBackups();
    const filteredBackups = backups.filter(b => b.id !== backupId);
    await AsyncStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(filteredBackups));
  } catch (error) {
    console.error('[AutoBackup] Failed to delete backup:', error);
  }
}

/**
 * Clear all automatic backups
 */
export async function clearAutoBackups(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AUTO_BACKUP_KEY);
  } catch (error) {
    console.error('[AutoBackup] Failed to clear backups:', error);
  }
}
