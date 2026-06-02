import type { Request, Response } from 'express';
import type { InfluencerProspect } from '@/types/models';
import {
  applyBizomediaInviteToProspect,
  type BizomediaInviteWebhookBody,
} from '../../lib/bizomedia-invite';
import { applyBizomediaInviteWebhook, findInfluencerProspectForWebhook } from '../db';

function unauthorized(res: Response) {
  return res.status(401).json({ error: 'Unauthorized' });
}

export async function handleBizomediaInviteWebhook(req: Request, res: Response) {
  const secret = process.env.GATHERSYNC_CRM_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return res.status(500).json({ error: 'GATHERSYNC_CRM_WEBHOOK_SECRET not configured' });
  }

  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${secret}`) {
    return unauthorized(res);
  }

  let body: BizomediaInviteWebhookBody;
  try {
    body = req.body as BizomediaInviteWebhookBody;
    if (!body || typeof body !== 'object') {
      throw new Error('Invalid body');
    }
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  if (body.event !== 'bizomedia.invite.created' || !body.email?.trim()) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const email = body.email.trim().toLowerCase();
  const contactId = body.contactId?.trim() || null;

  try {
    const match = await findInfluencerProspectForWebhook({ contactId, email });
    if (!match) {
      console.info('[bizomedia-invite] contact not found', { contactId, email, source: body.source });
      return res.status(404).json({ error: 'Contact not found' });
    }

    const updated = applyBizomediaInviteToProspect(match.prospect as InfluencerProspect, body);
    await applyBizomediaInviteWebhook(match.userId, updated);

    console.info('[bizomedia-invite] updated', {
      contactId: updated.id,
      email,
      bizomediaUserId: body.bizomediaUserId,
      source: body.source,
    });

    return res.status(200).json({ ok: true, contactId: updated.id });
  } catch (error) {
    console.error('[bizomedia-invite] failed', error);
    return res.status(500).json({ error: 'Failed to update contact' });
  }
}
