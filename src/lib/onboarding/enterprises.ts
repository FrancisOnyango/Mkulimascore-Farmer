import type { FarmSector } from '@/domain/types';
import { buyerSuggestions } from '@/lib/onboarding/valueChains';

export type EnterpriseField = {
  key: string;
  label: string;
  placeholder: string;
  hint?: string;
  keyboard?: 'default' | 'numeric' | 'decimal-pad';
  kind?: 'text' | 'date' | 'buyer';
};

export type EnterpriseIcon =
  | 'water-outline'
  | 'leaf-outline'
  | 'cafe-outline'
  | 'fast-food-outline'
  | 'nutrition-outline'
  | 'egg-outline'
  | 'apps-outline'
  | 'cube-outline'
  | 'flower-outline'
  | 'ellipse-outline'
  | 'paw-outline'
  | 'fish-outline'
  | 'git-commit-outline'
  | 'sunny-outline';

export type EnterpriseGroup = 'livestock' | 'staples' | 'horticulture' | 'trees';

export type EnterpriseCatalogItem = {
  sector: FarmSector;
  label: string;
  hint: string;
  group: EnterpriseGroup;
  icon: EnterpriseIcon;
  fields: EnterpriseField[];
};

function cropFields(area = '1 acre'): EnterpriseField[] {
  return [
    { key: 'areaPlanted', label: 'Area planted', placeholder: area, hint: 'Acres or hectares you planted' },
    { key: 'season', label: 'Current season', placeholder: 'Long rains 2026' },
    { key: 'plantingDate', label: 'Planting date', placeholder: '18 Mar 2026', kind: 'date' },
    { key: 'mainBuyer', label: 'Main buyer', placeholder: 'Market or cooperative', kind: 'buyer' }
  ];
}

function treeFields(trees = '40'): EnterpriseField[] {
  return [
    { key: 'treeCount', label: 'Number of trees', placeholder: trees, keyboard: 'numeric' },
    { key: 'stage', label: 'Current stage', placeholder: 'Bearing' },
    { key: 'mainBuyer', label: 'Main buyer', placeholder: 'Factory or exporter', kind: 'buyer' }
  ];
}

function herdFields(animals = '12', kinds = 'Goats and sheep'): EnterpriseField[] {
  return [
    { key: 'herdSize', label: 'Number of animals', placeholder: animals, keyboard: 'numeric' },
    { key: 'animalTypes', label: 'Main animals', placeholder: kinds },
    { key: 'mainBuyer', label: 'Main buyer', placeholder: 'Butcher, market or cooperative', kind: 'buyer' }
  ];
}

