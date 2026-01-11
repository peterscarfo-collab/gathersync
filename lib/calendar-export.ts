/**
 * Calendar export utilities for generating .ics files
 */

import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Event } from '@/types/models';
import { getBestDays, formatDate } from './calendar-utils';

/**
 * Generate an .ics calendar file for the best day of an event
 */
export async function exportToCalendar(event: Event): Promise<void> {
  const bestDays = getBestDays(event);
  
  if (bestDays.length === 0) {
    throw new Error('No available days found for this event');
  }

  // Use the first best day
  const bestDay = bestDays[0];
  const [year, month, day] = bestDay.date.split('-').map(Number);
  
  // Create ICS content
  const icsContent = generateICS({
    title: event.name,
    date: new Date(year, month - 1, day),
    participants: event.participants.map(p => p.name),
    availableCount: bestDay.availableCount,
    totalCount: event.participants.length,
  });

  // Save to file
  const fileName = `${event.name.replace(/[^a-z0-9]/gi, '_')}.ics`;
  const file = new File(Paths.cache, fileName);
  await file.write(icsContent);

  // Share the file
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/calendar',
      dialogTitle: 'Add to Calendar',
    });
  } else {
    throw new Error('Sharing is not available on this device');
  }
}

/**
 * Generate ICS file content
 */
function generateICS(params: {
  title: string;
  date: Date;
  participants: string[];
  availableCount: number;
  totalCount: number;
}): string {
  const { title, date, participants, availableCount, totalCount } = params;

  // Format date for ICS (YYYYMMDD)
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  
  // Create timestamp
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  // Generate unique ID
  const uid = `${timestamp}-${Math.random().toString(36).substr(2, 9)}@gathersync.app`;

  // Build description
  const description = `${availableCount} out of ${totalCount} participants available\\n\\nParticipants:\\n${participants.join('\\n')}`;

  // Build ICS content
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GatherSync//Event Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${timestamp}`,
    `DTSTART;VALUE=DATE:${dateStr}`,
    `DTEND;VALUE=DATE:${dateStr}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return ics;
}
