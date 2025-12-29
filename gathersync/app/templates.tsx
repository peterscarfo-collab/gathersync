import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DesktopLayout } from '@/components/desktop-layout';
import { useThemeColor } from '@/hooks/use-theme-color';
import { eventsLocalStorage } from '@/lib/local-storage';
import type { Event } from '@/types/models';

export default function TemplatesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');

  const loadEvents = async () => {
    try {
      const loadedEvents = await eventsLocalStorage.getAll();
      // Filter out archived events
      const activeEvents = loadedEvents.filter(e => !e.archived);
      // Sort by most recently updated
      activeEvents.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setEvents(activeEvents);
    } catch (error) {
      console.error('[TemplatesScreen] Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [])
  );

  const handleCreateFromTemplate = (templateEvent: Event) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Navigate to create-event screen with template data
    router.push({
      pathname: '/create-event' as any,
      params: {
        copyFrom: templateEvent.id,
        name: templateEvent.name,
        teamLeader: templateEvent.teamLeader || '',
        meetingType: templateEvent.meetingType || 'in-person',
        venueName: templateEvent.venueName || '',
        venueContact: templateEvent.venueContact || '',
        venuePhone: templateEvent.venuePhone || '',
        meetingLink: templateEvent.meetingLink || '',
        rsvpDeadline: templateEvent.rsvpDeadline || '',
        meetingNotes: templateEvent.meetingNotes || '',
        participants: JSON.stringify(templateEvent.participants),
      },
    });
  };

  const renderTemplateCard = ({ item }: { item: Event }) => (
    <Pressable
      style={[styles.card, { backgroundColor: backgroundColor }]}
      onPress={() => handleCreateFromTemplate(item)}
    >
      <View style={styles.cardHeader}>
        <ThemedText type="subtitle">{item.name}</ThemedText>
        <IconSymbol name="chevron.right" size={20} color={textSecondaryColor} />
      </View>
      
      <View style={styles.cardInfo}>
        <View style={styles.infoRow}>
          <IconSymbol name="person.2" size={16} color={textSecondaryColor} />
          <ThemedText style={[styles.infoText, { color: textSecondaryColor }]}>
            {item.participants.length} participants
          </ThemedText>
        </View>
        
        {item.eventType === 'fixed' && item.fixedDate && (
          <View style={styles.infoRow}>
            <IconSymbol name="calendar" size={16} color={textSecondaryColor} />
            <ThemedText style={[styles.infoText, { color: textSecondaryColor }]}>
              Fixed event
            </ThemedText>
          </View>
        )}
        
        {item.eventType === 'flexible' && (
          <View style={styles.infoRow}>
            <IconSymbol name="calendar" size={16} color={textSecondaryColor} />
            <ThemedText style={[styles.infoText, { color: textSecondaryColor }]}>
              Flexible event
            </ThemedText>
          </View>
        )}
      </View>
      
      <View style={[styles.createButton, { backgroundColor: tintColor + '15' }]}>
        <IconSymbol name="doc.on.doc" size={18} color={tintColor} />
        <ThemedText style={[styles.createButtonText, { color: tintColor }]}>
          Create from Template
        </ThemedText>
      </View>
    </Pressable>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <IconSymbol name="doc.on.doc" size={64} color={textSecondaryColor} />
      <ThemedText type="subtitle" style={styles.emptyTitle}>
        No Templates Yet
      </ThemedText>
      <ThemedText style={[styles.emptyText, { color: textSecondaryColor }]}>
        Create some events first, then use them as templates to quickly create similar events.
      </ThemedText>
    </View>
  );

  return (
    <DesktopLayout>
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
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <IconSymbol name="chevron.left" size={24} color={tintColor} />
        </Pressable>
        <ThemedText type="title">Templates</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={renderTemplateCard}
        contentContainerStyle={events.length === 0 ? styles.listContentEmpty : styles.listContent}
        ListEmptyComponent={renderEmpty}
      />
    </ThemedView>
    </DesktopLayout>
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
  backButton: {
    padding: 4,
  },
  listContent: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 100,
    gap: 12,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    marginTop: 24,
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardInfo: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
});
