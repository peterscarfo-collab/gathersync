import { describe, it, expect, beforeEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { exportBackup, importBackup, getBackupStats, type BackupData } from '../lib/backup';

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
}));

describe('Backup Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('exportBackup', () => {
    it('should export all data from AsyncStorage', async () => {
      const mockEvents = [
        { id: '1', name: 'Test Event', eventType: 'flexible', month: 1, year: 2026 },
      ];
      const mockSnapshots = [
        { id: 's1', eventId: '1', name: 'Snapshot 1', savedAt: '2025-12-20' },
      ];
      const mockTemplates = [
        { id: 't1', name: 'Monthly Meeting', pattern: 'monthly' },
      ];

      vi.mocked(AsyncStorage.getItem).mockImplementation(async (key) => {
        if (key === 'events') return JSON.stringify(mockEvents);
        if (key === 'event_snapshots') return JSON.stringify(mockSnapshots);
        if (key === 'recurring_templates') return JSON.stringify(mockTemplates);
        return null;
      });

      const backup = await exportBackup();

      expect(backup.version).toBe('1.0');
      expect(backup.exportedAt).toBeDefined();
      expect(backup.events).toEqual(mockEvents);
      expect(backup.snapshots).toEqual(mockSnapshots);
      expect(backup.templates).toEqual(mockTemplates);
    });

    it('should handle empty storage', async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const backup = await exportBackup();

      expect(backup.events).toEqual([]);
      expect(backup.snapshots).toEqual([]);
      expect(backup.templates).toEqual([]);
    });
  });

  describe('importBackup', () => {
    it('should import backup data to AsyncStorage', async () => {
      const mockBackup: BackupData = {
        version: '1.0',
        exportedAt: '2025-12-20T10:00:00Z',
        events: [{ id: '1', name: 'Imported Event' }],
        snapshots: [{ id: 's1', eventId: '1' }],
        templates: [{ id: 't1', name: 'Imported Template' }],
      };

      await importBackup(mockBackup);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('events', JSON.stringify(mockBackup.events));
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('event_snapshots', JSON.stringify(mockBackup.snapshots));
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('recurring_templates', JSON.stringify(mockBackup.templates));
    });

    it('should throw error for invalid backup format', async () => {
      const invalidBackup = { invalid: 'data' } as any;

      await expect(importBackup(invalidBackup)).rejects.toThrow('Invalid backup file format');
    });

    it('should handle empty arrays in backup', async () => {
      const emptyBackup: BackupData = {
        version: '1.0',
        exportedAt: '2025-12-20T10:00:00Z',
        events: [],
        snapshots: [],
        templates: [],
      };

      await importBackup(emptyBackup);

      // Should not call setItem for empty arrays
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('getBackupStats', () => {
    it('should return correct statistics', () => {
      const backup: BackupData = {
        version: '1.0',
        exportedAt: '2025-12-20T10:00:00Z',
        events: [{ id: '1' }, { id: '2' }, { id: '3' }],
        snapshots: [{ id: 's1' }],
        templates: [{ id: 't1' }, { id: 't2' }],
      };

      const stats = getBackupStats(backup);

      expect(stats.eventsCount).toBe(3);
      expect(stats.snapshotsCount).toBe(1);
      expect(stats.templatesCount).toBe(2);
      expect(stats.exportDate).toBe('2025-12-20T10:00:00Z');
    });

    it('should handle missing data gracefully', () => {
      const backup: BackupData = {
        version: '1.0',
        exportedAt: '2025-12-20T10:00:00Z',
        events: [],
        snapshots: [],
        templates: [],
      };

      const stats = getBackupStats(backup);

      expect(stats.eventsCount).toBe(0);
      expect(stats.snapshotsCount).toBe(0);
      expect(stats.templatesCount).toBe(0);
    });
  });

  describe('Backup data integrity', () => {
    it('should preserve data through export and import cycle', async () => {
      const originalEvents = [
        { id: '1', name: 'Event 1', eventType: 'flexible', month: 1, year: 2026 },
        { id: '2', name: 'Event 2', eventType: 'fixed', month: 2, year: 2026 },
      ];

      // Mock export
      vi.mocked(AsyncStorage.getItem).mockImplementation(async (key) => {
        if (key === 'events') return JSON.stringify(originalEvents);
        return null;
      });

      // Export
      const backup = await exportBackup();

      // Clear mocks
      vi.clearAllMocks();

      // Import
      await importBackup(backup);

      // Verify data was imported correctly
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('events', JSON.stringify(originalEvents));
    });
  });
});
