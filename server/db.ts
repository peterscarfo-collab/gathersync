import { adminDb, tx, id } from '../lib/admin-db';

/**
 * InstantDB-based database operations
 * Note: InstantDB uses optimistic updates and real-time sync
 * For server-side operations, we use the admin client
 */

// Helper to generate unique IDs
export const generateId = () => id();

/**
 * Users
 */
export async function upsertUser(user: {
  id: string;
  email?: string | null;
  name?: string | null;
  loginMethod?: string | null;
  role?: string | null;
  lastSignedIn?: Date;
}) {
  if (!user.id) {
    throw new Error("User id is required for upsert");
  }

  try {
    // Check if user exists
    const existingUsers = await adminDb.query({
      $users: {
        $: {
          where: {
            id: user.id,
          },
        },
      },
    });

    const userData: any = {
      email: user.email,
      name: user.name,
      loginMethod: user.loginMethod,
      role: user.role || 'user',
      lastSignedIn: user.lastSignedIn || new Date(),
    };

    if (existingUsers.$users && existingUsers.$users.length > 0) {
      // Update existing user
      await adminDb.transact([
        tx.$users[user.id].update(userData),
      ]);
    } else {
      // Create new user
      userData.createdAt = new Date();
      userData.subscriptionTier = 'free';
      userData.subscriptionStatus = 'active';
      userData.subscriptionSource = 'free';
      userData.eventsCreatedThisMonth = 0;
      userData.lastMonthReset = new Date();
      userData.trialUsed = false;
      userData.isLifetimePro = false;
      
      await adminDb.transact([
        tx.$users[user.id].update(userData),
      ]);
    }
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserById(userId: string) {
  try {
    const result = await adminDb.query({
      $users: {
        $: {
          where: {
            id: userId,
          },
        },
      },
    });

    // AdminDB returns data directly, not nested in .data
    if (!result || !result.$users || result.$users.length === 0) {
      return undefined;
    }

    return result.$users[0];
  } catch (error) {
    console.error("[Database] Failed to get user:", error);
    return undefined;
  }
}

export async function getUserByEmail(email: string) {
  try {
    const result = await adminDb.query({
      $users: {
        $: {
          where: {
            email,
          },
        },
      },
    });

    if (!result || !result.$users || result.$users.length === 0) {
      return undefined;
    }

    return result.$users[0];
  } catch (error) {
    console.error("[Database] Failed to get user by email:", error);
    return undefined;
  }
}

/**
 * Events
 */
export async function getUserEvents(userId: string) {
  try {
    // Query events WITHOUT participants
    const eventsResult = await adminDb.query({
      events: {
        $: {
          where: {
            'creator.id': userId,
          },
        },
      },
    });

    const events = eventsResult.events || [];
    if (events.length === 0) return [];

    // Query participants separately for all events
    const participantsResult = await adminDb.query({
      participants: {
        $: {
          where: {
            'event.id': {
              in: events.map((e: any) => e.id),
            },
          },
        },
      },
    });

    const participants = participantsResult.participants || [];

    // Manually attach participants to events (without circular refs)
    const eventsWithParticipants = events.map((event: any) => ({
      ...event,
      participants: participants
        .filter((p: any) => p.event?.id === event.id)
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          phone: p.phone,
          email: p.email,
          availability: p.availability,
          unavailableAllMonth: p.unavailableAllMonth,
          notes: p.notes,
          source: p.source,
          rsvpStatus: p.rsvpStatus,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          deletedAt: p.deletedAt,
        })),
    }));

    return eventsWithParticipants;
  } catch (error) {
    console.error("[Database] Failed to get user events:", error);
    return [];
  }
}

export async function getAllEvents() {
  try {
    const result = await adminDb.query({
      events: {},
    });

    return result.events || [];
  } catch (error) {
    console.error("[Database] Failed to get all events:", error);
    return [];
  }
}

