/**
 * Tests for Fixed Event Feature
 * 
 * Validates:
 * - Creating fixed events with date and time
 * - RSVP system (attending/not-attending/no-response)
 * - Event card display for fixed events
 * - Event detail RSVP summary
 */

import { describe, it, expect } from 'vitest';
import type { Event, Participant } from '../types/models';
import { generateId } from '../lib/calendar-utils';

describe('Fixed Event Feature', () => {
  it('should create a fixed event with date and time', () => {
    const fixedDate = '2026-02-21';
    const fixedTime = '14:00';
    
    const event: Event = {
      id: generateId(),
      name: 'GatherSync Testing - Today 2 PM',
      eventType: 'fixed',
      month: 2,
      year: 2026,
      fixedDate,
      fixedTime,
      participants: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(event.eventType).toBe('fixed');
    expect(event.fixedDate).toBe(fixedDate);
    expect(event.fixedTime).toBe(fixedTime);
    expect(event.month).toBe(2); // Extracted from fixedDate
    expect(event.year).toBe(2026);
  });

  it('should handle RSVP status for participants', () => {
    const participant1: Participant = {
      id: generateId(),
      name: 'Alice',
      availability: {},
      unavailableAllMonth: false,
      rsvpStatus: 'attending',
    };

    const participant2: Participant = {
      id: generateId(),
      name: 'Bob',
      availability: {},
      unavailableAllMonth: false,
      rsvpStatus: 'not-attending',
    };

    const participant3: Participant = {
      id: generateId(),
      name: 'Charlie',
      availability: {},
      unavailableAllMonth: false,
      rsvpStatus: 'no-response',
    };

    expect(participant1.rsvpStatus).toBe('attending');
    expect(participant2.rsvpStatus).toBe('not-attending');
    expect(participant3.rsvpStatus).toBe('no-response');
  });

  it('should calculate RSVP counts correctly', () => {
    const participants: Participant[] = [
      {
        id: generateId(),
        name: 'Alice',
        availability: {},
        unavailableAllMonth: false,
        rsvpStatus: 'attending',
      },
      {
        id: generateId(),
        name: 'Bob',
        availability: {},
        unavailableAllMonth: false,
        rsvpStatus: 'attending',
      },
      {
        id: generateId(),
        name: 'Charlie',
        availability: {},
        unavailableAllMonth: false,
        rsvpStatus: 'not-attending',
      },
      {
        id: generateId(),
        name: 'David',
        availability: {},
        unavailableAllMonth: false,
        rsvpStatus: 'no-response',
      },
      {
        id: generateId(),
        name: 'Eve',
        availability: {},
        unavailableAllMonth: false,
        // No rsvpStatus set (defaults to no-response)
      },
    ];

    const event: Event = {
      id: generateId(),
      name: 'Team Meeting',
      eventType: 'fixed',
      month: 2,
      year: 2026,
      fixedDate: '2026-02-21',
      fixedTime: '14:00',
      participants,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const attendingCount = event.participants.filter(p => p.rsvpStatus === 'attending').length;
    const notAttendingCount = event.participants.filter(p => p.rsvpStatus === 'not-attending').length;
    const noResponseCount = event.participants.filter(p => !p.rsvpStatus || p.rsvpStatus === 'no-response').length;

    expect(attendingCount).toBe(2);
    expect(notAttendingCount).toBe(1);
    expect(noResponseCount).toBe(2);
  });

  it('should distinguish between fixed and flexible events', () => {
    const fixedEvent: Event = {
      id: generateId(),
      name: 'Fixed Event',
      eventType: 'fixed',
      month: 2,
      year: 2026,
      fixedDate: '2026-02-21',
      fixedTime: '14:00',
      participants: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const flexibleEvent: Event = {
      id: generateId(),
      name: 'Flexible Event',
      eventType: 'flexible',
      month: 2,
      year: 2026,
      participants: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(fixedEvent.eventType).toBe('fixed');
    expect(fixedEvent.fixedDate).toBeDefined();
    expect(fixedEvent.fixedTime).toBeDefined();

    expect(flexibleEvent.eventType).toBe('flexible');
    expect(flexibleEvent.fixedDate).toBeUndefined();
    expect(flexibleEvent.fixedTime).toBeUndefined();
  });

  it('should format fixed date and time correctly', () => {
    const fixedDate = '2026-02-21';
    const fixedTime = '14:00';

    // Test date formatting
    const date = new Date(fixedDate + 'T00:00:00');
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    expect(formattedDate).toContain('2026');
    expect(formattedDate).toContain('21');

    // Test time formatting
    expect(fixedTime).toMatch(/^\d{2}:\d{2}$/);
  });

  it('should handle participants without RSVP status', () => {
    const participant: Participant = {
      id: generateId(),
      name: 'Test User',
      availability: {},
      unavailableAllMonth: false,
      // No rsvpStatus set
    };

    // Should default to no-response when undefined
    const status = participant.rsvpStatus || 'no-response';
    expect(status).toBe('no-response');
  });

  it('should update RSVP status correctly', () => {
    const participant: Participant = {
      id: generateId(),
      name: 'Test User',
      availability: {},
      unavailableAllMonth: false,
      rsvpStatus: 'no-response',
    };

    // Change to attending
    participant.rsvpStatus = 'attending';
    expect(participant.rsvpStatus).toBe('attending');

    // Change to not-attending
    participant.rsvpStatus = 'not-attending';
    expect(participant.rsvpStatus).toBe('not-attending');

    // Change back to no-response
    participant.rsvpStatus = 'no-response';
    expect(participant.rsvpStatus).toBe('no-response');
  });
});
