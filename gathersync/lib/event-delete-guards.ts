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
