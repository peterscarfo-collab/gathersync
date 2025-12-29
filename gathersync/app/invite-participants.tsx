import { useState, useEffect } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View, Share as RNShare } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { eventsLocalStorage } from '@/lib/local-storage';
import { getMonthName } from '@/lib/calendar-utils';
import type { Event } from '@/types/models';

export default function InviteParticipantsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  const [event, setEvent] = useState<Event | null>(null);
  const [inviteLink, setInviteLink] = useState('');

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const surfaceColor = useThemeColor({}, 'surface');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    const loadedEvent = await eventsLocalStorage.getById(eventId!);
    if (loadedEvent) {
      setEvent(loadedEvent);
      // Generate invite link (in production, this would be a deep link or web URL)
      const link = `https://gathersync.app/join/${eventId}`;
      setInviteLink(link);
    }
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(inviteLink);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied!', 'Invitation link copied to clipboard');
  };

  const handleShareLink = async () => {
    if (!event) return;

    const message = `Join my event "${event.name}" on GatherSync!\n\nHelp us find the best date in ${getMonthName(event.month)} ${event.year} by marking your availability.\n\n${inviteLink}`;

    try {
      await RNShare.share({
        message,
        title: `Join ${event.name}`,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  if (!event) {
    return (
      <ThemedView style={[styles.container, { backgroundColor }]}>
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 20),
            paddingBottom: Math.max(insets.bottom, 20),
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
          >
            <IconSymbol name="chevron.left" size={24} color={tintColor} />
          </Pressable>
          <ThemedText type="title">Invite Participants</ThemedText>
          <View style={{ width: 24 }} />
        </View>

        {/* Event Info */}
        <View style={[styles.card, { backgroundColor: surfaceColor }]}>
          <ThemedText type="subtitle" style={styles.eventName}>
            {event.name}
          </ThemedText>
          <ThemedText style={[styles.eventDetails, { color: textSecondaryColor }]}>
            {getMonthName(event.month)} {event.year}
          </ThemedText>
          <ThemedText style={[styles.eventDetails, { color: textSecondaryColor }]}>
            {event.participants.length} {event.participants.length === 1 ? 'participant' : 'participants'}
          </ThemedText>
        </View>

        {/* Instructions */}
        <View style={[styles.card, { backgroundColor: surfaceColor }]}>
          <ThemedText type="subtitle" style={styles.cardTitle}>
            How It Works
          </ThemedText>
          <ThemedText style={[styles.instruction, { color: textSecondaryColor }]}>
            1. Share the invitation link with participants
          </ThemedText>
          <ThemedText style={[styles.instruction, { color: textSecondaryColor }]}>
            2. They'll open the link and mark their availability
          </ThemedText>
          <ThemedText style={[styles.instruction, { color: textSecondaryColor }]}>
            3. The app will automatically update with their responses
          </ThemedText>
          <ThemedText style={[styles.instruction, { color: textSecondaryColor }]}>
            4. You'll see the best day based on everyone's availability
          </ThemedText>
        </View>

        {/* Invitation Link */}
        <View style={[styles.card, { backgroundColor: surfaceColor }]}>
          <ThemedText type="subtitle" style={styles.cardTitle}>
            Invitation Link
          </ThemedText>
          <View style={[styles.linkContainer, { backgroundColor, borderColor: textSecondaryColor + '40' }]}>
            <ThemedText style={styles.linkText} numberOfLines={1}>
              {inviteLink}
            </ThemedText>
          </View>

          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.button, styles.buttonSecondary, { borderColor: tintColor }]}
              onPress={handleCopyLink}
            >
              <IconSymbol name="doc.on.doc" size={20} color={tintColor} />
              <ThemedText style={[styles.buttonText, { color: tintColor }]}>
                Copy Link
              </ThemedText>
            </Pressable>

            <Pressable
              style={[styles.button, styles.buttonPrimary, { backgroundColor: tintColor }]}
              onPress={handleShareLink}
            >
              <IconSymbol name="square.and.arrow.up" size={20} color="#FFFFFF" />
              <ThemedText style={[styles.buttonText, styles.buttonTextPrimary]}>
                Share
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {/* Note */}
        <View style={[styles.note, { backgroundColor: surfaceColor }]}>
          <IconSymbol name="info.circle" size={20} color={textSecondaryColor} />
          <ThemedText style={[styles.noteText, { color: textSecondaryColor }]}>
            Note: Participants will need to install GatherSync to mark their availability. Alternatively, you can add them manually and update their availability yourself.
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  eventName: {
    marginBottom: 8,
  },
  eventDetails: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  cardTitle: {
    marginBottom: 16,
  },
  instruction: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  linkContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  linkText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'monospace',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonSecondary: {
    borderWidth: 2,
  },
  buttonPrimary: {
    // backgroundColor set dynamically
  },
  buttonText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  buttonTextPrimary: {
    color: '#FFFFFF',
  },
  note: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 12,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
