import type { EvidenceRecord, SyncState, VerificationState } from '@/domain/types';

export function verificationLabel(state: VerificationState | string | undefined) {
  if (state === 'verified') return 'Verified during farm visit';
  if (state === 'supported') return 'Confirmed by your cooperative';
  if (state === 'needs_review') return 'We found different information';
  return 'Added by you';
}

export function verificationShort(state: VerificationState | string | undefined) {
  if (state === 'verified') return 'Verified';
  if (state === 'supported') return 'Institution confirmed';
  if (state === 'needs_review') return 'Needs review';
  return 'Added by you';
}

export function syncLabel(state: SyncState | string | undefined) {
  if (state === 'SYNCED') return 'Synced';
  if (state === 'SYNCING') return 'Syncing';
  if (state === 'CONFLICT' || state === 'FAILED' || state === 'RETRY') return 'Needs attention';
  return 'Saved on this phone';
}

export function syncDetail(state: SyncState | string | undefined) {
  if (state === 'SYNCED') return 'This update is with Mkulima.';
  if (state === 'SYNCING') return 'Sending your update now.';
  if (state === 'CONFLICT') return 'We found different information. Review your details.';
  if (state === 'FAILED' || state === 'RETRY') return 'We could not send this yet. It is still on this phone.';
  return 'Will sync when you are online.';
}

export function evidenceStatusLabel(status: EvidenceRecord['status'] | string) {
  if (status === 'verified') return 'Verified';
  if (status === 'needs_review' || status === 'replacement_requested') return 'Needs review';
  if (status === 'queued' || status === 'draft') return 'Saved on this phone';
  if (status === 'uploading') return 'Sending';
  if (status === 'failed') return 'Needs attention';
  if (status === 'rejected') return 'Needs review';
  if (status === 'processing' || status === 'received') return 'Being reviewed';
  return 'Added by you';
}

export function consentStatusLabel(status: string) {
  if (status === 'active') return 'Connected';
  if (status === 'pending') return 'Connection pending';
  if (status === 'revoked') return 'Sharing stopped';
  if (status === 'expired') return 'Ended';
  return status;
}

export function profileStrengthLabel(input: {
  hasIdentity: boolean;
  hasFarm: boolean;
  hasEnterprise: boolean;
  hasRecord: boolean;
  hasInstitution: boolean;
}) {
  const score = [input.hasIdentity, input.hasFarm, input.hasEnterprise, input.hasRecord, input.hasInstitution].filter(Boolean).length;
  if (score >= 4) return 'Strong farm profile';
  if (score >= 2) return 'Good progress';
  return 'Just getting started';
}
