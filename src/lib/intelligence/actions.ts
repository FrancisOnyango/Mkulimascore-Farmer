import type { ActivityItem, ClimateSignal, ConsentGrant, Enterprise, EvidenceRecord, Farm, Passport } from '@/domain/types';
import { locationEvidence } from '@/lib/geo/locationLevel';
import { inferFarmCycle, isDailySector } from '@/lib/intelligence/cycle';

export type ActionKind = 'CONTROLLABLE' | 'EVIDENCE_IMPROVABLE' | 'EXTERNAL' | 'INFORMATIONAL';

export type FarmerAction = {
  id: string;
  code: string;
  kind: ActionKind;
  priority: number;
  relevance: number;
  title: string;
  why: string;
  cta: string;
  route: string;
};

/**
 * Farmer Action Engine.
 * Translates missing evidence into tasks. Never promises score points.
 * External climate/risk reasons stay informational.
 */
export function farmerActions(input: {
  passport: Passport | null;
  farms: Farm[];
  enterprises: Enterprise[];
  records: EvidenceRecord[];
  consents: ConsentGrant[];
  climate?: ClimateSignal[];
  activity?: ActivityItem[];
}): FarmerAction[] {
  const farm = input.farms[0];
  const place = locationEvidence(farm);
  const cycle = inferFarmCycle(input.enterprises, input.activity ?? []);
  const primary = input.enterprises.find((item) => item.primary) ?? input.enterprises[0];
  const recentRecord = input.records.some((record) => {
    const at = new Date(record.documentDate).getTime();
    return Number.isFinite(at) && Date.now() - at < 45 * 24 * 60 * 60 * 1000;
  });
  const actions: FarmerAction[] = [];

  if (primary && isDailySector(primary.sector) && cycle.recordToday) {
    actions.push({
      id: 'today-record',
      code: 'DAILY_RECORD_DUE',
      kind: 'CONTROLLABLE',
      priority: 96,
      relevance: 0.96,
      title: primary.sector === 'Dairy' ? "Record today's milk" : cycle.label,
      why: cycle.line,
      cta: primary.sector === 'Dairy' ? 'Save milk' : 'Add update',
      route: '/add/production'
    });
  }

  if (place.level === 0) {
    actions.push({
      id: 'place',
      code: 'FARM_POINT_MISSING',
      kind: 'CONTROLLABLE',
      priority: 100,
      relevance: 0.94,
      title: 'Mark your farm place',
      why: 'A point unlocks weather and markets for this farm — not for the phone.',
      cta: 'Mark place',
      route: farm ? `/farm/map?farmId=${farm.id}` : '/(tabs)/farm'
    });
  } else if (place.level === 1) {
    actions.push({
      id: 'shape',
      code: 'FARM_BOUNDARY_MISSING',
      kind: 'EVIDENCE_IMPROVABLE',
      priority: 88,
      relevance: 0.86,
      title: 'Complete your farm boundary',
      why: 'This helps confirm the cultivated area. Added by you until a visit confirms it.',
      cta: 'Map my farm',
      route: farm ? `/farm/map?farmId=${farm.id}` : '/(tabs)/farm'
    });
  } else if (farm && !farm.fieldLook) {
    actions.push({
      id: 'look',
      code: 'FIELD_LOOK_MISSING',
      kind: 'EVIDENCE_IMPROVABLE',
      priority: 70,
      relevance: 0.62,
      title: 'Does this land look planted now?',
      why: 'Your eye checks what a satellite can only guess.',
      cta: 'Tell us',
      route: `/farm/${farm.id}`
    });
  }

  if (!input.enterprises.length) {
    actions.push({
      id: 'enterprise',
      code: 'ENTERPRISE_MISSING',
      kind: 'CONTROLLABLE',
      priority: 92,
      relevance: 0.9,
      title: 'Add what you grow or keep',
      why: 'So weather and markets match dairy, maize, tea or poultry — not a generic farm.',
      cta: 'Add enterprise',
      route: '/(tabs)/farm'
    });
  } else if (!recentRecord && !cycle.recordToday) {
    actions.push({
      id: 'record',
      code: 'PRODUCTION_EVIDENCE_STALE',
      kind: 'EVIDENCE_IMPROVABLE',
      priority: cycle.rhythm === 'seasonal' && (cycle.stage === 'harvesting' || cycle.stage === 'selling') ? 84 : 80,
      relevance: 0.78,
      title: cycle.rhythm === 'seasonal' ? `Add a ${cycle.stage} record` : 'Add your recent production',
      why: 'A fresh harvest, milk or sale keeps the profile current. No points are promised.',
      cta: 'Add record',
      route: '/add'
    });
  }

  if (!input.consents.length && !input.passport?.affiliations.length) {
    actions.push({
      id: 'coop',
      code: 'COOPERATIVE_UNVERIFIED',
      kind: 'EVIDENCE_IMPROVABLE',
      priority: 74,
      relevance: 0.7,
      title: 'Connect your cooperative',
      why: 'They can confirm records you choose to share. This is not a loan offer.',
      cta: 'Connect',
      route: '/connect-institution'
    });
  }

  if (!input.passport?.displayName) {
    actions.push({
      id: 'name',
      code: 'IDENTITY_INCOMPLETE',
      kind: 'CONTROLLABLE',
      priority: 60,
      relevance: 0.55,
      title: 'Add your name',
      why: 'Your Passport needs a name before you share it.',
      cta: 'Open Passport',
      route: '/passport'
    });
  }

  if (input.passport && !input.passport.hasNationalId) {
    actions.push({
      id: 'national-id',
      code: 'NATIONAL_ID_MISSING',
      kind: 'EVIDENCE_IMPROVABLE',
      priority: 58,
      relevance: 0.52,
      title: 'Add your national ID',
      why: 'SACCOs and banks usually match members by ID number. Added by you until verified.',
      cta: 'Open Passport',
      route: '/passport'
    });
  }

  const climateAttention = input.climate?.find((item) => item.tone === 'attention');
  if (climateAttention) {
    actions.push({
      id: 'climate',
      code: 'EXTERNAL_CLIMATE',
      kind: 'EXTERNAL',
      priority: 40,
      relevance: 0.5,
      title: climateAttention.title,
      why: `${climateAttention.interpretation} Keep records current so a partner can see how the farm is doing despite the season.`,
      cta: 'Season',
      route: '/insights/climate'
    });
  }

  return actions.sort((a, b) => b.priority - a.priority);
}

export function actionableTasks(actions: FarmerAction[]) {
  return actions.filter((item) => item.kind === 'CONTROLLABLE' || item.kind === 'EVIDENCE_IMPROVABLE');
}

export function externalNotes(actions: FarmerAction[]) {
  return actions.filter((item) => item.kind === 'EXTERNAL' || item.kind === 'INFORMATIONAL');
}
