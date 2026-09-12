import type { GeoPoint } from '@/lib/geo/geo';
import { formatKm, haversineKm } from '@/lib/geo/geo';

export type KenyaMarket = {
  id: string;
  name: string;
  town: string;
  latitude: number;
  longitude: number;
  goods: string[];
};

export const KENYA_MARKETS: KenyaMarket[] = [
  { id: 'wakulima-nbi', name: 'Wakulima Market', town: 'Nairobi', latitude: -1.2864, longitude: 36.8344, goods: ['Maize', 'Tomato', 'Beans', 'Irish potatoes'] },
  { id: 'kongowea', name: 'Kongowea Market', town: 'Mombasa', latitude: -4.0435, longitude: 39.6682, goods: ['Tomato', 'Maize', 'Beans'] },
  { id: 'kibuye', name: 'Kibuye Market', town: 'Kisumu', latitude: -0.0917, longitude: 34.768, goods: ['Maize', 'Fish', 'Beans'] },
  { id: 'karatina', name: 'Karatina Market', town: 'Nyeri', latitude: -0.4832, longitude: 37.1274, goods: ['Tomato', 'Irish potatoes', 'Tea'] },
  { id: 'eldoret', name: 'Eldoret Municipal Market', town: 'Eldoret', latitude: 0.5143, longitude: 35.2698, goods: ['Maize', 'Dairy', 'Wheat'] },
  { id: 'nakuru', name: 'Nakuru Municipal Market', town: 'Nakuru', latitude: -0.3031, longitude: 36.08, goods: ['Maize', 'Dairy', 'Irish potatoes'] },
  { id: 'kitale', name: 'Kitale Market', town: 'Kitale', latitude: 1.0167, longitude: 35.0063, goods: ['Maize', 'Dairy'] },
  { id: 'meru', name: 'Meru Municipal Market', town: 'Meru', latitude: 0.0463, longitude: 37.6559, goods: ['Tea', 'Coffee', 'Maize'] },
  { id: 'machakos', name: 'Machakos Market', town: 'Machakos', latitude: -1.5177, longitude: 37.2634, goods: ['Tomato', 'Beans', 'Maize'] },
  { id: 'thika', name: 'Thika Open Market', town: 'Thika', latitude: -1.0333, longitude: 37.0693, goods: ['Tomato', 'Dairy', 'Avocado'] },
  { id: 'embu', name: 'Embu Market', town: 'Embu', latitude: -0.531, longitude: 37.4506, goods: ['Coffee', 'Maize', 'Macadamia'] },
  { id: 'kericho', name: 'Kericho Market', town: 'Kericho', latitude: -0.367, longitude: 35.283, goods: ['Tea', 'Dairy', 'Maize'] },
  { id: 'bungoma', name: 'Bungoma Market', town: 'Bungoma', latitude: 0.5635, longitude: 34.5606, goods: ['Maize', 'Beans', 'Sugarcane'] },
  { id: 'nyeri', name: 'Nyeri Open Market', town: 'Nyeri', latitude: -0.4167, longitude: 36.95, goods: ['Coffee', 'Tea', 'Dairy'] },
  { id: 'githunguri', name: 'Githunguri Trading Centre', town: 'Kiambu', latitude: -1.057, longitude: 36.778, goods: ['Dairy', 'Maize', 'Avocado'] },
  { id: 'kerugoya', name: 'Kerugoya Market', town: 'Kerugoya', latitude: -0.4989, longitude: 37.2803, goods: ['Maize', 'Rice', 'Beans'] },
  { id: 'nanyuki', name: 'Nanyuki Market', town: 'Nanyuki', latitude: 0.0167, longitude: 37.0728, goods: ['Maize', 'Dairy', 'Irish potatoes'] },
  { id: 'kawangware', name: 'Kawangware Market', town: 'Nairobi', latitude: -1.278, longitude: 36.751, goods: ['Maize', 'Tomato', 'Beans'] },
  { id: 'kakamega', name: 'Kakamega Town Market', town: 'Kakamega', latitude: 0.2827, longitude: 34.7519, goods: ['Maize', 'Beans'] },
  { id: 'ahero', name: 'Ahero Market', town: 'Ahero', latitude: -0.174, longitude: 34.92, goods: ['Maize', 'Rice'] },
  { id: 'gakoromone', name: 'Gakoromone', town: 'Meru', latitude: 0.047, longitude: 37.656, goods: ['Maize', 'Tea', 'Coffee'] }
];

export function nearestMarkets(origin: GeoPoint, limit = 2) {
  return KENYA_MARKETS
    .map((market) => {
      const km = haversineKm(origin, market);
      return { ...market, km, distanceLabel: formatKm(km) };
    })
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}