export async function getEventById(eventId: string) {
  try {
    // Query event WITHOUT participants
    const eventsResult = await adminDb.query({
      events: {
        $: {
          where: {
            id: eventId,
          },
        },
      },
    });

    const event = eventsResult.events[0];
    if (!event) return null;

    // Query participants separately
    const participantsResult = await adminDb.query({
      participants: {
        $: {
          where: {
            'event.id': eventId,
          },
        },
      },
    });

    const participants = (participantsResult.participants || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      email: p.email,
      availability: p.availability,
      unavailableAllMonth: p.unavailableAllMonth,
      notes: p.notes,
      source: p.source,
      rsvpStatus: p.rsvpStatus,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      deletedAt: p.deletedAt,
    }));

    return {
      ...event,
      participants,
    };
  } catch (error) {
    console.error("[Database] Failed to get event:", error);
    return null;
  }
}

export async function createEvent(eventData: {
  id: string;
  userId: string;
  name: string;
  eventType: string;
  month: number;
  year: number;
  [key: string]: any;
}) {
  try {
    // Separate userId from event attributes
    const { userId, id, ...eventAttributes } = eventData;
    
    const event: any = {
      ...eventAttributes,
      createdAt: new Date(),
      updatedAt: new Date(),
      archived: false,
      finalized: false,
    };

    await adminDb.transact([
      tx.events[id].update(event).link({ creator: userId }),
    ]);

    return id;
  } catch (error) {
    console.error("[Database] Failed to create event:", error);
    throw error;
  }
}

export async function updateEvent(eventId: string, data: any) {
  try {
    data.updatedAt = new Date();
    
    await adminDb.transact([
      tx.events[eventId].update(data),
    ]);
  } catch (error) {
    console.error("[Database] Failed to update event:", error);
    throw error;
  }
}

export async function deleteEvent(eventId: string) {
  try {
    // Get participants to delete them
    const result = await adminDb.query({
      participants: {
        $: {
          where: {
            'event.id': eventId,
          },
        },
      },
    });

    const deleteTransactions = result.participants.map((p: any) => 
      tx.participants[p.id].delete()
    );

    // Delete participants and event
    await adminDb.transact([
      ...deleteTransactions,
      tx.events[eventId].delete(),
    ]);
  } catch (error) {
    console.error("[Database] Failed to delete event:", error);
    throw error;
  }
}

/**
 * Participants
 */
export async function getEventParticipants(eventId: string) {
  try {
    const result = await adminDb.query({
      participants: {
        $: {
          where: {
            'event.id': eventId,
          },
        },
      },
    });

    // Explicitly create new objects with only the fields we need
    const participants = (result.participants || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      email: p.email,
      availability: p.availability,
      unavailableAllMonth: p.unavailableAllMonth,
      notes: p.notes,
      source: p.source,
      rsvpStatus: p.rsvpStatus,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      deletedAt: p.deletedAt,
    }));

    return participants;
  } catch (error) {
    console.error("[Database] Failed to get participants:", error);
    return [];
  }
}

export async function createParticipant(participantData: {
  id: string;
  eventId: string;
  name: string;
  availability: any;
  [key: string]: any;
}) {
  try {
    const participant: any = {
      ...participantData,
      createdAt: new Date(),
      updatedAt: new Date(),
      unavailableAllMonth: participantData.unavailableAllMonth || false,
    };

    // Remove eventId from the data (it's used for linking)
    const { eventId, ...participantWithoutEventId } = participant;

    await adminDb.transact([
      tx.participants[participantData.id].update(participantWithoutEventId).link({ event: eventId }),
    ]);

    return participantData.id;
  } catch (error) {
    console.error("[Database] Failed to create participant:", error);
    throw error;
  }
}

export async function updateParticipant(participantId: string, data: any) {
  try {
    data.updatedAt = new Date();
    
    await adminDb.transact([
      tx.participants[participantId].update(data),
    ]);
  } catch (error) {
    console.error("[Database] Failed to update participant:", error);
    throw error;
  }
}

export async function deleteParticipant(participantId: string) {
  try {
    await adminDb.transact([
      tx.participants[participantId].delete(),
    ]);
  } catch (error) {
    console.error("[Database] Failed to delete participant:", error);
    throw error;
  }
}

/**
 * Event Snapshots
 */
