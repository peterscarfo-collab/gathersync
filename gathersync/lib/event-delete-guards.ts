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

export function hasDeletionTombstone(event: Pick<Event, 'deletedAt'> | null | undefined): boolean {
  if (!event?.deletedAt) {
    return false;
  }

  const deletedAt = String(event.deletedAt).trim();
  if (!deletedAt || deletedAt === 'null' || deletedAt === 'undefined') {
    return false;
  }

  return !Number.isNaN(Date.parse(deletedAt));
}

export function shouldSkipCloudEventForDeleteGuard({
  eventId,
  localEvent,
  pendingDeleteIds,
}: {
  eventId: string;
  localEvent?: Event;
  pendingDeleteIds?: ReadonlySet<string>;
}): boolean {
  return Boolean(pendingDeleteIds?.has(eventId) || hasDeletionTombstone(localEvent));
}
