import * as Crypto from 'expo-crypto';
import { FARMER_CONSENT_VERSION, type OutboxItem } from '@/domain/types';
import { getInstallId } from '@/lib/device/installId';
import { getStoredMsid } from '@/lib/session/sessionStore';

export type EvidenceSubjectType = 'farmer' | 'farm' | 'enterprise' | 'record' | 'consent' | 'institution';

export interface EvidenceEnvelope {
  operation_id: string;
  operation_type: string;
  source: 'FARMER_APP';
  farmer_msid: string | null;
  local_record_id: string;
  subject: { type: EvidenceSubjectType; id: string | null };
  event_type: string;
  schema_version: string;
  captured_at: string;
  reported_at: string;
  device_id: string;
  consent_ref: string;
  payload: Record<string, unknown>;
  payload_hash: string;
}

export async function buildEvidenceEnvelope(item: OutboxItem): Promise<EvidenceEnvelope> {
  const payload = safeObject(item.payload);
  const capturedAt = stringField(payload, 'occurredAt') ?? stringField(payload, 'capturedAt') ?? item.createdAt;
  const canonical = stableStringify(payload);
  const payloadHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonical);
  return {
    operation_id: item.id,
    operation_type: item.operationType,
    source: 'FARMER_APP',
    farmer_msid: await getStoredMsid(),
    local_record_id: stringField(payload, 'id') ?? item.dependencyId ?? item.id,
    subject: subjectFor(item.operationType, payload),
    event_type: item.operationType,
    schema_version: schemaFor(item.operationType),
    captured_at: capturedAt,
    reported_at: new Date().toISOString(),
    device_id: await getInstallId(),
    consent_ref: FARMER_CONSENT_VERSION,
    payload,
    payload_hash: payloadHash
  };
}

function subjectFor(operationType: string, payload: Record<string, unknown>): EvidenceEnvelope['subject'] {
  if (operationType.includes('ENTERPRISE') || operationType.includes('PRODUCTION') || operationType.includes('SALE') || operationType.includes('COST')) {
    return { type: 'enterprise', id: stringField(payload, 'enterpriseId') ?? stringField(payload, 'id') };
  }
  if (operationType.includes('FARM')) {
    return { type: 'farm', id: stringField(payload, 'id') ?? stringField(payload, 'farmId') };
  }
  if (operationType.includes('EVIDENCE')) {
    return { type: 'record', id: stringField(payload, 'id') };
  }
  if (operationType.includes('INSTITUTION')) {
    return { type: 'institution', id: stringField(payload, 'institutionName') };
  }
  if (operationType.includes('CONSENT')) {
    return { type: 'consent', id: stringField(payload, 'consentId') ?? stringField(payload, 'id') };
  }
  if (operationType.includes('CORRECTION')) {
    const entity = stringField(payload, 'entityType');
    if (entity === 'farm') return { type: 'farm', id: stringField(payload, 'entityId') };
    if (entity === 'enterprise') return { type: 'enterprise', id: stringField(payload, 'entityId') };
    if (entity === 'record') return { type: 'record', id: stringField(payload, 'entityId') };
  }
  return { type: 'farmer', id: stringField(payload, 'id') };
}

function schemaFor(operationType: string) {
  if (operationType.includes('CONSENT')) return 'farmer-consent-v1';
  if (operationType.includes('FARM')) return 'farmer-farm-v1';
  if (operationType.includes('ENTERPRISE')) return 'farmer-enterprise-v1';
  if (operationType.includes('EVIDENCE')) return 'farmer-evidence-v1';
  return 'farmer-activity-v1';
}

function safeObject(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : { value: parsed };
  } catch {
    return { raw };
  }
}

function stringField(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'string' && value.length ? value : null;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`).join(',')}}`;
}
