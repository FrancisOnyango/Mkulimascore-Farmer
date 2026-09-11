import { getAccessToken } from '@/lib/auth/tokenStore';
import type { MarketSignal } from '@/domain/types';

export type MarketServiceResult = {
  status: 'live' | 'delayed' | 'cached' | 'unavailable';
  sourceLabel: string;
  markets: MarketSignal[];
};

/**
 * Contract for a production market provider. Demo mode intentionally returns
 * no remote data so the UI can label the locally seeded values as cached.
 */
export async function fetchLiveMarketData(): Promise<MarketServiceResult> {
  const mode = process.env.EXPO_PUBLIC_APP_MODE ?? 'demo';
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
  if (mode === 'demo' || !baseUrl) {
    return { status: 'cached', sourceLabel: 'Saved market reference', markets: [] };
  }
  const token = await getAccessToken();
  if (!token) return { status: 'unavailable', sourceLabel: 'Market service', markets: [] };
  const requestId = `market-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${baseUrl}/api/v1/farmer/markets`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'X-Request-ID': requestId
      },
      signal: controller.signal
    });
    if (response.status === 429) return { status: 'delayed', sourceLabel: 'Market service rate limited', markets: [] };
    if (!response.ok) return { status: 'unavailable', sourceLabel: `Market service (${response.status})`, markets: [] };
    const payload = await response.json() as { markets?: MarketSignal[]; status?: 'live' | 'delayed'; sourceLabel?: string };
    return {
      status: payload.status ?? 'live',
      sourceLabel: payload.sourceLabel ?? 'Live market service',
      markets: (payload.markets ?? []).map((market) => ({ ...market, dataStatus: payload.status ?? 'live', sourceLabel: payload.sourceLabel ?? 'Live market service', fetchedAt: new Date().toISOString() }))
    };
  } catch {
    return { status: 'unavailable', sourceLabel: 'Market service unavailable', markets: [] };
  } finally {
    clearTimeout(timer);
  }
}
