/** Subject lines and copy for first invite vs meeting update emails */

export function getInvitationEmailSubject(eventName: string, isUpdate: boolean): string {
  if (isUpdate) {
    return `UPDATE — ${eventName} (details changed)`;
  }
  return `Invitation: ${eventName}`;
}

export function getUpdateEmailBannerHtml(): string {
  return `<div style="background-color: #FF6B00; color: #ffffff; padding: 14px 16px; border-radius: 8px; margin: 0 0 16px 0; font-weight: bold; font-size: 18px; text-align: center; letter-spacing: 0.3px;">⚠️ MEETING UPDATE — details have changed</div>`;
}

export function getUpdateSmsPrefix(): string {
  return '⚠️ UPDATE — meeting details have changed:\n\n';
}

export function prependUpdateToMessage(message: string, isUpdate: boolean): string {
  if (!isUpdate) return message;
  if (message.startsWith('⚠️ UPDATE')) return message;
  return `${getUpdateSmsPrefix()}${message}`;
}

export function shouldDefaultToUpdate(event: { lastInvitationSentAt?: string }): boolean {
  return !!event.lastInvitationSentAt;
}
