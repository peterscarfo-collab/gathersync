import { describe, expect, it } from 'vitest';
import {
  formatConferenceDateRange,
  getConferenceDayList,
  validateConferenceDates,
  validateSession,
} from '../lib/conference-utils';
import type { Event } from '../types/models';

describe('conference-utils', () => {
  it('formats a multi-day range', () => {
    expect(formatConferenceDateRange('2026-06-26', '2026-06-28')).toContain('Jun');
  });

  it('lists inclusive conference days', () => {
    expect(getConferenceDayList('2026-06-26', '2026-06-28')).toEqual([
      '2026-06-26',
      '2026-06-27',
      '2026-06-28',
    ]);
  });

  it('rejects end before start', () => {
    expect(validateConferenceDates('2026-06-28', '2026-06-26')).toMatch(/after/);
  });

  it('validates session within conference dates', () => {
    const event: Event = {
      id: 'e1',
      name: 'Summit',
      eventType: 'conference',
      month: 6,
      year: 2026,
      startDate: '2026-06-26',
      endDate: '2026-06-28',
      participants: [],
      createdAt: '',
      updatedAt: '',
    };
    expect(
      validateSession(
        { title: 'Keynote', date: '2026-06-27', startTime: '10:00', endTime: '12:00' },
        event,
      ),
    ).toBeNull();
    expect(
      validateSession(
        { title: 'Late', date: '2026-06-29', startTime: '10:00', endTime: '12:00' },
        event,
      ),
    ).toMatch(/after/);
  });
});
