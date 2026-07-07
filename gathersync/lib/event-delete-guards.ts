import type { Event } from '@/types/models';

export function normalizeEventId(eventId: unknown): string {
  if (typeof eventId !== 'string') {
    const received = Array.isArray(eventId) ? 'array' : typeof eventId;
    throw new Error(`Expected eventId to be a string, received ${received}`);
  }

  const trimmed = eventId.trim();
  if (!trimmed) {
    throw new Error('Expected eventId to be a non-empty string');
  }

  return trimmed;
}

export function shouldSkipCloudEventForPendingDelete(
  eventId: string,
  pendingDeleteIds: ReadonlySet<string>
): boolean {
  return pendingDeleteIds.has(eventId);
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
  return Boolean(
    shouldSkipCloudEventForPendingDelete(eventId, pendingDeleteIds ?? new Set()) ||
      hasDeletionTombstone(localEvent)
  );
}
