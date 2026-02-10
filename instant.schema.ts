import { i } from '@instantdb/react';

const _schema = i.schema({
  entities: {
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
      name: i.string().optional(),
      loginMethod: i.string().optional(),
      role: i.string().optional(), // 'user' or 'admin'
      
      // Subscription fields
      subscriptionTier: i.string().optional(), // 'free', 'lite', 'pro', 'enterprise'
      subscriptionStatus: i.string().optional(), // 'active', 'cancelled', 'expired', 'trialing'
      stripeCustomerId: i.string().optional(),
      stripeSubscriptionId: i.string().optional(),
      subscriptionStartDate: i.date().optional(),
      subscriptionEndDate: i.date().optional(),
      
      // Usage tracking
      eventsCreatedThisMonth: i.number().optional(),
      lastMonthReset: i.date().optional(),
      
      // Trial fields
      trialStartDate: i.date().optional(),
      trialEndDate: i.date().optional(),
      trialUsed: i.boolean().optional(),
      
      // Promo/Grant fields
      appliedPromoCode: i.string().optional(),
      promoExpiry: i.date().optional(),
      isLifetimePro: i.boolean().optional(),
      grantedBy: i.string().optional(),
      grantedAt: i.date().optional(),
      subscriptionSource: i.string().optional(), // 'trial', 'promo', 'stripe', 'admin', 'free'
      
      // Timestamps
      createdAt: i.date().optional(),
      lastSignedIn: i.date().optional(),
    }),
    
    events: i.entity({
      name: i.string(),
      eventType: i.string(), // 'flexible' or 'fixed'
      month: i.number(),
      year: i.number(),
      fixedDate: i.string().optional(),
      fixedTime: i.string().optional(),
      
      // Reminder fields
      reminderDaysBefore: i.number().optional(),
      reminderScheduled: i.boolean().optional(),
      
      // Status fields
      archived: i.boolean().optional(),
      finalized: i.boolean().optional(),
      finalizedDate: i.string().optional(),
      
      // Team leader fields
      teamLeader: i.string().optional(),
      teamLeaderPhone: i.string().optional(),
      
      // Meeting details
      meetingType: i.string().optional(), // 'in-person' or 'virtual'
      venueName: i.string().optional(),
      venueAddress: i.string().optional(),
      venueContact: i.string().optional(),
      venuePhone: i.string().optional(),
      meetingLink: i.string().optional(),
      rsvpDeadline: i.string().optional(),
      meetingNotes: i.string().optional(),
      
      // Timestamps
      deletedAt: i.date().optional(),
      createdAt: i.date(),
      updatedAt: i.date(),
    }),
    
    participants: i.entity({
      name: i.string(),
      availability: i.json(), // JSON object with date availability
      unavailableAllMonth: i.boolean().optional(),
      notes: i.string().optional(),
      
      // Contact info
      source: i.string().optional(), // 'manual', 'contacts', or 'ai'
      phone: i.string().optional(),
      email: i.string().optional(),
      
      // RSVP
      rsvpStatus: i.string().optional(), // 'attending', 'not-attending', 'no-response'
      
      // Timestamps
      deletedAt: i.date().optional(),
      createdAt: i.date(),
      updatedAt: i.date(),
    }),
    
    eventSnapshots: i.entity({
      name: i.string(),
      eventData: i.json(), // Snapshot of event data
      savedAt: i.date(),
    }),
    
    groupTemplates: i.entity({
      name: i.string(),
      participantNames: i.json(), // Array of participant names
      createdAt: i.date(),
    }),
    
    pushTokens: i.entity({
      token: i.string().unique().indexed(),
      deviceId: i.string().optional(),
      createdAt: i.date(),
      updatedAt: i.date(),
    }),
  },
  
  links: {
    // User -> Events (one user has many events)
    userEvents: {
      forward: {
        on: 'events',
        has: 'one',
        label: 'creator',
      },
      reverse: {
        on: '$users',
        has: 'many',
        label: 'events',
      },
    },
    
    // Event -> Participants (one event has many participants)
    eventParticipants: {
      forward: {
        on: 'participants',
        has: 'one',
        label: 'event',
      },
      reverse: {
        on: 'events',
        has: 'many',
        label: 'participants',
      },
    },
    
    // User -> Event Snapshots (one user has many snapshots)
    userSnapshots: {
      forward: {
        on: 'eventSnapshots',
        has: 'one',
        label: 'creator',
      },
      reverse: {
        on: '$users',
        has: 'many',
        label: 'snapshots',
      },
    },
    
    // Event -> Event Snapshots (one event has many snapshots)
    eventSnapshots: {
      forward: {
        on: 'eventSnapshots',
        has: 'one',
        label: 'event',
      },
      reverse: {
        on: 'events',
        has: 'many',
        label: 'snapshots',
      },
    },
    
    // User -> Group Templates (one user has many templates)
    userTemplates: {
      forward: {
        on: 'groupTemplates',
        has: 'one',
        label: 'creator',
      },
      reverse: {
        on: '$users',
        has: 'many',
        label: 'templates',
      },
    },
    
    // User -> Push Tokens (one user has many push tokens)
    userPushTokens: {
      forward: {
        on: 'pushTokens',
        has: 'one',
        label: 'user',
      },
      reverse: {
        on: '$users',
        has: 'many',
        label: 'pushTokens',
      },
    },
  },
  
  rooms: {},
});

export default _schema;
