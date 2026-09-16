import type {
  ConsentGrant,
  Enterprise,
  EvidenceRecord,
  Farm,
  FarmWeather,
  Passport,
  PersonalizedAlert,
  InstitutionRequest
} from '@/domain/types';
import type { FarmerAlert } from '@/domain/warnings';
import { farmerActions, type FarmerAction } from '@/lib/intelligence/actions';
import { inferFarmCycle } from '@/lib/intelligence/cycle';
import { buildWeatherWindows, type WeatherWindow } from '@/lib/weather/windows';
import { rankActiveWarnings } from '@/lib/warnings/engine';

/**
 * Architecture §10 Home priority:
 * 1 Safety/severe alert
 * 2 Time-sensitive farm action
 * 3 Institution or correction request
 * 4 Farm cycle progress
 * 5 Profile improvement
 * 6 Recent outcome
 */
export type HomeCard =
  | { id: string; priority: 1; kind: 'alert'; title: string; body: string; cta: string; route: string; earlyWarning?: FarmerAlert }
  | { id: string; priority: 2; kind: 'action'; action: FarmerAction; weatherHint?: string }
  | { id: string; priority: 3; kind: 'request'; title: string; body: string; cta: string; route: string }
  | { id: string; priority: 4; kind: 'cycle'; title: string; body: string; route: string }
  | { id: string; priority: 5; kind: 'profile'; action: FarmerAction }
  | { id: string; priority: 6; kind: 'recent'; title: string; body: string };

export function buildHomeCards(input: {
  passport: Passport | null;
  farm?: Farm;
  farms: Farm[];
  enterprises: Enterprise[];
  records: EvidenceRecord[];
  consents: ConsentGrant[];
  requests?: InstitutionRequest[];
  alerts?: PersonalizedAlert[];
  earlyWarnings?: FarmerAlert[];
  weather?: FarmWeather;
  activityTitles?: string[];
}): { cards: HomeCard[]; primaryAction: FarmerAction | null; weatherWindows: WeatherWindow[]; topWarning: FarmerAlert | null } {
  const actions = farmerActions({
    passport: input.passport,
    farms: input.farm ? [input.farm, ...input.farms.filter((item) => item.id !== input.farm!.id)] : input.farms,
    enterprises: input.enterprises,
    records: input.records,
    consents: input.consents,
    activity: []
  });
  const cycle = inferFarmCycle(input.enterprises, []);
  const weatherWindows = input.weather ? buildWeatherWindows(input.weather, input.enterprises) : [];
  const cards: HomeCard[] = [];
  const topWarning = rankActiveWarnings(input.earlyWarnings ?? [])[0] ?? null;

  if (topWarning) {
    cards.push({
      id: `ews-${topWarning.id}`,
      priority: 1,
      kind: 'alert',
      title: topWarning.title,
      body: topWarning.plainLanguageMessage,
      cta: 'View plan',
      route: `/warnings/${encodeURIComponent(topWarning.id)}?farmId=${topWarning.farmId}`,
      earlyWarning: topWarning
    });
  } else {
    const urgent = (input.alerts ?? []).find((item) => item.severity === 'urgent')
      ?? (input.alerts ?? []).find((item) => item.severity === 'attention' && item.category === 'weather');
    if (urgent) {
      cards.push({
        id: `alert-${urgent.id}`,
        priority: 1,
        kind: 'alert',
        title: urgent.title,
        body: urgent.detail,
        cta: 'Open',
        route: urgent.deepLink || '/insights/weather'
      });
    }
  }

  const timeSensitive = actions.find((item) => item.priority >= 90 && (item.kind === 'CONTROLLABLE' || item.kind === 'EVIDENCE_IMPROVABLE'));
  if (timeSensitive) {
    const rainWindow = weatherWindows.find((item) => item.id === 'rain' || item.id === 'spray');
    cards.push({
      id: `action-${timeSensitive.id}`,
      priority: 2,
      kind: 'action',
      action: timeSensitive,
      weatherHint: rainWindow?.line
    });
  }

  const openRequest = (input.requests ?? []).find((item) => item.status === 'open');
  if (openRequest) {
    cards.push({
      id: `request-${openRequest.id}`,
      priority: 3,
      kind: 'request',
      title: openRequest.title || `${openRequest.institution} asked for records`,
      body: `${openRequest.institution}: ${(openRequest.items ?? []).slice(0, 3).join(', ') || openRequest.reason}. Added by you until confirmed.`,
      cta: 'Review request',
      route: `/request/${openRequest.id}`
    });
  }

  if (cycle.stage !== 'unknown') {
    cards.push({
      id: 'cycle',
      priority: 4,
      kind: 'cycle',
      title: cycle.label,
      body: cycle.line,
      route: '/(tabs)/activity'
    });
  }

  const profileAction = actions.find((item) =>
    item.code === 'IDENTITY_INCOMPLETE'
    || item.code === 'FARM_POINT_MISSING'
    || item.code === 'FARM_BOUNDARY_MISSING'
    || item.code === 'ENTERPRISE_MISSING'
    || item.code === 'NATIONAL_ID_MISSING'
    || item.code === 'COOPERATIVE_UNVERIFIED'
  );
  if (profileAction && profileAction.id !== timeSensitive?.id) {
    cards.push({
      id: `profile-${profileAction.id}`,
      priority: 5,
      kind: 'profile',
      action: profileAction
    });
  }

  const recent = (input.activityTitles ?? [])[0];
  if (recent) {
    cards.push({
      id: 'recent',
      priority: 6,
      kind: 'recent',
      title: 'Already noted',
      body: recent
    });
  }

  const ranked = cards.sort((a, b) => a.priority - b.priority);
  const primaryAction = timeSensitive
    ?? actions.find((item) => item.kind === 'CONTROLLABLE' || item.kind === 'EVIDENCE_IMPROVABLE')
    ?? null;

  return { cards: ranked.slice(0, 5), primaryAction, weatherWindows, topWarning };
}
