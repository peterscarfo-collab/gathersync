import type { InfluencerProspect, InfluencerProspectType, InfluencerStatus, OutreachTrack } from '@/types/models';
import type { OutreachSegmentKey } from '@/lib/influencer-outreach-settings';

export interface ProspectTypeGuide {
  id: InfluencerProspectType;
  label: string;
  why: string;
  searchStrings: string[];
  lookFor: string[];
  outreachTemplate: 'mastermind' | 'real_estate' | 'networking' | 'prospect';
  tier: 'A' | 'B' | 'C';
}

export const PROSPECT_TYPE_GUIDES: ProspectTypeGuide[] = [
  {
    id: 'mastermind',
    label: 'Mastermind facilitator',
    tier: 'A',
    why: 'Same pain as your AI Guys story. Copy Event + Best Day = instant wow.',
    searchStrings: [
      '"mastermind facilitator"',
      '"run a mastermind" "monthly"',
      '"peer advisory group" founder',
      '"accountability group" entrepreneur facilitator',
    ],
    lookFor: ['Facilitate/host/run + mastermind', 'Monthly meeting language', '500–5,000 connections'],
    outreachTemplate: 'mastermind',
  },
  {
    id: 'skool',
    label: 'Skool / community owner',
    tier: 'A',
    why: 'They sell community — GatherSync runs the meetings their community depends on.',
    searchStrings: [
      '"Skool community" founder',
      '"built a community" entrepreneurs coach',
      '"paid community" mastermind owner',
      'Circle community founder entrepreneur',
    ],
    lookFor: ['Skool link in featured section', '200–5,000 members', 'Recurring calls in description'],
    outreachTemplate: 'mastermind',
  },
  {
    id: 'bni',
    label: 'BNI / referral networking leader',
    tier: 'A',
    why: 'Chapter meetings + lead tracking = directory + fixed events + Email All.',
    searchStrings: [
      '"BNI" president OR director OR "chapter ambassador"',
      '"referral marketing" group leader Australia',
      '"business networking group" founder chapter',
      '"Leads group" organizer entrepreneur',
    ],
    lookFor: ['Chapter President in headline', 'Regional networking posts', 'Member success stories'],
    outreachTemplate: 'networking',
  },
  {
    id: 'real_estate',
    label: 'Real estate team coach',
    tier: 'A',
    why: 'Prospects CRM, Missing Data, bulk invite — built for letterbox-drop workflows.',
    searchStrings: [
      '"real estate team" leader coach Australia',
      '"help agents" team building coach',
      '"letterbox" OR "prospecting" real estate coach',
      '"principal" "sales team" real estate training',
    ],
    lookFor: ['Trains teams not solo agents', 'Prospecting systems content', 'Skool or YouTube linked'],
    outreachTemplate: 'real_estate',
  },
  {
    id: 'sales_team',
    label: 'Sales team / SDR leader',
    tier: 'B',
    why: 'Fixed events, attendance, SMS reminders, directory for reps and prospects.',
    searchStrings: [
      '"sales team" manager "weekly meeting" OR "team huddle"',
      '"SDR team" leader coach',
      '"sales enablement" runs training sessions',
      '"field sales" team leader Australia',
    ],
    lookFor: ['Manages 5–50 reps', 'Team meeting posts', 'Not enterprise-only admins'],
    outreachTemplate: 'real_estate',
  },
  {
    id: 'group_coach',
    label: 'Business coach (group program)',
    tier: 'B',
    why: 'Cohort calls, office hours, client events — magic link RSVP, Copy Event.',
    searchStrings: [
      '"group coaching program" founder',
      '"cohort" coach entrepreneurs',
      '"high ticket" group program facilitator',
      '"runs a group program" business coach',
    ],
    lookFor: ['Group program / cohort in offer', 'Application funnel to group', '3K–50K followers or engaged list'],
    outreachTemplate: 'mastermind',
  },
  {
    id: 'podcast',
    label: 'Podcast host (networking niche)',
    tier: 'B',
    why: 'Trusted voice; audience full of organizers. Easier yes than celebrity hosts.',
    searchStrings: [
      '"podcast host" entrepreneur networking',
      '"host of" podcast business owners Australia',
      'podcaster mastermind OR referral',
    ],
    lookFor: ['50–500 episodes', 'Guests are group leaders', 'Offers community to listeners'],
    outreachTemplate: 'mastermind',
  },
  {
    id: 'meetup',
    label: 'Meetup organizer',
    tier: 'B',
    why: 'Already schedules recurring IRL events; low friction to try on next meetup.',
    searchStrings: [
      '"Meetup" organizer entrepreneur',
      '"event organizer" business networking',
      '"community manager" meetup business',
    ],
    lookFor: ['Organizer of [Group] in headline', 'Monthly cadence', 'Active in last 60 days'],
    outreachTemplate: 'networking',
  },
  {
    id: 'franchise',
    label: 'Franchise / multi-location operator',
    tier: 'C',
    why: 'Recurring training days and regional huddles — Copy Event scales.',
    searchStrings: [
      '"franchise" owner training meetings',
      '"multi-location" business owner mastermind',
      '"franchisee" conference organizer',
    ],
    lookFor: ['5–50 locations', 'Franchise meeting posts', 'Regional training language'],
    outreachTemplate: 'networking',
  },
  {
    id: 'ai_peer_group',
    label: 'AI / tech peer group host',
    tier: 'A',
    why: 'Your tribe — authentic founder peer story.',
    searchStrings: [
      '"AI founders" meetup OR mastermind OR community',
      '"build in public" community host',
      '"AI entrepreneurs" group Australia',
    ],
    lookFor: ['Weekly/monthly Zoom', 'Founders/builders audience', 'LinkedIn + X cross-posting'],
    outreachTemplate: 'mastermind',
  },
  {
    id: 'directory_prospect',
    label: 'Directory prospect',
    tier: 'C',
    why: 'Name + phone from Participant Directory — SMS, call, or email. No LinkedIn required.',
    searchStrings: [],
    lookFor: ['Phone or email in directory', 'May have website only', 'Not necessarily a group organizer'],
    outreachTemplate: 'prospect',
  },
];

