export interface InfluencerDocument {
  id: string;
  title: string;
  description: string;
  path: string;
  filename: string;
  kind?: 'pdf' | 'image' | 'audio';
}

export interface InfluencerPodcast {
  id: string;
  title: string;
  description: string;
  path: string;
  filename: string;
  duration?: string;
}

export interface InfluencerDemoVideo {
  id: string;
  title: string;
  description: string;
  /** External URL (YouTube, Loom, etc.) */
  url?: string;
  /** Hosted file on app.gathersync.app/documents/ */
  path?: string;
  duration?: string;
  comingSoon?: boolean;
}

export interface ReplyKitTemplate {
  id: string;
  title: string;
  trigger: string;
  body: string;
}

export interface SocialPostTemplate {
  id: string;
  title: string;
  platform: string;
  body: string;
}

/** Live GetBizCard — talking intro + CTA to gathersync.app */
export const GETBIZCARD_GATHERSYNC_URL = 'https://app.getbizcard.com/gathersync/';

export type OutreachSegmentKey = 'mastermind' | 'real_estate' | 'networking' | 'prospect';

export interface SmsOutreachTemplate {
  id: 'prospect';
  title: string;
  description: string;
  body: string;
}

export interface LinkedInFirstTouchTemplate {
  id: OutreachSegmentKey;
  title: string;
  description: string;
  body: string;
}

export interface HeyGenScriptTemplate {
  id: OutreachSegmentKey;
  title: string;
  duration: string;
  description: string;
  script: string;
}

export interface OutreachMergeContext {
  firstName?: string;
  groupName?: string;
  personalVideoUrl?: string;
  giftOffer?: string;
  origin?: string;
}

export const DEFAULT_GIFT_OFFER =
  '60 days Pro — run one live event in GatherSync and it\'s yours';

export const GIFT_OFFER_PRESETS = [
  DEFAULT_GIFT_OFFER,
  '60 days Pro plus a 15-minute onboarding walkthrough',
  '30-day Pro trial — no card required',
  'Free account plus help setting up your first event',
  '15-minute walkthrough only — no pressure',
] as const;

export const DEFAULT_GIFT_OFFERS: Record<OutreachSegmentKey, string> = {
  mastermind: DEFAULT_GIFT_OFFER,
  real_estate: DEFAULT_GIFT_OFFER,
  networking: DEFAULT_GIFT_OFFER,
  prospect: '30-day Pro trial — try GatherSync on your next meeting',
};

export const INFLUENCER_DOCUMENTS: InfluencerDocument[] = [
  {
    id: 'overview-infographic',
    title: 'One-page overview (infographic)',
    description:
      'Mastering GatherSync at a glance — flexible vs fixed events, invitations, CSV import, Best Day, attendance, and backups.',
    path: '/documents/GatherSync-Overview-Infographic.png',
    filename: 'GatherSync-Overview-Infographic.png',
    kind: 'image',
  },
  {
    id: 'user-guide',
    title: 'User Guide',
    description: 'Dashboard help and tutorials — flexible events, CSV import, participant CRM, and backup.',
    path: '/documents/GatherSync-User-Guide.pdf',
    filename: 'GatherSync-User-Guide.pdf',
    kind: 'pdf',
  },
  {
    id: 'user-manual',
    title: 'User Manual',
    description: 'Complete step-by-step manual for organizers and invitees.',
    path: '/documents/GatherSync-User-Manual.pdf',
    filename: 'GatherSync-User-Manual.pdf',
    kind: 'pdf',
  },
  {
    id: 'qr-app',
    title: 'QR code — app.gathersync.app',
    description: 'Scan to open the GatherSync app. Use on slides, flyers, or event handouts.',
    path: '/documents/QR-app.gathersync.app.png',
    filename: 'QR-app.gathersync.app.png',
    kind: 'image',
  },
  {
    id: 'qr-marketing',
    title: 'QR code — gathersync.app',
    description: 'Scan to open the marketing site. Use when you want the homepage, not the app login.',
    path: '/documents/QR-gathersync.app.png',
    filename: 'QR-gathersync.app.png',
    kind: 'image',
  },
];

export const INFLUENCER_PODCASTS: InfluencerPodcast[] = [
  {
    id: 'group-text-chaos',
    title: 'Ending group text chaos with GatherSync',
    description:
      'Founder story and deeper dive — flexible events, Best Day, and why group leaders built this. Good for a commute listen.',
    path: '/documents/Ending_group_text_chaos_with_GatherSync.m4a',
    filename: 'Ending_group_text_chaos_with_GatherSync.m4a',
    duration: '23:50',
  },
];

