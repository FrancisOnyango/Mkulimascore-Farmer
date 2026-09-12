import type { ActivityItem, Enterprise } from '@/domain/types';

export type IncomeSnapshot = {
  salesKes: number | null;
  costsKes: number | null;
  saleCount: number;
  lastSale?: { title: string; detail: string; at: string };
  buyers: string[];
  line: string | null;
};

/**
 * Simple sales and cost totals from the farm diary.
 * Not bookkeeping — only what the farmer already saved.
 */
export function incomeSnapshot(activity: ActivityItem[], enterprises: Enterprise[] = [], withinDays = 30, now = new Date()): IncomeSnapshot {
  const windowStart = now.getTime() - withinDays * 86_400_000;
  const recent = activity.filter((item) => {
    const at = new Date(item.occurredAt).getTime();
    return Number.isFinite(at) && at >= windowStart;
  });
  const sales = recent.filter((item) => item.type === 'sale' || /sale|sold/i.test(item.title));
  const costs = recent.filter((item) => item.type === 'cost' || /cost|feed|input|labour|transport/i.test(`${item.type} ${item.title}`));
  const salesKes = sumKes(sales);
  const costsKes = sumKes(costs);
  const lastSale = sales[0];
  const buyers = unique([
    ...sales.map((item) => extractBuyer(item.detail)).filter(Boolean) as string[],
    ...enterprises.map((item) => item.buyer).filter(Boolean) as string[]
  ]).slice(0, 3);

  if (!sales.length && !costs.length) {
    return {
      salesKes: null,
      costsKes: null,
      saleCount: 0,
      buyers,
      line: null
    };
  }

  const parts = [
    salesKes != null ? `Sales ${formatKes(salesKes)}` : sales.length ? `${sales.length} sale${sales.length === 1 ? '' : 's'}` : null,
    costsKes != null ? `costs ${formatKes(costsKes)}` : null
  ].filter(Boolean);

  return {
    salesKes,
    costsKes,
    saleCount: sales.length,
    lastSale: lastSale ? { title: lastSale.title, detail: lastSale.detail, at: lastSale.occurredAt } : undefined,
    buyers,
    line: parts.length ? `${parts.join(' · ')} in the last ${withinDays} days. Added by you.` : null
  };
}

export function formatKes(value: number) {
  return `KES ${Math.round(value).toLocaleString('en-KE')}`;
}

function sumKes(items: ActivityItem[]) {
  const amounts = items.map((item) => parseKes(`${item.title} ${item.detail}`)).filter((value): value is number => value != null);
  return amounts.length ? amounts.reduce((sum, value) => sum + value, 0) : null;
}

function parseKes(text: string) {
  const match = text.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*kes/i) ?? text.replace(/,/g, '').match(/kes\s*(\d+(?:\.\d+)?)/i);
  return match ? Number(match[1]) : null;
}

function extractBuyer(detail: string) {
  const match = detail.match(/at\s+([^·,\-]+)|to\s+([^·,\-]+)|buyer[:\s]+([^·,\-]+)/i);
  const value = (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
  return value && !/farmer reported/i.test(value) ? value : null;
}

function unique(values: string[]) {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}
