import { getOutreachSegmentForRecord } from '@/lib/influencer-playbook';
import {
  generateProspectOutreach,
  loadOutreachSettings,
  type OutreachSegmentKey,
} from '@/lib/influencer-outreach-settings';
import { influencersLocalStorage } from '@/lib/influencer-storage';
import { addContactToProspectsDirectory, getOrCreateProspectsDirectoryEvent } from '@/lib/prospects-directory';
import { eventsLocalStorage } from '@/lib/local-storage';
import type { InfluencerProspect, InfluencerProspectType, OutreachTrack } from '@/types/models';

export interface ParticipantContactInput {
  name: string;
  email?: string;
  phone?: string;
  designation?: string;
  organization?: string;
  leadSource?: string;
  digitalTwinUrl?: string;
  notes?: string;
  /** Prospects Directory participant id when known */
  prospectsDirectoryParticipantId?: string;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function getOutreachSegment(p: Pick<InfluencerProspect, 'prospectType' | 'outreachTrack'>): OutreachSegmentKey {
  return getOutreachSegmentForRecord(p);
}

function inferProspectType(input: ParticipantContactInput): InfluencerProspectType {
  const text = `${input.designation || ''} ${input.organization || ''} ${input.notes || ''} ${input.leadSource || ''}`.toLowerCase();
  if (/real estate|realtor|agent|letterbox/i.test(text)) return 'real_estate';
  if (/bni|network|referral|chapter|meetup/i.test(text)) return 'bni';
  if (/skool|community owner|cohort/i.test(text)) return 'skool';
  if (/sales team|sdr|sales enablement/i.test(text)) return 'sales_team';
  if (/coach|group program|facilitator|mastermind/i.test(text)) return 'group_coach';
  if (/podcast|host/i.test(text)) return 'podcast';
  return 'other';
}

function buildNotes(input: ParticipantContactInput): string | undefined {
  const lines: string[] = [];
  if (input.notes?.trim()) lines.push(input.notes.trim());
  if (input.leadSource?.trim()) lines.push(`Lead source: ${input.leadSource.trim()}`);
  return lines.length ? lines.join('\n') : undefined;
}

async function resolveProspectsDirectoryParticipantId(
  input: ParticipantContactInput,
  syncToCloud?: boolean
): Promise<string> {
  if (input.prospectsDirectoryParticipantId) return input.prospectsDirectoryParticipantId;

  const nameKey = normalizeName(input.name);
  const prospectsEvent = await getOrCreateProspectsDirectoryEvent();
  const event = await eventsLocalStorage.getById(prospectsEvent.id);
  const existing = event?.participants.find(p => normalizeName(p.name) === nameKey && !p.deletedAt);
  if (existing) return existing.id;

  const { participant } = await addContactToProspectsDirectory(
    {
      name: input.name.trim(),
      email: input.email,
      phone: input.phone,
      organization: input.organization,
      designation: input.designation,
      leadSource: input.leadSource || 'Participant Directory',
      notes: input.notes,
    },
    { syncToCloud: !!syncToCloud }
  );
  return participant.id;
}

export async function findInfluencerProspectForContact(
  input: ParticipantContactInput
): Promise<InfluencerProspect | null> {
  const all = await influencersLocalStorage.getAll();
  const nameKey = normalizeName(input.name);

  if (input.prospectsDirectoryParticipantId) {
    const byParticipantId = all.find(p => p.participantDirectoryId === input.prospectsDirectoryParticipantId);
    if (byParticipantId) return byParticipantId;
  }

  const prospectsEvent = await getOrCreateProspectsDirectoryEvent();
  const event = await eventsLocalStorage.getById(prospectsEvent.id);
  const dirParticipant = event?.participants.find(p => normalizeName(p.name) === nameKey && !p.deletedAt);
  if (dirParticipant) {
    const byId = all.find(p => p.participantDirectoryId === dirParticipant.id);
    if (byId) return byId;
  }

  return all.find(p => normalizeName(p.name) === nameKey) || null;
}

export async function addParticipantToInfluencerOutreach(
  input: ParticipantContactInput,
  options?: { syncToCloud?: boolean; origin?: string }
): Promise<{ prospect: InfluencerProspect; created: boolean; alreadyLinked: boolean }> {
  const existing = await findInfluencerProspectForContact(input);
  if (existing) {
    return { prospect: existing, created: false, alreadyLinked: true };
  }

  const participantDirectoryId = await resolveProspectsDirectoryParticipantId(input, options?.syncToCloud);
  const prospectType = inferProspectType(input);
  const outreachTrack: OutreachTrack = 'prospect';
  const segment = getOutreachSegment({ prospectType, outreachTrack });
  const settings = await loadOutreachSettings();
  const firstName = input.name.trim().split(/\s+/)[0] || input.name.trim();
  const generated = generateProspectOutreach(
    segment,
    {
      firstName,
      groupName: input.organization,
      origin: options?.origin,
    },
    settings
  );

  const platformParts = [input.leadSource?.trim(), input.digitalTwinUrl ? 'GetBizCard' : ''].filter(Boolean);

  const prospect = await influencersLocalStorage.add({
    name: input.name.trim(),
    contactEmail: input.email?.trim() || undefined,
    contactPhone: input.phone?.trim() || undefined,
    websiteUrl: input.digitalTwinUrl?.trim() || undefined,
    handleUrl: input.digitalTwinUrl?.trim() || undefined,
    niche: input.designation?.trim() || undefined,
    groupNameFrequency: input.organization?.trim() || undefined,
    platform: platformParts.join(' · ') || 'Participant Directory',
    prospectType,
    outreachTrack,
    priorityTier: 'C',
    recurringGroup: false,
    status: 'research',
    lifetimeProGranted: false,
    onboardingCallDone: false,
    deliverableDone: false,
    participantDirectoryId,
    addedToParticipantDirectoryAt: new Date().toISOString(),
    notes: buildNotes(input),
    giftOffer: generated.defaultGift,
    heyGenScriptDraft: generated.heyGen || undefined,
    linkedInDmDraft: generated.linkedIn,
    smsDraft: generated.sms,
  });

  return { prospect, created: true, alreadyLinked: false };
}
