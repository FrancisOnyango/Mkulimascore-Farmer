import type {
  CostSubmission,
  CorrectionSubmission,
  EvidenceRecord,
  FarmPlaceKind,
  FieldLook,
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
  listFarmerMarketNotes,
  markReturningSession,
  restoreSampleFarm,
  requestBoundaryVerification,
  requestInstitutionLink,
  saveFarmPlace,
  saveFarmerMarketNote,
  saveFieldLook,
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
  listFarmerMarketNotes,
  saveFarmPlace(input: {
    farmId: string;
    kind: FarmPlaceKind;
    latitude: number;
    longitude: number;
    boundary?: { latitude: number; longitude: number }[];
    boundarySource?: 'GPS_WALK' | 'DRAWN';
    accuracyM?: number | null;
  }) {
    return saveFarmPlace(input);
  },
  saveFieldLook(farmId: string, fieldLook: FieldLook) {
    return saveFieldLook(farmId, fieldLook);
  },
  saveFarmerMarketNote(input: {
    farmId: string;
    marketId: string;
    marketName: string;
    commodity: string;
    priceKes: string;
    unit?: string;
  }) {
    return saveFarmerMarketNote(input);
  },
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

  requestInstitutionLink,
  requestBoundaryVerification
};
