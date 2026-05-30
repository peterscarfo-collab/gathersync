import { describe, it, expect } from 'vitest';
import {
  inferProspectTypeFromText,
  nameFromLinkedInSlug,
  parseLinkedInPaste,
} from '../lib/linkedin-paste-parser';

describe('linkedin-paste-parser', () => {
  describe('nameFromLinkedInSlug', () => {
    it('derives a readable name from profile slug', () => {
      expect(nameFromLinkedInSlug('https://www.linkedin.com/in/philip-cohen-123456789/')).toBe('Philip Cohen');
    });

    it('keeps slug when no numeric suffix', () => {
      expect(nameFromLinkedInSlug('https://linkedin.com/in/jane-smith')).toBe('Jane Smith');
    });

    it('splits concatenated slug and strips credentials from name', () => {
      expect(nameFromLinkedInSlug('https://www.linkedin.com/in/philipcohen-mcc/')).toBe('Philip Cohen');
      expect(nameFromLinkedInSlug('https://www.linkedin.com/in/philip-cohen-mcc/')).toBe('Philip Cohen');
      expect(nameFromLinkedInSlug('https://www.linkedin.com/in/karyngreenstreet/')).toBe('Karyn Greenstreet');
    });
  });

  describe('inferProspectTypeFromText', () => {
    it('detects mastermind and coach niches', () => {
      expect(inferProspectTypeFromText('Mastermind facilitator for founders')).toBe('mastermind');
      expect(inferProspectTypeFromText('Group coach running weekly programs')).toBe('group_coach');
    });
  });

  describe('parseLinkedInPaste', () => {
    it('parses URL-only paste', () => {
      const result = parseLinkedInPaste('https://www.linkedin.com/in/philip-cohen-123456789/');
      expect(result.contactLinkedIn).toBe('https://www.linkedin.com/in/philip-cohen-123456789');
      expect(result.name).toBe('Philip Cohen');
      expect(result.platform).toBe('LinkedIn');
    });

    it('parses concatenated slug URL without credentials in name', () => {
      const result = parseLinkedInPaste('https://www.linkedin.com/in/philipcohen-mcc/');
      expect(result.name).toBe('Philip Cohen');
    });

    it('parses pasted name with credential suffix stripped from name', () => {
      const result = parseLinkedInPaste(`Philip Cohen, MCC
· 2nd
Executive coach and mastermind facilitator`);

      expect(result.name).toBe('Philip Cohen');
    });

    it('parses pasted LinkedIn title line with role suffix', () => {
      const result = parseLinkedInPaste(`Karyn Greenstreet - Mastermind Group Expert
· 2nd
Mastermind Group Facilitator and Small Biz Consultant
https://www.linkedin.com/in/karyngreenstreet/`);

      expect(result.name).toBe('Karyn Greenstreet');
    });

    it('parses typical copied profile header', () => {
      const result = parseLinkedInPaste(`Philip Cohen
· 2nd
Mastermind facilitator | Helping coaches build peer groups
Greater Sydney Area
500+ connections`);

      expect(result.name).toBe('Philip Cohen');
      expect(result.niche).toContain('Mastermind facilitator');
      expect(result.followersOrMembers).toBe('500+ connections');
      expect(result.prospectType).toBe('mastermind');
      expect(result.recurringGroup).toBe(true);
      expect(result.notes).toContain('Location: Greater Sydney Area');
    });

    it('extracts about, email, website, and linkedin url together', () => {
      const result = parseLinkedInPaste(`Jane Smith
Skool community owner at Growth Lab
Melbourne, Victoria, Australia
1,234 followers
https://www.linkedin.com/in/jane-smith
www.growthlab.com
jane@growthlab.com

About
I run weekly masterminds for service business owners.`);

      expect(result.name).toBe('Jane Smith');
      expect(result.contactLinkedIn).toContain('linkedin.com/in/jane-smith');
      expect(result.websiteUrl).toBe('https://www.growthlab.com');
      expect(result.contactEmail).toBe('jane@growthlab.com');
      expect(result.groupNameFrequency).toBe('Growth Lab');
      expect(result.prospectType).toBe('skool');
      expect(result.notes).toContain('weekly masterminds');
    });

    it('returns warning for empty paste', () => {
      const result = parseLinkedInPaste('   ');
      expect(result.warnings).toContain('Nothing to parse');
    });
  });
});
