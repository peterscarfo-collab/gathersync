import { Event, Participant } from '@/types/models';

export interface HostProfile {
  name: string;
  subtitle?: string;
  digitalTwinUrl: string;
  participantId?: string;
}

/** Resolve the primary host Digital Twin for the public RSVP page. */
export function resolveHostProfile(event: Event): HostProfile | null {
  const findLeader = () =>
    event.teamLeader
      ? event.participants.find(
          (p) => p.name.toLowerCase() === event.teamLeader!.toLowerCase()
        )
      : undefined;

  if (event.digitalTwinUrl) {
    const leader = findLeader();
    return {
      name: event.teamLeader || leader?.name || 'Your host',
      subtitle: formatSubtitle(leader),
      digitalTwinUrl: event.digitalTwinUrl,
      participantId: leader?.id,
    };
  }

  const leader = findLeader();
  if (leader?.digitalTwinUrl) {
    return {
      name: leader.name,
      subtitle: formatSubtitle(leader),
      digitalTwinUrl: leader.digitalTwinUrl,
      participantId: leader.id,
    };
  }

  const withTwin = event.participants.filter((p) => p.digitalTwinUrl);
  if (withTwin.length === 1) {
    const p = withTwin[0];
    return {
      name: p.name,
      subtitle: formatSubtitle(p),
      digitalTwinUrl: p.digitalTwinUrl!,
      participantId: p.id,
    };
  }

  return null;
}

/** Other participants with Digital Twin links (excludes the host card). */
export function getFeaturedParticipants(
  event: Event,
  host: HostProfile | null
): Participant[] {
  return event.participants.filter(
    (p) => p.digitalTwinUrl && p.id !== host?.participantId
  );
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
