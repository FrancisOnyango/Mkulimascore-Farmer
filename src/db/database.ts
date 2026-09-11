import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import type {
  ActivityItem,
  AppSettings,
  AskMkulimaMessage,
  ConsentGrant,
  CostSubmission,
  CorrectionSubmission,
  Enterprise,
  EvidenceRecord,
  FarmerNotification,
  FinancingFacility,
  Farm,
  FarmWeather,
  Insight,
  InstitutionRequest,
  ClimateSignal,
  MarketSignal,
  OnboardingDraft,
  OnboardingStep,
  OutboxItem,
  Passport,
  PersonalizedAlert,
  SaleSubmission,
  SessionKind,
  SessionState,
  ProductionSubmission
} from '@/domain/types';
import { FARMER_CONSENT_VERSION } from '@/domain/types';
import { maskPhone } from '@/lib/phone/kenya';
import { summarizeEnterprise } from '@/lib/onboarding/enterprises';
import type { FarmerProjection } from '@/lib/api/projection';
import { setStoredMsid } from '@/lib/session/sessionStore';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDb() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('mkulima-farmer.db');
  }
  return databasePromise;
}

export async function initDb() {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS passport (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS farms (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS enterprises (
      id TEXT PRIMARY KEY NOT NULL,
      farm_id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS insights (
      id TEXT PRIMARY KEY NOT NULL,
      kind TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS consents (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS activity (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      occurred_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS financing (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS weather (
      id TEXT PRIMARY KEY NOT NULL,
      farm_id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS climate (
      id TEXT PRIMARY KEY NOT NULL,
      farm_id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS markets (
      id TEXT PRIMARY KEY NOT NULL,
      enterprise_id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS personalized_alerts (
      id TEXT PRIMARY KEY NOT NULL,
      category TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ask_mkulima_messages (
      id TEXT PRIMARY KEY NOT NULL,
      role TEXT NOT NULL,
      text TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS production_submissions (
      id TEXT PRIMARY KEY NOT NULL,
      enterprise_id TEXT NOT NULL,
      data TEXT NOT NULL,
      sync_state TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS farmer_submissions (
      id TEXT PRIMARY KEY NOT NULL,
      submission_type TEXT NOT NULL,
      entity_id TEXT,
      data TEXT NOT NULL,
      sync_state TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY NOT NULL,
      operation_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      state TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      idempotency_key TEXT,
      dependency_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await migrateOutboxContract(db);
  await migrateAskMkulimaMessages(db);

  const seed = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_metadata WHERE key = ?', ['seeded']);
  if (!seed) {
    await seedDemoData(db);
    await db.runAsync('INSERT INTO app_metadata (key, value) VALUES (?, ?)', 'seeded', '1');
  }
  await ensureDemoFarmBoundaries(db);
  await ensureDemoIntelligence(db);
}

async function migrateOutboxContract(db: SQLite.SQLiteDatabase) {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(outbox)');
  const names = new Set(columns.map((column) => column.name));
  if (!names.has('idempotency_key')) {
    await db.execAsync('ALTER TABLE outbox ADD COLUMN idempotency_key TEXT');
  }

  if (!names.has('dependency_id')) {
    await db.execAsync('ALTER TABLE outbox ADD COLUMN dependency_id TEXT');
  }
  const rows = await db.getAllAsync<{ id: string; state: string; idempotency_key: string | null }>(
    'SELECT id, state, idempotency_key FROM outbox'
  );
  for (const row of rows) {
    await db.runAsync(
      'UPDATE outbox SET state = ?, idempotency_key = ? WHERE id = ?',
      normalizeOutboxState(row.state),
      row.idempotency_key ?? row.id,
      row.id
    );
  }
}

async function migrateAskMkulimaMessages(db: SQLite.SQLiteDatabase) {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(ask_mkulima_messages)');
  if (!columns.some((column) => column.name === 'metadata')) {
    await db.execAsync('ALTER TABLE ask_mkulima_messages ADD COLUMN metadata TEXT');
  }
}

function normalizeOutboxState(state: string): OutboxItem['state'] {
  const upper = state.toUpperCase();
  if (
    upper === 'LOCAL' ||
    upper === 'PENDING' ||
    upper === 'SYNCING' ||
    upper === 'SYNCED' ||
    upper === 'RETRY' ||
    upper === 'FAILED' ||
    upper === 'CONFLICT'
  ) {
    return upper;
  }
  return 'PENDING';
}

async function upsertJson(db: SQLite.SQLiteDatabase, table: string, id: string, data: unknown, extra?: Record<string, string>) {
  const now = new Date().toISOString();
  const json = JSON.stringify(data);
  if (table === 'farms' || table === 'evidence' || table === 'requests' || table === 'consents' || table === 'financing') {
    await db.runAsync(`INSERT OR REPLACE INTO ${table} (id, data, updated_at) VALUES (?, ?, ?)`, id, json, now);
    return;
  }
  if (table === 'weather' || table === 'climate') {
    await db.runAsync(`INSERT OR REPLACE INTO ${table} (id, farm_id, data, updated_at) VALUES (?, ?, ?, ?)`, id, extra?.farmId ?? '', json, now);
    return;
  }
  if (table === 'markets') {
    await db.runAsync('INSERT OR REPLACE INTO markets (id, enterprise_id, data, updated_at) VALUES (?, ?, ?, ?)', id, extra?.enterpriseId ?? '', json, now);
    return;
  }
  if (table === 'enterprises') {
    await db.runAsync(`INSERT OR REPLACE INTO enterprises (id, farm_id, data, updated_at) VALUES (?, ?, ?, ?)`, id, extra?.farmId ?? '', json, now);
    return;
  }
  if (table === 'insights') {
    await db.runAsync(`INSERT OR REPLACE INTO insights (id, kind, data, updated_at) VALUES (?, ?, ?, ?)`, id, extra?.kind ?? 'farm', json, now);
  }
  if (table === 'notifications') {
    await db.runAsync('INSERT OR REPLACE INTO notifications (id, data, created_at) VALUES (?, ?, ?)', id, json, extra?.createdAt ?? now);
  }
  if (table === 'personalized_alerts') {
    await db.runAsync('INSERT OR REPLACE INTO personalized_alerts (id, category, data, created_at) VALUES (?, ?, ?, ?)', id, extra?.category ?? 'weather', json, extra?.createdAt ?? now);
  }
}

async function ensureDemoIntelligence(db: SQLite.SQLiteDatabase) {
  const existing = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM weather');
  if ((existing?.count ?? 0) > 0) return;
  const now = new Date().toISOString();
  const weather: FarmWeather[] = [
    {
      id: 'weather-home-today',
      farmId: 'farm-home',
      farmName: 'Home Farm',
      location: 'Githunguri, Kiambu',
      dayLabel: 'Today',
      temperatureLowC: 18,
      temperatureHighC: 24,
      rainMm: 7.4,
      rainProbabilityPct: 78,
      condition: 'Rain likely this afternoon',
      windLabel: 'Moderate',
      forecast: [
        { day: 'SUN', condition: 'Rain', rainProbabilityPct: 78, temperatureHighC: 24 },
        { day: 'MON', condition: 'Heavy rain', rainProbabilityPct: 84, temperatureHighC: 23 },
        { day: 'TUE', condition: 'Showers', rainProbabilityPct: 61, temperatureHighC: 24 },
        { day: 'WED', condition: 'Cloudy', rainProbabilityPct: 38, temperatureHighC: 25 },
        { day: 'THU', condition: 'Bright', rainProbabilityPct: 22, temperatureHighC: 26 }
      ],
      fieldActivityNote: 'Heavy rainfall is possible tomorrow afternoon. Plan field work earlier in the day where possible.',
      enterpriseNotes: [
        { enterprise: 'Dairy', note: 'Heat-stress risk is low today.' },
        { enterprise: 'Maize', note: 'Rainfall conditions remain favorable for the current production period.' }
      ],
      updatedAt: now
    }
  ];

  const climate: ClimateSignal[] = [
    {
      id: 'climate-rain-season',
      farmId: 'farm-home',
      farmName: 'Home Farm',
      title: 'Seasonal rainfall',
      value: '11% below average',
      interpretation: 'The current season is slightly drier than the recent seasonal pattern for this farm area.',
      tone: 'attention',
      period: 'Current season',
      sourceLabel: 'Farm polygon climate context',
      updatedAt: now
    },
    {
      id: 'climate-vegetation',
      farmId: 'farm-home',
      farmName: 'Home Farm',
      title: 'Vegetation condition',
      value: 'Stable',
      interpretation: 'Vegetation signals remain broadly stable over the mapped farm boundary.',
      tone: 'positive',
      period: 'Last 30 days',
      sourceLabel: 'Satellite-derived vegetation context',
      updatedAt: now
    },
    {
      id: 'climate-dry-spell',
      farmId: 'farm-home',
      farmName: 'Home Farm',
      title: 'Dry-spell risk',
      value: 'Moderate',
      interpretation: 'Rainfall has been below the recent seasonal range for part of the current period.',
      tone: 'neutral',
      period: 'Last 18 days',
      sourceLabel: 'Rainfall anomaly context',
      updatedAt: now
    }
  ];

  const markets: MarketSignal[] = [
    {
      id: 'market-dairy',
      enterpriseId: 'ent-dairy',
      enterpriseName: 'Dairy enterprise',
      commodity: 'Milk',
      marketScope: 'Githunguri reference buyers',
      observedPrice: 'KES 54/L',
      farmerRecordedPrice: 'KES 51/L',
      localRange: 'KES 48-57/L',
      movementLabel: 'Within local range',
      interpretation: 'Your latest recorded milk price remains within the local observed range.',
      updatedAt: now
    },
    {
      id: 'market-maize',
      enterpriseId: 'ent-maize',
      enterpriseName: 'Maize enterprise',
      commodity: 'Maize',
      marketScope: 'Nearby market indication',
      observedPrice: 'KES 4,180 / 90 kg bag',
      farmerRecordedPrice: null,
      localRange: 'KES 3,950-4,350 / bag',
      movementLabel: 'Up 3.2% over 7 days',
      interpretation: 'Reference market prices have strengthened slightly over the last week.',
      updatedAt: now
    }
  ];

  const alerts: PersonalizedAlert[] = [
    {
      id: 'alert-rainfall',
      category: 'weather',
      title: 'Rainfall alert',
      detail: 'Heavy rainfall is possible tomorrow afternoon for Home Farm.',
      severity: 'attention',
      relatedEntityLabel: 'Home Farm',
      deepLink: '/insights/weather',
      createdAt: '2026-08-29T16:00:00+03:00'
    },
    {
      id: 'alert-market-milk',
      category: 'market',
      title: 'Milk price context',
      detail: 'Your latest recorded milk price is within the observed local range.',
      severity: 'info',
      relatedEntityLabel: 'Dairy',
      deepLink: '/insights/markets',
      createdAt: '2026-08-29T10:30:00+03:00'
    },
    {
      id: 'alert-evidence-freshness',
      category: 'evidence',
      title: 'Milk statement freshness',
      detail: 'Your latest verified milk statement is 16 days old. Keep it current for financing readiness.',
      severity: 'info',
      relatedEntityLabel: 'Records',
      deepLink: '/records/ev-milk-aug',
      createdAt: '2026-08-29T08:30:00+03:00'
    }
  ];

  for (const item of weather) await upsertJson(db, 'weather', item.id, item, { farmId: item.farmId });
  for (const item of climate) await upsertJson(db, 'climate', item.id, item, { farmId: item.farmId });
  for (const item of markets) await upsertJson(db, 'markets', item.id, item, { enterpriseId: item.enterpriseId });
  for (const item of alerts) await upsertJson(db, 'personalized_alerts', item.id, item, { category: item.category, createdAt: item.createdAt });
}

async function ensureDemoFarmBoundaries(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM farms WHERE id = ?', ['farm-home']);
  if (!row) return;
  const farm = JSON.parse(row.data) as Farm;
  if (farm.boundary?.length) return;
  const updated: Farm = {
    ...farm,
    boundary: [
      { latitude: -1.0768, longitude: 36.7789 },
      { latitude: -1.0758, longitude: 36.7812 },
      { latitude: -1.0782, longitude: 36.7821 },
      { latitude: -1.0791, longitude: 36.7797 }
    ],
    boundaryCapturedAt: '2026-08-07T10:20:00+03:00',
    boundarySource: 'DEMO'
  };
  await upsertJson(db, 'farms', updated.id, updated);
}

async function seedDemoData(db: SQLite.SQLiteDatabase) {
  const now = new Date().toISOString();
  const passport: Passport = {
    msid: 'MS-KE-DEMO-004829',
    displayName: 'Mary Wanjiku',
    phoneMasked: '07** *** 284',
    location: 'Githunguri, Kiambu',
    identityVerified: true,
    profileStatus: 'good',
    lastUpdated: now,
    readiness: 'ready',
    readinessLabel: 'Ready for assessment',
    affiliations: ['Githunguri Dairy Cooperative', 'Demo SACCO'],
    evidenceStatus: 'Strong verified evidence',
    recordFreshness: 'Updated this month'
  };
  await db.runAsync('INSERT OR REPLACE INTO passport (id, data, updated_at) VALUES (1, ?, ?)', JSON.stringify(passport), now);

  const farms: Farm[] = [
    {
      id: 'farm-home',
      name: 'Home Farm',
      location: 'Githunguri, Kiambu',
      latitude: -1.0776,
      longitude: 36.7801,
      reportedArea: 2.5,
      measuredArea: 2.38,
      areaUnit: 'acres',
      mapped: true,
      verification: 'verified',
      enterprises: ['Dairy', 'Maize'],
      waterSource: 'Piped + rainwater',
      irrigation: 'Partial',
      boundary: [
        { latitude: -1.0768, longitude: 36.7789 },
        { latitude: -1.0758, longitude: 36.7812 },
        { latitude: -1.0782, longitude: 36.7821 },
        { latitude: -1.0791, longitude: 36.7797 }
      ],
      boundaryCapturedAt: '2026-08-07T10:20:00+03:00',
      boundarySource: 'DEMO'
    },
    {
      id: 'farm-avocado',
      name: 'Upper Plot',
      location: 'Githunguri, Kiambu',
      latitude: -1.0728,
      longitude: 36.7864,
      reportedArea: 0.8,
      measuredArea: null,
      areaUnit: 'acres',
      mapped: false,
      verification: 'reported',
      enterprises: ['Avocado'],
      boundary: undefined,
      boundaryCapturedAt: null,
      boundarySource: undefined
    }
  ];
  for (const farm of farms) await upsertJson(db, 'farms', farm.id, farm);

  const enterprises: Enterprise[] = [
    {
      id: 'ent-dairy',
      farmId: 'farm-home',
      sector: 'Dairy',
      name: 'Dairy enterprise',
      primary: true,
      summary: '12 cattle - 7 lactating',
      productionMetric: 'Current average',
      productionValue: '62 L/day',
      trendLabel: 'since May',
      trendPct: 8.8,
      buyer: 'Githunguri Dairy Cooperative'
    },
    {
      id: 'ent-maize',
      farmId: 'farm-home',
      sector: 'Maize',
      name: 'Maize enterprise',
      primary: false,
      summary: '1.2 acres - Long Rains 2026',
      productionMetric: 'Current cycle',
      productionValue: 'Growing',
      buyer: 'Local market'
    },
    {
      id: 'ent-avocado',
      farmId: 'farm-avocado',
      sector: 'Avocado',
      name: 'Avocado enterprise',
      primary: false,
      summary: '82 trees - farmer-reported',
      productionMetric: 'Current stage',
      productionValue: 'Flowering',
      buyer: 'Broker and local market'
    },
    {
      id: 'ent-coffee',
      farmId: 'farm-home',
      sector: 'Coffee',
      name: 'Coffee enterprise',
      primary: false,
      summary: '0.4 acres - main crop season',
      productionMetric: 'Season delivered',
      productionValue: '410 kg cherry',
      buyer: 'Demo Coffee Factory'
    },
    {
      id: 'ent-tea',
      farmId: 'farm-home',
      sector: 'Tea',
      name: 'Tea enterprise',
      primary: false,
      summary: 'Green leaf delivery history',
      productionMetric: 'Last month',
      productionValue: '286 kg green leaf',
      buyer: 'Demo Tea Buying Centre'
    },
    {
      id: 'ent-poultry',
      farmId: 'farm-avocado',
      sector: 'Poultry',
      name: 'Poultry enterprise',
      primary: false,
      summary: '120 layers - 86 eggs/day',
      productionMetric: 'Current flock',
      productionValue: '120 birds',
      buyer: 'Local buyers'
    }
  ];
  for (const enterprise of enterprises) await upsertJson(db, 'enterprises', enterprise.id, enterprise, { farmId: enterprise.farmId });

  const insights: Insight[] = [
    {
      id: 'ins-prod',
      kind: 'enterprise',
      title: 'Milk production trend',
      value: '+8.8%',
      explanation: 'Recorded milk output has improved compared with the recent baseline.',
      tone: 'positive',
      sourceLabel: 'Based on available production records',
      updatedAt: now,
      action: 'View dairy performance'
    },
    {
      id: 'ins-rain',
      kind: 'geo',
      title: 'Rainfall context',
      value: 'Near seasonal range',
      explanation: 'Recent rainfall over your mapped farm is close to the recent seasonal pattern.',
      tone: 'neutral',
      sourceLabel: 'Location-based environmental context',
      updatedAt: now,
      observationPeriod: 'Last 30 days',
      limitation: 'Location-based context is informational and should be compared with field observation.'
    },
    {
      id: 'ins-veg',
      kind: 'geo',
      title: 'Vegetation condition',
      value: 'Stable',
      explanation: 'Vegetation conditions over the mapped farm have remained broadly stable recently.',
      tone: 'positive',
      sourceLabel: 'Satellite-derived farm context',
      updatedAt: now,
      observationPeriod: 'Recent seasonal pattern',
      limitation: 'Satellite signals can be affected by cloud cover and farm boundary quality.'
    },
    {
      id: 'ins-cost',
      kind: 'financial',
      title: 'Cost records',
      value: 'Needs updating',
      explanation: 'Your latest feed cost record is more than 60 days old. Updating it will improve your enterprise economics view.',
      tone: 'attention',
      sourceLabel: 'Mkulima Passport data freshness',
      updatedAt: now,
      action: 'Add cost record'
    },
    {
      id: 'ins-farm-map',
      kind: 'farm',
      title: 'Farm mapping',
      value: 'One farm mapped',
      explanation: 'Your Home Farm has a measured boundary. Map Upper Plot to unlock area verification and location-based insights for that farm.',
      tone: 'attention',
      sourceLabel: 'Mkulima Passport farm records',
      updatedAt: now,
      action: 'Request profile correction'
    },
    {
      id: 'ins-econ-unlock',
      kind: 'financial',
      title: 'Enterprise economics',
      value: 'Needs cost records',
      explanation: 'Based on the records available, production history is useful but costs are not fresh enough for a complete enterprise economics view.',
      tone: 'attention',
      sourceLabel: 'Based on available farmer and cooperative records',
      updatedAt: now,
      action: 'Add cost record'
    }
  ];
  for (const insight of insights) await upsertJson(db, 'insights', insight.id, insight, { kind: insight.kind });

  const evidence: EvidenceRecord[] = [
    {
      id: 'ev-milk-aug',
      category: 'Production',
      title: 'August milk statement',
      source: 'Githunguri Dairy Cooperative',
      documentDate: '2026-08-14T08:00:00+03:00',
      status: 'verified',
      verification: 'verified',
      localUri: null,
      serverId: 'DEMO-EV-001'
    },
    {
      id: 'ev-vet-jul',
      category: 'Veterinary',
      title: 'Veterinary record',
      source: 'Farmer upload',
      documentDate: '2026-07-22T08:00:00+03:00',
      status: 'verified',
      verification: 'supported',
      localUri: null,
      serverId: 'DEMO-EV-002'
    },
    {
      id: 'ev-input',
      category: 'Inputs',
      title: 'Feed purchase receipt',
      source: 'Farmer upload',
      documentDate: '2026-06-10T08:00:00+03:00',
      status: 'needs_review',
      verification: 'reported',
      localUri: null,
      serverId: 'DEMO-EV-003'
    }
  ];
  for (const item of evidence) await upsertJson(db, 'evidence', item.id, item);

  const requests: InstitutionRequest[] = [
    {
      id: 'req-latest-milk',
      institution: 'Demo SACCO',
      title: 'Latest milk delivery statement',
      reason: 'To complete your current agricultural financing assessment.',
      dueDate: '2026-09-02T17:00:00+03:00',
      status: 'open',
      items: ['Latest milk delivery statement']
    }
  ];
  for (const item of requests) await upsertJson(db, 'requests', item.id, item);

  const consents: ConsentGrant[] = [
    {
      id: 'consent-demo',
      institution: 'Demo SACCO',
      purpose: 'Agricultural credit assessment',
      status: 'active',
      grantedAt: '2026-08-12T09:00:00+03:00',
      expiresAt: '2026-11-12T09:00:00+03:00',
      scopes: ['Identity', 'Farm information', 'Production history', 'Approved financial evidence']
    }
  ];
  for (const item of consents) await upsertJson(db, 'consents', item.id, item);

  const financing: FinancingFacility[] = [
    {
      id: 'facility-demo-1',
      institution: 'Demo SACCO',
      status: 'institution_review',
      amount: null,
      tenorMonths: null,
      nextPaymentDate: null,
      balance: null,
      purpose: 'Dairy working capital assessment',
      updatedAt: '2026-08-27T14:00:00+03:00'
    }
  ];
  for (const item of financing) await upsertJson(db, 'financing', item.id, item);

  const notifications: FarmerNotification[] = [
    {
      id: 'notif-request',
      priority: 'action_required',
      title: 'Milk statement requested',
      detail: 'Demo SACCO requested your latest milk delivery statement.',
      deepLink: '/request/req-latest-milk',
      read: false,
      createdAt: '2026-08-28T09:00:00+03:00'
    },
    {
      id: 'notif-evidence',
      priority: 'evidence_result',
      title: 'Record verified',
      detail: 'Your August milk statement has been verified.',
      deepLink: '/records/ev-milk-aug',
      read: false,
      createdAt: '2026-08-28T08:20:00+03:00'
    }
  ];
  for (const item of notifications) await upsertJson(db, 'notifications', item.id, item, { createdAt: item.createdAt });

  const activity: ActivityItem[] = [
    { id: 'act-1', type: 'evidence', title: 'Milk statement verified', detail: 'August milk statement', occurredAt: '2026-08-28T08:20:00+03:00' },
    { id: 'act-2', type: 'production', title: 'Production updated', detail: '62 litres/day recent average', occurredAt: '2026-08-25T17:30:00+03:00' },
    { id: 'act-3', type: 'consent', title: 'Assessment permission granted', detail: 'Demo SACCO', occurredAt: '2026-08-12T09:00:00+03:00' }
  ];
  for (const item of activity) {
    await db.runAsync('INSERT OR REPLACE INTO activity (id, data, occurred_at) VALUES (?, ?, ?)', item.id, JSON.stringify(item), item.occurredAt);
  }
}

async function listJson<T>(table: string, orderBy = 'updated_at DESC'): Promise<T[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ data: string }>(`SELECT data FROM ${table} ORDER BY ${orderBy}`);
  return rows.map((r) => JSON.parse(r.data) as T);
}

export async function getPassport() {
  const db = await getDb();
  const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM passport WHERE id = 1');
  return row ? (JSON.parse(row.data) as Passport) : null;
}

export const listFarms = () => listJson<Farm>('farms');
export const listEnterprises = () => listJson<Enterprise>('enterprises');
export const listInsights = () => listJson<Insight>('insights');
export const listEvidence = () => listJson<EvidenceRecord>('evidence');
export const listRequests = () => listJson<InstitutionRequest>('requests');
export const listConsents = () => listJson<ConsentGrant>('consents');
export const listActivity = () => listJson<ActivityItem>('activity', 'occurred_at DESC');
export const listFinancing = () => listJson<FinancingFacility>('financing');
export const listNotifications = () => listJson<FarmerNotification>('notifications', 'created_at DESC');
export async function markNotificationRead(id: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM notifications WHERE id = ?', id);
  if (!row) return;
  const notification = JSON.parse(row.data) as FarmerNotification;
  if (notification.read) return;
  await db.runAsync('UPDATE notifications SET data = ? WHERE id = ?', JSON.stringify({ ...notification, read: true }), id);
}

export async function markAllNotificationsRead() {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; data: string }>('SELECT id, data FROM notifications');
  await Promise.all(rows.map(async (row) => {
    const notification = JSON.parse(row.data) as FarmerNotification;
    if (!notification.read) {
      await db.runAsync('UPDATE notifications SET data = ? WHERE id = ?', JSON.stringify({ ...notification, read: true }), row.id);
    }
  }));
}
export const listWeather = () => listJson<FarmWeather>('weather');
export async function saveWeather(item: FarmWeather) {
  const db = await getDb();
  await upsertJson(db, 'weather', item.id, item, { farmId: item.farmId });
}
export const listClimate = () => listJson<ClimateSignal>('climate');
export const listMarkets = () => listJson<MarketSignal>('markets');
export async function saveMarket(item: MarketSignal) {
  const db = await getDb();
  await upsertJson(db, 'markets', item.id, item, { enterpriseId: item.enterpriseId });
}
export const listPersonalizedAlerts = () => listJson<PersonalizedAlert>('personalized_alerts', 'created_at DESC');

export async function listAskMkulimaMessages(): Promise<AskMkulimaMessage[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<AskMkulimaMessage & { metadataJson?: string | null }>(
    'SELECT id, role, text, metadata as metadataJson, created_at as createdAt FROM ask_mkulima_messages ORDER BY created_at ASC'
  );
  return rows.map(({ metadataJson, ...message }) => {
    if (!metadataJson) return message;
    try {
      return { ...message, metadata: JSON.parse(metadataJson) };
    } catch {
      // A malformed optional metadata field must not hide the conversation.
      return message;
    }

  });
}

export async function searchAskMkulimaMessages(query: string): Promise<AskMkulimaMessage[]> {
  const messages = await listAskMkulimaMessages();
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return messages;
  return messages.filter((message) => message.text.toLocaleLowerCase().includes(normalized));
}

export async function addAskMkulimaMessage(input: Omit<AskMkulimaMessage, 'id' | 'createdAt'>) {
  const db = await getDb();
  const id = Crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const message: AskMkulimaMessage = { ...input, id, createdAt };
  await db.runAsync(
    'INSERT INTO ask_mkulima_messages (id, role, text, metadata, created_at) VALUES (?, ?, ?, ?, ?)',
    id,
    input.role,
    input.text,
    input.metadata ? JSON.stringify(input.metadata) : null,
    createdAt
  );
  return message;
}

export async function deleteAskMkulimaMessage(id: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM ask_mkulima_messages WHERE id = ?', id);
}

export async function deleteAllAskMkulimaMessages() {
  const db = await getDb();
  await db.runAsync('DELETE FROM ask_mkulima_messages');
}

export async function getSettings(): Promise<AppSettings> {
  const db = await getDb();
  const lowData = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_metadata WHERE key = ?', ['low_data_mode']);
  const language = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_metadata WHERE key = ?', ['language']);
  const threshold = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_metadata WHERE key = ?', ['market_change_threshold_pct']);
  const severeWeatherAlerts = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_metadata WHERE key = ?', ['severe_weather_alerts']);
  const parsedThreshold = Number(threshold?.value);
  return {
    lowDataMode: lowData?.value === '1',
    language: language?.value === 'sw' ? 'sw' : 'en',
    marketChangeThresholdPct: Number.isFinite(parsedThreshold) && parsedThreshold > 0 ? parsedThreshold : 2,
    severeWeatherAlerts: severeWeatherAlerts?.value !== '0'
  };
}

export async function setLowDataMode(enabled: boolean) {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)',
    'low_data_mode',
    enabled ? '1' : '0'
  );
}

export async function setLanguage(language: AppSettings['language']) {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)', 'language', language);
}

export async function setMarketChangeThresholdPct(value: number) {
  const db = await getDb();
  const threshold = Math.min(100, Math.max(0.1, value));
  await db.runAsync('INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)', 'market_change_threshold_pct', String(threshold));
}

export async function setSevereWeatherAlerts(enabled: boolean) {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)', 'severe_weather_alerts', enabled ? '1' : '0');
}

export async function getFormDraft<T>(key: string): Promise<T | null> {
  await initDb();
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_metadata WHERE key = ?', [`form_draft:${key}`]);
  return row ? (JSON.parse(row.value) as T) : null;
}

export async function saveFormDraft(key: string, value: unknown) {
  await initDb();
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)',
    `form_draft:${key}`,
    JSON.stringify(value)
  );
}

export async function clearFormDraft(key: string) {
  await initDb();
  const db = await getDb();
  await db.runAsync('DELETE FROM app_metadata WHERE key = ?', [`form_draft:${key}`]);
}

export async function getFarm(id: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM farms WHERE id = ?', [id]);
  return row ? (JSON.parse(row.data) as Farm) : null;
}

export async function getEnterprise(id: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM enterprises WHERE id = ?', [id]);
  return row ? (JSON.parse(row.data) as Enterprise) : null;
}

export async function getRequest(id: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM requests WHERE id = ?', [id]);
  return row ? (JSON.parse(row.data) as InstitutionRequest) : null;
}

export async function getEvidenceRecord(id: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM evidence WHERE id = ?', [id]);
  return row ? (JSON.parse(row.data) as EvidenceRecord) : null;
}

export async function addProductionSubmission(input: Omit<ProductionSubmission, 'id' | 'provenance'>) {
  const db = await getDb();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  const submission: ProductionSubmission = { ...input, id, provenance: 'FARMER_REPORTED' };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO production_submissions (id, enterprise_id, data, sync_state, created_at) VALUES (?, ?, ?, ?, ?)',
      id,
      input.enterpriseId,
      JSON.stringify(submission),
      'PENDING',
      now
    );
    const activity: ActivityItem = {
      id: Crypto.randomUUID(),
      type: 'production',
      title: 'Production update saved',
      detail: `${input.quantity} ${input.unit} - Farmer reported`,
      occurredAt: now
    };
    await db.runAsync('INSERT INTO activity (id, data, occurred_at) VALUES (?, ?, ?)', activity.id, JSON.stringify(activity), now);
    await enqueueOutbox(db, 'FARMER_PRODUCTION_SUBMITTED', submission);
  });
  return submission;
}

export async function addSaleSubmission(input: Omit<SaleSubmission, 'id' | 'provenance'>) {
  const db = await getDb();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  const submission: SaleSubmission = { ...input, id, provenance: 'FARMER_REPORTED' };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO farmer_submissions (id, submission_type, entity_id, data, sync_state, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      'sale',
      input.enterpriseId,
      JSON.stringify(submission),
      'PENDING',
      now
    );
    await addActivity(db, 'sale', 'Sale saved', `${input.amount} KES - Farmer reported`, now);
    await enqueueOutbox(db, 'FARMER_SALE_SUBMITTED', submission);
  });
  return submission;
}

export async function addCostSubmission(input: Omit<CostSubmission, 'id' | 'provenance'>) {
  const db = await getDb();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  const submission: CostSubmission = { ...input, id, provenance: 'FARMER_REPORTED' };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO farmer_submissions (id, submission_type, entity_id, data, sync_state, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      'cost',
      input.enterpriseId,
      JSON.stringify(submission),
      'PENDING',
      now
    );
    await addActivity(db, 'cost', 'Cost saved', `${input.category} - ${input.amount} KES`, now);
    await enqueueOutbox(db, 'FARMER_COST_SUBMITTED', submission);
  });
  return submission;
}

