import type { Farm, FarmWeather } from '@/domain/types';

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    precipitation?: number;
    precipitation_probability?: number;
    weather_code?: number;
    wind_speed_10m?: number;
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

export async function fetchLiveWeather(farm: Farm): Promise<FarmWeather | null> {
  if (farm.latitude === undefined || farm.longitude === undefined) return null;
  const params = new URLSearchParams({
    latitude: String(farm.latitude),
    longitude: String(farm.longitude),
    current: 'temperature_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
    forecast_days: '7',
    timezone: 'auto'
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let payload: OpenMeteoResponse;
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { signal: controller.signal });
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
    day: index === 0 ? 'Today' : new Intl.DateTimeFormat('en-KE', { weekday: 'short' }).format(new Date(`${date}T12:00:00`)),
    condition: describeWeatherCode(daily.weather_code?.[index] ?? 0),
    rainProbabilityPct: Math.round(daily.precipitation_probability_max?.[index] ?? 0),
    temperatureHighC: Math.round(daily.temperature_2m_max?.[index] ?? 0)
  }));
  const rainProbabilityPct = Math.round(payload.current?.precipitation_probability ?? daily.precipitation_probability_max?.[0] ?? 0);
  const rainMm = Number((payload.current?.precipitation ?? daily.precipitation_sum?.[0] ?? 0).toFixed(1));
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
    fieldActivityNote: buildActivityNote(rainProbabilityPct, condition),
    enterpriseNotes: [],
    updatedAt: new Date().toISOString()
  };
}

function buildActivityNote(rainProbabilityPct: number, condition: string) {
  if (rainProbabilityPct >= 70) return `Rain is likely today. Consider completing time-sensitive field work before the wet period.`;
  if (rainProbabilityPct >= 40) return `There is a chance of rain today. Keep field work flexible and monitor conditions.`;
  return `${condition} conditions are expected today. Confirm field conditions before applying inputs.`;
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
