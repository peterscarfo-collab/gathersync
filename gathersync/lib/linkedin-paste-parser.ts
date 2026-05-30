import type { InfluencerProspectType } from '@/types/models';

export interface LinkedInPasteResult {
  name?: string;
  niche?: string;
  contactLinkedIn?: string;
  websiteUrl?: string;
  contactEmail?: string;
  followersOrMembers?: string;
  groupNameFrequency?: string;
  notes?: string;
  prospectType?: InfluencerProspectType;
  platform?: string;
  recurringGroup?: boolean;
  warnings: string[];
}

const LINKEDIN_URL_RE = /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[^\s)\]"']+/gi;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const WEBSITE_RE = /(?:https?:\/\/|www\.)[^\s)\]"']+/gi;
const FOLLOWERS_RE = /([\d,.]+\+?\s*(?:followers?|connections?|members?))/i;
const SECTION_HEADERS = /^(about|experience|education|skills|interests|activity|recommendations|featured|services|licenses|volunteering)$/i;
const NOISE_LINE =
  /^(connect|message|follow|more|contact info|\.\.\.|…|open to work|hiring|promoted|view my services)$/i;
const CONNECTION_DEGREE = /^[·•]\s*\d+(?:st|nd|rd|th)?\+?$/i;

/** Coaching / professional credentials often appended to LinkedIn slugs */
const CREDENTIAL_SUFFIXES = new Set([
  'mcc', 'pcc', 'cpcc', 'acc', 'icf', 'nlp', 'phd', 'dba', 'md', 'do', 'jd', 'mba', 'cpa', 'cfa',
  'rn', 'lpc', 'lmft', 'lmhc', 'bsn', 'msw', 'edd', 'pe', 'esq', 'cpt', 'cscs', 'pmp', 'csp', 'cpm',
  'chc', 'cmc', 'bmc', 'fmmc', 'emcc', 'actc', 'bcc', 'nbcc', 'cpcc', 'orscc', 'cpcc',
]);

const COMMON_FIRST_NAMES = new Set([
  'aaron', 'adam', 'alan', 'albert', 'alex', 'alexander', 'alice', 'amanda', 'amy', 'andrea', 'andrew',
  'angela', 'ann', 'anna', 'anne', 'anthony', 'arthur', 'ashley', 'barbara', 'benjamin', 'betty', 'brian',
  'brenda', 'carol', 'caroline', 'catherine', 'charles', 'chris', 'christian', 'christina', 'christopher',
  'daniel', 'david', 'deborah', 'dennis', 'diana', 'donald', 'donna', 'dorothy', 'douglas', 'edward', 'elizabeth',
  'emily', 'emma', 'eric', 'ethan', 'fiona', 'frank', 'gary', 'george', 'greg', 'gregory', 'harold', 'helen',
  'henry', 'jack', 'james', 'jane', 'janet', 'jason', 'jean', 'jeff', 'jeffrey', 'jennifer', 'jeremy', 'jerry',
  'jessica', 'joan', 'john', 'jonathan', 'joseph', 'joshua', 'joyce', 'judith', 'judy', 'julia', 'justin',
  'karen', 'karin', 'karyn', 'katherine', 'kathleen', 'kathryn', 'keith', 'kenneth', 'kevin', 'kimberly', 'laura', 'lawrence',
  'linda', 'lisa', 'lori', 'louis', 'margaret', 'maria', 'marie', 'mark', 'martha', 'mary', 'matthew', 'megan',
  'melissa', 'michael', 'michelle', 'nancy', 'nathan', 'nicholas', 'nicole', 'noah', 'olivia', 'patricia',
  'paul', 'peter', 'philip', 'philippa', 'rachel', 'ralph', 'raymond', 'rebecca', 'richard', 'robert', 'roger',
  'ronald', 'rose', 'ruth', 'ryan', 'samuel', 'sandra', 'sara', 'sarah', 'scott', 'sean', 'sharon', 'stephanie',
  'stephen', 'steven', 'susan', 'teresa', 'terry', 'theresa', 'thomas', 'timothy', 'victoria', 'vincent',
  'virginia', 'walter', 'wayne', 'william', 'zachary',
]);

const FIRST_NAMES_BY_LENGTH = [...COMMON_FIRST_NAMES].sort((a, b) => b.length - a.length);

function isLinkedInIdSuffix(part: string): boolean {
  return /^\d{3,}$/.test(part) || /^[a-f0-9]{6,}$/i.test(part);
}

function isCredentialSuffix(part: string): boolean {
  return CREDENTIAL_SUFFIXES.has(part.toLowerCase());
}

