import { describe, expect, it } from 'vitest';

import {
  compareCalendarDates,
  formatCalendarDate,
  getTodayCalendarDate,
  isCalendarDateInFuture,
  isEventInFuture,
  normalizeCalendarDate,
} from '../lib/calendar-utils';
import type { Event } from '../types/models';

describe('calendar date helpers', () => {
  it('normalizes ISO datetime strings to YYYY-MM-DD', () => {
    expect(normalizeCalendarDate('2026-06-15T00:00:00.000Z')).toBe('2026-06-15');
  });

  it('compares calendar dates without timezone drift', () => {
    expect(compareCalendarDates('2026-06-15', '2026-06-15')).toBe(0);
    expect(compareCalendarDates('2026-06-14', '2026-06-15')).toBe(-1);
    expect(compareCalendarDates('2026-06-16', '2026-06-15')).toBe(1);
  });

  it('formats calendar dates from components, not UTC midnight', () => {
    const formatted = formatCalendarDate('2026-06-15', 'en-AU');
    expect(formatted).toContain('15');
    expect(formatted).toContain('2026');
  });

  it('uses timezone when deciding if a date is in the future', () => {
    const todaySydney = getTodayCalendarDate('Australia/Sydney');
    expect(isCalendarDateInFuture(todaySydney, 'Australia/Sydney')).toBe(false);
    expect(isCalendarDateInFuture('2099-01-01', 'Australia/Sydney')).toBe(true);
  });

  it('treats a fixed event on today as not future in Australia/Sydney', () => {
    const today = getTodayCalendarDate('Australia/Sydney');
    const event = {
      eventType: 'fixed',
      fixedDate: today,
      month: 6,
      year: 2026,
      participants: [],
    } as Event;

    expect(isEventInFuture(event, 'Australia/Sydney')).toBe(false);
  });
});