export async function addCorrectionSubmission(input: Omit<CorrectionSubmission, 'id' | 'provenance' | 'occurredAt'>) {
  const db = await getDb();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  const submission: CorrectionSubmission = { ...input, id, occurredAt: now, provenance: 'FARMER_REPORTED' };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO farmer_submissions (id, submission_type, entity_id, data, sync_state, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      'correction',
      input.entityId,
      JSON.stringify(submission),
      'PENDING',
      now
    );
    await addActivity(db, 'correction', 'Correction request saved', `${input.field}: ${input.proposedValue}`, now);
    await enqueueOutbox(db, 'FARMER_CORRECTION_SUBMITTED', submission);
  });
  return submission;
}

export async function addEvidenceRecord(input: Omit<EvidenceRecord, 'id' | 'status' | 'verification' | 'serverId'>) {
  const db = await getDb();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  const record: EvidenceRecord = {
    ...input,
    id,
    status: 'queued',
    verification: 'reported',
    serverId: null
  };
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT INTO evidence (id, data, updated_at) VALUES (?, ?, ?)', id, JSON.stringify(record), now);
    await enqueueOutbox(db, 'FARMER_EVIDENCE_SUBMITTED', record, id);
    const activity: ActivityItem = {
      id: Crypto.randomUUID(),
      type: 'evidence',
      title: 'Record added',
      detail: input.title,
      occurredAt: now
    };
    await db.runAsync('INSERT INTO activity (id, data, occurred_at) VALUES (?, ?, ?)', activity.id, JSON.stringify(activity), now);
  });
  return record;
}