function titleCaseWord(word: string): string {
  if (isCredentialSuffix(word)) return word.toUpperCase();
  if (word.length <= 4 && word === word.toUpperCase()) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function splitScore(first: string, last: string): number {
  let score = 0;
  if (COMMON_FIRST_NAMES.has(first)) score += 12;
  if (last.length >= 3 && last.length <= 14) score += 4;
  if (first.length >= 3 && first.length <= 10) score += 2;
  return score;
}

function isBetterNameSplit(
  candidate: { first: string; last: string; score: number },
  current: { first: string; last: string; score: number } | null
): boolean {
  if (!current) return true;
  if (candidate.score !== current.score) return candidate.score > current.score;

  const candidateKnown = COMMON_FIRST_NAMES.has(candidate.first);
  const currentKnown = COMMON_FIRST_NAMES.has(current.first);
  if (candidateKnown !== currentKnown) return candidateKnown;

  return candidate.first.length < current.first.length;
}

function splitConcatenatedSlug(segment: string): string[] {
  const lower = segment.toLowerCase();
  if (lower.length < 5) return [segment];

  for (const firstName of FIRST_NAMES_BY_LENGTH) {
    if (lower.startsWith(firstName) && lower.length > firstName.length + 1) {
      const rest = lower.slice(firstName.length);
      if (rest.length >= 2 && !isCredentialSuffix(rest)) {
        return [firstName, rest];
      }
    }
  }

  let best: { first: string; last: string; score: number } | null = null;
  for (let i = 3; i <= lower.length - 2; i++) {
    const first = lower.slice(0, i);
    const last = lower.slice(i);
    if (isCredentialSuffix(last)) continue;

    const candidate = { first, last, score: splitScore(first, last) };
    if (isBetterNameSplit(candidate, best)) {
      best = candidate;
    }
  }

  return best && best.score >= 6 ? [best.first, best.last] : [segment];
}

function formatPersonName(nameParts: string[]): string {
  return nameParts.map(titleCaseWord).join(' ');
}

function stripLinkedInTitleSuffix(line: string): string {
  const dashMatch = line.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (!dashMatch) return line;

  const before = dashMatch[1].trim();
  const after = dashMatch[2].trim();
  const beforeWords = before.split(/\s+/).filter(Boolean);

  if (beforeWords.length >= 1 && beforeWords.length <= 4 && after.length > 2) {
    return before;
  }

  return line;
}

function normalizePastedNameLine(line: string): string {
  return stripLinkedInTitleSuffix(
    line
      .replace(/\s*[·•]\s*\d+(?:st|nd|rd|th)?\+?\s*$/, '')
      .replace(/\s*\|\s*linkedin.*$/i, '')
      .replace(/\s*[-–—]\s*linkedin.*$/i, '')
      .trim()
  );
}

function parseDisplayName(raw: string): { nameParts: string[]; credentials: string[] } {
  const trimmed = normalizePastedNameLine(raw);
  const segments = trimmed.split(',').map(part => part.trim()).filter(Boolean);
  if (segments.length === 0) return { nameParts: [], credentials: [] };

  const nameWords = segments[0].split(/\s+/).filter(Boolean);
  const credentials: string[] = [];

  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];
    if (/^[\p{L}]{2,8}$/u.test(segment)) {
      credentials.push(segment);
    } else {
      nameWords.push(...segment.split(/\s+/).filter(Boolean));
    }
  }

  return { nameParts: nameWords, credentials };
}

function formatDisplayName(raw: string): string {
  const { nameParts } = parseDisplayName(raw);
  if (nameParts.length === 0) return raw.trim();
  return formatPersonName(nameParts);
}

export function inferProspectTypeFromText(text: string): InfluencerProspectType {
  const lower = text.toLowerCase();
  if (/real estate|realtor|agent|letterbox/i.test(lower)) return 'real_estate';
  if (/bni|network(?:ing)?|referral|chapter|meetup/i.test(lower)) return 'bni';
  if (/skool|community owner|cohort/i.test(lower)) return 'skool';
  if (/sales team|sdr|sales enablement/i.test(lower)) return 'sales_team';
  if (/mastermind|peer group|executive roundtable/i.test(lower)) return 'mastermind';
  if (/coach|group program|facilitator/i.test(lower)) return 'group_coach';
  if (/podcast|host/i.test(lower)) return 'podcast';
  return 'other';
}

function normalizeLinkedInUrl(raw: string): string {
  const trimmed = raw.trim().replace(/[.,;]+$/, '');
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return trimmed.replace(/\/$/, '');
  }
}

