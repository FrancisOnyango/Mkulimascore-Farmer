export const PLACE_CATEGORIES = [
  'markets',
  'inputs',
  'collection',
  'services',
  'cooperatives',
  'support'
] as const;

export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

export const PLACE_FILTERS = ['markets', 'inputs', 'services', 'buyers'] as const;
export type PlaceFilter = (typeof PLACE_FILTERS)[number];

export const PLACE_VERIFICATIONS = [
  'DISCOVERED',
  'COMMUNITY_CONFIRMED',
  'PARTNER_CONFIRMED',
  'FIELD_VERIFIED',
  'STALE',
  'CLOSED'
] as const;

export type PlaceVerification = (typeof PLACE_VERIFICATIONS)[number];

export type PlaceSourceKind =
  | 'OSM_CURATED'
  | 'KAMIS'
  | 'MKULIMA_CURATED'
  | 'FARMER_CONTRIBUTED'
  | 'FIELD_AGENT'
  | 'PARTNER';

export interface PlaceSource {
  kind: PlaceSourceKind;
  sourcePlaceId?: string;
  seenAt?: string;
}

export interface AgriculturalPlace {
  placeId: string;
  name: string;
  category: PlaceCategory;
  subcategory: string;
  categories?: PlaceCategory[];
  latitude: number;
  longitude: number;
  county?: string;
  town?: string;
  phone?: string;
  openingHours?: string;
  services: string[];
  commodities: string[];
  sources: PlaceSource[];
  verification: PlaceVerification;
  confidence: 'low' | 'medium' | 'high';
  verifiedAt?: string | null;
  lastSeenAt?: string | null;
  organizationId?: string;
}

export interface RankedPlace extends AgriculturalPlace {
  km: number;
  distanceLabel: string;
  relevance: number;
  recommended: boolean;
  recommendedLine?: string;
  verificationLabel: string;
  priceLabel?: string;
  freshnessLabel?: string;
}

export const PLACE_CATEGORY_LABELS: Record<PlaceCategory, string> = {
  markets: 'Markets & buyers',
  inputs: 'Farm inputs',
  collection: 'Collection & storage',
  services: 'Animal & crop services',
  cooperatives: 'Cooperatives & finance',
  support: 'Farm support'
};

export const PLACE_FILTER_LABELS: Record<PlaceFilter, string> = {
  markets: 'Markets',
  inputs: 'Inputs',
  services: 'Services',
  buyers: 'Buyers'
};

export const PLACE_PIN_COLORS: Record<PlaceCategory, string> = {
  markets: '#2F618D',
  inputs: '#9A5A12',
  collection: '#1F6B40',
  services: '#A6543F',
  cooperatives: '#17643B',
  support: '#5A3D12'
};

export function categoriesForFilter(filter?: PlaceFilter | null): PlaceCategory[] | null {
  if (!filter) return null;
  if (filter === 'markets') return ['markets'];
  if (filter === 'inputs') return ['inputs'];
  if (filter === 'services') return ['services', 'support'];
  return ['collection', 'cooperatives', 'markets'];
}

export function placeMatchesFilter(place: Pick<AgriculturalPlace, 'category' | 'categories'>, filter?: PlaceFilter | null) {
  const wanted = categoriesForFilter(filter);
  if (!wanted) return true;
  const owned = new Set([place.category, ...(place.categories ?? [])]);
  return wanted.some((item) => owned.has(item));
}

export function verificationLabel(status: PlaceVerification) {
  if (status === 'FIELD_VERIFIED') return 'Verified location';
  if (status === 'PARTNER_CONFIRMED') return 'Confirmed by a partner';
  if (status === 'COMMUNITY_CONFIRMED') return 'Farmers have confirmed this place';
  if (status === 'STALE') return 'May be out of date';
  if (status === 'CLOSED') return 'Reported closed';
  return 'Listed place — not yet verified';
}

export function isVerifiedPlace(status: PlaceVerification) {
  return status === 'FIELD_VERIFIED' || status === 'PARTNER_CONFIRMED';
}

export function placeTypeChoices(): { id: PlaceCategory; label: string; hint: string }[] {
  return [
    { id: 'markets', label: 'Market or buyer', hint: 'Physical market, processor or aggregator' },
    { id: 'inputs', label: 'Farm inputs', hint: 'Agrovet, seed, fertilizer or feed shop' },
    { id: 'collection', label: 'Collection or store', hint: 'Milk collection, warehouse or cold room' },
    { id: 'services', label: 'Animal or crop service', hint: 'Vet, AI technician or machinery' },
    { id: 'cooperatives', label: 'Cooperative or SACCO', hint: 'Cooperative, collection society or lender' },
    { id: 'support', label: 'Farm support', hint: 'Extension office, lab or irrigation help' }
  ];
}
