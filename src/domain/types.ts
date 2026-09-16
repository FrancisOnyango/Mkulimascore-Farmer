import type { RankedPlace } from '@/domain/places';

export type VerificationState = 'verified' | 'supported' | 'reported' | 'needs_review';
export type SyncState = 'LOCAL' | 'PENDING' | 'SYNCING' | 'SYNCED' | 'RETRY' | 'FAILED' | 'CONFLICT';
export type InsightTone = 'positive' | 'neutral' | 'attention';
export const FARM_SECTORS = [
  'Dairy',
  'Beef',
  'Goats & sheep',
  'Poultry',
  'Pigs',
  'Camels',
  'Livestock',
  'Aquaculture',
  'Beekeeping',
  'Maize',
  'Wheat',
  'Rice',
  'Sorghum',
  'Millet',
  'Beans',
  'Green grams',
  'Cowpeas',
  'Pigeon peas',
  'Groundnuts',
  'Soybean',
  'Irish potatoes',
  'Sweet potatoes',
  'Cassava',
  'Banana',
  'Tomato',
  'Onion',
  'Kale',
  'Cabbage',
  'French beans',
  'Capsicum',
  'Watermelon',
  'Mango',
  'Avocado',
  'Passion fruit',
  'Pineapple',
  'Citrus',
  'Macadamia',
  'Cashew',
  'Coconut',
  'Tea',
  'Coffee',
  'Sugarcane',
  'Cotton',
  'Flowers',
  'Sunflower',
  'Pyrethrum',
  'Other'
] as const;
export type FarmSector = (typeof FARM_SECTORS)[number];
export type OnboardingStep =
  | 'consent'
  | 'identity'
  | 'farm'
  | 'enterprises'
  | 'enterprise_setup'
  | 'institution'
  | 'complete'
  | 'done';
export type SessionKind = 'demo' | 'self_onboarded' | 'returning';
export type FarmTenure = 'owned' | 'family' | 'leased' | 'other';
export type FieldLook = 'planted' | 'mixed' | 'bare';
export type FarmPlaceKind = 'point' | 'polygon';

export interface OnboardingDraft {
  intent: 'new' | 'returning';
  step: OnboardingStep;
  phone?: string;
  displayName?: string;
  nationalId?: string;
  yearOfBirth?: string;
  county?: string;
  language?: 'en' | 'sw';
  farmName?: string;
  farmLocation?: string;
  latitude?: number;
  longitude?: number;
  reportedArea?: string;
  areaUnit?: 'acres' | 'hectares';
  tenure?: FarmTenure;
  addLocationLater?: boolean;
  sectors?: FarmSector[];
  enterpriseDetails?: Partial<Record<FarmSector, Record<string, string>>>;
  institutionChoice?: 'yes' | 'no' | 'later';
  institutionName?: string;
  memberNumber?: string;
  consentVersion?: string;
  consentAcceptedAt?: string;
}

export interface SessionState {
  kind: SessionKind;
  step: OnboardingStep;
  draft: OnboardingDraft | null;
}

export const FARMER_CONSENT_VERSION = 'farmer-app-consent-v1';

export interface Passport {
  msid: string;
  displayName: string;
  phoneMasked: string;
  /** Masked national ID for display. Full ID stays out of Ask context and analytics. */
  nationalIdMasked?: string;
  /** True when the farmer added a national ID (provisional until verified). */
  hasNationalId?: boolean;
  location: string;
  identityVerified: boolean;
  profileStatus: 'good' | 'attention';
  lastUpdated: string;
  readiness: 'ready' | 'attention' | 'not_ready';
  readinessLabel: string;
  affiliations: string[];
  evidenceStatus: string;
  recordFreshness: string;
}

