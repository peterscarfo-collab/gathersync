import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Event, EventSnapshot, GroupTemplate } from '@/types/models';

const STORAGE_KEYS = {
  EVENTS: '@gathersync:events',
  SNAPSHOTS: '@gathersync:snapshots',
  TEMPLATES: '@gathersync:templates',
};

/**
 * Events storage
 */
export const eventsStorage = {
  async getAll(): Promise<Event[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.EVENTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to load events:', error);
      return [];
    }
  },

  async save(events: Event[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
    } catch (error) {
      console.error('Failed to save events:', error);
      throw error;
    }
  },

  async add(event: Event): Promise<void> {
    const events = await this.getAll();
    events.push(event);
    await this.save(events);
  },

  async update(eventId: string, updatedEvent: Event): Promise<void> {
    const events = await this.getAll();
    const index = events.findIndex(e => e.id === eventId);
    if (index !== -1) {
      events[index] = updatedEvent;
      await this.save(events);
    }
  },

  async delete(eventId: string): Promise<void> {
    const events = await this.getAll();
    const filtered = events.filter(e => e.id !== eventId);
    await this.save(filtered);
  },

  async getById(eventId: string): Promise<Event | null> {
    const events = await this.getAll();
    return events.find(e => e.id === eventId) || null;
  },
};

/**
 * Event snapshots storage
 */
export const snapshotsStorage = {
  async getAll(): Promise<EventSnapshot[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SNAPSHOTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to load snapshots:', error);
      return [];
    }
  },

  async save(snapshots: EventSnapshot[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(snapshots));
    } catch (error) {
      console.error('Failed to save snapshots:', error);
      throw error;
    }
  },

  async add(snapshot: EventSnapshot): Promise<void> {
    const snapshots = await this.getAll();
    snapshots.push(snapshot);
    await this.save(snapshots);
  },

  async delete(snapshotId: string): Promise<void> {
    const snapshots = await this.getAll();
    const filtered = snapshots.filter(s => s.id !== snapshotId);
    await this.save(filtered);
  },
};

/**
 * Group templates storage
 */
export const templatesStorage = {
  async getAll(): Promise<GroupTemplate[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.TEMPLATES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to load templates:', error);
      return [];
    }
  },

  async save(templates: GroupTemplate[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
    } catch (error) {
      console.error('Failed to save templates:', error);
      throw error;
    }
  },

  async add(template: GroupTemplate): Promise<void> {
    const templates = await this.getAll();
    templates.push(template);
    await this.save(templates);
  },

  async delete(templateId: string): Promise<void> {
    const templates = await this.getAll();
    const filtered = templates.filter(t => t.id !== templateId);
    await this.save(filtered);
  },
};
