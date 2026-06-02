import { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Pressable,
  TextInput,
  Platform,
  Alert,
  Modal,
  Share,
  useWindowDimensions,
  Switch,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DesktopLayout } from '@/components/desktop-layout';
import { OutreachDateField, formatDisplayDate, todayIsoDate } from '@/components/outreach-date-field';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/use-auth';
import { influencersLocalStorage } from '@/lib/influencer-storage';
import { addContactToProspectsDirectory } from '@/lib/prospects-directory';
import {
  PROSPECT_TYPE_GUIDES,
  STATUS_LABELS,
  STATUS_ORDER,
  TYPE_LABELS,
  TRACK_LABELS,
  OUTREACH_TEMPLATES,
  getTypeGuide,
  getOutreachSegmentForRecord,
  resolveOutreachTrack,
} from '@/lib/influencer-playbook';
import {
  INFLUENCER_DOCUMENTS,
  INFLUENCER_PODCASTS,
  INFLUENCER_DEMO_VIDEOS,
  REPLY_KIT_TEMPLATES,
  SOCIAL_POST_TEMPLATES,
  LINKEDIN_FIRST_TOUCH_TEMPLATES,
  HEYGEN_SCRIPT_TEMPLATES,
  GIFT_OFFER_PRESETS,
  getPublicResourceUrl,
  getDemoVideoUrl,
  getDefaultOutreachAvatarVideoUrl,
  mergeOutreachPlaceholders,
  buildHeyGenMcpPrompt,
  type OutreachSegmentKey,
} from '@/lib/influencer-resources';
import {
  generateProspectOutreach,
  getDefaultOutreachSettings,
  getSegmentSettings,
  loadOutreachSettings,
  saveOutreachSettings,
  resetOutreachSettings,
  type OutreachSettings,
} from '@/lib/influencer-outreach-settings';
import { AdminColors } from '@/constants/admin-theme';
import { computeOutreachAnalytics, formatCurrency, formatRate, getProspectActivityTimeline } from '@/lib/influencer-analytics';
import { parseLinkedInPaste } from '@/lib/linkedin-paste-parser';
import type {
  InfluencerProspect,
  InfluencerProspectType,
  InfluencerPriorityTier,
  InfluencerStatus,
  OutreachTrack,
} from '@/types/models';

type Tab = 'pipeline' | 'playbook' | 'templates' | 'resources' | 'reports';
type StatusFilter = 'all' | InfluencerStatus | 'in_progress';
type TrackFilter = 'all' | OutreachTrack;

const NICHE_TYPE_GUIDES = PROSPECT_TYPE_GUIDES.filter(g => g.id !== 'directory_prospect');

const emptyForm = (): Omit<InfluencerProspect, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: '',
  platform: '',
  handleUrl: '',
  niche: '',
  followersOrMembers: '',
  recurringGroup: false,
  groupNameFrequency: '',
  prospectType: 'mastermind',
  outreachTrack: 'influencer',
  scoreOutOf25: undefined,
  priorityTier: 'A',
  contactEmail: '',
  contactPhone: '',
  websiteUrl: '',
  contactLinkedIn: '',
  outreachDate: '',
  fullDmSentDate: '',
  followUp1Date: '',
  followUp2Date: '',
  status: 'research',
  lifetimeProGranted: false,
  grantDate: '',
  onboardingCallDone: false,
  deliverableAgreed: '',
  deliverableDone: false,
  referralLink: '',
  signupsFromRef: undefined,
  saleAmount: undefined,
  saleDate: '',
  saleNotes: '',
  personalVideoUrl: '',
  giftOffer: '',
  heyGenScriptDraft: '',
  linkedInDmDraft: '',
  smsDraft: '',
  notes: '',
  participantDirectoryId: undefined,
  addedToParticipantDirectoryAt: undefined,
});

