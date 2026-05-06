import fs from 'fs';
import path from 'path';

// Mock AsyncStorage
const storage = new Map();
const AsyncStorage = {
  getItem: async (key: string) => storage.get(key) || null,
  setItem: async (key: string, value: string) => { storage.set(key, value); }
};

const STORAGE_KEYS = { EVENTS: '@gathersync_events' };

const eventsLocalStorage = {
  getAllRaw: async () => {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.EVENTS);
    if (!data) return [];
    return JSON.parse(data);
  },
  getAll: async () => {
    const all = await eventsLocalStorage.getAllRaw();
    return all.filter((e: any) => !e.deletedAt);
  },
  addWithId: async (event: any) => {
    const events = await eventsLocalStorage.getAllRaw();
    const existingIndex = events.findIndex((e: any) => e.id === event.id);
    if (existingIndex !== -1) return events[existingIndex];
    events.push(event);
    await AsyncStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
    return event;
  }
};

async function runTest() {
  // 1. Initial State: Event exists and is active
  const initialEvent = { id: '123', name: 'Sync Testing', archived: false };
  await AsyncStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify([initialEvent]));

  // 2. Export
  const eventsToExport = await eventsLocalStorage.getAllRaw();
  const eventToExport = eventsToExport.find((e: any) => e.id === '123');
  const backup = {
    type: 'single',
    events: [JSON.parse(JSON.stringify(eventToExport))],
    snapshots: [],
    templates: []
  };

  // 3. Delete locally (simulate eventsLocalStorage.delete)
  const currentEvents = await eventsLocalStorage.getAllRaw();
  currentEvents[0].deletedAt = new Date().toISOString();
  await AsyncStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(currentEvents));

  console.log("After delete, active events:", await eventsLocalStorage.getAll());

  // 4. Import Backup
  const importedEvent = backup.events[0];
  importedEvent.updatedAt = new Date().toISOString();
  importedEvent.deletedAt = null;
  importedEvent.archived = false;

  const currentEventsBeforeImport = await eventsLocalStorage.getAllRaw();
  const existingIndex = currentEventsBeforeImport.findIndex((e: any) => e.id === importedEvent.id);
  
  if (existingIndex !== -1) {
    currentEventsBeforeImport[existingIndex] = importedEvent;
    await AsyncStorage.setItem('@gathersync_events', JSON.stringify(currentEventsBeforeImport));
  } else {
    await eventsLocalStorage.addWithId(importedEvent);
  }

  console.log("After import, active events:", await eventsLocalStorage.getAll());
}

runTest().catch(console.error);
