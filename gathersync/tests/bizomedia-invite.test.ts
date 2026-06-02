import { describe, it, expect } from 'vitest';
import {
  applyBizomediaInviteToProspect,
  buildBizomediaAdminInviteUrl,
  mergeBizomediaInviteNotes,
} from '../lib/bizomedia-invite';
import type { InfluencerProspect } from '../types/models';

const baseProspect = (): InfluencerProspect => ({
  id: 'abc-123',
  name: 'Jane Smith',
  contactEmail: 'jane@example.com',
  recurringGroup: false,
  prospectType: 'mastermind',
  priorityTier: 'A',
  status: 'interested',
  lifetimeProGranted: false,
  onboardingCallDone: false,
  deliverableDone: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('bizomedia-invite', () => {
  it('builds admin invite deep link', () => {
    const url = buildBizomediaAdminInviteUrl('jane@example.com', 'abc-123');
    expect(url).toContain('app.bizomediamarketing.com');
    expect(url).toContain('inviteEmail=jane%40example.com');
    expect(url).toContain('gathersyncContactId=abc-123');
  });

  it('appends outreach note and sets bizomedia fields', () => {
    const updated = applyBizomediaInviteToProspect(baseProspect(), {
      event: 'bizomedia.invite.created',
      at: '2026-06-02T12:00:00.000Z',
      email: 'jane@example.com',
      bizomediaUserId: 'bm-user-1',
      publicSlug: 'jane-coaching',
      source: 'gathersync-influencer',
      outreachCopy: 'Sign in with magic code 123456',
    });

    expect(updated.status).toBe('bizomedia_invited');
    expect(updated.bizomediaUserId).toBe('bm-user-1');
    expect(updated.bizomediaPublicSlug).toBe('jane-coaching');
    expect(updated.notes).toContain('BizoMedia invite');
    expect(updated.notes).toContain('magic code 123456');
  });

  it('merges notes without dropping prior content', () => {
    const merged = mergeBizomediaInviteNotes('Existing note', {
      at: '2026-06-02T12:00:00.000Z',
      source: 'linkedin',
      outreachCopy: 'Welcome to BizoMedia',
    });
    expect(merged).toContain('Existing note');
    expect(merged).toContain('Welcome to BizoMedia');
  });
});