export default function AdminInfluencersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ edit?: string }>();
  const openedFromParam = useRef<string | null>(null);
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const tintColor = useThemeColor({}, 'tint');
  const cardBg = useThemeColor({ light: '#f5f5f5', dark: '#2a2a2a' }, 'background');
  const surfaceColor = useThemeColor({ light: '#fff', dark: '#1a1a1a' }, 'background');

  const [tab, setTab] = useState<Tab>('pipeline');
  const [prospects, setProspects] = useState<InfluencerProspect[]>([]);
  const [filtered, setFiltered] = useState<InfluencerProspect[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [trackFilter, setTrackFilter] = useState<TrackFilter>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | InfluencerProspectType>('all');
  const [showModal, setShowModal] = useState(false);
  const [modalReturnTab, setModalReturnTab] = useState<Tab | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [expandedGuide, setExpandedGuide] = useState<string | null>(null);
  const [expandedReply, setExpandedReply] = useState<string | null>(null);
  const [expandedSocial, setExpandedSocial] = useState<string | null>(null);
  const [expandedLinkedIn, setExpandedLinkedIn] = useState<string | null>(null);
  const [expandedHeyGen, setExpandedHeyGen] = useState<string | null>(null);
  const [outreachSettings, setOutreachSettings] = useState<Partial<OutreachSettings>>({});
  const [editingSegmentSettings, setEditingSegmentSettings] = useState<OutreachSegmentKey | null>(null);
  const [linkedInPasteText, setLinkedInPasteText] = useState('');
  const [showLinkedInImport, setShowLinkedInImport] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ tone: 'info' | 'success' | 'error'; text: string } | null>(null);

  const getFirstName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return '[First name]';
    return trimmed.split(/\s+/)[0];
  };

  const getOutreachSegment = (p: Pick<InfluencerProspect, 'prospectType' | 'outreachTrack'>): OutreachSegmentKey =>
    getOutreachSegmentForRecord(p);

  const outreachCtx = (p: {
    name?: string;
    groupNameFrequency?: string;
    giftOffer?: string;
    personalVideoUrl?: string;
  }) => ({
    firstName: getFirstName(p.name || ''),
    groupName: p.groupNameFrequency,
    giftOffer: p.giftOffer,
    personalVideoUrl: p.personalVideoUrl,
    origin: getOrigin(),
  });

  const regenerateOutreachDrafts = (p: {
    name?: string;
    prospectType?: InfluencerProspectType;
    outreachTrack?: OutreachTrack;
    groupNameFrequency?: string;
    giftOffer?: string;
    personalVideoUrl?: string;
  }) => {
    const segment = getOutreachSegment({
      prospectType: p.prospectType || 'mastermind',
      outreachTrack: p.outreachTrack || 'influencer',
    });
    const generated = generateProspectOutreach(segment, outreachCtx(p), outreachSettings);
    return {
      heyGenScriptDraft: generated.heyGen,
      linkedInDmDraft: generated.linkedIn,
      smsDraft: generated.sms || '',
      giftOffer: p.giftOffer?.trim() || generated.defaultGift,
    };
  };

  const getEffectiveSms = (p: InfluencerProspect | typeof form) => {
    const draft = p.smsDraft?.trim();
    const segment = getOutreachSegment({
      prospectType: p.prospectType || 'other',
      outreachTrack: p.outreachTrack || resolveOutreachTrack(p),
    });
    const base =
      draft ||
      generateProspectOutreach(segment, outreachCtx(p), outreachSettings).sms ||
      '';
    return mergeOutreachPlaceholders(base, outreachCtx(p));
  };

  const getEffectiveHeyGenScript = (p: InfluencerProspect | typeof form) => {
    const draft = p.heyGenScriptDraft?.trim();
    const segment = getOutreachSegment({
      prospectType: p.prospectType || 'mastermind',
      outreachTrack: p.outreachTrack || resolveOutreachTrack(p),
    });
    const base =
      draft ||
      generateProspectOutreach(segment, outreachCtx(p), outreachSettings).heyGen;
    return mergeOutreachPlaceholders(base, outreachCtx(p));
  };

  const getEffectiveLinkedInDm = (p: InfluencerProspect | typeof form) => {
    const draft = p.linkedInDmDraft?.trim();
    const segment = getOutreachSegment({
      prospectType: p.prospectType || 'mastermind',
      outreachTrack: p.outreachTrack || resolveOutreachTrack(p),
    });
    const base =
      draft ||
      generateProspectOutreach(segment, outreachCtx(p), outreachSettings).linkedIn;
    return mergeOutreachPlaceholders(base, outreachCtx(p));
  };

  const buildLinkedInMessage = (p: InfluencerProspect | typeof form) => getEffectiveLinkedInDm(p);

  const buildHeyGenScript = (p: InfluencerProspect | typeof form) => getEffectiveHeyGenScript(p);

  const getLinkedInUrl = (p: { contactLinkedIn?: string; handleUrl?: string }) => {
    const url = p.contactLinkedIn?.trim() || p.handleUrl?.trim();
    if (!url) return undefined;
    return url.startsWith('http') ? url : `https://${url}`;
  };

  const openLinkedIn = (p: { contactLinkedIn?: string; handleUrl?: string }) => {
    const href = getLinkedInUrl(p);
    if (!href) {
      Alert.alert('No LinkedIn URL', 'Add a LinkedIn profile URL on this prospect first.');
      return;
    }
    if (Platform.OS === 'web') window.open(href, '_blank');
    else Linking.openURL(href);
  };

  const getOrigin = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
    return 'https://app.gathersync.app';
  };

  const openResource = (path: string) => {
    const url = getPublicResourceUrl(path, getOrigin());
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const copyResourceLink = async (path: string, title: string) => {
    const url = getPublicResourceUrl(path, getOrigin());
    await copyText(url, `${title} link`);
  };

  const buildReplyBody = (_templateId: string, body: string) =>
    mergeOutreachPlaceholders(body, { origin: getOrigin() });

  const handleGrantLifetimePro = () => {
    if (!form.contactEmail?.trim()) {
      Alert.alert('Email required', 'Add a contact email first.');
      return;
    }
    Alert.alert(
      'Grant Lifetime Pro',
      `Search for ${form.contactEmail} in User Management and grant Lifetime Pro there, then mark this prospect as granted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open User Management',
          onPress: () => {
            router.push({ pathname: '/admin/users' as any, params: { search: form.contactEmail!.trim() } });
          },
        },
        {
          text: 'Mark as Granted',
          onPress: async () => {
            const today = new Date().toISOString().split('T')[0];
            setForm(f => ({
              ...f,
              lifetimeProGranted: true,
              grantDate: today,
              status: 'lifetime_granted',
            }));
            if (editingId) {
              await influencersLocalStorage.update(editingId, {
                lifetimeProGranted: true,
                grantDate: today,
                status: 'lifetime_granted',
              });
              loadProspects();
            }
          },
        },
      ]
    );
  };

  const buildParticipantNotes = () => {
    const lines: string[] = [];
    if (form.notes?.trim()) lines.push(form.notes.trim());
    if (form.platform?.trim()) lines.push(`Platform: ${form.platform.trim()}`);
    if (form.handleUrl?.trim()) lines.push(`Profile: ${form.handleUrl.trim()}`);
    if (form.contactLinkedIn?.trim()) lines.push(`LinkedIn: ${form.contactLinkedIn.trim()}`);
    if (form.referralLink?.trim()) lines.push(`Referral: ${form.referralLink.trim()}`);
    if (form.personalVideoUrl?.trim()) lines.push(`Intro video: ${form.personalVideoUrl.trim()}`);
    if (form.giftOffer?.trim()) lines.push(`Gift: ${form.giftOffer.trim()}`);
    if (form.deliverableAgreed?.trim()) lines.push(`Deliverable: ${form.deliverableAgreed.trim()}`);
    return lines.join('\n');
  };

  const handleAddToParticipantDirectory = async () => {
    if (!form.name.trim()) {
      Alert.alert('Name required', 'Add a name before adding to the Participant Directory.');
      return;
    }

    try {
      const { participant, created } = await addContactToProspectsDirectory(
        {
          name: form.name.trim(),
          email: form.contactEmail?.trim() || undefined,
          phone: form.contactPhone?.trim() || undefined,
          organization: form.groupNameFrequency?.trim() || form.niche?.trim() || undefined,
          designation: form.niche?.trim() || undefined,
          leadSource: `Influencer · ${TYPE_LABELS[form.prospectType]}`,
          notes: buildParticipantNotes() || undefined,
        },
        { syncToCloud: isAuthenticated }
      );

      const addedAt = new Date().toISOString();
      const updates = {
        participantDirectoryId: participant.id,
        addedToParticipantDirectoryAt: addedAt,
      };

      const payload = {
        ...form,
        name: form.name.trim(),
        scoreOutOf25: form.scoreOutOf25 ? Number(form.scoreOutOf25) : undefined,
        signupsFromRef: form.signupsFromRef != null && form.signupsFromRef !== ('' as unknown as number)
          ? Number(form.signupsFromRef)
          : undefined,
        ...updates,
      };

      if (editingId) {
        await influencersLocalStorage.update(editingId, payload);
      } else {
        const created = await influencersLocalStorage.add(payload);
        setEditingId(created.id);
      }

      setForm(f => ({ ...f, ...updates }));
      loadProspects();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        created ? 'Added to Directory' : 'Updated in Directory',
        `${form.name.trim()} is now in Participant Directory. You can schedule meetings and use all GatherSync features with them.`,
        [
          { text: 'Stay Here', style: 'cancel' },
          {
            text: 'Open Directory',
            onPress: () => {
              setShowModal(false);
              router.push('/admin/participants?filter=prospects' as any);
            },
          },
        ]
      );
    } catch (error) {
      console.error('[Influencers] Add to directory failed:', error);
      Alert.alert('Error', 'Failed to add to Participant Directory.');
    }
  };

  const loadProspects = async () => {
    const list = await influencersLocalStorage.getAll();
    const normalized = list.map(p => ({
      ...p,
      outreachTrack: p.outreachTrack ?? resolveOutreachTrack(p),
    }));
    const needsTrackMigration = list.some(p => !p.outreachTrack);
    if (needsTrackMigration) {
      await influencersLocalStorage.saveAll(normalized);
    }
    normalized.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setProspects(normalized);
  };

  const syncFromCloud = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncStatus({ tone: 'info', text: 'Syncing with cloud…' });
    try {
      const list = await influencersLocalStorage.syncFromCloud();
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setProspects(list);
      const message = `Synced — ${list.length} contact${list.length === 1 ? '' : 's'} in your pipeline.`;
      setSyncStatus({ tone: 'success', text: message });
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Synced', `${list.length} contact${list.length === 1 ? '' : 's'} loaded from your account.`);
      }
    } catch (error) {
      console.error('[Influencers] Cloud sync failed:', error);
      const message = 'Sync failed. Check you are logged in and the server is updated.';
      setSyncStatus({ tone: 'error', text: message });
      if (Platform.OS !== 'web') {
        Alert.alert('Sync failed', message);
      }
    } finally {
      setSyncing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadProspects();
      loadOutreachSettings().then(setOutreachSettings);
    }, [])
  );

  useEffect(() => {
    let list = [...prospects];
    if (trackFilter !== 'all') {
      list = list.filter(p => resolveOutreachTrack(p) === trackFilter);
    }
    if (statusFilter === 'in_progress') {
      list = list.filter(p => ['contacted', 'follow_up_1', 'follow_up_2', 'interested'].includes(p.status));
    } else if (statusFilter !== 'all') {
      list = list.filter(p => p.status === statusFilter);
    }
    if (typeFilter !== 'all') list = list.filter(p => p.prospectType === typeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.platform?.toLowerCase().includes(q) ||
        p.niche?.toLowerCase().includes(q) ||
        p.contactEmail?.toLowerCase().includes(q) ||
        p.contactPhone?.toLowerCase().includes(q) ||
        p.websiteUrl?.toLowerCase().includes(q) ||
        p.notes?.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [prospects, searchQuery, statusFilter, typeFilter, trackFilter]);

  const hasActiveFilters =
    trackFilter !== 'all' ||
    statusFilter !== 'all' ||
    typeFilter !== 'all' ||
    searchQuery.trim().length > 0;

  const clearAllFilters = () => {
    setTrackFilter('all');
    setStatusFilter('all');
    setTypeFilter('all');
    setSearchQuery('');
  };

  const stats = {
    total: filtered.length,
    research: filtered.filter(p => p.status === 'research').length,
    inProgress: filtered.filter(p => ['contacted', 'follow_up_1', 'follow_up_2', 'interested'].includes(p.status)).length,
    lifetime: filtered.filter(p => p.lifetimeProGranted || p.status === 'lifetime_granted' || p.status === 'active').length,
  };

  const analytics = computeOutreachAnalytics(prospects);

  const openAdd = (type?: InfluencerProspectType) => {
    setEditingId(null);
    setModalReturnTab(null);
    const outreachTrack: OutreachTrack =
      trackFilter === 'prospect' ? 'prospect' : trackFilter === 'influencer' ? 'influencer' : 'influencer';
    const prospectType = type || (outreachTrack === 'prospect' ? 'other' : 'mastermind');
    const base = {
      ...emptyForm(),
      prospectType,
      outreachTrack,
      priorityTier: outreachTrack === 'prospect' ? 'C' as InfluencerPriorityTier : 'A',
      platform: outreachTrack === 'prospect' ? 'Participant Directory' : '',
    };
    setForm({ ...base, ...regenerateOutreachDrafts(base) });
    setLinkedInPasteText('');
    setShowLinkedInImport(true);
    setShowModal(true);
  };

  const closeProspectModal = (returnToTab = false) => {
    setShowModal(false);
    setLinkedInPasteText('');
    if (returnToTab && modalReturnTab) setTab(modalReturnTab);
    setModalReturnTab(null);
  };

  const applyLinkedInPaste = () => {
    const parsed = parseLinkedInPaste(linkedInPasteText);
    if (!parsed.name && !parsed.contactLinkedIn && !parsed.niche) {
      Alert.alert(
        'Could not parse',
        parsed.warnings[0] || 'Paste a LinkedIn profile URL or copy name + headline from the profile.'
      );
      return;
    }

    const merged = {
      ...form,
      name: parsed.name || form.name,
      niche: parsed.niche || form.niche,
      contactLinkedIn: parsed.contactLinkedIn || form.contactLinkedIn,
      handleUrl: parsed.contactLinkedIn || form.handleUrl,
      websiteUrl: parsed.websiteUrl || form.websiteUrl,
      contactEmail: parsed.contactEmail || form.contactEmail,
      followersOrMembers: parsed.followersOrMembers || form.followersOrMembers,
      groupNameFrequency: parsed.groupNameFrequency || form.groupNameFrequency,
      notes: parsed.notes
        ? [form.notes?.trim(), parsed.notes.trim()].filter(Boolean).join('\n\n')
        : form.notes,
      prospectType: parsed.prospectType || form.prospectType,
      platform: parsed.platform || form.platform || 'LinkedIn',
      outreachTrack: form.outreachTrack === 'prospect' ? 'influencer' as OutreachTrack : form.outreachTrack,
      recurringGroup: parsed.recurringGroup ?? form.recurringGroup,
    };
    setForm({ ...merged, ...regenerateOutreachDrafts(merged) });
    setLinkedInPasteText('');
    setShowLinkedInImport(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const filled = [
      parsed.name && 'name',
      parsed.niche && 'headline',
      parsed.contactLinkedIn && 'LinkedIn URL',
      parsed.contactEmail && 'email',
      parsed.websiteUrl && 'website',
    ].filter(Boolean);
    const warningNote = parsed.warnings.length ? `\n\nNote: ${parsed.warnings.join(' ')}` : '';
    Alert.alert(
      'Imported from LinkedIn',
      `Filled ${filled.join(', ') || 'fields'}. Review and save.${warningNote}`
    );
  };

  const openEdit = (p: InfluencerProspect, returnTab?: Tab) => {
    setEditingId(p.id);
    setModalReturnTab(returnTab || null);
    const base = {
      name: p.name,
      platform: p.platform || '',
      handleUrl: p.handleUrl || '',
      niche: p.niche || '',
      followersOrMembers: p.followersOrMembers || '',
      recurringGroup: p.recurringGroup,
      groupNameFrequency: p.groupNameFrequency || '',
      prospectType: p.prospectType,
      outreachTrack: resolveOutreachTrack(p),
      scoreOutOf25: p.scoreOutOf25,
      priorityTier: p.priorityTier,
      contactEmail: p.contactEmail || '',
      contactPhone: p.contactPhone || '',
      websiteUrl: p.websiteUrl || '',
      contactLinkedIn: p.contactLinkedIn || p.handleUrl || '',
      outreachDate: p.outreachDate || '',
      fullDmSentDate: p.fullDmSentDate || '',
      followUp1Date: p.followUp1Date || '',
      followUp2Date: p.followUp2Date || '',
      status: p.status,
      lifetimeProGranted: p.lifetimeProGranted,
      grantDate: p.grantDate || '',
      onboardingCallDone: p.onboardingCallDone,
      deliverableAgreed: p.deliverableAgreed || '',
      deliverableDone: p.deliverableDone,
      referralLink: p.referralLink || '',
      signupsFromRef: p.signupsFromRef,
      saleAmount: p.saleAmount,
      saleDate: p.saleDate || '',
      saleNotes: p.saleNotes || '',
      personalVideoUrl: p.personalVideoUrl || '',
      giftOffer: p.giftOffer || '',
      heyGenScriptDraft: p.heyGenScriptDraft || '',
      linkedInDmDraft: p.linkedInDmDraft || '',
      smsDraft: p.smsDraft || '',
      notes: p.notes || '',
      participantDirectoryId: p.participantDirectoryId,
      addedToParticipantDirectoryAt: p.addedToParticipantDirectoryAt,
    };
    const drafts = regenerateOutreachDrafts(base);
    setForm({
      ...base,
      giftOffer: base.giftOffer || drafts.giftOffer,
      heyGenScriptDraft: base.heyGenScriptDraft || drafts.heyGenScriptDraft,
      linkedInDmDraft: base.linkedInDmDraft || drafts.linkedInDmDraft,
      smsDraft: base.smsDraft || drafts.smsDraft,
    });
    setLinkedInPasteText('');
    setShowLinkedInImport(false);
    setShowModal(true);
  };

  useEffect(() => {
    const editId = typeof params.edit === 'string' ? params.edit : undefined;
    if (!editId || prospects.length === 0 || openedFromParam.current === editId) return;
    const prospect = prospects.find(p => p.id === editId);
    if (prospect) {
      openedFromParam.current = editId;
      openEdit(prospect);
    }
  }, [params.edit, prospects]);

  const saveProspect = async () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    const linkedInUrl = form.contactLinkedIn?.trim() || form.handleUrl?.trim() || '';
    let outreachDate = form.outreachDate;
    if (form.status === 'contacted' && !outreachDate?.trim()) {
      outreachDate = todayIsoDate();
    }
    const payload = {
      ...form,
      name: form.name.trim(),
      contactLinkedIn: linkedInUrl,
      handleUrl: linkedInUrl,
      outreachDate,
      scoreOutOf25: form.scoreOutOf25 ? Number(form.scoreOutOf25) : undefined,
      saleAmount:
        form.saleAmount != null && String(form.saleAmount).trim() !== ''
          ? Number(form.saleAmount)
          : undefined,
      signupsFromRef: form.signupsFromRef != null && form.signupsFromRef !== ('' as unknown as number)
        ? Number(form.signupsFromRef)
        : undefined,
    };
    if (editingId) {
      await influencersLocalStorage.update(editingId, payload);
    } else {
      await influencersLocalStorage.add(payload);
    }
    const returnTab = modalReturnTab;
    setShowModal(false);
    setModalReturnTab(null);
    if (returnTab) setTab(returnTab);
    loadProspects();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const deleteProspect = (p: InfluencerProspect) => {
    const message = `Remove ${p.name} from your pipeline?`;

    const performDelete = async () => {
      try {
        await influencersLocalStorage.delete(p.id);
        setShowModal(false);
        setEditingId(null);
        setModalReturnTab(null);
        await loadProspects();
        setSyncStatus({ tone: 'success', text: `Deleted ${p.name}.` });
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (error) {
        console.error('[Influencers] Delete failed:', error);
        setSyncStatus({ tone: 'error', text: `Could not delete ${p.name}. Try again.` });
        if (Platform.OS !== 'web') {
          Alert.alert('Delete failed', `Could not delete ${p.name}. Try again.`);
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete prospect?\n\n${message}`)) {
        void performDelete();
      }
      return;
    }

    Alert.alert('Delete prospect', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void performDelete() },
    ]);
  };

  const copyText = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied', `${label} copied to clipboard`);
  };

  const exportCsvRows = (rows: InfluencerProspect[]) => {
    const headers =
      'Name,Track,Type,Status,Tier,Score,Platform,Email,Phone,Website,LinkedIn,Group,Gift Offer,Recurring Group,Connection Sent,Full DM Sent,Follow-up 1,Follow-up 2,Sale Amount,Sale Date,Sale Notes,Video URL,Lifetime Pro,Grant Date,Notes';
    const escape = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;
    return [
      headers,
      ...rows.map(p =>
        [
          p.name,
          TRACK_LABELS[resolveOutreachTrack(p)],
          TYPE_LABELS[p.prospectType],
          STATUS_LABELS[p.status],
          p.priorityTier,
          p.scoreOutOf25 || '',
          p.platform || '',
          p.contactEmail || '',
          p.contactPhone || '',
          p.websiteUrl || '',
          getLinkedInUrl(p) || '',
          p.groupNameFrequency || '',
          p.giftOffer || '',
          p.recurringGroup ? 'Yes' : 'No',
          p.outreachDate || '',
          p.fullDmSentDate || '',
          p.followUp1Date || '',
          p.followUp2Date || '',
          p.saleAmount ?? '',
          p.saleDate || '',
          p.saleNotes || '',
          p.personalVideoUrl || getDefaultOutreachAvatarVideoUrl(getOrigin()) || '',
          p.lifetimeProGranted ? 'Yes' : 'No',
          p.grantDate || '',
          p.notes || '',
        ].map(v => escape(String(v))).join(',')
      ),
    ].join('\n');
  };

  const exportCsv = (rows: InfluencerProspect[] = filtered) => {
    const csv = exportCsvRows(rows);
    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `influencer-pipeline-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      Share.share({ message: csv, title: 'Influencer Pipeline' });
    }
  };

  const renderPipeline = () => (
    <>
      <View style={[styles.summaryRow, !isDesktop && { flexWrap: 'wrap' }]}>
        {[
          { label: 'Total', value: stats.total, filter: 'all' as StatusFilter },
          { label: 'Research', value: stats.research, filter: 'research' as StatusFilter },
          { label: 'In Progress', value: stats.inProgress, filter: 'in_progress' as StatusFilter },
          { label: 'Lifetime / Active', value: stats.lifetime, filter: 'lifetime_granted' as StatusFilter },
        ].map(item => (
          <Pressable
            key={item.label}
            style={[styles.summaryCard, { backgroundColor: cardBg }, statusFilter === item.filter && { borderColor: tintColor, borderWidth: 2 }]}
            onPress={() => setStatusFilter(item.filter)}
          >
            <ThemedText style={styles.summaryValue}>{item.value}</ThemedText>
            <ThemedText style={styles.summaryLabel}>{item.label}</ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={styles.toolbar}>
        <View style={[styles.searchBox, { backgroundColor: surfaceColor, flex: 1 }]}>
          <IconSymbol name="magnifyingglass" size={18} color="#999" />
          <TextInput
            style={[styles.searchInput, { color: tintColor }]}
            placeholder="Search name, phone, email, website…"
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <IconSymbol name="xmark.circle.fill" size={20} color="#999" />
            </Pressable>
          )}
        </View>
        <Pressable style={[styles.toolBtn, { backgroundColor: tintColor }]} onPress={() => openAdd()}>
          <IconSymbol name="plus" size={18} color="#fff" />
          {isDesktop && <ThemedText style={{ color: '#fff', fontWeight: '600', marginLeft: 6 }}>Add</ThemedText>}
        </Pressable>
        <Pressable
          style={[styles.toolBtn, { backgroundColor: surfaceColor, borderWidth: 1, borderColor: AdminColors.info }]}
          onPress={() => router.push('/admin/participants?filter=prospects' as any)}
        >
          <IconSymbol name="person.text.rectangle" size={18} color={AdminColors.info} />
          {isDesktop && <ThemedText style={{ color: AdminColors.info, fontWeight: '600', marginLeft: 6 }}>From Directory</ThemedText>}
        </Pressable>
        <Pressable style={[styles.toolBtn, { backgroundColor: surfaceColor, borderWidth: 1, borderColor: tintColor }]} onPress={() => exportCsv()}>
          <IconSymbol name="square.and.arrow.up" size={18} color={tintColor} />
        </Pressable>
        {isAuthenticated && (
          <Pressable
            style={[
              styles.toolBtn,
              {
                backgroundColor: surfaceColor,
                borderWidth: 1,
                borderColor: AdminColors.success,
                opacity: syncing ? 0.7 : 1,
              },
            ]}
            onPress={syncFromCloud}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator size="small" color={AdminColors.success} />
            ) : (
              <IconSymbol name="arrow.triangle.2.circlepath" size={18} color={AdminColors.success} />
            )}
            {isDesktop && (
              <ThemedText style={{ color: AdminColors.success, fontWeight: '600', marginLeft: 4, fontSize: 13 }}>
                {syncing ? 'Syncing…' : 'Sync'}
              </ThemedText>
            )}
          </Pressable>
        )}
      </View>

      {syncStatus ? (
        <ThemedText
          style={[
            styles.cardMeta,
            {
              paddingHorizontal: 20,
              marginBottom: 8,
              fontWeight: '600',
              color:
                syncStatus.tone === 'error'
                  ? AdminColors.warning
                  : syncStatus.tone === 'info'
                    ? AdminColors.info
                    : AdminColors.success,
            },
          ]}
        >
          {syncStatus.text}
        </ThemedText>
      ) : isAuthenticated ? (
        <ThemedText style={[styles.cardMeta, { paddingHorizontal: 20, marginBottom: 8, color: AdminColors.success }]}>
          Cloud sync enabled — prospects save to your account, not just this browser.
        </ThemedText>
      ) : (
        <ThemedText style={[styles.cardMeta, { paddingHorizontal: 20, marginBottom: 8, color: AdminColors.warning }]}>
          Log in to sync prospects to the cloud. Browser-only storage can be lost on clear data or new devices.
        </ThemedText>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8, paddingHorizontal: 20 }}>
        {([
          ['all', 'All tracks'],
          ['influencer', 'Influencers'],
          ['prospect', 'Prospects'],
        ] as [TrackFilter, string][]).map(([t, label]) => (
          <Pressable
            key={t}
            style={[styles.chip, trackFilter === t && { backgroundColor: tintColor }]}
            onPress={() => setTrackFilter(t)}
          >
            <ThemedText style={[styles.chipText, trackFilter === t && { color: '#fff' }]}>{label}</ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, paddingHorizontal: 20 }}>
        <Pressable
          style={[styles.chip, typeFilter === 'all' && { backgroundColor: tintColor }]}
          onPress={() => setTypeFilter('all')}
        >
          <ThemedText style={[styles.chipText, typeFilter === 'all' && { color: '#fff' }]}>All types</ThemedText>
        </Pressable>
        {NICHE_TYPE_GUIDES.map(g => (
          <Pressable
            key={g.id}
            style={[styles.chip, typeFilter === g.id && { backgroundColor: tintColor }]}
            onPress={() => setTypeFilter(g.id)}
          >
            <ThemedText style={[styles.chipText, typeFilter === g.id && { color: '#fff' }]} numberOfLines={1}>
              {g.label}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      {prospects.length > 0 && (
        <ThemedText style={[styles.cardMeta, { paddingHorizontal: 20, marginBottom: 8 }]}>
          {hasActiveFilters
            ? `Showing ${filtered.length} of ${prospects.length} contacts`
            : `${prospects.length} contact${prospects.length === 1 ? '' : 's'} in pipeline`}
        </ThemedText>
      )}

      <View style={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            {prospects.length > 0 ? (
              <>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: 8, textAlign: 'center' }}>
                  {prospects.length} contact{prospects.length === 1 ? '' : 's'} hidden by filters
                </ThemedText>
                <ThemedText style={{ opacity: 0.6, textAlign: 'center', marginBottom: 16 }}>
                  Tap “All tracks”, clear search, and tap the Total summary card — a status filter like Research hides everyone marked Interested.
                </ThemedText>
                <Pressable
                  style={[styles.copyBtn, { borderColor: tintColor, alignSelf: 'center' }]}
                  onPress={clearAllFilters}
                >
                  <ThemedText style={{ color: tintColor, fontWeight: '600' }}>Clear all filters</ThemedText>
                </Pressable>
              </>
            ) : (
              <ThemedText style={{ opacity: 0.5, textAlign: 'center' }}>
                No contacts in this browser — add one, import from Participant Directory, or restore a Backup that includes Influencer prospects.
              </ThemedText>
            )}
          </View>
        ) : (
          filtered.map(p => {
            const track = resolveOutreachTrack(p);
            return (
            <Pressable
              key={p.id}
              style={[styles.card, { backgroundColor: cardBg }]}
              onPress={() => openEdit(p)}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="defaultSemiBold">{p.name}</ThemedText>
                  <ThemedText style={styles.cardMeta}>
                    {TRACK_LABELS[track]} · {TYPE_LABELS[p.prospectType]} · Tier {p.priorityTier}
                    {p.scoreOutOf25 ? ` · ${p.scoreOutOf25}/25` : ''}
                  </ThemedText>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: tintColor + '20' }]}>
                  <ThemedText style={[styles.statusText, { color: tintColor }]}>{STATUS_LABELS[p.status]}</ThemedText>
                </View>
              </View>
              {(p.platform || p.contactEmail || p.contactPhone) && (
                <ThemedText style={styles.cardMeta} numberOfLines={1}>
                  {[p.contactPhone, p.contactEmail, p.platform].filter(Boolean).join(' · ')}
                </ThemedText>
              )}
              {p.websiteUrl && (
                <ThemedText style={styles.cardMeta} numberOfLines={1}>{p.websiteUrl}</ThemedText>
              )}
              {getLinkedInUrl(p) && (
                <ThemedText style={styles.cardMeta} numberOfLines={1}>{getLinkedInUrl(p)}</ThemedText>
              )}
              {(p.outreachDate || p.fullDmSentDate) && (
                <ThemedText style={styles.cardMeta} numberOfLines={2}>
                  {[
                    p.outreachDate ? `Connection sent: ${formatDisplayDate(p.outreachDate)}` : null,
                    p.fullDmSentDate ? `Full DM sent: ${formatDisplayDate(p.fullDmSentDate)}` : null,
                  ].filter(Boolean).join(' · ')}
                </ThemedText>
              )}
              {p.saleAmount != null && p.saleAmount > 0 && (
                <ThemedText style={[styles.cardMeta, { color: AdminColors.success, marginTop: 4 }]}>
                  Sale: {formatCurrency(p.saleAmount)}
                  {p.saleDate ? ` · ${formatDisplayDate(p.saleDate)}` : ''}
                </ThemedText>
              )}
              {p.lifetimeProGranted && (
                <ThemedText style={[styles.cardMeta, { color: AdminColors.success, marginTop: 4 }]}>
                  Lifetime Pro{ p.grantDate ? ` · ${p.grantDate}` : ''}
                </ThemedText>
              )}
              {p.participantDirectoryId && (
                <ThemedText style={[styles.cardMeta, { color: AdminColors.info, marginTop: 4 }]}>
                  In Participant Directory
                </ThemedText>
              )}
              {p.personalVideoUrl && (
                <ThemedText style={[styles.cardMeta, { color: AdminColors.warning, marginTop: 4 }]}>
                  HeyGen video saved
                </ThemedText>
              )}
              <View style={[styles.row, { marginTop: 10, gap: 8, flexWrap: 'wrap' }]}>
                {p.contactPhone ? (
                  <Pressable
                    style={[styles.copyBtn, { flex: 1, minWidth: 72, borderColor: AdminColors.success }]}
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      const tel = p.contactPhone!.replace(/[^\d+]/g, '');
                      if (Platform.OS === 'web') window.open(`tel:${tel}`, '_self');
                      else Linking.openURL(`tel:${tel}`);
                    }}
                  >
                    <ThemedText style={{ color: AdminColors.success, fontWeight: '600', fontSize: 13 }}>Call</ThemedText>
                  </Pressable>
                ) : null}
                {getLinkedInUrl(p) ? (
                  <Pressable
                    style={[styles.copyBtn, { flex: 1, minWidth: 72, borderColor: '#0A66C2' }]}
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      openLinkedIn(p);
                    }}
                  >
                    <ThemedText style={{ color: '#0A66C2', fontWeight: '600', fontSize: 13 }}>LinkedIn</ThemedText>
                  </Pressable>
                ) : null}
                {(track === 'prospect' || p.smsDraft || p.contactPhone) ? (
                  <Pressable
                    style={[styles.copyBtn, { flex: 1, minWidth: 72, borderColor: AdminColors.info, backgroundColor: tintColor + '15' }]}
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      copyText(getEffectiveSms(p), 'SMS');
                    }}
                  >
                    <ThemedText style={{ color: AdminColors.info, fontWeight: '600', fontSize: 13 }}>Copy SMS</ThemedText>
                  </Pressable>
                ) : null}
                <Pressable
                  style={[styles.copyBtn, { flex: 1, minWidth: 72, borderColor: AdminColors.info }]}
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    copyText(buildLinkedInMessage(p), track === 'prospect' ? 'Email' : 'LinkedIn DM');
                  }}
                >
                  <ThemedText style={{ color: AdminColors.info, fontWeight: '600', fontSize: 13 }}>
                    {track === 'prospect' ? 'Copy email' : 'Copy DM'}
                  </ThemedText>
                </Pressable>
                {p.websiteUrl ? (
                  <Pressable
                    style={[styles.copyBtn, { flex: 1, minWidth: 72, borderColor: tintColor }]}
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      const url = p.websiteUrl!.startsWith('http') ? p.websiteUrl! : `https://${p.websiteUrl}`;
                      if (Platform.OS === 'web') window.open(url, '_blank');
                      else Linking.openURL(url);
                    }}
                  >
                    <ThemedText style={{ color: tintColor, fontWeight: '600', fontSize: 13 }}>Website</ThemedText>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
            );
          })
        )}
      </View>
    </>
  );

  const renderPlaybook = () => (
    <View style={{ paddingHorizontal: 20, paddingBottom: 40 }}>
      <ThemedText style={{ marginBottom: 16, opacity: 0.7 }}>
        Ten influencer types with LinkedIn search strings. Tap to expand, then copy strings or add a prospect.
      </ThemedText>
      {PROSPECT_TYPE_GUIDES.map(g => (
        <View key={g.id} style={[styles.guideCard, { backgroundColor: cardBg }]}>
          <Pressable style={styles.guideHeader} onPress={() => setExpandedGuide(expandedGuide === g.id ? null : g.id)}>
            <View style={{ flex: 1 }}>
              <ThemedText type="defaultSemiBold">{g.label}</ThemedText>
              <ThemedText style={styles.cardMeta}>Tier {g.tier} · {OUTREACH_TEMPLATES[g.outreachTemplate].subject.slice(0, 40)}…</ThemedText>
            </View>
            <IconSymbol name="chevron.down" size={16} color={tintColor} />
          </Pressable>
          {expandedGuide === g.id && (
            <View style={styles.guideBody}>
              <ThemedText style={{ marginBottom: 8 }}>{g.why}</ThemedText>
              <ThemedText style={styles.fieldLabel}>LinkedIn searches</ThemedText>
              <View style={[styles.codeBlock, { backgroundColor: surfaceColor }]}>
                <ThemedText style={styles.codeText}>{g.searchStrings.join('\n')}</ThemedText>
              </View>
              <Pressable
                style={[styles.copyBtn, { borderColor: tintColor }]}
                onPress={() => copyText(g.searchStrings.join('\n'), 'Search strings')}
              >
                <ThemedText style={{ color: tintColor, fontWeight: '600' }}>Copy search strings</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.copyBtn, { backgroundColor: tintColor, marginTop: 8 }]}
                onPress={() => openAdd(g.id)}
              >
                <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Add prospect ({g.label})</ThemedText>
              </Pressable>
            </View>
          )}
        </View>
      ))}
    </View>
  );

  const renderTemplates = () => {
    const segmentLabels: Record<OutreachSegmentKey, string> = {
      mastermind: 'Mastermind / community',
      real_estate: 'Real estate / sales team',
      networking: 'BNI / networking / meetup',
    };

    return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 40, gap: 16 }}>
      <ThemedText type="defaultSemiBold">Outreach templates (editable)</ThemedText>
      <ThemedText style={[styles.cardMeta, { marginBottom: 8 }]}>
        Customize default scripts and gifts per segment. Use {'{{First name}}'}, {'{{Group name}}'}, {'{{Gift offer}}'}, and [personal video link] placeholders.
      </ThemedText>
      {(['mastermind', 'real_estate', 'networking'] as OutreachSegmentKey[]).map(segment => {
        const current = getSegmentSettings(outreachSettings, segment);
        const isEditing = editingSegmentSettings === segment;
        return (
          <View key={segment} style={[styles.guideCard, { backgroundColor: cardBg }]}>
            <Pressable
              style={styles.guideHeader}
              onPress={() => setEditingSegmentSettings(isEditing ? null : segment)}
            >
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold">{segmentLabels[segment]}</ThemedText>
                <ThemedText style={styles.cardMeta} numberOfLines={1}>
                  Gift: {current.defaultGift}
                </ThemedText>
              </View>
              <IconSymbol name="chevron.down" size={16} color={tintColor} />
            </Pressable>
            {isEditing && (
              <View style={styles.guideBody}>
                <ThemedText style={styles.fieldLabel}>Default gift offer</ThemedText>
                <TextInput
                  style={[styles.input, styles.textArea, { color: tintColor, borderColor: '#ddd' }]}
                  value={current.defaultGift}
                  onChangeText={v => {
                    const next = { ...getDefaultOutreachSettings(), ...outreachSettings };
                    next[segment] = { ...current, defaultGift: v };
                    setOutreachSettings(next);
                  }}
                  multiline
                />
                <ThemedText style={[styles.fieldLabel, { marginTop: 12 }]}>HeyGen script template</ThemedText>
                <TextInput
                  style={[styles.input, styles.textAreaTall, { color: tintColor, borderColor: '#ddd' }]}
                  value={current.heyGenScript}
                  onChangeText={v => {
                    const next = { ...getDefaultOutreachSettings(), ...outreachSettings };
                    next[segment] = { ...current, heyGenScript: v };
                    setOutreachSettings(next);
                  }}
                  multiline
                  textAlignVertical="top"
                />
                <ThemedText style={[styles.fieldLabel, { marginTop: 12 }]}>LinkedIn DM template</ThemedText>
                <TextInput
                  style={[styles.input, styles.textAreaTall, { color: tintColor, borderColor: '#ddd' }]}
                  value={current.linkedInBody}
                  onChangeText={v => {
                    const next = { ...getDefaultOutreachSettings(), ...outreachSettings };
                    next[segment] = { ...current, linkedInBody: v };
                    setOutreachSettings(next);
                  }}
                  multiline
                  textAlignVertical="top"
                />
                <View style={[styles.row, { gap: 8, marginTop: 12 }]}>
                  <Pressable
                    style={[styles.copyBtn, { flex: 1, backgroundColor: tintColor }]}
                    onPress={async () => {
                      const merged = { ...getDefaultOutreachSettings(), ...outreachSettings };
                      merged[segment] = current;
                      await saveOutreachSettings(merged);
                      setOutreachSettings(merged);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      Alert.alert('Saved', `${segmentLabels[segment]} template saved.`);
                    }}
                  >
                    <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Save segment</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.copyBtn, { flex: 1, borderColor: AdminColors.warning }]}
                    onPress={() => {
                      const defaults = getDefaultOutreachSettings()[segment];
                      const next = { ...getDefaultOutreachSettings(), ...outreachSettings, [segment]: defaults };
                      setOutreachSettings(next);
                    }}
                  >
                    <ThemedText style={{ color: AdminColors.warning, fontWeight: '600' }}>Revert segment</ThemedText>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        );
      })}
      <Pressable
        style={[styles.copyBtn, { borderColor: AdminColors.warning }]}
        onPress={() => {
          Alert.alert('Reset all templates?', 'Restore all segment templates to app defaults?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Reset',
              style: 'destructive',
              onPress: async () => {
                await resetOutreachSettings();
                setOutreachSettings({});
                Alert.alert('Reset', 'Templates restored to defaults.');
              },
            },
          ]);
        }}
      >
        <ThemedText style={{ color: AdminColors.warning, fontWeight: '600' }}>Reset all templates to defaults</ThemedText>
      </Pressable>

      <ThemedText type="defaultSemiBold" style={{ marginTop: 8 }}>LinkedIn first touch (preview)</ThemedText>
      <ThemedText style={[styles.cardMeta, { marginBottom: 8 }]}>
        Copy LinkedIn DM merges your hosted mastermind intro automatically. Override with a custom URL on a prospect if needed.
      </ThemedText>
      {LINKEDIN_FIRST_TOUCH_TEMPLATES.map(tpl => (
        <View key={tpl.id} style={[styles.guideCard, { backgroundColor: cardBg }]}>
          <Pressable
            style={styles.guideHeader}
            onPress={() => setExpandedLinkedIn(expandedLinkedIn === tpl.id ? null : tpl.id)}
          >
            <View style={{ flex: 1 }}>
              <ThemedText type="defaultSemiBold">{tpl.title}</ThemedText>
              <ThemedText style={styles.cardMeta}>{tpl.description}</ThemedText>
            </View>
            <IconSymbol name="chevron.down" size={16} color={tintColor} />
          </Pressable>
          {expandedLinkedIn === tpl.id && (
            <View style={styles.guideBody}>
              <View style={[styles.codeBlock, { backgroundColor: surfaceColor }]}>
                <ThemedText style={styles.codeText}>
                  {mergeOutreachPlaceholders(
                    getSegmentSettings(outreachSettings, tpl.id).linkedInBody,
                    { origin: getOrigin() }
                  )}
                </ThemedText>
              </View>
              <Pressable
                style={[styles.copyBtn, { backgroundColor: '#0A66C2', marginTop: 8 }]}
                onPress={() =>
                  copyText(
                    mergeOutreachPlaceholders(
                      getSegmentSettings(outreachSettings, tpl.id).linkedInBody,
                      { origin: getOrigin() }
                    ),
                    'LinkedIn template'
                  )
                }
              >
                <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Copy template</ThemedText>
              </Pressable>
            </View>
          )}
        </View>
      ))}

      <ThemedText type="defaultSemiBold" style={{ marginTop: 8 }}>Email outreach</ThemedText>
      {(Object.entries(OUTREACH_TEMPLATES) as [keyof typeof OUTREACH_TEMPLATES, typeof OUTREACH_TEMPLATES.mastermind][]).map(([key, tpl]) => (
        <View key={key} style={[styles.guideCard, { backgroundColor: cardBg }]}>
          <ThemedText type="defaultSemiBold" style={{ textTransform: 'capitalize' }}>{key.replace('_', ' ')} email</ThemedText>
          <ThemedText style={[styles.fieldLabel, { marginTop: 8 }]}>Subject</ThemedText>
          <ThemedText style={styles.cardMeta}>{tpl.subject}</ThemedText>
          <Pressable style={[styles.copyBtn, { borderColor: tintColor, marginTop: 8 }]} onPress={() => copyText(tpl.subject, 'Subject')}>
            <ThemedText style={{ color: tintColor, fontWeight: '600' }}>Copy subject</ThemedText>
          </Pressable>
          <ThemedText style={[styles.fieldLabel, { marginTop: 12 }]}>Body</ThemedText>
          <View style={[styles.codeBlock, { backgroundColor: surfaceColor }]}>
            <ThemedText style={styles.codeText}>{tpl.body}</ThemedText>
          </View>
          <Pressable style={[styles.copyBtn, { backgroundColor: tintColor, marginTop: 8 }]} onPress={() => copyText(tpl.body, 'Email body')}>
            <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Copy full email</ThemedText>
          </Pressable>
        </View>
      ))}
    </View>
    );
  };

  const renderResources = () => (
    <View style={{ paddingHorizontal: 20, paddingBottom: 40, gap: 20 }}>
      <ThemedText style={{ opacity: 0.7 }}>
        HeyGen scripts, shareable links, and ready-to-paste LinkedIn replies when prospects respond.
      </ThemedText>

      <View>
        <ThemedText type="defaultSemiBold" style={{ marginBottom: 4 }}>HeyGen intro scripts</ThemedText>
        <ThemedText style={[styles.cardMeta, { marginBottom: 10 }]}>
          Default intro is hosted on app.gathersync.app. Copy a script only if you need a new HeyGen render → optional custom URL on prospect → Copy LinkedIn DM.
        </ThemedText>
        {HEYGEN_SCRIPT_TEMPLATES.map(tpl => (
          <View key={tpl.id} style={[styles.guideCard, { backgroundColor: cardBg, marginBottom: 10 }]}>
            <Pressable
              style={styles.guideHeader}
              onPress={() => setExpandedHeyGen(expandedHeyGen === tpl.id ? null : tpl.id)}
            >
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold">{tpl.title} ({tpl.duration})</ThemedText>
                <ThemedText style={styles.cardMeta}>{tpl.description}</ThemedText>
              </View>
              <IconSymbol name="chevron.down" size={16} color={tintColor} />
            </Pressable>
            {expandedHeyGen === tpl.id && (
              <View style={styles.guideBody}>
                <View style={[styles.codeBlock, { backgroundColor: surfaceColor }]}>
                  <ThemedText style={styles.codeText}>
                    {mergeOutreachPlaceholders(
                      getSegmentSettings(outreachSettings, tpl.id).heyGenScript,
                      { origin: getOrigin() }
                    )}
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.copyBtn, { backgroundColor: tintColor, marginTop: 8 }]}
                  onPress={() =>
                    copyText(
                      mergeOutreachPlaceholders(
                        getSegmentSettings(outreachSettings, tpl.id).heyGenScript,
                        { origin: getOrigin() }
                      ),
                      'HeyGen script'
                    )
                  }
                >
                  <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Copy HeyGen script</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.copyBtn, { borderColor: tintColor, marginTop: 8 }]}
                  onPress={() =>
                    copyText(
                      buildHeyGenMcpPrompt(
                        mergeOutreachPlaceholders(
                          getSegmentSettings(outreachSettings, tpl.id).heyGenScript,
                          { origin: getOrigin() }
                        )
                      ),
                      'HeyGen MCP prompt'
                    )
                  }
                >
                  <ThemedText style={{ color: tintColor, fontWeight: '600' }}>Copy MCP prompt</ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        ))}
      </View>

      <View>
        <ThemedText type="defaultSemiBold" style={{ marginBottom: 10 }}>Materials to share</ThemedText>
        {INFLUENCER_DOCUMENTS.map(doc => (
          <View key={doc.id} style={[styles.guideCard, { backgroundColor: cardBg, marginBottom: 10 }]}>
            <View style={{ padding: 16 }}>
              <ThemedText type="defaultSemiBold">{doc.title}</ThemedText>
              <ThemedText style={[styles.cardMeta, { marginTop: 4, marginBottom: 12 }]}>{doc.description}</ThemedText>
              <View style={styles.row}>
                <Pressable
                  style={[styles.copyBtn, { flex: 1, borderColor: tintColor, marginRight: 8 }]}
                  onPress={() => openResource(doc.path)}
                >
                  <ThemedText style={{ color: tintColor, fontWeight: '600' }}>
                    {doc.kind === 'image' ? 'View image' : doc.kind === 'audio' ? 'Listen' : 'Open PDF'}
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.copyBtn, { flex: 1, borderColor: AdminColors.info }]}
                  onPress={() => copyResourceLink(doc.path, doc.title)}
                >
                  <ThemedText style={{ color: AdminColors.info, fontWeight: '600' }}>Copy link</ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
      </View>

      <View>
        <ThemedText type="defaultSemiBold" style={{ marginBottom: 10 }}>Podcast</ThemedText>
        {INFLUENCER_PODCASTS.map(pod => (
          <View key={pod.id} style={[styles.guideCard, { backgroundColor: cardBg, marginBottom: 10 }]}>
            <View style={{ padding: 16 }}>
              <View style={styles.cardHeader}>
                <ThemedText type="defaultSemiBold" style={{ flex: 1 }}>
                  {pod.title}{pod.duration ? ` (${pod.duration})` : ''}
                </ThemedText>
              </View>
              <ThemedText style={[styles.cardMeta, { marginTop: 8, marginBottom: 12 }]}>{pod.description}</ThemedText>
              <View style={styles.row}>
                <Pressable
                  style={[styles.copyBtn, { flex: 1, borderColor: tintColor, marginRight: 8 }]}
                  onPress={() => openResource(pod.path)}
                >
                  <ThemedText style={{ color: tintColor, fontWeight: '600' }}>Listen</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.copyBtn, { flex: 1, borderColor: AdminColors.info }]}
                  onPress={() => copyResourceLink(pod.path, pod.title)}
                >
                  <ThemedText style={{ color: AdminColors.info, fontWeight: '600' }}>Copy link</ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
      </View>

      <View>
        <ThemedText type="defaultSemiBold" style={{ marginBottom: 10 }}>Demo videos</ThemedText>
        {INFLUENCER_DEMO_VIDEOS.map(video => (
          <View key={video.id} style={[styles.guideCard, { backgroundColor: cardBg, marginBottom: 10 }]}>
            <View style={{ padding: 16 }}>
              <View style={styles.cardHeader}>
                <ThemedText type="defaultSemiBold" style={{ flex: 1 }}>{video.title}</ThemedText>
                {video.comingSoon && !video.url && !video.path && (
                  <View style={[styles.statusBadge, { backgroundColor: AdminColors.warning + '25' }]}>
                    <ThemedText style={[styles.statusText, { color: AdminColors.warning }]}>Coming soon</ThemedText>
                  </View>
                )}
              </View>
              <ThemedText style={[styles.cardMeta, { marginTop: 8, marginBottom: 12 }]}>{video.description}</ThemedText>
              {video.url || video.path ? (
                <View style={styles.row}>
                  <Pressable
                    style={[styles.copyBtn, { flex: 1, borderColor: tintColor, marginRight: 8 }]}
                    onPress={() => {
                      const link = getDemoVideoUrl(video, getOrigin());
                      if (!link) return;
                      if (Platform.OS === 'web') window.open(link, '_blank');
                      else Linking.openURL(link);
                    }}
                  >
                    <ThemedText style={{ color: tintColor, fontWeight: '600' }}>Open video</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.copyBtn, { flex: 1, borderColor: AdminColors.info }]}
                    onPress={() => {
                      const link = getDemoVideoUrl(video, getOrigin());
                      if (link) copyText(link, video.title);
                    }}
                  >
                    <ThemedText style={{ color: AdminColors.info, fontWeight: '600' }}>Copy link</ThemedText>
                  </Pressable>
                </View>
              ) : (
                <ThemedText style={[styles.cardMeta, { fontStyle: 'italic' }]}>
                  Plan: create event → import CSV with available days → show Best Day in event history.
                </ThemedText>
              )}
            </View>
          </View>
        ))}
      </View>

      <View>
        <ThemedText type="defaultSemiBold" style={{ marginBottom: 4 }}>Reply kit (LinkedIn DMs)</ThemedText>
        <ThemedText style={[styles.cardMeta, { marginBottom: 10 }]}>
          Tap to expand. Copy inserts live PDF links where relevant.
        </ThemedText>
        {REPLY_KIT_TEMPLATES.map(tpl => (
          <View key={tpl.id} style={[styles.guideCard, { backgroundColor: cardBg, marginBottom: 10 }]}>
            <Pressable
              style={styles.guideHeader}
              onPress={() => setExpandedReply(expandedReply === tpl.id ? null : tpl.id)}
            >
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold">{tpl.title}</ThemedText>
                <ThemedText style={styles.cardMeta}>{tpl.trigger}</ThemedText>
              </View>
              <IconSymbol name="chevron.down" size={16} color={tintColor} />
            </Pressable>
            {expandedReply === tpl.id && (
              <View style={styles.guideBody}>
                <View style={[styles.codeBlock, { backgroundColor: surfaceColor }]}>
                  <ThemedText style={styles.codeText}>{buildReplyBody(tpl.id, tpl.body)}</ThemedText>
                </View>
                <Pressable
                  style={[styles.copyBtn, { backgroundColor: tintColor, marginTop: 8 }]}
                  onPress={() => copyText(buildReplyBody(tpl.id, tpl.body), tpl.title)}
                >
                  <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Copy reply</ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        ))}
      </View>

      <View>
        <ThemedText type="defaultSemiBold" style={{ marginBottom: 4 }}>Social posts (LinkedIn, YouTube Shorts)</ThemedText>
        <ThemedText style={[styles.cardMeta, { marginBottom: 10 }]}>
          Copy after uploading try-gathersync-free.mp4 or your GetBizCard video. Links merge automatically.
        </ThemedText>
        {SOCIAL_POST_TEMPLATES.map(tpl => (
          <View key={tpl.id} style={[styles.guideCard, { backgroundColor: cardBg, marginBottom: 10 }]}>
            <Pressable
              style={styles.guideHeader}
              onPress={() => setExpandedSocial(expandedSocial === tpl.id ? null : tpl.id)}
            >
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold">{tpl.title}</ThemedText>
                <ThemedText style={styles.cardMeta}>{tpl.platform}</ThemedText>
              </View>
              <IconSymbol name="chevron.down" size={16} color={tintColor} />
            </Pressable>
            {expandedSocial === tpl.id && (
              <View style={styles.guideBody}>
                <View style={[styles.codeBlock, { backgroundColor: surfaceColor }]}>
                  <ThemedText style={styles.codeText}>
                    {mergeOutreachPlaceholders(tpl.body, { origin: getOrigin() })}
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.copyBtn, { backgroundColor: tintColor, marginTop: 8 }]}
                  onPress={() =>
                    copyText(mergeOutreachPlaceholders(tpl.body, { origin: getOrigin() }), tpl.title)
                  }
                >
                  <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Copy post</ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );

  const renderReportBar = (label: string, count: number, max: number) => {
    const widthPct = max > 0 ? Math.max(8, Math.round((count / max) * 100)) : 0;
    return (
      <View key={label} style={{ marginBottom: 10 }}>
        <View style={styles.row}>
          <ThemedText style={{ flex: 1, fontSize: 13 }}>{label}</ThemedText>
          <ThemedText style={{ fontWeight: '700' }}>{count}</ThemedText>
        </View>
        <View style={[styles.reportBarTrack, { backgroundColor: surfaceColor }]}>
          <View style={[styles.reportBarFill, { width: `${widthPct}%`, backgroundColor: tintColor }]} />
        </View>
      </View>
    );
  };

  const renderReports = () => {
    const maxStatus = Math.max(1, ...analytics.byStatus.map(s => s.count));
    const maxType = Math.max(1, ...analytics.byType.map(t => t.count));

    return (
      <View style={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        <ThemedText style={{ marginBottom: 4, opacity: 0.7 }}>
          Live stats from your pipeline — updates whenever you open this tab.
        </ThemedText>
        <View style={[styles.row, { gap: 8, marginBottom: 16, marginTop: 8 }]}>
          <Pressable
            style={[styles.copyBtn, { flex: 1, borderColor: tintColor, backgroundColor: tintColor }]}
            onPress={() => exportCsv(prospects)}
          >
            <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Export full CSV</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.copyBtn, { flex: 1, borderColor: AdminColors.info }]}
            onPress={() => setTab('pipeline')}
          >
            <ThemedText style={{ color: AdminColors.info, fontWeight: '600' }}>Open pipeline</ThemedText>
          </Pressable>
        </View>

        <ThemedText type="defaultSemiBold" style={{ marginBottom: 10 }}>Revenue</ThemedText>
        <View style={[styles.reportGrid, !isDesktop && { flexDirection: 'column' }]}>
          <View style={[styles.reportCard, { backgroundColor: AdminColors.success + '20' }]}>
            <ThemedText style={[styles.reportValue, { color: AdminColors.success }]}>
              {formatCurrency(analytics.totals.totalRevenue)}
            </ThemedText>
            <ThemedText style={styles.reportLabel}>Total revenue</ThemedText>
          </View>
          <View style={[styles.reportCard, { backgroundColor: cardBg }]}>
            <ThemedText style={styles.reportValue}>{analytics.totals.salesCount}</ThemedText>
            <ThemedText style={styles.reportLabel}>Sales recorded</ThemedText>
          </View>
          <View style={[styles.reportCard, { backgroundColor: cardBg }]}>
            <ThemedText style={styles.reportValue}>{formatCurrency(analytics.thisWeek.revenue)}</ThemedText>
            <ThemedText style={styles.reportLabel}>Revenue this week</ThemedText>
          </View>
        </View>

        <ThemedText type="defaultSemiBold" style={{ marginBottom: 10 }}>Today</ThemedText>
        <View style={[styles.reportGrid, !isDesktop && { flexDirection: 'column' }]}>
          <View style={[styles.reportCard, { backgroundColor: cardBg }]}>
            <ThemedText style={styles.reportValue}>{analytics.today.connectionsSent}</ThemedText>
            <ThemedText style={styles.reportLabel}>Connections sent</ThemedText>
          </View>
          <View style={[styles.reportCard, { backgroundColor: cardBg }]}>
            <ThemedText style={styles.reportValue}>{analytics.today.fullDmsSent}</ThemedText>
            <ThemedText style={styles.reportLabel}>Full DMs sent</ThemedText>
          </View>
        </View>

        <ThemedText type="defaultSemiBold" style={{ marginTop: 16, marginBottom: 10 }}>This week</ThemedText>
        <View style={[styles.reportGrid, !isDesktop && { flexDirection: 'column' }]}>
          <View style={[styles.reportCard, { backgroundColor: cardBg }]}>
            <ThemedText style={styles.reportValue}>{analytics.thisWeek.connectionsSent}</ThemedText>
            <ThemedText style={styles.reportLabel}>Connections sent</ThemedText>
          </View>
          <View style={[styles.reportCard, { backgroundColor: cardBg }]}>
            <ThemedText style={styles.reportValue}>{analytics.thisWeek.fullDmsSent}</ThemedText>
            <ThemedText style={styles.reportLabel}>Full DMs sent</ThemedText>
          </View>
          <View style={[styles.reportCard, { backgroundColor: cardBg }]}>
            <ThemedText style={styles.reportValue}>{analytics.thisWeek.prospectsAdded}</ThemedText>
            <ThemedText style={styles.reportLabel}>Prospects added</ThemedText>
          </View>
        </View>

        <ThemedText type="defaultSemiBold" style={{ marginTop: 16, marginBottom: 10 }}>Pipeline totals</ThemedText>
        <View style={[styles.reportGrid, !isDesktop && { flexWrap: 'wrap' }]}>
          {[
            ['Total prospects', analytics.totals.prospects],
            ['Connections sent', analytics.totals.connectionsSent],
            ['Full DMs sent', analytics.totals.fullDmsSent],
            ['Awaiting accept', analytics.totals.awaitingAccept],
            ['In progress', analytics.totals.inProgress],
            ['Interested', analytics.totals.interested],
            ['Pro granted', analytics.totals.proGranted],
          ].map(([label, value]) => (
            <View key={String(label)} style={[styles.reportCard, { backgroundColor: cardBg, minWidth: isDesktop ? '22%' : '47%' }]}>
              <ThemedText style={styles.reportValue}>{value}</ThemedText>
              <ThemedText style={styles.reportLabel}>{label}</ThemedText>
            </View>
          ))}
        </View>

        <ThemedText type="defaultSemiBold" style={{ marginTop: 16, marginBottom: 10 }}>Conversion rates</ThemedText>
        <View style={[styles.guideCard, { backgroundColor: cardBg, padding: 16, marginBottom: 16 }]}>
          <ThemedText style={styles.cardMeta}>
            DM sent after connection: {formatRate(analytics.rates.dmSentAfterConnection)}
          </ThemedText>
          <ThemedText style={[styles.cardMeta, { marginTop: 6 }]}>
            Interested after contact: {formatRate(analytics.rates.interestedAfterContact)}
          </ThemedText>
          <ThemedText style={[styles.cardMeta, { marginTop: 6 }]}>
            Pro granted after contact: {formatRate(analytics.rates.proGrantedAfterContact)}
          </ThemedText>
          <ThemedText style={[styles.cardMeta, { marginTop: 10, fontStyle: 'italic' }]}>
            Rates improve as your pipeline grows. Awaiting accept = connection sent, no full DM yet.
          </ThemedText>
        </View>

        <ThemedText type="defaultSemiBold" style={{ marginBottom: 10 }}>By status</ThemedText>
        <View style={[styles.guideCard, { backgroundColor: cardBg, padding: 16, marginBottom: 16 }]}>
          {analytics.byStatus.length === 0 ? (
            <ThemedText style={styles.cardMeta}>No prospects yet.</ThemedText>
          ) : (
            analytics.byStatus.map(s => renderReportBar(s.label, s.count, maxStatus))
          )}
        </View>

        <ThemedText type="defaultSemiBold" style={{ marginBottom: 10 }}>By type</ThemedText>
        <View style={[styles.guideCard, { backgroundColor: cardBg, padding: 16, marginBottom: 16 }]}>
          {analytics.byType.length === 0 ? (
            <ThemedText style={styles.cardMeta}>No prospects yet.</ThemedText>
          ) : (
            analytics.byType.map(t => renderReportBar(t.label, t.count, maxType))
          )}
        </View>

        {analytics.followUpsDue.length > 0 && (
          <>
            <ThemedText type="defaultSemiBold" style={{ marginBottom: 10 }}>Follow-ups due</ThemedText>
            {analytics.followUpsDue.map(p => (
              <Pressable
                key={p.id}
                style={[styles.card, { backgroundColor: AdminColors.warning + '15', marginBottom: 8 }]}
                onPress={() => openEdit(p, 'reports')}
              >
                <ThemedText type="defaultSemiBold">{p.name}</ThemedText>
                <ThemedText style={styles.cardMeta}>
                  {STATUS_LABELS[p.status]}
                  {p.followUp1Date ? ` · FU1 ${formatDisplayDate(p.followUp1Date)}` : ''}
                  {p.followUp2Date ? ` · FU2 ${formatDisplayDate(p.followUp2Date)}` : ''}
                </ThemedText>
              </Pressable>
            ))}
          </>
        )}

        <ThemedText type="defaultSemiBold" style={{ marginTop: 8, marginBottom: 4 }}>Recent prospects</ThemedText>
        <ThemedText style={[styles.cardMeta, { marginBottom: 10 }]}>
          One row per person — tap to open their full activity history and sales.
        </ThemedText>
        {analytics.recentProspects.length === 0 ? (
          <ThemedText style={styles.cardMeta}>Prospects appear here as you add them to the pipeline.</ThemedText>
        ) : (
          analytics.recentProspects.map(row => {
            const prospect = prospects.find(p => p.id === row.prospectId);
            return (
              <Pressable
                key={row.prospectId}
                style={[styles.card, { backgroundColor: cardBg, marginBottom: 8 }]}
                onPress={() => prospect && openEdit(prospect, 'reports')}
              >
                <View style={styles.cardHeader}>
                  <ThemedText type="defaultSemiBold" style={{ flex: 1 }}>{row.name}</ThemedText>
                  <ThemedText style={[styles.cardMeta, { color: tintColor }]}>
                    {formatDisplayDate(row.lastActivityDate)}
                  </ThemedText>
                </View>
                <ThemedText style={styles.cardMeta} numberOfLines={2}>
                  {row.summary} · {STATUS_LABELS[row.status]}
                </ThemedText>
                {row.saleAmount != null && row.saleAmount > 0 && (
                  <ThemedText style={[styles.cardMeta, { color: AdminColors.success, marginTop: 4 }]}>
                    {formatCurrency(row.saleAmount)}
                  </ThemedText>
                )}
              </Pressable>
            );
          })
        )}
      </View>
    );
  };

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  if (user?.role !== 'admin') {
    return (
      <DesktopLayout>
        <ThemedView style={[styles.container, { paddingTop: insets.top + 40, paddingHorizontal: 20 }]}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={{ marginBottom: 16 }}>
            <IconSymbol name="chevron.left" size={24} color={tintColor} />
          </Pressable>
          <ThemedText type="title">Admin only</ThemedText>
          <ThemedText style={{ marginTop: 8, opacity: 0.7 }}>
            Influencer Outreach is available to GatherSync admins only.
          </ThemedText>
        </ThemedView>
      </DesktopLayout>
    );
  }

  return (
    <DesktopLayout>
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconSymbol name="chevron.left" size={24} color={tintColor} />
        </Pressable>
        <ThemedText type="title" style={{ flex: 1, fontSize: isDesktop ? 28 : 22 }}>
          Influencer Outreach
        </ThemedText>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {([
          ['pipeline', 'Pipeline'],
          ['playbook', 'Playbook'],
          ['templates', 'Outreach'],
          ['resources', 'Resources'],
          ['reports', 'Reports'],
        ] as [Tab, string][]).map(([t, label]) => (
          <Pressable
            key={t}
            style={[styles.tab, tab === t && { backgroundColor: tintColor }]}
            onPress={() => setTab(t)}
          >
            <ThemedText style={[styles.tabText, tab === t && { color: '#fff' }]}>{label}</ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        {tab === 'pipeline' && renderPipeline()}
        {tab === 'playbook' && renderPlaybook()}
        {tab === 'templates' && renderTemplates()}
        {tab === 'resources' && renderResources()}
        {tab === 'reports' && renderReports()}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => closeProspectModal(!!modalReturnTab)}>
        <Pressable style={styles.modalOverlay} onPress={() => closeProspectModal(!!modalReturnTab)}>
          <Pressable style={[styles.modalContent, { backgroundColor: surfaceColor }]} onPress={e => e.stopPropagation()}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {modalReturnTab === 'reports' && (
                <Pressable
                  style={[styles.copyBtn, { borderColor: tintColor, marginBottom: 12 }]}
                  onPress={() => closeProspectModal(true)}
                >
                  <ThemedText style={{ color: tintColor, fontWeight: '600' }}>← Back to Reports</ThemedText>
                </Pressable>
              )}
              <ThemedText type="subtitle" style={{ marginBottom: 16 }}>
                {editingId ? 'Edit prospect' : 'Add prospect'}
              </ThemedText>

              <Pressable
                style={[styles.copyBtn, { borderColor: '#0A66C2', marginBottom: 8 }]}
                onPress={() => setShowLinkedInImport(v => !v)}
              >
                <ThemedText style={{ color: '#0A66C2', fontWeight: '600' }}>
                  {showLinkedInImport ? 'Hide LinkedIn import' : 'Import from LinkedIn'}
                </ThemedText>
              </Pressable>
              {showLinkedInImport && (
                <View style={[styles.linkedinImportBox, { borderColor: '#0A66C2' + '40', backgroundColor: cardBg }]}>
                  <ThemedText style={styles.cardMeta}>
                    On LinkedIn: copy the profile URL, or select name + headline (and About if you want) → paste below → Fill form.
                  </ThemedText>
                  <TextInput
                    style={[styles.input, styles.textAreaTall, { color: tintColor, borderColor: '#ddd', marginTop: 8 }]}
                    value={linkedInPasteText}
                    onChangeText={setLinkedInPasteText}
                    placeholder={'https://www.linkedin.com/in/...\n\nor paste copied profile text'}
                    multiline
                    textAlignVertical="top"
                    autoCapitalize="none"
                  />
                  <Pressable
                    style={[styles.toolBtn, { backgroundColor: '#0A66C2', marginTop: 8, alignSelf: 'flex-start' }]}
                    onPress={applyLinkedInPaste}
                  >
                    <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Fill form from paste</ThemedText>
                  </Pressable>
                </View>
              )}

              <ThemedText style={styles.fieldLabel}>Name *</ThemedText>
              <TextInput style={[styles.input, { color: tintColor, borderColor: '#ddd' }]} value={form.name} onChangeText={v => setField('name', v)} />

              <ThemedText style={styles.fieldLabel}>Headline / niche</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea, { color: tintColor, borderColor: '#ddd' }]}
                value={form.niche}
                onChangeText={v => setField('niche', v)}
                placeholder="Mastermind facilitator | Community builder"
                multiline
              />

              <ThemedText style={styles.fieldLabel}>Track</ThemedText>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {(['influencer', 'prospect'] as OutreachTrack[]).map(track => (
                  <Pressable
                    key={track}
                    style={[styles.chip, form.outreachTrack === track && { backgroundColor: tintColor }]}
                    onPress={() => {
                      const next = { ...form, outreachTrack: track };
                      setForm({ ...next, ...regenerateOutreachDrafts(next) });
                    }}
                  >
                    <ThemedText style={[styles.chipText, form.outreachTrack === track && { color: '#fff' }]}>
                      {TRACK_LABELS[track]}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
              <ThemedText style={[styles.cardMeta, { marginBottom: 12 }]}>
                {form.outreachTrack === 'prospect'
                  ? 'Directory / phone-first contacts — SMS, call, email, or LinkedIn if you find them.'
                  : 'LinkedIn influencer outreach — HeyGen video, connection note, full DM.'}
              </ThemedText>

              <ThemedText style={styles.fieldLabel}>Niche type</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {NICHE_TYPE_GUIDES.map(g => (
                  <Pressable
                    key={g.id}
                    style={[styles.chip, form.prospectType === g.id && { backgroundColor: tintColor }]}
                    onPress={() => {
                      const next = { ...form, prospectType: g.id };
                      setForm({ ...next, ...regenerateOutreachDrafts(next) });
                    }}
                  >
                    <ThemedText style={[styles.chipText, form.prospectType === g.id && { color: '#fff' }]}>{g.label}</ThemedText>
                  </Pressable>
                ))}
              </ScrollView>

              <ThemedText style={styles.fieldLabel}>Phone</ThemedText>
              <TextInput
                style={[styles.input, { color: tintColor, borderColor: '#ddd' }]}
                value={form.contactPhone}
                onChangeText={v => setField('contactPhone', v)}
                placeholder="+61..."
                keyboardType="phone-pad"
              />

              <ThemedText style={styles.fieldLabel}>Website</ThemedText>
              <TextInput
                style={[styles.input, { color: tintColor, borderColor: '#ddd' }]}
                value={form.websiteUrl}
                onChangeText={v => setField('websiteUrl', v)}
                placeholder="https://..."
                autoCapitalize="none"
                keyboardType="url"
              />

              <ThemedText style={styles.fieldLabel}>Status</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {STATUS_ORDER.map(s => (
                  <Pressable
                    key={s}
                    style={[styles.chip, form.status === s && { backgroundColor: tintColor }]}
                    onPress={() => setField('status', s)}
                  >
                    <ThemedText style={[styles.chipText, form.status === s && { color: '#fff' }]}>{STATUS_LABELS[s]}</ThemedText>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <ThemedText style={styles.fieldLabel}>Tier</ThemedText>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['A', 'B', 'C'] as InfluencerPriorityTier[]).map(t => (
                      <Pressable key={t} style={[styles.chip, form.priorityTier === t && { backgroundColor: tintColor }]} onPress={() => setField('priorityTier', t)}>
                        <ThemedText style={[styles.chipText, form.priorityTier === t && { color: '#fff' }]}>{t}</ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={{ width: 80 }}>
                  <ThemedText style={styles.fieldLabel}>Score /25</ThemedText>
                  <TextInput style={[styles.input, { color: tintColor, borderColor: '#ddd' }]} value={form.scoreOutOf25?.toString() || ''} onChangeText={v => setField('scoreOutOf25', v ? parseInt(v, 10) : undefined)} keyboardType="number-pad" />
                </View>
              </View>

              <ThemedText style={styles.fieldLabel}>Platform</ThemedText>
              <TextInput style={[styles.input, { color: tintColor, borderColor: '#ddd' }]} value={form.platform} onChangeText={v => setField('platform', v)} placeholder="LinkedIn + Skool" />

              <ThemedText style={styles.fieldLabel}>LinkedIn profile URL</ThemedText>
              <TextInput
                style={[styles.input, { color: tintColor, borderColor: '#ddd' }]}
                value={form.contactLinkedIn}
                onChangeText={v => setField('contactLinkedIn', v)}
                placeholder="https://www.linkedin.com/in/..."
                autoCapitalize="none"
              />

              <ThemedText style={styles.fieldLabel}>Email</ThemedText>
              <TextInput style={[styles.input, { color: tintColor, borderColor: '#ddd' }]} value={form.contactEmail} onChangeText={v => setField('contactEmail', v)} keyboardType="email-address" autoCapitalize="none" />

              <ThemedText type="defaultSemiBold" style={{ marginTop: 16, marginBottom: 8 }}>Outreach scripts</ThemedText>
              <ThemedText style={styles.fieldLabel}>Gift offer for this person</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {GIFT_OFFER_PRESETS.map(preset => (
                  <Pressable
                    key={preset}
                    style={[styles.chip, form.giftOffer === preset && { backgroundColor: tintColor }]}
                    onPress={() => setField('giftOffer', preset)}
                  >
                    <ThemedText
                      style={[styles.chipText, form.giftOffer === preset && { color: '#fff' }]}
                      numberOfLines={2}
                    >
                      {preset.length > 28 ? `${preset.slice(0, 26)}…` : preset}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
              <TextInput
                style={[styles.input, styles.textArea, { color: tintColor, borderColor: '#ddd', marginBottom: 8 }]}
                value={form.giftOffer}
                onChangeText={v => setField('giftOffer', v)}
                placeholder="Custom gift — e.g. 60 days Pro after one live event"
                multiline
              />

              <ThemedText style={styles.fieldLabel}>HeyGen script (editable)</ThemedText>
              <TextInput
                style={[styles.input, styles.textAreaTall, { color: tintColor, borderColor: '#ddd' }]}
                value={form.heyGenScriptDraft}
                onChangeText={v => setField('heyGenScriptDraft', v)}
                multiline
                textAlignVertical="top"
              />

              <ThemedText style={styles.fieldLabel}>SMS / text (editable)</ThemedText>
              <TextInput
                style={[styles.input, styles.textAreaTall, { color: tintColor, borderColor: '#ddd' }]}
                value={form.smsDraft}
                onChangeText={v => setField('smsDraft', v)}
                multiline
                textAlignVertical="top"
              />

              <ThemedText style={[styles.fieldLabel, { marginTop: 12 }]}>
                {form.outreachTrack === 'prospect' ? 'Email body (editable)' : 'LinkedIn DM (editable)'}
              </ThemedText>
              <TextInput
                style={[styles.input, styles.textAreaTall, { color: tintColor, borderColor: '#ddd' }]}
                value={form.linkedInDmDraft}
                onChangeText={v => setField('linkedInDmDraft', v)}
                multiline
                textAlignVertical="top"
              />

              <Pressable
                style={[styles.copyBtn, { borderColor: AdminColors.warning, marginTop: 8, marginBottom: 8 }]}
                onPress={() => setForm(f => ({ ...f, ...regenerateOutreachDrafts(f) }))}
              >
                <ThemedText style={{ color: AdminColors.warning, fontWeight: '600' }}>Regenerate from template</ThemedText>
              </Pressable>

              <View style={[styles.row, { gap: 8, marginBottom: 8, flexWrap: 'wrap' }]}>
                <Pressable
                  style={[styles.copyBtn, { flex: 1, minWidth: 100, borderColor: AdminColors.info }]}
                  onPress={() => copyText(getEffectiveSms(form), 'SMS')}
                >
                  <ThemedText style={{ color: AdminColors.info, fontWeight: '600' }}>Copy SMS</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.copyBtn, { flex: 1, minWidth: 100, borderColor: AdminColors.info }]}
                  onPress={() => copyText(getEffectiveLinkedInDm(form), form.outreachTrack === 'prospect' ? 'Email' : 'LinkedIn DM')}
                >
                  <ThemedText style={{ color: AdminColors.info, fontWeight: '600' }}>
                    {form.outreachTrack === 'prospect' ? 'Copy email' : 'Copy LinkedIn DM'}
                  </ThemedText>
                </Pressable>
                {getLinkedInUrl(form) ? (
                  <Pressable
                    style={[styles.copyBtn, { flex: 1, minWidth: 100, borderColor: '#0A66C2' }]}
                    onPress={() => openLinkedIn(form)}
                  >
                    <ThemedText style={{ color: '#0A66C2', fontWeight: '600' }}>Open LinkedIn</ThemedText>
                  </Pressable>
                ) : null}
              </View>

              <ThemedText style={styles.fieldLabel}>HeyGen intro video URL</ThemedText>
              <TextInput
                style={[styles.input, { color: tintColor, borderColor: '#ddd' }]}
                value={form.personalVideoUrl}
                onChangeText={v => setField('personalVideoUrl', v)}
                placeholder={getDefaultOutreachAvatarVideoUrl(getOrigin()) || 'https://app.gathersync.app/documents/...'}
                autoCapitalize="none"
              />
              <ThemedText style={[styles.cardMeta, { marginBottom: 8 }]}>
                Leave blank to use the default mastermind intro ({getDefaultOutreachAvatarVideoUrl(getOrigin()) || 'Avatar-Video-60Day-Pro.mp4'}).
              </ThemedText>
              <Pressable
                style={[styles.copyBtn, { borderColor: tintColor, marginBottom: 8 }]}
                onPress={() => {
                  const url = getDefaultOutreachAvatarVideoUrl(getOrigin());
                  if (url) setField('personalVideoUrl', url);
                }}
              >
                <ThemedText style={{ color: tintColor, fontWeight: '600' }}>Use default intro video</ThemedText>
              </Pressable>

              <Pressable
                style={[styles.copyBtn, { borderColor: AdminColors.success, marginBottom: 8 }]}
                onPress={() => {
                  setForm(f => ({
                    ...f,
                    fullDmSentDate: todayIsoDate(),
                    status:
                      f.status === 'research' || f.status === 'contacted' ? 'follow_up_1' : f.status,
                  }));
                }}
              >
                <ThemedText style={{ color: AdminColors.success, fontWeight: '600' }}>
                  Mark full DM sent today
                </ThemedText>
              </Pressable>
              <View style={[styles.row, { gap: 8, marginBottom: 8 }]}>
                <Pressable
                  style={[styles.copyBtn, { flex: 1, borderColor: tintColor }]}
                  onPress={() => copyText(getEffectiveHeyGenScript(form), 'HeyGen script')}
                >
                  <ThemedText style={{ color: tintColor, fontWeight: '600' }}>Copy HeyGen script</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.copyBtn, { flex: 1, borderColor: tintColor }]}
                  onPress={() => copyText(buildHeyGenMcpPrompt(getEffectiveHeyGenScript(form)), 'HeyGen MCP prompt')}
                >
                  <ThemedText style={{ color: tintColor, fontWeight: '600' }}>Copy MCP prompt</ThemedText>
                </Pressable>
              </View>

              <ThemedText style={styles.fieldLabel}>Group / frequency</ThemedText>
              <TextInput style={[styles.input, { color: tintColor, borderColor: '#ddd' }]} value={form.groupNameFrequency} onChangeText={v => setField('groupNameFrequency', v)} placeholder="AI Founders Monthly" />

              <View style={[styles.row, { alignItems: 'center', marginVertical: 8 }]}>
                <ThemedText style={{ flex: 1 }}>Recurring group</ThemedText>
                <Switch value={form.recurringGroup} onValueChange={v => setField('recurringGroup', v)} />
              </View>

              <ThemedText type="defaultSemiBold" style={{ marginTop: 16, marginBottom: 4 }}>Outreach tracking</ThemedText>
              <ThemedText style={[styles.cardMeta, { marginBottom: 4 }]}>
                Track what they received — connection note vs full DM. Export CSV from Pipeline for reports.
              </ThemedText>
              <OutreachDateField
                label="Connection sent (invitation note)"
                value={form.outreachDate}
                onChange={v => setField('outreachDate', v)}
              />
              <OutreachDateField
                label="Full LinkedIn DM sent (after they accepted)"
                value={form.fullDmSentDate}
                onChange={v => setField('fullDmSentDate', v)}
              />
              <OutreachDateField
                label="Follow-up 1 planned"
                value={form.followUp1Date}
                onChange={v => setField('followUp1Date', v)}
              />
              <OutreachDateField
                label="Follow-up 2 planned"
                value={form.followUp2Date}
                onChange={v => setField('followUp2Date', v)}
              />

              {editingId && (() => {
                const existing = prospects.find(p => p.id === editingId);
                if (!existing) return null;
                const timeline = getProspectActivityTimeline({ ...existing, ...form, id: editingId });
                return (
                  <>
                    <ThemedText type="defaultSemiBold" style={{ marginTop: 16, marginBottom: 8 }}>
                      Activity history
                    </ThemedText>
                    <View style={[styles.guideCard, { backgroundColor: cardBg, padding: 16, marginBottom: 8 }]}>
                      {timeline.length === 0 ? (
                        <ThemedText style={styles.cardMeta}>No activity logged yet.</ThemedText>
                      ) : (
                        timeline.map(event => (
                          <View key={`${event.kind}-${event.date}`} style={{ marginBottom: 10 }}>
                            <ThemedText type="defaultSemiBold" style={{ fontSize: 13 }}>
                              {event.label}
                            </ThemedText>
                            <ThemedText style={styles.cardMeta}>{formatDisplayDate(event.date)}</ThemedText>
                          </View>
                        ))
                      )}
                    </View>
                  </>
                );
              })()}

              <ThemedText type="defaultSemiBold" style={{ marginTop: 8, marginBottom: 4 }}>Sales & revenue</ThemedText>
              <ThemedText style={[styles.cardMeta, { marginBottom: 8 }]}>
                Record income when someone pays — this feeds your Reports revenue totals.
              </ThemedText>
              <ThemedText style={styles.fieldLabel}>Sale amount (USD)</ThemedText>
              <TextInput
                style={[styles.input, { color: tintColor, borderColor: '#ddd' }]}
                value={form.saleAmount != null ? String(form.saleAmount) : ''}
                onChangeText={v =>
                  setField('saleAmount', v.trim() === '' ? undefined : Number(v.replace(/[^0-9.]/g, '')))
                }
                keyboardType="decimal-pad"
                placeholder="e.g. 297"
              />
              <OutreachDateField
                label="Sale date"
                value={form.saleDate}
                onChange={v => setField('saleDate', v)}
              />
              <ThemedText style={styles.fieldLabel}>Sale notes</ThemedText>
              <TextInput
                style={[styles.input, { color: tintColor, borderColor: '#ddd', marginBottom: 8 }]}
                value={form.saleNotes}
                onChangeText={v => setField('saleNotes', v)}
                placeholder="Pro annual, lifetime upgrade, etc."
              />
              <Pressable
                style={[styles.copyBtn, { borderColor: AdminColors.success, marginBottom: 8 }]}
                onPress={() => setForm(f => ({ ...f, saleDate: todayIsoDate() }))}
              >
                <ThemedText style={{ color: AdminColors.success, fontWeight: '600' }}>Set sale date to today</ThemedText>
              </Pressable>

              <ThemedText style={styles.fieldLabel}>Referral link</ThemedText>
              <TextInput style={[styles.input, { color: tintColor, borderColor: '#ddd' }]} value={form.referralLink} onChangeText={v => setField('referralLink', v)} placeholder="?ref=name" autoCapitalize="none" />

              <ThemedText style={styles.fieldLabel}>Deliverable agreed</ThemedText>
              <TextInput style={[styles.input, { color: tintColor, borderColor: '#ddd' }]} value={form.deliverableAgreed} onChangeText={v => setField('deliverableAgreed', v)} placeholder="One LinkedIn post" />

              <View style={[styles.row, { alignItems: 'center', marginVertical: 8 }]}>
                <ThemedText style={{ flex: 1 }}>Onboarding call done</ThemedText>
                <Switch value={form.onboardingCallDone} onValueChange={v => setField('onboardingCallDone', v)} />
              </View>
              <View style={[styles.row, { alignItems: 'center', marginVertical: 8 }]}>
                <ThemedText style={{ flex: 1 }}>Deliverable done</ThemedText>
                <Switch value={form.deliverableDone} onValueChange={v => setField('deliverableDone', v)} />
              </View>

              <ThemedText style={styles.fieldLabel}>Notes</ThemedText>
              <TextInput style={[styles.input, { color: tintColor, borderColor: '#ddd', minHeight: 80, textAlignVertical: 'top' }]} value={form.notes} onChangeText={v => setField('notes', v)} multiline />

              {user?.role === 'admin' && (
                <Pressable style={[styles.copyBtn, { borderColor: AdminColors.warning, marginTop: 8 }]} onPress={handleGrantLifetimePro}>
                  <ThemedText style={{ color: AdminColors.warning, fontWeight: '600' }}>Grant Lifetime Pro</ThemedText>
                </Pressable>
              )}

              {form.participantDirectoryId ? (
                <Pressable
                  style={[styles.copyBtn, { borderColor: AdminColors.info, marginTop: 8 }]}
                  onPress={() => {
                    setShowModal(false);
                    router.push('/admin/participants?filter=prospects' as any);
                  }}
                >
                  <ThemedText style={{ color: AdminColors.info, fontWeight: '600' }}>View in Participant Directory</ThemedText>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.copyBtn, { borderColor: AdminColors.info, marginTop: 8 }]}
                  onPress={handleAddToParticipantDirectory}
                >
                  <ThemedText style={{ color: AdminColors.info, fontWeight: '600' }}>Add to Participant Directory</ThemedText>
                </Pressable>
              )}

              {getTypeGuide(form.prospectType) && (
                <Pressable
                  style={[styles.copyBtn, { borderColor: tintColor, marginTop: 8 }]}
                  onPress={() => {
                    const g = getTypeGuide(form.prospectType)!;
                    const tpl = OUTREACH_TEMPLATES[g.outreachTemplate];
                    copyText(`Subject: ${tpl.subject}\n\n${tpl.body}`, 'Outreach email');
                  }}
                >
                  <ThemedText style={{ color: tintColor, fontWeight: '600' }}>Copy outreach email template</ThemedText>
                </Pressable>
              )}

              <Pressable style={[styles.saveBtn, { backgroundColor: tintColor }]} onPress={saveProspect}>
                <ThemedText style={{ color: '#fff', fontWeight: '700' }}>
                  {modalReturnTab === 'reports' ? 'Save & back to Reports' : 'Save'}
                </ThemedText>
              </Pressable>

              {editingId && (
                <Pressable
                  style={[styles.saveBtn, { backgroundColor: '#ef4444', marginTop: 8 }]}
                  onPress={() => {
                    const p = prospects.find(x => x.id === editingId);
                    if (p) deleteProspect(p);
                  }}
                >
                  <ThemedText style={{ color: '#fff', fontWeight: '700' }}>Delete</ThemedText>
                </Pressable>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
    </DesktopLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  tabs: { flexDirection: 'row', marginBottom: 16, maxHeight: 44 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#eee' },
  tabText: { fontSize: 14, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 16 },
  summaryCard: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  summaryValue: { fontSize: 22, fontWeight: 'bold' },
  summaryLabel: { fontSize: 11, opacity: 0.7, marginTop: 4, textAlign: 'center' },
  toolbar: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 12, alignItems: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: 8, gap: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 16 },
  toolBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#eee', marginRight: 8 },
  chipText: { fontSize: 12, fontWeight: '500' },
  card: { padding: 16, borderRadius: 12, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardMeta: { fontSize: 13, opacity: 0.65, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },
  empty: { padding: 40, alignItems: 'center' },
  guideCard: { borderRadius: 12, marginBottom: 10, overflow: 'hidden' },
  guideHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  guideBody: { paddingHorizontal: 16, paddingBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '600', opacity: 0.6, marginBottom: 4, marginTop: 8 },
  codeBlock: { padding: 12, borderRadius: 8, marginBottom: 8 },
  codeText: { fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  copyBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  linkedinImportBox: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { maxHeight: '92%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 4, fontSize: 15 },
  textArea: { minHeight: 56, textAlignVertical: 'top' },
  textAreaTall: { minHeight: 160, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },
  saveBtn: { padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  reportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  reportCard: { flex: 1, minWidth: 120, padding: 14, borderRadius: 12, alignItems: 'center' },
  reportValue: { fontSize: 24, fontWeight: 'bold' },
  reportLabel: { fontSize: 11, opacity: 0.7, marginTop: 4, textAlign: 'center' },
  reportBarTrack: { height: 8, borderRadius: 4, marginTop: 6, overflow: 'hidden' },
  reportBarFill: { height: 8, borderRadius: 4 },
});
