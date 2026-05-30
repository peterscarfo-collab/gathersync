import React, { useState, useEffect } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { eventsLocalStorage } from '@/lib/local-storage';
import { getMonthName, getBestDays } from '@/lib/calendar-utils';
import type { Event, Participant } from '@/types/models';
import { getEffectiveAttendanceStatus, getParticipantStatus } from '@/lib/participant-status';
import { trpc } from '@/lib/trpc';

export default function SendMessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  const [event, setEvent] = useState<Event | null>(null);
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const surfaceColor = useThemeColor({}, 'surface');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');
  const successColor = useThemeColor({}, 'success');
  const errorColor = useThemeColor({}, 'error');

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    if (!eventId) return;
    const loadedEvent = await eventsLocalStorage.getById(eventId);
    if (loadedEvent) {
      // Enrich participants with global contact info to ensure phone/email is loaded
      try {
        const allEvents = await eventsLocalStorage.getAll();
        const globalInfo = new Map<string, {phone?: string, email?: string}>();
        allEvents.forEach(e => e.participants.forEach(p => {
          if (!globalInfo.has(p.name)) {
            globalInfo.set(p.name, { phone: p.phone, email: p.email });
          } else {
            const current = globalInfo.get(p.name)!;
            if (p.phone && !current.phone) current.phone = p.phone;
            if (p.email && !current.email) current.email = p.email;
          }
        }));

        loadedEvent.participants.forEach(p => {
          const info = globalInfo.get(p.name);
          if (info) {
            if (!p.phone && info.phone) p.phone = info.phone;
            if (!p.email && info.email) p.email = info.email;
          }
        });
      } catch (err) {
        console.error('Failed to enrich participants:', err);
      }
      
      // Filter out deleted participants
      loadedEvent.participants = loadedEvent.participants.filter(p => !p.deletedAt);
      
      setEvent(loadedEvent);
    }
  };

  const toggleParticipant = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newSelected = new Set(selectedParticipants);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedParticipants(newSelected);
  };

  const selectAll = () => {
    if (!event) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedParticipants(new Set(event.participants.map(p => p.id)));
  };

  const selectNone = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedParticipants(new Set());
  };

  const selectByStatus = (status: 'attending' | 'not-attending' | 'no-response' | 'available' | 'not-available') => {
    if (!event) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newSelected = new Set<string>();
    event.participants.forEach(p => {
      if (event.eventType === 'fixed') {
        const effectiveStatus = getEffectiveAttendanceStatus(p, event);
        if (effectiveStatus === status) {
          newSelected.add(p.id);
        }
      } else {
        let isAvailable = false;
        let isNotAvailable = false;
        
        if (p.unavailableAllMonth) {
          isNotAvailable = true;
        } else if (p.availability && Object.keys(p.availability).length > 0) {
          const hasAvailableDays = Object.values(p.availability).some(v => v === true);
          if (hasAvailableDays) {
            isAvailable = true;
          } else {
            isNotAvailable = true;
          }
        }
        
        if (status === 'available' && isAvailable) {
          newSelected.add(p.id);
        } else if (status === 'not-available' && isNotAvailable) {
          newSelected.add(p.id);
        } else if (status === 'no-response' && !isAvailable && !isNotAvailable) {
          newSelected.add(p.id);
        }
      }
    });
    setSelectedParticipants(newSelected);
  };

  const getMessageContent = () => {
    if (!event) return '';
    
    const eventType = event.eventType === 'fixed' 
      ? `Fixed Event: ${event.fixedDate}${event.fixedTime ? ' at ' + event.fixedTime : ''}`
      : `Flexible Event: ${getMonthName(event.month)} ${event.year}`;
    
    const bestDays = getBestDays(event);
    const bestDayText = bestDays.length > 0
      ? `\nBest day: ${bestDays[0].date} (${bestDays[0].availableCount} available)`
      : '';
      
    const meetingDetails = [];
    if (event.meetingType === 'in-person' && event.venueName) {
      meetingDetails.push(`Venue: ${event.venueName}`);
      if (event.venueAddress) meetingDetails.push(`Address: ${event.venueAddress}`);
    } else if (event.meetingType === 'virtual' && event.meetingLink) {
      meetingDetails.push(`Meeting Link: ${event.meetingLink}`);
    }

    const baseUrl = Platform.OS === 'web' 
      ? window.location.origin
      : 'https://app.gathersync.com'; // TODO: Update with your actual production domain
    const webUrl = `${baseUrl}/public-event?eventId=${event.id}`;

    const baseMessage = `📅 ${event.name}\n\n${eventType}${bestDayText}${meetingDetails.length > 0 ? '\n\n' + meetingDetails.join('\n') : ''}\n\nView and RSVP:\n${webUrl}`;
    
    return event.reminderMessage
      ? `${event.reminderMessage}\n\n${baseMessage}`
      : baseMessage;
  };

  const sendSms = () => {
    if (!event) return;
    const message = getMessageContent();
    const phoneNumbers = event.participants
      .filter(p => selectedParticipants.has(p.id) && p.phone)
      .map(p => p.phone);

    if (phoneNumbers.length === 0) {
      Alert.alert('No Phone Numbers', 'None of the selected participants have a phone number saved.');
      return;
    }

    const separator = Platform.OS === 'ios' ? ',' : ';';
    const smsUrl = `sms:${phoneNumbers.join(separator)}?body=${encodeURIComponent(message)}`;
    Linking.openURL(smsUrl).catch(() => {
      Alert.alert('Error', 'Failed to open SMS app.');
    });
  };

  const [isSending, setIsSending] = useState(false);
  const sendInvitationsMutation = trpc.participants.sendInvitations.useMutation();

  const sendNativeEmail = async () => {
    if (!event) return;
    const message = getMessageContent();
    const emails = event.participants
      .filter(p => selectedParticipants.has(p.id) && p.email)
      .map(p => p.email);

    if (emails.length === 0) {
      if (Platform.OS === 'web') {
        alert('None of the selected participants have an email address saved.');
      } else {
        Alert.alert('No Emails', 'None of the selected participants have an email address saved.');
      }
      return;
    }

    const bccString = emails.join(',');
    const subject = encodeURIComponent(`Update regarding ${event.name}`);
    const body = encodeURIComponent(message);
    const mailtoUrl = `mailto:?bcc=${bccString}&subject=${subject}&body=${body}`;
    
    let copySuccess = false;
    
    try {
      if (Platform.OS === 'web') {
        // Fallback to execCommand for web to ensure it works across all browsers synchronously
        const textArea = document.createElement("textarea");
        textArea.value = bccString;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        copySuccess = document.execCommand('copy');
        textArea.remove();
      } else {
        await Clipboard.setStringAsync(bccString);
        copySuccess = true;
      }
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }

    try {
      if (Platform.OS === 'web') {
        const a = document.createElement('a');
        a.href = mailtoUrl;
        a.target = '_top';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        const msg = copySuccess 
          ? 'Opening your email app...\n\nIf it does not open automatically, all selected email addresses have been copied to your clipboard. You can paste them into the BCC field of your email client.'
          : 'Opening your email app...\n\n(Note: We tried to copy the emails to your clipboard as a fallback, but your browser blocked it.)';
        
        // Use setTimeout so the alert doesn't block the link click execution
        setTimeout(() => alert(msg), 100);
      } else {
        await Linking.openURL(mailtoUrl);
      }
    } catch (err) {
      if (Platform.OS === 'web') {
        alert(copySuccess ? 'Could not open email app. The email addresses have been copied to your clipboard.' : 'Could not open email app, and clipboard access was denied.');
      } else {
        Alert.alert('Notice', copySuccess ? 'Could not open email app. The email addresses have been copied to your clipboard.' : 'Could not open email app.');
      }
    }
  };

  const executeSendEmail = async () => {
    if (!event) return;
    const message = getMessageContent();
    const selected = event.participants.filter(p => 
      selectedParticipants.has(p.id) && p.email
    );

    const baseUrl = Platform.OS === 'web' 
      ? window.location.origin
      : 'https://app.gathersync.com';

    try {
      setIsSending(true);
      const result = await sendInvitationsMutation.mutateAsync({
        eventId: event.id,
        participantIds: selected.map(p => p.id),
        eventDetails: message,
        baseUrl,
      });

      if (Platform.OS === 'web') {
        alert(`Successfully sent ${result.sentCount} emails!`);
      } else {
        Alert.alert('Success', `Successfully sent ${result.sentCount} emails!`);
      }
      
      router.back();
    } catch (error) {
      console.error('Error sending emails:', error);
      if (Platform.OS === 'web') {
        alert('Failed to send emails. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to send emails. Please try again.');
      }
    } finally {
      setIsSending(false);
    }
  };

  const sendEmail = () => {
    if (!event) return;
    const emails = event.participants
      .filter(p => selectedParticipants.has(p.id) && p.email)
      .map(p => p.email);

    if (emails.length === 0) {
      if (Platform.OS === 'web') {
        alert('None of the selected participants have an email address saved.');
      } else {
        Alert.alert('No Emails', 'None of the selected participants have an email address saved.');
      }
      return;
    }

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to send ${emails.length} emails using the GatherSync system? This cannot be undone.`)) {
        executeSendEmail();
      }
    } else {
      Alert.alert(
        'Confirm Send',
        `Are you sure you want to send ${emails.length} emails using the GatherSync system? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Send Emails', style: 'destructive', onPress: executeSendEmail }
        ]
      );
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
        <ThemedText type="subtitle">Send Messages</ThemedText>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Preview of the message */}
        <View style={[styles.card, { backgroundColor: surfaceColor, marginBottom: 16 }]}>
          <ThemedText type="defaultSemiBold" style={{ marginBottom: 8 }}>Message Preview</ThemedText>
          <ThemedText style={{ color: textSecondaryColor, fontSize: 14 }}>
            {getMessageContent()}
          </ThemedText>
        </View>

        {/* Filters */}
        <View style={{ marginBottom: 16 }}>
          <ThemedText type="defaultSemiBold" style={{ marginBottom: 8 }}>Quick Select</ThemedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Pressable style={[styles.filterButton, { backgroundColor: tintColor + '20' }]} onPress={selectAll}>
              <ThemedText style={{ color: tintColor, fontSize: 13, fontWeight: '500' }}>Select All</ThemedText>
            </Pressable>
            <Pressable style={[styles.filterButton, { backgroundColor: textSecondaryColor + '20' }]} onPress={selectNone}>
              <ThemedText style={{ color: textSecondaryColor, fontSize: 13, fontWeight: '500' }}>Select None</ThemedText>
            </Pressable>
            {event.eventType === 'fixed' ? (
              <>
                <Pressable style={[styles.filterButton, { backgroundColor: successColor + '20' }]} onPress={() => selectByStatus('attending')}>
                  <ThemedText style={{ color: successColor, fontSize: 13, fontWeight: '500' }}>Attending</ThemedText>
                </Pressable>
                <Pressable style={[styles.filterButton, { backgroundColor: errorColor + '20' }]} onPress={() => selectByStatus('not-attending')}>
                  <ThemedText style={{ color: errorColor, fontSize: 13, fontWeight: '500' }}>Not Attending</ThemedText>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable style={[styles.filterButton, { backgroundColor: successColor + '20' }]} onPress={() => selectByStatus('available')}>
                  <ThemedText style={{ color: successColor, fontSize: 13, fontWeight: '500' }}>Available</ThemedText>
                </Pressable>
                <Pressable style={[styles.filterButton, { backgroundColor: errorColor + '20' }]} onPress={() => selectByStatus('not-available')}>
                  <ThemedText style={{ color: errorColor, fontSize: 13, fontWeight: '500' }}>Not Available</ThemedText>
                </Pressable>
              </>
            )}
            <Pressable style={[styles.filterButton, { backgroundColor: textSecondaryColor + '20' }]} onPress={() => selectByStatus('no-response')}>
              <ThemedText style={{ color: textSecondaryColor, fontSize: 13, fontWeight: '500' }}>No Response</ThemedText>
            </Pressable>
          </View>
        </View>

        <ThemedText type="defaultSemiBold" style={{ marginBottom: 8 }}>
          Participants ({selectedParticipants.size}/{event.participants.length} selected)
        </ThemedText>

        <View style={[styles.card, { backgroundColor: surfaceColor, padding: 0 }]}>
          {event.participants.map((p, index) => {
            const isSelected = selectedParticipants.has(p.id);
            
            let statusColor = textSecondaryColor;
            let statusText = 'No Response';
            
            if (event.eventType === 'fixed') {
              const status = getEffectiveAttendanceStatus(p, event);
              if (status === 'attending') {
                statusColor = successColor;
                statusText = 'Attending';
              } else if (status === 'not-attending') {
                statusColor = errorColor;
                statusText = 'Not Attending';
              }
            } else {
              if (p.unavailableAllMonth) {
                statusColor = errorColor;
                statusText = 'Not Available';
              } else if (p.availability && Object.keys(p.availability).length > 0) {
                const hasAvailableDays = Object.values(p.availability).some(v => v === true);
                if (hasAvailableDays) {
                  statusColor = successColor;
                  statusText = 'Available';
                } else {
                  statusColor = errorColor;
                  statusText = 'Not Available';
                }
              }
            }
            
            return (
              <Pressable
                key={p.id}
                style={[
                  styles.participantRow,
                  index < event.participants.length - 1 && { borderBottomColor: textSecondaryColor + '20', borderBottomWidth: StyleSheet.hairlineWidth }
                ]}
                onPress={() => toggleParticipant(p.id)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <View style={[
                    styles.checkbox,
                    { borderColor: isSelected ? tintColor : textSecondaryColor + '50' },
                    isSelected && { backgroundColor: tintColor }
                  ]}>
                    {isSelected && <IconSymbol name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="defaultSemiBold">{p.name}</ThemedText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <ThemedText style={{ fontSize: 12, color: statusColor }}>{statusText}</ThemedText>
                      {p.phone && <IconSymbol name="phone.fill" size={10} color={textSecondaryColor} />}
                      {p.email && <IconSymbol name="envelope.fill" size={10} color={textSecondaryColor} />}
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={{ height: Math.max(insets.bottom, 16) + 120 }} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.actionContainer, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor }]}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: tintColor, opacity: selectedParticipants.size === 0 ? 0.5 : 1 }]}
          onPress={sendSms}
          disabled={selectedParticipants.size === 0}
        >
          <IconSymbol name="message.fill" size={20} color="#FFFFFF" />
          <ThemedText style={styles.actionButtonText}>Send SMS</ThemedText>
        </Pressable>
        
        <Pressable
          style={[styles.actionButton, { backgroundColor: tintColor, opacity: (selectedParticipants.size === 0 || isSending) ? 0.5 : 1 }]}
          onPress={sendNativeEmail}
          disabled={selectedParticipants.size === 0 || isSending}
        >
          <IconSymbol name="envelope.fill" size={20} color="#FFFFFF" />
          <ThemedText style={styles.actionButtonText}>
            Native Email
          </ThemedText>
        </Pressable>

        <Pressable
          style={[styles.actionButton, { backgroundColor: tintColor, opacity: (selectedParticipants.size === 0 || isSending) ? 0.5 : 1 }]}
          onPress={sendEmail}
          disabled={selectedParticipants.size === 0 || isSending}
        >
          <IconSymbol name="paperplane.fill" size={20} color="#FFFFFF" />
          <ThemedText style={styles.actionButtonText}>
            {isSending ? 'Sending...' : 'App Email'}
          </ThemedText>
        </Pressable>
      </View>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  participantRow: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  actionButton: {
    flex: 1,
    minWidth: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});