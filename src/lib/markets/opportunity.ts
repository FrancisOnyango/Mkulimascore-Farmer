import type { Enterprise, Farm, FarmerMarketNote, MarketSignal } from '@/domain/types';
import { getFreshness } from '@/lib/utils/format';
import { KENYA_MARKETS } from '@/lib/markets/kenyaMarkets';
import { farmOrigin } from '@/lib/markets/linkage';
import { formatKm, haversineKm } from '@/lib/geo/geo';

export type MarketOpportunity = {
  id: string;
  name: string;
  town: string;
  km: number;
  distanceLabel: string;
  latitude: number;
  longitude: number;
  goods: string[];
  commodity?: string;
  priceLabel?: string;
  freshnessLabel: string;
  freshnessState: 'fresh' | 'aging' | 'stale' | 'unknown' | 'none';
  relevance: number;
};

function priceFreshness(iso?: string) {
  if (!iso) return { state: 'none' as const, label: 'No reported price yet', score: 0 };
  const freshness = getFreshness(iso);
  if (!freshness) return { state: 'none' as const, label: 'Date unknown', score: 4 };
  if (freshness.state === 'fresh') return { state: freshness.state, label: freshness.ageMinutes < 36 * 60 ? 'Updated today' : 'Updated yesterday', score: 28 };
  if (freshness.state === 'aging') return { state: freshness.state, label: 'Latest reported', score: 14 };
  return { state: freshness.state, label: 'Older report', score: 4 };
}

function parseKes(value?: string | null) {
  if (!value) return null;
  const match = value.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

/**
 * Rank nearby markets by farm place, enterprise match, and price freshness.
 * Distance is not the only rank. Missing or stale prices are labelled honestly.
 */
export function marketOpportunities({
  farm,
  enterprises,
  liveMarkets,
  farmerNotes,
  limit = 3
}: {
  farm?: Farm | null;
  enterprises: Enterprise[];
  liveMarkets: MarketSignal[];
  farmerNotes?: FarmerMarketNote[];
  limit?: number;
}): MarketOpportunity[] {
  const origin = farm ? farmOrigin(farm) : null;
  if (!origin) return [];
  const sectors = enterprises.map((item) => item.sector);
  const primary = sectors[0];

  return KENYA_MARKETS.map((market) => {
    const km = haversineKm(origin, market);
    const goodsMatch = primary ? market.goods.includes(primary) : market.goods.some((good) => sectors.includes(good as Enterprise['sector']));
    const remote = liveMarkets.find((item) => {
      const scope = `${item.marketScope} ${item.commodity}`.toLowerCase();
      return scope.includes(market.town.toLowerCase()) || scope.includes(market.name.toLowerCase()) || (primary && item.commodity === primary);
    });
    const note = farmerNotes?.find((item) => item.marketId === market.id);
    const priceLabel = note
      ? `${note.commodity} · KES ${note.priceKes}/${note.unit}`
      : remote && remote.dataStatus !== 'unavailable'
        ? `${remote.commodity} · ${remote.localRange ?? remote.observedPrice}`
        : undefined;
    const pricedAt = note?.notedAt ?? remote?.updatedAt;
    const freshness = priceFreshness(pricedAt);
    const distanceScore = Math.max(0, 30 - km);
    const matchScore = goodsMatch ? 36 : 10;
    const priceScore = priceLabel ? freshness.score : 0;
    return {
      id: market.id,
      name: market.name,
      town: market.town,
      km,
      distanceLabel: formatKm(km),
      latitude: market.latitude,
      longitude: market.longitude,
      goods: market.goods,
      commodity: note?.commodity ?? remote?.commodity ?? primary,
      priceLabel,
      freshnessLabel: freshness.label,
      freshnessState: freshness.state,
      relevance: matchScore + distanceScore + priceScore
    };
  })
    .sort((a, b) => b.relevance - a.relevance || a.km - b.km)
    .slice(0, limit);
}

export function priceHonesty(status?: MarketSignal['dataStatus'], updatedAt?: string) {
  const freshness = updatedAt ? getFreshness(updatedAt) : null;
  if (status === 'reported' && freshness?.state === 'fresh') return 'Latest reported';
  if (status === 'reported') return 'Latest reported';
  if (status === 'live' && freshness?.state === 'fresh') return 'Reported today';
  if (status === 'live') return 'Latest reported';
  if (status === 'delayed') return 'Latest reported';
  if (status === 'cached') return 'Saved market reference';
  return 'Source not given';
}

export function extractKes(value?: string | null) {
  return parseKes(value);
}
