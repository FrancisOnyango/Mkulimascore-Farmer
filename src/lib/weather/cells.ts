/** ~5–10 km forecast cells — one provider request per occupied cell. */

export function forecastCellId(latitude: number, longitude: number, precision = 1): string {
  return `${Number(longitude.toFixed(precision))}:${Number(latitude.toFixed(precision))}`;
}

export function uniqueFarmCells(
  farms: { id: string; latitude?: number; longitude?: number }[]
): { cellId: string; latitude: number; longitude: number; farmIds: string[] }[] {
  const map = new Map<string, { cellId: string; latitude: number; longitude: number; farmIds: string[] }>();
  for (const farm of farms) {
    if (farm.latitude == null || farm.longitude == null) continue;
    const latitude = farm.latitude;
    const longitude = farm.longitude;
    const cellId = forecastCellId(latitude, longitude);
    const [lng, lat] = cellId.split(':').map(Number) as [number, number];
    const existing = map.get(cellId);
    if (existing) existing.farmIds.push(farm.id);
    else map.set(cellId, { cellId, latitude: lat, longitude: lng, farmIds: [farm.id] });
  }
  return [...map.values()];
}
