import { init, tx, id } from '@instantdb/admin';
import schema from '../instant.schema';

// Server-side InstantDB admin instance
export const adminDb = init({
  appId: process.env.INSTANT_APP_ID!,
  adminToken: process.env.INSTANT_APP_ADMIN_TOKEN!,
  schema,
});

export { tx, id };

export type AdminDB = typeof adminDb;
