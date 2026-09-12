import type { AgriculturalPlace, PlaceFilter, RankedPlace } from '@/domain/places';
import type { Enterprise, Farm, MarketSignal } from '@/domain/types';
import { getAccessToken } from '@/lib/auth/tokenStore';
import { apiBaseUrl, isLiveBackend } from '@/lib/api/mode';
import { farmOrigin } from '@/lib/markets/linkage';
import { DEFAULT_PLACE_RADIUS_KM, rankPlaces } from '@/lib/places/relevance';
import { OSM_ATTRIBUTION, SEED_PLACES, seedPlaceById } from '@/lib/places/seed';

export { OSM_ATTRIBUTION, DEFAULT_PLACE_RADIUS_KM };

export function mergePlaces(seed: AgriculturalPlace[], extra: AgriculturalPlace[]) {
  const byId = new Map<string, AgriculturalPlace>();
  for (const place of seed) byId.set(place.placeId, place);
  for (const place of extra) {
    const existing = byId.get(place.placeId);
    if (!existing) {
      byId.set(place.placeId, place);
      continue;
    }
    byId.set(place.placeId, {
      ...existing,
      ...place,
      services: unique([...existing.services, ...place.services]),
      commodities: unique([...existing.commodities, ...place.commodities]),
      sources: [...existing.sources, ...place.sources.filter((source) => !existing.sources.some((item) => item.kind === source.kind && item.sourcePlaceId === source.sourcePlaceId))]
    });
  }
  return [...byId.values()];
}

export function listNearbyPlaces({
  farm,
  enterprises,
  liveMarkets,
  extras = [],
  filter,
  radiusKm = DEFAULT_PLACE_RADIUS_KM,
  limit = 24
}: {
  farm?: Farm | null;
  enterprises: Enterprise[];
  liveMarkets?: MarketSignal[];
  extras?: AgriculturalPlace[];
  filter?: PlaceFilter | null;
  radiusKm?: number;
  limit?: number;
}): RankedPlace[] {
  const origin = farm ? farmOrigin(farm) : null;
  if (!origin) return [];
  return rankPlaces({
    origin,
    places: mergePlaces(SEED_PLACES, extras),
    enterprises,
    liveMarkets,
    filter,
    radiusKm,
    limit
  });
}

export function findPlace(placeId: string, extras: AgriculturalPlace[] = []) {
  return extras.find((place) => place.placeId === placeId) ?? seedPlaceById(placeId);
}

export async function fetchNearbyPlaces(input: {
  latitude: number;
  longitude: number;
  commodity?: string;
  category?: PlaceFilter | null;
  radiusKm?: number;
}): Promise<AgriculturalPlace[]> {
  if (!isLiveBackend()) return [];
  const token = await getAccessToken();
  const base = apiBaseUrl();
  if (!token || !base) return [];
  const query = new URLSearchParams({
    lat: String(input.latitude),
    lng: String(input.longitude),
    radiusKm: String(input.radiusKm ?? DEFAULT_PLACE_RADIUS_KM)
  });
  if (input.commodity) query.set('commodity', input.commodity);
  if (input.category) query.set('filter', input.category);
  try {
    const response = await fetch(`${base}/api/v1/farmer/places/nearby?${query}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as { places?: AgriculturalPlace[] };
    return Array.isArray(payload.places) ? payload.places : [];
  } catch {
    return [];
  }
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}
