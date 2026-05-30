import type { Participant } from '@/types/models';
import { eventsLocalStorage } from './local-storage';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function getOrCreateProspectsDirectoryEvent() {
  const allEvents = await eventsLocalStorage.getAll();
  let prospectsEvent = allEvents.find(e => e.name === 'Prospects Directory' && e.archived);

  if (!prospectsEvent) {
    prospectsEvent = await eventsLocalStorage.add({
      name: 'Prospects Directory',
      eventType: 'flexible',
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      participants: [],
      archived: true,
    });
  }

  return prospectsEvent;
}

export async function addContactToProspectsDirectory(
  input: {
    name: string;
    email?: string;
    phone?: string;
    organization?: string;
    leadSource?: string;
    notes?: string;
    designation?: string;
  },
  options?: { syncToCloud?: boolean }
): Promise<{ participant: Participant; eventId: string; created: boolean }> {
  const prospectsEvent = await getOrCreateProspectsDirectoryEvent();
  const eventToUpdate = await eventsLocalStorage.getById(prospectsEvent.id);
  if (!eventToUpdate) throw new Error('Prospects Directory not found');

  const trimmedName = input.name.trim();
  const existingIndex = eventToUpdate.participants.findIndex(
    p => p.name.toLowerCase() === trimmedName.toLowerCase() && !p.deletedAt
  );

  if (existingIndex !== -1) {
    const existing = eventToUpdate.participants[existingIndex];
    eventToUpdate.participants[existingIndex] = {
      ...existing,
      email: input.email?.trim() || existing.email,
      phone: input.phone?.trim() || existing.phone,
      organization: input.organization?.trim() || existing.organization,
      leadSource: input.leadSource?.trim() || existing.leadSource,
      designation: input.designation?.trim() || existing.designation,
      notes: input.notes?.trim() || existing.notes,
    };
    await eventsLocalStorage.update(eventToUpdate.id, eventToUpdate);

    if (options?.syncToCloud) {
      try {
        const { eventsCloudStorage } = await import('./cloud-storage');
        await eventsCloudStorage.update(eventToUpdate.id, eventToUpdate);
      } catch (error) {
        console.error('[ProspectsDirectory] Cloud sync failed:', error);
      }
    }

    return {
      participant: eventToUpdate.participants[existingIndex],
      eventId: eventToUpdate.id,
      created: false,
    };
  }

  const newParticipant: Participant = {
    id: generateId(),
    name: trimmedName,
    email: input.email?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    organization: input.organization?.trim() || undefined,
    leadSource: input.leadSource?.trim() || undefined,
    designation: input.designation?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    availability: {},
    unavailableAllMonth: false,
    source: 'manual',
    rsvpStatus: 'no-response',
  };

  eventToUpdate.participants.push(newParticipant);
  await eventsLocalStorage.update(eventToUpdate.id, eventToUpdate);

  if (options?.syncToCloud) {
    try {
      const { eventsCloudStorage } = await import('./cloud-storage');
      const cloudEvent = await eventsCloudStorage.getById(eventToUpdate.id);
      if (cloudEvent) {
        await eventsCloudStorage.update(eventToUpdate.id, eventToUpdate);
      } else {
        await eventsCloudStorage.add(eventToUpdate);
      }
    } catch (error) {
      console.error('[ProspectsDirectory] Cloud sync failed:', error);
    }
  }

  return { participant: newParticipant, eventId: eventToUpdate.id, created: true };
}
