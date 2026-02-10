/**
 * Generate a UUID v4 compatible ID for InstantDB
 * InstantDB requires UUIDs for all entity IDs
 */
export function generateId(): string {
  // Generate a UUIDv4-like string
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
