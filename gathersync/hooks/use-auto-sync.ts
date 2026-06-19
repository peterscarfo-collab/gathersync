import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { eventsLocalStorage } from '@/lib/local-storage';
import { eventsCloudStorage } from '@/lib/cloud-storage';
import { useAuth } from './use-auth';
import type { Event } from '@/types/models';

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

interface SyncQueue {
  operation: 'create' | 'update' | 'delete';
  eventId: string;
  data?: Event;
  timestamp: number;
  retries: number;
}

function normalizeEventId(eventId: unknown): string {
  if (typeof eventId !== 'string') {
    throw new Error(`Expected eventId to be a string, received ${typeof eventId}`);
  }

  const trimmed = eventId.trim();
  if (!trimmed) {
    throw new Error('Expected eventId to be a non-empty string');
  }

  return trimmed;
}

/**
 * Automatic background sync hook
 * Syncs data changes immediately to cloud without user intervention
 */
export function useAutoSync() {
  const { isAuthenticated } = useAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [isOnline, setIsOnline] = useState(true);
  const syncQueueRef = useRef<SyncQueue[]>([]);
  const isSyncingRef = useRef(false);
  const lastSyncRef = useRef<number>(0);
  const pendingDeleteIdsRef = useRef<Set<string>>(new Set());

  // Monitor network status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: any) => {
      const online = state.isConnected && state.isInternetReachable !== false;
      setIsOnline(online);
      
      if (online && syncQueueRef.current.length > 0) {
        // Network reconnected, process queue
        console.log('[AutoSync] Network reconnected, processing queue...');
        processQueue();
      }
    });

    return () => unsubscribe();
  }, []);

  // Monitor app state (foreground/background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App came to foreground, pull latest from cloud
        console.log('[AutoSync] App resumed, pulling latest...');
        pullFromCloud();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated]);

  // Periodic sync every 30 seconds
  useEffect(() => {
    if (!isAuthenticated || !isOnline) return;

    const interval = setInterval(() => {
      pullFromCloud();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated, isOnline]);

  // Pull latest data from cloud
  const pullFromCloud = useCallback(async () => {
    if (!isAuthenticated || !isOnline || isSyncingRef.current) return;

    try {
      isSyncingRef.current = true;
      setSyncStatus('syncing');

      const cloudEvents = await eventsCloudStorage.getAll();
      const localEventsRaw = await eventsLocalStorage.getAllRaw(); // Get ALL events including deleted

      // Build maps for efficient lookup
      const cloudMap = new Map(cloudEvents.map(e => [e.id, e]));
      const localMap = new Map(localEventsRaw.map(e => [e.id, e]));

      // Keep pending delete protection until a pull confirms the cloud row is gone.
      for (const pendingDeleteId of Array.from(pendingDeleteIdsRef.current)) {
        if (!cloudMap.has(pendingDeleteId)) {
          pendingDeleteIdsRef.current.delete(pendingDeleteId);
        }
      }
      
      // Merge events using last-write-wins based on updatedAt timestamp
      for (const cloudEvent of cloudEvents) {
        if (pendingDeleteIdsRef.current.has(cloudEvent.id)) {
          console.log('[AutoSync] Skipping cloud event with pending delete:', cloudEvent.id, cloudEvent.name);
          continue;
        }

        const localEvent = localMap.get(cloudEvent.id);
        
        if (!localEvent) {
          // New event from cloud, add it
          console.log('[AutoSync] Adding new event from cloud:', cloudEvent.id, cloudEvent.name);
          await eventsLocalStorage.addWithId(cloudEvent);
        } else {
          // Event exists locally, compare timestamps
          const cloudTime = new Date(cloudEvent.updatedAt).getTime();
          const localTime = new Date(localEvent.updatedAt).getTime();
          
          if (cloudTime > localTime) {
            // Cloud version is newer, update local
            console.log('[AutoSync] Updating from cloud (cloud newer):', cloudEvent.id, cloudEvent.name);
            await eventsLocalStorage.update(cloudEvent.id, cloudEvent);
          } else {
            // Local version is newer or same, keep local (including deletions)
            console.log('[AutoSync] Keeping local version (local newer or same):', localEvent.id, localEvent.name);
          }
        }
      }
      
      // Check for local events not in cloud - these might be new local events or need to be pushed
      for (const localEvent of localEventsRaw) {
        if (!cloudMap.has(localEvent.id)) {
          console.log('[AutoSync] Local event not in cloud:', localEvent.id, localEvent.name, 'deletedAt:', localEvent.deletedAt);
          // Don't delete - it might be a new local event that needs to be pushed
          // The push operation will handle this
        }
      }

      lastSyncRef.current = Date.now();
      setSyncStatus('synced');
      console.log('[AutoSync] Pull completed:', cloudEvents.length, 'events');
    } catch (error) {
      console.error('[AutoSync] Pull failed:', error);
      setSyncStatus('error');
    } finally {
      isSyncingRef.current = false;
    }
  }, [isAuthenticated, isOnline]);

  // Push single change to cloud
  const pushToCloud = useCallback(async (operation: 'create' | 'update' | 'delete', eventId: string, data?: Event): Promise<boolean> => {
    if (!isAuthenticated) {
      console.log('[AutoSync] Not authenticated, skipping push');
      setSyncStatus('error');
      return false;
    }

    if (!isOnline) {
      // Queue for later
      console.log('[AutoSync] Offline, queuing operation:', operation, eventId);
      syncQueueRef.current.push({
        operation,
        eventId,
        data,
        timestamp: Date.now(),
        retries: 0,
      });
      setSyncStatus('offline');
      return true;
    }

    try {
      setSyncStatus('syncing');

      switch (operation) {
        case 'create':
        case 'update':
          if (data) {
            const cloudEvents = await eventsCloudStorage.getAll();
            const exists = cloudEvents.some(e => e.id === eventId);
            
            if (exists) {
              await eventsCloudStorage.update(eventId, data);
              console.log('[AutoSync] Updated event in cloud:', eventId);
            } else {
              await eventsCloudStorage.add(data);
              console.log('[AutoSync] Created event in cloud:', eventId);
            }
          }
          break;

        case 'delete':
          await eventsCloudStorage.delete(eventId);
          console.log('[AutoSync] Deleted event from cloud:', eventId);
          break;
      }

      setSyncStatus('synced');
      return true;
    } catch (error) {
      console.error('[AutoSync] Push failed:', error);
      
      // Queue for retry
      syncQueueRef.current.push({
        operation,
        eventId,
        data,
        timestamp: Date.now(),
        retries: 0,
      });
      
      setSyncStatus('error');
      return false;
    }
  }, [isAuthenticated, isOnline]);

  // Process queued operations
  const processQueue = useCallback(async () => {
    if (!isAuthenticated || !isOnline || syncQueueRef.current.length === 0) return;

    console.log('[AutoSync] Processing queue:', syncQueueRef.current.length, 'items');
    
    const queue = [...syncQueueRef.current];
    syncQueueRef.current = [];

    for (const item of queue) {
      try {
        await pushToCloud(item.operation, item.eventId, item.data);
      } catch (error) {
        console.error('[AutoSync] Queue item failed:', error);
        
        // Retry with exponential backoff
        if (item.retries < 3) {
          item.retries++;
          syncQueueRef.current.push(item);
        } else {
          console.error('[AutoSync] Max retries reached, dropping item:', item);
        }
      }
    }
  }, [isAuthenticated, isOnline, pushToCloud]);

  // Auto-syncing CRUD operations
  const createEvent = useCallback(async (event: Event) => {
    // Optimistic update: save locally first
    await eventsLocalStorage.add(event);
    
    // Then sync to cloud in background
    pushToCloud('create', event.id, event);
    
    return event;
  }, [pushToCloud]);

  const updateEvent = useCallback(async (eventId: string, updates: Partial<Event>) => {
    // Get current event
    const events = await eventsLocalStorage.getAll();
    const event = events.find(e => e.id === eventId);
    
    if (!event) {
      throw new Error(`Event ${eventId} not found`);
    }

    // Merge updates
    const updatedEvent = { ...event, ...updates };
    
    // Optimistic update: save locally first
    await eventsLocalStorage.update(eventId, updatedEvent);
    
    // Then sync to cloud in background
    pushToCloud('update', eventId, updatedEvent);
    
    return updatedEvent;
  }, [pushToCloud]);

  const deleteEvent = useCallback(async (eventId: string) => {
    const normalizedEventId = normalizeEventId(eventId);
    pendingDeleteIdsRef.current.add(normalizedEventId);

    try {
      // Optimistic update: delete locally first
      await eventsLocalStorage.delete(normalizedEventId);
    } catch (error) {
      pendingDeleteIdsRef.current.delete(normalizedEventId);
      throw error;
    }
    
    // Deletes must await cloud sync so permission/API failures are visible to callers.
    const syncedOrQueued = await pushToCloud('delete', normalizedEventId);
    if (!syncedOrQueued) {
      throw new Error(`Event ${normalizedEventId} was deleted locally but could not be deleted from cloud`);
    }
  }, [pushToCloud]);

  // Push all local events to cloud (full sync)
  const pushAllToCloud = useCallback(async () => {
    if (!isAuthenticated || !isOnline) return;

    try {
      console.log('[AutoSync] Starting full push to cloud...');
      setSyncStatus('syncing');

      const localEventsRaw = await eventsLocalStorage.getAllRaw();
      const localEvents = localEventsRaw.filter((event) => !event.deletedAt);
      const locallyDeletedEvents = localEventsRaw.filter((event) => event.deletedAt);
      const cloudEvents = await eventsCloudStorage.getAll();
      
      // Create a map of cloud events by ID
      const cloudEventMap = new Map(cloudEvents.map(e => [e.id, e]));

      let successCount = 0;
      let errorCount = 0;

      // Push local deletion tombstones first so cloud data cannot resurrect deleted events.
      for (const deletedEvent of locallyDeletedEvents) {
        const cloudEvent = cloudEventMap.get(deletedEvent.id);
        if (!cloudEvent) {
          continue;
        }

        try {
          const localDeletedAt = new Date(deletedEvent.deletedAt!).getTime();
          const localUpdatedAt = new Date(deletedEvent.updatedAt).getTime();
          const cloudUpdatedAt = new Date(cloudEvent.updatedAt).getTime();
          const deletionTime = Math.max(localDeletedAt, localUpdatedAt);

          if (deletionTime >= cloudUpdatedAt) {
            console.log('[AutoSync] Deleting tombstoned event from cloud:', deletedEvent.id, deletedEvent.name);
            await eventsCloudStorage.delete(deletedEvent.id);
            cloudEventMap.delete(deletedEvent.id);
            successCount++;
          }
        } catch (eventError) {
          console.error('[AutoSync] Failed to sync event deletion:', deletedEvent.id, deletedEvent.name, eventError);
          errorCount++;
        }
      }

      // Push each local event to cloud (with individual error handling)
      for (const localEvent of localEvents) {
        try {
          const cloudEvent = cloudEventMap.get(localEvent.id);
          
          if (!cloudEvent) {
            // Event doesn't exist in cloud, create it
            console.log('[AutoSync] Creating event in cloud:', localEvent.id, localEvent.name);
            await eventsCloudStorage.add(localEvent);
            successCount++;
          } else {
            // Event exists, check if local is newer
            const localUpdated = new Date(localEvent.updatedAt).getTime();
            const cloudUpdated = new Date(cloudEvent.updatedAt).getTime();
            
            if (localUpdated > cloudUpdated) {
              // Only push to cloud if we own the event
              if (localEvent.isInvited) {
                console.log('[AutoSync] Skipping push for invited event:', localEvent.id, localEvent.name);
                successCount++;
              } else {
                console.log('[AutoSync] Updating event in cloud:', localEvent.id, localEvent.name);
                await eventsCloudStorage.update(localEvent.id, localEvent);
                successCount++;
              }
            } else {
              console.log('[AutoSync] Skipping event (cloud is newer):', localEvent.id, localEvent.name);
              successCount++;
            }
          }
        } catch (eventError) {
          console.error('[AutoSync] Failed to sync event:', localEvent.id, localEvent.name, eventError);
          errorCount++;
          // Continue with next event instead of failing entire sync
        }
      }

      console.log(`[AutoSync] Full push completed: ${successCount} success, ${errorCount} errors`);
      setSyncStatus(errorCount > 0 ? 'error' : 'synced');
    } catch (error) {
      console.error('[AutoSync] Full push failed:', error);
      setSyncStatus('error');
    }
  }, [isAuthenticated, isOnline]);

  // Bidirectional sync: pull from cloud, then push local changes
  const bidirectionalSync = useCallback(async () => {
    if (!isAuthenticated || !isOnline) return;
    
    console.log('[AutoSync] Starting bidirectional sync...');
    await pullFromCloud();
    await pushAllToCloud();
    console.log('[AutoSync] Bidirectional sync complete');
  }, [isAuthenticated, isOnline, pullFromCloud, pushAllToCloud]);

  // Initial sync on mount
  useEffect(() => {
    if (isAuthenticated && isOnline) {
      bidirectionalSync();
    }
  }, [isAuthenticated, isOnline, bidirectionalSync]);

  // Periodic background sync DISABLED - was causing data loss
  // TODO: Re-enable after implementing proper conflict resolution
  // useEffect(() => {
  //   if (!isAuthenticated || !isOnline) return;
  //
  //   const interval = setInterval(() => {
  //     console.log('[AutoSync] Running periodic sync...');
  //     bidirectionalSync();
  //   }, 30000); // 30 seconds
  //
  //   return () => clearInterval(interval);
  // }, [isAuthenticated, isOnline, bidirectionalSync]);

  return {
    syncStatus,
    isOnline,
    createEvent,
    updateEvent,
    deleteEvent,
    pullFromCloud,
    pushToCloud,
    pushAllToCloud,
    bidirectionalSync,
    queueSize: syncQueueRef.current.length,
  };
}
