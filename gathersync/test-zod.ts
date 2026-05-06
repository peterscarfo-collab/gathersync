import { z } from 'zod';

const schema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255),
  eventType: z.enum(["flexible", "fixed"]),
  month: z.number().min(1).max(12),
  year: z.number(),
  fixedDate: z.string().optional(),
  fixedTime: z.string().optional(),
  reminderDaysBefore: z.number().optional(),
  reminderScheduled: z.boolean().optional(),
  archived: z.boolean().optional(),
  finalized: z.boolean().optional(),
  finalizedDate: z.string().optional(),
  teamLeader: z.string().optional(),
  teamLeaderPhone: z.string().optional(),
  meetingType: z.enum(["in-person", "virtual"]).optional(),
  venueName: z.string().optional(),
  venueContact: z.string().optional(),
  venuePhone: z.string().optional(),
  meetingLink: z.string().optional(),
  rsvpDeadline: z.string().optional(),
  meetingNotes: z.string().optional(),
  deletedAt: z.date().nullable().optional(),
});

const payload = {
  id: '123',
  name: 'Sync Testing',
  eventType: 'flexible',
  month: 5,
  year: 2026,
  deletedAt: null
};

try {
  schema.parse(payload);
  console.log("VALID");
} catch (e) {
  console.error(e);
}
