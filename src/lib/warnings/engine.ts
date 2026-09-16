import type { Enterprise, Farm, FarmWeather } from '@/domain/types';
import type { AlertAuthority, AlertLevel, FarmerAlert, FarmExposure, HazardType } from '@/domain/warnings';

const RULE_VERSION = 'mkulima-ews-v1';

type BuildInput = {
  farm?: Farm;
  enterprises: Enterprise[];
  weather?: FarmWeather;
  exposure?: FarmExposure;
  language?: 'en' | 'sw';
  now?: Date;
};

/**
 * Derive farm-relevant preparedness watches from approved thresholds.
 * Never impersonates KMD/NDMA/county official warnings.
 */
export function buildEarlyWarnings(input: BuildInput): FarmerAlert[] {
  const farm = input.farm;
  if (!farm || !input.weather) return [];
  const now = input.now ?? new Date();
  const weather = input.weather;
  const exposure = input.exposure ?? {};
  const language = input.language ?? 'en';
  const alerts: FarmerAlert[] = [];

  const seasonal = seasonalPreparedness(farm, now, language);
  if (seasonal) alerts.push(seasonal);

  if (weather.rainProbabilityPct >= 75 || weather.rainMm >= 12 || (weather.features?.rain24hMm ?? 0) >= 20) {
    const vulnerable = Boolean(exposure.nearWaterway || exposure.poorDrainage || exposure.steepSlope);
    const rainMm = weather.features?.rain24hMm ?? weather.rainMm;
    const rainProb = weather.features?.rainProb24hPct ?? weather.rainProbabilityPct;
    alerts.push(makeAlert({
      farm,
      level: vulnerable ? 'watch' : 'outlook',
      hazardType: 'heavy_rain',
      title: language === 'sw' ? 'Mvua kubwa inawezekana' : 'Heavy rain possible at your farm',
      message: language === 'sw'
        ? `Utabiri wa mahali pa shamba: nafasi ya mvua ${rainProb}% (${rainMm} mm / 24h). Hii ni tahadhari ya kujitayarisha ya Mkulima, si onyo rasmi la KMD.`
        : `Farm-place forecast: ${rainProb}% chance of rain (~${rainMm} mm / 24h). This is a Mkulima preparedness watch, not an official KMD warning.`,
      actions: rainActions(language, vulnerable),
      language,
      now,
      hoursValid: 36
    }));
  }

  const heatMax = weather.features?.tempMax24hC ?? weather.temperatureHighC;
  if (heatMax >= 32) {
    const dairy = input.enterprises.some((item) => item.sector === 'Dairy' || item.sector === 'Poultry');
    alerts.push(makeAlert({
      farm,
      level: 'watch',
      hazardType: 'heat',
      title: language === 'sw' ? 'Joto kali linalotarajiwa' : 'Hot afternoon expected',
      message: language === 'sw'
        ? `Joto hadi ${heatMax}°C kwenye shamba. Weka maji kwa mifugo na watu. Tahadhari ya Mkulima — si onyo rasmi.`
        : `Highs near ${heatMax}°C at the farm. Keep water for people and animals. Mkulima preparedness watch — not an official warning.`,
      actions: heatActions(language, dairy),
      language,
      now,
      hoursValid: 24
    }));
  }

  const dryStreak = weather.rainProbabilityPct <= 15 && weather.rainMm <= 1 && weather.temperatureHighC >= 28;
  if (dryStreak) {
    alerts.push(makeAlert({
      farm,
      level: 'outlook',
      hazardType: 'drought',
      title: language === 'sw' ? 'Kipindi kikavu — angalia maji' : 'Dry spell — check water',
      message: language === 'sw'
        ? 'Utabiri unaonyesha siku kavu. Angalia maji ya mifugo, umwagiliaji na uhifadhi. Si awamu rasmi ya NDMA.'
        : 'The forecast looks dry. Check livestock water, irrigation and storage. This is not an official NDMA drought phase.',
      actions: droughtActions(language),
      language,
      now,
      hoursValid: 72
    }));
  }

  return dedupe(alerts).filter((item) => new Date(item.validUntil).getTime() > now.getTime());
}

