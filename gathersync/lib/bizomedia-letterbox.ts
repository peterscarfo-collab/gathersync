import type { InfluencerProspect, InfluencerStatus } from '@/types/models';

export const LETTERBOX_OUTREACH_SOURCE = 'letterbox-drop';

export interface BizomediaProspectCreatedWebhookBody {
  event?: string;
  at?: string;
  contactId?: string | null;
  source?: string;
  prospectId?: string;
  prospectSlug?: string;
  businessName?: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string;
  adminNotes?: string | null;
  previewUrl?: string | null;
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function normalizeBusinessName(name: string): string {
  return name.trim().toLowerCase();
}

/** BizoMedia prospect status → GatherSync influencer status */
export function mapBizomediaProspectStatus(
  status?: string,
  fallback: InfluencerStatus = 'research'
): InfluencerStatus {
  const s = status?.trim().toLowerCase();
  if (s === 'draft') return 'research';
  return fallback;
}

export function letterboxDisplayName(body: Pick<BizomediaProspectCreatedWebhookBody, 'businessName' | 'contactName'>): string {
  const business = body.businessName?.trim();
  const contact = body.contactName?.trim();
  if (business && contact && business.toLowerCase() !== contact.toLowerCase()) {
    return `${business} (${contact})`;
  }
  return business || contact || 'Letterbox prospect';
}

export function mergeLetterboxProspectNotes(
  existingNotes: string | undefined,
  body: Pick<BizomediaProspectCreatedWebhookBody, 'at' | 'source' | 'adminNotes' | 'previewUrl' | 'prospectSlug'>
): string {
  const at = body.at || new Date().toISOString();
  const lines = [`[${at}] BizoMedia prospect`];
  if (body.source) lines.push(`Source: ${body.source}`);
  if (body.prospectSlug) lines.push(`Slug: ${body.prospectSlug}`);
  if (body.previewUrl) lines.push(`Preview: ${body.previewUrl}`);
  const admin = body.adminNotes?.trim();
  if (admin) lines.push('', admin);

  const block = lines.join('\n');
  const prior = existingNotes?.trim();
  if (!prior) return block;
  if (admin && prior.includes(admin)) return prior;
  return `${prior}\n\n${block}`;
}

export function applyBizomediaProspectCreated(
  existing: InfluencerProspect | null,
  body: BizomediaProspectCreatedWebhookBody,
  contactId: string
): InfluencerProspect {
  const now = new Date().toISOString();
  const at = body.at || now;
  const mappedStatus = mapBizomediaProspectStatus(
    body.status,
    (existing?.status as InfluencerStatus) || 'research'
  );
  const status =
    body.status?.trim().toLowerCase() === 'draft'
      ? mappedStatus
      : existing?.status || mappedStatus;

  const base: InfluencerProspect = existing ?? {
    id: contactId,
    name: letterboxDisplayName(body),
    recurringGroup: false,
    prospectType: 'directory_prospect',
    outreachTrack: 'prospect',
    priorityTier: 'C',
    status: 'research',
    lifetimeProGranted: false,
    onboardingCallDone: false,
    deliverableDone: false,
    platform: LETTERBOX_OUTREACH_SOURCE,
    outreachSource: body.source?.trim() || LETTERBOX_OUTREACH_SOURCE,
    createdAt: now,
    updatedAt: now,
  };

  return {
    ...base,
    id: contactId,
    name: letterboxDisplayName(body) || base.name,
    businessName: body.businessName?.trim() || base.businessName,
    contactName: body.contactName?.trim() || base.contactName,
    contactEmail: body.email?.trim() || base.contactEmail,
    contactPhone: body.phone?.trim() || base.contactPhone,
    bizomediaProspectId: body.prospectId?.trim() || base.bizomediaProspectId,
    bizomediaPublicSlug: body.prospectSlug?.trim() || base.bizomediaPublicSlug,
    previewUrl: body.previewUrl?.trim() || base.previewUrl,
    outreachTrack: 'prospect',
    outreachSource: body.source?.trim() || base.outreachSource || LETTERBOX_OUTREACH_SOURCE,
    platform: LETTERBOX_OUTREACH_SOURCE,
    status,
    notes: mergeLetterboxProspectNotes(base.notes, { ...body, at }),
    updatedAt: now,
  };
}

export function prospectBusinessNameKey(prospect: Record<string, unknown>): string {
  const fromField = String(prospect.businessName || '').trim();
  if (fromField) return normalizeBusinessName(fromField);
  return normalizeBusinessName(String(prospect.name || ''));
}
