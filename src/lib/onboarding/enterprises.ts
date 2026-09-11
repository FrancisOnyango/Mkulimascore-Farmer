import type { FarmSector } from '@/domain/types';

export type EnterpriseField = {
  key: string;
  label: string;
  placeholder: string;
  keyboard?: 'default' | 'numeric' | 'decimal-pad';
};

export type EnterpriseIcon = 'water-outline' | 'leaf-outline' | 'cafe-outline' | 'fast-food-outline' | 'nutrition-outline' | 'egg-outline' | 'apps-outline' | 'cube-outline' | 'flower-outline' | 'ellipse-outline' | 'paw-outline' | 'fish-outline' | 'git-commit-outline';

export const ENTERPRISE_CATALOG: {
  sector: FarmSector;
  label: string;
  hint: string;
  icon: EnterpriseIcon;
  fields: EnterpriseField[];
}[] = [
  {
    sector: 'Dairy',
    label: 'Dairy',
    hint: 'Cattle and milk',
    icon: 'water-outline',
    fields: [
      { key: 'cattleCount', label: 'Number of cattle', placeholder: '7', keyboard: 'numeric' },
      { key: 'lactatingCows', label: 'Lactating cows', placeholder: '4', keyboard: 'numeric' },
      { key: 'milkPerDay', label: 'Approximate milk / day (litres)', placeholder: '18', keyboard: 'decimal-pad' },
      { key: 'mainBuyer', label: 'Main buyer', placeholder: 'Cooperative or dairy' }
    ]
  },
  {
    sector: 'Maize',
    label: 'Maize',
    hint: 'Grain',
    icon: 'leaf-outline',
    fields: [
      { key: 'areaPlanted', label: 'Area planted', placeholder: '2.4 acres' },
      { key: 'season', label: 'Current season', placeholder: 'Long rains 2026' },
      { key: 'plantingDate', label: 'Planting date', placeholder: '18 Mar 2026' },
      { key: 'expectedHarvest', label: 'Expected harvest', placeholder: 'August' }
    ]
  },
  {
    sector: 'Coffee',
    label: 'Coffee',
    hint: 'Cherry / factory',
    icon: 'cafe-outline',
    fields: [
      { key: 'areaPlanted', label: 'Area', placeholder: '0.5 acres' },
      { key: 'mainBuyer', label: 'Factory or cooperative', placeholder: 'Coffee factory' }
    ]
  },
  {
    sector: 'Tea',
    label: 'Tea',
    hint: 'Green leaf',
    icon: 'fast-food-outline',
    fields: [
      { key: 'areaPlanted', label: 'Area', placeholder: '0.8 acres' },
      { key: 'mainBuyer', label: 'Buying centre', placeholder: 'Tea buying centre' }
    ]
  },
  {
    sector: 'Avocado',
    label: 'Avocado',
    hint: 'Trees',
    icon: 'nutrition-outline',
    fields: [
      { key: 'treeCount', label: 'Number of trees', placeholder: '80', keyboard: 'numeric' },
      { key: 'stage', label: 'Current stage', placeholder: 'Flowering' }
    ]
  },
  {
    sector: 'Poultry',
    label: 'Poultry',
    hint: 'Birds and eggs',
    icon: 'egg-outline',
    fields: [
      { key: 'flockSize', label: 'Flock size', placeholder: '120', keyboard: 'numeric' },
      { key: 'flockType', label: 'Layers or broilers', placeholder: 'Layers' },
      { key: 'dailyOutput', label: 'Eggs or birds / day', placeholder: '86' }
    ]
  },
  {
    sector: 'Rice',
    label: 'Rice',
    hint: 'Paddy',
    icon: 'apps-outline',
    fields: [
      { key: 'areaPlanted', label: 'Area planted', placeholder: '1 acre' },
      { key: 'season', label: 'Current season', placeholder: 'Current crop' }
    ]
  },
  {
    sector: 'Irish potatoes',
    label: 'Irish potatoes',
    hint: 'Tuber',
    icon: 'cube-outline',
    fields: [
      { key: 'areaPlanted', label: 'Area planted', placeholder: '0.5 acres' },
      { key: 'season', label: 'Current season', placeholder: 'Current crop' }
    ]
  },
  {
    sector: 'Tomato',
    label: 'Tomato',
    hint: 'Horticulture',
    icon: 'flower-outline',
    fields: [
      { key: 'areaPlanted', label: 'Area planted', placeholder: '0.25 acres' },
      { key: 'season', label: 'Current cycle', placeholder: 'In production' }
    ]
  },
  {
    sector: 'Beans',
    label: 'Beans',
    hint: 'Pulse',
    icon: 'ellipse-outline',
    fields: [
      { key: 'areaPlanted', label: 'Area planted', placeholder: '1 acre' },
      { key: 'season', label: 'Current season', placeholder: 'Current crop' }
    ]
  },
  {
    sector: 'Livestock',
    label: 'Livestock',
    hint: 'Cattle, goats, sheep',
    icon: 'paw-outline',
    fields: [
      { key: 'herdSize', label: 'Number of animals', placeholder: '15', keyboard: 'numeric' },
      { key: 'animalTypes', label: 'Main animals', placeholder: 'Goats and sheep' }
    ]
  },
  {
    sector: 'Aquaculture',
    label: 'Aquaculture',
    hint: 'Fish',
    icon: 'fish-outline',
    fields: [
      { key: 'ponds', label: 'Ponds or cages', placeholder: '2', keyboard: 'numeric' },
      { key: 'species', label: 'Main species', placeholder: 'Tilapia' }
    ]
  },
  {
    sector: 'Macadamia',
    label: 'Macadamia',
    hint: 'Nuts',
    icon: 'git-commit-outline',
    fields: [
      { key: 'treeCount', label: 'Number of trees', placeholder: '40', keyboard: 'numeric' },
      { key: 'stage', label: 'Current stage', placeholder: 'Bearing' }
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
  if (sector === 'Maize') {
    return {
      summary: [details.areaPlanted, details.season].filter(Boolean).join(' · ') || 'Maize enterprise',
      productionMetric: 'Current cycle',
      productionValue: details.expectedHarvest ? `Harvest ${details.expectedHarvest}` : details.season || 'Active',
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
    summary: details.areaPlanted || details.treeCount || details.herdSize || `${sector} enterprise`,
    productionMetric: 'Current status',
    productionValue: details.stage || details.season || 'Added by you',
    buyer: details.mainBuyer
  };
}
