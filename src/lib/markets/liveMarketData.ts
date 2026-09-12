import { getAccessToken } from '@/lib/auth/tokenStore';
import type { MarketSignal } from '@/domain/types';

export type NearbyMarket = {
  marketId: string;
  name: string;
  town: string;
  county?: string;
  latitude: number;
  longitude: number;
  km: number;
  distanceLabel: string;
  commodity?: string | null;
  sourceCommodity?: string | null;
  wholesaleKesPerKg?: number | null;
  retailKesPerKg?: number | null;
  sourceQuote?: string | null;
  canonicalPrice?: number | null;
  priceKind?: string | null;
  observedAt?: string | null;
  ingestedAt?: string;
  freshness?: string;
  freshnessLabel: string;
  confidence?: string;
  source?: string | null;
  sourceLabel?: string;
};

export type MarketServiceResult = {
  status: 'reported' | 'cached' | 'unavailable';
  sourceLabel: string;
  disclaimer?: string;
  ingestedAt?: string;
  nearby: NearbyMarket[];
  bestNearby?: { name: string; distanceLabel: string; priceLabel: string; freshnessLabel: string } | null;
  markets: MarketSignal[];
};

/**
 * Farmer app never calls KAMIS. Staging farmer API ingests latest reported
 * Ministry prices and returns nearby options from the farm place.
 */
export async function fetchLiveMarketData(origin?: {
  latitude?: number;
  longitude?: number;
  commodity?: string;
}): Promise<MarketServiceResult> {
  const mode = process.env.EXPO_PUBLIC_APP_MODE ?? 'demo';
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
  if (mode === 'demo' || !baseUrl) {
    return { status: 'cached', sourceLabel: 'Saved market reference', nearby: [], markets: [] };
  }
  const token = await getAccessToken();
  if (!token) return { status: 'unavailable', sourceLabel: 'Market intelligence', nearby: [], markets: [] };
  const params = new URLSearchParams();
  if (origin?.latitude != null && origin?.longitude != null) {
    params.set('lat', String(origin.latitude));
    params.set('lng', String(origin.longitude));
  }
  if (origin?.commodity) params.set('commodity', origin.commodity);
  const requestId = `market-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const query = params.toString();
    const response = await fetch(`${baseUrl}/api/v1/farmer/market-intelligence/nearby${query ? `?${query}` : ''}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'X-Request-ID': requestId
      },
      signal: controller.signal
    });
    if (!response.ok) return { status: 'unavailable', sourceLabel: `Market intelligence (${response.status})`, nearby: [], markets: [] };
    const payload = await response.json() as {
      status?: 'reported' | 'cached' | 'unavailable';
      sourceLabel?: string;
      disclaimer?: string;
      ingestedAt?: string;
      nearby?: NearbyMarket[];
      produce?: NearbyMarket[];
      bestNearby?: MarketServiceResult['bestNearby'];
    };
    const nearby = payload.nearby ?? [];
    const produce = payload.produce?.length ? payload.produce : nearby;
    return {
      status: payload.status === 'reported' ? 'reported' : payload.status === 'cached' ? 'cached' : 'unavailable',
      sourceLabel: payload.sourceLabel ?? 'Ministry of Agriculture (KAMIS)',
      disclaimer: payload.disclaimer,
      ingestedAt: payload.ingestedAt,
      nearby,
      bestNearby: payload.bestNearby,
      markets: produce.filter((item) => item.canonicalPrice != null).map(toSignal)
    };
  } catch {
    return { status: 'unavailable', sourceLabel: 'Market intelligence unavailable', nearby: [], markets: [] };
  } finally {
    clearTimeout(timer);
  }
}

function toSignal(item: NearbyMarket): MarketSignal {
  const price = item.canonicalPrice != null ? `KES ${item.canonicalPrice}/kg` : 'No reported price yet';
  const kind = item.priceKind ? ` ${item.priceKind}` : '';
  return {
    id: `kamis-${item.marketId}-${item.commodity ?? 'any'}`,
    enterpriseId: '',
    enterpriseName: item.commodity ?? 'Produce',
    commodity: item.commodity ?? 'Produce',
    marketScope: `${item.name} · ${item.distanceLabel}`,
    observedPrice: `${price}${kind}`,
    localRange: item.retailKesPerKg != null && item.wholesaleKesPerKg != null
      ? `KES ${item.wholesaleKesPerKg}–${item.retailKesPerKg}/kg`
      : price,
    movementLabel: item.freshnessLabel,
    interpretation: 'Latest reported Ministry of Agriculture price. Not a live offer.',
    updatedAt: item.observedAt ? `${item.observedAt}T12:00:00+03:00` : new Date().toISOString(),
    dataStatus: item.freshness === 'FRESH' ? 'reported' : item.freshness === 'AGING' ? 'delayed' : 'cached',
    sourceLabel: item.sourceLabel ?? 'Ministry of Agriculture (KAMIS)',
    fetchedAt: item.ingestedAt
  };
}
