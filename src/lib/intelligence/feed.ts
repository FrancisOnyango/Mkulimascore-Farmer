import type { FarmWeather, Insight, MarketSignal, PersonalizedAlert } from '@/domain/types';
import { freshnessLabel, getFreshness } from '@/lib/utils/format';

export type IntelligenceFeedItem = {
  id: string;
  kind: 'weather' | 'market' | 'alert' | 'insight';
  title: string;
  detail: string;
  updatedAt: string;
  route: string;
  priority: number;
  significance: 'urgent' | 'important' | 'informational';
  sourceLabel: string;
  freshnessLabel: string;
};

export function buildIntelligenceFeed({
  weather,
  markets,
  alerts,
  insights,
  farmId,
  marketChangeThresholdPct
}: {
  weather: FarmWeather[];
  markets: MarketSignal[];
  alerts: PersonalizedAlert[];
  insights: Insight[];
  farmId?: string;
  marketChangeThresholdPct?: number;
}) {
  const feed: IntelligenceFeedItem[] = [];
  const threshold = marketChangeThresholdPct ?? 2;
  const farmWeather = weather.find((item) => item.farmId === farmId) ?? weather[0];
  if (farmWeather && (farmWeather.rainProbabilityPct >= 60 || farmWeather.rainMm >= 10)) {
    feed.push({
      id: `weather-${farmWeather.id}`,
      kind: 'weather',
      title: farmWeather.condition,
      detail: farmWeather.fieldActivityNote,
      updatedAt: farmWeather.updatedAt,
      route: '/insights/weather',
      priority: farmWeather.rainProbabilityPct >= 75 ? 100 : 72,
      significance: farmWeather.rainProbabilityPct >= 75 ? 'urgent' : 'important',
      sourceLabel: 'Farm weather context',
      freshnessLabel: freshnessLabel(farmWeather.updatedAt)
    });
  }
  for (const alert of alerts.slice(0, 5)) {
    feed.push({
      id: `alert-${alert.id}`,
      kind: 'alert',
      title: alert.title,
      detail: alert.detail,
      updatedAt: alert.createdAt,
      route: alert.deepLink ?? '/notifications',
      priority: alert.severity === 'urgent' ? 110 : alert.severity === 'attention' ? 90 : 45,
      significance: alert.severity === 'urgent' ? 'urgent' : alert.severity === 'attention' ? 'important' : 'informational',
      sourceLabel: 'Personalized farm update',
      freshnessLabel: freshnessLabel(alert.createdAt)
    });
  }
  for (const market of markets.filter((item) => isSignificantMarket(item, threshold)).slice(0, 2)) {
    feed.push({
      id: `market-${market.id}`,
      kind: 'market',
      title: `${market.commodity} ${market.movementLabel}`,
      detail: `${market.localRange ?? market.observedPrice} in ${market.marketScope}.`,
      updatedAt: market.updatedAt,
      route: '/insights/markets',
      priority: 80,
      significance: 'important',
      sourceLabel: 'Market reference',
      freshnessLabel: freshnessLabel(market.updatedAt)
    });
  }
  for (const insight of insights.filter((item) => item.tone === 'attention').slice(0, 2)) {
    feed.push({
      id: `insight-${insight.id}`,
      kind: 'insight',
      title: insight.title,
      detail: insight.explanation,
      updatedAt: insight.updatedAt,
      route: `/insights/${insight.kind}`,
      priority: 75,
      significance: 'important',
      sourceLabel: insight.sourceLabel,
      freshnessLabel: freshnessLabel(insight.updatedAt)
    });
  }
  return feed
    .sort((a, b) => {
      const freshnessA = getFreshness(a.updatedAt)?.ageMinutes ?? Number.MAX_SAFE_INTEGER;
      const freshnessB = getFreshness(b.updatedAt)?.ageMinutes ?? Number.MAX_SAFE_INTEGER;
      return b.priority - a.priority || freshnessA - freshnessB;
    })
    .slice(0, 6);
}

function isSignificantMarket(item: MarketSignal, thresholdPct: number) {
  const match = item.movementLabel.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
  return match ? Math.abs(Number(match[1])) >= thresholdPct : /up|down|↑|↓/i.test(item.movementLabel);
}
