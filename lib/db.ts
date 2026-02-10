import { init } from '@instantdb/react';
import schema from '../instant.schema';

const appId =
  process.env.EXPO_PUBLIC_INSTANT_APP_ID ||
  process.env.INSTANT_APP_ID ||
  '';

if (!appId) {
  console.warn('[InstantDB] Missing App ID (EXPO_PUBLIC_INSTANT_APP_ID)');
}

console.log('[InstantDB BUILD_' + Date.now() + '] Initializing with App ID:', appId);

// Client-side InstantDB instance (for React components)
export const db = init({
  appId,
  schema,
});

console.log('[InstantDB] Client initialized');

// Make db instance available to tRPC client
if (typeof window !== 'undefined') {
  (window as any).__instantdb = db;
}

export type DB = typeof db;
