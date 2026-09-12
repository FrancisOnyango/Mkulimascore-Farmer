import type {
  ActivityItem,
  ClimateSignal,
  ConsentGrant,
  Enterprise,
  EvidenceRecord,
  Farm,
  FarmWeather,
  FarmerMarketNote,
  MarketSignal,
  Passport
} from '@/domain/types';
import type { FarmerAction } from '@/lib/intelligence/actions';
import { buildFarmTwin, type FarmTwin } from '@/lib/intelligence/twin';

export type TodayLine = {
  id: string;
  text: string;
  kind: 'weather' | 'health' | 'market' | 'cycle' | 'profile' | 'calm';
};

export type TodayBrief = {
  hello: string;
  firstName: string;
  placeLine: string;
  twin: FarmTwin;
  lines: TodayLine[];
  nextAction: FarmerAction | null;
  recent: { id: string; title: string }[];
};

/**
 * Relevance engine for Home. Same app, different Today.
 * Dairy, maize and mixed farms get different lines from the same twin.
 */
export function buildTodayBrief({
  passport,
  farm,
  farms,
  enterprises,
  records,
  consents,
  weather,
  climate,
  markets,
  farmerNotes,
  activity
}: {
  passport: Passport;
  farm?: Farm;
  farms: Farm[];
  enterprises: Enterprise[];
  records: EvidenceRecord[];
  consents: ConsentGrant[];
  weather?: FarmWeather;
  climate: ClimateSignal[];
  markets: MarketSignal[];
  farmerNotes?: FarmerMarketNote[];
  activity: ActivityItem[];
}): TodayBrief {
  const twin = buildFarmTwin({
    passport,
    farm,
    farms,
    enterprises,
    records,
    consents,
    weather,
    climate,
    markets,
    farmerNotes,
    activity
  });

  return {
    hello: greeting(),
    firstName: firstName(passport.displayName) || 'farmer',
    placeLine: [farm?.location || passport.location, enterprises.slice(0, 2).map((item) => item.sector).join(' & ')].filter(Boolean).join(' · '),
    twin,
    lines: rankTodayLines(twin),
    nextAction: shouldSurfaceAction(twin) ? twin.nextAction : null,
    recent: activity.slice(0, 2).map((item) => ({ id: item.id, title: item.title }))
  };
}

function rankTodayLines(twin: FarmTwin): TodayLine[] {
  const daily = twin.cycle.rhythm === 'daily';
  const candidates: Array<TodayLine & { score: number }> = [];

  if (twin.cycle.recordToday) {
    candidates.push({
      id: 'cycle',
      kind: 'cycle',
      text: twin.cycle.line,
      score: daily ? 100 : 78
    });
  } else if (twin.cycle.rhythm === 'seasonal' && twin.cycle.stage !== 'unknown') {
    candidates.push({
      id: 'cycle',
      kind: 'cycle',
      text: twin.cycle.line,
      score: 48
    });
  }

  if (twin.weatherLine && twin.health.level !== 'normal') {
    candidates.push({
      id: 'weather',
      kind: 'weather',
      text: twin.weatherLine,
      score: twin.health.level === 'attention' ? 94 : 72
    });
  } else if (twin.weatherLine && !daily) {
    candidates.push({
      id: 'weather',
      kind: 'weather',
      text: twin.weatherLine,
      score: 58
    });
  } else if (twin.health.level === 'normal' && daily) {
    candidates.push({
      id: 'calm-weather',
      kind: 'calm',
      text: 'No major weather risk today',
      score: 42
    });
  }

  if (twin.fieldLine && !daily) {
    candidates.push({
      id: 'field',
      kind: 'health',
      text: twin.fieldLine,
      score: twin.health.level === 'attention' ? 80 : 64
    });
  } else if (twin.health.level !== 'normal' && !twin.weatherLine) {
    candidates.push({
      id: 'health',
      kind: 'health',
      text: twin.health.line,
      score: 70
    });
  }

  if (twin.market?.priceLabel && (twin.market.freshnessState === 'fresh' || twin.market.freshnessState === 'aging')) {
    candidates.push({
      id: 'market',
      kind: 'market',
      text: `${twin.market.name} reported ${twin.market.priceLabel}. ${twin.market.freshnessLabel}.`,
      score: daily ? 36 : twin.market.freshnessState === 'fresh' ? 76 : 54
    });
  }

  if (twin.verifiedWell) {
    candidates.push({
      id: 'verified',
      kind: 'calm',
      text: 'Your farm profile is well verified',
      score: daily && !twin.cycle.recordToday ? 50 : 28
    });
  } else if (twin.strengthenLine) {
    candidates.push({
      id: 'strengthen',
      kind: 'profile',
      text: twin.strengthenLine,
      score: twin.nextAction && twin.nextAction.priority >= 88 ? 88 : 60
    });
  }

  const picked: TodayLine[] = [];
  const used = new Set<string>();
  for (const item of candidates.sort((a, b) => b.score - a.score)) {
    if (used.has(item.kind) || item.score < 30) continue;
    picked.push({ id: item.id, text: item.text, kind: item.kind });
    used.add(item.kind);
    if (picked.length === 4) break;
  }
  if (!picked.length) {
    picked.push({
      id: 'start',
      kind: 'profile',
      text: twin.farm ? 'Mark what is happening on this farm today.' : 'Add your farm so today can match the land.'
    });
  }
  return picked;
}

function shouldSurfaceAction(twin: FarmTwin) {
  if (!twin.nextAction) return false;
  if (twin.cycle.recordToday && twin.nextAction.id === 'today-record') return true;
  return twin.nextAction.priority >= 88;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstName(name: string) {
  return name.split(' ')[0] || name;
}
