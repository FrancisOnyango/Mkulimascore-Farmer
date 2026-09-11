import type { Enterprise } from '@/domain/types';

export function enterpriseActions(sector: Enterprise['sector']) {
  if (sector === 'Dairy') {
    return [
      { label: 'Record milk', route: '/add/production' },
      { label: 'Milk sale', route: '/add/sale' },
      { label: 'Feed', route: '/add/cost' }
    ];
  }
  if (sector === 'Poultry') {
    return [
      { label: 'Flock update', route: '/add/production' },
      { label: 'Sale', route: '/add/sale' },
      { label: 'Feed', route: '/add/cost' }
    ];
  }
  return [
    { label: 'Production', route: '/add/production' },
    { label: 'Sale', route: '/add/sale' },
    { label: 'Input cost', route: '/add/cost' }
  ];
}

export function parseDairySummary(enterprise: Enterprise) {
  const cattle = enterprise.summary.match(/(\d+)\s+cattle/i)?.[1];
  const lactating = enterprise.summary.match(/(\d+)\s+lactating/i)?.[1];
  return {
    cattle: cattle ?? null,
    lactating: lactating ?? null,
    milk: enterprise.productionValue,
    buyer: enterprise.buyer
  };
}
