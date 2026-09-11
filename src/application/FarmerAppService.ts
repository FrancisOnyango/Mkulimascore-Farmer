import type {
  CostSubmission,
  CorrectionSubmission,
  EvidenceRecord,
  ProductionSubmission,
  SaleSubmission
} from '@/domain/types';
import type { OnboardingDraft } from '@/domain/types';
import {
  addCorrectionSubmission,
  addCostSubmission,
  deleteEvidenceRecord,
  addEvidenceRecord,
  addProductionSubmission,
  addSaleSubmission,
  beginSelfOnboarding,
  completeSelfOnboarding,
  getEnterprise,
  getEvidenceRecord,
  getFarm,
  getRequest,
  getSessionState,
  markReturningSession,
  restoreSampleFarm,
  requestInstitutionLink,
  saveOnboardingDraft,
  setOnboardingIntent,
  setLowDataMode,
  setLanguage,
  setMarketChangeThresholdPct,
  setSevereWeatherAlerts,
  revokeConsentLocal,
  markNotificationRead,
  markAllNotificationsRead,
  retryEvidenceRecordUpload,
  updateEvidenceRecordStatus
} from '@/db/database';

export const FarmerAppService = {
  getFarm,
  getEnterprise,
  getRequest,
  getEvidenceRecord,
  setLowDataMode,
  setLanguage,
  setMarketChangeThresholdPct,
  setSevereWeatherAlerts,
  markNotificationRead,
  markAllNotificationsRead,
  retryEvidenceRecordUpload,
  updateEvidenceRecordStatus,
  deleteEvidenceRecord,

  requestConsentRevocation(id: string) {
    return revokeConsentLocal(id);
  },

  submitProduction(input: Omit<ProductionSubmission, 'id' | 'provenance'>) {
    return addProductionSubmission(input);
  },

  submitSale(input: Omit<SaleSubmission, 'id' | 'provenance'>) {
    return addSaleSubmission(input);
  },

  submitCost(input: Omit<CostSubmission, 'id' | 'provenance'>) {
    return addCostSubmission(input);
  },

  submitCorrection(input: Omit<CorrectionSubmission, 'id' | 'provenance' | 'occurredAt'>) {
    return addCorrectionSubmission(input);
  },

  submitEvidence(input: Omit<EvidenceRecord, 'id' | 'status' | 'verification' | 'serverId'>) {
    return addEvidenceRecord(input);
  },

  getSessionState,
  setOnboardingIntent,
  beginSelfOnboarding,
  saveOnboardingDraft,
  markReturningSession,
  restoreSampleFarm,
  completeSelfOnboarding(draft: OnboardingDraft) {
    return completeSelfOnboarding(draft);
  },

  requestInstitutionLink
};
