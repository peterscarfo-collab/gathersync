import { describe, it, expect, beforeEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncLocalToCloud, syncCloudToLocal, fullSync } from '../lib/sync';
import { eventsCloudStorage } from '../lib/cloud-storage';
import type { Event } from '../types/models';

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
}));

// Mock cloud storage
vi.mock('../lib/cloud-storage', () => ({
  eventsCloudStorage: {
    getAll: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  snapshotsCloudStorage: {
    getAll: vi.fn(),
    add: vi.fn(),
  },
  templatesCloudStorage: {
    getAll: vi.fn(),
    add: vi.fn(),
  },
}));

describe('Cloud Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('syncLocalToCloud', () => {
    it('should upload local events to cloud', async () => {
      const localEvents: Event[] = [
        {
          id: 'event1',
          name: 'Team Meeting',
          eventType: 'flexible',
          month: 12,
          year: 2025,
          participants: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'event2',
          name: 'Holiday Party',
          eventType: 'fixed',
          fixedDate: '2025-12-25',
          fixedTime: '18:00',
          month: 12,
          year: 2025,
          participants: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      // Mock local storage has events
      vi.mocked(AsyncStorage.getItem).mockImplementation(async (key) => {
        if (key === '@gathersync_events') {
          return JSON.stringify(localEvents);
        }
        return null;
      });

      // Mock cloud storage is empty
      vi.mocked(eventsCloudStorage.getAll).mockResolvedValue([]);

      const result = await syncLocalToCloud();

      expect(result.success).toBe(true);
      expect(result.eventsSynced).toBe(2);
      expect(eventsCloudStorage.add).toHaveBeenCalledTimes(2);
      expect(eventsCloudStorage.add).toHaveBeenCalledWith(localEvents[0]);
      expect(eventsCloudStorage.add).toHaveBeenCalledWith(localEvents[1]);
    });

    it('should not duplicate events already in cloud', async () => {
      const localEvents: Event[] = [
        {
          id: 'event1',
          name: 'Team Meeting',
          eventType: 'flexible',
          month: 12,
          year: 2025,
          participants: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const cloudEvents: Event[] = [
        {
          id: 'event1',
          name: 'Team Meeting (old)',
          eventType: 'flexible',
          month: 12,
          year: 2025,
          participants: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      vi.mocked(AsyncStorage.getItem).mockImplementation(async (key) => {
        if (key === '@gathersync_events') {
          return JSON.stringify(localEvents);
        }
        return null;
      });

      vi.mocked(eventsCloudStorage.getAll).mockResolvedValue(cloudEvents);

      const result = await syncLocalToCloud();

      expect(result.success).toBe(true);
      expect(result.eventsSynced).toBe(0); // No new events added
      expect(eventsCloudStorage.add).not.toHaveBeenCalled();
      expect(eventsCloudStorage.update).toHaveBeenCalledWith('event1', localEvents[0]);
    });

    it('should handle empty local storage', async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
      vi.mocked(eventsCloudStorage.getAll).mockResolvedValue([]);

      const result = await syncLocalToCloud();

      expect(result.success).toBe(true);
      expect(result.eventsSynced).toBe(0);
      expect(eventsCloudStorage.add).not.toHaveBeenCalled();
    });
  });

  describe('syncCloudToLocal', () => {
    it('should download cloud events to local storage', async () => {
      const cloudEvents: Event[] = [
        {
          id: 'event1',
          name: 'Team Meeting',
          eventType: 'flexible',
          month: 12,
          year: 2025,
          participants: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      vi.mocked(eventsCloudStorage.getAll).mockResolvedValue(cloudEvents);

      const result = await syncCloudToLocal();

      expect(result.success).toBe(true);
      expect(result.eventsDownloaded).toBe(1);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@gathersync_events',
        JSON.stringify(cloudEvents)
      );
    });

    it('should handle empty cloud storage', async () => {
      vi.mocked(eventsCloudStorage.getAll).mockResolvedValue([]);

      const result = await syncCloudToLocal();

      expect(result.success).toBe(true);
      expect(result.eventsDownloaded).toBe(0);
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('fullSync', () => {
    it('should perform bidirectional sync', async () => {
      const localEvents: Event[] = [
        {
          id: 'event1',
          name: 'Local Event',
          eventType: 'flexible',
          month: 12,
          year: 2025,
          participants: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const cloudEvents: Event[] = [
        {
          id: 'event2',
          name: 'Cloud Event',
          eventType: 'flexible',
          month: 12,
          year: 2025,
          participants: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      vi.mocked(AsyncStorage.getItem).mockImplementation(async (key) => {
        if (key === '@gathersync_events') {
          return JSON.stringify(localEvents);
        }
        return null;
      });

      vi.mocked(eventsCloudStorage.getAll).mockResolvedValue(cloudEvents);

      const result = await fullSync();

      expect(result.success).toBe(true);
      expect(result.uploaded).toBeGreaterThan(0);
      expect(result.downloaded).toBeGreaterThan(0);
    });
  });
});
