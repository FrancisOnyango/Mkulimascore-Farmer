import type { ActivityItem, Enterprise, FarmSector } from '@/domain/types';
import { actionTitle } from '@/lib/enterprises/nextAction';
import { isDailySector } from '@/lib/onboarding/valueChains';

export type CycleStage =
  | 'preparing'
  | 'planting'
  | 'growing'
  | 'harvesting'
  | 'selling'
  | 'daily'
  | 'herd'
  | 'unknown';

export type FarmCycle = {
  stage: CycleStage;
  rhythm: 'daily' | 'seasonal';
  label: string;
  line: string;
  diaryHint: string;
  recordToday: boolean;
};

/**
 * Infer the farm's current rhythm from enterprise + recent diary entries.
 * Kenya season windows are context only — not planting advice.
 */
export function inferFarmCycle(enterprises: Enterprise[], activity: ActivityItem[], now = new Date()): FarmCycle {
  const primary = enterprises.find((item) => item.primary) ?? enterprises[0];
  const sector = primary?.sector;
  if (!sector) {
    return {
      stage: 'unknown',
      rhythm: 'seasonal',
      label: 'Not set yet',
      line: 'Add what you grow or keep so today can match the farm.',
      diaryHint: 'Milk, harvest, sale or a cost',
      recordToday: false
    };
  }

  if (isDailySector(sector)) {
    const recordedToday = hasActivityToday(activity, dailyTypes(sector), now);
    const stale = daysSince(activity, dailyTypes(sector), now) > 1;
    return {
      stage: sector === 'Dairy' ? 'daily' : 'herd',
      rhythm: 'daily',
      label: sector === 'Dairy' ? 'Daily milk' : actionTitle(sector),
      line: recordedToday
        ? sector === 'Dairy'
          ? "Today's milk is already saved."
          : `Today's ${sector.toLowerCase()} update is saved.`
        : stale
          ? `No ${sector === 'Dairy' ? 'milk' : sector.toLowerCase()} update since yesterday.`
          : `Record today's ${sector === 'Dairy' ? 'milk' : sector.toLowerCase()}.`,
      diaryHint: sector === 'Dairy' ? 'Milk, sale, feed or a vet visit' : `${actionTitle(sector)}, sale or a cost`,
      recordToday: !recordedToday
    };
  }

  const month = now.getMonth();
  const harvestRecent = recentMatch(activity, ['harvest', 'mavuno'], 21, now);
  const saleRecent = recentMatch(activity, ['sale', 'sold', 'delivery'], 21, now);
  const plantRecent = recentMatch(activity, ['plant', 'seed', 'sow'], 28, now);
  const stage = harvestRecent
    ? saleRecent ? 'selling' : 'harvesting'
    : plantRecent
      ? month >= 4 && month <= 7 ? 'growing' : 'planting'
      : maizeWindow(month);

  return {
    stage,
    rhythm: 'seasonal',
    label: cropStageLabel(stage, sector),
    line: cropStageLine(stage, sector),
    diaryHint: cropDiaryHint(stage),
    recordToday: stage === 'harvesting' || stage === 'selling' ? !saleRecent && !harvestRecent : false
  };
}

export { isDailySector };

function dailyTypes(sector: FarmSector) {
  if (sector === 'Dairy') return ['production', 'milk'];
  if (sector === 'Poultry') return ['production', 'flock', 'egg'];
  if (sector === 'Livestock') return ['production', 'herd'];
  return ['production', 'harvest'];
}

function maizeWindow(month: number): CycleStage {
  if (month >= 2 && month <= 3) return 'planting';
  if (month >= 4 && month <= 6) return 'growing';
  if (month >= 7 && month <= 8) return 'harvesting';
  if (month === 9) return 'selling';
  if (month >= 10 && month <= 11) return 'planting';
  return 'preparing';
}

function cropStageLabel(stage: CycleStage, sector: FarmSector) {
  const crop = sector.toLowerCase();
  if (stage === 'preparing') return `Preparing ${crop}`;
  if (stage === 'planting') return `Planting ${crop}`;
  if (stage === 'growing') return `${sector} growing`;
  if (stage === 'harvesting') return `Harvesting ${crop}`;
  if (stage === 'selling') return `Selling ${crop}`;
  return sector;
}

function cropStageLine(stage: CycleStage, sector: FarmSector) {
  const crop = sector.toLowerCase();
  if (stage === 'preparing') return `This looks like land preparation for ${crop}.`;
  if (stage === 'planting') return `${sector} is in the planting stretch.`;
  if (stage === 'growing') return `Your ${crop} plot is in the growing stretch.`;
  if (stage === 'harvesting') return `${sector} harvest notes help this season's record.`;
  if (stage === 'selling') return `A recent ${crop} sale keeps the season record honest.`;
  return `${sector} is on this farm.`;
}

function cropDiaryHint(stage: CycleStage) {
  if (stage === 'planting') return 'Planting, seed or a field photo';
  if (stage === 'growing') return 'Field look, input or a crop problem';
  if (stage === 'harvesting') return 'Harvest, bags or a buyer';
  if (stage === 'selling') return 'Sale, buyer or a price you were paid';
  return 'Harvest, sale, input or a photo';
}

function hasActivityToday(activity: ActivityItem[], needles: string[], now: Date) {
  const today = dayKey(now);
  return activity.some((item) => dayKey(new Date(item.occurredAt)) === today && matches(item, needles));
}

function daysSince(activity: ActivityItem[], needles: string[], now: Date) {
  const hit = activity.find((item) => matches(item, needles));
  if (!hit) return 99;
  const at = new Date(hit.occurredAt).getTime();
  if (!Number.isFinite(at)) return 99;
  return Math.floor((now.getTime() - at) / 86_400_000);
}

function recentMatch(activity: ActivityItem[], needles: string[], withinDays: number, now: Date) {
  return activity.some((item) => {
    const at = new Date(item.occurredAt).getTime();
    return Number.isFinite(at) && now.getTime() - at <= withinDays * 86_400_000 && matches(item, needles);
  });
}

function matches(item: ActivityItem, needles: string[]) {
  const hay = `${item.type} ${item.title} ${item.detail}`.toLowerCase();
  return needles.some((needle) => hay.includes(needle));
}

function dayKey(value: Date) {
  return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
}
