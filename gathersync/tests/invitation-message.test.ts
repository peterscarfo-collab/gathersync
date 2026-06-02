import { describe, it, expect } from 'vitest';
import {
  getInvitationEmailSubject,
  prependUpdateToMessage,
  shouldDefaultToUpdate,
} from '../lib/invitation-message';

describe('invitation-message', () => {
  it('uses distinct subjects for invite vs update', () => {
    expect(getInvitationEmailSubject('AI Guys', false)).toBe('Invitation: AI Guys');
    expect(getInvitationEmailSubject('AI Guys', true)).toBe('UPDATE — AI Guys (details changed)');
  });

  it('prepends update banner text to SMS body', () => {
    const body = prependUpdateToMessage('Monday 3:30pm', true);
    expect(body).toContain('UPDATE');
    expect(body).toContain('Monday 3:30pm');
  });

  it('defaults to update when event was emailed before', () => {
    expect(shouldDefaultToUpdate({ lastInvitationSentAt: '2026-05-30T12:00:00.000Z' })).toBe(true);
    expect(shouldDefaultToUpdate({})).toBe(false);
  });
});
