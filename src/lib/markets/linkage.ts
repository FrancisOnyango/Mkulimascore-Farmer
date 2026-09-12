import type { Enterprise, Farm, FarmerMarketNote, MarketSignal } from '@/domain/types';
import { nearestMarkets } from '@/lib/markets/kenyaMarkets';

export function farmOrigin(farm: Farm) {
  if (!Number.isFinite(farm.latitude) || !Number.isFinite(farm.longitude)) return null;
  return { latitude: farm.latitude as number, longitude: farm.longitude as number };
}

export function linkedMarkets({
  farm,
  enterprises,
  liveMarkets,
  farmerNotes
}: {
  farm?: Farm | null;
  enterprises: Enterprise[];
  liveMarkets: MarketSignal[];
  farmerNotes?: FarmerMarketNote[];
}) {
  const origin = farm ? farmOrigin(farm) : null;
  const nearest = origin ? nearestMarkets(origin, 2) : [];
  const goods = new Set(enterprises.map((enterprise) => enterprise.sector));
  const prices = liveMarkets.filter((item) => {
    if (item.dataStatus === 'unavailable') return false;
    return enterprises.some((enterprise) => (
      enterprise.id === item.enterpriseId
      || enterprise.sector === item.commodity
      || enterprise.name === item.enterpriseName
      || goods.has(item.commodity as Enterprise['sector'])
    ));
  });
  return {
    origin,
    nearest,
    prices: prices.length ? prices : liveMarkets.filter((item) => item.dataStatus !== 'unavailable').slice(0, 2),
    notes: (farmerNotes ?? []).filter((note) => !farm || note.farmId === farm.id).slice(0, 3)
  };
}
