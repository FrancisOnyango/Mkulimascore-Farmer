import type {
  ActivityItem,
  ConsentGrant,
  Enterprise,
  EvidenceRecord,
  Farm,
  FarmSector,
  FinancingFacility,
  Insight,
  InstitutionRequest,
  Passport
} from '@/domain/types';

export interface FarmerProjection {
  msid?: string;
  passport?: Passport;
  farms: Farm[];
  enterprises: Enterprise[];
  insights: Insight[];
  records: EvidenceRecord[];
  requests: InstitutionRequest[];
  consents: ConsentGrant[];
  financing: FinancingFacility[];
  activity: ActivityItem[];
  available: boolean;
}

export function emptyProjection(): FarmerProjection {
  return {
    farms: [],
    enterprises: [],
    insights: [],
    records: [],
    requests: [],
    consents: [],
    financing: [],
    activity: [],
    available: false
  };
}

export function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function readArray(value: unknown, keys: string[] = []): unknown[] {
  if (Array.isArray(value)) return value;
  const object = readObject(value);
  if (!object) return [];
  for (const key of keys) {
    const inner = object[key];
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

export function mapPassport(raw: unknown, fallbackMsid?: string): Passport | undefined {
  const row = readObject(raw);
  if (!row) return undefined;
  const nested = readObject(row.passport) ?? row;
  return {
    msid: str(nested.msid ?? nested.farmer_msid ?? fallbackMsid) ?? '',
    displayName: str(nested.displayName ?? nested.display_name ?? nested.name) ?? '',
    phoneMasked: str(nested.phoneMasked ?? nested.phone_masked ?? nested.phone) ?? '',
    location: str(nested.location) ?? '',
    identityVerified: bool(nested.identityVerified ?? nested.identity_verified),
    profileStatus: nested.profileStatus === 'good' || nested.profile_status === 'good' ? 'good' : 'attention',
    lastUpdated: str(nested.lastUpdated ?? nested.last_updated) ?? new Date().toISOString(),
    readiness: readiness(nested.readiness),
    readinessLabel: str(nested.readinessLabel ?? nested.readiness_label) ?? 'Building your farm profile',
    affiliations: stringList(nested.affiliations),
    evidenceStatus: str(nested.evidenceStatus ?? nested.evidence_status) ?? 'Added by you',
    recordFreshness: str(nested.recordFreshness ?? nested.record_freshness) ?? 'Updated from Mkulima'
  };
}

export function mapFarm(raw: unknown): Farm | null {
  const row = readObject(raw);
  if (!row) return null;
  const id = str(row.id ?? row.farm_id);
  if (!id) return null;
  const reported = num(row.reportedArea ?? row.reported_area) ?? 0;
  const measured = num(row.measuredArea ?? row.measured_area);
  return {
    id,
    name: str(row.name) ?? 'Farm',
    location: str(row.location) ?? '',
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    reportedArea: reported,
    measuredArea: measured ?? null,
    areaUnit: row.areaUnit === 'hectares' || row.area_unit === 'hectares' ? 'hectares' : 'acres',
    mapped: bool(row.mapped),
    verification: verification(row.verification ?? row.verification_state),
    enterprises: stringList(row.enterprises),
    waterSource: str(row.waterSource ?? row.water_source) ?? undefined,
    irrigation: str(row.irrigation) ?? undefined
  };
}

export function mapEnterprise(raw: unknown): Enterprise | null {
  const row = readObject(raw);
  if (!row) return null;
  const id = str(row.id ?? row.enterprise_id);
  if (!id) return null;
  return {
    id,
    farmId: str(row.farmId ?? row.farm_id) ?? '',
    sector: sector(row.sector),
    name: str(row.name) ?? 'Enterprise',
    primary: bool(row.primary),
    summary: str(row.summary) ?? '',
    productionMetric: str(row.productionMetric ?? row.production_metric) ?? 'Current status',
    productionValue: str(row.productionValue ?? row.production_value) ?? 'Added by you',
    trendLabel: str(row.trendLabel ?? row.trend_label) ?? undefined,
    trendPct: num(row.trendPct ?? row.trend_pct),
    buyer: str(row.buyer) ?? undefined
  };
}

export function mapInsight(raw: unknown): Insight | null {
  const row = readObject(raw);
  if (!row) return null;
  const id = str(row.id);
  if (!id) return null;
  const kind = row.kind;
  return {
    id,
    kind: kind === 'enterprise' || kind === 'geo' || kind === 'financial' ? kind : 'farm',
    title: str(row.title) ?? 'Insight',
    value: str(row.value) ?? '',
    explanation: str(row.explanation) ?? '',
    tone: row.tone === 'positive' || row.tone === 'attention' ? row.tone : 'neutral',
    sourceLabel: str(row.sourceLabel ?? row.source_label) ?? 'Mkulima',
    updatedAt: str(row.updatedAt ?? row.updated_at) ?? new Date().toISOString(),
    observationPeriod: str(row.observationPeriod ?? row.observation_period) ?? undefined,
    limitation: str(row.limitation) ?? undefined,
    action: str(row.action) ?? undefined
  };
}

export function mapRecord(raw: unknown): EvidenceRecord | null {
  const row = readObject(raw);
  if (!row) return null;
  const id = str(row.id);
  if (!id) return null;
  return {
    id,
    category: str(row.category) ?? 'Farm',
    title: str(row.title) ?? 'Record',
    source: str(row.source) ?? 'Mkulima',
    documentDate: str(row.documentDate ?? row.document_date) ?? new Date().toISOString(),
    status: recordStatus(row.status),
    localUri: str(row.localUri ?? row.local_uri),
    serverId: str(row.serverId ?? row.server_id),
    verification: verification(row.verification),
    associatedFarmId: str(row.associatedFarmId ?? row.associated_farm_id),
    associatedEnterpriseId: str(row.associatedEnterpriseId ?? row.associated_enterprise_id)
  };
}

export function mapRequest(raw: unknown): InstitutionRequest | null {
  const row = readObject(raw);
  if (!row) return null;
  const id = str(row.id);
  if (!id) return null;
  return {
    id,
    institution: str(row.institution) ?? 'Institution',
    title: str(row.title) ?? 'Request',
    reason: str(row.reason) ?? '',
    dueDate: str(row.dueDate ?? row.due_date),
    status: row.status === 'completed' || row.status === 'expired' || row.status === 'withdrawn' ? row.status : 'open',
    items: stringList(row.items)
  };
}

export function mapConsent(raw: unknown): ConsentGrant | null {
  const row = readObject(raw);
  if (!row) return null;
  const id = str(row.id);
  if (!id) return null;
  return {
    id,
    institution: str(row.institution) ?? 'Institution',
    purpose: str(row.purpose) ?? '',
    status: row.status === 'expired' || row.status === 'revoked' || row.status === 'pending' ? row.status : 'active',
    grantedAt: str(row.grantedAt ?? row.granted_at),
    expiresAt: str(row.expiresAt ?? row.expires_at),
    scopes: stringList(row.scopes)
  };
}

export function mapFinancing(raw: unknown): FinancingFacility | null {
  const row = readObject(raw);
  if (!row) return null;
  const id = str(row.id);
  if (!id) return null;
  return {
    id,
    institution: str(row.institution) ?? 'Institution',
    status: financingStatus(row.status),
    amount: num(row.amount),
    tenorMonths: num(row.tenorMonths ?? row.tenor_months),
    nextPaymentDate: str(row.nextPaymentDate ?? row.next_payment_date),
    balance: num(row.balance),
    purpose: str(row.purpose) ?? '',
    updatedAt: str(row.updatedAt ?? row.updated_at) ?? new Date().toISOString()
  };
}

export function mapActivity(raw: unknown): ActivityItem | null {
  const row = readObject(raw);
  if (!row) return null;
  const id = str(row.id);
  if (!id) return null;
  return {
    id,
    type: str(row.type) ?? 'update',
    title: str(row.title) ?? 'Update',
    detail: str(row.detail) ?? '',
    occurredAt: str(row.occurredAt ?? row.occurred_at) ?? new Date().toISOString()
  };
}

function str(value: unknown) {
  return typeof value === 'string' && value.length ? value : null;
}

function num(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function bool(value: unknown) {
  return value === true || value === 'true' || value === 1;
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function verification(value: unknown) {
  if (value === 'verified' || value === 'supported' || value === 'needs_review') return value;
  return 'reported' as const;
}

function readiness(value: unknown) {
  if (value === 'ready' || value === 'attention' || value === 'not_ready') return value;
  return 'attention' as const;
}

function sector(value: unknown): FarmSector {
  const allowed: FarmSector[] = ['Dairy', 'Maize', 'Coffee', 'Tea', 'Avocado', 'Poultry', 'Rice', 'Irish potatoes', 'Tomato', 'Beans', 'Livestock', 'Aquaculture', 'Macadamia', 'Other'];
  return typeof value === 'string' && (allowed as string[]).includes(value) ? value as FarmSector : 'Other';
}

function recordStatus(value: unknown): EvidenceRecord['status'] {
  const allowed: EvidenceRecord['status'][] = ['draft', 'queued', 'uploading', 'received', 'processing', 'verified', 'needs_review', 'rejected', 'failed', 'replacement_requested'];
  return typeof value === 'string' && (allowed as string[]).includes(value) ? value as EvidenceRecord['status'] : 'received';
}

function financingStatus(value: unknown): FinancingFacility['status'] {
  const allowed: FinancingFacility['status'][] = ['submitted', 'institution_review', 'approved', 'declined', 'disbursed', 'active', 'repaid', 'restructured'];
  return typeof value === 'string' && (allowed as string[]).includes(value) ? value as FinancingFacility['status'] : 'submitted';
}
