import type { Enterprise, FarmSector } from '@/domain/types';
import type { CycleStage } from '@/lib/intelligence/cycle';

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
  if (sector === 'Livestock' || sector === 'Beef' || sector === 'Goats & sheep' || sector === 'Pigs' || sector === 'Camels') return 'Update herd';
  if (sector === 'Aquaculture') return 'Update pond';
  if (sector === 'Beekeeping') return 'Record honey';
  if (sector === 'Tea' || sector === 'Coffee') return 'Record delivery';
  if (sector === 'Avocado' || sector === 'Macadamia' || sector === 'Mango' || sector === 'Citrus' || sector === 'Cashew' || sector === 'Coconut') return 'Update trees';
  return `Record ${sector.toLowerCase()}`;
}

export function activityTypes(sector?: FarmSector, stage?: CycleStage) {
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
  if (sector === 'Livestock' || sector === 'Beef' || sector === 'Goats & sheep' || sector === 'Pigs' || sector === 'Camels') {
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
  const crop = [
    { label: 'Harvest', route: '/add/production' },
    { label: 'Sale', route: '/add/sale' },
    { label: 'Input', route: '/add/cost' },
    { label: 'Photo', route: '/add/record' }
  ];
  if (stage === 'planting' || stage === 'preparing') {
    return [
      { label: 'Planting', route: '/add/production' },
      { label: 'Input', route: '/add/cost' },
      { label: 'Photo', route: '/add/record' },
      { label: 'Sale', route: '/add/sale' }
    ];
  }
  if (stage === 'growing') {
    return [
      { label: 'Field look', route: '/add/record' },
      { label: 'Input', route: '/add/cost' },
      { label: 'Problem', route: '/add/record' },
      { label: 'Harvest', route: '/add/production' }
    ];
  }
  if (stage === 'selling') {
    return [
      { label: 'Sale', route: '/add/sale' },
      { label: 'Harvest', route: '/add/production' },
      { label: 'Cost', route: '/add/cost' },
      { label: 'Photo', route: '/add/record' }
    ];
  }
  return crop;
}
