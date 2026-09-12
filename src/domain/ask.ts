export type AskRisk = 'low' | 'medium' | 'high';

export type AskFactSource =
  | 'FARMER_APP'
  | 'KAMIS'
  | 'OPEN_METEO'
  | 'MKULIMA_PLACES'
  | 'MKULIMACOLLECT'
  | 'INSTITUTION'
  | 'SYSTEM';

export type AskVerification = 'SELF_REPORTED' | 'FIELD_VERIFIED' | 'PARTNER_CONFIRMED' | 'OFFICIAL_REPORTED' | 'FORECAST';

export type AskScreen =
  | 'ask'
  | 'farm'
  | 'farm_map'
  | 'markets'
  | 'weather'
  | 'insights'
  | 'records'
  | 'profile'
  | 'places';

export interface ProvenanceFact {
  attribute: string;
  value: string;
  source: AskFactSource;
  verification: AskVerification;
  observedAt?: string;
  confidence: 'PROVISIONAL' | 'SUPPORTED' | 'VERIFIED';
  farmerLine: string;
}

export interface AskScreenContext {
  screen: AskScreen;
  farmId?: string;
  enterpriseId?: string;
  placeId?: string;
}

export interface AskDraft {
  kind: 'production' | 'sale' | 'cost';
  prompt: string;
  enterpriseId?: string;
  quantity?: number;
  unit?: string;
  amount?: number;
  category?: string;
  occurredAt: string;
  note?: string;
}

export interface FarmerContextPacket {
  farmer: { msid?: string; name?: string; language?: 'en' | 'sw' };
  location: { place: string; county?: string };
  farms: Array<{
    farmId: string;
    name: string;
    areaLine: string;
    mapped: boolean;
    verification: string;
  }>;
  enterprises: Array<{
    enterpriseId: string;
    sector: string;
    name: string;
    productionLine: string;
    verification: AskVerification;
  }>;
  toolsUsed: string[];
  facts: ProvenanceFact[];
  weatherLine?: string;
  marketLines: string[];
  placeLines: string[];
  profileAction?: string;
  risk: AskRisk;
  layers?: { records?: string; conditions?: string; suggestion?: string };
}