export async function getUserSnapshots(userId: string) {
  try {
    const result = await adminDb.query({
      eventSnapshots: {
        $: {
          where: {
            'creator.id': userId,
          },
        },
      },
    });

    return result.eventSnapshots || [];
  } catch (error) {
    console.error("[Database] Failed to get snapshots:", error);
    return [];
  }
}

export async function createSnapshot(snapshotData: {
  id: string;
  userId: string;
  eventId: string;
  name: string;
  eventData: any;
}) {
  try {
    const snapshot: any = {
      name: snapshotData.name,
      eventData: snapshotData.eventData,
      savedAt: new Date(),
    };

    await adminDb.transact([
      tx.eventSnapshots[snapshotData.id].update(snapshot)
        .link({ creator: snapshotData.userId })
        .link({ event: snapshotData.eventId }),
    ]);

    return snapshotData.id;
  } catch (error) {
    console.error("[Database] Failed to create snapshot:", error);
    throw error;
  }
}

export async function deleteSnapshot(snapshotId: string) {
  try {
    await adminDb.transact([
      tx.eventSnapshots[snapshotId].delete(),
    ]);
  } catch (error) {
    console.error("[Database] Failed to delete snapshot:", error);
    throw error;
  }
}

/**
 * Group Templates
 */
export async function getUserTemplates(userId: string) {
  try {
    const result = await adminDb.query({
      groupTemplates: {
        $: {
          where: {
            'creator.id': userId,
          },
        },
      },
    });

    return result.groupTemplates || [];
  } catch (error) {
    console.error("[Database] Failed to get templates:", error);
    return [];
  }
}

export async function createTemplate(templateData: {
  id: string;
  userId: string;
  name: string;
  participantNames: any;
}) {
  try {
    const template: any = {
      name: templateData.name,
      participantNames: templateData.participantNames,
      createdAt: new Date(),
    };

    await adminDb.transact([
      tx.groupTemplates[templateData.id].update(template).link({ creator: templateData.userId }),
    ]);

    return templateData.id;
  } catch (error) {
    console.error("[Database] Failed to create template:", error);
    throw error;
  }
}

export async function deleteTemplate(templateId: string) {
  try {
    await adminDb.transact([
      tx.groupTemplates[templateId].delete(),
    ]);
  } catch (error) {
    console.error("[Database] Failed to delete template:", error);
    throw error;
  }
}

/**
 * Push Tokens
 */
export async function registerPushToken(tokenData: {
  id: string;
  userId: string;
  token: string;
  deviceId?: string;
}) {
  try {
    const pushToken: any = {
      token: tokenData.token,
      deviceId: tokenData.deviceId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await adminDb.transact([
      tx.pushTokens[tokenData.id].update(pushToken).link({ user: tokenData.userId }),
    ]);
  } catch (error) {
    console.error("[Database] Failed to register push token:", error);
    throw error;
  }
}

export async function unregisterPushToken(token: string) {
  try {
    // Find the token first
    const result = await adminDb.query({
      pushTokens: {
        $: {
          where: {
            token,
          },
        },
      },
    });

    if (result.pushTokens.length > 0) {
      await adminDb.transact([
        tx.pushTokens[result.pushTokens[0].id].delete(),
      ]);
    }
  } catch (error) {
    console.error("[Database] Failed to unregister push token:", error);
    throw error;
  }
}

export async function getUserPushTokens(userId: string) {
  try {
    const result = await adminDb.query({
      pushTokens: {
        $: {
          where: {
            'user.id': userId,
          },
        },
      },
    });

    return result.pushTokens || [];
  } catch (error) {
    console.error("[Database] Failed to get user push tokens:", error);
    return [];
  }
}

export async function getEventParticipantTokens(eventId: string, excludeUserId?: string) {
  try {
    // Get the event to find the owner
    const event = await getEventById(eventId);
    if (!event) return [];

    // Get push tokens for the event owner
    const tokens = await getUserPushTokens(event.creator.id);

    if (excludeUserId) {
      return tokens.filter((t: any) => t.user.id !== excludeUserId);
    }

    return tokens;
  } catch (error) {
    console.error("[Database] Failed to get event participant tokens:", error);
    return [];
  }
}
