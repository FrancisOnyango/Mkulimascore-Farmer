import { GPS_AREA_ACCURACY_M, haversineKm, pathMetres, polygonAcres, type GeoPoint } from '@/lib/geo/geo';

export const WALK_MIN_STEP_M = 4;
export const WALK_JUMP_M = 70;
export const WALK_MAX_ACCURACY_M = 40;
export const CLOSE_LOOP_M = 14;
export const MIN_LOOP_M = 35;
export const MIN_WALK_POINTS = 4;

export type WalkFix = GeoPoint & { accuracy: number };

export function metresBetween(a: GeoPoint, b: GeoPoint) {
  return haversineKm(a, b) * 1000;
}

export function shouldKeepWalkFix(path: WalkFix[], fix: WalkFix) {
  if (!Number.isFinite(fix.latitude) || !Number.isFinite(fix.longitude)) {
    return { keep: false as const, reason: 'bad' };
  }
  if (fix.accuracy > WALK_MAX_ACCURACY_M) {
    return { keep: false as const, reason: 'wide' };
  }
  const last = path[path.length - 1];
  if (!last) return { keep: true as const };
  const step = metresBetween(last, fix);
  if (step < WALK_MIN_STEP_M) return { keep: false as const, reason: 'still' };
  if (step > WALK_JUMP_M) return { keep: false as const, reason: 'jump' };
  return { keep: true as const };
}

export function walkStats(path: WalkFix[]) {
  const first = path[0];
  const last = path[path.length - 1];
  const metres = pathMetres(path);
  const gap = first && last ? metresBetween(first, last) : Number.POSITIVE_INFINITY;
  const nearStart = Boolean(first && last && path.length >= MIN_WALK_POINTS && metres >= MIN_LOOP_M && gap <= CLOSE_LOOP_M);
  const accuracies = path.map((item) => item.accuracy).filter((value) => Number.isFinite(value));
  const medianAccuracy = median(accuracies);
  const acres = path.length >= 3 && medianAccuracy != null && medianAccuracy <= GPS_AREA_ACCURACY_M
    ? polygonAcres(path)
    : null;
  return {
    points: path.length,
    metres,
    gapM: Number.isFinite(gap) ? Math.round(gap) : null,
    nearStart,
    canSave: path.length >= 3,
    canClose: nearStart,
    medianAccuracy,
    acres
  };
}

export function closeWalkRing(path: WalkFix[]) {
  const first = path[0];
  const last = path[path.length - 1];
  if (!first || path.length < 3) return path;
  if (last && metresBetween(first, last) <= CLOSE_LOOP_M) return path;
  return [...path, first];
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[mid] : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  return Number.isFinite(value) ? value : null;
}
