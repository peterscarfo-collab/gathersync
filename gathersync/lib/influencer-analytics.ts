import { parseIsoDate } from '@/components/outreach-date-field';
import { STATUS_LABELS, TYPE_LABELS } from '@/lib/influencer-playbook';
import type { InfluencerProspect, InfluencerStatus } from '@/types/models';

export interface ProspectActivityEvent {
  kind: string;
  date: string;
  label: string;
}

export interface RecentProspectSummary {
  prospectId: string;
  name: string;
  status: InfluencerStatus;
  lastActivityDate: string;
  summary: string;
  saleAmount?: number;
}

export interface OutreachAnalytics {
  totals: {
    prospects: number;
    connectionsSent: number;
    fullDmsSent: number;
    awaitingAccept: number;
    inProgress: number;
    interested: number;
    proGranted: number;
    activePartners: number;
    declined: number;
    totalRevenue: number;
    salesCount: number;
  };
  thisWeek: {
    connectionsSent: number;
    fullDmsSent: number;
    prospectsAdded: number;
    revenue: number;
  };
  today: {
    connectionsSent: number;
    fullDmsSent: number;
    revenue: number;
  };
  rates: {
    dmSentAfterConnection: number | null;
    interestedAfterContact: number | null;
    proGrantedAfterContact: number | null;
  };
  byStatus: { status: InfluencerStatus; label: string; count: number }[];
  byType: { type: string; label: string; count: number }[];
  byTier: { tier: string; count: number }[];
  followUpsDue: InfluencerProspect[];
  recentProspects: RecentProspectSummary[];
}

const IN_PROGRESS: InfluencerStatus[] = ['contacted', 'follow_up_1', 'follow_up_2', 'interested'];
const TERMINAL: InfluencerStatus[] = ['declined', 'not_a_fit', 'lifetime_granted', 'active'];

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

function isOnOrAfter(iso: string | undefined, boundary: Date): boolean {
  const date = parseIsoDate(iso);
  if (!date) return false;
  return startOfDay(date).getTime() >= boundary.getTime();
}

