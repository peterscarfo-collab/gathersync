import { APP_VERSION } from '@/constants/version';

export type ReleaseNoteSection = {
  title: 'Added' | 'Changed' | 'Fixed' | 'Planned';
  items: string[];
};

export type ReleaseNote = {
  version: string;
  date: string;
  summary: string;
  sections: ReleaseNoteSection[];
};

/** In-app release history — keep in sync with CHANGELOG.md */
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.1.0',
    date: '2026-06-15',
    summary: 'Conference events (Phase 1), session schedule for organizers, and cloud sync improvements.',
    sections: [
      {
        title: 'Added',
        items: [
          'Conference event type — multi-day date range, all-day, venue capacity, selection deadline',
          'Session schedule — organizers add/edit/delete sessions (time, speaker, room, capacity)',
          'Conference display on event cards and event detail',
          'Versioned web deploy zips (gathersync-web-vX.Y.Z-date.zip)',
        ],
      },
      {
        title: 'Fixed',
        items: [
          'Events list could load before login and skip cloud sync',
          'Event list refreshes after background sync completes',
          'New events use cloud retry queue instead of silent failures',
        ],
      },
    ],
  },
  {
    version: '1.0.0',
    date: '2025-12-16',
    summary: 'Initial production release — flexible/fixed events, cloud sync, admin, and outreach tools.',
    sections: [
      {
        title: 'Added',
        items: [
          'Flexible events (find best day) and fixed events (RSVP)',
          'Participants, import, SMS/email invitations',
          'Cloud sync, backup/restore, subscriptions',
          'Admin dashboard, influencer pipeline, BizoMedia CRM webhook',
          'Meeting UPDATE emails when event details change',
        ],
      },
    ],
  },
];

export function getCurrentRelease(): ReleaseNote | undefined {
  const normalized = APP_VERSION.replace(/^v/, '');
  return RELEASE_NOTES.find((r) => r.version === normalized);
}

export function getVersionDisplay(): string {
  return `v${APP_VERSION.replace(/^v/, '')}`;
}
