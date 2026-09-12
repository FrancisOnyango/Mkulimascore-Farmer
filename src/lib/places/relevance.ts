import type { AgriculturalPlace, PlaceFilter, PlaceVerification, RankedPlace } from '@/domain/places';
import { isVerifiedPlace, placeMatchesFilter, verificationLabel } from '@/domain/places';
import type { Enterprise, MarketSignal } from '@/domain/types';
import { formatKm, haversineKm, type GeoPoint } from '@/lib/geo/geo';
import { getFreshness } from '@/lib/utils/format';

export const DEFAULT_PLACE_RADIUS_KM = 25;

const VERIFICATION_SCORE: Record<PlaceVerification, number> = {
  FIELD_VERIFIED: 25,
  PARTNER_CONFIRMED: 20,
  COMMUNITY_CONFIRMED: 14,
  DISCOVERED: 6,
  STALE: 2,
  CLOSED: 0
};

export function rankPlaces({
  origin,
  places,
  enterprises,
  liveMarkets,
  filter,
  radiusKm = DEFAULT_PLACE_RADIUS_KM,
  limit = 24
}: {
  origin: GeoPoint;
  places: AgriculturalPlace[];
  enterprises: Enterprise[];
  liveMarkets?: MarketSignal[];
  filter?: PlaceFilter | null;
  radiusKm?: number;
  limit?: number;
}): RankedPlace[] {
  const sectors = enterprises.map((item) => item.sector);
  const primary = enterprises.find((item) => item.primary)?.sector ?? sectors[0];

  return places
    .filter((place) => place.verification !== 'CLOSED')
    .filter((place) => placeMatchesFilter(place, filter))
    .map((place) => scorePlace(place, origin, primary, sectors, liveMarkets, radiusKm))
    .filter((place) => place.km <= radiusKm)
    .sort((a, b) => b.relevance - a.relevance || a.km - b.km)
    .map((place, index) => ({
      ...place,
      recommended: Boolean(place.recommended && index < 6)
    }))
    .slice(0, limit);
}

function scorePlace(
  place: AgriculturalPlace,
  origin: GeoPoint,
  primary: string | undefined,
  sectors: string[],
  liveMarkets: MarketSignal[] | undefined,
  radiusKm: number
): RankedPlace {
  const km = haversineKm(origin, place);
  const chain = chainScore(place, primary, sectors);
  const verify = VERIFICATION_SCORE[place.verification];
  const distance = Math.max(0, 20 * (1 - km / Math.max(radiusKm, 1)));
  const price = attachPrice(place, liveMarkets, primary);
  const service = serviceScore(place, primary, sectors);
  const open = place.verification === 'STALE' ? 1 : 3;
  const relevance = chain.score + verify + distance + price.score + service + open;
  const matched = chain.matched;
  return {
    ...place,
    km,
    distanceLabel: formatKm(km),
    relevance: Math.round(relevance),
    recommended: matched && relevance >= 48,
    recommendedLine: matched && primary ? `Useful for your ${primary.toLowerCase()}` : undefined,
    verificationLabel: verificationLabel(place.verification),
    priceLabel: price.label,
    freshnessLabel: price.freshness
  };
}

function chainScore(place: AgriculturalPlace, primary: string | undefined, sectors: string[]) {
  const goods = place.commodities.map((item) => item.toLowerCase());
  if (primary && goods.includes(primary.toLowerCase())) return { score: 30, matched: true };
  if (sectors.some((sector) => goods.includes(sector.toLowerCase()))) return { score: 22, matched: true };
  if (place.category === 'inputs' && sectors.length) return { score: 16, matched: true };
  if ((place.category === 'services' || place.category === 'support') && sectors.some(isLivestock)) {
    return { score: 18, matched: true };
  }
  if (place.category === 'cooperatives' || place.category === 'collection') {
    return { score: sectors.length ? 12 : 8, matched: Boolean(sectors.length) };
  }
  return { score: 6, matched: false };
}

function serviceScore(place: AgriculturalPlace, primary: string | undefined, sectors: string[]) {
  const blob = `${place.services.join(' ')} ${place.commodities.join(' ')}`.toLowerCase();
  if (primary && blob.includes(primary.toLowerCase())) return 10;
  if (place.category === 'inputs' && sectors.some((sector) => /maize|beans|potato|tomato|wheat/i.test(sector))) {
    if (/seed|fertil|pesticide|input/.test(blob)) return 10;
  }
  if (sectors.some(isLivestock) && /vet|feed|ai |milk|dairy/.test(blob)) return 10;
  return 3;
}

function attachPrice(place: AgriculturalPlace, liveMarkets: MarketSignal[] | undefined, primary?: string) {
  if (place.category !== 'markets' && place.category !== 'collection') {
    return { score: 4, label: undefined as string | undefined, freshness: undefined as string | undefined };
  }
  const hay = `${place.name} ${place.town ?? ''}`.toLowerCase();
  const match = (liveMarkets ?? []).find((item) => {
    const scope = `${item.marketScope} ${item.commodity}`.toLowerCase();
    return scope.includes(hay) || hay.includes(item.marketScope.toLowerCase()) || (primary && item.commodity === primary && scope.includes((place.town ?? '').toLowerCase()));
  }) ?? (primary
    ? (liveMarkets ?? []).find((item) => item.commodity === primary)
    : liveMarkets?.[0]);
  if (!match?.observedPrice) return { score: 4, label: undefined, freshness: undefined };
  const freshness = getFreshness(match.updatedAt);
  const score = freshness?.state === 'fresh' ? 10 : freshness?.state === 'aging' ? 7 : 4;
  return {
    score,
    label: `${match.commodity} · ${match.observedPrice}`,
    freshness: freshness?.state === 'fresh' ? 'Updated recently' : 'Latest reported'
  };
}

function isLivestock(sector: string) {
  return /dairy|beef|goat|sheep|poultry|pig|camel|livestock|fish|bee/i.test(sector);
}

export function placeHeadline(place: RankedPlace) {
  const bits = [
    place.distanceLabel,
    isVerifiedPlace(place.verification) ? 'Verified location' : null,
    place.priceLabel,
    place.services.slice(0, 3).join(' · ') || place.commodities.slice(0, 3).join(' · ')
  ].filter(Boolean);
  return bits.join(' · ');
}
