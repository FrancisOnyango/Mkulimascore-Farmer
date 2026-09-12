import type { ClimateSignal, Farm } from '@/domain/types';

/** Farmer-facing field condition. Never dump NDVI or band values. */
export function fieldConditionLine(farm?: Farm | null, climate: ClimateSignal[] = []) {
  const forFarm = farm ? climate.filter((item) => item.farmId === farm.id) : climate;
  const signal = forFarm[0] ?? climate[0];
  if (signal) return signal.interpretation;
  if (farm?.fieldLook === 'planted') return 'You said this land looks planted. Satellite can later check that.';
  if (farm?.fieldLook === 'mixed') return 'You said the field looks mixed. That helps later satellite checks.';
  if (farm?.fieldLook === 'bare') return 'You said the land looks open. That helps later satellite checks.';
  if (farm?.mapped) return 'A saved shape lets field condition be checked later. No satellite number is shown here.';
  return null;
}

export function advancedFieldInsights(farm?: Farm | null, climate: ClimateSignal[] = []) {
  const forFarm = farm ? climate.filter((item) => item.farmId === farm.id) : climate;
  return forFarm.map((item) => ({
    title: item.title,
    period: item.period,
    sourceLabel: item.sourceLabel,
    updatedAt: item.updatedAt,
    interpretation: item.interpretation
  }));
}
