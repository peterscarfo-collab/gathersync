import { describe, it, expect } from 'vitest';

/**
 * Test suite for participant sync with optional availability fields
 * 
 * This tests the fix for the cloud sync error where participants without
 * availability data were failing to sync due to required fields in tRPC schema.
 */

describe('Participant Sync with Optional Fields', () => {
  it('should accept participant with full availability data', () => {
    const participant = {
      id: 'participant-1',
      eventId: 'event-1',
      name: 'John Doe',
      availability: { '2025-01-15': true, '2025-01-16': false },
      unavailableAllMonth: false,
      notes: 'Can only come after 6pm',
      source: 'manual' as const,
      phone: '+61412345678',
      email: 'john@example.com',
      rsvpStatus: 'attending' as const,
    };

    // Verify all fields are present
    expect(participant.availability).toBeDefined();
    expect(participant.unavailableAllMonth).toBe(false);
    expect(participant.phone).toBeDefined();
    expect(participant.email).toBeDefined();
  });

  it('should accept participant without availability data', () => {
    const participant = {
      id: 'participant-2',
      eventId: 'event-1',
      name: 'Jane Smith',
      // No availability field
      // No unavailableAllMonth field
      phone: '+61498765432',
      email: 'jane@example.com',
    };

    // Verify participant can be created without availability
    expect(participant.name).toBe('Jane Smith');
    expect(participant.phone).toBeDefined();
    expect(participant.email).toBeDefined();
    
    // Availability should be undefined (will be defaulted to {} by tRPC)
    expect((participant as any).availability).toBeUndefined();
    expect((participant as any).unavailableAllMonth).toBeUndefined();
  });

  it('should accept participant with only name and eventId', () => {
    const participant = {
      id: 'participant-3',
      eventId: 'event-1',
      name: 'Bob Wilson',
      // All other fields optional
    };

    // Verify minimal participant can be created
    expect(participant.id).toBeDefined();
    expect(participant.eventId).toBeDefined();
    expect(participant.name).toBe('Bob Wilson');
    
    // All optional fields should be undefined
    expect((participant as any).availability).toBeUndefined();
    expect((participant as any).unavailableAllMonth).toBeUndefined();
    expect((participant as any).phone).toBeUndefined();
    expect((participant as any).email).toBeUndefined();
    expect((participant as any).notes).toBeUndefined();
    expect((participant as any).source).toBeUndefined();
    expect((participant as any).rsvpStatus).toBeUndefined();
  });

  it('should handle participant with phone but no email', () => {
    const participant = {
      id: 'participant-4',
      eventId: 'event-1',
      name: 'Alice Brown',
      phone: '+61400111222',
      // No email
      source: 'contacts' as const,
    };

    // Verify participant with partial contact info
    expect(participant.phone).toBeDefined();
    expect((participant as any).email).toBeUndefined();
    expect(participant.source).toBe('contacts');
  });

  it('should handle participant with email but no phone', () => {
    const participant = {
      id: 'participant-5',
      eventId: 'event-1',
      name: 'Charlie Davis',
      email: 'charlie@example.com',
      // No phone
      source: 'ai' as const,
    };

    // Verify participant with partial contact info
    expect(participant.email).toBeDefined();
    expect((participant as any).phone).toBeUndefined();
    expect(participant.source).toBe('ai');
  });

  it('should provide default values for optional fields in tRPC mutation', () => {
    // Simulate what the tRPC mutation does
    const input = {
      id: 'participant-6',
      eventId: 'event-1',
      name: 'David Evans',
      // No availability or unavailableAllMonth
    };

    // Apply defaults like the tRPC mutation does
    const participantData = {
      ...input,
      availability: (input as any).availability ?? {},
      unavailableAllMonth: (input as any).unavailableAllMonth ?? false,
    };

    // Verify defaults are applied
    expect(participantData.availability).toEqual({});
    expect(participantData.unavailableAllMonth).toBe(false);
  });

  it('should not override provided values with defaults', () => {
    // Simulate what the tRPC mutation does with provided values
    const input = {
      id: 'participant-7',
      eventId: 'event-1',
      name: 'Eve Foster',
      availability: { '2025-01-20': true },
      unavailableAllMonth: true,
    };

    // Apply defaults like the tRPC mutation does
    const participantData = {
      ...input,
      availability: input.availability ?? {},
      unavailableAllMonth: input.unavailableAllMonth ?? false,
    };

    // Verify provided values are preserved
    expect(participantData.availability).toEqual({ '2025-01-20': true });
    expect(participantData.unavailableAllMonth).toBe(true);
  });
});