export interface Farm {
  id: string;
  name: string;
  location: string;
  latitude?: number;
  longitude?: number;
  reportedArea: number;
  measuredArea: number | null;
  areaUnit: 'acres' | 'hectares';
  mapped: boolean;
  verification: VerificationState;
  enterprises: string[];
  waterSource?: string;
  irrigation?: string;
  boundary?: { latitude: number; longitude: number }[];
  boundaryCapturedAt?: string | null;
  boundarySource?: 'GPS_WALK' | 'DRAWN' | 'IMPORT' | 'DEMO';
  fieldLook?: FieldLook;
  fieldLookAt?: string | null;
  lastAccuracyM?: number | null;
  /** Farmer-reported exposure for early-warning risk interpretation (architecture §13.1.4). */
  exposure?: {
    nearWaterway?: boolean;
    poorDrainage?: boolean;
    steepSlope?: boolean;
    singleAccessRoad?: boolean;
    fragileStorage?: boolean;
    notedAt?: string | null;
  };
}

export interface FarmerMarketNote {
  id: string;
  farmId: string;
  marketId: string;
  marketName: string;
  commodity: string;
  priceKes: string;
  unit: string;
  notedAt: string;
  source: 'FARMER_APP';
}

export interface Enterprise {
  id: string;
  farmId: string;
  sector: FarmSector;
  name: string;
  primary: boolean;
  summary: string;
  productionMetric: string;
  productionValue: string;
  trendLabel?: string;
  trendPct?: number;
  buyer?: string;
}

export interface Insight {
  id: string;
  kind: 'farm' | 'enterprise' | 'geo' | 'financial';
  title: string;
  value: string;
  explanation: string;
  tone: InsightTone;
  sourceLabel: string;
  updatedAt: string;
  observationPeriod?: string;
  limitation?: string;
  action?: string;
}

export interface EvidenceRecord {
  id: string;
  category: string;
  title: string;
  source: string;
  documentDate: string;
  status: 'draft' | 'queued' | 'uploading' | 'received' | 'processing' | 'verified' | 'needs_review' | 'rejected' | 'failed' | 'replacement_requested';
  localUri?: string | null;
  serverId?: string | null;
  verification: VerificationState;
  associatedFarmId?: string | null;
  associatedEnterpriseId?: string | null;
}

export interface FinancingFacility {
  id: string;
  institution: string;
  status: 'submitted' | 'institution_review' | 'approved' | 'declined' | 'disbursed' | 'active' | 'repaid' | 'restructured';
  amount?: number | null;
  tenorMonths?: number | null;
  nextPaymentDate?: string | null;
  balance?: number | null;
  purpose: string;
  updatedAt: string;
}

export interface FarmerNotification {
  id: string;
  priority: 'action_required' | 'evidence_result' | 'consent' | 'financing_status' | 'profile_freshness' | 'insight_update';
  title: string;
  detail: string;
  deepLink?: string;
  read: boolean;
  createdAt: string;
}

export interface FarmWeather {
  id: string;
  farmId: string;
  farmName: string;
  location: string;
  dayLabel: string;
  temperatureLowC: number;
  temperatureHighC: number;
  rainMm: number;
  rainProbabilityPct: number;
  condition: string;
  windLabel: string;
  forecast: { day: string; condition: string; rainProbabilityPct: number; temperatureHighC: number }[];
  fieldActivityNote: string;
  enterpriseNotes: { enterprise: string; note: string }[];
  updatedAt: string;
  /** Numerical forecast lane metadata — never implies official warning. */
  provider?: 'open_meteo' | 'cached' | 'demo';
  forecastCellId?: string;
  freshness?: 'fresh' | 'stale' | 'unavailable';
  ageMinutes?: number | null;
  sourceDisclaimer?: string;
  features?: {
    rain6hMm?: number | null;
    rain24hMm?: number | null;
    rain72hMm?: number | null;
    rainProb24hPct?: number | null;
    tempMax24hC?: number | null;
  };
}

export interface ClimateSignal {
  id: string;
  farmId: string;
  farmName: string;
  title: string;
  value: string;
  interpretation: string;
  tone: InsightTone;
  period: string;
  sourceLabel: string;
  updatedAt: string;
}

export interface MarketSignal {
  id: string;
  enterpriseId: string;
  enterpriseName: string;
  commodity: string;
  marketScope: string;
  observedPrice: string;
  farmerRecordedPrice?: string | null;
  localRange?: string | null;
  movementLabel: string;
  interpretation: string;
  updatedAt: string;
  dataStatus?: MarketDataStatus;
  sourceLabel?: string;
  fetchedAt?: string;
}

export type MarketDataStatus = 'live' | 'reported' | 'delayed' | 'cached' | 'unavailable';