export async function updateEvidenceRecordStatus(id: string, status: EvidenceRecord['status']) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM evidence WHERE id = ?', [id]);
  if (!row) return null;
  const now = new Date().toISOString();
  const current = JSON.parse(row.data) as EvidenceRecord;
  const updated: EvidenceRecord = {
    ...current,
    status,
    verification: status === 'verified' ? 'verified' : status === 'needs_review' ? 'needs_review' : current.verification
  };
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE evidence SET data = ?, updated_at = ? WHERE id = ?', JSON.stringify(updated), now, id);
    await addActivity(db, 'evidence', `Record ${statusLabelForActivity(status)}`, updated.title, now);
  });
  return updated;
}

export async function markEvidenceUploadResult(id: string, status: EvidenceRecord['status'], serverId?: string | null) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM evidence WHERE id = ?', [id]);
  if (!row) return null;
  const now = new Date().toISOString();
  const current = JSON.parse(row.data) as EvidenceRecord;
  const updated: EvidenceRecord = {
    ...current,
    status,
    serverId: serverId ?? current.serverId,
    verification: status === 'verified' ? 'verified' : status === 'needs_review' ? 'needs_review' : current.verification
  };
  await db.runAsync('UPDATE evidence SET data = ?, updated_at = ? WHERE id = ?', JSON.stringify(updated), now, id);
  return updated;
}


