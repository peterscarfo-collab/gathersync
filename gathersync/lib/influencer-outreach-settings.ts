import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  HEYGEN_SCRIPT_TEMPLATES,
  LINKEDIN_FIRST_TOUCH_TEMPLATES,
  SMS_OUTREACH_TEMPLATES,
  DEFAULT_GIFT_OFFERS,
  mergeOutreachPlaceholders,
  type OutreachSegmentKey,
} from '@/lib/influencer-resources';

const STORAGE_KEY = '@gathersync_influencer_outreach_settings';

export interface OutreachSegmentSettings {
  heyGenScript: string;
  linkedInBody: string;
  defaultGift: string;
}

export type OutreachSettings = Record<OutreachSegmentKey, OutreachSegmentSettings>;

export function getDefaultOutreachSettings(): OutreachSettings {
  return {
    mastermind: {
      heyGenScript: HEYGEN_SCRIPT_TEMPLATES.find(t => t.id === 'mastermind')!.script,
      linkedInBody: LINKEDIN_FIRST_TOUCH_TEMPLATES.find(t => t.id === 'mastermind')!.body,
      defaultGift: DEFAULT_GIFT_OFFERS.mastermind,
    },
    real_estate: {
      heyGenScript: HEYGEN_SCRIPT_TEMPLATES.find(t => t.id === 'real_estate')!.script,
      linkedInBody: LINKEDIN_FIRST_TOUCH_TEMPLATES.find(t => t.id === 'real_estate')!.body,
      defaultGift: DEFAULT_GIFT_OFFERS.real_estate,
    },
    networking: {
      heyGenScript: HEYGEN_SCRIPT_TEMPLATES.find(t => t.id === 'networking')!.script,
      linkedInBody: LINKEDIN_FIRST_TOUCH_TEMPLATES.find(t => t.id === 'networking')!.body,
      defaultGift: DEFAULT_GIFT_OFFERS.networking,
    },
    prospect: {
      heyGenScript: '',
      linkedInBody: LINKEDIN_FIRST_TOUCH_TEMPLATES.find(t => t.id === 'prospect')!.body,
      defaultGift: DEFAULT_GIFT_OFFERS.prospect,
    },
  };
}

export function getSegmentSettings(
  saved: Partial<OutreachSettings> | null | undefined,
  segment: OutreachSegmentKey
): OutreachSegmentSettings {
  const defaults = getDefaultOutreachSettings();
  const custom = saved?.[segment];
  if (!custom) return defaults[segment];
  return {
    heyGenScript: custom.heyGenScript?.trim() || defaults[segment].heyGenScript,
    linkedInBody: custom.linkedInBody?.trim() || defaults[segment].linkedInBody,
    defaultGift: custom.defaultGift?.trim() || defaults[segment].defaultGift,
  };
}

export async function loadOutreachSettings(): Promise<Partial<OutreachSettings>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<OutreachSettings>;
  } catch (error) {
    console.error('[OutreachSettings] load failed:', error);
    return {};
  }
}

export async function saveOutreachSettings(settings: OutreachSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export async function resetOutreachSettings(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export function generateProspectOutreach(
  segment: OutreachSegmentKey,
  ctx: {
    firstName?: string;
    groupName?: string;
    giftOffer?: string;
    personalVideoUrl?: string;
    origin?: string;
  },
  savedSettings?: Partial<OutreachSettings> | null
) {
  const segmentSettings = getSegmentSettings(savedSettings, segment);
  const mergeCtx = {
    firstName: ctx.firstName,
    groupName: ctx.groupName,
    giftOffer: ctx.giftOffer || segmentSettings.defaultGift,
    personalVideoUrl: ctx.personalVideoUrl,
    origin: ctx.origin,
  };
  return {
    heyGen: mergeOutreachPlaceholders(segmentSettings.heyGenScript, mergeCtx),
    linkedIn: mergeOutreachPlaceholders(segmentSettings.linkedInBody, mergeCtx),
    sms:
      segment === 'prospect'
        ? mergeOutreachPlaceholders(SMS_OUTREACH_TEMPLATES[0].body, mergeCtx)
        : undefined,
    defaultGift: segmentSettings.defaultGift,
  };
}