/** Hosted HeyGen mastermind intro — used in LinkedIn DMs when prospect has no custom video URL. */
export const DEFAULT_OUTREACH_AVATAR_VIDEO_ID = 'avatar-60day-pro';

export const INFLUENCER_DEMO_VIDEOS: InfluencerDemoVideo[] = [
  {
    id: DEFAULT_OUTREACH_AVATAR_VIDEO_ID,
    title: 'Mastermind intro — Peter avatar (~45 sec)',
    description:
      'HeyGen intro for mastermind / peer-group outreach. LinkedIn DMs use this link automatically unless you paste a different URL on the prospect.',
    path: '/documents/Avatar-Video-60Day-Pro.mp4',
    duration: '~45 sec',
  },
  {
    id: 'try-gathersync-free',
    title: 'Try GatherSync Free — GetBizCard intro (~30 sec)',
    description:
      'Peter avatar intro from your GetBizCard card. Host for outreach follow-ups, LinkedIn video posts, and YouTube Shorts. Card: app.getbizcard.com/gathersync/',
    path: '/documents/try-gathersync-free.mp4',
    duration: '~30 sec',
  },
  {
    id: 'stop-chasing-rsvps-short',
    title: 'Stop Chasing RSVPs (23 sec Short)',
    description:
      'HeyGen Short on group-chat scheduling pain — one link, Best Day, no chasing. Good for social posts and warm follow-ups.',
    path: '/documents/Stop-Chasing-RSVPs.mp4',
    url: 'https://youtu.be/lN2uXSTw2Ls',
    duration: '23 sec',
  },
  {
    id: 'growth-engine-presentation',
    title: 'GatherSync Growth Engine presentation',
    description:
      'Full presentation on GatherSync’s growth engine — share with interested prospects who want the bigger picture before a call.',
    path: '/documents/Gathersync_Growth_Engine_Presentation.mp4',
  },
  {
    id: 'explainer',
    title: 'GatherSync explainer (7 min)',
    description:
      'NotebookLM overview — what GatherSync is, who it is for, and how group scheduling works. Good first watch before they try the app.',
    url: 'https://www.youtube.com/watch?v=hBVmiOVSqtE',
  },
  {
    id: 'create-flexible-event',
    title: 'Create a Flexible Event (YouTube Short)',
    description:
      'Quick demo — create a flexible event, share the link, and GatherSync finds the Best Day for your group.',
    url: 'https://www.youtube.com/shorts/L-U13tCSPas',
  },
  {
    id: 'flexible-meeting-demo',
    title: 'CSV import & Best Day walkthrough (coming soon)',
    description:
      'Screen recording: import a CSV with available days, then review Best Day results — test if your group will work in minutes.',
    comingSoon: true,
  },
];

export const LINKEDIN_FIRST_TOUCH_TEMPLATES: LinkedInFirstTouchTemplate[] = [
  {
    id: 'mastermind',
    title: 'Mastermind / community leader',
    description: 'First LinkedIn DM or connection note — pair with your HeyGen intro video.',
    body: `Hi {{First name}},

I came across {{Group name}} and thought of you immediately.

I run a mastermind called the "AI Guys" — and every month, scheduling our call was the part I dreaded most. So I built GatherSync: one link, everyone taps when they're free, it picks the Best Day. Copy Event next month in two minutes.

Quick intro from me (45 sec): [personal video link]

One-page overview: [infographic link]
Growth engine deck (if you want the bigger picture): [growth engine presentation link]

Happy to gift you {{Gift offer}} if you run recurring group calls.

Peter
app.gathersync.app`,
  },
  {
    id: 'real_estate',
    title: 'Real estate / sales team leader',
    description: 'First LinkedIn DM — prospects CRM + events in one place.',
    body: `Hi {{First name}},

I built GatherSync after scheduling chaos in my own peer group — but it's built for teams juggling prospects AND events.

Prospects Directory, bulk invite to open homes, Missing Data dashboard, global contact sync — and flexible or fixed events with one RSVP link.

45-sec intro from me: [personal video link]

One-page overview: [infographic link]
User Guide: [User Guide link]

I'd like to gift you {{Gift offer}}. Worth a quick look before your next team meeting?

Peter
app.gathersync.app`,
  },
  {
    id: 'networking',
    title: 'BNI / networking / meetup organizer',
    description: 'First LinkedIn DM — directory + recurring meetings.',
    body: `Hi {{First name}},

I noticed you lead {{Group name}} — I built something I think would save you and your members serious time.

Every RSVP builds your Participant Directory automatically. Fixed or flexible events, Email All Participants, Copy Event next month — same list, new date, two minutes.

45-sec intro from me: [personal video link]

One-page overview: [infographic link]
Try the app: app.gathersync.app

Happy to gift you {{Gift offer}}.

Peter`,
  },
  {
    id: 'prospect',
    title: 'Directory prospect — email',
    description: 'Email when you have an address but no LinkedIn. Keep it short.',
    body: `Hi {{First name}},

Peter Scarfo here — I built GatherSync to make scheduling group meetings less painful: send one link, people tap when they're free, you pick the best day. No app required for them.

If you run any kind of regular meeting or client events, worth a look: gathersync.app

Happy to help you set up a first event if useful — {{Gift offer}}.

Peter
hello@gathersync.app`,
  },
];

