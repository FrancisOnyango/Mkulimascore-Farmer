import type { Enterprise, FarmWeather } from '@/domain/types';

export type WeatherWindow = {
  id: string;
  title: string;
  line: string;
  tone: 'good' | 'watch' | 'attention';
  sourceLabel: string;
};

/**
 * Translate a farm-place forecast into work windows.
 * Never presents a forecast as a measured event.
 */
export function buildWeatherWindows(weather: FarmWeather, enterprises: Enterprise[] = []): WeatherWindow[] {
  const sourceLabel = `Forecast for ${weather.farmName || 'your farm'} · ${weather.location || 'farm place'} · updated for planning only`;
  const windows: WeatherWindow[] = [];
  const sectors = enterprises.map((item) => item.sector);
  const dairy = sectors.includes('Dairy');
  const crop = sectors.some((item) => ['Maize', 'Beans', 'Tomato', 'Potato', 'Coffee', 'Tea', 'Avocado', 'Rice'].includes(item));

  if (weather.rainProbabilityPct >= 70 || weather.rainMm >= 8) {
    windows.push({
      id: 'rain',
      title: 'Rain window',
      line: `${weather.condition}: about ${weather.rainProbabilityPct}% chance of rain (${weather.rainMm} mm expected). Delay spraying and drying if you can.`,
      tone: 'attention',
      sourceLabel
    });
  } else if (weather.rainProbabilityPct <= 30 && weather.temperatureHighC >= 28) {
    windows.push({
      id: 'dry',
      title: 'Drier window',
      line: `${weather.condition}, up to ${weather.temperatureHighC}°C. Better for drying, transport and field work if the soil allows.`,
      tone: 'good',
      sourceLabel
    });
  } else {
    windows.push({
      id: 'mixed',
      title: 'Today at the farm',
      line: `${weather.condition}, ${weather.temperatureLowC}–${weather.temperatureHighC}°C, about ${weather.rainProbabilityPct}% chance of rain. ${weather.fieldActivityNote}`,
      tone: 'watch',
      sourceLabel
    });
  }

  if (crop && weather.rainProbabilityPct < 40 && weather.windLabel.toLowerCase().includes('light')) {
    windows.push({
      id: 'spray',
      title: 'Spray caution',
      line: 'Wind looks lighter and rain chance is lower, but confirm the PCPB label and the field before any spray. This forecast is not permission to spray.',
      tone: 'watch',
      sourceLabel
    });
  }

  if (dairy && weather.temperatureHighC >= 30) {
    windows.push({
      id: 'heat',
      title: 'Livestock heat',
      line: `Hot afternoon up to ${weather.temperatureHighC}°C. Keep water available and watch for heat stress.`,
      tone: 'attention',
      sourceLabel
    });
  }

  const next = weather.forecast?.[0];
  if (next) {
    windows.push({
      id: 'tomorrow',
      title: next.day || 'Next day',
      line: `${next.condition}, high ${next.temperatureHighC}°C, about ${next.rainProbabilityPct}% chance of rain. Forecast only — not a measured rainfall.`,
      tone: next.rainProbabilityPct >= 60 ? 'attention' : 'watch',
      sourceLabel
    });
  }

  return windows.slice(0, 4);
}
