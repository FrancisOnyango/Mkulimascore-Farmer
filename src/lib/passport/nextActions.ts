import type { ActivityItem, ClimateSignal, ConsentGrant, Enterprise, EvidenceRecord, Farm, Passport } from '@/domain/types';
import { actionableTasks, farmerActions } from '@/lib/intelligence/actions';

export type PassportAction = {
  id: string;
  title: string;
  why: string;
  route: string;
};

/** Farmer-safe explainability. Never a score, weight, or loan promise. */
export function passportNextActions(input: {
  passport: Passport | null;
  farms: Farm[];
  enterprises: Enterprise[];
  records: EvidenceRecord[];
  consents: ConsentGrant[];
  climate?: ClimateSignal[];
  activity?: ActivityItem[];
}): PassportAction[] {
  return actionableTasks(farmerActions(input)).slice(0, 3).map((item) => ({
    id: item.id,
    title: item.title,
    why: item.why,
    route: item.route
  }));
}