export const SMS_OUTREACH_TEMPLATES: SmsOutreachTemplate[] = [
  {
    id: 'prospect',
    title: 'Directory prospect — SMS / text',
    description: 'Short text when you only have name + phone. Call if no reply in 2–3 days.',
    body: `Hi {{First name}}, Peter here — I built GatherSync to stop the back-and-forth when scheduling meetings (one link, people tap when they're free).

Worth a quick look? gathersync.app — or reply CALL and I'll ring you.`,
  },
];

export const HEYGEN_SCRIPT_TEMPLATES: HeyGenScriptTemplate[] = [
  {
    id: 'mastermind',
    title: 'Mastermind facilitator intro',
    duration: '~45 sec',
    description:
      'Generic mastermind intro — one video for all prospects; personalize their name in the LinkedIn DM. HeyGen MCP: "Create this video using my default avatar." End card: app.gathersync.app.',
    script: `Hi there, Peter here — founder of GatherSync.

If you run a mastermind or peer group, you know the pain... scheduling the monthly call takes longer than the call itself.

I built GatherSync after my own group — the AI Guys — became a monthly headache. One link goes to your members. They tap the days they're free. GatherSync finds the Best Day automatically.

Same people next month? Copy Event in two minutes.

I'm gifting {{Gift offer}} to group leaders who actually run recurring meetings. I'll drop links in my message — or visit app dot gathersync dot app.

Worth a look?`,
  },
  {
    id: 'real_estate',
    title: 'Real estate / sales team intro',
    duration: '~45 sec',
    description:
      'For team coaches and sales leaders. Mention prospect directory and bulk invite in the spoken script.',
    script: `Hi {{First name}}, Peter here — founder of GatherSync.

I built this after scheduling chaos in my own peer group — but it's perfect for sales teams and real estate groups juggling prospects AND events.

Add prospects to a directory before they're ready for an event. Filter your list, bulk invite to an open home or team huddle. Update a phone number once — it syncs everywhere.

Plus flexible scheduling: one RSVP link, Best Day calculated for the whole team.

I'm gifting {{Gift offer}} to organizers who want to test it on a real workflow. Links in my message — or app dot gathersync dot app.

Let me know if it's useful.`,
  },
  {
    id: 'networking',
    title: 'Networking / BNI / meetup intro',
    duration: '~45 sec',
    description:
      'For chapter leaders and meetup organizers. Emphasize directory and Copy Event.',
    script: `Hi {{First name}}, Peter here — founder of GatherSync.

If you lead a referral group, chapter, or recurring meetup — every RSVP should be building your member database, not disappearing into email threads.

GatherSync does both: schedule fixed or flexible events with one link... and every person who RSVPs lands in your Participant Directory automatically.

Next month's meeting? Copy Event — same member list, new date, two minutes.

I'm gifting {{Gift offer}} to group organizers. I'll send links in my message — or you can try app dot gathersync dot app.

Would love your honest take after one real meeting.`,
  },
];

