import type { Enterprise, FarmSector } from '@/domain/types';

export function nextRecordAction(enterprise?: Enterprise) {
  if (!enterprise) {
    return { title: 'Add a record', detail: 'Milk, harvest, eggs or a sale', route: '/add' as const };
  }
  return {
    title: actionTitle(enterprise.sector),
    detail: enterprise.productionValue || enterprise.summary,
    route: '/add/production' as const
  };
}

export function actionTitle(sector: FarmSector) {
  if (sector === 'Dairy') return 'Record milk';
  if (sector === 'Poultry') return 'Update flock';
  if (sector === 'Livestock') return 'Update herd';
  if (sector === 'Aquaculture') return 'Update pond';
  if (sector === 'Tea' || sector === 'Coffee') return 'Record delivery';
  if (sector === 'Avocado' || sector === 'Macadamia') return 'Update trees';
  return `Record ${sector.toLowerCase()}`;
}

export function activityTypes(sector?: FarmSector) {
  if (sector === 'Dairy') {
    return [
      { label: 'Milk', route: '/add/production' },
      { label: 'Sale', route: '/add/sale' },
      { label: 'Feed', route: '/add/cost' },
      { label: 'Photo', route: '/add/record' }
    ];
  }
  if (sector === 'Poultry') {
    return [
      { label: 'Flock', route: '/add/production' },
      { label: 'Sale', route: '/add/sale' },
      { label: 'Feed', route: '/add/cost' },
      { label: 'Photo', route: '/add/record' }
    ];
  }
  if (sector === 'Livestock') {
    return [
      { label: 'Herd', route: '/add/production' },
      { label: 'Sale', route: '/add/sale' },
      { label: 'Cost', route: '/add/cost' },
      { label: 'Photo', route: '/add/record' }
    ];
  }
  if (sector === 'Aquaculture') {
    return [
      { label: 'Harvest', route: '/add/production' },
      { label: 'Sale', route: '/add/sale' },
      { label: 'Feed', route: '/add/cost' },
      { label: 'Photo', route: '/add/record' }
    ];
  }
  if (sector === 'Tea' || sector === 'Coffee') {
    return [
      { label: 'Delivery', route: '/add/production' },
      { label: 'Sale', route: '/add/sale' },
      { label: 'Input', route: '/add/cost' },
      { label: 'Photo', route: '/add/record' }
    ];
  }
  return [
    { label: 'Harvest', route: '/add/production' },
    { label: 'Sale', route: '/add/sale' },
    { label: 'Input', route: '/add/cost' },
    { label: 'Photo', route: '/add/record' }
  ];
}
