/**
 * Utilities for determining participant response status
 */

import type { Participant, Event } from '@/types/models';
import { getDaysInMonth } from './calendar-utils';

export type ParticipantStatus = 'responded' | 'partial' | 'no-response';

/**
 * Get the response status for a participant
 */
export function getParticipantStatus(
  participant: Participant,
  event: Event
): ParticipantStatus {
  // If marked as unavailable all month, they've responded
  if (participant.unavailableAllMonth) {
    return 'responded';
  }

  // Count how many days they've marked
  const totalDays = getDaysInMonth(event.month, event.year);
  const markedDays = Object.keys(participant.availability).length;

  if (markedDays === 0) {
    return 'no-response';
  } else if (markedDays < totalDays) {
    return 'partial';
  } else {
    return 'responded';
  }
}

/**
 * Get status badge info (icon, color, label)
 */
export function getStatusBadge(status: ParticipantStatus): {
  icon: string;
  color: string;
  label: string;
} {
  switch (status) {
    case 'responded':
      return {
        icon: '✓',
        color: '#10B981', // green
        label: 'Responded',
      };
    case 'partial':
      return {
        icon: '◐',
        color: '#F59E0B', // orange
        label: 'Partial',
      };
    case 'no-response':
      return {
        icon: '?',
        color: '#6B7280', // gray
        label: 'No Response',
      };
  }
}