export function nameFromLinkedInSlug(url: string): string | undefined {
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  if (!match) return undefined;

  let parts = decodeURIComponent(match[1])
    .replace(/\/$/, '')
    .split('-')
    .filter(Boolean);
  if (parts.length === 0) return undefined;

  if (parts.length > 1 && isLinkedInIdSuffix(parts[parts.length - 1])) {
    parts.pop();
  }

  while (parts.length > 0 && isCredentialSuffix(parts[parts.length - 1])) {
    parts.pop();
  }

  const expandedParts: string[] = [];
  for (const part of parts) {
    if (/^[a-z]+$/i.test(part) && part.length >= 8) {
      expandedParts.push(...splitConcatenatedSlug(part));
    } else {
      expandedParts.push(part);
    }
  }

  if (expandedParts.length === 1 && /^[a-z]+$/i.test(expandedParts[0]) && expandedParts[0].length >= 8) {
    expandedParts.splice(0, 1, ...splitConcatenatedSlug(expandedParts[0]));
  }

  if (expandedParts.length === 0) {
    return undefined;
  }

  return formatPersonName(expandedParts);
}

function looksLikeName(line: string): boolean {
  const trimmed = normalizePastedNameLine(line.trim());
  if (trimmed.length < 2 || trimmed.length > 80) return false;
  if (/https?:\/\//i.test(trimmed) || trimmed.includes('@') || trimmed.includes('|')) return false;
  if (NOISE_LINE.test(trimmed) || CONNECTION_DEGREE.test(trimmed) || SECTION_HEADERS.test(trimmed)) {
    return false;
  }
  if (FOLLOWERS_RE.test(trimmed)) return false;

  const { nameParts, credentials } = parseDisplayName(trimmed);
  if (nameParts.length < 1 || nameParts.length > 5) return false;
  if (!nameParts.every(word => /^[\p{L}][\p{L}'’.-]*$/u.test(word))) return false;
  if (credentials.some(cred => !/^[\p{L}]{2,8}$/u.test(cred))) return false;

  return true;
}

function looksLikeHeadline(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 4 || trimmed.length > 220) return false;
  if (NOISE_LINE.test(trimmed) || CONNECTION_DEGREE.test(trimmed) || SECTION_HEADERS.test(trimmed)) {
    return false;
  }
  if (FOLLOWERS_RE.test(trimmed)) return false;
  if (looksLikeLocation(trimmed) && !/\bat\b|\||\//i.test(trimmed)) return false;
  return true;
}

function looksLikeLocation(line: string): boolean {
  const trimmed = line.trim();
  if (/greater .+ area/i.test(trimmed)) return true;
  if (/\b(area|region)\b/i.test(trimmed) && !/\bat\b|\||coach|founder|ceo/i.test(trimmed)) return true;
  const commaParts = trimmed.split(',').map(part => part.trim()).filter(Boolean);
  return commaParts.length >= 2 && commaParts.every(part => part.length < 40);
}

function stripConnectionSuffix(line: string): string {
  return formatDisplayName(line);
}

function extractNameFromPaste(text: string, contentLines: string[]): string | undefined {
  const titleLine = text
    .split('\n')
    .map(line => line.trim())
    .find(line => /\|\s*linkedin/i.test(line) || /\s[-–—]\s*linkedin/i.test(line));
  if (titleLine && looksLikeName(titleLine.replace(/\s*\|\s*linkedin.*$/i, '').replace(/\s*[-–—]\s*linkedin.*$/i, ''))) {
    return formatDisplayName(titleLine);
  }

  for (const line of contentLines) {
    if (looksLikeName(line)) {
      return stripConnectionSuffix(line);
    }
  }

  return undefined;
}

function extractCompanyFromHeadline(headline: string): string | undefined {
  const atMatch = headline.match(/\bat\s+([^|·•\n]+?)(?:\s*[|·•]|$)/i);
  if (atMatch?.[1]) return atMatch[1].trim();

  const pipeParts = headline.split('|').map(part => part.trim()).filter(Boolean);
  if (pipeParts.length >= 2) {
    const last = pipeParts[pipeParts.length - 1];
    if (last.length <= 80 && !/helping|building|growing|founder|coach/i.test(last)) {
      return last;
    }
  }
  return undefined;
}

function extractAboutSection(lines: string[]): string | undefined {
  const aboutIndex = lines.findIndex(line => SECTION_HEADERS.test(line.trim()) && /^about$/i.test(line.trim()));
  if (aboutIndex === -1) return undefined;

  const aboutLines: string[] = [];
  for (let i = aboutIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (SECTION_HEADERS.test(line)) break;
    if (NOISE_LINE.test(line) || CONNECTION_DEGREE.test(line)) continue;
    aboutLines.push(line);
  }

  const about = aboutLines.join('\n').trim();
  return about.length > 0 ? about : undefined;
}

function extractExperienceCompany(lines: string[]): string | undefined {
  const expIndex = lines.findIndex(line => /^experience$/i.test(line.trim()));
  if (expIndex === -1) return undefined;

  for (let i = expIndex + 1; i < Math.min(expIndex + 6, lines.length); i++) {
    const line = lines[i].trim();
    if (!line || SECTION_HEADERS.test(line)) continue;
    const companyMatch = line.match(/^(.+?)\s*[·•]\s*(?:Full-time|Part-time|Self-employed|Contract|Freelance)/i);
    if (companyMatch?.[1]) return companyMatch[1].trim();
    if (line.includes(' · ') && !looksLikeHeadline(line)) {
      return line.split(' · ')[0]?.trim();
    }
  }
  return undefined;
}

export function parseLinkedInPaste(raw: string): LinkedInPasteResult {
  const warnings: string[] = [];
  const text = raw.replace(/\r\n/g, '\n').trim();
  if (!text) {
    return { warnings: ['Nothing to parse'] };
  }

  const linkedInMatches = text.match(LINKEDIN_URL_RE) || [];
  const contactLinkedIn = linkedInMatches[0] ? normalizeLinkedInUrl(linkedInMatches[0]) : undefined;

  const emailMatch = text.match(EMAIL_RE);
  const contactEmail = emailMatch?.[0];

  const websiteMatch = (text.match(WEBSITE_RE) || []).find(url => !/linkedin\.com/i.test(url));
  const websiteUrl = websiteMatch
    ? websiteMatch.startsWith('http')
      ? websiteMatch.replace(/[.,;]+$/, '')
      : `https://${websiteMatch.replace(/[.,;]+$/, '')}`
    : undefined;

  const followersMatch = text.match(FOLLOWERS_RE);
  const followersOrMembers = followersMatch?.[1]?.trim();

  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .filter(line => !LINKEDIN_URL_RE.test(line))
    .filter(line => !EMAIL_RE.test(line) || line.replace(EMAIL_RE, '').trim().length > 0)
    .filter(line => {
      if (WEBSITE_RE.test(line) && line.replace(WEBSITE_RE, '').trim().length === 0) return false;
      return true;
    });

  const about = extractAboutSection(lines);
  const experienceCompany = extractExperienceCompany(lines);

  let name: string | undefined;
  let niche: string | undefined;
  let locationNote: string | undefined;

  const contentLines = lines.filter(line => {
    if (SECTION_HEADERS.test(line) && !/^about$/i.test(line)) return false;
    if (NOISE_LINE.test(line)) return false;
    if (CONNECTION_DEGREE.test(line)) return false;
    if (/^about$/i.test(line)) return false;
    return true;
  });

  for (let i = 0; i < contentLines.length; i++) {
    const line = contentLines[i];
    if (!name && looksLikeName(line)) {
      name = stripConnectionSuffix(line);
      continue;
    }
    if (name && !niche && looksLikeHeadline(line)) {
      niche = line;
      continue;
    }
    if (name && !locationNote && looksLikeLocation(line)) {
      locationNote = line;
    }
  }

  if (!name) {
    name = extractNameFromPaste(text, contentLines);
  }

  if (!name && contactLinkedIn) {
    name = nameFromLinkedInSlug(contactLinkedIn);
    if (name) warnings.push('Name guessed from LinkedIn URL — confirm before saving.');
  }

  if (!name && contentLines.length === 1 && looksLikeHeadline(contentLines[0])) {
    warnings.push('Could not find a name — add it manually.');
  }

  const groupNameFrequency =
    (niche ? extractCompanyFromHeadline(niche) : undefined) || experienceCompany;

  const noteParts: string[] = [];
  if (locationNote) noteParts.push(`Location: ${locationNote}`);
  if (about) noteParts.push(about);

  const combinedText = [name, niche, groupNameFrequency, about, locationNote, text].filter(Boolean).join('\n');
  const prospectType = inferProspectTypeFromText(combinedText);
  const recurringGroup = /weekly|monthly|mastermind|cohort|roundtable|peer group|every (?:week|month)/i.test(
    combinedText
  );

  if (!niche && !contactLinkedIn && !name) {
    warnings.push('Paste a LinkedIn URL or copy name + headline from the profile.');
  }

  return {
    name,
    niche,
    contactLinkedIn,
    websiteUrl,
    contactEmail,
    followersOrMembers,
    groupNameFrequency,
    notes: noteParts.length ? noteParts.join('\n\n') : undefined,
    prospectType,
    platform: 'LinkedIn',
    recurringGroup: recurringGroup || undefined,
    warnings,
  };
}