export async function retryEvidenceRecordUpload(id: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM evidence WHERE id = ?', [id]);
  if (!row) return null;
  const now = new Date().toISOString();
  const current = JSON.parse(row.data) as EvidenceRecord;
  const updated: EvidenceRecord = { ...current, status: 'queued', verification: current.verification === 'verified' ? 'supported' : current.verification };
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE evidence SET data = ?, updated_at = ? WHERE id = ?', JSON.stringify(updated), now, id);
    const existing = await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM outbox WHERE dependency_id = ? AND operation_type = 'FARMER_EVIDENCE_SUBMITTED' ORDER BY created_at DESC LIMIT 1",
      [id]
    );
    if (existing) {
      await db.runAsync('UPDATE outbox SET state = ?, updated_at = ? WHERE id = ?', 'RETRY', now, existing.id);
    } else {
      await enqueueOutbox(db, 'FARMER_EVIDENCE_SUBMITTED', updated, id);
    }
    await addActivity(db, 'evidence', 'Record queued for retry', updated.title, now);
  });
  return updated;
}

export async function deleteEvidenceRecord(id: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM evidence WHERE id = ?', [id]);
  if (!row) return false;
  const record = JSON.parse(row.data) as EvidenceRecord;
  if (record.status === 'verified') return false;
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM evidence WHERE id = ?', [id]);
    await db.runAsync("DELETE FROM outbox WHERE dependency_id = ? AND state != 'SYNCED'", [id]);
    await addActivity(db, 'evidence', 'Record removed', record.title, now);
  });
  return true;
}

