import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eventsStorage } from '../lib/hybrid-storage';
import * as Auth from '../lib/auth';
import type { Event } from '../types/models';

// Mock Auth module
vi.mock('../lib/auth', () => ({
  getSessionToken: vi.fn(),
  getUserInfo: vi.fn(),
}));

// Mock cloud storage
vi.mock('../lib/cloud-storage', () => ({
  eventsCloudStorage: {
    getAll: vi.fn(),
    getById: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  snapshotsCloudStorage: {
    getAll: vi.fn(),
    add: vi.fn(),
    delete: vi.fn(),
  },
  templatesCloudStorage: {
    getAll: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe('Cloud Sync', () => {
  const mockEvent: Event = {
    id: 'test-event-1',
    name: 'Test Event',
    eventType: 'flexible',
    month: 1,
    year: 2026,
    participants: [],
    archived: false,
    finalized: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authenticated User', () => {
    beforeEach(() => {
      // Mock authenticated state
      vi.mocked(Auth.getSessionToken).mockResolvedValue('mock-token');
      vi.mocked(Auth.getUserInfo).mockResolvedValue({
        id: 1,
        openId: 'open-id-1',
        name: 'Test User',
        email: 'test@example.com',
        loginMethod: 'google',
        lastSignedIn: new Date(),
      });
    });

    it('should use cloud storage for authenticated users', async () => {
      const { eventsCloudStorage } = await import('../lib/cloud-storage');
      vi.mocked(eventsCloudStorage.getAll).mockResolvedValue([mockEvent]);

      const events = await eventsStorage.getAll();

      expect(Auth.getSessionToken).toHaveBeenCalled();
      expect(Auth.getUserInfo).toHaveBeenCalled();
      expect(eventsCloudStorage.getAll).toHaveBeenCalled();
      expect(events).toEqual([mockEvent]);
    });

    it('should create events in cloud storage', async () => {
      const { eventsCloudStorage } = await import('../lib/cloud-storage');
      vi.mocked(eventsCloudStorage.add).mockResolvedValue();

      await eventsStorage.add(mockEvent);

      expect(eventsCloudStorage.add).toHaveBeenCalledWith(mockEvent);
    });

    it('should update events in cloud storage', async () => {
      const { eventsCloudStorage } = await import('../lib/cloud-storage');
      vi.mocked(eventsCloudStorage.update).mockResolvedValue();

      const updates = { name: 'Updated Event' };
      await eventsStorage.update(mockEvent.id, updates);

      expect(eventsCloudStorage.update).toHaveBeenCalledWith(mockEvent.id, updates);
    });

    it('should delete events from cloud storage', async () => {
      const { eventsCloudStorage } = await import('../lib/cloud-storage');
      vi.mocked(eventsCloudStorage.delete).mockResolvedValue();

      await eventsStorage.delete(mockEvent.id);

      expect(eventsCloudStorage.delete).toHaveBeenCalledWith(mockEvent.id);
    });
  });

  describe('Guest User', () => {
    beforeEach(() => {
      // Mock unauthenticated state
      vi.mocked(Auth.getSessionToken).mockResolvedValue(null);
      vi.mocked(Auth.getUserInfo).mockResolvedValue(null);
    });

    it('should use local storage for guest users', async () => {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([mockEvent]));

      const events = await eventsStorage.getAll();

      expect(Auth.getSessionToken).toHaveBeenCalled();
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@gathersync_events');
      expect(events).toEqual([mockEvent]);
    });

    it('should create events in local storage', async () => {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([]));
      vi.mocked(AsyncStorage.setItem).mockResolvedValue();

      await eventsStorage.add(mockEvent);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@gathersync_events',
        JSON.stringify([mockEvent])
      );
    });
  });

  describe('Fallback Behavior', () => {
    beforeEach(() => {
      // Mock authenticated state
      vi.mocked(Auth.getSessionToken).mockResolvedValue('mock-token');
      vi.mocked(Auth.getUserInfo).mockResolvedValue({
        id: 1,
        openId: 'open-id-1',
        name: 'Test User',
        email: 'test@example.com',
        loginMethod: 'google',
        lastSignedIn: new Date(),
      });
    });

    it('should fall back to local storage if cloud storage fails', async () => {
      const { eventsCloudStorage } = await import('../lib/cloud-storage');
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      
      // Mock cloud storage failure
      vi.mocked(eventsCloudStorage.getAll).mockRejectedValue(new Error('Network error'));
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([mockEvent]));

      const events = await eventsStorage.getAll();

      expect(eventsCloudStorage.getAll).toHaveBeenCalled();
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@gathersync_events');
      expect(events).toEqual([mockEvent]);
    });
  });
});
