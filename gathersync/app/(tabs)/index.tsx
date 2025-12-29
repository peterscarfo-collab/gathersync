import { useState, useCallback } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DesktopLayout } from '@/components/desktop-layout';
import { EventCard } from '@/components/event-card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { OnboardingModal } from '@/components/onboarding-modal';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/use-auth';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { eventsLocalStorage } from '@/lib/local-storage';
import { recurringTemplatesStorage } from '@/lib/recurring-storage';
import { syncService } from '@/lib/sync-service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { exportBackup, downloadBackup, importBackup, readBackupFile, getBackupStats } from '@/lib/backup';
import * as DocumentPicker from 'expo-document-picker';
import { generateEventFromTemplate, shouldGenerateForMonth } from '@/lib/recurring-generator';
import { getLoginUrl } from '@/constants/oauth';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import type { Event } from '@/types/models';

export default function EventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { syncStatus, isOnline, createEvent: autoCreateEvent, updateEvent: autoUpdateEvent, deleteEvent: autoDeleteEvent, bidirectionalSync } = useAutoSync();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showLoginBanner, setShowLoginBanner] = useState(true);
  const [showBackupMenu, setShowBackupMenu] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');

  const loadEvents = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      }
      console.log('[EventsScreen] Loading events...');
      
      // Bidirectional sync on launch when authenticated
      if (isAuthenticated && !authLoading) {
        console.log('[EventsScreen] Running bidirectional sync...');
        try {
          await bidirectionalSync();
          console.log('[EventsScreen] Bidirectional sync complete');
        } catch (syncError) {
          console.error('[EventsScreen] Bidirectional sync failed:', syncError);
          // Don't block loading if sync fails
        }
      }
      
      // Check for recurring templates and generate events if needed
      const templates = await recurringTemplatesStorage.getAll();
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();

      for (const template of templates) {
        if (shouldGenerateForMonth(template, currentMonth, currentYear)) {
          console.log('[EventsScreen] Generating event from template:', template.name);
          const newEvent = generateEventFromTemplate(template, currentMonth, currentYear);
          await eventsLocalStorage.add(newEvent);
          
          // Update template's lastGeneratedMonth
          await recurringTemplatesStorage.update(template.id, {
            lastGeneratedMonth: `${currentYear}-${String(currentMonth).padStart(2, '0')}`,
          });
        }
      }
      
      const loadedEvents = await eventsLocalStorage.getAll();
      console.log('[EventsScreen] Loaded', loadedEvents.length, 'events');
      // Filter out archived events from main list
      const activeEvents = loadedEvents.filter(e => !e.archived);
      // Sort by date (chronological order)
      activeEvents.sort((a, b) => {
        // Fixed events: sort by fixedDate and fixedTime
        if (a.eventType === 'fixed' && b.eventType === 'fixed') {
          const dateA = new Date(a.fixedDate + 'T' + a.fixedTime);
          const dateB = new Date(b.fixedDate + 'T' + b.fixedTime);
          return dateA.getTime() - dateB.getTime();
        }
        // Flexible events: sort by year and month
        if (a.eventType === 'flexible' && b.eventType === 'flexible') {
          if (a.year !== b.year) return a.year - b.year;
          return a.month - b.month;
        }
        // Mixed: fixed events come before flexible events with same year/month
        if (a.eventType === 'fixed') {
          const dateA = new Date(a.fixedDate + 'T' + a.fixedTime);
          const dateB = new Date(b.year, b.month - 1, 15); // Mid-month for comparison
          return dateA.getTime() - dateB.getTime();
        }
        // b is fixed, a is flexible
        const dateA = new Date(a.year, a.month - 1, 15);
        const dateB = new Date(b.fixedDate + 'T' + b.fixedTime);
        return dateA.getTime() - dateB.getTime();
      });
      setEvents(activeEvents);
    } catch (error) {
      console.error('[EventsScreen] Failed to load events:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadEvents(true);
  };

  useFocusEffect(
    useCallback(() => {
      loadEvents();
      
      // Check if this is the first launch
      AsyncStorage.getItem('hasSeenOnboarding').then((value) => {
        if (!value) {
          setShowOnboarding(true);
        }
      });
      
      // Check for loginSuccess parameter (from OAuth redirect)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('loginSuccess') === 'true') {
          console.log('[EventsScreen] Login success detected, refreshing auth...');
          // Remove the parameter from URL
          window.history.replaceState({}, '', window.location.pathname);
          // Force auth refresh
          setTimeout(() => {
            window.location.reload();
          }, 500);
        }
      }
    }, [])
  );

  const handleCreateEvent = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Check event limit based on subscription tier
    const tier = (user?.subscriptionTier || 'free') as 'free' | 'lite' | 'pro' | 'enterprise';
    const isPro = tier === 'pro' || user?.isLifetimePro;
    const isLite = tier === 'lite';
    
    console.log('[CreateEvent] User subscription check:', {
      subscriptionTier: tier,
      isLifetimePro: user?.isLifetimePro,
      isPro,
      isLite,
      eventsCount: events.length
    });
    
    // Free tier: 5 events max
    if (tier === 'free' && events.length >= 5) {
      Alert.alert(
        'Event Limit Reached',
        'Free users can create up to 5 events. Upgrade to Lite (50 events) or Pro (unlimited)!',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View Plans', onPress: () => router.push('/pricing' as any) },
        ]
      );
      return;
    }
    
    // Lite tier: 50 events max
    if (isLite && events.length >= 50) {
      Alert.alert(
        'Event Limit Reached',
        'Lite users can create up to 50 events. Upgrade to Pro for unlimited events!',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade to Pro', onPress: () => router.push('/pricing' as any) },
        ]
      );
      return;
    }
    
    // Pro tier: unlimited events
    router.push('/create-event' as any);
  };

  const handleEventPress = (event: Event) => {
    router.push({
      pathname: '/event-detail' as any,
      params: { eventId: event.id },
    });
  };

  const handleDiagnostic = async () => {
    try {
      console.log('[Diagnostic] Starting storage diagnostic...');
      setShowBackupMenu(false);
      
      // List all AsyncStorage keys
      const allKeys = await AsyncStorage.getAllKeys();
      console.log('[Diagnostic] All AsyncStorage keys:', allKeys);
      
      // Try reading from all possible event storage keys
      const keys = [
        '@gathersync_events',
        'events',
        'gathersync_events',
        '@events',
      ];
      
      let diagnosticInfo = `Storage Diagnostic:\n\nAll Keys (${allKeys.length}):\n${allKeys.join('\n')}\n\n`;
      
      for (const key of keys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            const count = Array.isArray(parsed) ? parsed.length : 'not an array';
            diagnosticInfo += `Key "${key}": ${count} items\n`;
            console.log(`[Diagnostic] Found data at key "${key}":`, count);
          } catch {
            diagnosticInfo += `Key "${key}": found but not JSON\n`;
          }
        } else {
          diagnosticInfo += `Key "${key}": empty\n`;
        }
      }
      
      // Check what eventsLocalStorage.getAll() returns
      const hybridEvents = await eventsLocalStorage.getAll();
      diagnosticInfo += `\nHybrid Storage: ${hybridEvents.length} events\n`;
      console.log('[Diagnostic] Hybrid storage returned:', hybridEvents.length, 'events');
      
      // Check auth state
      diagnosticInfo += `\nAuth State:\nAuthenticated: ${isAuthenticated}\nUser: ${user?.email || 'none'}\n`;
      
      alert(diagnosticInfo);
    } catch (error) {
      console.error('[Diagnostic] Failed:', error);
      alert(`Diagnostic failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleMigrateToCloud = async () => {
    try {
      console.log('[Migrate] Starting migration to cloud...');
      setShowBackupMenu(false);
      
      if (!isAuthenticated) {
        alert('Please log in first to migrate data to cloud.');
        return;
      }
      
      // Create automatic backup before migration
      const { createAutoBackup } = await import('@/lib/auto-backup');
      try {
        await createAutoBackup('Before cloud migration');
        console.log('[Migrate] Automatic backup created');
      } catch (backupError) {
        console.error('[Migrate] Failed to create backup:', backupError);
        if (!confirm('Failed to create safety backup. Continue anyway?')) {
          return;
        }
      }
      
      // Get all events from hybrid storage
      const localEvents = await eventsLocalStorage.getAll();
      console.log('[Migrate] Found', localEvents.length, 'events to migrate');
      
      if (localEvents.length === 0) {
        alert('No events found to migrate.');
        return;
      }
      
      // Import cloud storage directly
      const { eventsCloudStorage } = await import('@/lib/cloud-storage');
      
      let migrated = 0;
      let errors = 0;
      
      for (const event of localEvents) {
        try {
          console.log('[Migrate] Uploading event:', event.name);
          
          // Normalize event data - add missing fields with defaults
          const normalizedEvent = {
            ...event,
            // Required fields with defaults
            eventType: event.eventType || 'flexible',
            archived: event.archived || false,
            finalized: event.finalized || false,
            // Optional fields
            fixedDate: event.fixedDate || undefined,
            fixedTime: event.fixedTime || undefined,
            finalizedDate: event.finalizedDate || undefined,
            reminderDaysBefore: event.reminderDaysBefore || undefined,
            reminderScheduled: event.reminderScheduled || false,
            teamLeader: event.teamLeader || undefined,
            teamLeaderPhone: event.teamLeaderPhone || undefined,
            meetingType: event.meetingType || undefined,
            venueName: event.venueName || undefined,
            venueContact: event.venueContact || undefined,
            venuePhone: event.venuePhone || undefined,
            meetingLink: event.meetingLink || undefined,
            rsvpDeadline: event.rsvpDeadline || undefined,
            meetingNotes: event.meetingNotes || undefined,
            // Normalize participants
            participants: event.participants.map(p => ({
              ...p,
              unavailableAllMonth: p.unavailableAllMonth || false,
              notes: p.notes || undefined,
              source: p.source || 'manual',
              phone: p.phone || undefined,
              email: p.email || undefined,
              rsvpStatus: p.rsvpStatus || undefined,
            })),
          };
          
          console.log('[Migrate] Normalized event:', normalizedEvent.name, 'eventType:', normalizedEvent.eventType);
          
          // Delete if exists, then create fresh
          try {
            await eventsCloudStorage.delete(event.id);
          } catch {
            // Ignore if doesn't exist
          }
          await eventsCloudStorage.add(normalizedEvent);
          migrated++;
          console.log('[Migrate] Successfully uploaded:', event.name);
        } catch (error) {
          console.error('[Migrate] Failed to upload event:', event.name, error);
          errors++;
        }
      }
      
      if (errors === 0) {
        alert(`Migration complete!\n\n${migrated} events uploaded to cloud.\n\nCheck the Admin dashboard to verify.`);
      } else {
        alert(`Migration completed with errors:\n\nUploaded: ${migrated}\nFailed: ${errors}\n\nCheck console for details.`);
      }
      
      // Reload events
      await loadEvents();
    } catch (error) {
      console.error('[Migrate] Migration failed:', error);
      alert(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleExportBackup = async () => {
    try {
      console.log('[Backup] Starting export...');
      setShowBackupMenu(false);
      
      // Create automatic backup first
      const { createAutoBackup } = await import('@/lib/auto-backup');
      try {
        await createAutoBackup('Before manual export');
        console.log('[Export] Safety backup created');
      } catch (backupError) {
        console.warn('[Export] Failed to create safety backup:', backupError);
      }
      
      const backup = await exportBackup();
      console.log('[Backup] Backup created:', {
        events: backup.events.length,
        snapshots: backup.snapshots.length,
        templates: backup.templates.length,
      });
      
      if (backup.events.length === 0) {
        alert('No data to export. Create some events first!');
        return;
      }
      
      await downloadBackup(backup);
      console.log('[Backup] Download triggered');
      
      alert(`Backup exported successfully!\n\nEvents: ${backup.events.length}\nSnapshots: ${backup.snapshots.length}\nTemplates: ${backup.templates.length}`);
    } catch (error) {
      console.error('[Backup] Export failed:', error);
      alert(`Failed to export backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleImportBackup = async () => {
    try {
      console.log('[Backup] Starting import...');
      setShowBackupMenu(false);
      
      // Create automatic backup before import (in case import fails)
      const { createAutoBackup } = await import('@/lib/auto-backup');
      try {
        await createAutoBackup('Before manual import');
        console.log('[Import] Safety backup created');
      } catch (backupError) {
        console.warn('[Import] Failed to create safety backup:', backupError);
        if (!confirm('Failed to create safety backup. Continue anyway?')) {
          return;
        }
      }
      
      if (Platform.OS === 'web') {
        // Web: use file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.onchange = async (e: any) => {
          const file = e.target.files[0];
          if (!file) return;
          
          const reader = new FileReader();
          reader.onload = async (event) => {
            try {
              const json = event.target?.result as string;
              const backup = JSON.parse(json);
              const stats = getBackupStats(backup);
              
              Alert.alert(
                'Import Backup',
                `Import backup from ${new Date(backup.exportedAt).toLocaleDateString()}?\n\nEvents: ${stats.eventsCount}\nSnapshots: ${stats.snapshotsCount}\nTemplates: ${stats.templatesCount}\n\nThis will replace your current data.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Import',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await importBackup(backup);
                        await loadEvents();
                        Alert.alert('Success', 'Backup imported successfully!');
                        setShowBackupMenu(false);
                      } catch (error) {
                        console.error('[Backup] Import execution failed:', error);
                        Alert.alert('Error', 'Failed to import backup. Please try again.');
                      }
                    },
                  },
                ]
              );
            } catch (error) {
              console.error('[Backup] Import failed:', error);
              alert('Failed to import backup. Please check the file format.');
            }
          };
          reader.readAsText(file);
        };
        input.click();
      } else {
        // Mobile: use document picker
        const result = await DocumentPicker.getDocumentAsync({
          type: 'application/json',
          copyToCacheDirectory: true,
        });
        
        if (result.canceled) return;
        
        const backup = await readBackupFile(result.assets[0].uri);
        const stats = getBackupStats(backup);
        
        Alert.alert(
          'Import Backup',
          `Import backup from ${new Date(backup.exportedAt).toLocaleDateString()}?\n\nEvents: ${stats.eventsCount}\nSnapshots: ${stats.snapshotsCount}\nTemplates: ${stats.templatesCount}\n\nThis will replace your current data.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Import',
              style: 'destructive',
              onPress: async () => {
                try {
                  await importBackup(backup);
                  await loadEvents();
                  Alert.alert('Success', 'Backup imported successfully!');
                  setShowBackupMenu(false);
                } catch (error) {
                  console.error('[Backup] Import execution failed:', error);
                  Alert.alert('Error', 'Failed to import backup. Please try again.');
                }
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('[Backup] Import failed:', error);
      alert('Failed to import backup. Please try again.');
    }
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <IconSymbol name="calendar.badge.plus" size={64} color={tintColor} />
      <ThemedText type="subtitle" style={styles.emptyTitle}>
        No Events Yet
      </ThemedText>
      <ThemedText style={styles.emptyText}>
        Create your first event to start finding the perfect date for your gathering.
      </ThemedText>
      <Pressable
        style={[styles.createButton, { backgroundColor: tintColor }]}
        onPress={handleCreateEvent}
      >
        <IconSymbol name="plus" size={20} color="#FFFFFF" />
        <ThemedText style={styles.createButtonText}>
          Create Event
        </ThemedText>
      </Pressable>
    </View>
  );

  return (
    <DesktopLayout>
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: 16,
          },
        ]}
      >
        <View>
          <ThemedText type="title">Events</ThemedText>
          {(() => {
            const tier = (user?.subscriptionTier || 'free') as 'free' | 'lite' | 'pro' | 'enterprise';
            const isPro = tier === 'pro' || user?.isLifetimePro;
            const isLite = tier === 'lite';
            
            if (isPro) return null; // Pro users have unlimited events
            
            if (isLite) {
              // Lite tier: 50 events max
              return (
                <ThemedText style={[styles.eventCounter, { color: events.length >= 50 ? '#ef4444' : textSecondaryColor }]}>
                  {events.length}/50 events {events.length >= 50 && '• '}
                  {events.length >= 50 && (
                    <ThemedText
                      style={{ color: tintColor, textDecorationLine: 'underline' }}
                      onPress={() => router.push('/pricing' as any)}
                    >
                      Upgrade to Pro
                    </ThemedText>
                  )}
                </ThemedText>
              );
            }
            
            // Free tier: 5 events max
            return (
              <ThemedText style={[styles.eventCounter, { color: events.length >= 5 ? '#ef4444' : textSecondaryColor }]}>
                {events.length}/5 events {events.length >= 5 && '• '}
                {events.length >= 5 && (
                  <ThemedText
                    style={{ color: tintColor, textDecorationLine: 'underline' }}
                    onPress={() => router.push('/pricing' as any)}
                  >
                    View Plans
                  </ThemedText>
                )}
              </ThemedText>
            );
          })()}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            style={[styles.headerButton, { backgroundColor: tintColor + '15' }]}
            onPress={() => setShowBackupMenu(!showBackupMenu)}
          >
            <IconSymbol name="arrow.down.doc" size={20} color={tintColor} />
          </Pressable>
          <Pressable
            style={[styles.templatesButton, { backgroundColor: tintColor + '15' }]}
            onPress={() => router.push('/templates' as any)}
          >
            <IconSymbol name="doc.on.doc" size={20} color={tintColor} />
            <ThemedText style={[styles.templatesButtonText, { color: tintColor }]}>
              Templates
            </ThemedText>
          </Pressable>
        </View>
      </View>

      {showBackupMenu && (
        <View style={[styles.backupMenu, { backgroundColor, borderColor: tintColor + '30' }]}>
          <Pressable
            style={[styles.backupMenuItem, { borderBottomColor: tintColor + '10' }]}
            onPress={handleExportBackup}
          >
            <IconSymbol name="arrow.down.doc" size={20} color={tintColor} />
            <View style={styles.backupMenuItemText}>
              <ThemedText style={styles.backupMenuItemTitle}>Export Backup</ThemedText>
              <ThemedText style={[styles.backupMenuItemDescription, { color: textSecondaryColor }]}>
                Download all your data as JSON
              </ThemedText>
            </View>
          </Pressable>
          <Pressable
            style={[styles.backupMenuItem, { borderBottomColor: tintColor + '10' }]}
            onPress={handleImportBackup}
          >
            <IconSymbol name="arrow.up.doc" size={20} color={tintColor} />
            <View style={styles.backupMenuItemText}>
              <ThemedText style={styles.backupMenuItemTitle}>Import Backup</ThemedText>
              <ThemedText style={[styles.backupMenuItemDescription, { color: textSecondaryColor }]}>
                Restore data from a backup file
              </ThemedText>
            </View>
          </Pressable>
          <Pressable
            style={[styles.backupMenuItem, { borderBottomColor: tintColor + '10' }]}
            onPress={async () => {
              setShowBackupMenu(false);
              try {
                const { removeDuplicateEvents, removeDuplicateRecurringTemplates } = await import('@/lib/cleanup-duplicates');
                
                // Clean up recurring templates first
                const templateResult = await removeDuplicateRecurringTemplates();
                console.log('[Cleanup] Template cleanup:', templateResult);
                
                // Then clean up events
                const eventResult = await removeDuplicateEvents();
                console.log('[Cleanup] Event cleanup:', eventResult);
                
                await loadEvents(); // Reload to show cleaned list
                
                const message = `Cleanup complete!\n\nTemplates:\n  Removed: ${templateResult.removed}\n  Kept: ${templateResult.kept}\n\nEvents:\n  Removed: ${eventResult.removed}\n  Kept: ${eventResult.kept}`;
                alert(message);
              } catch (error) {
                console.error('[Cleanup] Failed:', error);
                alert(`Cleanup failed: ${error}`);
              }
            }}
          >
            <IconSymbol name="trash" size={20} color="#ef4444" />
            <View style={styles.backupMenuItemText}>
              <ThemedText style={[styles.backupMenuItemTitle, { color: '#ef4444' }]}>Remove Duplicates</ThemedText>
              <ThemedText style={[styles.backupMenuItemDescription, { color: textSecondaryColor }]}>
                Clean up duplicate events (keeps oldest)
              </ThemedText>
            </View>
          </Pressable>
          <Pressable
            style={[styles.backupMenuItem, { borderBottomColor: tintColor + '10' }]}
            onPress={handleDiagnostic}
          >
            <IconSymbol name="wrench.and.screwdriver" size={20} color={tintColor} />
            <View style={styles.backupMenuItemText}>
              <ThemedText style={styles.backupMenuItemTitle}>Storage Diagnostic</ThemedText>
              <ThemedText style={[styles.backupMenuItemDescription, { color: textSecondaryColor }]}>
                Debug where your events are stored
              </ThemedText>
            </View>
          </Pressable>
          {isAuthenticated && (
            <Pressable
              style={[styles.backupMenuItem, { borderBottomColor: tintColor + '10' }]}
              onPress={handleMigrateToCloud}
            >
              <IconSymbol name="cloud" size={20} color={tintColor} />
              <View style={styles.backupMenuItemText}>
                <ThemedText style={styles.backupMenuItemTitle}>Migrate to Cloud</ThemedText>
                <ThemedText style={[styles.backupMenuItemDescription, { color: textSecondaryColor }]}>
                  Upload all events to cloud database
                </ThemedText>
              </View>
            </Pressable>
          )}
          <Pressable
            style={styles.backupMenuItem}
            onPress={() => {
              setShowBackupMenu(false);
              router.push('/data-recovery' as any);
            }}
          >
            <IconSymbol name="arrow.triangle.2.circlepath" size={20} color={tintColor} />
            <View style={styles.backupMenuItemText}>
              <ThemedText style={styles.backupMenuItemTitle}>Data Recovery</ThemedText>
              <ThemedText style={[styles.backupMenuItemDescription, { color: textSecondaryColor }]}>
                Restore from automatic backups
              </ThemedText>
            </View>
          </Pressable>
        </View>
      )}

      {!authLoading && !isAuthenticated && showLoginBanner && (
        <View style={[styles.loginBanner, { backgroundColor: tintColor + '10', borderColor: tintColor + '30' }]}>
          <View style={styles.loginBannerContent}>
            <IconSymbol name="cloud" size={20} color={tintColor} />
            <View style={styles.loginBannerText}>
              <ThemedText style={styles.loginBannerTitle}>Cloud Sync Available</ThemedText>
              <ThemedText style={[styles.loginBannerDescription, { color: textSecondaryColor }]}>
                Log in to sync events across devices and share with participants
              </ThemedText>
            </View>
          </View>
          <View style={styles.loginBannerActions}>
            <Pressable
              style={[styles.loginButton, { backgroundColor: tintColor }]}
              onPress={async () => {
                const loginUrl = getLoginUrl();
                if (Platform.OS === 'web') {
                  window.location.href = loginUrl;
                } else {
                  // Mobile: Open OAuth in external browser
                  await WebBrowser.openBrowserAsync(loginUrl);
                }
              }}
            >
              <ThemedText style={styles.loginButtonText}>Log In</ThemedText>
            </Pressable>
            <Pressable
              style={styles.dismissButton}
              onPress={() => setShowLoginBanner(false)}
            >
              <IconSymbol name="xmark" size={16} color={textSecondaryColor} />
            </Pressable>
          </View>
        </View>
      )}

      {!authLoading && isAuthenticated && (
        <View style={[
          styles.syncStatusBanner,
          {
            backgroundColor: syncStatus === 'synced' ? '#10b981' + '10' :
                           syncStatus === 'syncing' ? '#3b82f6' + '10' :
                           syncStatus === 'offline' ? '#6b7280' + '10' :
                           syncStatus === 'error' ? '#ef4444' + '10' : '#10b981' + '10',
            borderColor: syncStatus === 'synced' ? '#10b981' + '30' :
                        syncStatus === 'syncing' ? '#3b82f6' + '30' :
                        syncStatus === 'offline' ? '#6b7280' + '30' :
                        syncStatus === 'error' ? '#ef4444' + '30' : '#10b981' + '30',
          }
        ]}>
          <View style={styles.syncStatusContent}>
            <IconSymbol
              name={
                syncStatus === 'synced' ? 'checkmark.circle.fill' :
                syncStatus === 'syncing' ? 'arrow.triangle.2.circlepath' :
                syncStatus === 'offline' ? 'wifi.slash' :
                syncStatus === 'error' ? 'exclamationmark.triangle.fill' : 'cloud'
              }
              size={18}
              color={
                syncStatus === 'synced' ? '#10b981' :
                syncStatus === 'syncing' ? '#3b82f6' :
                syncStatus === 'offline' ? '#6b7280' :
                syncStatus === 'error' ? '#ef4444' : '#10b981'
              }
            />
            <ThemedText style={[
              styles.syncStatusText,
              {
                color: syncStatus === 'synced' ? '#10b981' :
                      syncStatus === 'syncing' ? '#3b82f6' :
                      syncStatus === 'offline' ? '#6b7280' :
                      syncStatus === 'error' ? '#ef4444' : '#10b981'
              }
            ]}>
              {syncStatus === 'synced' ? 'All changes synced' :
               syncStatus === 'syncing' ? 'Syncing changes...' :
               syncStatus === 'offline' ? 'Offline - changes queued' :
               syncStatus === 'error' ? 'Sync error - retrying...' : 'Cloud sync active'}
            </ThemedText>
          </View>
        </View>
      )}

      {/* Remove duplicate banner code below */}
      {false && !authLoading && !isAuthenticated && showLoginBanner && (
        <View style={[styles.loginBanner, { backgroundColor: tintColor + '10', borderColor: tintColor + '30' }]}>
          <View style={styles.loginBannerContent}>
            <IconSymbol name="cloud" size={20} color={tintColor} />
            <View style={styles.loginBannerText}>
              <ThemedText style={styles.loginBannerTitle}>Cloud Sync Available</ThemedText>
              <ThemedText style={[styles.loginBannerDescription, { color: textSecondaryColor }]}>
                Log in to sync events across devices and share with participants
              </ThemedText>
            </View>
          </View>
          <View style={styles.loginBannerActions}>
            <Pressable
              style={[styles.loginButton, { backgroundColor: tintColor }]}
              onPress={async () => {
                const loginUrl = getLoginUrl();
                if (Platform.OS === 'web') {
                  window.location.href = loginUrl;
                } else {
                  // Mobile: Open OAuth in external browser
                  await WebBrowser.openBrowserAsync(loginUrl);
                }
              }}
            >
              <ThemedText style={styles.loginButtonText}>Log In</ThemedText>
            </Pressable>
            <Pressable
              style={styles.dismissButton}
              onPress={() => setShowLoginBanner(false)}
            >
              <IconSymbol name="xmark" size={16} color={textSecondaryColor} />
            </Pressable>
          </View>
        </View>
      )}

      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <EventCard event={item} onPress={() => handleEventPress(item)} />
        )}
        ListEmptyComponent={loading ? null : renderEmpty}
        contentContainerStyle={[
          styles.listContent,
          events.length === 0 && styles.listContentEmpty,
          Platform.OS === 'web' && styles.listContentWeb,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={tintColor}
          />
        }
        ListFooterComponent={() => (
          <View style={[styles.footer, Platform.OS === 'web' && styles.footerWeb]}>
            <ThemedText style={[styles.footerText, { color: textSecondaryColor }]}>
              © 2025 Peter Scarfo. All rights reserved.
            </ThemedText>
          </View>
        )}
      />

      {events.length > 0 && (
        <Pressable
          style={[
            styles.fab,
            {
              backgroundColor: tintColor,
              bottom: Math.max(insets.bottom, 16) + 60, // 60 for tab bar
            },
          ]}
          onPress={handleCreateEvent}
        >
          <IconSymbol name="plus" size={28} color="#FFFFFF" />
        </Pressable>
      )}

      {/* Onboarding Modal */}
      <OnboardingModal
        visible={showOnboarding}
        onComplete={() => {
          setShowOnboarding(false);
          AsyncStorage.setItem('hasSeenOnboarding', 'true');
        }}
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
  eventCounter: {
    fontSize: 14,
    marginTop: 4,
  },
  listContent: {
    paddingTop: 16,
    paddingBottom: 100,
  },
  listContentWeb: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
    paddingHorizontal: 16,
  } as any,
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
    marginBottom: 32,
    fontSize: 16,
    lineHeight: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    minHeight: 48,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  templatesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  templatesButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 16,
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
  footer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  footerWeb: {
    gridColumn: '1 / -1',
    width: '100%',
  } as any,
  footerText: {
    fontSize: 12,
    lineHeight: 18,
  },
  loginBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  loginBannerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  loginBannerText: {
    flex: 1,
  },
  loginBannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  loginBannerDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  loginBannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loginButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  dismissButton: {
    padding: 8,
  },
  syncStatusBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  syncStatusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncStatusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backupMenu: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  backupMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
  },
  backupMenuItemText: {
    flex: 1,
  },
  backupMenuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  backupMenuItemDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
});