export const STATUS_LABELS: Record<InfluencerStatus, string> = {
  research: 'Research',
  contacted: 'Contacted',
  follow_up_1: 'Follow-up 1',
  follow_up_2: 'Follow-up 2',
  interested: 'Interested',
  lifetime_granted: 'Lifetime Pro',
  active: 'Active Partner',
  declined: 'Declined',
  not_a_fit: 'Not a Fit',
};

export const STATUS_ORDER: InfluencerStatus[] = [
  'research',
  'contacted',
  'follow_up_1',
  'follow_up_2',
  'interested',
  'lifetime_granted',
  'active',
  'declined',
  'not_a_fit',
];

export const TRACK_LABELS: Record<OutreachTrack, string> = {
  influencer: 'Influencer',
  prospect: 'Prospect',
};

export function resolveOutreachTrack(
  p: Pick<InfluencerProspect, 'outreachTrack' | 'prospectType'>
): OutreachTrack {
  if (p.outreachTrack) return p.outreachTrack;
  return p.prospectType === 'directory_prospect' ? 'prospect' : 'influencer';
}

export function getOutreachSegmentForRecord(
  p: Pick<InfluencerProspect, 'prospectType' | 'outreachTrack'>
): OutreachSegmentKey {
  if (resolveOutreachTrack(p) === 'prospect') return 'prospect';
  const guide = getTypeGuide(p.prospectType);
  return guide?.outreachTemplate || 'mastermind';
}

export const TYPE_LABELS: Record<InfluencerProspectType, string> = {
  mastermind: 'Mastermind',
  skool: 'Skool / Community',
  bni: 'BNI / Networking',
  real_estate: 'Real Estate',
  sales_team: 'Sales Team',
  group_coach: 'Group Coach',
  podcast: 'Podcast Host',
  meetup: 'Meetup Organizer',
  franchise: 'Franchise',
  ai_peer_group: 'AI Peer Group',
  directory_prospect: 'Directory Prospect',
  other: 'Other',
};

export const OUTREACH_TEMPLATES = {
  mastermind: {
    subject: 'Built this after my mastermind scheduling meltdown — thought of you',
    body: `Hi [First name],

I came across [specific group name] and immediately thought of you.

I run a mastermind called the "AI Guys" — and every month, scheduling our call was the part I dreaded most. What should take two minutes turned into endless email chains.

So I built GatherSync:
• Create an event without picking a date first — one link, everyone taps days they're free
• GatherSync calculates the Best Day automatically
• Copy Event for recurring meetings — same list, new month, two minutes
• Every attendee saved to a directory automatically

I'd like to gift you 60 days Pro — run one live event in GatherSync and it's yours. Would a 15-minute look be worth it?

Peter Scarfo
Founder, GatherSync
app.gathersync.app`,
  },
  real_estate: {
    subject: 'Your prospect list + your events — finally in one place',
    body: `Hi [First name],

I built GatherSync after scheduling chaos in my own peer group — but it's perfect for sales teams and real estate groups juggling prospects AND events.

• Prospects Directory — add leads without assigning to an event yet
• Filter & bulk invite — e.g. letterbox-drop prospects → virtual open home in one step
• Missing Data dashboard — find No Phone / Email / Source, export, fix, re-import
• Global sync — update a phone once, it updates everywhere

I'd like to gift you 60 days Pro once you run one live event. Worth 15 minutes to walk through the prospect → event workflow?

Peter Scarfo
Founder, GatherSync
app.gathersync.app`,
  },
  networking: {
    subject: 'Every RSVP builds your directory — built for group organizers',
    body: `Hi [First name],

I noticed you lead [chapter / referral group] — I built something I think would save you and your members serious time.

For regular meetings:
• Fixed or flexible events, one RSVP link, Email All Participants
• Copy Event next month — same member list, new date, 2 minutes

For your member database:
• Every RSVP saved automatically to your Participant Directory
• Add contacts as Prospects before they're ready for an event
• Export filtered lists to improve data quality over time

I'd like to gift you 60 days Pro — run one live event on your next meeting and tell me honestly if it earns a mention?

Peter Scarfo
Founder, GatherSync
app.gathersync.app`,
  },
  prospect: {
    subject: 'Quick intro — scheduling meetings without the back-and-forth',
    body: `Hi [First name],

Peter Scarfo here — I built GatherSync to make scheduling group meetings less painful: send one link, people tap when they're free, you pick the best day.

Worth a look if you run any regular meetings or client events: app.gathersync.app

Peter`,
  },
};

export function getTypeGuide(type: InfluencerProspectType): ProspectTypeGuide | undefined {
  return PROSPECT_TYPE_GUIDES.find(g => g.id === type);
}
