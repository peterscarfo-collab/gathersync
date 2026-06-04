import { describe, it, expect } from 'vitest';
import {
  applyBizomediaProspectCreated,
  mapBizomediaProspectStatus,
  mergeLetterboxProspectNotes,
  normalizePhone,
  prospectBusinessNameKey,
} from '../lib/bizomedia-letterbox';
import type { InfluencerProspect } from '../types/models';

const baseProspect = (): InfluencerProspect => ({
  id: 'gs-contact-1',
  name: 'Golden Care Massage',
  businessName: 'Golden Care Massage & Acupuncture',
  contactName: 'Golden',
  contactEmail: 'goldencare@example.com',
  contactPhone: '0435060287',
  recurringGroup: false,
  prospectType: 'directory_prospect',
  outreachTrack: 'prospect',
  priorityTier: 'C',
  status: 'contacted',
  lifetimeProGranted: false,
  onboardingCallDone: false,
  deliverableDone: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('bizomedia-letterbox', () => {
  it('maps draft status to research', () => {
    expect(mapBizomediaProspectStatus('draft')).toBe('research');
    expect(mapBizomediaProspectStatus('DRAFT')).toBe('research');
  });

  it('creates letterbox prospect with BizoMedia fields', () => {
    const created = applyBizomediaProspectCreated(null, {
      event: 'bizomedia.prospect.created',
      at: '2026-06-05T10:00:00.000Z',
      source: 'letterbox-drop',
      businessName: 'Golden Care Massage & Acupuncture',
      contactName: 'Golden',
      email: 'goldencare@example.com',
      phone: '0435060287',
      status: 'draft',
      prospectId: 'bm-prospect-99',
      prospectSlug: 'golden-care-massage',
      previewUrl: 'https://app.bizomediamarketing.com/preview/golden-care-massage',
      adminNotes: 'Kareela Village',
    }, 'new-uuid');

    expect(created.id).toBe('new-uuid');
    expect(created.status).toBe('research');
    expect(created.outreachTrack).toBe('prospect');
    expect(created.bizomediaProspectId).toBe('bm-prospect-99');
    expect(created.bizomediaPublicSlug).toBe('golden-care-massage');
    expect(created.previewUrl).toContain('golden-care-massage');
    expect(created.notes).toContain('Kareela Village');
  });

  it('updates existing prospect without downgrading non-draft status', () => {
    const updated = applyBizomediaProspectCreated(baseProspect(), {
      businessName: 'Golden Care Massage & Acupuncture',
      prospectId: 'bm-prospect-99',
      status: 'demo_ready',
      adminNotes: 'Demo building',
    }, 'gs-contact-1');

    expect(updated.status).toBe('contacted');
    expect(updated.bizomediaProspectId).toBe('bm-prospect-99');
  });

  it('normalizes phone for matching', () => {
    expect(normalizePhone('0435 060 287')).toBe('0435060287');
  });

  it('matches business name from businessName or name', () => {
    expect(
      prospectBusinessNameKey({ businessName: '  Golden Care  ', name: 'Other' })
    ).toBe('golden care');
    expect(prospectBusinessNameKey({ name: 'Golden Care' })).toBe('golden care');
  });

  it('merges admin notes without duplicating', () => {
    const merged = mergeLetterboxProspectNotes('Prior note', {
      at: '2026-06-05T10:00:00.000Z',
      source: 'letterbox-drop',
      adminNotes: 'Prior note',
    });
    expect(merged).toBe('Prior note');
  });
});
