import AsyncStorage from '@react-native-async-storage/async-storage';
import type { InfluencerProspect } from '@/types/models';
import { influencersCloudStorage } from '@/lib/cloud-storage';
import * as Auth from '@/lib/auth';

const STORAGE_KEY = '@gathersync_influencers';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

async function isAuthenticated(): Promise<boolean> {
  const token = await Auth.getSessionToken();
  const user = await Auth.getUserInfo();
  return !!(token && user);
}

async function readLocal(): Promise<InfluencerProspect[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data) as InfluencerProspect[];
  } catch (error) {
    console.error('[InfluencerStorage] Error reading local:', error);
    return [];
  }
}

async function writeLocal(prospects: InfluencerProspect[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prospects));
}

function mergeProspects(local: InfluencerProspect[], cloud: InfluencerProspect[]): InfluencerProspect[] {
  const map = new Map<string, InfluencerProspect>();
  for (const p of local) map.set(p.id, p);
  for (const p of cloud) {
    const existing = map.get(p.id);
    if (!existing || new Date(p.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
      map.set(p.id, p);
    }
  }
  return Array.from(map.values());
}

export class InfluencersLocalStorage {
  /** Load from cloud + local cache. Cloud wins on conflict (newer updatedAt). */
  async getAll(): Promise<InfluencerProspect[]> {
    const local = await readLocal();

    if (!(await isAuthenticated())) {
      return local;
    }

    try {
      const cloud = await influencersCloudStorage.getAll();

      if (local.length > 0 && cloud.length === 0) {
        console.log('[InfluencerStorage] Pushing local prospects to cloud...');
        await influencersCloudStorage.syncAll(local);
        await writeLocal(local);
        return local;
      }

      const merged = mergeProspects(local, cloud);
      await writeLocal(merged);

      const cloudIds = new Set(cloud.map(p => p.id));
      const needsPush = merged.filter(p => !cloudIds.has(p.id));
      if (needsPush.length > 0) {
        console.log(`[InfluencerStorage] Uploading ${needsPush.length} local-only prospects to cloud`);
        for (const p of needsPush) {
          await influencersCloudStorage.upsert(p);
        }
      }

      return merged;
    } catch (error) {
      console.error('[InfluencerStorage] Cloud sync failed, using local cache:', error);
      return local;
    }
  }

  async saveAll(prospects: InfluencerProspect[]): Promise<void> {
    await writeLocal(prospects);
    if (await isAuthenticated()) {
      try {
        await influencersCloudStorage.syncAll(prospects);
      } catch (error) {
        console.error('[InfluencerStorage] Cloud saveAll failed:', error);
        throw error;
      }
    }
  }

  async add(input: Omit<InfluencerProspect, 'id' | 'createdAt' | 'updatedAt'>): Promise<InfluencerProspect> {
    const prospect: InfluencerProspect = {
      ...input,
      id: generateId(),
      createdAt: now(),
      updatedAt: now(),
    };
    const all = await readLocal();
    all.push(prospect);
    await writeLocal(all);

    if (await isAuthenticated()) {
      try {
        await influencersCloudStorage.upsert(prospect);
      } catch (error) {
        console.error('[InfluencerStorage] Cloud add failed (saved locally):', error);
      }
    }

    return prospect;
  }

  async update(id: string, updates: Partial<InfluencerProspect>): Promise<InfluencerProspect | null> {
    const all = await readLocal();
    const index = all.findIndex(p => p.id === id);
    if (index === -1) return null;
    all[index] = { ...all[index], ...updates, updatedAt: now() };
    await writeLocal(all);

    if (await isAuthenticated()) {
      try {
        await influencersCloudStorage.upsert(all[index]);
      } catch (error) {
        console.error('[InfluencerStorage] Cloud update failed (saved locally):', error);
      }
    }

    return all[index];
  }

  async delete(id: string): Promise<boolean> {
    const all = await readLocal();
    const filtered = all.filter(p => p.id !== id);
    if (filtered.length === all.length) return false;
    await writeLocal(filtered);

    if (await isAuthenticated()) {
      try {
        await influencersCloudStorage.delete(id);
      } catch (error) {
        console.error('[InfluencerStorage] Cloud delete failed (removed locally):', error);
      }
    }

    return true;
  }

  /** Force pull from cloud (e.g. after login on new device) */
  async syncFromCloud(): Promise<InfluencerProspect[]> {
    if (!(await isAuthenticated())) {
      return readLocal();
    }
    const local = await readLocal();
    const cloud = await influencersCloudStorage.getAll();
    if (local.length > 0 && cloud.length === 0) {
      await influencersCloudStorage.syncAll(local);
      return local;
    }
    const merged = mergeProspects(local, cloud);
    await writeLocal(merged);
    return merged;
  }
}

export const influencersLocalStorage = new InfluencersLocalStorage();
