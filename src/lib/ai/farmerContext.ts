import type { FarmerContextPacket, ProvenanceFact } from '@/domain/ask';
import { classifyAskRisk, provenancePrefix } from '@/lib/ai/askPolicy';
import type { AskMkulimaContext } from '@/domain/types';
import { locationEvidence } from '@/lib/geo/locationLevel';
import { inferFarmCycle } from '@/lib/intelligence/cycle';
import { fieldConditionLine } from '@/lib/eo/farmerCopy';

export function buildFarmerContextPacket(question: string, context: AskMkulimaContext): FarmerContextPacket {
  const farm = context.farms[0];
  const enterprise = context.enterprises.find((item) => item.primary) ?? context.enterprises[0];
  const weather = context.weather[0];
  const risk = classifyAskRisk(question);
  const toolsUsed: string[] = ['get_farmer_context'];
  const facts: ProvenanceFact[] = [];

  if (farm) {
    toolsUsed.push('get_farm');
    const place = locationEvidence(farm);
    facts.push(fact(
      'farm.place',
      farm.location,
      'FARMER_APP',
      farm.verification === 'verified' ? 'FIELD_VERIFIED' : 'SELF_REPORTED',
      `${provenancePrefix(farm.verification === 'verified' ? 'FIELD_VERIFIED' : 'SELF_REPORTED')}, this farm is ${farm.name} in ${farm.location}. ${place.detail}`
    ));
    facts.push(fact(
      'farm.area',
      `${farm.measuredArea ?? farm.reportedArea} ${farm.areaUnit}`,
      'FARMER_APP',
      farm.mapped && farm.measuredArea != null ? 'SELF_REPORTED' : 'SELF_REPORTED',
      farm.measuredArea != null
        ? `${provenancePrefix('SELF_REPORTED')}, measured area is ${farm.measuredArea} ${farm.areaUnit}. Reported area stays separate.`
        : `${provenancePrefix('SELF_REPORTED')}, reported area is ${farm.reportedArea} ${farm.areaUnit}. Not yet measured.`
    ));
  }

  if (enterprise) {
    toolsUsed.push('get_enterprise');
    facts.push(fact(
      `enterprise.${enterprise.sector.toLowerCase()}`,
      `${enterprise.productionValue} ${enterprise.productionMetric}`,
      'FARMER_APP',
      'SELF_REPORTED',
      `${provenancePrefix('SELF_REPORTED')}, ${enterprise.name} is recorded at ${enterprise.productionValue} ${enterprise.productionMetric}.`
    ));
  }

  if (needsWeather(question) && weather) {
    toolsUsed.push('get_weather');
    facts.push(fact(
      'weather.forecast',
      `${weather.condition} ${weather.rainProbabilityPct}%`,
      'OPEN_METEO',
      'FORECAST',
      `${provenancePrefix('FORECAST')}: ${weather.condition.toLowerCase()}, ${weather.rainProbabilityPct}% chance of rain. ${weather.fieldActivityNote}`
    ));
  }

  if (needsMarkets(question) && context.markets.length) {
    toolsUsed.push('get_market_prices');
    context.markets.slice(0, 8).forEach((item) => {
      facts.push(fact(
        `market.${item.commodity}`,
        item.observedPrice,
        'KAMIS',
        'OFFICIAL_REPORTED',
        `${item.commodity} ${item.observedPrice} at ${item.marketScope}`
      ));
    });
  }

  if (needsPlaces(question) && context.places?.length) {
    toolsUsed.push('get_nearby_places');
    context.places.slice(0, 5).forEach((item) => {
      facts.push(fact(
        `place.${item.category}`,
        `${item.name} ${item.distanceLabel}`,
        'MKULIMA_PLACES',
        item.verification === 'FIELD_VERIFIED' ? 'FIELD_VERIFIED' : 'SELF_REPORTED',
        `${item.name}, ${item.distanceLabel} — ${item.verificationLabel}`
      ));
    });
  }

  if (needsProduction(question) && context.activity?.length) {
    toolsUsed.push('get_production_history');
  }

  if (needsKnowledge(question)) {
    toolsUsed.push('search_agri_knowledge');
  }

  const cycle = inferFarmCycle(context.enterprises, context.activity ?? []);
  const field = fieldConditionLine(farm, context.climate);
  const profileAction = context.insights.find((item) => item.tone === 'attention')?.action
    ?? (!farm?.latitude ? 'Mark the farm place' : !farm.mapped ? 'Walk or draw the farm edge' : undefined);

  return {
    farmer: {
      msid: context.passport?.msid,
      name: (context.passport?.displayName ?? '').trim().split(/\s+/)[0],
      language: context.language
    },
    location: { place: farm?.location || context.passport?.location || 'your farm place' },
    farms: context.farms.slice(0, 2).map((item) => ({
      farmId: item.id,
      name: item.name,
      areaLine: `${item.measuredArea ?? item.reportedArea} ${item.areaUnit}`,
      mapped: item.mapped,
      verification: item.verification
    })),
    enterprises: context.enterprises.slice(0, 4).map((item) => ({
      enterpriseId: item.id,
      sector: item.sector,
      name: item.name,
      productionLine: `${item.productionValue} ${item.productionMetric}`,
      verification: 'SELF_REPORTED'
    })),
    toolsUsed: [...new Set(toolsUsed)],
    facts,
    weatherLine: weather ? `${weather.condition}, ${weather.rainProbabilityPct}% rain` : undefined,
    marketLines: context.markets.slice(0, 8).map((item) => `${item.commodity} ${item.observedPrice} at ${item.marketScope}`),
    placeLines: (context.places ?? []).slice(0, 5).map((item) => `${item.name} ${item.distanceLabel}`),
    profileAction,
    risk,
    layers: layersFor(question, {
      records: enterprise
        ? `${enterprise.name} is recorded at ${enterprise.productionValue} ${enterprise.productionMetric}. ${cycle.line}`
        : farm ? `${farm.name} is on this phone.` : 'The farm book is still filling.',
      conditions: weather
        ? `${weather.condition} at the farm place, ${weather.rainProbabilityPct}% chance of rain.`
        : field ?? 'I do not have a live field condition yet.',
      suggestion: profileAction
        ? `A useful next step is to ${profileAction.toLowerCase()}. I will not invent a missing fact.`
        : 'Ask about weather, a nearby price, or what you recorded.'
    })
  };
}

function layersFor(question: string, layers: NonNullable<FarmerContextPacket['layers']>) {
  if (/(plant|looking|sell|why|should i)/i.test(question)) return layers;
  return undefined;
}

function needsWeather(question: string) {
  return /weather|rain|mvua|plant|forecast|joto/.test(question);
}

function needsMarkets(question: string) {
  return /price|market|sell|bei|soko|tomato|maize|beans|onion/.test(question);
}

function needsPlaces(question: string) {
  return /where|nearby|agrovet|vet|market|sell|buy|collection/.test(question);
}

function needsProduction(question: string) {
  return /milk|maziwa|harvest|production|mavuno|spent|cost|herd|cows/.test(question);
}

function needsKnowledge(question: string) {
  return /armyworm|blight|wilt|pest|disease|pcpb|cabi|kalro|scout|extension/.test(question);
}

function fact(
  attribute: string,
  value: string,
  source: ProvenanceFact['source'],
  verification: ProvenanceFact['verification'],
  farmerLine: string
): ProvenanceFact {
  return {
    attribute,
    value,
    source,
    verification,
    confidence: verification === 'FIELD_VERIFIED' || verification === 'OFFICIAL_REPORTED' ? 'VERIFIED' : 'PROVISIONAL',
    farmerLine
  };
}