export const ENTERPRISE_CATALOG: EnterpriseCatalogItem[] = [
  {
    sector: 'Dairy',
    label: 'Dairy',
    hint: 'Cattle and milk',
    group: 'livestock',
    icon: 'water-outline',
    fields: [
      { key: 'cattleCount', label: 'Number of cattle', placeholder: '7', keyboard: 'numeric' },
      { key: 'lactatingCows', label: 'Lactating cows', placeholder: '4', keyboard: 'numeric' },
      { key: 'milkPerDay', label: 'Approximate milk / day', placeholder: '18', keyboard: 'decimal-pad', hint: 'Litres on a normal day' },
      { key: 'mainBuyer', label: 'Main buyer', placeholder: 'Cooperative or dairy', kind: 'buyer' }
    ]
  },
  { sector: 'Beef', label: 'Beef', hint: 'Cattle for meat', group: 'livestock', icon: 'paw-outline', fields: herdFields('8', 'Beef cattle') },
  { sector: 'Goats & sheep', label: 'Goats & sheep', hint: 'Small stock', group: 'livestock', icon: 'paw-outline', fields: herdFields('20', 'Goats and sheep') },
  {
    sector: 'Poultry',
    label: 'Poultry',
    hint: 'Birds and eggs',
    group: 'livestock',
    icon: 'egg-outline',
    fields: [
      { key: 'flockSize', label: 'Flock size', placeholder: '120', keyboard: 'numeric' },
      { key: 'flockType', label: 'Layers or broilers', placeholder: 'Layers' },
      { key: 'dailyOutput', label: 'Eggs or birds / day', placeholder: '86' },
      { key: 'mainBuyer', label: 'Main buyer', placeholder: 'Hotel or market', kind: 'buyer' }
    ]
  },
  { sector: 'Pigs', label: 'Pigs', hint: 'Pork', group: 'livestock', icon: 'paw-outline', fields: herdFields('15', 'Pigs') },
  { sector: 'Camels', label: 'Camels', hint: 'Milk or meat', group: 'livestock', icon: 'paw-outline', fields: herdFields('6', 'Camels') },
  { sector: 'Livestock', label: 'Mixed livestock', hint: 'Mixed herd', group: 'livestock', icon: 'paw-outline', fields: herdFields() },
  {
    sector: 'Aquaculture',
    label: 'Fish',
    hint: 'Ponds or cages',
    group: 'livestock',
    icon: 'fish-outline',
    fields: [
      { key: 'ponds', label: 'Ponds or cages', placeholder: '2', keyboard: 'numeric' },
      { key: 'species', label: 'Main species', placeholder: 'Tilapia' },
      { key: 'mainBuyer', label: 'Main buyer', placeholder: 'Hotel or market', kind: 'buyer' }
    ]
  },
  {
    sector: 'Beekeeping',
    label: 'Beekeeping',
    hint: 'Honey',
    group: 'livestock',
    icon: 'flower-outline',
    fields: [
      { key: 'hives', label: 'Number of hives', placeholder: '10', keyboard: 'numeric' },
      { key: 'mainBuyer', label: 'Main buyer', placeholder: 'Honey buyer', kind: 'buyer' }
    ]
  },
  { sector: 'Maize', label: 'Maize', hint: 'Grain', group: 'staples', icon: 'leaf-outline', fields: cropFields('2.4 acres') },
  { sector: 'Wheat', label: 'Wheat', hint: 'Grain', group: 'staples', icon: 'leaf-outline', fields: cropFields('5 acres') },
  { sector: 'Rice', label: 'Rice', hint: 'Paddy', group: 'staples', icon: 'apps-outline', fields: cropFields('1 acre') },
  { sector: 'Sorghum', label: 'Sorghum', hint: 'Grain', group: 'staples', icon: 'leaf-outline', fields: cropFields() },
  { sector: 'Millet', label: 'Millet', hint: 'Grain', group: 'staples', icon: 'leaf-outline', fields: cropFields() },
  { sector: 'Beans', label: 'Beans', hint: 'Pulse', group: 'staples', icon: 'ellipse-outline', fields: cropFields() },
  { sector: 'Green grams', label: 'Green grams', hint: 'Ndengu', group: 'staples', icon: 'ellipse-outline', fields: cropFields() },
  { sector: 'Cowpeas', label: 'Cowpeas', hint: 'Kunde', group: 'staples', icon: 'ellipse-outline', fields: cropFields() },
  { sector: 'Pigeon peas', label: 'Pigeon peas', hint: 'Mbaazi', group: 'staples', icon: 'ellipse-outline', fields: cropFields() },
  { sector: 'Groundnuts', label: 'Groundnuts', hint: 'Njugu', group: 'staples', icon: 'ellipse-outline', fields: cropFields() },
  { sector: 'Soybean', label: 'Soybean', hint: 'Oilseed', group: 'staples', icon: 'ellipse-outline', fields: cropFields() },
  { sector: 'Irish potatoes', label: 'Irish potatoes', hint: 'Tuber', group: 'horticulture', icon: 'cube-outline', fields: cropFields('0.5 acres') },
  { sector: 'Sweet potatoes', label: 'Sweet potatoes', hint: 'Tuber', group: 'horticulture', icon: 'cube-outline', fields: cropFields() },
  { sector: 'Cassava', label: 'Cassava', hint: 'Root', group: 'horticulture', icon: 'cube-outline', fields: cropFields() },
  { sector: 'Banana', label: 'Banana', hint: 'Matoke', group: 'horticulture', icon: 'nutrition-outline', fields: cropFields() },
  { sector: 'Tomato', label: 'Tomato', hint: 'Horticulture', group: 'horticulture', icon: 'flower-outline', fields: cropFields('0.25 acres') },
  { sector: 'Onion', label: 'Onion', hint: 'Horticulture', group: 'horticulture', icon: 'flower-outline', fields: cropFields() },
  { sector: 'Kale', label: 'Kale', hint: 'Sukuma wiki', group: 'horticulture', icon: 'leaf-outline', fields: cropFields() },
  { sector: 'Cabbage', label: 'Cabbage', hint: 'Horticulture', group: 'horticulture', icon: 'leaf-outline', fields: cropFields() },
  { sector: 'French beans', label: 'French beans', hint: 'Export vegetable', group: 'horticulture', icon: 'leaf-outline', fields: cropFields() },
  { sector: 'Capsicum', label: 'Capsicum', hint: 'Hoho', group: 'horticulture', icon: 'flower-outline', fields: cropFields() },
  { sector: 'Watermelon', label: 'Watermelon', hint: 'Fruit', group: 'horticulture', icon: 'nutrition-outline', fields: cropFields() },
  { sector: 'Mango', label: 'Mango', hint: 'Fruit trees', group: 'trees', icon: 'nutrition-outline', fields: treeFields('30') },
  { sector: 'Avocado', label: 'Avocado', hint: 'Trees', group: 'trees', icon: 'nutrition-outline', fields: treeFields('80') },
  { sector: 'Passion fruit', label: 'Passion fruit', hint: 'Vines', group: 'horticulture', icon: 'nutrition-outline', fields: cropFields() },
  { sector: 'Pineapple', label: 'Pineapple', hint: 'Fruit', group: 'horticulture', icon: 'nutrition-outline', fields: cropFields() },
  { sector: 'Citrus', label: 'Citrus', hint: 'Oranges or lemons', group: 'trees', icon: 'nutrition-outline', fields: treeFields() },
  { sector: 'Macadamia', label: 'Macadamia', hint: 'Nuts', group: 'trees', icon: 'git-commit-outline', fields: treeFields() },
  { sector: 'Cashew', label: 'Cashew', hint: 'Nuts', group: 'trees', icon: 'git-commit-outline', fields: treeFields() },
  { sector: 'Coconut', label: 'Coconut', hint: 'Coast trees', group: 'trees', icon: 'sunny-outline', fields: treeFields() },
  {
    sector: 'Tea',
    label: 'Tea',
    hint: 'Green leaf',
    group: 'trees',
    icon: 'fast-food-outline',
    fields: [
      { key: 'areaPlanted', label: 'Area', placeholder: '0.8 acres' },
      { key: 'mainBuyer', label: 'Buying centre', placeholder: 'KTDA buying centre', kind: 'buyer' }
    ]
  },
  {
    sector: 'Coffee',
    label: 'Coffee',
    hint: 'Cherry / factory',
    group: 'trees',
    icon: 'cafe-outline',
    fields: [
      { key: 'areaPlanted', label: 'Area', placeholder: '0.5 acres' },
      { key: 'mainBuyer', label: 'Factory or cooperative', placeholder: 'Coffee factory', kind: 'buyer' }
    ]
  },
  { sector: 'Sugarcane', label: 'Sugarcane', hint: 'Outgrower cane', group: 'trees', icon: 'leaf-outline', fields: cropFields('3 acres') },
  { sector: 'Cotton', label: 'Cotton', hint: 'Fibre', group: 'staples', icon: 'apps-outline', fields: cropFields() },
  {
    sector: 'Flowers',
    label: 'Flowers',
    hint: 'Cut flowers',
    group: 'horticulture',
    icon: 'flower-outline',
    fields: [
      { key: 'areaPlanted', label: 'Area or stems', placeholder: 'Greenhouse or 0.25 acres' },
      { key: 'mainBuyer', label: 'Packhouse or exporter', placeholder: 'Packhouse', kind: 'buyer' }
    ]
  },
  { sector: 'Sunflower', label: 'Sunflower', hint: 'Oilseed', group: 'staples', icon: 'sunny-outline', fields: cropFields() },
  { sector: 'Pyrethrum', label: 'Pyrethrum', hint: 'Flower crop', group: 'horticulture', icon: 'flower-outline', fields: cropFields() },
  {
    sector: 'Other',
    label: 'Other',
    hint: 'Something else',
    group: 'staples',
    icon: 'apps-outline',
    fields: [
      { key: 'name', label: 'What do you farm?', placeholder: 'Name the crop or livestock' },
      { key: 'areaPlanted', label: 'Scale', placeholder: 'Area, trees or animals' },
      { key: 'mainBuyer', label: 'Main buyer', placeholder: 'Who usually buys?', kind: 'buyer' }
    ]
  }
];

