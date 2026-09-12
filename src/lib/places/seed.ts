import type { AgriculturalPlace } from '@/domain/places';

type SeedMarket = {
  id: string;
  name: string;
  town: string;
  county: string;
  latitude: number;
  longitude: number;
  goods: string[];
};

/**
 * Hand-curated public markets. Coordinates are known marketplace points
 * (OSM / gazetteer), not a live Overpass query. KAMIS may later attach a
 * price to the same place. Discovery is not verification.
 */
const SEED_MARKETS: SeedMarket[] = [
  { id: 'karatina', name: 'Karatina Market', town: 'Karatina', county: 'Nyeri', latitude: -0.4832, longitude: 37.1274, goods: ['Tomato', 'Irish potatoes', 'Maize', 'Tea'] },
  { id: 'nyeri', name: 'Nyeri Open Market', town: 'Nyeri', county: 'Nyeri', latitude: -0.4167, longitude: 36.95, goods: ['Coffee', 'Tea', 'Dairy', 'Maize'] },
  { id: 'nanyuki', name: 'Nanyuki Market', town: 'Nanyuki', county: 'Laikipia', latitude: 0.0167, longitude: 37.0728, goods: ['Maize', 'Dairy', 'Irish potatoes'] },
  { id: 'kerugoya', name: 'Kerugoya Market', town: 'Kerugoya', county: 'Kirinyaga', latitude: -0.4989, longitude: 37.2803, goods: ['Maize', 'Rice', 'Beans'] },
  { id: 'ngurubani', name: 'Ngurubani Market', town: 'Ngurubani', county: 'Kirinyaga', latitude: -0.66, longitude: 37.28, goods: ['Rice', 'Maize', 'Tomato'] },
  { id: 'embu', name: 'Embu Market', town: 'Embu', county: 'Embu', latitude: -0.531, longitude: 37.4506, goods: ['Coffee', 'Maize', 'Macadamia'] },
  { id: 'meru', name: 'Meru Municipal Market', town: 'Meru', county: 'Meru', latitude: 0.0463, longitude: 37.6559, goods: ['Tea', 'Coffee', 'Maize'] },
  { id: 'gakoromone', name: 'Gakoromone', town: 'Meru', county: 'Meru', latitude: 0.047, longitude: 37.656, goods: ['Maize', 'Tea', 'Coffee'] },
  { id: 'kangeta', name: 'Kangeta Market', town: 'Kangeta', county: 'Meru', latitude: 0.3, longitude: 37.87, goods: ['Tea', 'Maize'] },
  { id: 'thika', name: 'Thika Open Market', town: 'Thika', county: 'Kiambu', latitude: -1.0333, longitude: 37.0693, goods: ['Tomato', 'Dairy', 'Avocado'] },
  { id: 'githunguri', name: 'Githunguri Trading Centre', town: 'Githunguri', county: 'Kiambu', latitude: -1.057, longitude: 36.778, goods: ['Dairy', 'Maize', 'Avocado'] },
  { id: 'kawangware', name: 'Kawangware Market', town: 'Nairobi', county: 'Nairobi', latitude: -1.278, longitude: 36.751, goods: ['Maize', 'Tomato', 'Beans'] },
  { id: 'wakulima-nbi', name: 'Wakulima Market', town: 'Nairobi', county: 'Nairobi', latitude: -1.2864, longitude: 36.8344, goods: ['Maize', 'Tomato', 'Beans', 'Irish potatoes'] },
  { id: 'nakuru', name: 'Nakuru Municipal Market', town: 'Nakuru', county: 'Nakuru', latitude: -0.3031, longitude: 36.08, goods: ['Maize', 'Dairy', 'Irish potatoes'] },
  { id: 'eldoret', name: 'Eldoret Municipal Market', town: 'Eldoret', county: 'Uasin Gishu', latitude: 0.5143, longitude: 35.2698, goods: ['Maize', 'Dairy', 'Wheat'] },
  { id: 'kitale', name: 'Kitale Market', town: 'Kitale', county: 'Trans Nzoia', latitude: 1.0167, longitude: 35.0063, goods: ['Maize', 'Dairy'] },
  { id: 'kakamega', name: 'Kakamega Town Market', town: 'Kakamega', county: 'Kakamega', latitude: 0.2827, longitude: 34.7519, goods: ['Maize', 'Beans'] },
  { id: 'kibuye', name: 'Kibuye Market', town: 'Kisumu', county: 'Kisumu', latitude: -0.0917, longitude: 34.768, goods: ['Maize', 'Fish', 'Beans'] },
  { id: 'ahero', name: 'Ahero Market', town: 'Ahero', county: 'Kisumu', latitude: -0.174, longitude: 34.92, goods: ['Maize', 'Rice'] },
  { id: 'ndanai', name: 'Ndanai Market', town: 'Ndanai', county: 'Bomet', latitude: -0.85, longitude: 35.2, goods: ['Tea', 'Maize'] },
  { id: 'kericho', name: 'Kericho Market', town: 'Kericho', county: 'Kericho', latitude: -0.367, longitude: 35.283, goods: ['Tea', 'Dairy', 'Maize'] },
  { id: 'bungoma', name: 'Bungoma Market', town: 'Bungoma', county: 'Bungoma', latitude: 0.5635, longitude: 34.5606, goods: ['Maize', 'Beans', 'Sugarcane'] },
  { id: 'machakos', name: 'Machakos Market', town: 'Machakos', county: 'Machakos', latitude: -1.5177, longitude: 37.2634, goods: ['Tomato', 'Beans', 'Maize'] },
  { id: 'kongowea', name: 'Kongowea Market', town: 'Mombasa', county: 'Mombasa', latitude: -4.0435, longitude: 39.6682, goods: ['Tomato', 'Maize', 'Beans'] },
  { id: 'cheptiret', name: 'Cheptiret Market', town: 'Cheptiret', county: 'Uasin Gishu', latitude: 0.43, longitude: 35.32, goods: ['Maize', 'Dairy'] },
  { id: 'kabati', name: 'Kabati Market', town: "Murang'a", county: "Murang'a", latitude: -0.85, longitude: 37.05, goods: ['Maize', 'Banana'] }
];

