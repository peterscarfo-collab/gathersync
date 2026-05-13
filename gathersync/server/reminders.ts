import * as db from './db';
import { sendEmail } from './email';
import { eq, and, isNotNull, sql } from 'drizzle-orm';

export function startReminderCron() {
  // Run every hour
  setInterval(async () => {
    try {
      await checkAndSendReminders();
    } catch (error) {
      console.error('[Reminders] Error checking reminders:', error);
    }
  }, 60 * 60 * 1000);
  
  // Also run once on startup
  setTimeout(checkAndSendReminders, 5000);
}

async function checkAndSendReminders() {
  console.log('[Reminders] Checking for events that need reminders...');
  
  // We need to find events where:
  // 1. eventType is 'fixed'
  // 2. fixedDate is set
  // 3. reminderDaysBefore is set
  // 4. reminderScheduled is false or null
  // 5. The current date is within reminderDaysBefore of fixedDate
  
  // Since we don't have a direct query for this, we'll fetch all upcoming fixed events
  // and filter them in memory (assuming the number of events is manageable)
  
  const allEvents = await db.getAllEvents();
  const upcomingFixedEvents = allEvents.filter(e => 
    e.eventType === 'fixed' && 
    e.fixedDate && 
    e.reminderDaysBefore && 
    !e.reminderScheduled
  );
  
  const now = new Date();
  
  for (const event of upcomingFixedEvents) {
    if (!event.fixedDate || !event.reminderDaysBefore) continue;
    
    const eventDate = new Date(event.fixedDate);
    const timeDiffMs = eventDate.getTime() - now.getTime();
    const daysDiff = timeDiffMs / (1000 * 60 * 60 * 24);
    
    // If the event is within the reminder window (plus a small buffer)
    if (daysDiff > 0 && daysDiff <= event.reminderDaysBefore) {
      console.log(`[Reminders] Sending reminders for event: ${event.name}`);
      
      const participants = await db.getEventParticipants(event.id);
      const attendingParticipants = participants.filter(p => p.rsvpStatus === 'attending' && p.email);
      
      let sentCount = 0;
      for (const p of attendingParticipants) {
        if (!p.email) continue;
        
        const subject = `Reminder: ${event.name} is coming up!`;
        
        const meetingDetails = [];
        if (event.meetingType === 'in-person' && event.venueName) {
          meetingDetails.push(`📍 Venue: ${event.venueName}`);
        } else if (event.meetingType === 'virtual' && event.meetingLink) {
          meetingDetails.push(`💻 Meeting Link: <a href="${event.meetingLink}">${event.meetingLink}</a>`);
        }
        
        const html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #007AFF;">GatherSync Reminder</h2>
            <p>Hi ${p.name},</p>
            <p>This is a reminder that <strong>${event.name}</strong> is coming up soon!</p>
            <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 0 0 8px 0;"><strong>📅 Date:</strong> ${event.fixedDate}</p>
              ${event.fixedTime ? `<p style="margin: 0 0 8px 0;"><strong>⏰ Time:</strong> ${event.fixedTime}</p>` : ''}
              ${meetingDetails.map(d => `<p style="margin: 0 0 8px 0;">${d}</p>`).join('')}
            </div>
            <p>We look forward to seeing you there!</p>
            <br/>
            <p style="color: #666; font-size: 12px;">Powered by GatherSync</p>
          </div>
        `;
        
        const result = await sendEmail({ to: p.email, subject, html });
        if (result.success) sentCount++;
        
        // Add a 600ms delay between emails to respect Resend's 2 requests/second rate limit
        if (attendingParticipants.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 600));
        }
      }
      
      console.log(`[Reminders] Sent ${sentCount} reminders for event: ${event.name}`);
      
      // Mark as scheduled/sent
      await db.updateEvent(event.id, { reminderScheduled: true });
    }
  }
}