export async function revokeConsentLocal(id: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM consents WHERE id = ?', [id]);
  if (!row) return;
  const current = JSON.parse(row.data) as ConsentGrant;
  const updated: ConsentGrant = { ...current, status: 'revoked' };
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE consents SET data = ?, updated_at = ? WHERE id = ?', JSON.stringify(updated), now, id);
    await addActivity(db, 'consent', 'Permission revocation requested', current.institution, now);
    await enqueueOutbox(db, 'CONSENT_REVOKE_REQUESTED', { consentId: id });
  });
}

async function addActivity(db: SQLite.SQLiteDatabase, type: string, title: string, detail: string, occurredAt: string) {
  const activity: ActivityItem = {
    id: Crypto.randomUUID(),
    type,
    title,
    detail,
    occurredAt
  };
  await db.runAsync('INSERT INTO activity (id, data, occurred_at) VALUES (?, ?, ?)', activity.id, JSON.stringify(activity), occurredAt);
}

function statusLabelForActivity(status: EvidenceRecord['status']) {
  if (status === 'needs_review') return 'needs review';
  if (status === 'replacement_requested') return 'replacement requested';
  return status;
}

async function enqueueOutbox(db: SQLite.SQLiteDatabase, operationType: string, payload: unknown, dependencyId?: string | null) {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO outbox (id, operation_type, payload, state, attempts, idempotency_key, dependency_id, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)',
    id,
    operationType,
    JSON.stringify(payload),
    'PENDING',
    id,
    dependencyId ?? null,
    now,
    now
  );
}

