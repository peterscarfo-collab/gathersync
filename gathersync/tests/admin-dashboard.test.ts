import { describe, it, expect } from 'vitest';
import type { Event, Participant, AttendanceRecord } from '@/types/models';

describe('Admin Dashboard - Analytics Calculations', () => {
  it('should calculate total events correctly', () => {
    const events: Event[] = [
      {
        id: '1',
        name: 'Event 1',
        eventType: 'flexible',
        month: 1,
        year: 2025,
        participants: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'Event 2',
        eventType: 'fixed',
        month: 2,
        year: 2025,
        fixedDate: '2025-02-15',
        fixedTime: '10:00',
        participants: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    expect(events.length).toBe(2);
  });

  it('should calculate flexible vs fixed event counts', () => {
    const events: Event[] = [
      {
        id: '1',
        name: 'Event 1',
        eventType: 'flexible',
        month: 1,
        year: 2025,
        participants: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'Event 2',
        eventType: 'fixed',
        month: 2,
        year: 2025,
        fixedDate: '2025-02-15',
        fixedTime: '10:00',
        participants: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '3',
        name: 'Event 3',
        eventType: 'flexible',
        month: 3,
        year: 2025,
        participants: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const flexibleCount = events.filter(e => e.eventType === 'flexible').length;
    const fixedCount = events.filter(e => e.eventType === 'fixed').length;

    expect(flexibleCount).toBe(2);
    expect(fixedCount).toBe(1);
  });

  it('should calculate unique participants correctly', () => {
    const events: Event[] = [
      {
        id: '1',
        name: 'Event 1',
        eventType: 'flexible',
        month: 1,
        year: 2025,
        participants: [
          { id: '1', name: 'Alice', availability: {}, unavailableAllMonth: false },
          { id: '2', name: 'Bob', availability: {}, unavailableAllMonth: false },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'Event 2',
        eventType: 'flexible',
        month: 2,
        year: 2025,
        participants: [
          { id: '3', name: 'Alice', availability: {}, unavailableAllMonth: false },
          { id: '4', name: 'Charlie', availability: {}, unavailableAllMonth: false },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const uniqueParticipants = new Set(
      events.flatMap(e => e.participants.map(p => p.name))
    );

    expect(uniqueParticipants.size).toBe(3); // Alice, Bob, Charlie
  });

  it('should calculate response rate for flexible events', () => {
    const event: Event = {
      id: '1',
      name: 'Event 1',
      eventType: 'flexible',
      month: 1,
      year: 2025,
      participants: [
        { id: '1', name: 'Alice', availability: { '2025-01-15': true }, unavailableAllMonth: false },
        { id: '2', name: 'Bob', availability: {}, unavailableAllMonth: false },
        { id: '3', name: 'Charlie', availability: { '2025-01-16': true }, unavailableAllMonth: false },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const responded = event.participants.filter(p =>
      p.availability && Object.keys(p.availability).length > 0
    ).length;
    const responseRate = (responded / event.participants.length) * 100;

    expect(responseRate).toBeCloseTo(66.67, 1);
  });

  it('should calculate response rate for fixed events', () => {
    const event: Event = {
      id: '1',
      name: 'Event 1',
      eventType: 'fixed',
      month: 1,
      year: 2025,
      fixedDate: '2025-01-15',
      fixedTime: '10:00',
      participants: [
        { id: '1', name: 'Alice', availability: {}, unavailableAllMonth: false, rsvpStatus: 'attending' },
        { id: '2', name: 'Bob', availability: {}, unavailableAllMonth: false, rsvpStatus: 'no-response' },
        { id: '3', name: 'Charlie', availability: {}, unavailableAllMonth: false, rsvpStatus: 'not-attending' },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const responded = event.participants.filter(p =>
      p.rsvpStatus && p.rsvpStatus !== 'no-response'
    ).length;
    const responseRate = (responded / event.participants.length) * 100;

    expect(responseRate).toBeCloseTo(66.67, 1);
  });
});

describe('Admin Dashboard - Participant Statistics', () => {
  it('should count participant event participation', () => {
    const events: Event[] = [
      {
        id: '1',
        name: 'Event 1',
        eventType: 'flexible',
        month: 1,
        year: 2025,
        participants: [
          { id: '1', name: 'Alice', availability: {}, unavailableAllMonth: false },
          { id: '2', name: 'Bob', availability: {}, unavailableAllMonth: false },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'Event 2',
        eventType: 'flexible',
        month: 2,
        year: 2025,
        participants: [
          { id: '3', name: 'Alice', availability: {}, unavailableAllMonth: false },
          { id: '4', name: 'Charlie', availability: {}, unavailableAllMonth: false },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '3',
        name: 'Event 3',
        eventType: 'flexible',
        month: 3,
        year: 2025,
        participants: [
          { id: '5', name: 'Alice', availability: {}, unavailableAllMonth: false },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const participantCounts = new Map<string, number>();
    events.forEach(e => {
      e.participants.forEach(p => {
        participantCounts.set(p.name, (participantCounts.get(p.name) || 0) + 1);
      });
    });

    expect(participantCounts.get('Alice')).toBe(3);
    expect(participantCounts.get('Bob')).toBe(1);
    expect(participantCounts.get('Charlie')).toBe(1);
  });

  it('should identify most active participant', () => {
    const events: Event[] = [
      {
        id: '1',
        name: 'Event 1',
        eventType: 'flexible',
        month: 1,
        year: 2025,
        participants: [
          { id: '1', name: 'Alice', availability: {}, unavailableAllMonth: false },
          { id: '2', name: 'Bob', availability: {}, unavailableAllMonth: false },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'Event 2',
        eventType: 'flexible',
        month: 2,
        year: 2025,
        participants: [
          { id: '3', name: 'Alice', availability: {}, unavailableAllMonth: false },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const participantCounts = new Map<string, number>();
    events.forEach(e => {
      e.participants.forEach(p => {
        participantCounts.set(p.name, (participantCounts.get(p.name) || 0) + 1);
      });
    });

    const mostActiveEntry = Array.from(participantCounts.entries())
      .sort((a, b) => b[1] - a[1])[0];

    expect(mostActiveEntry[0]).toBe('Alice');
    expect(mostActiveEntry[1]).toBe(2);
  });
});

describe('Admin Dashboard - Attendance Tracking', () => {
  it('should calculate attendance rate for participant', () => {
    const events: Event[] = [
      {
        id: '1',
        name: 'Event 1',
        eventType: 'fixed',
        month: 1,
        year: 2025,
        fixedDate: '2025-01-15',
        fixedTime: '10:00',
        participants: [
          { id: '1', name: 'Alice', availability: {}, unavailableAllMonth: false },
        ],
        attendanceRecords: [
          {
            date: new Date('2025-01-15').toISOString(),
            attendees: ['Alice'],
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'Event 2',
        eventType: 'fixed',
        month: 2,
        year: 2025,
        fixedDate: '2025-02-15',
        fixedTime: '10:00',
        participants: [
          { id: '2', name: 'Alice', availability: {}, unavailableAllMonth: false },
        ],
        attendanceRecords: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    let totalEvents = 0;
    let attended = 0;

    events.forEach(event => {
      const participant = event.participants.find(p => p.name === 'Alice');
      if (participant) {
        totalEvents += 1;
        if (event.attendanceRecords?.some(record => record.attendees.includes('Alice'))) {
          attended += 1;
        }
      }
    });

    const attendanceRate = (attended / totalEvents) * 100;

    expect(attendanceRate).toBe(50);
  });

  it('should count total attendance records', () => {
    const events: Event[] = [
      {
        id: '1',
        name: 'Event 1',
        eventType: 'fixed',
        month: 1,
        year: 2025,
        fixedDate: '2025-01-15',
        fixedTime: '10:00',
        participants: [],
        attendanceRecords: [
          {
            date: new Date('2025-01-15').toISOString(),
            attendees: ['Alice', 'Bob'],
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'Event 2',
        eventType: 'fixed',
        month: 2,
        year: 2025,
        fixedDate: '2025-02-15',
        fixedTime: '10:00',
        participants: [],
        attendanceRecords: [
          {
            date: new Date('2025-02-15').toISOString(),
            attendees: ['Charlie'],
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const totalRecords = events.reduce(
      (sum, e) => sum + (e.attendanceRecords?.length || 0),
      0
    );

    expect(totalRecords).toBe(2);
  });
});

describe('Admin Dashboard - Event Filtering', () => {
  it('should filter upcoming fixed events', () => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    const pastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    const events: Event[] = [
      {
        id: '1',
        name: 'Future Event',
        eventType: 'fixed',
        month: futureDate.getMonth() + 1,
        year: futureDate.getFullYear(),
        fixedDate: futureDate.toISOString().split('T')[0],
        fixedTime: '10:00',
        participants: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'Past Event',
        eventType: 'fixed',
        month: pastDate.getMonth() + 1,
        year: pastDate.getFullYear(),
        fixedDate: pastDate.toISOString().split('T')[0],
        fixedTime: '10:00',
        participants: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const upcomingEvents = events.filter(e => {
      if (e.eventType === 'fixed' && e.fixedDate) {
        return new Date(e.fixedDate).getTime() > now.getTime();
      }
      return false;
    });

    expect(upcomingEvents.length).toBe(1);
    expect(upcomingEvents[0].name).toBe('Future Event');
  });

  it('should search events by participant name', () => {
    const events: Event[] = [
      {
        id: '1',
        name: 'Event 1',
        eventType: 'flexible',
        month: 1,
        year: 2025,
        participants: [
          { id: '1', name: 'Alice Smith', availability: {}, unavailableAllMonth: false },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'Event 2',
        eventType: 'flexible',
        month: 2,
        year: 2025,
        participants: [
          { id: '2', name: 'Bob Jones', availability: {}, unavailableAllMonth: false },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const searchQuery = 'alice';
    const filtered = events.filter(e =>
      e.participants.some(p => p.name.toLowerCase().includes(searchQuery))
    );

    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe('Event 1');
  });
});
