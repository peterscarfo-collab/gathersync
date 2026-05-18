import { Resend } from 'resend';
import * as dotenv from 'dotenv';
dotenv.config();

// We will use a mock implementation if RESEND_API_KEY is not provided
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.FROM_EMAIL || 'GatherSync <noreply@gathersync.app>';

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!resend) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Email] Cannot send email: RESEND_API_KEY is not configured in production environment.');
      return { success: false, error: new Error('Email service is not configured') };
    }
    console.log('[Email Mock] Would send email to:', to);
    console.log('[Email Mock] Subject:', subject);
    console.log('[Email Mock] HTML:', html);
    return { success: true, mock: true };
  }

  try {
    const response = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    
    if (response.error) {
      console.error('[Email] Resend API Error:', response.error);
      return { success: false, error: response.error };
    }
    
    console.log('[Email] Sent email to', to, 'ID:', response.data?.id);
    return { success: true, id: response.data?.id };
  } catch (error) {
    console.error('[Email] Failed to send email to', to, error);
    return { success: false, error };
  }
}

export async function sendConfirmationEmail(participantEmail: string, participantName: string, eventName: string, rsvpStatus?: string, availableDaysCount?: number, meetingLink?: string) {
  const subject = `Your RSVP for ${eventName} is confirmed!`;
  
  let details = '';
  if (rsvpStatus) {
    details = `<p>You have marked your status as: <strong>${rsvpStatus === 'attending' ? 'Attending' : 'Not Attending'}</strong></p>`;
    if (rsvpStatus === 'attending' && meetingLink) {
      details += `<div style="background-color: #f0f8ff; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin-top: 0; font-weight: bold; color: #007AFF;">Meeting Link</p>
        <a href="${meetingLink}" style="color: #007AFF; text-decoration: underline;">${meetingLink}</a>
      </div>`;
    }
  } else if (availableDaysCount !== undefined) {
    details = `<p>You have indicated you are available on <strong>${availableDaysCount} days</strong>.</p>`;
  }

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #007AFF;">GatherSync</h2>
      <p>Hi ${participantName},</p>
      <p>Thank you for responding to the invitation for <strong>${eventName}</strong>.</p>
      ${details}
      <p>The organizer has been notified of your response.</p>
      <br/>
      <p style="color: #666; font-size: 12px;">Powered by GatherSync</p>
    </div>
  `;

  return sendEmail({ to: participantEmail, subject, html });
}

export async function sendInvitationEmail(participantEmail: string, participantName: string, eventName: string, eventDetails: string, link: string) {
  const subject = `Invitation: ${eventName}`;
  
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #007AFF;">GatherSync</h2>
      <p>Hi ${participantName},</p>
      <p>You have been invited to <strong>${eventName}</strong>.</p>
      <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
        ${eventDetails.replace(/\n/g, '<br/>')}
      </div>
      <p>Please click the button below to view the details and confirm your RSVP:</p>
      <a href="${link}" style="display: inline-block; background-color: #007AFF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 16px 0;">Respond Now</a>
      <br/>
      <p style="color: #666; font-size: 12px;">Powered by GatherSync</p>
    </div>
  `;

  return sendEmail({ to: participantEmail, subject, html });
}