export async function listOutbox(): Promise<OutboxItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    operation_type: string;
    payload: string;
    state: string;
    attempts: number;
    idempotency_key: string | null;
    dependency_id: string | null;
    created_at: string;
    updated_at: string;
  }>('SELECT * FROM outbox ORDER BY created_at ASC');
  return rows.map((r) => ({
    id: r.id,
    operationType: r.operation_type,
    payload: r.payload,
    state: normalizeOutboxState(r.state),
    attempts: r.attempts,
    idempotencyKey: r.idempotency_key ?? r.id,
    dependencyId: r.dependency_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}

export async function updateOutboxState(id: string, state: OutboxItem['state'], incrementAttempt = false) {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE outbox SET state = ?, attempts = attempts + ?, updated_at = ? WHERE id = ?`,
    state,
    incrementAttempt ? 1 : 0,
    now,
    id
  );
}

async function setMeta(key: string, value: string) {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)', key, value);
}

async function getMeta(key: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_metadata WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function getSessionState(): Promise<SessionState> {
  await initDb();
  const kind = ((await getMeta('session_kind')) as SessionKind | null) ?? 'demo';
  const step = ((await getMeta('onboarding_step')) as OnboardingStep | null) ?? 'done';
  const raw = await getMeta('onboarding_draft');
  let draft: OnboardingDraft | null = null;
  if (raw) {
    try {
      draft = JSON.parse(raw) as OnboardingDraft;
    } catch {
      draft = null;
    }
  }
  return { kind, step, draft };
}

export async function saveOnboardingDraft(draft: OnboardingDraft) {
  await initDb();
  await setMeta('onboarding_draft', JSON.stringify(draft));
  await setMeta('onboarding_step', draft.step);
  await setMeta('session_kind', draft.intent === 'new' ? 'self_onboarded' : draft.intent === 'returning' ? 'returning' : 'demo');
}

export async function setOnboardingIntent(intent: OnboardingDraft['intent']) {
  await initDb();
  const current = await getSessionState();
  const draft: OnboardingDraft = {
    ...(current.draft ?? { intent, step: intent === 'new' ? 'consent' : 'done' }),
    intent,
    step: intent === 'new' ? current.draft?.step && current.draft.step !== 'done' ? current.draft.step : 'consent' : 'done'
  };
  await saveOnboardingDraft(draft);
}

export async function beginSelfOnboarding(phone: string) {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();
  const draft: OnboardingDraft = {
    intent: 'new',
    step: 'consent',
    phone
  };
  const passport: Passport = {
    msid: '',
    displayName: '',
    phoneMasked: maskPhone(phone),
    location: '',
    identityVerified: false,
    profileStatus: 'attention',
    lastUpdated: now,
    readiness: 'not_ready',
    readinessLabel: 'Building your farm profile',
    affiliations: [],
    evidenceStatus: 'No records yet',
    recordFreshness: 'Just started'
  };
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM farms;
      DELETE FROM enterprises;
      DELETE FROM insights;
      DELETE FROM evidence;
      DELETE FROM requests;
      DELETE FROM consents;
      DELETE FROM activity;
      DELETE FROM financing;
      DELETE FROM notifications;
      DELETE FROM weather;
      DELETE FROM climate;
      DELETE FROM markets;
      DELETE FROM personalized_alerts;
      DELETE FROM production_submissions;
      DELETE FROM farmer_submissions;
    `);
    await db.runAsync('INSERT OR REPLACE INTO passport (id, data, updated_at) VALUES (1, ?, ?)', JSON.stringify(passport), now);
  });
  await saveOnboardingDraft(draft);
  return draft;
}

