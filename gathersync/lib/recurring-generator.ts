/**
 * Utilities for generating events from recurring templates
 */

import type { RecurringEventTemplate, Event, Participant } from '@/types/models';
import { generateId } from './calendar-utils';

/**
 * Calculate the next occurrence date for a recurring template
 */
export function getNextOccurrence(
  template: RecurringEventTemplate,
  currentDate: Date = new Date()
): { month: number; year: number; day: number } | null {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // 1-12

  if (template.pattern === 'weekly' || template.pattern === 'biweekly') {
    // Find next occurrence of the specified day of week
    const targetDay = template.dayOfWeek!;
    const daysInMonth = new Date(year, month, 0).getDate();
    
    // Find all occurrences of the target day in the month
    const occurrences: number[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      if (date.getDay() === targetDay) {
        occurrences.push(day);
      }
    }

    if (occurrences.length > 0) {
      return { month, year, day: occurrences[0] };
    }
  } else if (template.pattern === 'monthly') {
    // Calculate specific week and day of month (e.g., "First Friday")
    const targetWeek = template.weekOfMonth!; // 1-5
    const targetDay = template.dayOfWeek!; // 0-6
    
    const daysInMonth = new Date(year, month, 0).getDate();
    let weekCount = 0;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      if (date.getDay() === targetDay) {
        weekCount++;
        if (weekCount === targetWeek || (targetWeek === 5 && weekCount >= 4 && day + 7 > daysInMonth)) {
          // Found the target occurrence or it's the last occurrence
          return { month, year, day };
        }
      }
    }
  }

  return null;
}

/**
 * Generate an event from a recurring template for a specific month/year
 */
export function generateEventFromTemplate(
  template: RecurringEventTemplate,
  month: number,
  year: number
): Event {
  const participants: Participant[] = template.participantNames.map(name => ({
    id: generateId(),
    name,
    availability: {},
    unavailableAllMonth: false,
  }));

  const event: Event = {
    id: generateId(),
    name: template.name,
    eventType: 'flexible', // Recurring events are always flexible
    month,
    year,
    participants,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return event;
}

/**
 * Check if a template should generate an event for the current month
 */
export function shouldGenerateForMonth(
  template: RecurringEventTemplate,
  month: number,
  year: number
): boolean {
  if (!template.active) {
    return false;
  }

  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  
  // Check if already generated for this month
  if (template.lastGeneratedMonth === monthKey) {
    return false;
  }

  // For weekly/biweekly, generate if there's an occurrence in this month
  if (template.pattern === 'weekly' || template.pattern === 'biweekly') {
    const occurrence = getNextOccurrence(template, new Date(year, month - 1, 1));
    return occurrence !== null && occurrence.month === month && occurrence.year === year;
  }

  // For monthly, always generate
  if (template.pattern === 'monthly') {
    const occurrence = getNextOccurrence(template, new Date(year, month - 1, 1));
    return occurrence !== null && occurrence.month === month && occurrence.year === year;
  }

  return false;
}

/**
 * Get a human-readable description of the recurrence pattern
 */
export function getRecurrenceDescription(template: RecurringEventTemplate): string {
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const WEEKS = ['First', 'Second', 'Third', 'Fourth', 'Last'];

  if (template.pattern === 'weekly') {
    return `Every ${DAYS[template.dayOfWeek!]}`;
  }

  if (template.pattern === 'biweekly') {
    return `Every other ${DAYS[template.dayOfWeek!]}`;
  }

  if (template.pattern === 'monthly') {
    return `${WEEKS[template.weekOfMonth! - 1]} ${DAYS[template.dayOfWeek!]} of each month`;
  }

  return template.pattern;
}
