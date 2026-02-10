import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Contacts from 'expo-contacts';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/auth-context';
import { useEvents } from '@/hooks/use-instant-events';
import { eventsLocalStorage as eventsLocalStorage, templatesLocalStorage } from '@/lib/local-storage';
import type { Event, GroupTemplate, Participant } from '@/types/models';
import { eventMutations } from '@/lib/instant-mutations';

type TabType = 'manual' | 'contacts' | 'ai' | 'groups' | 'directory';

type DirectoryEntry = {
  key: string;
  name: string;
  phone?: string;
  email?: string;
};

export default function AddParticipantScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { isAuthenticated } = useAuth();
  const { events: liveEvents, isLoading: liveEventsLoading } = useEvents();
  const [eventName, setEventName] = useState<string>('');

  const [activeTab, setActiveTab] = useState<TabType>('manual');
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [aiText, setAiText] = useState('');
  const [extractedNames, setExtractedNames] = useState<string[]>([]);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [isExtracting, setIsExtracting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupTemplates, setGroupTemplates] = useState<GroupTemplate[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [directoryEntries, setDirectoryEntries] = useState<DirectoryEntry[]>([]);
  const [selectedDirectoryKeys, setSelectedDirectoryKeys] = useState<Set<string>>(new Set());
  const [directorySearch, setDirectorySearch] = useState('');
  const [directoryLoading, setDirectoryLoading] = useState(false);

  const appendParticipantsToLocal = async (participants: Participant[]) => {
    if (!eventId) return;
    const event = await eventsLocalStorage.getById(eventId);
    if (!event) return;
    event.participants.push(...participants);
    await eventsLocalStorage.update(eventId, {
      ...event,
      updatedAt: new Date().toISOString(),
    });
  };
  useEffect(() => {
    const loadEventName = async () => {
      if (!eventId) return;
      const event = await eventsLocalStorage.getById(eventId);
      setEventName(event?.name ?? '');
    };
    loadEventName();
  }, [eventId]);

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const surfaceColor = useThemeColor({}, 'surface');
  const textColor = useThemeColor({}, 'text');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');
  const successColor = useThemeColor({}, 'success');

  const loadGroupTemplates = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const templates = await templatesLocalStorage.getAll();
      setGroupTemplates(templates);
    } catch (error) {
      console.error('[AddParticipant] Failed to load group templates:', error);
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (activeTab !== 'groups') return;
      loadGroupTemplates();
    }, [activeTab, loadGroupTemplates])
  );

  useEffect(() => {
    if (activeTab !== 'groups') {
      setSelectedGroupIds(new Set());
      setExpandedGroupId(null);
      setSelectedGroupMembers(new Set());
    }
  }, [activeTab]);

  const buildDirectoryEntries = (sourceEvents: Event[]) => {
    const entryMap = new Map<string, DirectoryEntry>();

    sourceEvents.forEach(event => {
      event.participants
        .filter(p => !p.deletedAt)
        .forEach(p => {
          const emailKey = p.email?.toLowerCase();
          const nameKey = p.name.toLowerCase();
          const key = emailKey || nameKey;

          if (!entryMap.has(key)) {
            entryMap.set(key, {
              key,
              name: p.name,
              phone: p.phone,
              email: p.email,
            });
          }
        });
    });

    setDirectoryEntries(Array.from(entryMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
  };

  const loadDirectoryEntries = useCallback(async () => {
    if (isAuthenticated && liveEventsLoading) {
      setDirectoryLoading(true);
      return;
    }

    setDirectoryLoading(true);
    try {
      if (isAuthenticated) {
        buildDirectoryEntries(liveEvents);
      } else {
        const allEvents = await eventsLocalStorage.getAll();
        buildDirectoryEntries(allEvents);
      }
    } catch (error) {
      console.error('[AddParticipant] Failed to load directory entries:', error);
    } finally {
      setDirectoryLoading(false);
    }
  }, [isAuthenticated, liveEvents, liveEventsLoading]);

  useFocusEffect(
    useCallback(() => {
      loadDirectoryEntries();
    }, [loadDirectoryEntries])
  );

  useEffect(() => {
    loadDirectoryEntries();
  }, [loadDirectoryEntries]);

  useEffect(() => {
    if (activeTab !== 'directory') {
      setSelectedDirectoryKeys(new Set());
      setDirectorySearch('');
    }
  }, [activeTab]);

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

      const participantInput = {
        name: manualName.trim(),
        phone: manualPhone.trim() || undefined,
        email: manualEmail.trim() || undefined,
        availability: {},
        unavailableAllMonth: false,
        source: 'manual' as const,
      };

      const participantId = await eventMutations.addParticipant(eventId!, participantInput);
      await appendParticipantsToLocal([{ id: participantId, ...participantInput }]);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setManualName('');
      setManualPhone('');
      setManualEmail('');
      Alert.alert('Success', `${participantInput.name} has been added`, [
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

  const toggleGroupSelection = (groupId: string) => {
    const nextSelected = new Set(selectedGroupIds);
    if (nextSelected.has(groupId)) {
      nextSelected.delete(groupId);
    } else {
      nextSelected.add(groupId);
    }
    setSelectedGroupIds(nextSelected);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleGroupExpansion = (groupId: string) => {
    setExpandedGroupId(prev => (prev === groupId ? null : groupId));
  };

  const toggleGroupMemberSelection = (groupId: string, name: string) => {
    const key = `${groupId}:${name}`;
    const nextSelected = new Set(selectedGroupMembers);
    if (nextSelected.has(key)) {
      nextSelected.delete(key);
    } else {
      nextSelected.add(key);
    }
    setSelectedGroupMembers(nextSelected);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const selectAllGroupMembers = (groupId: string, names: string[]) => {
    const nextSelected = new Set(selectedGroupMembers);
    names.forEach(name => nextSelected.add(`${groupId}:${name}`));
    setSelectedGroupMembers(nextSelected);
  };

  const clearAllGroupMembers = (groupId: string, names: string[]) => {
    const nextSelected = new Set(selectedGroupMembers);
    names.forEach(name => nextSelected.delete(`${groupId}:${name}`));
    setSelectedGroupMembers(nextSelected);
  };

  const toggleDirectorySelection = (entryKey: string) => {
    const nextSelected = new Set(selectedDirectoryKeys);
    if (nextSelected.has(entryKey)) {
      nextSelected.delete(entryKey);
    } else {
      nextSelected.add(entryKey);
    }
    setSelectedDirectoryKeys(nextSelected);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSaveGroupTemplate = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    try {
      const event = await eventsLocalStorage.getById(eventId!);
      if (!event) return;

      const participantNames = event.participants
        .filter(p => !p.deletedAt)
        .map(p => p.name)
        .filter(Boolean);

      if (participantNames.length === 0) {
        Alert.alert('No Participants', 'Add participants to this event first.');
        return;
      }

      await templatesLocalStorage.add({
        name: groupName.trim(),
        participantNames,
      } as any);

      setGroupName('');
      await loadGroupTemplates();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('[AddParticipant] Failed to save group template:', error);
      Alert.alert('Error', 'Failed to save group. Please try again.');
    }
  };

  const handleAddGroups = async () => {
    if (selectedGroupMembers.size === 0) {
      Alert.alert('Error', 'Please select at least one person');
      return;
    }

    try {
      const event = await eventsLocalStorage.getById(eventId!);
      if (!event) return;

      const selectedTemplates = groupTemplates.filter(t => t.id === expandedGroupId || selectedGroupIds.has(t.id));
      const selectedNames = Array.from(selectedGroupMembers).map(key => key.split(':')[1]);
      const namesFromGroups = selectedNames.length > 0 ? selectedNames : selectedTemplates.flatMap(t => t.participantNames || []);
      const existingEmails = new Set(
        event.participants
          .map(p => p.email?.toLowerCase())
          .filter(Boolean) as string[]
      );
      const existingPhones = new Set(
        event.participants
          .map(p => p.phone?.replace(/\s+/g, ''))
          .filter(Boolean) as string[]
      );
      const existingNames = new Set(event.participants.map(p => p.name.toLowerCase()));

      const newParticipants: Omit<Participant, 'id' | 'createdAt' | 'updatedAt'>[] = namesFromGroups
        .filter(name => name && !existingNames.has(name.toLowerCase()))
        .map(name => ({
          name,
          availability: {},
          unavailableAllMonth: false,
          source: 'manual',
        }))
        .filter(p => {
          if (p.email && existingEmails.has(p.email.toLowerCase())) return false;
          if (p.phone && existingPhones.has(p.phone.replace(/\s+/g, ''))) return false;
          if (existingNames.has(p.name.toLowerCase())) return false;
          return true;
        });

      if (newParticipants.length === 0) {
        Alert.alert('No New Participants', 'All group members are already in this event.');
        return;
      }

      const savedParticipants: Participant[] = [];
      for (const participant of newParticipants) {
        const participantId = await eventMutations.addParticipant(eventId!, participant);
        savedParticipants.push({ id: participantId, ...participant });
      }
      await appendParticipantsToLocal(savedParticipants);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      console.error('[AddParticipant] Failed to add group participants:', error);
      Alert.alert('Error', 'Failed to add group participants. Please try again.');
    }
  };

  const handleAddFromDirectory = async () => {
    if (selectedDirectoryKeys.size === 0) {
      Alert.alert('Error', 'Please select at least one participant');
      return;
    }

    try {
      const event = await eventsLocalStorage.getById(eventId!);
      if (!event) return;

      const existingEmails = new Set(
        event.participants
          .map(p => p.email?.toLowerCase())
          .filter(Boolean) as string[]
      );
      const existingNames = new Set(event.participants.map(p => p.name.toLowerCase()));

      const selectedEntries = directoryEntries.filter(entry => selectedDirectoryKeys.has(entry.key));
      const newParticipants: Omit<Participant, 'id' | 'createdAt' | 'updatedAt'>[] = selectedEntries
        .filter(entry => {
          if (entry.email && existingEmails.has(entry.email.toLowerCase())) return false;
          if (existingNames.has(entry.name.toLowerCase())) return false;
          return true;
        })
        .map(entry => ({
          name: entry.name,
          phone: entry.phone,
          email: entry.email,
          availability: {},
          unavailableAllMonth: false,
          source: 'manual',
        }));

      if (newParticipants.length === 0) {
        Alert.alert('No New Participants', 'All selected participants are already in this event.');
        return;
      }

      const savedParticipants: Participant[] = [];
      for (const participant of newParticipants) {
        const participantId = await eventMutations.addParticipant(eventId!, participant);
        savedParticipants.push({ id: participantId, ...participant });
      }
      await appendParticipantsToLocal(savedParticipants);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      console.error('[AddParticipant] Failed to add directory participants:', error);
      Alert.alert('Error', 'Failed to add participants. Please try again.');
    }
  };

  const handleAddSelected = async () => {
    if (selectedNames.size === 0) {
      Alert.alert('Error', 'Please select at least one name');
      return;
    }

    try {
      const newParticipants: Omit<Participant, 'id' | 'createdAt' | 'updatedAt'>[] = Array.from(selectedNames).map(nameData => {
        // Parse name, phone, and email if from contacts (format: "Name|Phone|Email")
        const parts = nameData.split('|');
        const name = parts[0];
        const phone = parts.length > 1 ? parts[1] : undefined;
        const email = parts.length > 2 ? parts[2] : undefined;
        
        console.log('[AddParticipant] Adding:', { name, phone, email });
        
        return {
          name,
          availability: {},
          unavailableAllMonth: false,
          source: activeTab === 'contacts' ? 'contacts' : 'ai',
          phone,
          email,
        };
      });
      const savedParticipants: Participant[] = [];
      for (const participant of newParticipants) {
        const participantId = await eventMutations.addParticipant(eventId!, participant);
        savedParticipants.push({ id: participantId, ...participant });
      }
      await appendParticipantsToLocal(savedParticipants);

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
        {eventName ? (
          <ThemedText style={[styles.headerSubtitle, { color: textSecondaryColor }]}>
            {eventName}
          </ThemedText>
        ) : null}
        <View style={{ width: 28 }} />
      </View>

      {/* Segmented Control */}
      <View style={[styles.segmentedControl, { backgroundColor: surfaceColor }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.segmentedControlContent}
        >
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
          <Pressable
            style={[
              styles.segment,
              activeTab === 'groups' && [styles.segmentActive, { backgroundColor: tintColor }],
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('groups');
            }}
          >
            <ThemedText
              style={[
                styles.segmentText,
                activeTab === 'groups' && styles.segmentTextActive,
              ]}
            >
              Groups
            </ThemedText>
          </Pressable>
          <Pressable
            style={[
              styles.segment,
              activeTab === 'directory' && [styles.segmentActive, { backgroundColor: tintColor }],
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('directory');
            }}
          >
            <ThemedText
              style={[
                styles.segmentText,
                activeTab === 'directory' && styles.segmentTextActive,
              ]}
            >
              Directory
            </ThemedText>
          </Pressable>
        </ScrollView>
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

            <View style={styles.directorySection}>
              <ThemedText type="defaultSemiBold" style={styles.label}>
                Add from existing participants
              </ThemedText>
              <ThemedText style={[styles.hint, { color: textSecondaryColor }]}>
                Pick people already used in other events
              </ThemedText>
              <TextInput
                style={[
                  styles.searchInput,
                  {
                    backgroundColor: surfaceColor,
                    color: textColor,
                  },
                ]}
                placeholder="Search participant directory..."
                placeholderTextColor={textSecondaryColor}
                value={directorySearch}
                onChangeText={setDirectorySearch}
              />
              {directoryLoading ? (
                <ActivityIndicator color={tintColor} style={{ marginTop: 12 }} />
              ) : directoryEntries.length === 0 ? (
                <ThemedText style={[styles.hint, { color: textSecondaryColor, marginTop: 12 }]}>
                  No participants found yet. Add someone to any event first.
                </ThemedText>
              ) : (
                <>
                  <View style={styles.namesList}>
                    {directoryEntries
                      .filter(entry =>
                        entry.name.toLowerCase().includes(directorySearch.toLowerCase()) ||
                        entry.email?.toLowerCase().includes(directorySearch.toLowerCase()) ||
                        entry.phone?.toLowerCase().includes(directorySearch.toLowerCase())
                      )
                      .map(entry => {
                        const isSelected = selectedDirectoryKeys.has(entry.key);
                        return (
                          <Pressable
                            key={entry.key}
                            style={[
                              styles.nameChip,
                              {
                                backgroundColor: isSelected ? tintColor : surfaceColor,
                              },
                            ]}
                            onPress={() => toggleDirectorySelection(entry.key)}
                          >
                            <ThemedText
                              style={[
                                styles.nameChipText,
                                isSelected && styles.nameChipTextSelected,
                              ]}
                            >
                              {entry.name}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                  </View>
                  {selectedDirectoryKeys.size > 0 && (
                    <Pressable
                      style={[styles.actionButton, { backgroundColor: successColor }]}
                      onPress={handleAddFromDirectory}
                    >
                      <ThemedText style={styles.actionButtonText}>
                        Add {selectedDirectoryKeys.size} Selected
                      </ThemedText>
                    </Pressable>
                  )}
                </>
              )}
            </View>
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
        ) : activeTab === 'groups' ? (
          <View style={styles.groupsTab}>
            <ThemedText type="defaultSemiBold" style={styles.label}>
              Save This Event as a Group
            </ThemedText>
            <ThemedText style={[styles.hint, { color: textSecondaryColor }]}>
              Give this participant list a name so you can reuse it later
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: surfaceColor,
                  color: textColor,
                },
              ]}
              placeholder="e.g., Guru Breakfast"
              placeholderTextColor={textSecondaryColor}
              value={groupName}
              onChangeText={setGroupName}
            />
            <Pressable
              style={[styles.actionButton, { backgroundColor: tintColor }]}
              onPress={handleSaveGroupTemplate}
            >
              <ThemedText style={styles.actionButtonText}>
                Save Group
              </ThemedText>
            </Pressable>

            <View style={{ marginTop: 24 }}>
              <ThemedText type="defaultSemiBold" style={styles.label}>
                Add from Groups
              </ThemedText>
              <View style={{ height: 8 }} />
              <ThemedText style={[styles.hint, { color: textSecondaryColor }]}>
                Tap a group to select it, then add any or all Participants
              </ThemedText>
            </View>

            {groupsLoading ? (
              <ActivityIndicator color={tintColor} style={{ marginTop: 12 }} />
            ) : groupTemplates.length === 0 ? (
              <ThemedText style={[styles.hint, { color: textSecondaryColor, marginTop: 12 }]}>
                No groups yet. Save one above to get started.
              </ThemedText>
            ) : (
              <>
                <View style={[styles.namesList, styles.groupsList]}>
                  {groupTemplates.map(group => {
                    const isSelected = selectedGroupIds.has(group.id);
                    const isExpanded = expandedGroupId === group.id;
                    return (
                      <View key={group.id} style={styles.groupCard}>
                        <Pressable
                          style={[
                            styles.groupRow,
                            {
                              backgroundColor: isSelected ? tintColor + '15' : surfaceColor,
                            },
                          ]}
                          onPress={() => {
                            toggleGroupSelection(group.id);
                            toggleGroupExpansion(group.id);
                          }}
                        >
                          <View style={styles.groupRowContent}>
                            <ThemedText
                              style={[
                                styles.nameChipText,
                                isSelected && styles.nameChipTextSelected,
                              ]}
                            >
                              {group.name} ({group.participantNames?.length || 0})
                            </ThemedText>
                            <ThemedText style={[styles.groupRowHint, { color: textSecondaryColor }]}>
                              Click to view participants
                            </ThemedText>
                          </View>
                        </Pressable>
                        {isExpanded && (
                          <View style={styles.groupMembers}>
                            <View style={styles.groupActions}>
                              <Pressable
                                onPress={() => selectAllGroupMembers(group.id, group.participantNames || [])}
                              >
                                <ThemedText style={{ color: tintColor }}>Select All</ThemedText>
                              </Pressable>
                              <Pressable
                                onPress={() => clearAllGroupMembers(group.id, group.participantNames || [])}
                              >
                                <ThemedText style={{ color: tintColor }}>Clear</ThemedText>
                              </Pressable>
                            </View>
                            {(group.participantNames || []).map(name => {
                              const key = `${group.id}:${name}`;
                              const isMemberSelected = selectedGroupMembers.has(key);
                              return (
                                <Pressable
                                  key={key}
                                  style={[
                                    styles.memberRow,
                                    { backgroundColor: isMemberSelected ? tintColor + '20' : 'transparent' },
                                  ]}
                                  onPress={() => toggleGroupMemberSelection(group.id, name)}
                                >
                                  <View
                                    style={[
                                      styles.memberCheckbox,
                                      isMemberSelected && { backgroundColor: tintColor, borderColor: tintColor },
                                    ]}
                                  />
                                  <ThemedText>{name}</ThemedText>
                                </Pressable>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
                {selectedGroupMembers.size > 0 && (
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: successColor }]}
                    onPress={handleAddGroups}
                  >
                    <ThemedText style={styles.actionButtonText}>
                      Add {selectedGroupMembers.size} Selected
                    </ThemedText>
                  </Pressable>
                )}
              </>
            )}
          </View>
        ) : activeTab === 'directory' ? (
          <View style={styles.directoryTab}>
            <TextInput
              style={[
                styles.searchInput,
                {
                  backgroundColor: surfaceColor,
                  color: textColor,
                },
              ]}
              placeholder="Search participant directory..."
              placeholderTextColor={textSecondaryColor}
              value={directorySearch}
              onChangeText={setDirectorySearch}
            />
            {directoryLoading ? (
              <ActivityIndicator color={tintColor} style={{ marginTop: 12 }} />
            ) : directoryEntries.length === 0 ? (
              <ThemedText style={[styles.hint, { color: textSecondaryColor }]}>
                No participants found yet. Add participants to events first.
              </ThemedText>
            ) : (
              <>
                <View style={styles.namesList}>
                  {directoryEntries
                    .filter(entry =>
                      entry.name.toLowerCase().includes(directorySearch.toLowerCase()) ||
                      entry.email?.toLowerCase().includes(directorySearch.toLowerCase()) ||
                      entry.phone?.toLowerCase().includes(directorySearch.toLowerCase())
                    )
                    .map(entry => {
                      const isSelected = selectedDirectoryKeys.has(entry.key);
                      return (
                        <Pressable
                          key={entry.key}
                          style={[
                            styles.nameChip,
                            {
                              backgroundColor: isSelected ? tintColor : surfaceColor,
                            },
                          ]}
                          onPress={() => toggleDirectorySelection(entry.key)}
                        >
                          <ThemedText
                            style={[
                              styles.nameChipText,
                              isSelected && styles.nameChipTextSelected,
                            ]}
                          >
                            {entry.name}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                </View>
                {selectedDirectoryKeys.size > 0 && (
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: successColor }]}
                    onPress={handleAddFromDirectory}
                  >
                    <ThemedText style={styles.actionButtonText}>
                      Add {selectedDirectoryKeys.size} Selected
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
  headerSubtitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 48,
    textAlign: 'center',
    fontSize: 12,
  },
  segmentedControl: {
    flexDirection: 'row',
    margin: 16,
    padding: 4,
    borderRadius: 12,
  },
  segmentedControlContent: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  segment: {
    minWidth: 90,
    paddingVertical: 10,
    paddingHorizontal: 12,
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
  directorySection: {
    marginTop: 24,
    gap: 12,
  },
  contactsTab: {
    gap: 16,
  },
  aiTab: {
    gap: 16,
  },
  groupsTab: {
    gap: 16,
  },
  groupCard: {
    width: '100%',
    gap: 8,
  },
  groupRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    width: '100%',
  },
  groupRowContent: {
    gap: 2,
  },
  groupRowHint: {
    fontSize: 12,
    lineHeight: 16,
  },
  groupMembers: {
    paddingLeft: 8,
    gap: 6,
  },
  groupActions: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 6,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  memberCheckbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  directoryTab: {
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
  groupsList: {
    marginTop: 12,
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
