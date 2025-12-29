import { useState, useEffect } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, View, ActivityIndicator } from 'react-native';
import * as Contacts from 'expo-contacts';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

interface ContactPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (contact: { name: string; phone?: string }) => void;
  title?: string;
}

export function ContactPickerModal({ visible, onClose, onSelect, title = 'Select Contact' }: ContactPickerModalProps) {
  const [contacts, setContacts] = useState<Contacts.Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contacts.Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const surfaceColor = useThemeColor({}, 'surface');
  const textColor = useThemeColor({}, 'text');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');

  useEffect(() => {
    if (visible) {
      loadContacts();
    }
  }, [visible]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      setFilteredContacts(
        contacts.filter(contact => {
          const name = contact.name?.toLowerCase() || '';
          // Support partial word matching - split query into words
          const queryWords = query.split(/\s+/);
          // Match if any word in the name contains any query word
          return queryWords.every(queryWord =>
            name.split(/\s+/).some(nameWord => nameWord.includes(queryWord))
          );
        })
      );
    } else {
      setFilteredContacts(contacts);
    }
  }, [searchQuery, contacts]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow access to contacts to use this feature.');
        onClose();
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.FirstName, Contacts.Fields.LastName, Contacts.Fields.PhoneNumbers],
      });

      // Build display name from available fields
      const contactsWithNames = data
        .map(contact => {
          // Try to get the best available name
          let displayName = contact.name;
          if (!displayName && (contact.firstName || contact.lastName)) {
            displayName = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
          }
          return { ...contact, name: displayName };
        })
        .filter(contact => contact.name) // Only filter out if no name at all
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      console.log('[ContactPicker] Loaded contacts:', contactsWithNames.length, 'total');
      setContacts(contactsWithNames);
      setFilteredContacts(contactsWithNames);
    } catch (error) {
      console.error('Failed to load contacts:', error);
      Alert.alert('Error', 'Failed to load contacts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectContact = (contact: Contacts.Contact) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const phone = contact.phoneNumbers && contact.phoneNumbers.length > 0
      ? contact.phoneNumbers[0].number
      : undefined;

    onSelect({
      name: contact.name || '',
      phone,
    });
    setSearchQuery('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <ThemedView style={[styles.container, { backgroundColor }]}>
        <View style={[styles.header, { borderBottomColor: surfaceColor }]}>
          <ThemedText type="subtitle">{title}</ThemedText>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSearchQuery('');
              onClose();
            }}
            hitSlop={8}
          >
            <IconSymbol name="xmark" size={24} color={tintColor} />
          </Pressable>
        </View>

        <View style={styles.searchContainer}>
          <IconSymbol name="magnifyingglass" size={20} color={textSecondaryColor} />
          <TextInput
            style={[styles.searchInput, { color: textColor }]}
            placeholder="Search contacts..."
            placeholderTextColor={textSecondaryColor}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => setSearchQuery('')}
              hitSlop={8}
            >
              <IconSymbol name="xmark" size={16} color={textSecondaryColor} />
            </Pressable>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={tintColor} />
            <ThemedText style={[styles.loadingText, { color: textSecondaryColor }]}>
              Loading contacts...
            </ThemedText>
          </View>
        ) : (
          <ScrollView style={styles.contactsList}>
            {filteredContacts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <IconSymbol name="person.2.fill" size={48} color={textSecondaryColor} />
                <ThemedText style={[styles.emptyText, { color: textSecondaryColor }]}>
                  {searchQuery ? 'No contacts found' : 'No contacts available'}
                </ThemedText>
              </View>
            ) : (
              filteredContacts.map((contact, index) => (
                <Pressable
                  key={`${contact.name}-${index}`}
                  style={[styles.contactItem, { backgroundColor: surfaceColor }]}
                  onPress={() => handleSelectContact(contact)}
                >
                  <View style={styles.contactInfo}>
                    <ThemedText type="defaultSemiBold">{contact.name}</ThemedText>
                    {contact.phoneNumbers && contact.phoneNumbers.length > 0 && (
                      <ThemedText style={[styles.contactPhone, { color: textSecondaryColor }]}>
                        {contact.phoneNumbers[0].number}
                      </ThemedText>
                    )}
                  </View>
                  <IconSymbol name="chevron.right" size={20} color={textSecondaryColor} />
                </Pressable>
              ))
            )}
          </ScrollView>
        )}
      </ThemedView>
    </Modal>
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
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    lineHeight: 20,
  },
  contactsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  contactInfo: {
    flex: 1,
  },
  contactPhone: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 24,
  },
});
