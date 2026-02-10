#!/usr/bin/env tsx
import 'dotenv/config';
import { adminDb, tx } from '../lib/admin-db.js';

async function fixEventCreators() {
  try {
    console.log('Fetching all events and users...');
    
    // Get all events and users
    const result = await adminDb.query({
      events: {},
      $users: {},
    });
    
    console.log('Found', result.events?.length || 0, 'events');
    console.log('Found', result.$users?.length || 0, 'users');
    
    if (!result.$users || result.$users.length === 0) {
      console.log('No users found! Please log in first to create a user.');
      return;
    }
    
    const user = result.$users[0]; // Use the first user (you)
    console.log('Using user:', user.email, 'ID:', user.id);
    
    if (!result.events || result.events.length === 0) {
      console.log('No events to fix!');
      return;
    }
    
    // Link all events to this user
    const updates = result.events.map((event: any) => 
      tx.events[event.id].link({ creator: user.id })
    );
    
    console.log('Linking', updates.length, 'events to user', user.email);
    await adminDb.transact(updates);
    
    console.log('✅ All events now linked to creator!');
    
    // Verify
    const verification = await adminDb.query({
      events: {
        creator: {},
      },
    });
    
    console.log('Verification:', verification.events?.map((e: any) => ({
      name: e.name,
      creator: e.creator?.email,
    })));
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixEventCreators();
