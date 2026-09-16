import type { Enterprise, Farm, FarmWeather } from '@/domain/types';
import type { FarmerAlert } from '@/domain/warnings';
import { applyWarningAcks, buildEarlyWarnings } from '@/lib/warnings/engine';
import { FarmerAppService } from '@/application/FarmerAppService';

export async function loadFarmEarlyWarnings(input: {
  farm?: Farm;
  enterprises: Enterprise[];
  weather?: FarmWeather;
  language?: 'en' | 'sw';
}): Promise<FarmerAlert[]> {
  const raw = buildEarlyWarnings({
    farm: input.farm,
    enterprises: input.enterprises,
    weather: input.weather,
    exposure: input.farm?.exposure,
    language: input.language
  });
  const acks = await FarmerAppService.listWarningAcks();
  return applyWarningAcks(raw, acks);
}
