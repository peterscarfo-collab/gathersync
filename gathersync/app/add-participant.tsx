import React, { useState, useEffect, useMemo } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Contacts from 'expo-contacts';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { eventsLocalStorage } from '@/lib/local-storage';
import { generateId } from '@/lib/calendar-utils';
import type { Participant } from '@/types/models';
import { useAutoSync } from '@/hooks/use-auto-sync';

type ContactData = {
  name: string;
  phone?: string;
  email?: string;
  source: 'contacts';
};

export default function AddParticipantScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { updateEvent } = useAutoSync();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [searchQuery, setSearchQuery] = useState('');
  const [directory, setDirectory] = useState<Participant[]>([]);
  const [contacts, setContacts] = useState<ContactData[]>([]);
  const [hasLoadedContacts, setHasLoadedContacts] = useState(false);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(true);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [currentEventParticipants, setCurrentEventParticipants] = useState<Set<string>>(new Set());

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const surfaceColor = useThemeColor({}, 'surface');
  const textColor = useThemeColor({}, 'text');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');
  const successColor = useThemeColor({}, 'success');

  useEffect(() => {
    async function loadDirectory() {
      setIsLoadingDirectory(true);
      try {
        const allEvents = await eventsLocalStorage.getAll();
        const currentEvent = allEvents.find(e => e.id === eventId);
        
        const currentParticipants = new Set<string>();
        if (currentEvent) {
          currentEvent.participants.forEach(p => {
            currentParticipants.add(p.name.toLowerCase());
            if (p.email) currentParticipants.add(p.email.toLowerCase());
          });
        }
        setCurrentEventParticipants(currentParticipants);

        const uniqueParticipants = new Map<string, Participant>();
        for (const e of allEvents) {
          for (const p of e.participants) {
            const lowerName = p.name.toLowerCase();
            // Prefer records with more info
            const existing = uniqueParticipants.get(lowerName);
            if (!existing || (!existing.phone && p.phone) || (!existing.email && p.email)) {
              uniqueParticipants.set(lowerName, p);
            }
          }
        }
        setDirectory(Array.from(uniqueParticipants.values()).sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        console.error('Failed to load directory:', err);
      } finally {
        setIsLoadingDirectory(false);
      }
    }
    loadDirectory();
  }, [eventId]);

  const loadContacts = async () => {
    setIsLoadingContacts(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow access to contacts to use this feature.');
        setIsLoadingContacts(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
      });

      if (data.length > 0) {
        const contactList: ContactData[] = data
          .filter(contact => contact.name)
          .map(contact => ({
            name: contact.name!,
            phone: contact.phoneNumbers?.[0]?.number,
            email: contact.emails?.[0]?.email,
            source: 'contacts' as const,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        
        setContacts(contactList);
        setHasLoadedContacts(true);
      }
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const handleAddParticipant = async (data: { name: string; phone?: string; email?: string; source: 'manual' | 'contacts' | 'directory' }) => {
    if (!data.name.trim()) return;

    try {
      const event = await eventsLocalStorage.getById(eventId!);
      if (!event) return;

      const trimmedName = data.name.trim();
      const lowerName = trimmedName.toLowerCase();
      
      // Double check it's not already in the event
      if (event.participants.some(p => p.name.toLowerCase() === lowerName)) {
        Alert.alert('Already Added', `${trimmedName} is already in this event.`);
        return;
      }

      const newParticipant: Participant = {
        id: generateId(),
        name: trimmedName,
        phone: data.phone,
        email: data.email,
        availability: {},
        unavailableAllMonth: false,
        source: data.source === 'contacts' ? 'contacts' : 'manual',
      };

      event.participants.push(newParticipant);
      await updateEvent(eventId!, {
        ...event,
        updatedAt: new Date().toISOString(),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Update local state so it immediately disappears from the list
      setCurrentEventParticipants(prev => {
        const next = new Set(prev);
        next.add(lowerName);
        if (data.email) next.add(data.email.toLowerCase());
        return next;
      });
      
      // Clear search to prepare for next addition, or go back if preferred.
      // Usually returning back after 1 addition is okay, but "Add Screen" might be used for multiple.
      // Let's show a brief toast or alert, and clear search.
      setSearchQuery('');
      Alert.alert('Success', `${trimmedName} added!`, [
        { text: 'Done', onPress: () => router.back() },
        { text: 'Add Another', style: 'cancel' }
      ]);
    } catch (error) {
      console.error('Failed to add participant:', error);
      Alert.alert('Error', 'Failed to add participant. Please try again.');
    }
  };

  const filteredDirectory = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return directory.filter(p => p.name.toLowerCase().includes(query));
  }, [searchQuery, directory]);

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return contacts.filter(c => c.name.toLowerCase().includes(query));
  }, [searchQuery, contacts]);

  // Exact match check to decide whether to show the "Add New" button
  const hasExactMatch = 
    filteredDirectory.some(p => p.name.toLowerCase() === searchQuery.trim().toLowerCase()) ||
    filteredContacts.some(c => c.name.toLowerCase() === searchQuery.trim().toLowerCase());

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
        <ThemedText type="subtitle">Add Participant</ThemedText>
        <View style={{ width: 28 }} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.searchContainer}>
          <View style={[styles.searchBox, { backgroundColor: surfaceColor }]}>
            <IconSymbol name="magnifyingglass" size={20} color={textSecondaryColor} />
            <TextInput
              style={[styles.searchInput, { color: textColor }]}
              placeholder="Search or enter new name..."
              placeholderTextColor={textSecondaryColor}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              autoCapitalize="words"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <IconSymbol name="xmark.circle.fill" size={20} color={textSecondaryColor} />
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: Math.max(insets.bottom, 16) + 20 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {isLoadingDirectory && !searchQuery ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={tintColor} />
          ) : (
            <>
              {searchQuery.trim().length > 0 && !hasExactMatch && (
                <Pressable
                  style={[styles.addCard, { backgroundColor: tintColor + '10', borderColor: tintColor }]}
                  onPress={() => handleAddParticipant({ name: searchQuery, source: 'manual' })}
                >
                  <View style={[styles.iconBox, { backgroundColor: tintColor }]}>
                    <IconSymbol name="person.badge.plus" size={20} color="#fff" />
                  </View>
                  <View style={styles.addCardContent}>
                    <ThemedText type="defaultSemiBold" style={{ color: tintColor }}>
                      Add "{searchQuery.trim()}"
                    </ThemedText>
                    <ThemedText style={{ color: tintColor, fontSize: 13, marginTop: 2 }}>
                      Create as new participant
                    </ThemedText>
                  </View>
                </Pressable>
              )}

              {searchQuery.trim().length > 0 && filteredDirectory.length > 0 && (
                <View style={styles.section}>
                  <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>From Directory</ThemedText>
                  <View style={[styles.gridContainer, isDesktop && styles.gridContainerDesktop]}>
                    {filteredDirectory.map(p => {
                      const isAdded = currentEventParticipants.has(p.name.toLowerCase());
                      return (
                        <Pressable
                          key={`dir-${p.id}`}
                          style={[
                            styles.participantCard, 
                            { backgroundColor: surfaceColor }, 
                            isDesktop && styles.participantCardDesktop,
                            isAdded && { opacity: 0.6 }
                          ]}
                          onPress={() => !isAdded && handleAddParticipant({ name: p.name, phone: p.phone, email: p.email, source: 'directory' })}
                        >
                          <View style={styles.participantInfo}>
                            <ThemedText type="defaultSemiBold">{p.name}</ThemedText>
                            {(p.phone || p.email) && (
                              <ThemedText style={{ color: textSecondaryColor, fontSize: 13, marginTop: 4 }}>
                                {[p.phone, p.email].filter(Boolean).join('\n')}
                              </ThemedText>
                            )}
                          </View>
                          {isAdded ? (
                            <IconSymbol name="checkmark.circle.fill" size={24} color={successColor} />
                          ) : (
                            <IconSymbol name="plus.circle.fill" size={24} color={tintColor} />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {searchQuery.trim().length > 0 && hasLoadedContacts && filteredContacts.length > 0 && (
                <View style={styles.section}>
                  <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>From Contacts</ThemedText>
                  <View style={[styles.gridContainer, isDesktop && styles.gridContainerDesktop]}>
                    {filteredContacts.map((c, idx) => {
                      const isAdded = currentEventParticipants.has(c.name.toLowerCase());
                      return (
                        <Pressable
                          key={`contact-${idx}`}
                          style={[
                            styles.participantCard, 
                            { backgroundColor: surfaceColor }, 
                            isDesktop && styles.participantCardDesktop,
                            isAdded && { opacity: 0.6 }
                          ]}
                          onPress={() => !isAdded && handleAddParticipant({ name: c.name, phone: c.phone, email: c.email, source: 'contacts' })}
                        >
                          <View style={styles.participantInfo}>
                            <ThemedText type="defaultSemiBold">{c.name}</ThemedText>
                            {(c.phone || c.email) && (
                              <ThemedText style={{ color: textSecondaryColor, fontSize: 13, marginTop: 4 }}>
                                {[c.phone, c.email].filter(Boolean).join('\n')}
                              </ThemedText>
                            )}
                          </View>
                          {isAdded ? (
                            <IconSymbol name="checkmark.circle.fill" size={24} color={successColor} />
                          ) : (
                            <IconSymbol name="plus.circle.fill" size={24} color={tintColor} />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Suggestions when empty */}
              {!searchQuery.trim() && directory.length > 0 && (
                <View style={styles.section}>
                  <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Recent Participants</ThemedText>
                  <View style={[styles.gridContainer, isDesktop && styles.gridContainerDesktop]}>
                    {directory.slice(0, 15).map(p => {
                      const isAdded = currentEventParticipants.has(p.name.toLowerCase());
                      return (
                        <Pressable
                          key={`sug-${p.id}`}
                          style={[
                            styles.participantCard, 
                            { backgroundColor: surfaceColor }, 
                            isDesktop && styles.participantCardDesktop,
                            isAdded && { opacity: 0.6 }
                          ]}
                          onPress={() => !isAdded && handleAddParticipant({ name: p.name, phone: p.phone, email: p.email, source: 'directory' })}
                        >
                          <View style={styles.participantInfo}>
                            <ThemedText type="defaultSemiBold">{p.name}</ThemedText>
                            {(p.phone || p.email) && (
                              <ThemedText style={{ color: textSecondaryColor, fontSize: 13, marginTop: 4 }}>
                                {[p.phone, p.email].filter(Boolean).join('\n')}
                              </ThemedText>
                            )}
                          </View>
                          {isAdded ? (
                            <IconSymbol name="checkmark.circle.fill" size={24} color={successColor} />
                          ) : (
                            <IconSymbol name="plus.circle.fill" size={24} color={tintColor} />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {!hasLoadedContacts && (
                <Pressable
                  style={[styles.loadContactsCard, { backgroundColor: surfaceColor }]}
                  onPress={loadContacts}
                >
                  <IconSymbol name="person.crop.circle.badge.plus" size={32} color={tintColor} />
                  <View style={styles.loadContactsContent}>
                    <ThemedText type="defaultSemiBold">Search Phone Contacts</ThemedText>
                    <ThemedText style={{ color: textSecondaryColor, fontSize: 13, marginTop: 4 }}>
                      Allow access to easily add people from your address book.
                    </ThemedText>
                  </View>
                  {isLoadingContacts && <ActivityIndicator color={tintColor} />}
                </Pressable>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 48,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 20,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    marginBottom: 4,
    opacity: 0.8,
  },
  gridContainer: {
    gap: 8,
  },
  gridContainerDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    justifyContent: 'space-between',
  },
  participantCardDesktop: {
    width: '32%',
  },
  participantInfo: {
    flex: 1,
  },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCardContent: {
    flex: 1,
  },
  loadContactsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 16,
    marginTop: 16,
  },
  loadContactsContent: {
    flex: 1,
  },
});
