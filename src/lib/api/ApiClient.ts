import * as Crypto from 'expo-crypto';
import type { OutboxItem } from '@/domain/types';
import { getAccessToken } from '@/lib/auth/tokenStore';
import { buildEvidenceEnvelope } from '@/lib/api/evidenceEnvelope';
import { apiBaseUrl, isLiveBackend } from '@/lib/api/mode';
import {
  emptyProjection,
  mapActivity,
  mapConsent,
  mapEnterprise,
  mapFarm,
  mapFinancing,
  mapInsight,
  mapPassport,
  mapRecord,
  mapRequest,
  readArray,
  readObject,
  type FarmerProjection
} from '@/lib/api/projection';
import { setStoredMsid } from '@/lib/session/sessionStore';

export interface SyncResult {
  operationId: string;
  status: 'ACCEPTED' | 'NEEDS_REVIEW' | 'NEEDS_CORRECTION' | 'CONFLICT';
  serverReference?: string;
}

export interface FarmerApi {
  submitOperation(item: OutboxItem): Promise<SyncResult>;
  pullProjections(): Promise<FarmerProjection | null>;
}

class DemoFarmerApi implements FarmerApi {
  async submitOperation(item: OutboxItem): Promise<SyncResult> {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return { operationId: item.id, status: 'ACCEPTED', serverReference: `DEMO-${item.id}` };
  }

  async pullProjections() {
    return null;
  }
}

class ProductionFarmerApi implements FarmerApi {
  constructor(private readonly baseUrl: string) {}

  async submitOperation(item: OutboxItem): Promise<SyncResult> {
    const token = await getAccessToken();
    if (!token) throw new Error('AUTH_REQUIRED');
    const envelope = await buildEvidenceEnvelope(item);
    const requestId = Crypto.randomUUID();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/farmer/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
          'Idempotency-Key': item.idempotencyKey,
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(envelope),
        signal: controller.signal
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new Error('AUTH_REQUIRED');
        if (response.status === 404) throw new Error('SYNC_NOT_DEPLOYED');
        if (response.status === 408 || response.status === 429) throw new Error('SYNC_RATE_LIMITED');
        throw new Error(`SYNC_FAILED_${response.status}`);
      }
      const result = (await response.json()) as {
        operationId?: string;
        status?: SyncResult['status'];
        serverReference?: string;
      };
      return {
        operationId: item.id,
        status: result.status ?? 'ACCEPTED',
        serverReference: result.serverReference ?? result.operationId ?? item.id
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async pullProjections(): Promise<FarmerProjection | null> {
    const token = await getAccessToken();
    if (!token) return null;
    const projection = emptyProjection();
    const bootstrap = await this.getJson('/api/v1/farmer/bootstrap', token);
    const bootstrapObject = readObject(bootstrap);
    if (bootstrapObject) {
      const msid = typeof bootstrapObject.msid === 'string' ? bootstrapObject.msid : typeof bootstrapObject.farmer_msid === 'string' ? bootstrapObject.farmer_msid : undefined;
      if (msid) {
        projection.msid = msid;
        projection.available = true;
        await setStoredMsid(msid);
      }
      const bootstrapPassport = mapPassport(bootstrapObject.passport ?? bootstrapObject, msid);
      if (bootstrapPassport && (bootstrapPassport.msid || bootstrapPassport.displayName)) {
        projection.available = true;
        projection.passport = bootstrapPassport;
      }
    }

    const [passport, farms, enterprises, insights, records, requests, consents, financing, activity] = await Promise.all([
      this.getJson('/api/v1/farmer/passport', token),
      this.getJson('/api/v1/farmer/farms', token),
      this.getJson('/api/v1/farmer/enterprises', token),
      this.getJson('/api/v1/farmer/insights', token),
      this.getJson('/api/v1/farmer/records', token),
      this.getJson('/api/v1/farmer/requests', token),
      this.getJson('/api/v1/farmer/permissions', token),
      this.getJson('/api/v1/farmer/financing', token),
      this.getJson('/api/v1/farmer/activity', token)
    ]);

    const mappedPassport = mapPassport(passport, projection.msid);
    if (mappedPassport) {
      projection.available = true;
      projection.passport = { ...projection.passport, ...mappedPassport, msid: mappedPassport.msid || projection.msid || '' };
    }
    projection.farms = readArray(farms, ['farms', 'items', 'data']).map(mapFarm).filter((item): item is NonNullable<typeof item> => Boolean(item));
    projection.enterprises = readArray(enterprises, ['enterprises', 'items', 'data']).map(mapEnterprise).filter((item): item is NonNullable<typeof item> => Boolean(item));
    projection.insights = readArray(insights, ['insights', 'items', 'data']).map(mapInsight).filter((item): item is NonNullable<typeof item> => Boolean(item));
    projection.records = readArray(records, ['records', 'items', 'data']).map(mapRecord).filter((item): item is NonNullable<typeof item> => Boolean(item));
    projection.requests = readArray(requests, ['requests', 'items', 'data']).map(mapRequest).filter((item): item is NonNullable<typeof item> => Boolean(item));
    projection.consents = readArray(consents, ['permissions', 'consents', 'items', 'data']).map(mapConsent).filter((item): item is NonNullable<typeof item> => Boolean(item));
    projection.financing = readArray(financing, ['financing', 'facilities', 'items', 'data']).map(mapFinancing).filter((item): item is NonNullable<typeof item> => Boolean(item));
    projection.activity = readArray(activity, ['activity', 'items', 'data']).map(mapActivity).filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (
      projection.farms.length ||
      projection.enterprises.length ||
      projection.records.length ||
      projection.consents.length ||
      projection.passport?.msid
    ) {
      projection.available = true;
    }
    return projection.available ? projection : null;
  }

  private async getJson(path: string, token: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'X-Request-ID': Crypto.randomUUID()
        },
        signal: controller.signal
      });
      if (response.status === 401 || response.status === 403) throw new Error('AUTH_REQUIRED');
      if (response.status === 404 || response.status === 501) return null;
      if (!response.ok) return null;
      return await response.json() as unknown;
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') throw error;
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createFarmerApi(): FarmerApi {
  const baseUrl = apiBaseUrl();
  if (!isLiveBackend()) return new DemoFarmerApi();
  if (!baseUrl) throw new Error('EXPO_PUBLIC_API_BASE_URL is required outside demo mode.');
  return new ProductionFarmerApi(baseUrl);
}
