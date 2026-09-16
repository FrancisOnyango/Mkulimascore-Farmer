import type { Farm, FarmWeather } from '@/domain/types';
import { forecastCellId } from '@/lib/weather/cells';

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    precipitation?: number;
    precipitation_probability?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  hourly?: {
    time?: string[];
    precipitation?: Array<number | null>;
    precipitation_probability?: Array<number | null>;
    temperature_2m?: Array<number | null>;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    precipitation_probability_max?: number[];
    wind_speed_10m_max?: number[];
  };
};

const MAX_AGE_MINUTES = 6 * 60;

/**
 * Numerical forecast lane (Open-Meteo).
 * This never creates an official KMD/NDMA warning label.
 * Prefer commercial / self-hosted base URL in production via EXPO_PUBLIC_OPEN_METEO_URL.
 */
export async function fetchLiveWeather(farm: Farm): Promise<FarmWeather | null> {
  if (farm.latitude === undefined || farm.longitude === undefined) return null;
  const base = (process.env.EXPO_PUBLIC_OPEN_METEO_URL || 'https://api.open-meteo.com/v1/forecast').replace(/\/$/, '');
  const cellId = forecastCellId(farm.latitude, farm.longitude);
  const [cellLng, cellLat] = cellId.split(':').map(Number);
  const params = new URLSearchParams({
    latitude: String(cellLat),
    longitude: String(cellLng),
    current: 'temperature_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m',
    hourly: 'precipitation,precipitation_probability,temperature_2m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
    forecast_days: '7',
    timezone: 'UTC'
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  let payload: OpenMeteoResponse;
  const fetchedAt = new Date();
  try {
    const response = await fetch(`${base}?${params.toString()}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`Weather request failed with status ${response.status}`);
    payload = await response.json() as OpenMeteoResponse;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('WEATHER_TIMEOUT');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  const daily = payload.daily;
  if (!daily?.time?.length || !daily.weather_code?.length) throw new Error('Weather response did not include a daily forecast');
  const forecast = daily.time.map((date, index) => ({
    day: index === 0 ? 'Today' : new Intl.DateTimeFormat('en-KE', { weekday: 'short' }).format(new Date(`${date}T12:00:00Z`)),
    condition: describeWeatherCode(daily.weather_code?.[index] ?? 0),
    rainProbabilityPct: Math.round(daily.precipitation_probability_max?.[index] ?? 0),
    temperatureHighC: Math.round(daily.temperature_2m_max?.[index] ?? 0)
  }));
  const features = summarizeHourly(payload.hourly, fetchedAt);
  const rainProbabilityPct = Math.round(
    features.rainProb24hPct
    ?? payload.current?.precipitation_probability
    ?? daily.precipitation_probability_max?.[0]
    ?? 0
  );
  const rainMm = Number((features.rain24hMm ?? payload.current?.precipitation ?? daily.precipitation_sum?.[0] ?? 0).toFixed(1));
  const condition = describeWeatherCode(payload.current?.weather_code ?? daily.weather_code[0] ?? 0);
  return {
    id: `weather-${farm.id}-live`,
    farmId: farm.id,
    farmName: farm.name,
    location: farm.location,
    dayLabel: 'Today',
    temperatureLowC: Math.round(daily.temperature_2m_min?.[0] ?? 0),
    temperatureHighC: Math.round(payload.current?.temperature_2m ?? daily.temperature_2m_max?.[0] ?? 0),
    rainMm,
    rainProbabilityPct,
    condition,
    windLabel: `${Math.round(payload.current?.wind_speed_10m ?? daily.wind_speed_10m_max?.[0] ?? 0)} km/h`,
    forecast,
    fieldActivityNote: buildActivityNote(rainProbabilityPct, rainMm, condition),
    enterpriseNotes: [],
    updatedAt: fetchedAt.toISOString(),
    provider: 'open_meteo',
    forecastCellId: cellId,
    freshness: 'fresh',
    ageMinutes: 0,
    sourceDisclaimer: 'Farm-place model forecast (Open-Meteo) — not a farm sensor and not an official KMD warning.',
    features
  };
}

export function weatherFreshnessLabel(weather?: FarmWeather | null): string {
  if (!weather?.updatedAt) return 'Forecast unavailable';
  const age = weather.ageMinutes ?? Math.max(0, Math.round((Date.now() - new Date(weather.updatedAt).getTime()) / 60_000));
  if (weather.freshness === 'unavailable') return 'Forecast temporarily unavailable';
  if (age > MAX_AGE_MINUTES || weather.freshness === 'stale') return `Forecast may be stale · updated ${age} min ago`;
  if (age < 1) return 'Updated just now';
  return `Updated ${age} min ago`;
}

function summarizeHourly(hourly: OpenMeteoResponse['hourly'] | undefined, now: Date) {
  if (!hourly?.time?.length) {
    return { rain6hMm: null, rain24hMm: null, rain72hMm: null, rainProb24hPct: null, tempMax24hC: null };
  }
  const nowMs = now.getTime();
  const windows = { 6: [] as number[], 24: [] as number[], 72: [] as number[] };
  const probs24: number[] = [];
  const temps24: number[] = [];
  hourly.time.forEach((stamp, index) => {
    const at = new Date(stamp.endsWith('Z') ? stamp : `${stamp}Z`).getTime();
    const hoursAhead = (at - nowMs) / 3_600_000;
    if (hoursAhead < 0 || hoursAhead > 72) return;
    const precip = hourly.precipitation?.[index];
    const prob = hourly.precipitation_probability?.[index];
    const temp = hourly.temperature_2m?.[index];
    for (const h of [6, 24, 72] as const) {
      if (hoursAhead <= h && precip != null) windows[h].push(precip);
    }
    if (hoursAhead <= 24) {
      if (prob != null) probs24.push(prob);
      if (temp != null) temps24.push(temp);
    }
  });
  const sum = (vals: number[]) => (vals.length ? Number(vals.reduce((a, b) => a + b, 0).toFixed(1)) : null);
  return {
    rain6hMm: sum(windows[6]),
    rain24hMm: sum(windows[24]),
    rain72hMm: sum(windows[72]),
    rainProb24hPct: probs24.length ? Math.round(Math.max(...probs24)) : null,
    tempMax24hC: temps24.length ? Math.round(Math.max(...temps24)) : null
  };
}

function buildActivityNote(rainProbabilityPct: number, rainMm: number, condition: string) {
  if (rainProbabilityPct >= 70) {
    return rainMm >= 1
      ? `Rain likely around your farm. About ${rainMm} mm possible in the next day.`
      : 'Rain likely around your farm later today.';
  }
  if (rainProbabilityPct >= 40) return 'Some rain is possible around your farm today.';
  return `${condition} around your farm. This is the farm-place forecast cell, not a sensor on your plot.`;
}

function describeWeatherCode(code: number) {
  if (code === 0) return 'Clear skies';
  if ([1, 2, 3].includes(code)) return 'Partly cloudy';
  if ([45, 48].includes(code)) return 'Misty';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Light drizzle';
  if ([61, 63, 65, 66, 67].includes(code)) return 'Rain likely';
  if ([71, 73, 75, 77].includes(code)) return 'Wintry precipitation';
  if ([80, 81, 82].includes(code)) return 'Rain showers';
  if ([95, 96, 99].includes(code)) return 'Thunderstorms';
  return 'Changing conditions';
}
