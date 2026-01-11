import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAutoSync } from '@/hooks/use-auto-sync';
import type { Event } from '@/types/models';

export default function ImportEventScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { createEvent } = useAutoSync();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const backgroundColor = useThemeColor({}, 'background');
  const surfaceColor = useThemeColor({}, 'surface');
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');

  useEffect(() => {
    // Parse event data from URL params
    try {
      const eventData = params.data as string;
      if (!eventData) {
        setError('No event data provided');
        setLoading(false);
        return;
      }

      // Decode base64 event data
      const decoded = atob(eventData);
      const parsedEvent = JSON.parse(decoded) as Event;
      
      setEvent(parsedEvent);
      setLoading(false);
    } catch (err) {
      console.error('[ImportEvent] Failed to parse event data:', err);
      setError('Invalid event link');
      setLoading(false);
    }
  }, [params]);

  const handleImport = async () => {
    if (!event) return;

    try {
      setImporting(true);
      
      // Create a new event with a new ID (don't use the original ID)
      const newEvent: Event = {
        ...event,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await createEvent(newEvent);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert(
        'Event Imported!',
        `"${event.name}" has been added to your events.`,
        [
          {
            text: 'View Event',
            onPress: () => {
              router.replace(`/event-detail?id=${newEvent.id}` as any);
            },
          },
          {
            text: 'Go to Events',
            onPress: () => {
              router.replace('/(tabs)/' as any);
            },
          },
        ]
      );
    } catch (err) {
      console.error('[ImportEvent] Failed to import event:', err);
      Alert.alert('Error', 'Failed to import event. Please try again.');
      setImporting(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, { backgroundColor }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={tintColor} />
          <ThemedText style={{ marginTop: 16, color: textSecondaryColor }}>
            Loading event...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (error || !event) {
    return (
      <ThemedView style={[styles.container, { backgroundColor }]}>
        <View style={styles.centered}>
          <IconSymbol name="exclamationmark.triangle" size={48} color="#FF3B30" />
          <ThemedText type="subtitle" style={{ marginTop: 16, textAlign: 'center' }}>
            {error || 'Failed to load event'}
          </ThemedText>
          <Pressable
            style={[styles.button, { backgroundColor: tintColor, marginTop: 24 }]}
            onPress={() => router.back()}
          >
            <ThemedText style={styles.buttonText}>Go Back</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, 20) + 20,
          paddingBottom: Math.max(insets.bottom, 20) + 100,
          paddingHorizontal: 20,
        }}
      >
        {/* Header */}
        <View style={styles.header}>
          <IconSymbol name="calendar" size={48} color={tintColor} />
          <ThemedText type="title" style={{ marginTop: 16, textAlign: 'center' }}>
            Import Event
          </ThemedText>
          <ThemedText style={{ marginTop: 8, textAlign: 'center', color: textSecondaryColor }}>
            You've been invited to an event
          </ThemedText>
        </View>

        {/* Event Details */}
        <View style={[styles.eventCard, { backgroundColor: surfaceColor }]}>
          <ThemedText type="subtitle" style={{ marginBottom: 12 }}>
            {event.name}
          </ThemedText>

          {event.fixedDate && (
            <View style={styles.infoRow}>
              <IconSymbol name="calendar" size={20} color={textSecondaryColor} />
              <ThemedText style={{ marginLeft: 8, color: textColor }}>
                {event.fixedDate}{event.fixedTime ? ` at ${event.fixedTime}` : ''}
              </ThemedText>
            </View>
          )}

          {event.venueName && (
            <View style={styles.infoRow}>
              <IconSymbol name="map.fill" size={20} color={textSecondaryColor} />
              <ThemedText style={{ marginLeft: 8, color: textColor }}>
                {event.venueName}
              </ThemedText>
            </View>
          )}

          {event.meetingLink && (
            <View style={styles.infoRow}>
              <IconSymbol name="video.fill" size={20} color={textSecondaryColor} />
              <ThemedText style={{ marginLeft: 8, color: textColor }}>
                Virtual Meeting
              </ThemedText>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View
        style={[
          styles.actions,
          {
            paddingBottom: Math.max(insets.bottom, 20),
            backgroundColor,
            borderTopColor: surfaceColor,
          },
        ]}
      >
        <Pressable
          style={[styles.button, { backgroundColor: tintColor }]}
          onPress={handleImport}
          disabled={importing}
        >
          {importing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.buttonText}>Import Event</ThemedText>
          )}
        </Pressable>

        <Pressable
          style={[styles.button, { backgroundColor: 'transparent', borderWidth: 1, borderColor: textSecondaryColor }]}
          onPress={handleCancel}
          disabled={importing}
        >
          <ThemedText style={[styles.buttonText, { color: textColor }]}>Cancel</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  eventCard: {
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  actions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
  },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
