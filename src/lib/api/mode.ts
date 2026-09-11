export function appMode() {
  return process.env.EXPO_PUBLIC_APP_MODE ?? 'demo';
}

export function isLiveBackend() {
  return appMode() !== 'demo';
}

export function apiBaseUrl() {
  return process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? null;
}