export const REPLY_KIT_TEMPLATES: ReplyKitTemplate[] = [
  {
    id: 'tell-me-more',
    title: 'Tell me more',
    trigger: 'They ask what GatherSync is',
    body: `Great question — short version:

GatherSync finds the best meeting day for your whole group without email back-and-forth. One link, everyone taps when they're free, it picks the Best Day. Same people next month? Copy Event in 2 minutes.

Built it after scheduling my own mastermind ("AI Guys") became a monthly headache.

Happy to gift you 60 days Pro once you run one live event in GatherSync. Want a 15-min walkthrough, watch the 7-min explainer, or skim the one-page overview?

[explainer video link]
[infographic link]

Peter
app.gathersync.app`,
  },
  {
    id: 'yes-interested',
    title: 'Yes, interested',
    trigger: 'They want to look / book a call',
    body: `Brilliant — I'd love to show you.

I can walk you through it in 15 minutes — run one live event in GatherSync and I'll activate 60 days Pro on your account.

Which works for you?
• [Day/time option 1]
• [Day/time option 2]
• [Day/time option 3]

Or grab a slot here: [Calendly link if you have one]

Peter`,
  },
  {
    id: 'send-info',
    title: 'Send me something',
    trigger: 'They want materials before committing',
    body: `Absolutely — here's the fastest way to get a feel for it:

1. 30-sec intro video: [try gathersync short link]
2. Talking card (video + try free): [getbizcard link]
3. Explainer video (7 min): [explainer video link]
4. Create a Flexible Event demo (~1 min): [flexible event demo link]
5. Podcast (24 min): [podcast link]
6. One-page overview: [infographic link]
7. User Guide (PDF): [User Guide link]
8. User Manual (PDF): [User Manual link]
9. Try the app: app.gathersync.app

Best test: create a flexible event for your next group call, import your member list (or add a few people), and see the Best Day pop up in event history.

If it clicks, reply here — run one live event and I'll unlock 60 days Pro + walk you through Copy Event for next month.

Peter`,
  },
  {
    id: 'whats-the-catch',
    title: "What's the catch?",
    trigger: 'They ask about strings attached',
    body: `Fair question — no catch.

I'm early-stage and gifting 60 days Pro to group leaders who run one live event in GatherSync. I learn from your feedback, and if it saves you time, I may ask for an honest mention to your audience (optional, not required to keep Pro).

No contract, no exclusivity. Just: try it on a real meeting and tell me if it's useful.

Peter`,
  },
  {
    id: 'maybe-later',
    title: 'Maybe later',
    trigger: 'Not now — leave the door open',
    body: `No pressure at all — I'll leave the 60 days Pro offer open.

If scheduling your group ever feels like herding cats again, just message me here.

Peter
app.gathersync.app`,
  },
  {
    id: 'follow-up-day5',
    title: 'Follow-up (Day 5)',
    trigger: 'No reply after first DM or email — short video + card link',
    body: `Hi {{First name}},

Quick follow-up — 30-second intro if you prefer video to reading:

[try gathersync short link]

Or open my talking card (video + try-free button): [getbizcard link]

One-page overview: [infographic link]

Still happy to gift you {{Gift offer}} if you want to try it on your next group call.

Peter`,
  },
];

export const SOCIAL_POST_TEMPLATES: SocialPostTemplate[] = [
  {
    id: 'linkedin-video-post',
    title: 'LinkedIn video post',
    platform: 'LinkedIn',
    body: `Stop the "Tuesday works / Tuesday doesn't" loop.

I built GatherSync after scheduling my mastermind group drove me crazy every month — one link, everyone taps when they're free, GatherSync picks the Best Day automatically.

30-second intro → [try gathersync short link]
Talking card → [getbizcard link]
Try free → gathersync.app

#GatherSync #Mastermind #EventPlanning #GroupOrganizer`,
  },
  {
    id: 'youtube-short-description',
    title: 'YouTube Short description',
    platform: 'YouTube',
    body: `Stop chasing RSVPs. GatherSync finds the best meeting day for your whole group — one link, no app required.

Try free: https://gathersync.app
Talking card: [getbizcard link]
Hosted video: [try gathersync short link]

Built by Peter Scarfo after his mastermind ("AI Guys") turned scheduling into a monthly headache.

#GatherSync #Shorts #Mastermind #Productivity #Scheduling`,
  },
  {
    id: 'outreach-card-link',
    title: 'Outreach — add card to DM or email',
    platform: 'LinkedIn / Email',
    body: `30-sec intro on my talking card (video + try-free button):
[getbizcard link]

Or watch directly: [try gathersync short link]`,
  },
];

