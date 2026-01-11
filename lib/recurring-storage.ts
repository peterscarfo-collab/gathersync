/**
 * Storage utilities for recurring event templates
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RecurringEventTemplate } from '@/types/models';

const STORAGE_KEY = 'gathersync_recurring_templates';

export const recurringTemplatesStorage = {
  async getAll(): Promise<RecurringEventTemplate[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading recurring templates:', error);
      return [];
    }
  },

  async getById(id: string): Promise<RecurringEventTemplate | null> {
    const templates = await this.getAll();
    return templates.find(t => t.id === id) || null;
  },

  async save(template: RecurringEventTemplate): Promise<void> {
    const templates = await this.getAll();
    const existingIndex = templates.findIndex(t => t.id === template.id);
    
    if (existingIndex >= 0) {
      templates[existingIndex] = template;
    } else {
      templates.push(template);
    }
    
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  },

  async update(id: string, updates: Partial<RecurringEventTemplate>): Promise<void> {
    const template = await this.getById(id);
    if (!template) throw new Error('Template not found');
    
    const updated = { ...template, ...updates };
    await this.save(updated);
  },

  async delete(id: string): Promise<void> {
    const templates = await this.getAll();
    const filtered = templates.filter(t => t.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  },

  async getActive(): Promise<RecurringEventTemplate[]> {
    const templates = await this.getAll();
    return templates.filter(t => t.active);
  },
};