export async function markReturningSession() {
  await initDb();
  await setMeta('session_kind', 'returning');
  await setMeta('onboarding_step', 'done');
  await setMeta('onboarding_draft', JSON.stringify({ intent: 'returning', step: 'done' }));
}

export async function requestInstitutionLink(institutionName: string, memberNumber?: string) {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();
  const link: ConsentGrant = {
    id: Crypto.randomUUID(),
    institution: institutionName,
    purpose: memberNumber ? `Membership ${memberNumber}` : 'Membership connection',
    status: 'pending',
    grantedAt: null,
    expiresAt: null,
    scopes: ['Farm profile', 'Production records']
  };
  await db.withTransactionAsync(async () => {
    await upsertJson(db, 'consents', link.id, link);
    await enqueueOutbox(db, 'INSTITUTION_LINK_REQUESTED', {
      institutionName,
      memberNumber,
      source: 'FARMER_APP'
    });
    await addActivity(db, 'institution', 'Connection pending', institutionName, now);
  });
  const passport = await getPassport();
  if (passport && !passport.affiliations.includes(institutionName)) {
    await savePassport({ ...passport, affiliations: [...passport.affiliations, institutionName], lastUpdated: now });
  }
  return link;
}

export async function savePassport(passport: Passport) {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO passport (id, data, updated_at) VALUES (1, ?, ?)', JSON.stringify(passport), new Date().toISOString());
}

export async function upsertFarm(farm: Farm) {
  const db = await getDb();
  await upsertJson(db, 'farms', farm.id, farm);
}

export async function upsertEnterprise(enterprise: Enterprise) {
  const db = await getDb();
  await upsertJson(db, 'enterprises', enterprise.id, enterprise, { farmId: enterprise.farmId });
}

