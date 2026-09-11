import type { ConsentGrant, Enterprise, Farm, FarmWeather, InstitutionRequest, MarketSignal, OutboxItem, Passport, PersonalizedAlert } from '@/domain/types';
import { profileStrengthLabel } from '@/lib/copy/status';

export type HomeModuleId =
  | 'critical_alert'
  | 'today_weather'
  | 'enterprise_activity'
  | 'profile_improvement'
  | 'market_information'
  | 'recent_verification'
  | 'recent_activity';

export type HomeModule = {
  id: HomeModuleId;
  priority: number;
  title: string;
  detail: string;
  status?: string;
  route?: string;
  attention?: boolean;
};

export function buildHomeModules({
  passport,
  farm,
  enterprises,
  weather,
  markets,
  alerts,
  requests,
  outbox,
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
  const dairy = enterprises.find((item) => item.sector === 'Dairy');
  const crop = enterprises.find((item) => ['Maize', 'Rice', 'Beans', 'Tomato', 'Irish potatoes'].includes(item.sector));
  const poultry = enterprises.find((item) => item.sector === 'Poultry');
  const market = dairy ? markets.find((item) => item.enterpriseId === dairy.id) ?? markets[0] : markets[0];
  const openRequest = requests.find((item) => item.status === 'open');
  const pendingLink = consents.find((item) => item.status === 'pending');
  const urgent = alerts.find((item) => item.severity === 'urgent' || item.severity === 'attention');
  const improvements: string[] = [];
  if (farm && !farm.mapped && !farm.latitude) improvements.push('Add farm location');
  if (!consents.some((item) => item.status === 'active' || item.status === 'pending') && !passport.affiliations.length) improvements.push('Connect cooperative');
  if (!latestActivity) improvements.push('Add a production record');
  const modules: HomeModule[] = [];

  if (pendingCount) {
    modules.push({
      id: 'critical_alert',
      priority: 100,
      title: 'Saved on this phone',
      detail: `${pendingCount} update${pendingCount === 1 ? '' : 's'} will sync when you are online.`,
      status: 'Saved',
      route: '/sync',
      attention: true
    });
  } else if (openRequest) {
    modules.push({
      id: 'critical_alert',
      priority: 95,
      title: openRequest.title,
      detail: openRequest.institution,
      status: 'Requested',
      route: `/request/${openRequest.id}`,
      attention: true
    });
  } else if (urgent) {
    modules.push({
      id: 'critical_alert',
      priority: 90,
      title: urgent.title,
      detail: urgent.detail,
      status: urgent.severity === 'urgent' ? 'Important' : undefined,
      route: urgent.deepLink,
      attention: urgent.severity !== 'info'
    });
  }

  if (weather) {
    modules.push({
      id: 'today_weather',
      priority: weather.rainProbabilityPct >= 60 ? 80 : 55,
      title: weather.condition,
      detail: weather.fieldActivityNote,
      status: `${weather.rainProbabilityPct}% rain`,
      route: '/insights/weather',
      attention: weather.rainProbabilityPct >= 70
    });
  }

  if (dairy) {
    modules.push({
      id: 'enterprise_activity',
      priority: 75,
      title: 'Record today’s milk',
      detail: dairy.summary,
      status: dairy.productionValue,
      route: '/add/production'
    });
  } else if (poultry) {
    modules.push({
      id: 'enterprise_activity',
      priority: 72,
      title: 'Update the flock',
      detail: poultry.summary,
      route: '/add/production'
    });
  } else if (crop) {
    modules.push({
      id: 'enterprise_activity',
      priority: 70,
      title: crop.productionValue.toLowerCase().includes('harvest') ? 'Record harvest or sale' : 'Update this crop',
      detail: crop.summary,
      route: '/add'
    });
  }

  modules.push({
    id: 'profile_improvement',
    priority: 60,
    title: profileStrengthLabel({
      hasIdentity: Boolean(passport.displayName),
      hasFarm: Boolean(farm),
      hasEnterprise: enterprises.length > 0,
      hasRecord: Boolean(latestActivity),
      hasInstitution: passport.affiliations.length > 0 || consents.length > 0
    }),
    detail: improvements.length ? improvements.slice(0, 3).join(' · ') : 'Your farm profile is in good shape.',
    status: `${improvements.length || 0} to strengthen`,
    route: '/passport'
  });

  if (market && market.dataStatus !== 'unavailable') {
    modules.push({
      id: 'market_information',
      priority: 50,
      title: `${market.commodity} · ${market.localRange ?? market.observedPrice}`,
      detail: [market.marketScope, market.sourceLabel ?? market.dataStatus].filter(Boolean).join(' · '),
      route: '/insights/markets'
    });
  }

  if (pendingLink) {
    modules.push({
      id: 'recent_verification',
      priority: 48,
      title: pendingLink.institution,
      detail: 'Connection pending until they confirm your membership.',
      status: 'Pending',
      route: '/consents'
    });
  }

  if (latestActivity) {
    modules.push({
      id: 'recent_activity',
      priority: 40,
      title: latestActivity.title,
      detail: latestActivity.detail,
      route: '/(tabs)/activity'
    });
  }

  return modules.sort((a, b) => b.priority - a.priority).slice(0, 5);
}