function isSameDay(iso: string | undefined, day: Date): boolean {
  const date = parseIsoDate(iso);
  if (!date) return false;
  return startOfDay(date).getTime() === startOfDay(day).getTime();
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

function saleValue(p: InfluencerProspect): number {
  return p.saleAmount != null && !Number.isNaN(p.saleAmount) ? Number(p.saleAmount) : 0;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getProspectActivityTimeline(
  p: InfluencerProspect,
  options?: { followUpDue?: boolean }
): ProspectActivityEvent[] {
  const events: ProspectActivityEvent[] = [];
  const add = (kind: string, date: string | undefined, label: string) => {
    if (!date?.trim()) return;
    events.push({ kind, date: date.trim(), label });
  };

  add('added', p.createdAt.split('T')[0], 'Added to pipeline');
  add('connection', p.outreachDate, 'Connection note sent');
  add('dm', p.fullDmSentDate, 'Full LinkedIn DM sent');
  add('pro', p.grantDate, 'Lifetime Pro granted');
  if (p.saleAmount != null && p.saleAmount > 0) {
    add(
      'sale',
      p.saleDate || p.grantDate || p.updatedAt.split('T')[0],
      `Sale recorded — ${formatCurrency(p.saleAmount)}`
    );
  }
  if (p.followUp1Date) add('follow_up_1', p.followUp1Date, 'Follow-up 1 planned');
  if (p.followUp2Date) add('follow_up_2', p.followUp2Date, 'Follow-up 2 planned');
  if (options?.followUpDue) add('follow_up_due', p.followUp1Date || p.followUp2Date, 'Follow-up due');

  return events.sort((a, b) => b.date.localeCompare(a.date));
}

export function getRecentProspectSummaries(
  prospects: InfluencerProspect[],
  followUpsDue: InfluencerProspect[],
  limit = 15
): RecentProspectSummary[] {
  const dueIds = new Set(followUpsDue.map(p => p.id));

  return prospects
    .map(p => {
      const timeline = getProspectActivityTimeline(p, { followUpDue: dueIds.has(p.id) });
      const meaningful = timeline.filter(e => e.kind !== 'follow_up_1' && e.kind !== 'follow_up_2');
      const lastActivityDate = meaningful[0]?.date || p.createdAt.split('T')[0];
      const summary =
        meaningful
          .slice(0, 4)
          .map(e => e.label.replace(/^Sale recorded — .+$/, 'Sale recorded'))
          .join(' · ') || 'Added to pipeline';

      return {
        prospectId: p.id,
        name: p.name,
        status: p.status,
        lastActivityDate,
        summary,
        saleAmount: p.saleAmount,
      };
    })
    .sort((a, b) => b.lastActivityDate.localeCompare(a.lastActivityDate))
    .slice(0, limit);
}

export function computeOutreachAnalytics(prospects: InfluencerProspect[]): OutreachAnalytics {
  const now = new Date();
  const weekStart = startOfWeek(now);

  const connectionsSent = prospects.filter(p => !!p.outreachDate?.trim());
  const fullDmsSent = prospects.filter(p => !!p.fullDmSentDate?.trim());
  const awaitingAccept = prospects.filter(
    p => !!p.outreachDate?.trim() && !p.fullDmSentDate?.trim() && IN_PROGRESS.includes(p.status)
  );
  const withSales = prospects.filter(p => saleValue(p) > 0);
  const totalRevenue = withSales.reduce((sum, p) => sum + saleValue(p), 0);

  const byStatusMap = new Map<InfluencerStatus, number>();
  for (const p of prospects) {
    byStatusMap.set(p.status, (byStatusMap.get(p.status) || 0) + 1);
  }

  const byTypeMap = new Map<string, number>();
  for (const p of prospects) {
    byTypeMap.set(p.prospectType, (byTypeMap.get(p.prospectType) || 0) + 1);
  }

  const byTierMap = new Map<string, number>();
  for (const p of prospects) {
    byTierMap.set(p.priorityTier, (byTierMap.get(p.priorityTier) || 0) + 1);
  }

  const followUpsDue = prospects.filter(p => {
    if (TERMINAL.includes(p.status)) return false;
    const due1 = p.followUp1Date && parseIsoDate(p.followUp1Date);
    const due2 = p.followUp2Date && parseIsoDate(p.followUp2Date);
    const todayStart = startOfDay(now).getTime();
    const due =
      (due1 && startOfDay(due1).getTime() <= todayStart) ||
      (due2 && startOfDay(due2).getTime() <= todayStart);
    return due && IN_PROGRESS.includes(p.status);
  });

  const interested = prospects.filter(p => p.status === 'interested').length;
  const proGranted = prospects.filter(p => p.lifetimeProGranted || p.status === 'lifetime_granted').length;
  const contactDenominator = connectionsSent.length;

  const weekRevenue = withSales
    .filter(p => isOnOrAfter(p.saleDate || p.grantDate, weekStart))
    .reduce((sum, p) => sum + saleValue(p), 0);

  const todayRevenue = withSales
    .filter(p => isSameDay(p.saleDate || p.grantDate, now))
    .reduce((sum, p) => sum + saleValue(p), 0);

  return {
    totals: {
      prospects: prospects.length,
      connectionsSent: connectionsSent.length,
      fullDmsSent: fullDmsSent.length,
      awaitingAccept: awaitingAccept.length,
      inProgress: prospects.filter(p => IN_PROGRESS.includes(p.status)).length,
      interested,
      proGranted,
      activePartners: prospects.filter(p => p.status === 'active').length,
      declined: prospects.filter(p => p.status === 'declined' || p.status === 'not_a_fit').length,
      totalRevenue,
      salesCount: withSales.length,
    },
    thisWeek: {
      connectionsSent: connectionsSent.filter(p => isOnOrAfter(p.outreachDate, weekStart)).length,
      fullDmsSent: fullDmsSent.filter(p => isOnOrAfter(p.fullDmSentDate, weekStart)).length,
      prospectsAdded: prospects.filter(p => isOnOrAfter(p.createdAt.split('T')[0], weekStart)).length,
      revenue: weekRevenue,
    },
    today: {
      connectionsSent: connectionsSent.filter(p => isSameDay(p.outreachDate, now)).length,
      fullDmsSent: fullDmsSent.filter(p => isSameDay(p.fullDmSentDate, now)).length,
      revenue: todayRevenue,
    },
    rates: {
      dmSentAfterConnection: pct(fullDmsSent.length, contactDenominator),
      interestedAfterContact: pct(interested, contactDenominator),
      proGrantedAfterContact: pct(proGranted, contactDenominator),
    },
    byStatus: Array.from(byStatusMap.entries())
      .map(([status, count]) => ({ status, label: STATUS_LABELS[status], count }))
      .sort((a, b) => b.count - a.count),
    byType: Array.from(byTypeMap.entries())
      .map(([type, count]) => ({ type, label: TYPE_LABELS[type as keyof typeof TYPE_LABELS] || type, count }))
      .sort((a, b) => b.count - a.count),
    byTier: Array.from(byTierMap.entries())
      .map(([tier, count]) => ({ tier, count }))
      .sort((a, b) => a.tier.localeCompare(b.tier)),
    followUpsDue,
    recentProspects: getRecentProspectSummaries(prospects, followUpsDue),
  };
}

export function formatRate(value: number | null): string {
  if (value == null) return '—';
  return `${value}%`;
}
