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
import { verificationLabel } from '@/lib/copy/status';
import { fieldConditionLine } from '@/lib/eo/farmerCopy';
import { locationEvidence, type LocationLevel } from '@/lib/geo/locationLevel';
import { farmerActions, type FarmerAction } from '@/lib/intelligence/actions';
import { inferFarmCycle, type FarmCycle } from '@/lib/intelligence/cycle';
import { compareFarms, farmHealth, type FarmComparison, type FarmHealth } from '@/lib/intelligence/health';
import { incomeSnapshot, type IncomeSnapshot } from '@/lib/intelligence/income';
import { marketOpportunities, type MarketOpportunity } from '@/lib/markets/opportunity';

export type FarmTwin = {
  farm?: Farm;
  farms: Farm[];
  enterprises: Enterprise[];
  primary?: Enterprise;
  placeLevel: LocationLevel;
  cycle: FarmCycle;
  health: FarmHealth;
  weather?: FarmWeather;
  weatherLine: string | null;
  fieldLine: string | null;
  market: MarketOpportunity | null;
  nextAction: FarmerAction | null;
  strengthenLine: string | null;
  verifiedWell: boolean;
  income: IncomeSnapshot;
  comparison: FarmComparison | null;
  provenance: { place: string; farm: string };
};

/** Living farm profile. Home shows a few lines; this holds the rest. */
export function buildFarmTwin({
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
  passport: Passport | null;
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
}): FarmTwin {
  const place = locationEvidence(farm);
  const cycle = inferFarmCycle(enterprises, activity);
  const health = farmHealth(farm, weather, climate);
  const actions = farmerActions({
    passport,
    farms: farm ? [farm, ...farms.filter((item) => item.id !== farm.id)] : farms,
    enterprises,
    records,
    consents,
    climate,
    activity
  });
  const nextAction = actions.find((item) => item.kind === 'CONTROLLABLE' || item.kind === 'EVIDENCE_IMPROVABLE') ?? null;
  const market = marketOpportunities({ farm, enterprises, liveMarkets: markets, farmerNotes, limit: 1 })[0] ?? null;
  const verifiedWell = place.level >= 2
    && Boolean(enterprises.length)
    && (consents.length > 0 || Boolean(passport?.affiliations.length))
    && farm?.verification !== 'needs_review';

  return {
    farm,
    farms,
    enterprises,
    primary: enterprises.find((item) => item.primary) ?? enterprises[0],
    placeLevel: place.level,
    cycle,
    health,
    weather,
    weatherLine: weatherLine(weather),
    fieldLine: fieldConditionLine(farm, climate),
    market,
    nextAction,
    strengthenLine: nextAction && nextAction.priority >= 70
      ? `One thing to strengthen: ${nextAction.title.toLowerCase()}`
      : verifiedWell
        ? 'Your farm profile is well verified.'
        : null,
    verifiedWell,
    income: incomeSnapshot(activity, enterprises),
    comparison: compareFarms(farms, climate),
    provenance: {
      place: place.detail,
      farm: farm ? verificationLabel(farm.verification) : 'Added by you'
    }
  };
}

function weatherLine(weather?: FarmWeather) {
  if (!weather) return null;
  if (weather.rainProbabilityPct >= 70) return `Rain likely later. ${weather.condition}.`;
  if (weather.rainProbabilityPct >= 45) return `${weather.condition}. Rain may come later around this farm.`;
  return `No major weather risk today. ${weather.condition}.`;
}