export interface PersonalizedAlert {
  id: string;
  category: 'weather' | 'climate' | 'market' | 'production' | 'evidence' | 'financing';
  title: string;
  detail: string;
  severity: 'info' | 'attention' | 'urgent';
  relatedEntityLabel: string;
  deepLink?: string;
  createdAt: string;
}

export interface AppSettings {
  lowDataMode: boolean;
  language: 'en' | 'sw';
  marketChangeThresholdPct: number;
  severeWeatherAlerts: boolean;
}

export interface AskMkulimaMessage {
  id: string;
  role: 'farmer' | 'assistant';
  text: string;
  createdAt: string;
  metadata?: AskMkulimaMessageMetadata;
}

export type AskMkulimaIntent =
  | 'weather'
  | 'markets'
  | 'production'
  | 'costs'
  | 'records'
  | 'farm_mapping'
  | 'passport'
  | 'sync'
  | 'next_actions'
  | 'climate'
  | 'alerts'
  | 'chat'
  | 'places'
  | 'draft'
  | 'general';

export interface AskMkulimaSource {
  label: string;
  freshness: string;
  limitation?: string;
}

export interface AskMkulimaMessageMetadata {
  intent: AskMkulimaIntent;
  sources: AskMkulimaSource[];
  recommendations: string[];
  followUps: string[];
  limitations: string[];
  localOnly: boolean;
  confidence: 'high' | 'medium' | 'low';
  requestId?: string;
  model?: string;
  provider?: string;
  latencyMs?: number;
  risk?: import('@/domain/ask').AskRisk;
  draft?: import('@/domain/ask').AskDraft;
}

export interface AskMkulimaContext {
  language?: AppSettings['language'];
  selectedFarmId?: string | null;
  screenContext?: import('@/domain/ask').AskScreenContext;
  passport: Passport | null;
  farms: Farm[];
  enterprises: Enterprise[];
  insights: Insight[];
  records: EvidenceRecord[];
  requests: InstitutionRequest[];
  consents: ConsentGrant[];
  financing: FinancingFacility[];
  outbox: OutboxItem[];
  weather: FarmWeather[];
  climate: ClimateSignal[];
  markets: MarketSignal[];
  alerts: PersonalizedAlert[];
  activity?: ActivityItem[];
  places?: RankedPlace[];
}

export interface InstitutionRequest {
  id: string;
  institution: string;
  title: string;
  reason: string;
  dueDate?: string | null;
  status: 'open' | 'completed' | 'expired' | 'withdrawn';
  items: string[];
}

export interface ConsentGrant {
  id: string;
  institution: string;
  purpose: string;
  status: 'active' | 'expired' | 'revoked' | 'pending';
  grantedAt?: string | null;
  expiresAt?: string | null;
  scopes: string[];
}

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  detail: string;
  occurredAt: string;
}

export interface ProductionSubmission {
  id: string;
  enterpriseId: string;
  metric: string;
  quantity: number;
  unit: string;
  occurredAt: string;
  buyer?: string;
  note?: string;
  provenance: 'FARMER_REPORTED';
}

export interface SaleSubmission {
  id: string;
  enterpriseId: string;
  amount: number;
  currency: 'KES';
  quantity?: number | null;
  unit?: string | null;
  buyer?: string;
  occurredAt: string;
  note?: string;
  provenance: 'FARMER_REPORTED';
}

export interface CostSubmission {
  id: string;
  enterpriseId: string;
  category: string;
  amount: number;
  currency: 'KES';
  occurredAt: string;
  note?: string;
  provenance: 'FARMER_REPORTED';
}

export interface CorrectionSubmission {
  id: string;
  entityType: 'passport' | 'farm' | 'enterprise' | 'record';
  entityId: string;
  field: string;
  currentValue: string;
  proposedValue: string;
  reason: string;
  evidenceUri?: string | null;
  occurredAt: string;
  provenance: 'FARMER_REPORTED';
}

export interface OutboxItem {
  id: string;
  operationType: string;
  payload: string;
  state: SyncState;
  attempts: number;
  idempotencyKey: string;
  dependencyId?: string | null;
  createdAt: string;
  updatedAt: string;
}
