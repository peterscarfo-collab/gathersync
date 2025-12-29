import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import * as db from './db';

const expo = new Expo();

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Send push notification to specific users
 */
export async function sendNotificationToUsers(
  userIds: number[],
  payload: NotificationPayload
): Promise<void> {
  try {
    // Get all push tokens for these users
    const allTokens = await Promise.all(
      userIds.map((userId) => db.getUserPushTokens(userId))
    );
    const tokens = allTokens.flat().map((t) => t.token);

    if (tokens.length === 0) {
      console.log('[Notifications] No push tokens found for users:', userIds);
      return;
    }

    await sendPushNotifications(tokens, payload);
  } catch (error) {
    console.error('[Notifications] Failed to send to users:', error);
  }
}

/**
 * Send push notification to event owner (excluding the user who made the change)
 */
export async function notifyEventUpdate(
  eventId: string,
  excludeUserId: number,
  payload: NotificationPayload
): Promise<void> {
  try {
    const tokens = await db.getEventParticipantTokens(eventId, excludeUserId);
    
    if (tokens.length === 0) {
      console.log('[Notifications] No push tokens found for event:', eventId);
      return;
    }

    await sendPushNotifications(
      tokens.map((t) => t.token),
      payload
    );
  } catch (error) {
    console.error('[Notifications] Failed to notify event update:', error);
  }
}

/**
 * Send push notifications using Expo Push Notification service
 */
async function sendPushNotifications(
  pushTokens: string[],
  payload: NotificationPayload
): Promise<void> {
  // Filter out invalid tokens
  const validTokens = pushTokens.filter((token) => Expo.isExpoPushToken(token));

  if (validTokens.length === 0) {
    console.log('[Notifications] No valid Expo push tokens');
    return;
  }

  // Create messages
  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
  }));

  // Send in chunks
  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error('[Notifications] Error sending chunk:', error);
    }
  }

  console.log(`[Notifications] Sent ${tickets.length} notifications`);
}
