import type { Farm } from '@/domain/types';

export type LocationLevel = 0 | 1 | 2 | 3;

export function locationEvidence(farm?: Farm | null) {
  if (!farm) return { level: 0 as LocationLevel, label: 'Place not set', detail: 'A point is enough to start.' };
  if (farm.verification === 'verified' && farm.mapped) {
    return { level: 3 as LocationLevel, label: 'Verified boundary', detail: 'Confirmed during a farm visit.' };
  }
  if (farm.mapped && farm.boundary && farm.boundary.length >= 3) {
    const walked = farm.boundarySource === 'GPS_WALK';
    return {
      level: 2 as LocationLevel,
      label: walked ? 'Walked by you' : 'Drawn by you',
      detail: 'Added by you until a visit confirms it.'
    };
  }
  if (Number.isFinite(farm.latitude) && Number.isFinite(farm.longitude)) {
    return { level: 1 as LocationLevel, label: 'Farm point', detail: 'Enough for weather and nearby places.' };
  }
  return { level: 0 as LocationLevel, label: 'Place not set', detail: 'A point is enough to start.' };
}
