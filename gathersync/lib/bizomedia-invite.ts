import type { InfluencerProspect } from '@/types/models';

export const BIZOMEDIA_APP_URL = 'https://app.bizomediamarketing.com';

export interface BizomediaInviteWebhookBody {
  event?: string;
  at?: string;
  contactId?: string | null;
  source?: string;
  email?: string;
  bizomediaUserId?: string;
  businessName?: string | null;
  publicSlug?: string | null;
  personalMessage?: string;
  magicCodeSent?: boolean;
  appUrl?: string;
  outreachCopy?: string;
}

export function buildBizomediaAdminInviteUrl(email: string, contactId: string): string {
  const params = new URLSearchParams({
    admin: '1',
    inviteEmail: email.trim(),
    gathersyncContactId: contactId.trim(),
  });
  return `${BIZOMEDIA_APP_URL}/?${params.toString()}`;
}

export function mergeBizomediaInviteNotes(
  existingNotes: string | undefined,
  body: Pick<BizomediaInviteWebhookBody, 'at' | 'source' | 'outreachCopy' | 'personalMessage' | 'businessName' | 'publicSlug' | 'bizomediaUserId'>
): string {
  const at = body.at || new Date().toISOString();
  const lines = [`[${at}] BizoMedia invite`];
  if (body.source) lines.push(`Source: ${body.source}`);
  if (body.businessName) lines.push(`Business: ${body.businessName}`);
  if (body.publicSlug) lines.push(`Public slug: ${body.publicSlug}`);
  if (body.bizomediaUserId) lines.push(`BizoMedia user: ${body.bizomediaUserId}`);
  const copy = body.outreachCopy?.trim() || body.personalMessage?.trim();
  if (copy) lines.push('', copy);

  const block = lines.join('\n');
  const prior = existingNotes?.trim();
  return prior ? `${prior}\n\n${block}` : block;
}

export function applyBizomediaInviteToProspect(
  prospect: InfluencerProspect,
  body: BizomediaInviteWebhookBody
): InfluencerProspect {
  const at = body.at || new Date().toISOString();
  return {
    ...prospect,
    status: 'bizomedia_invited',
    bizomediaUserId: body.bizomediaUserId || prospect.bizomediaUserId,
    bizomediaPublicSlug: body.publicSlug?.trim() || prospect.bizomediaPublicSlug,
    bizomediaInvitedAt: at,
    notes: mergeBizomediaInviteNotes(prospect.notes, body),
    updatedAt: new Date().toISOString(),
  };
}

export function prospectMatchesEmail(prospect: InfluencerProspect, email: string): boolean {
  return (prospect.contactEmail?.trim().toLowerCase() || '') === email.trim().toLowerCase();
}
