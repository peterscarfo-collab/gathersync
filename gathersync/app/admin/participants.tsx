import { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Pressable,
  TextInput,
  Platform,
  Share,
  Modal,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/use-auth';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { eventsLocalStorage } from '@/lib/local-storage';
import { eventsCloudStorage } from '@/lib/cloud-storage';
import { trpc } from '@/lib/trpc';
import { AdminColors } from '@/constants/admin-theme';
import {
  addParticipantToInfluencerOutreach,
  findInfluencerProspectForContact,
} from '@/lib/influencer-from-participant';
import { STATUS_LABELS } from '@/lib/influencer-playbook';
import type { Event, InfluencerProspect, Participant } from '@/types/models';

interface EventInfo {
  id: string;
  name: string;
  date: string;
}

interface ParticipantWithEvents {
  name: string;
  phone?: string;
  email?: string;
  designation?: string;
  organization?: string;
  leadSource?: string;
  digitalTwinUrl?: string;
  notes?: string;
  /** Participant id in the Prospects Directory event, when present */
  prospectsDirectoryParticipantId?: string;
  eventCount: number;
  events: EventInfo[];
}

const localeCompare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: 'base' });

const getNameParts = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.length > 1 ? parts[parts.length - 1] : '',
    hasLastName: parts.length > 1,
  };
};

const compareParticipantNames = (a: string, b: string, byLastName: boolean) => {
  if (!byLastName) {
    return localeCompare(a, b);
  }

  const aParts = getNameParts(a);
  const bParts = getNameParts(b);

  if (aParts.hasLastName !== bParts.hasLastName) {
    return aParts.hasLastName ? -1 : 1;
  }

  if (aParts.hasLastName && bParts.hasLastName) {
    const lastNameCompare = localeCompare(aParts.lastName, bParts.lastName);
    if (lastNameCompare !== 0) return lastNameCompare;
    return localeCompare(aParts.firstName, bParts.firstName);
  }

  return localeCompare(aParts.firstName, bParts.firstName);
};

const participantMatchesSearch = (participant: ParticipantWithEvents, query: string) =>
  participant.name.toLowerCase().includes(query) ||
  participant.phone?.toLowerCase().includes(query) ||
  participant.email?.toLowerCase().includes(query) ||
  participant.designation?.toLowerCase().includes(query) ||
  participant.organization?.toLowerCase().includes(query) ||
  participant.leadSource?.toLowerCase().includes(query) ||
  participant.notes?.toLowerCase().includes(query) ||
  participant.events.some(e => e.name.toLowerCase().includes(query) || e.date.toLowerCase().includes(query));

type ContactFilter =
  | 'all'
  | 'phone'
  | 'no-phone'
  | 'email'
  | 'no-email'
  | 'source'
  | 'no-source'
  | 'organization'
  | 'no-organization';

const hasValue = (value?: string) => !!value?.trim();

const contactFilterLabels: Record<ContactFilter, string> = {
  all: 'contacts',
  phone: 'with phone',
  'no-phone': 'missing phone',
  email: 'with email',
  'no-email': 'missing email',
  source: 'with lead source',
  'no-source': 'missing lead source',
  organization: 'with company',
  'no-organization': 'missing company',
};

const isMissingContactFilter = (filter: ContactFilter) => filter.startsWith('no-');

