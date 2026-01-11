import { useState, useEffect } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, Linking, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { eventsLocalStorage } from '@/lib/local-storage';
import { getMonthName, getBestDays } from '@/lib/calendar-utils';
import type { Event, Participant } from '@/types/models';

export default function EmailParticipantsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  const [event, setEvent] = useState<Event | null>(null);
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const surfaceColor = useThemeColor({}, 'surface');
  const textColor = useThemeColor({}, 'text');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    if (!eventId) return;
    const loadedEvent = await eventsLocalStorage.getById(eventId);
    if (loadedEvent) {
      setEvent(loadedEvent);
      // Pre-select all participants with emails
      const withEmails = new Set(
        loadedEvent.participants.filter(p => p.email).map(p => p.id)
      );
      setSelectedParticipants(withEmails);
    }
  };

  const toggleParticipant = (participantId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedParticipants(prev => {
      const newSet = new Set(prev);
      if (newSet.has(participantId)) {
        newSet.delete(participantId);
      } else {
        newSet.add(participantId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const participantsWithEmail = event?.participants.filter(p => p.email) || [];
    
    if (selectedParticipants.size === participantsWithEmail.length) {
      // Deselect all
      setSelectedParticipants(new Set());
    } else {
      // Select all
      setSelectedParticipants(new Set(participantsWithEmail.map(p => p.id)));
    }
  };

  const handleSendEmail = async () => {
    if (!event) return;

    const selected = event.participants.filter(p => 
      selectedParticipants.has(p.id) && p.email
    );

    if (selected.length === 0) {
      if (Platform.OS === 'web') {
        alert('Please select at least one participant with an email address.');
      } else {
        Alert.alert('No Selection', 'Please select at least one participant with an email address.');
      }
      return;
    }

    const bestDays = getBestDays(event);
    const bestDayText = bestDays.length > 0
      ? `Best day: ${bestDays[0].date} (${bestDays[0].availableCount} available)`
      : 'No availability data yet';

    const eventType = event.eventType === 'fixed' 
      ? `${event.fixedDate}${event.fixedTime ? ' at ' + event.fixedTime : ''}`
      : `${getMonthName(event.month)} ${event.year}`;

    const emails = selected.map(p => p.email).join(', ');
    const emailBody = 
      `You're invited to: ${event.name}\n\n` +
      `When: ${eventType}\n\n` +
      `${bestDayText}\n\n` +
      `Please respond with your availability.`;

    // On web, copy to clipboard instead of mailto (more reliable)
    if (Platform.OS === 'web') {
      const clipboardText = 
        `TO: ${emails}\n\n` +
        `SUBJECT: Invitation: ${event.name}\n\n` +
        `MESSAGE:\n${emailBody}`;
      
      try {
        await Clipboard.setStringAsync(clipboardText);
        alert(
          `Email details copied to clipboard!\n\n` +
          `Recipients: ${emails}\n\n` +
          `Open your email client and paste (Cmd+V) to send.`
        );
      } catch (error) {
        console.error('Error copying:', error);
        alert('Could not copy to clipboard. Please try again.');
      }
    } else {
      // On mobile, use mailto link
      const subject = encodeURIComponent(`Invitation: ${event.name}`);
      const body = encodeURIComponent(emailBody);
      const mailtoLink = `mailto:${emails}?subject=${subject}&body=${body}`;

      Linking.openURL(mailtoLink).catch(err => {
        console.error('Error opening email:', err);
        Alert.alert('Error', 'Could not open email client. Please check your default email settings.');
      });
    }
  };

  if (!event) {
    return (
      <ThemedView style={[styles.container, { backgroundColor }]}>
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  const participantsWithEmail = event.participants.filter(p => p.email);
  const participantsWithoutEmail = event.participants.filter(p => !p.email);
  const allSelected = selectedParticipants.size === participantsWithEmail.length && participantsWithEmail.length > 0;

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: 16,
          },
        ]}
      >
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          hitSlop={8}
        >
          <IconSymbol name="chevron.left" size={28} color={tintColor} />
        </Pressable>
        <ThemedText type="subtitle" style={styles.headerTitle}>
          Email Participants
        </ThemedText>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: Math.max(insets.bottom, 16) + 80 },
        ]}
      >
        {participantsWithEmail.length > 0 && (
          <>
            <View style={[styles.selectAllCard, { backgroundColor: surfaceColor }]}>
              <Pressable
                style={styles.selectAllButton}
                onPress={toggleSelectAll}
              >
                <View style={[
                  styles.checkbox,
                  { borderColor: tintColor },
                  allSelected && { backgroundColor: tintColor }
                ]}>
                  {allSelected && (
                    <IconSymbol name="checkmark" size={16} color="#FFFFFF" />
                  )}
                </View>
                <ThemedText type="defaultSemiBold">
                  Select All ({participantsWithEmail.length})
                </ThemedText>
              </Pressable>
              <ThemedText style={[styles.hint, { color: textSecondaryColor }]}>
                {selectedParticipants.size} selected
              </ThemedText>
            </View>

            <View style={styles.participantsList}>
              {participantsWithEmail.map((participant) => (
                <Pressable
                  key={participant.id}
                  style={[styles.participantCard, { backgroundColor: surfaceColor }]}
                  onPress={() => toggleParticipant(participant.id)}
                >
                  <View style={[
                    styles.checkbox,
                    { borderColor: tintColor },
                    selectedParticipants.has(participant.id) && { backgroundColor: tintColor }
                  ]}>
                    {selectedParticipants.has(participant.id) && (
                      <IconSymbol name="checkmark" size={16} color="#FFFFFF" />
                    )}
                  </View>
                  <View style={styles.participantInfo}>
                    <ThemedText type="defaultSemiBold">{participant.name}</ThemedText>
                    <ThemedText style={[styles.email, { color: textSecondaryColor }]}>
                      {participant.email}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {participantsWithoutEmail.length > 0 && (
          <View style={[styles.noEmailCard, { backgroundColor: surfaceColor }]}>
            <ThemedText type="defaultSemiBold" style={styles.noEmailTitle}>
              Participants Without Email
            </ThemedText>
            <ThemedText style={[styles.noEmailHint, { color: textSecondaryColor }]}>
              These participants don't have email addresses and can't be emailed.
            </ThemedText>
            {participantsWithoutEmail.map((participant) => (
              <View key={participant.id} style={styles.noEmailItem}>
                <IconSymbol name="person.fill" size={16} color={textSecondaryColor} />
                <ThemedText style={{ color: textSecondaryColor }}>
                  {participant.name}
                </ThemedText>
              </View>
            ))}
          </View>
        )}

        {participantsWithEmail.length === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: surfaceColor }]}>
            <IconSymbol name="paperplane.fill" size={48} color={textSecondaryColor} />
            <ThemedText type="subtitle" style={styles.emptyTitle}>
              No Email Addresses
            </ThemedText>
            <ThemedText style={[styles.emptyText, { color: textSecondaryColor }]}>
              Add email addresses to participants to send invitations.
            </ThemedText>
          </View>
        )}
      </ScrollView>

      {participantsWithEmail.length > 0 && (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              backgroundColor: backgroundColor,
            },
          ]}
        >
          <Pressable
            style={[
              styles.sendButton,
              { backgroundColor: tintColor },
              selectedParticipants.size === 0 && styles.sendButtonDisabled,
            ]}
            onPress={handleSendEmail}
            disabled={selectedParticipants.size === 0}
          >
            <IconSymbol name="paperplane.fill" size={20} color="#FFFFFF" />
            <ThemedText style={styles.sendButtonText}>
              Send Email to {selectedParticipants.size} {selectedParticipants.size === 1 ? 'Participant' : 'Participants'}
            </ThemedText>
          </Pressable>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  selectAllCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
  },
  participantsList: {
    gap: 8,
  },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantInfo: {
    flex: 1,
  },
  email: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  noEmailCard: {
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  noEmailTitle: {
    marginBottom: 8,
  },
  noEmailHint: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  noEmailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  emptyCard: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
});
