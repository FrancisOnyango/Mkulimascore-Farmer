import type { Enterprise } from '@/domain/types';

export function enterpriseActions(sector: Enterprise['sector']) {
  if (sector === 'Dairy') {
    return [
      { label: 'Milk', route: '/add/production' },
      { label: 'Sale', route: '/add/sale' },
      { label: 'Feed', route: '/add/cost' }
    ];
  }
  if (sector === 'Poultry') {
    return [
      { label: 'Flock', route: '/add/production' },
      { label: 'Sale', route: '/add/sale' },
      { label: 'Feed', route: '/add/cost' }
    ];
  }
  if (sector === 'Livestock') {
    return [
      { label: 'Herd', route: '/add/production' },
      { label: 'Sale', route: '/add/sale' },
      { label: 'Cost', route: '/add/cost' }
    ];
  }
  if (sector === 'Tea' || sector === 'Coffee') {
    return [
      { label: 'Delivery', route: '/add/production' },
      { label: 'Sale', route: '/add/sale' },
      { label: 'Input', route: '/add/cost' }
    ];
  }
  return [
    { label: 'Harvest', route: '/add/production' },
    { label: 'Sale', route: '/add/sale' },
    { label: 'Input', route: '/add/cost' }
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
