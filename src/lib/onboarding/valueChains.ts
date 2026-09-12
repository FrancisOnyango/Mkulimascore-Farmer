import type { FarmSector } from '@/domain/types';
import { FARM_SECTORS } from '@/domain/types';

export const VALUE_CHAIN_GROUPS = [
  { id: 'all', label: 'All' },
  { id: 'livestock', label: 'Livestock' },
  { id: 'staples', label: 'Staples' },
  { id: 'horticulture', label: 'Horticulture' },
  { id: 'trees', label: 'Trees & cash' }
] as const;

export type ValueChainGroup = 'livestock' | 'staples' | 'horticulture' | 'trees' | 'other';

export function isKnownSector(value: string): value is FarmSector {
  return (FARM_SECTORS as readonly string[]).includes(value);
}

export function productionUnitFor(sector?: FarmSector | string) {
  if (sector === 'Dairy') return 'litres';
  if (sector === 'Poultry') return 'eggs or birds';
  if (sector === 'Tea' || sector === 'Coffee' || sector === 'Pyrethrum') return 'kg';
  if (sector === 'Maize' || sector === 'Wheat' || sector === 'Rice' || sector === 'Sorghum' || sector === 'Millet') return 'bags';
  if (sector === 'Beans' || sector === 'Green grams' || sector === 'Cowpeas' || sector === 'Pigeon peas' || sector === 'Groundnuts' || sector === 'Soybean') return 'bags';
  if (sector === 'Irish potatoes' || sector === 'Onion' || sector === 'Cabbage') return 'bags';
  if (sector === 'Aquaculture') return 'kg';
  if (sector === 'Beekeeping') return 'kg honey';
  if (sector === 'Flowers') return 'stems';
  return 'kg';
}

export function productionMetricFor(sector?: FarmSector | string) {
  if (sector === 'Dairy') return 'milk_produced';
  if (sector === 'Poultry') return 'eggs_or_birds_produced';
  if (sector === 'Tea') return 'green_leaf_delivered';
  if (sector === 'Coffee') return 'cherry_delivered';
  if (sector === 'Beekeeping') return 'honey_harvested';
  if (isDailySector(sector)) return 'herd_update';
  return 'production';
}

export function isDailySector(sector?: FarmSector | string) {
  return sector === 'Dairy'
    || sector === 'Poultry'
    || sector === 'Livestock'
    || sector === 'Beef'
    || sector === 'Goats & sheep'
    || sector === 'Pigs'
    || sector === 'Camels'
    || sector === 'Aquaculture'
    || sector === 'Beekeeping';
}

export function defaultCostCategory(sector?: FarmSector | string) {
  if (sector === 'Dairy' || sector === 'Poultry' || sector === 'Pigs' || sector === 'Camels') return 'Feed';
  if (isDailySector(sector)) return 'Veterinary';
  if (sector === 'Tea' || sector === 'Coffee' || sector === 'Flowers') return 'Labour';
  return 'Inputs';
}

export function costCategories(sector?: FarmSector | string) {
  if (isDailySector(sector)) return ['Feed', 'Veterinary', 'Labour', 'Transport', 'Water', 'Other'];
  return ['Seed', 'Fertilizer', 'Labour', 'Transport', 'Spray', 'Irrigation', 'Packaging', 'Other'];
}

export function buyerSuggestions(sector?: FarmSector | string) {
  if (sector === 'Dairy') return ['Wakulima Dairy', 'Githunguri Dairy', 'New KCC', 'Brookside', 'Meru Central Dairy', 'Local trader'];
  if (sector === 'Tea') return ['KTDA buying centre', 'Tea factory', 'Local buyer'];
  if (sector === 'Coffee') return ['Coffee factory', 'Cooperative society', 'Local buyer'];
  if (sector === 'Poultry') return ['Hotel', 'Local market', 'Aggregator'];
  if (sector === 'Flowers') return ['Packhouse', 'Exporter', 'Local market'];
  if (sector === 'Sugarcane') return ['Sugar mill', 'Outgrower company'];
  return ['Local market', 'Cooperative', 'Aggregator', 'Broker', 'Farm-gate buyer'];
}

export function institutionSuggestions() {
  return [
    'Githunguri Dairy Farmers Cooperative',
    'Wakulima Dairy',
    'Meru Central Dairy',
    'Othaya Farmers Cooperative',
    'Mathira Dairy Cooperative',
    'KTDA factory',
    'New KCC',
    'Unaitas Sacco',
    'Stima Sacco',
    'Harambee Sacco',
    'KWFT',
    'Local cooperative'
  ];
}

export function farmNameSuggestions() {
  return ['Home farm', 'Upper plot', 'River plot', 'Shamba', 'Kitchen garden'];
}

export function recordTitleSuggestions() {
  return ['Harvest photo', 'Milk delivery', 'Sale receipt', 'Input receipt', 'Vet visit', 'Cooperative statement', 'Farm boundary'];
}
