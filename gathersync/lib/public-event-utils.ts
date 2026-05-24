import { Event, Participant } from '@/types/models';

export interface HostProfile {
  name: string;
  subtitle?: string;
  digitalTwinUrl: string;
  participantId?: string;
}

/** Digital Twin URL for the event host (team leader or event-level link only). */
export function getTeamLeaderDigitalTwinUrl(event: Event): string | undefined {
  if (event.digitalTwinUrl) return event.digitalTwinUrl;
  if (!event.teamLeader) return undefined;
  const leader = event.participants.find(
    (p) => p.name.toLowerCase() === event.teamLeader!.toLowerCase()
  );
  return leader?.digitalTwinUrl;
}

/** Resolve the primary host Digital Twin for the public RSVP page. */
export function resolveHostProfile(event: Event): HostProfile | null {
  const twinUrl = getTeamLeaderDigitalTwinUrl(event);
  if (!twinUrl) return null;

  const leader = event.teamLeader
    ? event.participants.find(
        (p) => p.name.toLowerCase() === event.teamLeader!.toLowerCase()
      )
    : undefined;

  return {
    name: event.teamLeader || leader?.name || 'Your host',
    subtitle: formatSubtitle(leader),
    digitalTwinUrl: twinUrl,
    participantId: leader?.id,
  };
}

function formatSubtitle(participant?: Participant): string | undefined {
  if (!participant) return undefined;
  const parts = [participant.designation, participant.organization].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export function getTwinLinkLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.includes('getbizcard')) return 'Watch intro on GetBizCard';
    return `View profile on ${host}`;
  } catch {
    return 'View host profile';
  }
}
