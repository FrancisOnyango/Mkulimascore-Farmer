import type { ClimateSignal, Farm, FarmWeather } from '@/domain/types';
import { fieldConditionLine } from '@/lib/eo/farmerCopy';

export type HealthLevel = 'normal' | 'watch' | 'attention';

export type FarmHealth = {
  level: HealthLevel;
  label: 'Normal' | 'Watch' | 'Needs attention';
  line: string;
};

/**
 * Translate weather + field look + seasonal signals into farmer language.
 * Never expose NDVI or other satellite indices here.
 */
export function farmHealth(farm?: Farm, weather?: FarmWeather, climate: ClimateSignal[] = []): FarmHealth {
  const farmClimate = farm ? climate.filter((item) => item.farmId === farm.id) : climate;
  const climateHit = farmClimate.find((item) => item.tone === 'attention') ?? climate.find((item) => item.tone === 'attention');
  const heavyRain = Boolean(weather && (weather.rainProbabilityPct >= 70 || weather.rainMm >= 15));
  const likelyRain = Boolean(weather && weather.rainProbabilityPct >= 45);
  const heat = Boolean(weather && weather.temperatureHighC >= 32);
  const windy = Boolean(weather && /strong|gale|windy/i.test(`${weather.windLabel} ${weather.condition}`));

  if (heavyRain || climateHit) {
    return {
      level: 'attention',
      label: 'Needs attention',
      line: climateHit
        ? climateHit.interpretation
        : weather
          ? `${weather.condition}. Rain is likely around this farm.`
          : 'This farm needs a closer look today.'
    };
  }

  if (likelyRain || heat || windy || farm?.fieldLook === 'mixed' || farm?.fieldLook === 'bare') {
    return {
      level: 'watch',
      label: 'Watch',
      line: weather
        ? weather.rainProbabilityPct >= 45
          ? `Rain may come later around this farm.`
          : heat
            ? `A hot day around this farm (${weather.temperatureHighC}°C).`
            : weather.condition
        : fieldConditionLine(farm, climate) ?? 'Keep an eye on this plot today.'
    };
  }

  return {
    level: 'normal',
    label: 'Normal',
    line: weather
      ? `No major weather risk today. ${weather.condition}.`
      : fieldConditionLine(farm, climate) ?? 'No major weather risk on file for this farm.'
  };
}

export type FarmComparison = {
  strongerName: string;
  weakerName: string;
  line: string;
};

/** Farmer-language plot comparison. Uses field look and seasonal tone, not raw indices. */
export function compareFarms(farms: Farm[], climate: ClimateSignal[] = []): FarmComparison | null {
  if (farms.length < 2) return null;
  const ranked = farms
    .map((farm) => ({
      farm,
      score: lookScore(farm) + climateScore(farm, climate)
    }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const rest = ranked[ranked.length - 1];
  if (!best || !rest || best.farm.id === rest.farm.id) return null;
  if (best.score === rest.score) {
    return {
      strongerName: best.farm.name,
      weakerName: rest.farm.name,
      line: `${best.farm.name} and ${rest.farm.name} currently look similar.`
    };
  }
  return {
    strongerName: best.farm.name,
    weakerName: rest.farm.name,
    line: `${best.farm.name} currently looks stronger than ${rest.farm.name}.`
  };
}

function lookScore(farm: Farm) {
  if (farm.fieldLook === 'planted') return 3;
  if (farm.fieldLook === 'mixed') return 2;
  if (farm.fieldLook === 'bare') return 1;
  return farm.mapped ? 1 : 0;
}

function climateScore(farm: Farm, climate: ClimateSignal[]) {
  const hit = climate.find((item) => item.farmId === farm.id);
  if (!hit) return 0;
  if (hit.tone === 'positive') return 2;
  if (hit.tone === 'attention') return -2;
  return 0;
}