/** Merge local acknowledgements onto derived alerts. */
export function applyWarningAcks(
  alerts: FarmerAlert[],
  acks: Record<string, { acknowledgedAt: string; selectedActionId?: string | null }>
): FarmerAlert[] {
  return alerts.map((alert) => {
    const ack = acks[alert.id];
    if (!ack?.acknowledgedAt) return alert;
    return {
      ...alert,
      status: 'acknowledged',
      acknowledgedAt: ack.acknowledgedAt,
      selectedActionId: ack.selectedActionId ?? null
    };
  });
}

/** Prefer watch/warning, then outlook; hide acknowledged from Home urgent slot. */
export function rankActiveWarnings(alerts: FarmerAlert[]): FarmerAlert[] {
  const weight = (level: AlertLevel) => {
    if (level === 'observed_impact' || level === 'warning') return 0;
    if (level === 'watch') return 1;
    return 2;
  };
  return [...alerts]
    .filter((item) => item.status === 'active')
    .sort((a, b) => weight(a.level) - weight(b.level) || a.title.localeCompare(b.title));
}

function seasonalPreparedness(farm: Farm, now: Date, language: 'en' | 'sw'): FarmerAlert | null {
  const month = now.getMonth() + 1;
  // Doc snapshot: Sep dry/warm → OND wetter risk. Labelled as preparedness, not certainty.
  if (month >= 9 && month <= 11) {
    return makeAlert({
      farm,
      level: 'outlook',
      hazardType: 'seasonal_shift',
      title: language === 'sw' ? 'Msimu: kuandaa kwa mvua za OND' : 'Season: prepare for OND rains',
      message: language === 'sw'
        ? 'Mipango ya kitaifa inaonyesha mabadiliko kutoka hali kavu ya Septemba kuelekea mvua zaidi Oktoba–Novemba katika sehemu nyingi. Angalia mifereji, uhifadhi na njia. Hii ni mawazo ya kujitayarisha — si uhakika wa shamba.'
        : 'National planning points to a shift from drier September conditions toward wetter October–November in many areas. Check drainage, storage and access routes. Preparedness signal — not a farm-level certainty.',
      actions: [
        { id: 'drainage', label: language === 'sw' ? 'Angalia mifereji' : 'Check drainage', detail: language === 'sw' ? 'Futa mifereji kabla ya mvua kubwa.' : 'Clear drains before heavy rain.' },
        { id: 'storage', label: language === 'sw' ? 'Linda uhifadhi' : 'Protect storage', detail: language === 'sw' ? 'Hakikisha paa na sakafu ni kavu.' : 'Make sure roof and floor stay dry.' },
        { id: 'route', label: language === 'sw' ? 'Panga njia mbadala' : 'Plan alternate route', detail: language === 'sw' ? 'Ikiwa barabara inafurika.' : 'If the usual road floods.' }
      ],
      language,
      now,
      hoursValid: 24 * 14,
      source: 'MKULIMA_PREPAREDNESS'
    });
  }
  return null;
}

function rainActions(language: 'en' | 'sw', vulnerable: boolean) {
  const base = [
    { id: 'safe', label: language === 'sw' ? 'Usalama kwanza' : 'People first', detail: language === 'sw' ? 'Epuka mito na barabara zilizofurika.' : 'Avoid rivers, culverts and flooded roads.' },
    { id: 'animals', label: language === 'sw' ? 'Hamisha mifugo ikiwa salama' : 'Move animals only if safe', detail: language === 'sw' ? 'Usihatarishe maisha.' : 'Do not risk lives for livestock.' },
    { id: 'harvest', label: language === 'sw' ? 'Linda mavuno/uhifadhi' : 'Protect harvest or store', detail: language === 'sw' ? 'Funika magunia na punguza maji.' : 'Cover bags and reduce water ingress.' }
  ];
  if (vulnerable) {
    base.unshift({
      id: 'exposure',
      label: language === 'sw' ? 'Shamba lina mfiduo' : 'This farm looks exposed',
      detail: language === 'sw' ? 'Maji, mteremko au mifereji duni inaongeza hatari.' : 'Waterway, slope or poor drainage can raise risk.'
    });
  }
  return base;
}

