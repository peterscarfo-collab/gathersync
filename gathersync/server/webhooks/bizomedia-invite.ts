import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import type { InfluencerProspect } from '@/types/models';
import {
  applyBizomediaInviteToProspect,
  type BizomediaInviteWebhookBody,
} from '../../lib/bizomedia-invite';
import {
  applyBizomediaProspectCreated,
  type BizomediaProspectCreatedWebhookBody,
} from '../../lib/bizomedia-letterbox';
import {
  applyBizomediaInviteWebhook,
  findInfluencerProspectForWebhook,
  findLetterboxProspectForWebhook,
  resolveCrmWebhookUserId,
} from '../db';

function unauthorized(res: Response) {
  return res.status(401).json({ error: 'Unauthorized' });
}

function verifyCrmWebhookAuth(req: Request, res: Response): boolean {
  const secret = process.env.GATHERSYNC_CRM_WEBHOOK_SECRET?.trim();
  if (!secret) {
    res.status(500).json({ error: 'GATHERSYNC_CRM_WEBHOOK_SECRET not configured' });
    return false;
  }

  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${secret}`) {
    unauthorized(res);
    return false;
  }

  return true;
}

async function handleBizomediaInviteCreated(
  body: BizomediaInviteWebhookBody,
  res: Response
) {
  if (!body.email?.trim()) {
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

    const updated = applyBizomediaInviteToProspect(
      match.prospect as unknown as InfluencerProspect,
      body
    );
    await applyBizomediaInviteWebhook(match.userId, { ...updated } as Record<string, unknown>);

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

async function handleBizomediaProspectCreated(
  body: BizomediaProspectCreatedWebhookBody,
  res: Response
) {
  const businessName = body.businessName?.trim();
  if (!businessName) {
    return res.status(400).json({ error: 'businessName is required' });
  }

  try {
    const match = await findLetterboxProspectForWebhook({
      contactId: body.contactId,
      email: body.email,
      phone: body.phone,
      businessName,
    });

    let contactId = match?.prospect.id as string | undefined;
    let userId = match?.userId;

    if (!contactId) {
      const ownerId = await resolveCrmWebhookUserId();
      if (!ownerId) {
        console.error('[bizomedia-prospect] no CRM owner user (OWNER_OPEN_ID or GATHERSYNC_CRM_WEBHOOK_USER_ID)');
        return res.status(500).json({ error: 'CRM owner user not configured' });
      }
      userId = ownerId;
      contactId = randomUUID();
    }

    const updated = applyBizomediaProspectCreated(
      (match?.prospect as unknown as InfluencerProspect) ?? null,
      body,
      contactId
    );

    await applyBizomediaInviteWebhook(userId!, { ...updated } as Record<string, unknown>);

    console.info('[bizomedia-prospect] upserted', {
      contactId: updated.id,
      bizomediaProspectId: body.prospectId,
      businessName,
      created: !match,
    });

    return res.status(200).json({ contactId: updated.id });
  } catch (error) {
    console.error('[bizomedia-prospect] failed', error);
    return res.status(500).json({ error: 'Failed to upsert contact' });
  }
}

export async function handleBizomediaInviteWebhook(req: Request, res: Response) {
  if (!verifyCrmWebhookAuth(req, res)) return;

  let body: Record<string, unknown>;
  try {
    body = req.body as Record<string, unknown>;
    if (!body || typeof body !== 'object') {
      throw new Error('Invalid body');
    }
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const event = typeof body.event === 'string' ? body.event.trim() : '';

  if (event === 'bizomedia.prospect.created') {
    return handleBizomediaProspectCreated(body as BizomediaProspectCreatedWebhookBody, res);
  }

  if (event === 'bizomedia.invite.created') {
    return handleBizomediaInviteCreated(body as BizomediaInviteWebhookBody, res);
  }

  return res.status(400).json({ error: 'Unknown or missing event' });
}
