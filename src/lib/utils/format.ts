export function formatDate(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function formatNumber(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat('en-KE', { maximumFractionDigits }).format(value);
}

export function formatKes(value: number) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0
  }).format(value);
}

export function formatFreshness(iso: string) {
  const freshness = getFreshness(iso);
  if (!freshness) return 'Update time unavailable';
  const minutes = freshness.ageMinutes;
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Updated ${hours} hr ago`;
  return `Updated ${Math.round(hours / 24)} days ago`;
}

export type FreshnessState = 'fresh' | 'aging' | 'stale' | 'unknown';

export function getFreshness(iso: string, now = Date.now()): { state: FreshnessState; ageMinutes: number } | null {
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return null;
  const ageMinutes = Math.max(0, Math.round((now - timestamp) / 60000));
  return {
    ageMinutes,
    state: ageMinutes <= 24 * 60 ? 'fresh' : ageMinutes <= 7 * 24 * 60 ? 'aging' : 'stale'
  };
}

export function freshnessLabel(iso: string) {
  const freshness = getFreshness(iso);
  if (!freshness) return 'Freshness unavailable';
  if (freshness.state === 'stale') return `${formatFreshness(iso)} / stale`;
  if (freshness.state === 'aging') return `${formatFreshness(iso)} / aging`;
  return formatFreshness(iso);
}
