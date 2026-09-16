/** Early warning and farm weather intelligence — architecture §13.1 */

export type AlertLevel = 'outlook' | 'watch' | 'warning' | 'observed_impact';
export type AlertStatus = 'active' | 'acknowledged' | 'expired' | 'cancelled';
export type HazardType =
  | 'heavy_rain'
  | 'flash_flood'
  | 'flood'
  | 'drought'
  | 'heat'
  | 'wind'
  | 'landslide'
  | 'cold'
  | 'lightning'
  | 'seasonal_shift';

export type AlertAuthority =
  | 'MKULIMA_PREPAREDNESS'
  | 'KMD'
  | 'NDMA'
  | 'ICPAC'
  | 'COUNTY'
  | 'OTHER_OFFICIAL';

export type AlertOrigin =
  | 'official_warning'
  | 'model_derived_watch'
  | 'field_observation'
  | 'farmer_report'
  | 'combined_assessment';

export type FarmerAlert = {
  id: string;
  farmId: string;
  farmName: string;
  enterpriseId?: string;
  level: AlertLevel;
  hazardType: HazardType;
  title: string;
  plainLanguageMessage: string;
  actions: { id: string; label: string; detail: string }[];
  source: AlertAuthority;
  sourceLabel: string;
  officialWarning: boolean;
  alertOrigin?: AlertOrigin;
  issuedAt: string;
  validUntil: string;
  status: AlertStatus;
  cancellationReason?: string;
  acknowledgedAt?: string | null;
  selectedActionId?: string | null;
  language: 'en' | 'sw';
};

export type ImpactCase = {
  id: string;
  alertId?: string;
  farmId: string;
  enterpriseId?: string;
  impactType: 'crop' | 'livestock' | 'storage' | 'access' | 'infrastructure' | 'other';
  quantity?: string;
  narrative: string;
  safeToAssess: boolean;
  provisionalStatus: 'PROVISIONAL';
  createdAt: string;
  evidenceUri?: string | null;
};

export type FarmExposure = {
  nearWaterway?: boolean;
  poorDrainage?: boolean;
  steepSlope?: boolean;
  singleAccessRoad?: boolean;
  fragileStorage?: boolean;
};
