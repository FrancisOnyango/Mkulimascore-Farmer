import * as Network from 'expo-network';
import { createFarmerApi } from '@/lib/api/ApiClient';
import { listOutbox, markEvidenceUploadResult, updateOutboxState } from '@/db/database';

export async function syncPending() {
  const network = await Network.getNetworkStateAsync();
  if (!network.isConnected || network.isInternetReachable === false) {
    return { synced: 0, failed: 0, offline: true };
  }

  const api = createFarmerApi();
  const pending = (await listOutbox()).filter((i) => i.state === 'PENDING' || i.state === 'RETRY' || i.state === 'FAILED');
  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      await updateOutboxState(item.id, 'SYNCING');
      if (item.operationType === 'FARMER_EVIDENCE_SUBMITTED' && item.dependencyId) {
        await markEvidenceUploadResult(item.dependencyId, 'uploading');
      }
      const result = await api.submitOperation(item);
      if (result.status === 'ACCEPTED') {
        await updateOutboxState(item.id, 'SYNCED');
        if (item.operationType === 'FARMER_EVIDENCE_SUBMITTED' && item.dependencyId) {
          await markEvidenceUploadResult(item.dependencyId, 'processing', result.serverReference);
        }
        synced += 1;
      } else if (result.status === 'CONFLICT') {
        await updateOutboxState(item.id, 'CONFLICT', true);
        if (item.operationType === 'FARMER_EVIDENCE_SUBMITTED' && item.dependencyId) {
          await markEvidenceUploadResult(item.dependencyId, 'needs_review', result.serverReference);
        }
        failed += 1;
      } else {
        await updateOutboxState(item.id, 'RETRY', true);
        if (item.operationType === 'FARMER_EVIDENCE_SUBMITTED' && item.dependencyId) {
          await markEvidenceUploadResult(item.dependencyId, 'needs_review', result.serverReference);
        }
        failed += 1;
      }
    } catch {
      await updateOutboxState(item.id, 'RETRY', true);
      if (item.operationType === 'FARMER_EVIDENCE_SUBMITTED' && item.dependencyId) {
        await markEvidenceUploadResult(item.dependencyId, 'failed');
      }
      failed += 1;
    }
  }
  return { synced, failed, offline: false };
}
