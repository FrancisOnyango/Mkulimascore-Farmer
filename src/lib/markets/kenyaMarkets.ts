import type { GeoPoint } from '@/lib/geo/geo';
import { formatKm, haversineKm } from '@/lib/geo/geo';
import { SEED_PLACES } from '@/lib/places/seed';

export type KenyaMarket = {
  id: string;
  name: string;
  town: string;
  latitude: number;
  longitude: number;
  goods: string[];
};

export const KENYA_MARKETS: KenyaMarket[] = SEED_PLACES
  .filter((place) => place.category === 'markets')
  .map((place) => ({
    id: place.placeId,
    name: place.name,
    town: place.town ?? place.county ?? place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    goods: place.commodities
  }));

export function nearestMarkets(origin: GeoPoint, limit = 2) {
  return KENYA_MARKETS
    .map((market) => {
      const km = haversineKm(origin, market);
      return { ...market, km, distanceLabel: formatKm(km) };
    })
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}
