import type { ConsentGrant, Enterprise, Farm, FarmWeather, InstitutionRequest, MarketSignal, OutboxItem, Passport, PersonalizedAlert } from '@/domain/types';
import { nextRecordAction } from '@/lib/enterprises/nextAction';

export type HomeModule = {
  id: string;
  title: string;
  detail: string;
  status?: string;
  route?: string;
  attention?: boolean;
};

export function buildHomeModules({
  farm,
  enterprises,
  weather,
  markets,
  alerts,
  requests,
  consents,
  pendingCount,
  latestActivity
}: {
  passport: Passport;
  farm?: Farm;
  enterprises: Enterprise[];
  weather?: FarmWeather;
  markets: MarketSignal[];
  alerts: PersonalizedAlert[];
  requests: InstitutionRequest[];
  outbox: OutboxItem[];
  consents: ConsentGrant[];
  pendingCount: number;
  latestActivity?: { title: string; detail: string };
}): HomeModule[] {
  const modules: HomeModule[] = [];
  const openRequest = requests.find((item) => item.status === 'open');
  const urgent = alerts.find((item) => item.severity === 'urgent' || item.severity === 'attention');
  const market = markets.find((item) => enterprises.some((enterprise) => enterprise.id === item.enterpriseId) && item.dataStatus !== 'unavailable')
    ?? markets.find((item) => item.dataStatus !== 'unavailable');

  if (pendingCount) {
    modules.push({
      id: 'sync',
      title: `${pendingCount} saved on this phone`,
      detail: 'Will send when you have a signal.',
      route: '/sync',
      attention: true
    });
  } else if (openRequest) {
    modules.push({
      id: 'request',
      title: openRequest.title,
      detail: openRequest.institution,
      route: `/request/${openRequest.id}`,
      attention: true
    });
  } else if (urgent) {
    modules.push({
      id: 'alert',
      title: urgent.title,
      detail: urgent.detail,
      route: urgent.deepLink,
      attention: true
    });
  }

  if (weather) {
    modules.push({
      id: 'weather',
      title: weather.condition,
      detail: `${weather.rainProbabilityPct}% rain`,
      route: '/insights/weather',
      attention: weather.rainProbabilityPct >= 70
    });
  }

  for (const enterprise of enterprises.slice(0, 2)) {
    const action = nextRecordAction(enterprise);
    modules.push({
      id: `enterprise-${enterprise.id}`,
      title: action.title,
      detail: action.detail,
      status: enterprise.sector,
      route: `${action.route}?enterpriseId=${enterprise.id}&farmId=${enterprise.farmId}`
    });
  }

  if (market) {
    modules.push({
      id: 'market',
      title: market.commodity,
      detail: market.localRange ?? market.observedPrice,
      route: '/insights/markets'
    });
  }

  if (latestActivity) {
    modules.push({
      id: 'activity',
      title: latestActivity.title,
      detail: latestActivity.detail,
      route: '/(tabs)/activity'
    });
  } else if (consents.some((item) => item.status === 'pending')) {
    modules.push({
      id: 'consent',
      title: 'Cooperative pending',
      detail: 'They still need to confirm you.',
      route: '/consents'
    });
  } else if (farm && !farm.latitude) {
    modules.push({
      id: 'map',
      title: 'Mark farm place',
      detail: 'Unlocks weather and the nearest market.',
      route: `/farm/map?farmId=${farm.id}`
    });
  }

  return modules.slice(0, 4);
}