export async function completeSelfOnboarding(draft: OnboardingDraft) {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();
  const farmId = Crypto.randomUUID();
  const location = [draft.farmLocation, draft.county].filter(Boolean).join(', ');
  const area = Number(draft.reportedArea);
  const farm: Farm | null = draft.addLocationLater && !draft.latitude && !location
    ? null
    : {
        id: farmId,
        name: draft.farmName?.trim() || 'My farm',
        location: location || 'Location to be added',
        latitude: draft.latitude,
        longitude: draft.longitude,
        reportedArea: Number.isFinite(area) && area > 0 ? area : 0,
        measuredArea: null,
        areaUnit: 'acres',
        mapped: Boolean(draft.latitude && draft.longitude),
        verification: 'reported',
        enterprises: draft.sectors ?? [],
        boundary: undefined,
        boundaryCapturedAt: null
      };

  const enterprises: Enterprise[] = (draft.sectors ?? []).map((sector, index) => {
    const details = draft.enterpriseDetails?.[sector] ?? {};
    const summary = summarizeEnterprise(sector, details);
    return {
      id: Crypto.randomUUID(),
      farmId: farm?.id ?? farmId,
      sector,
      name: `${sector} enterprise`,
      primary: index === 0,
      summary: summary.summary,
      productionMetric: summary.productionMetric,
      productionValue: summary.productionValue,
      buyer: summary.buyer
    };
  });

  const current = (await getPassport()) ?? {
    msid: '',
    displayName: draft.displayName?.trim() || 'Farmer',
    phoneMasked: draft.phone ? maskPhone(draft.phone) : '',
    location: draft.county ?? '',
    identityVerified: false,
    profileStatus: 'attention' as const,
    lastUpdated: now,
    readiness: 'not_ready' as const,
    readinessLabel: 'Building your farm profile',
    affiliations: [] as string[],
    evidenceStatus: 'Added by you',
    recordFreshness: 'Just started'
  };

  const passport: Passport = {
    ...current,
    displayName: draft.displayName?.trim() || current.displayName || 'Farmer',
    phoneMasked: draft.phone ? maskPhone(draft.phone) : current.phoneMasked,
    location: draft.county || location || current.location,
    lastUpdated: now,
    affiliations: draft.institutionName ? [draft.institutionName] : [],
    evidenceStatus: 'Added by you',
    recordFreshness: 'Just started',
    readiness: farm && enterprises.length ? 'attention' : 'not_ready',
    readinessLabel: farm && enterprises.length ? 'Good progress' : 'Just getting started'
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT OR REPLACE INTO passport (id, data, updated_at) VALUES (1, ?, ?)', JSON.stringify(passport), now);
    if (farm) await upsertJson(db, 'farms', farm.id, farm);
    for (const enterprise of enterprises) {
      await upsertJson(db, 'enterprises', enterprise.id, enterprise, { farmId: enterprise.farmId });
    }
    if (draft.consentAcceptedAt) {
      const consent: ConsentGrant = {
        id: Crypto.randomUUID(),
        institution: 'Mkulima Passport',
        purpose: 'Build your farm profile and provide relevant farm insights',
        status: 'active',
        grantedAt: draft.consentAcceptedAt,
        expiresAt: null,
        scopes: ['Identity', 'Farm information', 'Enterprises you add', 'Records you add']
      };
      await upsertJson(db, 'consents', consent.id, consent);
      await enqueueOutbox(db, 'CONSENT_GRANTED', {
        version: draft.consentVersion ?? FARMER_CONSENT_VERSION,
        acceptedAt: draft.consentAcceptedAt,
        source: 'FARMER_APP'
      });
    }
    if (draft.institutionChoice === 'yes' && draft.institutionName) {
      const link: ConsentGrant = {
        id: Crypto.randomUUID(),
        institution: draft.institutionName,
        purpose: draft.memberNumber ? `Membership ${draft.memberNumber}` : 'Membership connection',
        status: 'pending',
        grantedAt: null,
        expiresAt: null,
        scopes: ['Farm profile', 'Production records']
      };
      await upsertJson(db, 'consents', link.id, link);
      await enqueueOutbox(db, 'INSTITUTION_LINK_REQUESTED', {
        institutionName: draft.institutionName,
        memberNumber: draft.memberNumber,
        source: 'FARMER_APP'
      });
    }
    if (farm) {
      await enqueueOutbox(db, 'FARM_CREATED', { ...farm, source: 'FARMER_APP', provenance: 'FARMER_REPORTED' });
    }
    for (const enterprise of enterprises) {
      await enqueueOutbox(db, 'ENTERPRISE_CREATED', { ...enterprise, source: 'FARMER_APP', provenance: 'FARMER_REPORTED' });
    }
    await addActivity(db, 'passport', 'Mkulima Passport started', 'Farmer identity established', now);
    if (farm) await addActivity(db, 'farm', 'Farm added', farm.name, now);
    for (const enterprise of enterprises) {
      await addActivity(db, 'enterprise', `${enterprise.sector} enterprise added`, enterprise.summary, now);
    }
  });

  const completed: OnboardingDraft = { ...draft, step: 'done' };
  await saveOnboardingDraft(completed);
  await setMeta('onboarding_step', 'done');
  await setMeta('session_kind', 'self_onboarded');
  return { passport, farm, enterprises };
}

export async function applyFarmerProjection(projection: FarmerProjection) {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();
  const current = await getPassport();
  const nextMsid = projection.passport?.msid || projection.msid || current?.msid || '';
  if (projection.passport || projection.msid) {
    const next: Passport = {
      msid: nextMsid,
      displayName: projection.passport?.displayName || current?.displayName || '',
      phoneMasked: projection.passport?.phoneMasked || current?.phoneMasked || '',
      location: projection.passport?.location || current?.location || '',
      identityVerified: projection.passport?.identityVerified ?? current?.identityVerified ?? false,
      profileStatus: projection.passport?.profileStatus ?? current?.profileStatus ?? 'attention',
      lastUpdated: projection.passport?.lastUpdated ?? now,
      readiness: projection.passport?.readiness ?? current?.readiness ?? 'attention',
      readinessLabel: projection.passport?.readinessLabel ?? current?.readinessLabel ?? 'Building your farm profile',
      affiliations: projection.passport?.affiliations?.length ? projection.passport.affiliations : current?.affiliations ?? [],
      evidenceStatus: projection.passport?.evidenceStatus ?? current?.evidenceStatus ?? 'Added by you',
      recordFreshness: projection.passport?.recordFreshness ?? current?.recordFreshness ?? 'Updated from Mkulima'
    };
    await db.runAsync('INSERT OR REPLACE INTO passport (id, data, updated_at) VALUES (1, ?, ?)', JSON.stringify(next), now);
  }
  for (const farm of projection.farms) {
    const existing = await getFarm(farm.id);
    const merged: Farm = {
      ...existing,
      ...farm,
      latitude: farm.latitude ?? existing?.latitude,
      longitude: farm.longitude ?? existing?.longitude,
      waterSource: farm.waterSource ?? existing?.waterSource,
      irrigation: farm.irrigation ?? existing?.irrigation,
      boundary: farm.boundary ?? existing?.boundary,
      boundaryCapturedAt: farm.boundaryCapturedAt ?? existing?.boundaryCapturedAt,
      boundarySource: farm.boundarySource ?? existing?.boundarySource,
      enterprises: farm.enterprises.length ? farm.enterprises : existing?.enterprises ?? []
    };
    await upsertJson(db, 'farms', farm.id, merged);
  }
  for (const enterprise of projection.enterprises) {
    const existing = await getEnterprise(enterprise.id);
    const merged: Enterprise = {
      ...existing,
      ...enterprise,
      farmId: enterprise.farmId || existing?.farmId || '',
      summary: enterprise.summary || existing?.summary || '',
      productionValue: enterprise.productionValue || existing?.productionValue || '',
      buyer: enterprise.buyer ?? existing?.buyer
    };
    await upsertJson(db, 'enterprises', enterprise.id, merged, { farmId: merged.farmId });
  }
  for (const insight of projection.insights) await upsertJson(db, 'insights', insight.id, insight, { kind: insight.kind });
  for (const record of projection.records) {
    const existing = await getEvidenceRecord(record.id);
    await upsertJson(db, 'evidence', record.id, { ...existing, ...record, localUri: record.localUri ?? existing?.localUri });
  }
  for (const request of projection.requests) await upsertJson(db, 'requests', request.id, request);
  for (const consent of projection.consents) await upsertJson(db, 'consents', consent.id, consent);
  for (const facility of projection.financing) await upsertJson(db, 'financing', facility.id, facility);
  for (const item of projection.activity) {
    await db.runAsync('INSERT OR REPLACE INTO activity (id, data, occurred_at) VALUES (?, ?, ?)', item.id, JSON.stringify(item), item.occurredAt);
  }
  await setMeta('last_projection_at', now);
  if (nextMsid) await setStoredMsid(nextMsid);
}

export async function getLastProjectionAt() {
  await initDb();
  return getMeta('last_projection_at');
}
