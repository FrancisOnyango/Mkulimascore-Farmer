export type GeoPoint = { latitude: number; longitude: number };

/** Do not save measured acres when GPS is wider than this. */
export const GPS_AREA_ACCURACY_M = 30;

export function haversineKm(a: GeoPoint, b: GeoPoint) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function centroid(points: GeoPoint[]): GeoPoint | null {
  if (!points.length) return null;
  const sum = points.reduce(
    (acc, point) => ({ latitude: acc.latitude + point.latitude, longitude: acc.longitude + point.longitude }),
    { latitude: 0, longitude: 0 }
  );
  return { latitude: sum.latitude / points.length, longitude: sum.longitude / points.length };
}

export function polygonAcres(points: GeoPoint[]) {
  if (points.length < 3) return null;
  const ring = [...points, points[0]];
  let area = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const a = ring[i];
    const b = ring[i + 1];
    if (!a || !b) continue;
    const x1 = a.longitude * 111320 * Math.cos((a.latitude * Math.PI) / 180);
    const y1 = a.latitude * 110540;
    const x2 = b.longitude * 111320 * Math.cos((b.latitude * Math.PI) / 180);
    const y2 = b.latitude * 110540;
    area += x1 * y2 - x2 * y1;
  }
  const m2 = Math.abs(area) / 2;
  return Number((m2 / 4046.8564224).toFixed(2));
}

export function formatKm(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function pathMetres(points: GeoPoint[]) {
  let km = 0;
  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1];
    const to = points[i];
    if (!from || !to) continue;
    km += haversineKm(from, to);
  }
  return Math.round(km * 1000);
}
