import type { Event } from '@/types/models';

export function normalizeEventId(eventId: unknown): string {
  if (typeof eventId !== 'string') {
    throw new Error(`Expected eventId to be a string, received ${typeof eventId}`);
  }

  const trimmed = eventId.trim();
  if (!trimmed) {
    throw new Error('Expected eventId to be a non-empty string');
  }

  return trimmed;
}

function timestamp(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export function deletionTimestamp(event: Event): number | null {
  if (!event.deletedAt) return null;

  const deletedAt = timestamp(event.deletedAt);
  const updatedAt = timestamp(event.updatedAt);

  if (deletedAt === null) {
    return updatedAt;
  }

  if (updatedAt === null) {
    return deletedAt;
  }

  return Math.max(deletedAt, updatedAt);
}

export function shouldPreserveLocalDeletion(
  localEvent: Event | undefined,
  cloudEvent: Event,
  hasPendingDelete = false
): boolean {
  if (!localEvent?.deletedAt || cloudEvent.deletedAt) {
    return false;
  }

  if (hasPendingDelete) {
    return true;
  }

  return deletionTimestamp(localEvent) !== null;
}
