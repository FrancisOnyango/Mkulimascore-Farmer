import { getAccessToken } from '@/lib/auth/tokenStore';
import { apiBaseUrl, isLiveBackend } from '@/lib/api/mode';

export type WeatherTimelineResponse = {
  farmId: string;
  forecastCellId?: string | null;
  lanes: {
    numericalForecast: {
      provider: string;
      freshness: string;
      ageMinutes?: number | null;
      features?: Record<string, number | null>;
      updatedAt?: string;
      disclaimer: string;
    };
    officialWarnings: Record<string, unknown>;
  };
  alerts: unknown[];
  providerHealth: Record<string, unknown>;
};

async function authHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export async function fetchWeatherTimeline(farmId: string): Promise<WeatherTimelineResponse | null> {
  const base = apiBaseUrl();
  if (!isLiveBackend() || !base) return null;
  const response = await fetch(`${base}/api/v1/farmer/farms/${encodeURIComponent(farmId)}/weather-timeline`, {
    headers: await authHeaders()
  });
  if (!response.ok) return null;
  return response.json() as Promise<WeatherTimelineResponse>;
}

export async function fetchPreparednessActions(farmId: string) {
  const base = apiBaseUrl();
  if (!isLiveBackend() || !base) return null;
  const response = await fetch(`${base}/api/v1/farmer/farms/${encodeURIComponent(farmId)}/preparedness-actions`, {
    headers: await authHeaders()
  });
  if (!response.ok) return null;
  return response.json();
}

export async function postWeatherAck(alertId: string, selectedActionId?: string) {
  const base = apiBaseUrl();
  if (!isLiveBackend() || !base) return null;
  const response = await fetch(`${base}/api/v1/farmer/weather-alerts/${encodeURIComponent(alertId)}/acknowledge`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ selectedActionId })
  });
  if (!response.ok) throw new Error(`ACK_FAILED_${response.status}`);
  return response.json();
}

export async function postWeatherImpact(alertId: string, body: Record<string, unknown>) {
  const base = apiBaseUrl();
  if (!isLiveBackend() || !base) return null;
  const response = await fetch(`${base}/api/v1/farmer/weather-alerts/${encodeURIComponent(alertId)}/impact-reports`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`IMPACT_FAILED_${response.status}`);
  return response.json();
}

export async function fetchWeatherOpsHealth() {
  if (!isLiveBackend()) {
    return {
      status: 'local',
      numericalForecast: { provider: 'open_meteo', note: 'App calls Open-Meteo directly in demo mode.' },
      officialWarnings: { status: 'inactive_awaiting_kmd_access' },
      lanes: { model_derived_watch: 'active', official_warning: 'inactive' }
    };
  }
  const base = apiBaseUrl();
  if (!base) throw new Error('API_BASE_MISSING');
  const response = await fetch(`${base}/api/v1/ops/weather/health`, {
    headers: await authHeaders()
  });
  if (!response.ok) throw new Error(`HEALTH_FAILED_${response.status}`);
  return response.json();
}