export default function AdminParticipantsScreen() {
  const router = useRouter();
  const { eventId, filter } = useLocalSearchParams<{ eventId?: string; filter?: string }>();
  const insets = useSafeAreaInsets();
  const tintColor = useThemeColor({}, 'tint');
  const cardBg = useThemeColor({ light: '#f5f5f5', dark: '#2a2a2a' }, 'background');
  const surfaceColor = useThemeColor({ light: '#fff', dark: '#1a1a1a' }, 'background');
  const { user, isAuthenticated } = useAuth();
  const { syncStatus } = useAutoSync();
  
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [sortBy, setSortBy] = useState<'firstName' | 'lastName' | 'phone' | 'event' | 'source'>('firstName');
  const [filterEventId, setFilterEventId] = useState<string>('all');
  const [contactFilter, setContactFilter] = useState<ContactFilter>('all');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [bulkAddInProgress, setBulkAddInProgress] = useState(false);
  
  const [events, setEvents] = useState<Event[]>([]);
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<ParticipantWithEvents[]>([]);
  const [filteredParticipants, setFilteredParticipants] = useState<ParticipantWithEvents[]>([]);
  const [summaryParticipants, setSummaryParticipants] = useState<ParticipantWithEvents[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantWithEvents | null>(null);
  const [linkedInfluencer, setLinkedInfluencer] = useState<InfluencerProspect | null>(null);
  const [influencerLinkLoading, setInfluencerLinkLoading] = useState(false);
  const [addingToInfluencer, setAddingToInfluencer] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addDesignation, setAddDesignation] = useState('');
  const [addOrganization, setAddOrganization] = useState('');
  const [addLeadSource, setAddLeadSource] = useState('');
  const [addDigitalTwinUrl, setAddDigitalTwinUrl] = useState('');
  const [addEventId, setAddEventId] = useState<string>(eventId || '');

  const [isEditingParticipant, setIsEditingParticipant] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editOrganization, setEditOrganization] = useState('');
  const [editLeadSource, setEditLeadSource] = useState('');
  const [editDigitalTwinUrl, setEditDigitalTwinUrl] = useState('');
  const [editEventId, setEditEventId] = useState<string>(eventId || '');
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [selectedUserForGrant, setSelectedUserForGrant] = useState<{id: number, name: string} | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (filter === 'prospects') {
      setFilterEventId('prospects');
    }
  }, [filter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [eventId]);

  const { data: matchedUsers, isLoading: isLoadingUser, refetch: refetchUsers } = trpc.admin.searchUsers.useQuery(
    { query: selectedParticipant?.email || selectedParticipant?.name || '' },
    { enabled: !!selectedParticipant }
  );

  useEffect(() => {
    if (!selectedParticipant) {
      setLinkedInfluencer(null);
      return;
    }

    let cancelled = false;
    setInfluencerLinkLoading(true);
    findInfluencerProspectForContact({
      name: selectedParticipant.name,
      email: selectedParticipant.email,
      phone: selectedParticipant.phone,
      designation: selectedParticipant.designation,
      organization: selectedParticipant.organization,
      leadSource: selectedParticipant.leadSource,
      digitalTwinUrl: selectedParticipant.digitalTwinUrl,
      notes: selectedParticipant.notes,
      prospectsDirectoryParticipantId: selectedParticipant.prospectsDirectoryParticipantId,
    })
      .then(prospect => {
        if (!cancelled) setLinkedInfluencer(prospect);
      })
      .finally(() => {
        if (!cancelled) setInfluencerLinkLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedParticipant]);

  const handleAddToInfluencerOutreach = async () => {
    if (!selectedParticipant) return;

    setAddingToInfluencer(true);
    try {
      const origin =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.origin
          : 'https://app.gathersync.app';
      const result = await addParticipantToInfluencerOutreach(
        {
          name: selectedParticipant.name,
          email: selectedParticipant.email,
          phone: selectedParticipant.phone,
          designation: selectedParticipant.designation,
          organization: selectedParticipant.organization,
          leadSource: selectedParticipant.leadSource,
          digitalTwinUrl: selectedParticipant.digitalTwinUrl,
          notes: selectedParticipant.notes,
          prospectsDirectoryParticipantId: selectedParticipant.prospectsDirectoryParticipantId,
        },
        { syncToCloud: isAuthenticated, origin }
      );

      setLinkedInfluencer(result.prospect);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (result.alreadyLinked) {
        Alert.alert(
          'Already in Influencer Outreach',
          `${selectedParticipant.name} is already in your outreach pipeline (${STATUS_LABELS[result.prospect.status]}).`,
          [
            { text: 'Stay Here', style: 'cancel' },
            {
              text: 'Open Pipeline',
              onPress: () => {
                setSelectedParticipant(null);
                router.push({ pathname: '/admin/influencers' as any, params: { edit: result.prospect.id } });
              },
            },
          ]
        );
        return;
      }

      Alert.alert(
        'Added to Influencer Outreach',
        `${selectedParticipant.name} is now in your outreach pipeline with LinkedIn DM and email drafts ready.`,
        [
          { text: 'Stay Here', style: 'cancel' },
          {
            text: 'Open Pipeline',
            onPress: () => {
              setSelectedParticipant(null);
              router.push({ pathname: '/admin/influencers' as any, params: { edit: result.prospect.id } });
            },
          },
        ]
      );
    } catch (error) {
      console.error('[Participants] Add to influencer outreach failed:', error);
      Alert.alert('Error', 'Failed to add to Influencer Outreach.');
    } finally {
      setAddingToInfluencer(false);
    }
  };

  const grantLifetimePro = trpc.admin.grantLifetimePro.useMutation({
    onSuccess: () => {
      refetchUsers();
      setShowGrantModal(false);
      setSelectedUserForGrant(null);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        alert('Subscription granted successfully!');
      }
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    }
  });

  const revokeLifetimePro = trpc.admin.revokeLifetimePro.useMutation({
    onSuccess: () => {
      refetchUsers();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    }
  });

  const grantTemporaryPro = trpc.admin.grantTemporaryPro.useMutation({
    onSuccess: () => {
      refetchUsers();
      setShowGrantModal(false);
      setSelectedUserForGrant(null);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        alert('Subscription granted successfully!');
      }
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    }
  });

  const handleGrantLifetimeProClick = () => {
    if (!selectedUserForGrant) return;
    const message = `Grant Lifetime Pro access to ${selectedUserForGrant.name}?`;
    
    if (Platform.OS === 'web') {
      if (confirm(message)) {
        grantLifetimePro.mutate({ userId: selectedUserForGrant.id });
      }
    } else {
      Alert.alert(
        'Confirm Grant Pro',
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Grant Pro', style: 'default', onPress: () => {
            grantLifetimePro.mutate({ userId: selectedUserForGrant.id });
          }},
        ]
      );
    }
  };

  const handleGrantTemporaryPro = (durationDays: number) => {
    if (!selectedUserForGrant) return;
    grantTemporaryPro.mutate({ userId: selectedUserForGrant.id, durationDays, reason: "Gifted by Admin" });
  };

  const createParticipantAccount = trpc.admin.createParticipantAccount.useMutation({
    onSuccess: (data) => {
      let frontendUrl = process.env.EXPO_PUBLIC_OAUTH_PORTAL_URL;
      if (!frontendUrl) {
        frontendUrl = __DEV__ ? "http://localhost:8081" : "https://app.gathersync.com";
      }
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        frontendUrl = window.location.origin;
      }
      const loginUrl = `${frontendUrl}?loginSuccess=true&token=${data.token}`;
      
      if (Platform.OS === 'web') {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(loginUrl);
          alert('Login link generated and copied to clipboard! Send this to the participant.');
        } else {
          prompt('Copy this login link and send it to the participant:', loginUrl);
        }
      } else {
        Share.share({
          message: `Here is your personal login link for GatherSync: ${loginUrl}`,
          title: 'GatherSync Login',
        });
      }
      refetchUsers();
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    }
  });

  const matchedUser = matchedUsers && matchedUsers.length > 0 ? matchedUsers[0] : null;

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [eventId])
  );

  // Reload data when sync completes
  useEffect(() => {
    if (syncStatus === 'synced') {
      loadData();
    }
  }, [syncStatus]);

  useEffect(() => {
    applySearchAndSort();
  }, [participants, searchQuery, sortBy, filterEventId, contactFilter]);

  const loadData = async () => {
    try {
      const allEvents = await eventsLocalStorage.getAll();
      const activeEvents = allEvents.filter(e => !e.archived);
      setEvents(activeEvents);

      if (eventId) {
        const foundEvent = allEvents.find(e => e.id === eventId);
        if (foundEvent) {
          setActiveEvent(foundEvent);
        }
      }

      // Build participant directory
      const participantMap = new Map<string, ParticipantWithEvents>();
      
      // First pass: gather global contact info from ALL events (including archived)
      const globalInfo = new Map<string, {phone?: string, email?: string, designation?: string, organization?: string, leadSource?: string, digitalTwinUrl?: string, notes?: string}>();
      allEvents.forEach(e => e.participants.forEach(p => {
        if (p.deletedAt) return;
        if (!globalInfo.has(p.name)) {
          globalInfo.set(p.name, { phone: p.phone, email: p.email, designation: p.designation, organization: p.organization, leadSource: p.leadSource, digitalTwinUrl: p.digitalTwinUrl, notes: p.notes });
        } else {
          const current = globalInfo.get(p.name)!;
          if (p.phone && !current.phone) current.phone = p.phone;
          if (p.email && !current.email) current.email = p.email;
          if (p.designation && !current.designation) current.designation = p.designation;
          if (p.organization && !current.organization) current.organization = p.organization;
          if (p.leadSource && !current.leadSource) current.leadSource = p.leadSource;
          if (p.digitalTwinUrl && !current.digitalTwinUrl) current.digitalTwinUrl = p.digitalTwinUrl;
          if (p.notes && !current.notes) current.notes = p.notes;
        }
      }));

      // Use allEvents instead of activeEvents so prospects and archived participants show in the directory
      allEvents.forEach(event => {
        const date = event.eventType === 'fixed' && event.fixedDate 
          ? new Date(event.fixedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : `${event.month}/${event.year}`;

        const isProspectEvent = event.name === "Prospects Directory" && event.archived;

        event.participants.forEach(participant => {
          if (participant.deletedAt) return; // Skip soft-deleted participants
          
          const info = globalInfo.get(participant.name) || {};
          
          const existing = participantMap.get(participant.name);
          if (existing) {
            if (!isProspectEvent) {
              existing.eventCount += 1;
              existing.events.push({ id: event.id, name: event.name, date });
            }
            // Update contact info if available from global info
            if (info.phone && !existing.phone) {
              existing.phone = info.phone;
            }
            if (info.email && !existing.email) {
              existing.email = info.email;
            }
            if (info.designation && !existing.designation) {
              existing.designation = info.designation;
            }
            if (info.organization && !existing.organization) {
              existing.organization = info.organization;
            }
            if (info.leadSource && !existing.leadSource) {
              existing.leadSource = info.leadSource;
            }
            if (info.digitalTwinUrl && !existing.digitalTwinUrl) {
              existing.digitalTwinUrl = info.digitalTwinUrl;
            }
            if (info.notes && !existing.notes) {
              existing.notes = info.notes;
            }
            if (isProspectEvent && !existing.prospectsDirectoryParticipantId) {
              existing.prospectsDirectoryParticipantId = participant.id;
            }
          } else {
            participantMap.set(participant.name, {
              name: participant.name,
              phone: info.phone || participant.phone,
              email: info.email || participant.email,
              designation: info.designation || participant.designation,
              organization: info.organization || participant.organization,
              leadSource: info.leadSource || participant.leadSource,
              digitalTwinUrl: info.digitalTwinUrl || participant.digitalTwinUrl,
              notes: info.notes || participant.notes,
              prospectsDirectoryParticipantId: isProspectEvent ? participant.id : undefined,
              eventCount: isProspectEvent ? 0 : 1,
              events: isProspectEvent ? [] : [{ id: event.id, name: event.name, date }],
            });
          }
        });
      });

      const participantList = Array.from(participantMap.values())
        .sort((a, b) => b.eventCount - a.eventCount);
      
      setParticipants(participantList);
    } catch (error) {
      console.error('Failed to load participant data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applySearchAndSort = () => {
    let baseFiltered = participants;

    // Filter by Event first
    if (filterEventId !== 'all') {
      if (filterEventId === 'prospects') {
        baseFiltered = baseFiltered.filter(p => p.eventCount === 0);
      } else {
        baseFiltered = baseFiltered.filter(p => p.events.some(e => e.id === filterEventId));
      }
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      baseFiltered = baseFiltered.filter(p => participantMatchesSearch(p, query));
    }

    setSummaryParticipants(baseFiltered);

    let filtered = baseFiltered;

    // Filter by contact / data quality
    if (contactFilter === 'phone') {
      filtered = filtered.filter(p => hasValue(p.phone));
    } else if (contactFilter === 'no-phone') {
      filtered = filtered.filter(p => !hasValue(p.phone));
    } else if (contactFilter === 'email') {
      filtered = filtered.filter(p => hasValue(p.email));
    } else if (contactFilter === 'no-email') {
      filtered = filtered.filter(p => !hasValue(p.email));
    } else if (contactFilter === 'source') {
      filtered = filtered.filter(p => hasValue(p.leadSource));
    } else if (contactFilter === 'no-source') {
      filtered = filtered.filter(p => !hasValue(p.leadSource));
    } else if (contactFilter === 'organization') {
      filtered = filtered.filter(p => hasValue(p.organization));
    } else if (contactFilter === 'no-organization') {
      filtered = filtered.filter(p => !hasValue(p.organization));
    }

    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'firstName') {
        return compareParticipantNames(a.name, b.name, false);
      } else if (sortBy === 'lastName') {
        return compareParticipantNames(a.name, b.name, true);
      } else if (sortBy === 'phone') {
        const phoneA = a.phone || '';
        const phoneB = b.phone || '';
        return localeCompare(phoneA, phoneB);
      } else if (sortBy === 'event') {
        const eventA = a.events.length > 0 ? a.events[0].name : '';
        const eventB = b.events.length > 0 ? b.events[0].name : '';
        if (eventA === eventB) {
          return compareParticipantNames(a.name, b.name, false);
        }
        return localeCompare(eventA, eventB);
      } else if (sortBy === 'source') {
        const sourceA = a.leadSource || '';
        const sourceB = b.leadSource || '';
        if (sourceA === sourceB) {
          return compareParticipantNames(a.name, b.name, false);
        }
        return localeCompare(sourceA, sourceB);
      }
      return 0;
    });

    setFilteredParticipants(filtered);
  };

  const handleQuickAdd = async (participantName: string) => {
    if (!activeEvent) return;

    try {
      const existingParticipantIndex = activeEvent.participants.findIndex(p => p.name === participantName);
      
      if (existingParticipantIndex !== -1) {
        if (activeEvent.participants[existingParticipantIndex].deletedAt) {
          // Reactivate soft-deleted participant
          activeEvent.participants[existingParticipantIndex].deletedAt = undefined;
          await eventsLocalStorage.update(activeEvent.id, activeEvent);
          if (isAuthenticated) {
            try {
              await eventsCloudStorage.update(activeEvent.id, activeEvent);
            } catch (error) {
              console.error('[AdminParticipants] Failed to push to cloud:', error);
            }
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          loadData(); // Refresh the list
        } else {
          Alert.alert('Info', 'Participant is already in this event.');
        }
      } else {
        // Find their phone/email from the directory
        const directoryEntry = participants.find(p => p.name === participantName);
        
        const newParticipant: Participant = {
          id: Date.now().toString(),
          name: participantName,
          phone: directoryEntry?.phone,
          email: directoryEntry?.email,
          designation: directoryEntry?.designation,
          organization: directoryEntry?.organization,
          availability: {},
          unavailableAllMonth: false,
          source: 'manual',
          rsvpStatus: 'no-response',
        };
        activeEvent.participants.push(newParticipant);
        await eventsLocalStorage.update(activeEvent.id, activeEvent);
        if (isAuthenticated) {
          try {
            await eventsCloudStorage.update(activeEvent.id, activeEvent);
          } catch (error) {
            console.error('[AdminParticipants] Failed to push to cloud:', error);
          }
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        loadData(); // Refresh the list
      }
    } catch (error) {
      console.error('Failed to quick add participant:', error);
      Alert.alert('Error', 'Failed to add participant to event');
    }
  };

  const exportParticipantList = (list: ParticipantWithEvents[] = filteredParticipants) => {
    // Generate CSV
    let csv = 'Name,Phone,Email,Title/Designation,Company/Organization,Lead Source,Event Count,Events\n';
    list.forEach(p => {
      csv += `"${p.name}","${p.phone || ''}","${p.email || ''}","${p.designation || ''}","${p.organization || ''}","${p.leadSource || ''}",${p.eventCount},"${p.events.map(e => e.name).join(', ')}"\n`;
    });

    const suffix = list.length !== participants.length ? '-filtered' : '';
    const filename = `participants${suffix}-${new Date().toISOString().split('T')[0]}.csv`;

    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      Share.share({
        message: csv,
        title: 'Participant List',
      });
    }
  };

  const handleBulkAddToEvent = async (targetEventId: string) => {
    const targetEvent = events.find(e => e.id === targetEventId);
    if (!targetEvent) return;

    const toAdd = filteredParticipants;
    if (toAdd.length === 0) {
      Alert.alert('No Participants', 'Adjust your filters to include participants first.');
      return;
    }

    Alert.alert(
      'Add to Event',
      `Add ${toAdd.length} participant${toAdd.length === 1 ? '' : 's'} to "${targetEvent.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: async () => {
            setBulkAddInProgress(true);
            try {
              const eventToUpdate = await eventsLocalStorage.getById(targetEventId);
              if (!eventToUpdate) throw new Error('Event not found');

              let addedCount = 0;
              let skippedCount = 0;

              for (const entry of toAdd) {
                const existingIndex = eventToUpdate.participants.findIndex(
                  p => p.name.toLowerCase() === entry.name.toLowerCase()
                );

                if (existingIndex !== -1) {
                  if (eventToUpdate.participants[existingIndex].deletedAt) {
                    eventToUpdate.participants[existingIndex] = {
                      ...eventToUpdate.participants[existingIndex],
                      phone: entry.phone || eventToUpdate.participants[existingIndex].phone,
                      email: entry.email || eventToUpdate.participants[existingIndex].email,
                      designation: entry.designation || eventToUpdate.participants[existingIndex].designation,
                      organization: entry.organization || eventToUpdate.participants[existingIndex].organization,
                      leadSource: entry.leadSource || eventToUpdate.participants[existingIndex].leadSource,
                      digitalTwinUrl: entry.digitalTwinUrl || eventToUpdate.participants[existingIndex].digitalTwinUrl,
                      notes: entry.notes || eventToUpdate.participants[existingIndex].notes,
                      deletedAt: undefined,
                    };
                    addedCount += 1;
                  } else {
                    skippedCount += 1;
                  }
                  continue;
                }

                eventToUpdate.participants.push({
                  id: `${Date.now()}-${addedCount}`,
                  name: entry.name,
                  phone: entry.phone,
                  email: entry.email,
                  designation: entry.designation,
                  organization: entry.organization,
                  leadSource: entry.leadSource,
                  digitalTwinUrl: entry.digitalTwinUrl,
                  notes: entry.notes,
                  availability: {},
                  unavailableAllMonth: false,
                  source: 'manual',
                  rsvpStatus: 'no-response',
                });
                addedCount += 1;
              }

              await eventsLocalStorage.update(eventToUpdate.id, eventToUpdate);

              if (isAuthenticated) {
                try {
                  await eventsCloudStorage.update(eventToUpdate.id, eventToUpdate);
                } catch (error) {
                  console.error('[AdminParticipants] Failed to push bulk add to cloud:', error);
                }
              }

              setShowBulkAddModal(false);
              setShowActionsMenu(false);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              loadData();

              const skippedMessage = skippedCount > 0 ? ` ${skippedCount} already in the event.` : '';
              Alert.alert('Done', `Added ${addedCount} participant${addedCount === 1 ? '' : 's'} to "${targetEvent.name}".${skippedMessage}`);
            } catch (error) {
              console.error('Failed to bulk add participants:', error);
              Alert.alert('Error', 'Failed to add participants to event');
            } finally {
              setBulkAddInProgress(false);
            }
          },
        },
      ]
    );
  };

  const handleAddParticipant = async () => {
    if (!addName.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    try {
      let targetEventId = addEventId;
      let eventToSyncToCloud = null;

      // If no event selected, find or create the hidden "Prospects Directory" event
      if (!targetEventId) {
        const allEvents = await eventsLocalStorage.getAll();
        let prospectsEvent = allEvents.find(e => e.name === "Prospects Directory" && e.archived);
        
        if (!prospectsEvent) {
          prospectsEvent = await eventsLocalStorage.add({
            name: "Prospects Directory",
            eventType: "flexible",
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            participants: [],
            archived: true,
          });
          
          if (isAuthenticated) {
            try {
              await eventsCloudStorage.add(prospectsEvent);
            } catch (error) {
              console.error('[AdminParticipants] Failed to push new prospects event to cloud:', error);
            }
          }
        }
        targetEventId = prospectsEvent.id;
      }

      const eventToUpdate = await eventsLocalStorage.getById(targetEventId);
      if (!eventToUpdate) throw new Error('Event not found');

      const existingIndex = eventToUpdate.participants.findIndex(p => p.name.toLowerCase() === addName.trim().toLowerCase());
      
      if (existingIndex !== -1) {
        if (eventToUpdate.participants[existingIndex].deletedAt) {
          // Reactivate and update
            eventToUpdate.participants[existingIndex] = {
              ...eventToUpdate.participants[existingIndex],
              name: addName.trim(),
              phone: addPhone.trim() || undefined,
              email: addEmail.trim() || undefined,
              designation: addDesignation.trim() || undefined,
              organization: addOrganization.trim() || undefined,
              leadSource: addLeadSource.trim() || undefined,
              digitalTwinUrl: addDigitalTwinUrl.trim() || undefined,
              deletedAt: undefined,
            };
          await eventsLocalStorage.update(eventToUpdate.id, eventToUpdate);
          eventToSyncToCloud = eventToUpdate;
        } else {
          Alert.alert('Info', 'Participant is already in this event.');
          return;
        }
      } else {
        const newParticipant: Participant = {
          id: Date.now().toString(),
          name: addName.trim(),
          phone: addPhone.trim() || undefined,
          email: addEmail.trim() || undefined,
          designation: addDesignation.trim() || undefined,
          organization: addOrganization.trim() || undefined,
          leadSource: addLeadSource.trim() || undefined,
          digitalTwinUrl: addDigitalTwinUrl.trim() || undefined,
          availability: {},
          unavailableAllMonth: false,
          source: 'manual',
          rsvpStatus: 'no-response',
        };

        eventToUpdate.participants.push(newParticipant);
        await eventsLocalStorage.update(eventToUpdate.id, eventToUpdate);
        eventToSyncToCloud = eventToUpdate;
      }
      
      if (isAuthenticated && eventToSyncToCloud) {
        try {
          await eventsCloudStorage.update(eventToSyncToCloud.id, eventToSyncToCloud);
        } catch (error) {
          console.error('[AdminParticipants] Failed to push to cloud:', error);
        }
      }

      setAddName('');
      setAddPhone('');
      setAddEmail('');
      setAddDesignation('');
      setAddOrganization('');
      setAddLeadSource('');
      setAddDigitalTwinUrl('');
      setAddEventId('');
      setShowAddModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadData(); // Refresh the list
    } catch (error) {
      console.error('Failed to add participant:', error);
      Alert.alert('Error', 'Failed to add participant');
    }
  };

  const handleSaveParticipant = async () => {
    if (!selectedParticipant) return;
    if (!editName.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    try {
      const oldName = selectedParticipant.name;
      const newName = editName.trim();
      const newPhone = editPhone.trim() || undefined;
      const newEmail = editEmail.trim() || undefined;
      const newDesignation = editDesignation.trim() || undefined;
      const newOrganization = editOrganization.trim() || undefined;
      const newLeadSource = editLeadSource.trim() || undefined;
      const newDigitalTwinUrl = editDigitalTwinUrl.trim() || undefined;

      let hasUpdatedAny = false;
      const eventsToSyncToCloud = [];

      // Update existing events
      for (const evt of selectedParticipant.events) {
        const eventToUpdate = await eventsLocalStorage.getById(evt.id);
        if (eventToUpdate) {
          const participantIndex = eventToUpdate.participants.findIndex(p => p.name === oldName);
          if (participantIndex !== -1) {
            eventToUpdate.participants[participantIndex] = {
              ...eventToUpdate.participants[participantIndex],
              name: newName,
              phone: newPhone,
              email: newEmail,
              designation: newDesignation,
              organization: newOrganization,
              leadSource: newLeadSource,
              digitalTwinUrl: newDigitalTwinUrl,
            };
            await eventsLocalStorage.update(eventToUpdate.id, eventToUpdate);
            eventsToSyncToCloud.push(eventToUpdate);
            hasUpdatedAny = true;
          }
        }
      }

      // If they had no events (somehow), we should probably add them to the prospects directory
      if (!hasUpdatedAny && selectedParticipant.events.length === 0) {
        const allEvents = await eventsLocalStorage.getAll();
        let prospectsEvent = allEvents.find(e => e.name === "Prospects Directory" && e.archived);
        if (prospectsEvent) {
           const participantIndex = prospectsEvent.participants.findIndex(p => p.name === oldName);
           if (participantIndex !== -1) {
              prospectsEvent.participants[participantIndex] = {
                ...prospectsEvent.participants[participantIndex],
                name: newName,
                phone: newPhone,
                email: newEmail,
                designation: newDesignation,
                organization: newOrganization,
                leadSource: newLeadSource,
                digitalTwinUrl: newDigitalTwinUrl,
              };
              await eventsLocalStorage.update(prospectsEvent.id, prospectsEvent);
              eventsToSyncToCloud.push(prospectsEvent);
           }
        }
      }

      // Add to new event if selected
      if (editEventId) {
        const eventToAdd = await eventsLocalStorage.getById(editEventId);
        if (eventToAdd) {
          const existingIndex = eventToAdd.participants.findIndex(p => p.name === newName);
          if (existingIndex !== -1) {
            if (eventToAdd.participants[existingIndex].deletedAt) {
              // Reactivate
              eventToAdd.participants[existingIndex] = {
                ...eventToAdd.participants[existingIndex],
                name: newName,
                phone: newPhone,
                email: newEmail,
                designation: newDesignation,
                organization: newOrganization,
                leadSource: newLeadSource,
                digitalTwinUrl: newDigitalTwinUrl,
                deletedAt: undefined,
              };
              await eventsLocalStorage.update(eventToAdd.id, eventToAdd);
              eventsToSyncToCloud.push(eventToAdd);
            }
          } else {
            const newParticipant: Participant = {
              id: Date.now().toString(),
              name: newName,
              phone: newPhone,
              email: newEmail,
              designation: newDesignation,
              organization: newOrganization,
              leadSource: newLeadSource,
              digitalTwinUrl: newDigitalTwinUrl,
              availability: {},
              unavailableAllMonth: false,
              source: 'manual',
              rsvpStatus: 'no-response',
            };
            eventToAdd.participants.push(newParticipant);
            await eventsLocalStorage.update(eventToAdd.id, eventToAdd);
            eventsToSyncToCloud.push(eventToAdd);
          }
        }
      }

      // Sync all modified events to cloud
      if (isAuthenticated && eventsToSyncToCloud.length > 0) {
        try {
          await Promise.all(
            eventsToSyncToCloud.map(e => eventsCloudStorage.update(e.id, e))
          );
        } catch (error) {
          console.error('[AdminParticipants] Failed to push to cloud:', error);
        }
      }

      setIsEditingParticipant(false);
      setEditEventId('');
      setSelectedParticipant(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadData(); // Refresh the list
    } catch (error) {
      console.error('Failed to update participant:', error);
      Alert.alert('Error', 'Failed to update participant details');
    }
  };

  const withPhoneCount = summaryParticipants.filter(p => hasValue(p.phone)).length;
  const missingPhoneCount = summaryParticipants.length - withPhoneCount;
  const withEmailCount = summaryParticipants.filter(p => hasValue(p.email)).length;
  const missingEmailCount = summaryParticipants.length - withEmailCount;
  const withSourceCount = summaryParticipants.filter(p => hasValue(p.leadSource)).length;
  const missingSourceCount = summaryParticipants.length - withSourceCount;
  const withOrganizationCount = summaryParticipants.filter(p => hasValue(p.organization)).length;
  const missingOrganizationCount = summaryParticipants.length - withOrganizationCount;

  const getSummaryCardBorder = (filter: ContactFilter) => {
    if (contactFilter !== filter) return {};
    return isMissingContactFilter(filter)
      ? { borderColor: AdminColors.warning, borderWidth: 2 }
      : { borderColor: tintColor, borderWidth: 2 };
  };

  const renderContactField = (
    icon: 'phone.fill' | 'envelope.fill' | 'tag.fill' | 'building.2.fill' | 'briefcase.fill',
    value: string | undefined,
    missingLabel: string,
    emphasizeMissing = false,
  ) => {
    const present = hasValue(value);
    if (!present && !emphasizeMissing) return null;

    return (
      <View style={styles.metaItem}>
        <IconSymbol
          name={icon}
          size={12}
          color={present ? tintColor : AdminColors.warning}
        />
        <ThemedText style={[styles.metaText, !present && styles.missingFieldText]}>
          {present ? value!.trim() : missingLabel}
        </ThemedText>
      </View>
    );
  };

  const showAllContactFields =
    contactFilter === 'all' ||
    contactFilter === 'phone' ||
    contactFilter === 'no-phone' ||
    contactFilter === 'email' ||
    contactFilter === 'no-email' ||
    contactFilter === 'source' ||
    contactFilter === 'no-source';

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <IconSymbol name="chevron.left" size={24} color={tintColor} />
        </Pressable>
        <ThemedText type="title" style={{ flex: 1, fontSize: isDesktop ? 32 : 24 }}>
          {isDesktop ? 'Participant Management' : 'Participants'}
        </ThemedText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowActionsMenu(true);
            }}
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: tintColor + '15', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 }}
          >
            <IconSymbol name="ellipsis.circle" size={16} color={tintColor} />
            {isDesktop && (
              <ThemedText style={{ color: tintColor, fontWeight: '600', fontSize: 14 }}>Actions</ThemedText>
            )}
          </Pressable>
          <Pressable
            style={{ backgroundColor: tintColor, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => setShowAddModal(true)}
          >
            <IconSymbol name="plus" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={[styles.searchBox, { backgroundColor: surfaceColor }]}>
          <IconSymbol name="magnifyingglass" size={18} color="#999" />
          <TextInput
            style={[
              styles.searchInput,
              { color: tintColor },
              searchQuery.length > 0 && styles.searchInputWithClear,
            ]}
            placeholder="Search participants..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable
              style={styles.searchClearButton}
              onPress={() => setSearchQuery('')}
              hitSlop={8}
              accessibilityLabel="Clear search"
            >
              <IconSymbol name="xmark.circle.fill" size={22} color="#666" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Filter and Sort */}
      <View style={[styles.controls, !isDesktop && { flexDirection: 'column', alignItems: 'stretch' }]}>
        {isDesktop ? (
          <>
            <Pressable
              style={[styles.sortButton, { backgroundColor: filterEventId !== 'all' ? tintColor : surfaceColor }]}
              onPress={() => setShowFilterModal(true)}
            >
              <ThemedText style={[styles.sortButtonText, { color: filterEventId !== 'all' ? '#fff' : tintColor }]}>
                {filterEventId === 'all' 
                  ? 'Filter: All Events' 
                  : filterEventId === 'prospects'
                    ? 'Filter: Prospects Only'
                    : `Filter: ${events.find(e => e.id === filterEventId)?.name || 'Event'}`}
              </ThemedText>
            </Pressable>
            <View style={styles.sortControls}>
              <ThemedText style={{ fontSize: 14, color: '#999', marginRight: 8 }}>Sort by:</ThemedText>
              {(['firstName', 'lastName', 'phone', 'event', 'source'] as const).map(option => (
                <Pressable
                  key={option}
                  style={[
                    styles.sortButton,
                    { backgroundColor: surfaceColor },
                    sortBy === option && { backgroundColor: tintColor }
                  ]}
                  onPress={() => setSortBy(option)}
                >
                  <ThemedText style={[styles.sortButtonText, sortBy === option && { color: '#fff' }]}>
                    {option === 'firstName' ? 'First Name' : option === 'lastName' ? 'Last Name' : option === 'phone' ? 'Phone' : option === 'event' ? 'Event' : 'Source'}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              style={[styles.sortButton, { flex: 1, alignItems: 'center', backgroundColor: filterEventId !== 'all' ? tintColor : surfaceColor }]}
              onPress={() => setShowFilterModal(true)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <IconSymbol name="line.3.horizontal.decrease.circle" size={16} color={filterEventId !== 'all' ? '#fff' : tintColor} />
                <ThemedText style={[styles.sortButtonText, { color: filterEventId !== 'all' ? '#fff' : tintColor }]} numberOfLines={1}>
                  {filterEventId === 'all' 
                    ? 'All Events' 
                    : filterEventId === 'prospects'
                      ? 'Prospects'
                      : events.find(e => e.id === filterEventId)?.name || 'Event'}
                </ThemedText>
              </View>
            </Pressable>
            <Pressable
              style={[styles.sortButton, { flex: 1, alignItems: 'center', backgroundColor: surfaceColor }]}
              onPress={() => setShowSortModal(true)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <IconSymbol name="arrow.up.arrow.down" size={16} color={tintColor} />
                <ThemedText style={[styles.sortButtonText, { color: tintColor }]} numberOfLines={1}>
                  {sortBy === 'firstName' ? 'First Name' : sortBy === 'lastName' ? 'Last Name' : sortBy === 'phone' ? 'Phone' : sortBy === 'event' ? 'Event' : 'Source'}
                </ThemedText>
              </View>
            </Pressable>
          </View>
        )}
      </View>

      {/* Summary */}
      {(filterEventId !== 'all' || searchQuery.trim() || contactFilter !== 'all') && (
        <View style={{ paddingHorizontal: 20, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <ThemedText style={{ fontSize: 13, color: '#999', flex: 1 }}>
            Showing {filteredParticipants.length} of {summaryParticipants.length} matching
            {filterEventId === 'prospects'
              ? ' prospects'
              : filterEventId !== 'all'
                ? ' participants'
                : contactFilter === 'all'
                  ? ' contacts'
                  : ''}
            {contactFilter !== 'all' ? ` ${contactFilterLabels[contactFilter]}` : ''}
            {searchQuery.trim() ? ` for "${searchQuery.trim()}"` : ''}
          </ThemedText>
          {searchQuery.trim().length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <ThemedText style={{ fontSize: 13, color: tintColor, fontWeight: '600' }}>Clear search</ThemedText>
            </Pressable>
          )}
        </View>
      )}
      <View style={[styles.summary, !isDesktop && { flexWrap: 'wrap' }]}>
        <Pressable 
          style={[styles.summaryCard, { backgroundColor: cardBg }, getSummaryCardBorder('all'), !isDesktop && { minWidth: '46%', padding: 12 }]}
          onPress={() => setContactFilter('all')}
        >
          <ThemedText style={[styles.summaryValue, !isDesktop && { fontSize: 20 }]}>{summaryParticipants.length}</ThemedText>
          <ThemedText style={styles.summaryLabel}>Total</ThemedText>
        </Pressable>
        <Pressable 
          style={[styles.summaryCard, { backgroundColor: cardBg }, getSummaryCardBorder('phone'), !isDesktop && { minWidth: '46%', padding: 12 }]}
          onPress={() => setContactFilter('phone')}
        >
          <ThemedText style={[styles.summaryValue, !isDesktop && { fontSize: 20 }]}>
            {withPhoneCount}
          </ThemedText>
          <ThemedText style={styles.summaryLabel}>With Phone</ThemedText>
        </Pressable>
        <Pressable 
          style={[styles.summaryCard, { backgroundColor: cardBg }, getSummaryCardBorder('email'), !isDesktop && { minWidth: '46%', padding: 12 }]}
          onPress={() => setContactFilter('email')}
        >
          <ThemedText style={[styles.summaryValue, !isDesktop && { fontSize: 20 }]}>
            {withEmailCount}
          </ThemedText>
          <ThemedText style={styles.summaryLabel}>With Email</ThemedText>
        </Pressable>
        <Pressable 
          style={[styles.summaryCard, { backgroundColor: cardBg }, getSummaryCardBorder('source'), !isDesktop && { minWidth: '46%', padding: 12 }]}
          onPress={() => setContactFilter('source')}
        >
          <ThemedText style={[styles.summaryValue, !isDesktop && { fontSize: 20 }]}>
            {withSourceCount}
          </ThemedText>
          <ThemedText style={styles.summaryLabel}>With Source</ThemedText>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
        <ThemedText style={{ fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Missing Data
        </ThemedText>
      </View>
      <View style={[styles.summary, !isDesktop && { flexWrap: 'wrap' }, { marginTop: 0 }]}>
        <Pressable 
          style={[styles.summaryCard, styles.missingSummaryCard, { backgroundColor: AdminColors.warningLight }, getSummaryCardBorder('no-phone'), !isDesktop && { minWidth: '46%', padding: 12 }]}
          onPress={() => setContactFilter('no-phone')}
        >
          <ThemedText style={[styles.summaryValue, { color: missingPhoneCount > 0 ? AdminColors.warning : undefined }, !isDesktop && { fontSize: 20 }]}>
            {missingPhoneCount}
          </ThemedText>
          <ThemedText style={styles.summaryLabel}>No Phone</ThemedText>
        </Pressable>
        <Pressable 
          style={[styles.summaryCard, styles.missingSummaryCard, { backgroundColor: AdminColors.warningLight }, getSummaryCardBorder('no-email'), !isDesktop && { minWidth: '46%', padding: 12 }]}
          onPress={() => setContactFilter('no-email')}
        >
          <ThemedText style={[styles.summaryValue, { color: missingEmailCount > 0 ? AdminColors.warning : undefined }, !isDesktop && { fontSize: 20 }]}>
            {missingEmailCount}
          </ThemedText>
          <ThemedText style={styles.summaryLabel}>No Email</ThemedText>
        </Pressable>
        <Pressable 
          style={[styles.summaryCard, styles.missingSummaryCard, { backgroundColor: AdminColors.warningLight }, getSummaryCardBorder('no-source'), !isDesktop && { minWidth: '46%', padding: 12 }]}
          onPress={() => setContactFilter('no-source')}
        >
          <ThemedText style={[styles.summaryValue, { color: missingSourceCount > 0 ? AdminColors.warning : undefined }, !isDesktop && { fontSize: 20 }]}>
            {missingSourceCount}
          </ThemedText>
          <ThemedText style={styles.summaryLabel}>No Source</ThemedText>
        </Pressable>
        <Pressable 
          style={[styles.summaryCard, styles.missingSummaryCard, { backgroundColor: AdminColors.warningLight }, getSummaryCardBorder('no-organization'), !isDesktop && { minWidth: '46%', padding: 12 }]}
          onPress={() => setContactFilter('no-organization')}
        >
          <ThemedText style={[styles.summaryValue, { color: missingOrganizationCount > 0 ? AdminColors.warning : undefined }, !isDesktop && { fontSize: 20 }]}>
            {missingOrganizationCount}
          </ThemedText>
          <ThemedText style={styles.summaryLabel}>No Company</ThemedText>
        </Pressable>
      </View>

      {/* Action Buttons */}
      <View style={{ paddingHorizontal: 20, marginBottom: 16, flexDirection: 'row', gap: 12, justifyContent: isDesktop ? 'flex-start' : 'center' }}>
        <Pressable
          style={[styles.exportButton, { backgroundColor: tintColor, marginHorizontal: 0, marginBottom: 0, paddingVertical: 10, paddingHorizontal: 20 }]}
          onPress={() => router.push('/import-contacts?eventId=prospects')}
        >
          <IconSymbol name="arrow.down.doc" size={18} color="#fff" />
          <ThemedText style={[styles.exportButtonText, { fontSize: 14 }]}>Import List</ThemedText>
        </Pressable>
        <Pressable
          style={[styles.exportButton, { backgroundColor: surfaceColor, borderWidth: 1, borderColor: tintColor, marginHorizontal: 0, marginBottom: 0, paddingVertical: 10, paddingHorizontal: 20 }]}
          onPress={() => exportParticipantList(filteredParticipants)}
        >
          <IconSymbol name="square.and.arrow.up" size={18} color={tintColor} />
          <ThemedText style={[styles.exportButtonText, { fontSize: 14, color: tintColor }]}>
            Export {filteredParticipants.length !== participants.length ? 'Filtered' : 'List'}
          </ThemedText>
        </Pressable>
      </View>

      {/* Participant List */}
      <ScrollView 
        style={styles.participantList}
        contentContainerStyle={isDesktop ? styles.participantListGrid : undefined}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredParticipants.length === 0 ? (
          <View style={styles.emptyState}>
            <ThemedText style={{ opacity: 0.5 }}>
              {searchQuery ? 'No participants found' : 'No participants yet'}
            </ThemedText>
          </View>
        ) : (
          filteredParticipants.map((participant, index) => (
            <Pressable
              key={index}
              style={[
                styles.participantCard, 
                { backgroundColor: cardBg },
                isDesktop && { width: '32%', marginBottom: 0 }
              ]}
              onPress={() => {
                setSelectedParticipant(participant);
                setEditName(participant.name);
                setEditPhone(participant.phone || '');
                setEditEmail(participant.email || '');
                setEditDesignation(participant.designation || '');
                setEditOrganization(participant.organization || '');
                setEditLeadSource(participant.leadSource || '');
                setEditDigitalTwinUrl(participant.digitalTwinUrl || '');
                setEditEventId(''); // Reset the "Add to Event" dropdown
                setIsEditingParticipant(false);
              }}
            >
              <View style={styles.participantHeader}>
                <View style={styles.participantInfo}>
                  <ThemedText type="defaultSemiBold">{participant.name}</ThemedText>
                  <View style={styles.participantMeta}>
                    {participant.designation && (
                      <View style={styles.metaItem}>
                        <IconSymbol name="briefcase.fill" size={12} color={tintColor} />
                        <ThemedText style={styles.metaText}>{participant.designation}</ThemedText>
                      </View>
                    )}
                    {(participant.organization || contactFilter === 'no-organization' || contactFilter === 'organization') &&
                      renderContactField(
                        'building.2.fill',
                        participant.organization,
                        'No company',
                        contactFilter === 'no-organization' || contactFilter === 'organization' || contactFilter === 'all',
                      )}
                    {(showAllContactFields || contactFilter === 'source' || contactFilter === 'no-source') &&
                      renderContactField(
                        'tag.fill',
                        participant.leadSource,
                        'No source',
                        true,
                      )}
                    {(showAllContactFields || contactFilter === 'phone' || contactFilter === 'no-phone') &&
                      renderContactField(
                        'phone.fill',
                        participant.phone,
                        'No phone',
                        true,
                      )}
                    {(showAllContactFields || contactFilter === 'email' || contactFilter === 'no-email') &&
                      renderContactField(
                        'envelope.fill',
                        participant.email,
                        'No email',
                        true,
                      )}
                  </View>
                </View>
                {activeEvent && !activeEvent.participants.some(p => p.name === participant.name) ? (
                  <Pressable
                    style={{ backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleQuickAdd(participant.name);
                    }}
                  >
                    <ThemedText style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>Add to Event</ThemedText>
                  </Pressable>
                ) : activeEvent && activeEvent.participants.some(p => p.name === participant.name) ? (
                  <View style={{ backgroundColor: '#10B98120', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
                    <ThemedText style={{ color: '#10B981', fontSize: 12, fontWeight: 'bold' }}>Added</ThemedText>
                  </View>
                ) : participant.eventCount === 0 ? (
                  <View style={[styles.eventBadge, { backgroundColor: AdminColors.primaryLight }]}>
                    <ThemedText style={[styles.eventBadgeText, { color: AdminColors.primary }]}>
                      Prospect
                    </ThemedText>
                  </View>
                ) : (
                  <View style={[styles.eventBadge, { backgroundColor: tintColor }]}>
                    <ThemedText style={styles.eventBadgeText}>
                      {participant.eventCount} {participant.eventCount === 1 ? 'event' : 'events'}
                    </ThemedText>
                  </View>
                )}
              </View>

              {participant.events.length > 0 && (
                <View style={styles.eventList}>
                  <ThemedText style={styles.eventListTitle}>Events:</ThemedText>
                  <View style={styles.eventChips}>
                    {participant.events.map((evt, i) => (
                      <Pressable 
                        key={i} 
                        style={[styles.eventChip, { backgroundColor: tintColor + '20' }]}
                        onPress={(e) => {
                          e.stopPropagation();
                          router.push(`/event-detail?eventId=${evt.id}` as any);
                        }}
                        hitSlop={4}
                      >
                        <ThemedText style={[styles.eventChipText, { color: tintColor }]}>
                          {evt.name} • {evt.date}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </Pressable>
          ))
        )}
        <View style={{ height: insets.bottom + 80 }} />
      </ScrollView>

      {/* Participant Details Modal */}
      <Modal
        visible={!!selectedParticipant}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedParticipant(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSelectedParticipant(null)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: surfaceColor }]}
            onPress={(e) => e.stopPropagation()}
          >
            {selectedParticipant && (
              <>
                <View style={styles.modalHeader}>
                  <ThemedText type="subtitle" style={{ fontSize: 20 }}>Participant Details</ThemedText>
                  <Pressable onPress={() => setSelectedParticipant(null)} hitSlop={8}>
                    <IconSymbol name="xmark" size={24} color={tintColor} />
                  </Pressable>
                </View>

                <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
                  {isEditingParticipant ? (
                    <View style={styles.modalSection}>
                      <View style={{ gap: 12, marginBottom: 16 }}>
                        <View style={isDesktop ? { flexDirection: 'row', gap: 12 } : { gap: 12 }}>
                          <View style={{ flex: 1 }}>
                            <ThemedText style={{ marginBottom: 4, fontWeight: '500', fontSize: 13 }}>Name *</ThemedText>
                            <TextInput
                              style={[styles.searchInput, { backgroundColor: cardBg, color: tintColor, paddingVertical: 8, paddingHorizontal: 12, fontSize: 14 }]}
                              placeholder="e.g. John Doe"
                              placeholderTextColor="#999"
                              value={editName}
                              onChangeText={setEditName}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <ThemedText style={{ marginBottom: 4, fontWeight: '500', fontSize: 13 }}>Add to Event (Optional)</ThemedText>
                            <View style={{ backgroundColor: cardBg, borderRadius: 8, overflow: 'hidden' }}>
                              {Platform.OS === 'web' ? (
                                <select
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    backgroundColor: 'transparent',
                                    color: tintColor,
                                    border: 'none',
                                    outline: 'none',
                                    fontSize: 14,
                                    height: 38,
                                  }}
                                  value={editEventId}
                                  onChange={(e) => setEditEventId(e.target.value)}
                                >
                                  <option value="">Select an event...</option>
                                  {events.map((e) => (
                                    <option key={e.id} value={e.id}>
                                      {e.name} ({e.eventType === 'fixed' ? e.fixedDate : `${e.month}/${e.year}`})
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <ScrollView style={{ maxHeight: 120 }}>
                                  <Pressable
                                    style={{
                                      padding: 8,
                                      paddingHorizontal: 12,
                                      borderBottomWidth: 1,
                                      borderBottomColor: 'rgba(0,0,0,0.05)',
                                      backgroundColor: editEventId === '' ? tintColor + '20' : 'transparent',
                                    }}
                                    onPress={() => setEditEventId('')}
                                  >
                                    <ThemedText style={{ color: editEventId === '' ? tintColor : undefined, fontSize: 14 }}>
                                      Select an event...
                                    </ThemedText>
                                  </Pressable>
                                  {events.map((e) => (
                                    <Pressable
                                      key={e.id}
                                      style={{
                                        padding: 8,
                                        paddingHorizontal: 12,
                                        borderBottomWidth: 1,
                                        borderBottomColor: 'rgba(0,0,0,0.05)',
                                        backgroundColor: editEventId === e.id ? tintColor + '20' : 'transparent',
                                      }}
                                      onPress={() => setEditEventId(e.id)}
                                    >
                                      <ThemedText style={{ color: editEventId === e.id ? tintColor : undefined, fontSize: 14 }}>
                                        {e.name}
                                      </ThemedText>
                                      <ThemedText style={{ fontSize: 11, opacity: 0.7 }}>
                                        {e.eventType === 'fixed' ? e.fixedDate : `${e.month}/${e.year}`}
                                      </ThemedText>
                                    </Pressable>
                                  ))}
                                </ScrollView>
                              )}
                            </View>
                          </View>
                        </View>

                        <View style={isDesktop ? { flexDirection: 'row', gap: 12 } : { gap: 12 }}>
                          <View style={{ flex: 1 }}>
                            <ThemedText style={{ marginBottom: 4, fontWeight: '500', fontSize: 13 }}>Phone (Optional)</ThemedText>
                            <TextInput
                              style={[styles.searchInput, { backgroundColor: cardBg, color: tintColor, paddingVertical: 8, paddingHorizontal: 12, fontSize: 14 }]}
                              placeholder="e.g. 0400 000 000"
                              placeholderTextColor="#999"
                              value={editPhone}
                              onChangeText={setEditPhone}
                              keyboardType="phone-pad"
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <ThemedText style={{ marginBottom: 4, fontWeight: '500', fontSize: 13 }}>Email (Optional)</ThemedText>
                            <TextInput
                              style={[styles.searchInput, { backgroundColor: cardBg, color: tintColor, paddingVertical: 8, paddingHorizontal: 12, fontSize: 14 }]}
                              placeholder="e.g. john@example.com"
                              placeholderTextColor="#999"
                              value={editEmail}
                              onChangeText={setEditEmail}
                              keyboardType="email-address"
                              autoCapitalize="none"
                            />
                          </View>
                        </View>

                        <View style={{ marginTop: 12 }}>
                          <ThemedText style={{ marginBottom: 4, fontWeight: '500', fontSize: 13 }}>Title or Designation (Optional)</ThemedText>
                          <TextInput
                            style={[styles.searchInput, { backgroundColor: cardBg, color: tintColor, paddingVertical: 8, paddingHorizontal: 12, fontSize: 14 }]}
                            placeholder="e.g. Director, Treasurer, VIP"
                            placeholderTextColor="#999"
                            value={editDesignation}
                            onChangeText={setEditDesignation}
                            autoCapitalize="words"
                          />
                        </View>

                        <View style={{ marginTop: 12 }}>
                          <ThemedText style={{ marginBottom: 4, fontWeight: '500', fontSize: 13 }}>Company or Organization (Optional)</ThemedText>
                          <TextInput
                            style={[styles.searchInput, { backgroundColor: cardBg, color: tintColor, paddingVertical: 8, paddingHorizontal: 12, fontSize: 14 }]}
                            placeholder="e.g. Acme Corp, GatherSync"
                            placeholderTextColor="#999"
                            value={editOrganization}
                            onChangeText={setEditOrganization}
                            autoCapitalize="words"
                          />
                        </View>

                        <View style={{ marginTop: 12 }}>
                          <ThemedText style={{ marginBottom: 4, fontWeight: '500', fontSize: 13 }}>Lead Source (Optional)</ThemedText>
                          <TextInput
                            style={[styles.searchInput, { backgroundColor: cardBg, color: tintColor, paddingVertical: 8, paddingHorizontal: 12, fontSize: 14 }]}
                            placeholder="e.g. Letterbox, Trade Show, Referral"
                            placeholderTextColor="#999"
                            value={editLeadSource}
                            onChangeText={setEditLeadSource}
                            autoCapitalize="words"
                          />
                        </View>

                        <View style={{ marginTop: 12 }}>
                          <ThemedText style={{ marginBottom: 4, fontWeight: '500', fontSize: 13 }}>Digital Twin URL (Optional)</ThemedText>
                          <TextInput
                            style={[styles.searchInput, { backgroundColor: cardBg, color: tintColor, paddingVertical: 8, paddingHorizontal: 12, fontSize: 14 }]}
                            placeholder="https://getbizcard.com/your-name"
                            placeholderTextColor="#999"
                            value={editDigitalTwinUrl}
                            onChangeText={setEditDigitalTwinUrl}
                            keyboardType="url"
                            autoCapitalize="none"
                          />
                        </View>
                      </View>
                      
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <Pressable
                          style={[styles.exportButton, { backgroundColor: cardBg, flex: 1, marginHorizontal: 0, paddingVertical: 12, marginBottom: 0 }]}
                          onPress={() => setIsEditingParticipant(false)}
                        >
                          <ThemedText style={{ fontWeight: '600', fontSize: 14 }}>Cancel</ThemedText>
                        </Pressable>
                        <Pressable
                          style={[styles.exportButton, { backgroundColor: tintColor, flex: 1, marginHorizontal: 0, paddingVertical: 12, marginBottom: 0 }]}
                          onPress={handleSaveParticipant}
                        >
                          <ThemedText style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Save Changes</ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.modalSection}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <ThemedText type="defaultSemiBold" style={{ fontSize: 18, marginBottom: 8 }}>{selectedParticipant.name}</ThemedText>
                          {selectedParticipant.phone && (
                            <View style={[styles.metaItem, { marginBottom: 4 }]}>
                              <IconSymbol name="phone.fill" size={16} color={tintColor} />
                              <ThemedText>{selectedParticipant.phone}</ThemedText>
                            </View>
                          )}
                          {selectedParticipant.email && (
                            <View style={styles.metaItem}>
                              <IconSymbol name="envelope.fill" size={16} color={tintColor} />
                              <ThemedText>{selectedParticipant.email}</ThemedText>
                            </View>
                          )}
                          {selectedParticipant.designation && (
                            <View style={[styles.metaItem, { marginTop: 4 }]}>
                              <IconSymbol name="briefcase.fill" size={16} color={tintColor} />
                              <ThemedText>{selectedParticipant.designation}</ThemedText>
                            </View>
                          )}
                          {selectedParticipant.organization && (
                            <View style={[styles.metaItem, { marginTop: 4 }]}>
                              <IconSymbol name="building.2.fill" size={16} color={tintColor} />
                              <ThemedText>{selectedParticipant.organization}</ThemedText>
                            </View>
                          )}
                          {selectedParticipant.leadSource && (
                            <View style={[styles.metaItem, { marginTop: 4 }]}>
                              <IconSymbol name="tag.fill" size={16} color={tintColor} />
                              <ThemedText>{selectedParticipant.leadSource}</ThemedText>
                            </View>
                          )}
                        </View>
                        <Pressable
                          style={{ backgroundColor: tintColor + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}
                          onPress={() => setIsEditingParticipant(true)}
                        >
                          <ThemedText style={{ color: tintColor, fontSize: 13, fontWeight: '600' }}>Edit</ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  )}

                  <View style={[styles.modalSection, { borderTopWidth: 1, borderTopColor: cardBg, paddingTop: 16 }]}>
                    <ThemedText type="defaultSemiBold" style={{ marginBottom: 8 }}>Influencer Outreach</ThemedText>
                    <ThemedText style={{ opacity: 0.7, fontSize: 14, marginBottom: 12 }}>
                      Move this contact into your outreach pipeline to track DMs, follow-ups, and partner status.
                    </ThemedText>

                    {influencerLinkLoading ? (
                      <ActivityIndicator size="small" color={tintColor} />
                    ) : linkedInfluencer ? (
                      <View style={{ gap: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <IconSymbol name="paperplane.fill" size={20} color={AdminColors.info} />
                          <ThemedText>
                            In pipeline · {STATUS_LABELS[linkedInfluencer.status]}
                          </ThemedText>
                        </View>
                        <Pressable
                          style={[styles.exportButton, { backgroundColor: AdminColors.info, marginHorizontal: 0, padding: 12, marginBottom: 0 }]}
                          onPress={() => {
                            setSelectedParticipant(null);
                            router.push({ pathname: '/admin/influencers' as any, params: { edit: linkedInfluencer.id } });
                          }}
                        >
                          <IconSymbol name="chevron.right" size={16} color="#fff" />
                          <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Open in Influencer Pipeline</ThemedText>
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        style={[styles.exportButton, { backgroundColor: tintColor, marginHorizontal: 0, padding: 12, marginBottom: 0 }]}
                        onPress={handleAddToInfluencerOutreach}
                        disabled={addingToInfluencer}
                      >
                        {addingToInfluencer ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <IconSymbol name="paperplane.fill" size={16} color="#fff" />
                            <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Add to Influencer Outreach</ThemedText>
                          </>
                        )}
                      </Pressable>
                    )}
                  </View>

                  <View style={[styles.modalSection, { borderTopWidth: 1, borderTopColor: cardBg, paddingTop: 16 }]}>
                    <ThemedText type="defaultSemiBold" style={{ marginBottom: 12 }}>GatherSync Account</ThemedText>
                    
                    {isLoadingUser ? (
                      <ActivityIndicator size="small" color={tintColor} />
                    ) : matchedUser ? (
                      <View style={{ gap: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <IconSymbol name="person.crop.circle.badge.checkmark" size={20} color={AdminColors.success} />
                          <ThemedText>Registered User ({matchedUser.role})</ThemedText>
                        </View>
                        
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <IconSymbol name="star.fill" size={20} color={matchedUser.isLifetimePro || matchedUser.subscriptionTier === 'pro' ? AdminColors.warning : AdminColors.gray400} />
                          <ThemedText>
                            Tier: {matchedUser.isLifetimePro ? 'Lifetime Pro' : 
                                  matchedUser.subscriptionTier === 'pro' ? 'Pro' : 
                                  matchedUser.subscriptionTier === 'enterprise' ? 'Enterprise' : 'Free'}
                          </ThemedText>
                        </View>

                        {user?.role === 'admin' && (
                          <View style={{ marginTop: 8 }}>
                            {!matchedUser.isLifetimePro && matchedUser.subscriptionTier !== 'pro' ? (
                              <View style={{ gap: 8 }}>
                                <Pressable
                                  style={[styles.exportButton, { backgroundColor: AdminColors.primary, marginHorizontal: 0, padding: 12 }]}
                                  onPress={() => {
                                    setSelectedUserForGrant({ id: matchedUser.id, name: matchedUser.name || 'User' });
                                    setShowGrantModal(true);
                                  }}
                                >
                                  <IconSymbol name="star.fill" size={16} color="#fff" />
                                  <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Grant Pro Options</ThemedText>
                                </Pressable>
                              </View>
                            ) : (
                              <Pressable
                                style={[styles.exportButton, { backgroundColor: AdminColors.error, marginHorizontal: 0, padding: 12 }]}
                                onPress={() => {
                                  if (Platform.OS === 'web') {
                                    if (confirm(`Revoke Lifetime Pro access from ${matchedUser.name}?`)) {
                                      revokeLifetimePro.mutate({ userId: matchedUser.id });
                                    }
                                  } else {
                                    Alert.alert(
                                      'Confirm Revoke',
                                      `Revoke Lifetime Pro access from ${matchedUser.name}?`,
                                      [
                                        { text: 'Cancel', style: 'cancel' },
                                        { text: 'Revoke Pro', style: 'destructive', onPress: () => revokeLifetimePro.mutate({ userId: matchedUser.id }) },
                                      ]
                                    );
                                  }
                                }}
                                disabled={revokeLifetimePro.isPending}
                              >
                                <IconSymbol name="xmark.circle.fill" size={16} color="#fff" />
                                <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Revoke Pro</ThemedText>
                              </Pressable>
                            )}
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={{ backgroundColor: cardBg, padding: 16, borderRadius: 12, gap: 12 }}>
                        <ThemedText style={{ opacity: 0.7, fontSize: 14 }}>
                          This participant hasn't created a GatherSync account yet. You can create one for them and send them a login link.
                        </ThemedText>
                        
                        <Pressable
                          style={[styles.exportButton, { backgroundColor: AdminColors.primary, marginHorizontal: 0, padding: 12, marginBottom: 0 }]}
                          onPress={() => {
                            if (!selectedParticipant.email) {
                              if (Platform.OS === 'web') {
                                const email = prompt("Enter the participant's email address to create an account:");
                                if (email) {
                                  createParticipantAccount.mutate({ name: selectedParticipant.name, email });
                                }
                              } else {
                                Alert.prompt(
                                  "Email Required",
                                  "Enter the participant's email address to create an account:",
                                  [
                                    { text: "Cancel", style: "cancel" },
                                    { text: "Create", onPress: (email?: string) => {
                                      if (email) createParticipantAccount.mutate({ name: selectedParticipant.name, email });
                                    }}
                                  ]
                                );
                              }
                            } else {
                              if (Platform.OS === 'web') {
                                if (confirm(`Create an account for ${selectedParticipant.name} (${selectedParticipant.email})?`)) {
                                  createParticipantAccount.mutate({ name: selectedParticipant.name, email: selectedParticipant.email });
                                }
                              } else {
                                Alert.alert(
                                  'Create Account',
                                  `Create an account for ${selectedParticipant.name} (${selectedParticipant.email})?`,
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    { text: 'Create', onPress: () => createParticipantAccount.mutate({ name: selectedParticipant.name, email: selectedParticipant.email! }) },
                                  ]
                                );
                              }
                            }
                          }}
                          disabled={createParticipantAccount.isPending}
                        >
                          {createParticipantAccount.isPending ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <IconSymbol name="person.badge.plus" size={16} color="#fff" />
                              <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Create Account & Send Link</ThemedText>
                            </>
                          )}
                        </Pressable>
                      </View>
                    )}
                  </View>
                </ScrollView>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add Participant Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: surfaceColor }]} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle" style={{ fontSize: 20 }}>Add Participant</ThemedText>
              <Pressable onPress={() => setShowAddModal(false)} hitSlop={8}>
                <IconSymbol name="xmark" size={24} color={tintColor} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
              <View style={{ gap: 12, marginBottom: 16 }}>
                <View style={isDesktop ? { flexDirection: 'row', gap: 12 } : { gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ marginBottom: 4, fontWeight: '500', fontSize: 13 }}>Name *</ThemedText>
                    <TextInput
                      style={[styles.searchInput, { backgroundColor: cardBg, color: tintColor, paddingVertical: 8, paddingHorizontal: 12, fontSize: 14 }]}
                      placeholder="e.g. John Doe"
                      placeholderTextColor="#999"
                      value={addName}
                      onChangeText={setAddName}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ marginBottom: 4, fontWeight: '500', fontSize: 13 }}>Select Event (Optional)</ThemedText>
                    <View style={{ backgroundColor: cardBg, borderRadius: 8, overflow: 'hidden' }}>
                      {Platform.OS === 'web' ? (
                        <select
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            backgroundColor: 'transparent',
                            color: tintColor,
                            border: 'none',
                            outline: 'none',
                            fontSize: 14,
                            height: 38,
                          }}
                          value={addEventId}
                          onChange={(e) => setAddEventId(e.target.value)}
                        >
                          <option value="">None (Add as Prospect)</option>
                          {events.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name} ({e.eventType === 'fixed' ? e.fixedDate : `${e.month}/${e.year}`})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <ScrollView style={{ maxHeight: 120 }}>
                          <Pressable
                            style={{
                              padding: 8,
                              paddingHorizontal: 12,
                              borderBottomWidth: 1,
                              borderBottomColor: 'rgba(0,0,0,0.05)',
                              backgroundColor: addEventId === '' ? tintColor + '20' : 'transparent',
                            }}
                            onPress={() => setAddEventId('')}
                          >
                            <ThemedText style={{ color: addEventId === '' ? tintColor : undefined, fontSize: 14 }}>
                              None (Add as Prospect)
                            </ThemedText>
                          </Pressable>
                          {events.map((e) => (
                            <Pressable
                              key={e.id}
                              style={{
                                padding: 8,
                                paddingHorizontal: 12,
                                borderBottomWidth: 1,
                                borderBottomColor: 'rgba(0,0,0,0.05)',
                                backgroundColor: addEventId === e.id ? tintColor + '20' : 'transparent',
                              }}
                              onPress={() => setAddEventId(e.id)}
                            >
                              <ThemedText style={{ color: addEventId === e.id ? tintColor : undefined, fontSize: 14 }}>
                                {e.name}
                              </ThemedText>
                              <ThemedText style={{ fontSize: 11, opacity: 0.7 }}>
                                {e.eventType === 'fixed' ? e.fixedDate : `${e.month}/${e.year}`}
                              </ThemedText>
                            </Pressable>
                          ))}
                        </ScrollView>
                      )}
                    </View>
                  </View>
                </View>

                <View style={isDesktop ? { flexDirection: 'row', gap: 12 } : { gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ marginBottom: 4, fontWeight: '500', fontSize: 13 }}>Phone (Optional)</ThemedText>
                    <TextInput
                      style={[styles.searchInput, { backgroundColor: cardBg, color: tintColor, paddingVertical: 8, paddingHorizontal: 12, fontSize: 14 }]}
                      placeholder="e.g. 0400 000 000"
                      placeholderTextColor="#999"
                      value={addPhone}
                      onChangeText={setAddPhone}
                      keyboardType="phone-pad"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ marginBottom: 4, fontWeight: '500', fontSize: 13 }}>Email (Optional)</ThemedText>
                    <TextInput
                      style={[styles.searchInput, { backgroundColor: cardBg, color: tintColor, paddingVertical: 8, paddingHorizontal: 12, fontSize: 14 }]}
                      placeholder="e.g. john@example.com"
                      placeholderTextColor="#999"
                      value={addEmail}
                      onChangeText={setAddEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View style={{ marginTop: 12 }}>
                  <ThemedText style={{ marginBottom: 4, fontWeight: '500', fontSize: 13 }}>Title or Designation (Optional)</ThemedText>
                  <TextInput
                    style={[styles.searchInput, { backgroundColor: cardBg, color: tintColor, paddingVertical: 8, paddingHorizontal: 12, fontSize: 14 }]}
                    placeholder="e.g. Director, Treasurer, VIP"
                    placeholderTextColor="#999"
                    value={addDesignation}
                    onChangeText={setAddDesignation}
                    autoCapitalize="words"
                  />
                </View>

                <View style={{ marginTop: 12 }}>
                  <ThemedText style={{ marginBottom: 4, fontWeight: '500', fontSize: 13 }}>Company or Organization (Optional)</ThemedText>
                  <TextInput
                    style={[styles.searchInput, { backgroundColor: cardBg, color: tintColor, paddingVertical: 8, paddingHorizontal: 12, fontSize: 14 }]}
                    placeholder="e.g. Acme Corp, GatherSync"
                    placeholderTextColor="#999"
                    value={addOrganization}
                    onChangeText={setAddOrganization}
                    autoCapitalize="words"
                  />
                </View>

                <View style={{ marginTop: 12 }}>
                  <ThemedText style={{ marginBottom: 4, fontWeight: '500', fontSize: 13 }}>Lead Source (Optional)</ThemedText>
                  <TextInput
                    style={[styles.searchInput, { backgroundColor: cardBg, color: tintColor, paddingVertical: 8, paddingHorizontal: 12, fontSize: 14 }]}
                    placeholder="e.g. Letterbox, Trade Show, Referral"
                    placeholderTextColor="#999"
                    value={addLeadSource}
                    onChangeText={setAddLeadSource}
                    autoCapitalize="words"
                  />
                </View>

                <View style={{ marginTop: 12 }}>
                  <ThemedText style={{ marginBottom: 4, fontWeight: '500', fontSize: 13 }}>Digital Twin URL (Optional)</ThemedText>
                  <TextInput
                    style={[styles.searchInput, { backgroundColor: cardBg, color: tintColor, paddingVertical: 8, paddingHorizontal: 12, fontSize: 14 }]}
                    placeholder="https://getbizcard.com/your-name"
                    placeholderTextColor="#999"
                    value={addDigitalTwinUrl}
                    onChangeText={setAddDigitalTwinUrl}
                    keyboardType="url"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <Pressable
                style={[styles.exportButton, { backgroundColor: tintColor, marginBottom: 20, paddingVertical: 12 }]}
                onPress={handleAddParticipant}
              >
                <ThemedText style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                  {addEventId === '' ? 'Save Prospect' : 'Add to Event'}
                </ThemedText>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      {/* Filter Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showFilterModal}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowFilterModal(false)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: surfaceColor, width: isDesktop ? 500 : '90%', maxHeight: '80%' }]}
            onPress={e => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">Filter by Event</ThemedText>
              <Pressable
                onPress={() => setShowFilterModal(false)}
                style={styles.closeButton}
              >
                <IconSymbol name="xmark" size={24} color={tintColor} />
              </Pressable>
            </View>

            <ScrollView style={{ marginTop: 16 }}>
              <Pressable
                style={[
                  styles.menuItem,
                  { borderBottomColor: cardBg, borderBottomWidth: 1 },
                  filterEventId === 'all' && { backgroundColor: tintColor + '15' }
                ]}
                onPress={() => {
                  setFilterEventId('all');
                  setShowFilterModal(false);
                }}
              >
                <ThemedText style={[styles.menuItemText, filterEventId === 'all' && { fontWeight: 'bold', color: tintColor }]}>
                  All Events
                </ThemedText>
                {filterEventId === 'all' && (
                  <IconSymbol name="checkmark" size={16} color={tintColor} />
                )}
              </Pressable>

              <Pressable
                style={[
                  styles.menuItem,
                  { borderBottomColor: cardBg, borderBottomWidth: 1 },
                  filterEventId === 'prospects' && { backgroundColor: tintColor + '15' }
                ]}
                onPress={() => {
                  setFilterEventId('prospects');
                  setShowFilterModal(false);
                }}
              >
                <ThemedText style={[styles.menuItemText, filterEventId === 'prospects' && { fontWeight: 'bold', color: tintColor }]}>
                  Prospects Only
                </ThemedText>
                {filterEventId === 'prospects' && (
                  <IconSymbol name="checkmark" size={16} color={tintColor} />
                )}
              </Pressable>

              {events.map((event) => (
                <Pressable
                  key={event.id}
                  style={[
                    styles.menuItem,
                    { borderBottomColor: cardBg, borderBottomWidth: 1 },
                    filterEventId === event.id && { backgroundColor: tintColor + '15' }
                  ]}
                  onPress={() => {
                    setFilterEventId(event.id);
                    setShowFilterModal(false);
                  }}
                >
                  <ThemedText style={[styles.menuItemText, filterEventId === event.id && { fontWeight: 'bold', color: tintColor }]}>
                    {event.name}
                  </ThemedText>
                  {filterEventId === event.id && (
                    <IconSymbol name="checkmark" size={16} color={tintColor} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Sort Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showSortModal}
        onRequestClose={() => setShowSortModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowSortModal(false)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: surfaceColor, width: isDesktop ? 500 : '90%', maxHeight: '80%' }]}
            onPress={e => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">Sort Participants</ThemedText>
              <Pressable
                onPress={() => setShowSortModal(false)}
                style={styles.closeButton}
              >
                <IconSymbol name="xmark" size={24} color={tintColor} />
              </Pressable>
            </View>

            <ScrollView style={{ marginTop: 16 }}>
              {(['firstName', 'lastName', 'phone', 'event', 'source'] as const).map((option) => (
                <Pressable
                  key={option}
                  style={[
                    styles.menuItem,
                    { borderBottomColor: cardBg, borderBottomWidth: 1 },
                    sortBy === option && { backgroundColor: tintColor + '15' }
                  ]}
                  onPress={() => {
                    setSortBy(option);
                    setShowSortModal(false);
                  }}
                >
                  <ThemedText style={[styles.menuItemText, sortBy === option && { fontWeight: 'bold', color: tintColor }]}>
                    {option === 'firstName' ? 'First Name' : option === 'lastName' ? 'Last Name' : option === 'phone' ? 'Phone' : option === 'event' ? 'Event' : 'Source'}
                  </ThemedText>
                  {sortBy === option && (
                    <IconSymbol name="checkmark" size={16} color={tintColor} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Actions Menu */}
      <Modal
        visible={showActionsMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionsMenu(false)}
      >
        <Pressable
          style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center' }]}
          onPress={() => setShowActionsMenu(false)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: surfaceColor, width: isDesktop ? 420 : '90%', maxHeight: '80%' }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
              <ThemedText style={{ fontSize: 13, fontWeight: '900', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Filtered List Actions
              </ThemedText>
              <ThemedText style={{ fontSize: 13, color: '#999', marginTop: 4 }}>
                {filteredParticipants.length} participant{filteredParticipants.length === 1 ? '' : 's'} in current view
              </ThemedText>
            </View>
            <Pressable
              style={[styles.menuItem, { borderBottomColor: '#eee' }]}
              onPress={() => {
                setShowActionsMenu(false);
                if (filteredParticipants.length === 0) {
                  Alert.alert('No Participants', 'Adjust your filters to include participants first.');
                  return;
                }
                setShowBulkAddModal(true);
              }}
            >
              <ThemedText style={styles.menuItemText}>Add Filtered to Event...</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.menuItem, { borderBottomColor: '#eee' }]}
              onPress={() => {
                setShowActionsMenu(false);
                exportParticipantList(filteredParticipants);
              }}
            >
              <ThemedText style={styles.menuItemText}>Export Filtered List (CSV)</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.menuItem, { borderBottomColor: '#eee' }]}
              onPress={() => {
                setShowActionsMenu(false);
                router.push('/import-contacts?eventId=prospects');
              }}
            >
              <ThemedText style={styles.menuItemText}>Import Contact List (CSV)</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Bulk Add to Event Modal */}
      <Modal
        visible={showBulkAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => !bulkAddInProgress && setShowBulkAddModal(false)}
      >
        <Pressable
          style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center' }]}
          onPress={() => !bulkAddInProgress && setShowBulkAddModal(false)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: surfaceColor, width: isDesktop ? 500 : '90%', maxHeight: '80%' }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <ThemedText style={{ fontSize: 18, fontWeight: '700' }}>Add to Event</ThemedText>
                <ThemedText style={{ fontSize: 13, color: '#999', marginTop: 4 }}>
                  Add {filteredParticipants.length} filtered participant{filteredParticipants.length === 1 ? '' : 's'}
                </ThemedText>
              </View>
              <Pressable onPress={() => !bulkAddInProgress && setShowBulkAddModal(false)} style={{ padding: 4 }}>
                <IconSymbol name="xmark" size={20} color="#999" />
              </Pressable>
            </View>
            {bulkAddInProgress ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={tintColor} />
                <ThemedText style={{ marginTop: 12, color: '#999' }}>Adding participants...</ThemedText>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {events.map(event => (
                  <Pressable
                    key={event.id}
                    style={[styles.menuItem, { borderBottomColor: '#eee' }]}
                    onPress={() => handleBulkAddToEvent(event.id)}
                  >
                    <View>
                      <ThemedText style={styles.menuItemText}>{event.name}</ThemedText>
                      <ThemedText style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                        {event.eventType === 'fixed' && event.fixedDate
                          ? new Date(event.fixedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : `${event.month}/${event.year}`}
                      </ThemedText>
                    </View>
                  </Pressable>
                ))}
                {events.length === 0 && (
                  <View style={{ padding: 20 }}>
                    <ThemedText style={{ color: '#999', textAlign: 'center' }}>No active events found. Create an event first.</ThemedText>
                  </View>
                )}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Grant Pro Modal */}
      <Modal
        visible={showGrantModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowGrantModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: surfaceColor, borderRadius: 12, padding: 24, width: '90%', maxWidth: 400 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <ThemedText style={{ fontSize: 20, fontWeight: '700' }}>Grant Pro Access</ThemedText>
              <Pressable onPress={() => setShowGrantModal(false)} style={{ padding: 4 }}>
                <IconSymbol name="xmark" size={24} color={AdminColors.gray500} />
              </Pressable>
            </View>
            <ThemedText style={{ fontSize: 14, color: AdminColors.gray500, marginBottom: 24 }}>
              Select a duration to gift Pro access to {selectedUserForGrant?.name}.
            </ThemedText>
            
            <View style={{ gap: 12 }}>
              <Pressable 
                style={styles.modalOptionBtn}
                onPress={() => handleGrantTemporaryPro(30)}
              >
                <ThemedText style={styles.modalOptionText}>30 Days Free</ThemedText>
              </Pressable>
              
              <Pressable 
                style={styles.modalOptionBtn}
                onPress={() => handleGrantTemporaryPro(60)}
              >
                <ThemedText style={styles.modalOptionText}>60 Days Free</ThemedText>
              </Pressable>

              <Pressable 
                style={styles.modalOptionBtn}
                onPress={() => handleGrantTemporaryPro(180)}
              >
                <ThemedText style={styles.modalOptionText}>6 Months Free</ThemedText>
              </Pressable>

              <Pressable 
                style={styles.modalOptionBtn}
                onPress={() => handleGrantTemporaryPro(365)}
              >
                <ThemedText style={styles.modalOptionText}>1 Year Free</ThemedText>
              </Pressable>

              <View style={{ height: 1, backgroundColor: AdminColors.border, marginVertical: 12 }} />

              <Pressable 
                style={[styles.modalOptionBtn, { backgroundColor: AdminColors.gray800 }]}
                onPress={handleGrantLifetimeProClick}
              >
                <ThemedText style={[styles.modalOptionText, { color: '#fff' }]}>Lifetime Pro</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  controls: {
    paddingHorizontal: 20,
    marginBottom: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchRow: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sortControls: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  searchInput: {
    paddingVertical: 12,
    paddingLeft: 0,
    paddingRight: 8,
    fontSize: 16,
    flex: 1,
    minWidth: 0,
  },
  searchInputWithClear: {
    paddingRight: 36,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
    position: 'relative',
    width: '100%',
  },
  searchClearButton: {
    position: 'absolute',
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    ...Platform.select({ web: { cursor: 'pointer' as const } }),
  },
  summary: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  summaryLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  missingSummaryCard: {
    borderWidth: 1,
    borderColor: AdminColors.warning + '40',
  },
  missingFieldText: {
    color: AdminColors.warning,
    fontStyle: 'italic',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  participantList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  participantListGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: '2%',
    paddingBottom: 80,
  },
  participantCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  participantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  participantInfo: {
    flex: 1,
    gap: 8,
  },
  participantMeta: {
    gap: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    opacity: 0.7,
  },
  eventBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  eventBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  eventList: {
    gap: 8,
  },
  eventListTitle: {
    fontSize: 12,
    opacity: 0.7,
  },
  eventChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  eventChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  eventChipText: {
    fontSize: 11,
    fontWeight: '500',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 60 : 40,
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 24,
    paddingBottom: 60,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalOptionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: AdminColors.gray100,
    borderRadius: 8,
    alignItems: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '600' as any,
    color: AdminColors.gray800,
  },
  closeButton: {
    padding: 8,
  },
  menuItem: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
