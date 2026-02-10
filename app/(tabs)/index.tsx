/**
 * Events Screen - Real-time sync version with InstantDB
 * Shows all events with automatic real-time updates
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DesktopLayout } from '@/components/desktop-layout';
import { EventCard } from '@/components/event-card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SyncStatusBadge } from '@/components/sync-status-badge';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/auth-context';
import { useEvents } from '@/hooks/use-instant-events';
import { eventMutations } from '@/lib/instant-mutations';
import { eventsLocalStorage } from '@/lib/local-storage';
import type { Event } from '@/types/models';

export default function EventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  
  // Real-time events from InstantDB
  const { events: allEvents, isLoading, error } = useEvents();
  
  const [showLoginBanner, setShowLoginBanner] = useState(true);
  const [fallbackEvents, setFallbackEvents] = useState<Event[]>([]);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [localEvents, setLocalEvents] = useState<Event[]>([]);

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');

  // Filter out deleted events
  const events = allEvents.filter(e => !e.deletedAt);
  const dedupedFallbackEvents = useMemo(() => {
    if (!fallbackEvents.length) return fallbackEvents;

    const bySignature = new Map<string, Event>();
    for (const event of fallbackEvents) {
      const signature = [
        event.name,
        event.eventType,
        event.month,
        event.year,
        event.fixedDate,
        event.fixedTime,
      ].join('|');

      const existing = bySignature.get(signature);
      if (!existing) {
        bySignature.set(signature, event);
        continue;
      }

      const existingUpdated = new Date(existing.updatedAt).getTime();
      const candidateUpdated = new Date(event.updatedAt).getTime();
      if (candidateUpdated >= existingUpdated) {
        bySignature.set(signature, event);
      }
    }

    return Array.from(bySignature.values());
  }, [fallbackEvents]);

  const mergeEvents = (primary: Event[], secondary: Event[]) => {
    if (secondary.length === 0) return primary;
    const byId = new Map<string, Event>();

    for (const event of [...primary, ...secondary]) {
      const existing = byId.get(event.id);
      if (!existing) {
        byId.set(event.id, event);
        continue;
      }

      const existingUpdated = new Date(existing.updatedAt).getTime();
      const candidateUpdated = new Date(event.updatedAt).getTime();
      if (candidateUpdated >= existingUpdated) {
        byId.set(event.id, event);
      }
    }

    return Array.from(byId.values());
  };

  const displayEvents = error
    ? dedupedFallbackEvents
    : mergeEvents(events, localEvents);

  useEffect(() => {
    let isMounted = true;
    if (!error) return () => {
      isMounted = false;
    };

    const loadFallbackEvents = async () => {
      try {
        setFallbackLoading(true);
        const localEvents = await eventsLocalStorage.getAll();
        if (isMounted) {
          setFallbackEvents(localEvents);
        }
      } catch (fallbackError) {
        console.error('[EventsScreen] Failed to load fallback events:', fallbackError);
      } finally {
        if (isMounted) {
          setFallbackLoading(false);
        }
      }
    };

    loadFallbackEvents();

    return () => {
      isMounted = false;
    };
  }, [error]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const loadLocalEvents = async () => {
        try {
          const storedEvents = await eventsLocalStorage.getAll();
          const activeEvents = storedEvents.filter(eventItem => !eventItem.deletedAt);
          if (isActive) {
            setLocalEvents(activeEvents);
          }
        } catch (loadError) {
          console.error('[EventsScreen] Failed to load local events:', loadError);
        }
      };

      loadLocalEvents();

      return () => {
        isActive = false;
      };
    }, [])
  );

  useEffect(() => {
    eventsLocalStorage.dedupeBySignature().catch((dedupeError) => {
      console.error('[EventsScreen] Failed to dedupe local events:', dedupeError);
    });
  }, []);

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      Alert.alert(
        'Delete Event',
        'Are you sure you want to delete this event?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await eventMutations.deleteEvent(eventId);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            },
          },
        ]
      );
    } catch (error) {
      console.error('[EventsScreen] Failed to delete event:', error);
      Alert.alert('Error', 'Failed to delete event');
    }
  };

  const renderEvent = ({ item }: { item: Event }) => (
    <EventCard
      event={item}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/event-detail?eventId=${item.id}`);
      }}
      onEdit={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/edit-meeting-details?eventId=${item.id}`);
      }}
      onDelete={() => handleDeleteEvent(item.id)}
    />
  );

  const renderLoginBanner = () => {
    if (isAuthenticated || !showLoginBanner) return null;

    return (
      <ThemedView style={[styles.loginBanner, { backgroundColor: tintColor + '10' }]}>
        <View style={styles.loginBannerContent}>
          <IconSymbol name="info.circle" size={20} color={tintColor} style={styles.loginBannerIcon} />
          <ThemedText style={[styles.loginBannerText, { color: textSecondaryColor }]}>
            Log in to sync your events across devices
          </ThemedText>
        </View>
        <View style={styles.loginBannerActions}>
          <Pressable
            style={[styles.loginButton, { backgroundColor: tintColor }]}
            onPress={() => router.push('/login')}
          >
            <ThemedText style={styles.loginButtonText}>Log In</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setShowLoginBanner(false)}
            hitSlop={8}
          >
            <IconSymbol name="xmark" size={16} color={textSecondaryColor} />
          </Pressable>
        </View>
      </ThemedView>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <IconSymbol name="calendar" size={64} color={textSecondaryColor} style={styles.emptyIcon} />
      <ThemedText style={styles.emptyTitle}>No Events Yet</ThemedText>
      <ThemedText style={[styles.emptyText, { color: textSecondaryColor }]}>
        Create your first event to start finding the perfect date for your gathering.
      </ThemedText>
      <Pressable
        style={[styles.createButton, { backgroundColor: tintColor }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/create-event');
        }}
      >
        <IconSymbol name="plus" size={20} color="#fff" style={styles.createButtonIcon} />
        <ThemedText style={styles.createButtonText}>Create Event</ThemedText>
      </Pressable>
    </View>
  );

  const renderListHeader = () => (
    <>
      {error && dedupedFallbackEvents.length > 0 ? (
        <ThemedView style={[styles.warningBanner, { backgroundColor: tintColor + '10' }]}>
          <IconSymbol name="exclamationmark.triangle.fill" size={16} color={tintColor} />
          <ThemedText style={[styles.warningText, { color: textSecondaryColor }]}>
            Showing local events while cloud sync recovers.
          </ThemedText>
        </ThemedView>
      ) : null}
      {renderLoginBanner()}
    </>
  );

  const renderContent = () => {
    if (!isAuthenticated) {
      return (
        <>
          {renderLoginBanner()}
          {renderEmptyState()}
        </>
      );
    }

    if (authLoading || isLoading || (error && fallbackLoading)) {
      return (
        <View style={styles.loadingContainer}>
          <ThemedText>Loading events...</ThemedText>
        </View>
      );
    }

    if (error && dedupedFallbackEvents.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <ThemedText style={{ color: '#ff4444' }}>Error loading events</ThemedText>
          <ThemedText style={{ color: textSecondaryColor }}>{String(error)}</ThemedText>
        </View>
      );
    }

    return (
      <FlatList
        data={displayEvents}
        renderItem={renderEvent}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={[
          styles.listContent,
          displayEvents.length === 0 && styles.listContentEmpty,
        ]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    );
  };

  return (
    <DesktopLayout>
      <ThemedView style={[styles.container, { backgroundColor }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View style={styles.headerLeft}>
            <ThemedText style={styles.headerTitle}>Events</ThemedText>
            <ThemedText style={[styles.headerSubtitle, { color: textSecondaryColor }]}>
              {displayEvents.length}/5 events
            </ThemedText>
          </View>
          <SyncStatusBadge />
        </View>

        {renderContent()}

        <Pressable
          style={[
            styles.fab,
            { backgroundColor: tintColor, bottom: insets.bottom + 24 },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/create-event');
          }}
        >
          <IconSymbol name="plus" size={24} color="#fff" />
        </Pressable>
      </ThemedView>
    </DesktopLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#00000010',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContent: {
    padding: 20,
  },
  listContentEmpty: {
    flex: 1,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 13,
  },
  separator: {
    height: 16,
  },
  loginBanner: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  loginBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loginBannerIcon: {
    marginTop: 2,
  },
  loginBannerText: {
    flex: 1,
    fontSize: 14,
  },
  loginBannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loginButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    marginBottom: 20,
    opacity: 0.3,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  createButtonIcon: {
    marginTop: -2,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