export function getOutreachResourceLinks(origin?: string) {
  const base = origin?.replace(/\/$/, '') || 'https://app.gathersync.app';
  const doc = (id: string) =>
    getPublicResourceUrl(INFLUENCER_DOCUMENTS.find(d => d.id === id)!.path, base);
  const explainer = INFLUENCER_DEMO_VIDEOS.find(v => v.id === 'explainer');
  const flexibleDemo = INFLUENCER_DEMO_VIDEOS.find(v => v.id === 'create-flexible-event');
  const growthEngine = INFLUENCER_DEMO_VIDEOS.find(v => v.id === 'growth-engine-presentation');
  const tryGathersyncShort = INFLUENCER_DEMO_VIDEOS.find(v => v.id === 'try-gathersync-free');
  return {
    guideLink: doc('user-guide'),
    manualLink: doc('user-manual'),
    infographicLink: doc('overview-infographic'),
    podcastLink: INFLUENCER_PODCASTS[0]
      ? getPublicResourceUrl(INFLUENCER_PODCASTS[0].path, base)
      : '[podcast link]',
    explainerLink: explainer?.url || '[explainer video link]',
    flexibleDemoLink: flexibleDemo
      ? getDemoVideoUrl(flexibleDemo, base) || '[flexible event demo link]'
      : '[flexible event demo link]',
    growthEngineLink: growthEngine
      ? getDemoVideoUrl(growthEngine, base) || '[growth engine presentation link]'
      : '[growth engine presentation link]',
    tryGathersyncShortLink: tryGathersyncShort
      ? getDemoVideoUrl(tryGathersyncShort, base) || '[try gathersync short link]'
      : '[try gathersync short link]',
    getbizcardLink: GETBIZCARD_GATHERSYNC_URL,
  };
}

export function getDefaultOutreachAvatarVideoUrl(origin?: string): string | undefined {
  const video = INFLUENCER_DEMO_VIDEOS.find(v => v.id === DEFAULT_OUTREACH_AVATAR_VIDEO_ID);
  return video ? getDemoVideoUrl(video, origin) : undefined;
}

export function mergeOutreachPlaceholders(text: string, ctx: OutreachMergeContext = {}): string {
  const links = getOutreachResourceLinks(ctx.origin);
  const firstName = ctx.firstName?.trim() || '[First name]';
  const groupName = ctx.groupName?.trim() || '[specific group name]';
  const personalVideo =
    ctx.personalVideoUrl?.trim() ||
    getDefaultOutreachAvatarVideoUrl(ctx.origin) ||
    '[personal video link — paste HeyGen URL on prospect after rendering]';
  const giftOffer = ctx.giftOffer?.trim() || DEFAULT_GIFT_OFFER;

  return text
    .replace(/\{\{First name\}\}/g, firstName)
    .replace(/\[First name\]/g, firstName)
    .replace(/\{\{Group name\}\}/g, groupName)
    .replace(/\[specific group name\]/g, groupName)
    .replace(/\[chapter \/ referral group\]/g, groupName)
    .replace(/\{\{Gift offer\}\}/g, giftOffer)
    .replace(/\[Gift offer\]/g, giftOffer)
    .replace(/\[personal video link\]/g, personalVideo)
    .replace(/\[personal video link — paste HeyGen URL on prospect after rendering\]/g, personalVideo)
    .replace('[User Guide link]', links.guideLink)
    .replace('[User Manual link]', links.manualLink)
    .replace('[infographic link]', links.infographicLink)
    .replace('[podcast link]', links.podcastLink)
    .replace('[flexible event demo link]', links.flexibleDemoLink)
    .replace('[explainer video link]', links.explainerLink)
    .replace('[growth engine presentation link]', links.growthEngineLink)
    .replace('[try gathersync short link]', links.tryGathersyncShortLink)
    .replace('[getbizcard link]', links.getbizcardLink)
    .replace('[your demo video link]', links.explainerLink)
    .replace('[your demo video link — add URL in Resources when ready]', links.explainerLink);
}

export function getLinkedInTemplateForSegment(
  segment: OutreachSegmentKey
): LinkedInFirstTouchTemplate {
  return LINKEDIN_FIRST_TOUCH_TEMPLATES.find(t => t.id === segment)!;
}

export function getHeyGenScriptForSegment(segment: OutreachSegmentKey): HeyGenScriptTemplate {
  return HEYGEN_SCRIPT_TEMPLATES.find(t => t.id === segment)!;
}

export function buildHeyGenMcpPrompt(script: string): string {
  return `Create a ~45 second HeyGen video using my default avatar. End card text: app.gathersync.app

Script:

${script.trim()}`;
}

export function getPublicResourceUrl(path: string, origin?: string): string {
  if (origin) return `${origin.replace(/\/$/, '')}${path}`;
  return path;
}

export function getDemoVideoUrl(
  video: InfluencerDemoVideo,
  origin?: string
): string | undefined {
  if (video.url) return video.url;
  if (video.path) return getPublicResourceUrl(video.path, origin);
  return undefined;
}
