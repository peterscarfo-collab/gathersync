import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Contacts from 'expo-contacts';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { eventsLocalStorage as eventsLocalStorage } from '@/lib/local-storage';
import { generateId } from '@/lib/calendar-utils';
import type { Participant } from '@/types/models';
import { useAutoSync } from '@/hooks/use-auto-sync';

type TabType = 'manual' | 'contacts' | 'ai';

export default function AddParticipantScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { updateEvent } = useAutoSync();

  const [activeTab, setActiveTab] = useState<TabType>('manual');
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [aiText, setAiText] = useState('');
  const [extractedNames, setExtractedNames] = useState<string[]>([]);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [isExtracting, setIsExtracting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const surfaceColor = useThemeColor({}, 'surface');
  const textColor = useThemeColor({}, 'text');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');
  const successColor = useThemeColor({}, 'success');

  const handleAddManual = async () => {
    if (!manualName.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }

    try {
      const event = await eventsLocalStorage.getById(eventId!);
      if (!event) return;

      // Check for duplicates by email or name
      const trimmedEmail = manualEmail.trim().toLowerCase();
      const trimmedName = manualName.trim().toLowerCase();
      const isDuplicate = event.participants.some(p => {
        const matchesEmail = trimmedEmail && p.email?.toLowerCase() === trimmedEmail;
        const matchesName = p.name.toLowerCase() === trimmedName;
        return matchesEmail || matchesName;
      });

      if (isDuplicate) {
        Alert.alert('Duplicate Participant', `${manualName.trim()} is already in this event`);
        return;
      }

      const newParticipant: Participant = {
        id: generateId(),
        name: manualName.trim(),
        phone: manualPhone.trim() || undefined,
        email: manualEmail.trim() || undefined,
        availability: {},
        unavailableAllMonth: false,
        source: 'manual',
      };

      event.participants.push(newParticipant);
      await updateEvent(eventId!, {
        ...event,
        updatedAt: new Date().toISOString(),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setManualName('');
      setManualPhone('');
      setManualEmail('');
      Alert.alert('Success', `${newParticipant.name} has been added`, [
        {
          text: 'Add Another',
          onPress: () => {},
        },
        {
          text: 'Done',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Failed to add participant:', error);
      Alert.alert('Error', 'Failed to add participant. Please try again.');
    }
  };

  const handlePickContacts = async () => {
    try {
      console.log('[Contacts] Requesting permissions...');
      const { status } = await Contacts.requestPermissionsAsync();
      console.log('[Contacts] Permission status:', status);
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow access to contacts to use this feature.');
        return;
      }

      console.log('[Contacts] Fetching contacts...');
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
      });
      console.log(`[Contacts] Fetched ${data.length} contacts`);

      if (data.length === 0) {
        Alert.alert('No Contacts', 'No contacts found on your device.');
        return;
      }

      // Extract and sort contact names with phone numbers
      const contactNames = data
        .filter(contact => contact.name)
        .map(contact => {
          const phone = contact.phoneNumbers && contact.phoneNumbers.length > 0
            ? contact.phoneNumbers[0].number
            : undefined;
          const email = contact.emails && contact.emails.length > 0
            ? contact.emails[0].email
            : undefined;
          
          // Encode contact data: Name|Phone|Email
          let encoded = contact.name!;
          if (phone) encoded += `|${phone}`;
          if (email) encoded += `|${email}`;
          
          return encoded;
        })
        .sort();

      console.log(`[Contacts] Processed ${contactNames.length} contacts with names`);
      console.log('[Contacts] First 5 contacts:', contactNames.slice(0, 5));

      // Store contacts for the UI
      setExtractedNames(contactNames);
      setSelectedNames(new Set()); // Start with none selected
      console.log('[Contacts] State updated, contacts should now be visible');
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
    } catch (error) {
      console.error('[Contacts] Failed to access contacts:', error);
      Alert.alert('Error', 'Failed to access contacts. Please try again.');
    }
  };

  const handleExtractNames = () => {
    if (!aiText.trim()) {
      Alert.alert('Error', 'Please paste some text to extract names from');
      return;
    }

    setIsExtracting(true);
    
    // Simple name extraction logic
    // Look for patterns like "John", "Mary", "Bob and Alice", etc.
    const text = aiText.trim();
    const names: string[] = [];
    
    // Split by common delimiters
    const parts = text.split(/[,\n;]/);
    
    for (const part of parts) {
      const trimmed = part.trim();
      
      // Extract names from patterns like "John is available" or "Mary can make it"
      const nameMatch = trimmed.match(/^([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/);
      if (nameMatch) {
        names.push(nameMatch[1]);
      }
      
      // Handle "and" patterns like "Bob and Alice"
      const andMatches = trimmed.matchAll(/([A-Z][a-z]+)(?:\s+and\s+([A-Z][a-z]+))?/g);
      for (const match of andMatches) {
        if (match[1] && !names.includes(match[1])) {
          names.push(match[1]);
        }
        if (match[2] && !names.includes(match[2])) {
          names.push(match[2]);
        }
      }
    }

    // Remove duplicates and filter out common words
    const commonWords = new Set(['The', 'This', 'That', 'These', 'Those', 'Can', 'Will', 'Would', 'Should']);
    const uniqueNames = [...new Set(names)].filter(name => !commonWords.has(name));

    setIsExtracting(false);
    
    if (uniqueNames.length === 0) {
      Alert.alert('No Names Found', 'Could not extract any names from the text. Try entering names manually.');
      return;
    }

    setExtractedNames(uniqueNames);
    setSelectedNames(new Set(uniqueNames)); // Select all by default
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const toggleNameSelection = (name: string) => {
    const newSelected = new Set(selectedNames);
    if (newSelected.has(name)) {
      newSelected.delete(name);
    } else {
      newSelected.add(name);
    }
    setSelectedNames(newSelected);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleAddSelected = async () => {
    if (selectedNames.size === 0) {
      Alert.alert('Error', 'Please select at least one name');
      return;
    }

    try {
      const event = await eventsLocalStorage.getById(eventId!);
      if (!event) return;

      const newParticipants: Participant[] = Array.from(selectedNames).map(nameData => {
        // Parse name, phone, and email if from contacts (format: "Name|Phone|Email")
        const parts = nameData.split('|');
        const name = parts[0];
        const phone = parts.length > 1 ? parts[1] : undefined;
        const email = parts.length > 2 ? parts[2] : undefined;
        
        console.log('[AddParticipant] Adding:', { name, phone, email });
        
        return {
          id: generateId(),
          name,
          availability: {},
          unavailableAllMonth: false,
          source: activeTab === 'contacts' ? 'contacts' : 'ai',
          phone,
          email,
        };
      });

      event.participants.push(...newParticipants);
      await updateEvent(eventId!, {
        ...event,
        updatedAt: new Date().toISOString(),
      });

      console.log(`[AddParticipant] Added ${newParticipants.length} participants`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      console.error('[AddParticipant] Failed to add participants:', error);
      Alert.alert('Error', 'Failed to add participants. Please try again.');
    }
  };

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
        <ThemedText type="subtitle">Add Participants</ThemedText>
        <View style={{ width: 28 }} />
      </View>

      {/* Segmented Control */}
      <View style={[styles.segmentedControl, { backgroundColor: surfaceColor }]}>
        <Pressable
          style={[
            styles.segment,
            activeTab === 'manual' && [styles.segmentActive, { backgroundColor: tintColor }],
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab('manual');
          }}
        >
          <ThemedText
            style={[
              styles.segmentText,
              activeTab === 'manual' && styles.segmentTextActive,
            ]}
          >
            Manual
          </ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.segment,
            activeTab === 'contacts' && [styles.segmentActive, { backgroundColor: tintColor }],
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab('contacts');
          }}
        >
          <ThemedText
            style={[
              styles.segmentText,
              activeTab === 'contacts' && styles.segmentTextActive,
            ]}
          >
            Contacts
          </ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.segment,
            activeTab === 'ai' && [styles.segmentActive, { backgroundColor: tintColor }],
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab('ai');
          }}
        >
          <ThemedText
            style={[
              styles.segmentText,
              activeTab === 'ai' && styles.segmentTextActive,
            ]}
          >
            AI Import
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: Math.max(insets.bottom, 16) + 80 },
        ]}
      >
        {activeTab === 'manual' ? (
          <View style={styles.manualTab}>
            <ThemedText type="defaultSemiBold" style={styles.label}>
              Participant Name
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: surfaceColor,
                  color: textColor,
                },
              ]}
              placeholder="e.g., John Smith"
              placeholderTextColor={textSecondaryColor}
              value={manualName}
              onChangeText={setManualName}
              autoFocus
            />
            
            <ThemedText type="defaultSemiBold" style={[styles.label, { marginTop: 16 }]}>
              Phone Number (Optional)
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: surfaceColor,
                  color: textColor,
                },
              ]}
              placeholder="e.g., +1 234 567 8900"
              placeholderTextColor={textSecondaryColor}
              value={manualPhone}
              onChangeText={setManualPhone}
              keyboardType="phone-pad"
            />
            
            <ThemedText type="defaultSemiBold" style={[styles.label, { marginTop: 16 }]}>
              Email (Optional)
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: surfaceColor,
                  color: textColor,
                },
              ]}
              placeholder="e.g., john@example.com"
              placeholderTextColor={textSecondaryColor}
              value={manualEmail}
              onChangeText={setManualEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              onSubmitEditing={handleAddManual}
            />
            <Pressable
              style={[styles.actionButton, { backgroundColor: tintColor }]}
              onPress={handleAddManual}
            >
              <ThemedText style={styles.actionButtonText}>
                Add Participant
              </ThemedText>
            </Pressable>
          </View>
        ) : activeTab === 'contacts' ? (
          <View style={styles.contactsTab}>
            {extractedNames.length === 0 ? (
              <>
                <ThemedText type="defaultSemiBold" style={styles.label}>
                  Select from Contacts
                </ThemedText>
                <ThemedText style={[styles.hint, { color: textSecondaryColor }]}>
                  Load your phone's contacts to quickly add multiple participants
                </ThemedText>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: tintColor }]}
                  onPress={handlePickContacts}
                >
                  <IconSymbol name="person.2.fill" size={20} color="#fff" />
                  <ThemedText style={styles.actionButtonText}>
                    Load Contacts
                  </ThemedText>
                </Pressable>
              </>
            ) : (
              <>
                <TextInput
                  style={[
                    styles.searchInput,
                    {
                      backgroundColor: surfaceColor,
                      color: textColor,
                    },
                  ]}
                  placeholder="Search contacts..."
                  placeholderTextColor={textSecondaryColor}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="words"
                />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <ThemedText type="defaultSemiBold" style={styles.label}>
                    Contacts ({selectedNames.size} selected of {extractedNames.length} total)
                  </ThemedText>
                  {searchQuery.length > 0 && (
                    <Pressable onPress={() => setSearchQuery('')}>
                      <ThemedText style={{ color: tintColor, fontSize: 14 }}>Clear Search</ThemedText>
                    </Pressable>
                  )}
                </View>
                <View style={styles.namesList}>
                  {(() => {
                    const filtered = extractedNames.filter(nameData => {
                      // Extract display name from encoded format (Name|Phone|Email)
                      const displayName = nameData.includes('|') ? nameData.split('|')[0] : nameData;
                      return displayName.toLowerCase().includes(searchQuery.toLowerCase());
                    });
                    
                    if (filtered.length === 0) {
                      return (
                        <ThemedText style={{ color: textSecondaryColor, textAlign: 'center', marginTop: 20 }}>
                          No contacts match "{searchQuery}". Try a different search or clear the search box.
                        </ThemedText>
                      );
                    }
                    
                    return filtered.map((nameData) => {
                      const isSelected = selectedNames.has(nameData);
                      // Display only the name part (before the | separator)
                      const displayName = nameData.includes('|') ? nameData.split('|')[0] : nameData;
                      return (
                        <Pressable
                          key={nameData}
                          style={[
                            styles.nameChip,
                            {
                              backgroundColor: isSelected ? tintColor : surfaceColor,
                            },
                          ]}
                          onPress={() => toggleNameSelection(nameData)}
                        >
                          <ThemedText
                            style={[
                              styles.nameChipText,
                              isSelected && styles.nameChipTextSelected,
                            ]}
                          >
                            {displayName}
                          </ThemedText>
                        </Pressable>
                      );
                    });
                  })()}
                </View>
                {selectedNames.size > 0 && (
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: successColor }]}
                    onPress={handleAddSelected}
                  >
                    <ThemedText style={styles.actionButtonText}>
                      Add {selectedNames.size} Selected
                    </ThemedText>
                  </Pressable>
                )}
              </>
            )}
          </View>
        ) : (
          <View style={styles.aiTab}>
            <ThemedText type="defaultSemiBold" style={styles.label}>
              Paste Message or List
            </ThemedText>
            <ThemedText style={[styles.hint, { color: textSecondaryColor }]}>
              Paste text from email, WhatsApp, or any message containing names
            </ThemedText>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: surfaceColor,
                  color: textColor,
                },
              ]}
              placeholder="e.g., 'John and Mary are available. Bob can make it too.'"
              placeholderTextColor={textSecondaryColor}
              value={aiText}
              onChangeText={setAiText}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            <Pressable
              style={[styles.actionButton, { backgroundColor: tintColor }]}
              onPress={handleExtractNames}
              disabled={isExtracting}
            >
              {isExtracting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.actionButtonText}>
                  Extract Names
                </ThemedText>
              )}
            </Pressable>

            {extractedNames.length > 0 && (
              <View style={styles.extractedSection}>
                <ThemedText type="defaultSemiBold" style={styles.label}>
                  Extracted Names ({selectedNames.size} selected)
                </ThemedText>
                <View style={styles.namesList}>
                  {extractedNames.map((name) => {
                    const isSelected = selectedNames.has(name);
                    return (
                      <Pressable
                        key={name}
                        style={[
                          styles.nameChip,
                          {
                            backgroundColor: isSelected ? tintColor : surfaceColor,
                          },
                        ]}
                        onPress={() => toggleNameSelection(name)}
                      >
                        {isSelected && (
                          <IconSymbol name="checkmark" size={16} color="#FFFFFF" />
                        )}
                        <ThemedText
                          style={[
                            styles.nameChipText,
                            isSelected && styles.nameChipTextSelected,
                          ]}
                        >
                          {name}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: successColor }]}
                  onPress={handleAddSelected}
                >
                  <ThemedText style={styles.actionButtonText}>
                    Add Selected ({selectedNames.size})
                  </ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </ScrollView>
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
  segmentedControl: {
    flexDirection: 'row',
    margin: 16,
    padding: 4,
    borderRadius: 12,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  manualTab: {
    gap: 16,
  },
  contactsTab: {
    gap: 16,
  },
  aiTab: {
    gap: 16,
  },
  label: {
    fontSize: 16,
    lineHeight: 24,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: -8,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
  },
  searchInput: {
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    lineHeight: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  textArea: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 120,
  },
  actionButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 48,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  extractedSection: {
    marginTop: 16,
    gap: 16,
  },
  namesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  nameChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  nameChipText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  nameChipTextSelected: {
    color: '#FFFFFF',
  },
});
