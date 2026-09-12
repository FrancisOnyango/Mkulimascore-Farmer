export type DeviceFix = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

export async function getDeviceFix(): Promise<{ ok: true; fix: DeviceFix } | { ok: false; reason: 'denied' | 'unavailable' }> {
  try {
    const Location = await import('expo-location');
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return { ok: false, reason: 'denied' };
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return {
      ok: true,
      fix: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy ?? 999
      }
    };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

export async function watchDeviceFixes(
  onFix: (fix: DeviceFix) => void
): Promise<{ stop: () => void } | { ok: false; reason: 'denied' | 'unavailable' }> {
  try {
    const Location = await import('expo-location');
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return { ok: false, reason: 'denied' };
    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 3,
        timeInterval: 1200
      },
      (position) => {
        onFix({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? 999
        });
      }
    );
    return { stop: () => sub.remove() };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

export { GPS_AREA_ACCURACY_M } from '@/lib/geo/geo';