export function enterpriseCatalog(sector: FarmSector) {
  return ENTERPRISE_CATALOG.find((item) => item.sector === sector);
}

export function summarizeEnterprise(sector: FarmSector, details: Record<string, string>) {
  if (sector === 'Dairy') {
    const cattle = details.cattleCount || '—';
    const lactating = details.lactatingCows || '—';
    const milk = details.milkPerDay ? `${details.milkPerDay} L/day` : 'Milk not recorded';
    return {
      summary: `${cattle} cattle · ${lactating} lactating`,
      productionMetric: 'Approximate milk',
      productionValue: milk,
      buyer: details.mainBuyer
    };
  }
  if (sector === 'Poultry') {
    return {
      summary: [details.flockSize ? `${details.flockSize} birds` : null, details.flockType].filter(Boolean).join(' · ') || 'Poultry enterprise',
      productionMetric: 'Current flock',
      productionValue: details.dailyOutput || details.flockSize || 'Active',
      buyer: details.mainBuyer
    };
  }
  return {
    summary: details.areaPlanted || details.treeCount || details.herdSize || details.hives || details.name || `${sector} enterprise`,
    productionMetric: 'Current status',
    productionValue: details.stage || details.season || 'Added by you',
    buyer: details.mainBuyer
  };
}

export function buyersFor(sector?: FarmSector) {
  return buyerSuggestions(sector);
}