/** Well-known public institutions only. Do not invent agrovet shops. */
const SEED_INSTITUTIONS: AgriculturalPlace[] = [
  {
    placeId: 'githunguri-dairy-coop',
    name: 'Githunguri Dairy Farmers Co-operative',
    category: 'cooperatives',
    subcategory: 'dairy_cooperative',
    categories: ['cooperatives', 'collection'],
    latitude: -1.057,
    longitude: 36.778,
    county: 'Kiambu',
    town: 'Githunguri',
    services: ['Milk collection', 'Dairy cooperative'],
    commodities: ['Dairy'],
    sources: [{ kind: 'MKULIMA_CURATED', sourcePlaceId: 'githunguri-dairy-coop' }],
    verification: 'DISCOVERED',
    confidence: 'medium'
  }
];

function marketPlace(market: SeedMarket): AgriculturalPlace {
  const dairy = market.goods.includes('Dairy');
  return {
    placeId: market.id,
    name: market.name,
    category: 'markets',
    subcategory: 'marketplace',
    categories: dairy ? ['markets', 'collection'] : ['markets'],
    latitude: market.latitude,
    longitude: market.longitude,
    county: market.county,
    town: market.town,
    services: dairy ? ['Produce market', 'Milk trading'] : ['Produce market'],
    commodities: market.goods,
    sources: [
      { kind: 'OSM_CURATED', sourcePlaceId: market.id },
      { kind: 'KAMIS', sourcePlaceId: market.id }
    ],
    verification: 'DISCOVERED',
    confidence: 'medium'
  };
}

export const SEED_PLACES: AgriculturalPlace[] = [
  ...SEED_MARKETS.map(marketPlace),
  ...SEED_INSTITUTIONS
];

export function seedPlaceById(placeId: string) {
  return SEED_PLACES.find((place) => place.placeId === placeId) ?? null;
}

export const OSM_ATTRIBUTION = 'Listed markets use OpenStreetMap and Ministry (KAMIS) references. A listed place is not a verified shop.';