function heatActions(language: 'en' | 'sw', dairy: boolean) {
  const actions = [
    { id: 'water', label: language === 'sw' ? 'Weka maji' : 'Keep water available', detail: language === 'sw' ? 'Kwa watu na mifugo.' : 'For people and animals.' },
    { id: 'shade', label: language === 'sw' ? 'Tafuta kivuli' : 'Provide shade', detail: language === 'sw' ? 'Punguza kazi mchana.' : 'Reduce midday heavy work.' }
  ];
  if (dairy) {
    actions.push({
      id: 'milk',
      label: language === 'sw' ? 'Angalia maziwa' : 'Watch milk drop',
      detail: language === 'sw' ? 'Joto linaweza kupunguza uzalishaji.' : 'Heat can reduce yield — record what you see.'
    });
  }
  return actions;
}

function droughtActions(language: 'en' | 'sw') {
  return [
    { id: 'budget', label: language === 'sw' ? 'Panga maji' : 'Budget water', detail: language === 'sw' ? 'Tanguliza kunywa na mifugo.' : 'Prioritise drinking and livestock.' },
    { id: 'feed', label: language === 'sw' ? 'Angalia malisho' : 'Check feed and pasture', detail: language === 'sw' ? 'Hifadhi malisho ikiwa yanapungua.' : 'Store fodder if pasture is thinning.' }
  ];
}

function makeAlert(input: {
  farm: Farm;
  level: AlertLevel;
  hazardType: HazardType;
  title: string;
  message: string;
  actions: FarmerAlert['actions'];
  language: 'en' | 'sw';
  now: Date;
  hoursValid: number;
  source?: AlertAuthority;
}): FarmerAlert {
  const issuedAt = input.now.toISOString();
  const validUntil = new Date(input.now.getTime() + input.hoursValid * 3600_000).toISOString();
  const source = input.source ?? 'MKULIMA_PREPAREDNESS';
  return {
    id: `${input.farm.id}:${input.hazardType}:${input.level}:${RULE_VERSION}`,
    farmId: input.farm.id,
    farmName: input.farm.name,
    level: input.level,
    hazardType: input.hazardType,
    title: input.title,
    plainLanguageMessage: input.message,
    actions: input.actions,
    source,
    sourceLabel: sourceLabel(source, input.language),
    officialWarning: false,
    alertOrigin: 'model_derived_watch',
    issuedAt,
    validUntil,
    status: 'active',
    language: input.language
  };
}

export function sourceLabel(source: AlertAuthority, language: 'en' | 'sw' = 'en') {
  if (source === 'KMD') return language === 'sw' ? 'Onyo rasmi · Kenya Meteorological Service Authority' : 'Official · Kenya Meteorological Service Authority';
  if (source === 'NDMA') return language === 'sw' ? 'Onyo rasmi · NDMA' : 'Official · NDMA';
  if (source === 'ICPAC') return language === 'sw' ? 'Muktadha wa kikanda · ICPAC' : 'Regional context · ICPAC';
  if (source === 'COUNTY') return language === 'sw' ? 'Onyo la kaunti' : 'County warning';
  return language === 'sw'
    ? 'Tahadhari ya kujitayarisha ya Mkulima — si onyo rasmi'
    : 'Mkulima preparedness watch — not an official warning';
}

export function levelLabel(level: AlertLevel, language: 'en' | 'sw' = 'en') {
  if (language === 'sw') {
    if (level === 'outlook') return 'Mtazamo';
    if (level === 'watch') return 'Tahadhari';
    if (level === 'warning') return 'Onyo';
    return 'Athari iliyoripotiwa';
  }
  if (level === 'outlook') return 'Outlook';
  if (level === 'watch') return 'Watch';
  if (level === 'warning') return 'Warning';
  return 'Observed impact';
}

function dedupe(alerts: FarmerAlert[]) {
  const seen = new Set<string>();
  return alerts.filter((item) => {
    const key = `${item.farmId}:${item.hazardType}:${item.level}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export { RULE_VERSION };
