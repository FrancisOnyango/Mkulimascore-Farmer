import type { AskDraft } from '@/domain/ask';
import type { AskMkulimaContext } from '@/domain/types';
import { localizeAskText, type AskLang } from '@/lib/i18n/askLanguage';

const yesterday = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString();
};

const ONES: Record<string, number> = {
  moja: 1, mbili: 2, tatu: 3, nne: 4, tano: 5, sita: 6, saba: 7, nane: 8, tisa: 9
};

export function parseSwahiliNumber(text: string): number | null {
  const raw = text.toLocaleLowerCase().replace(/['']/g, '').trim();
  if (/^\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
  if (raw === 'kumi') return 10;
  if (raw === 'ishirini') return 20;
  if (raw === 'thelathini') return 30;
  const kumi = raw.match(/^kumi na (moja|mbili|tatu|nne|tano|sita|saba|nane|tisa)$/);
  const ones = kumi?.[1] ? ONES[kumi[1]] : ONES[raw];
  if (ones != null) return kumi?.[1] ? 10 + ones : ones;
  return null;
}

export function detectAskDraft(question: string, context: AskMkulimaContext, language: AskLang = 'en'): AskDraft | null {
  const q = question.toLocaleLowerCase();
  const enterprise = context.enterprises.find((item) => item.primary) ?? context.enterprises[0];
  const occurredAt = /yesterday|jana/.test(q) ? yesterday() : new Date().toISOString();
  const sw = language === 'sw';

  const litres = q.match(/(\d+(?:\.\d+)?)\s*(?:litres?|liters?|lita|l)\b/);
  const swLitres = q.match(/lita\s+((?:kumi na (?:moja|mbili|tatu|nne|tano|sita|saba|nane|tisa)|kumi|ishirini|thelathini|moja|mbili|tatu|nne|tano|sita|saba|nane|tisa))/);
  const quantity = litres?.[1] ? Number(litres[1]) : swLitres?.[1] ? parseSwahiliNumber(swLitres[1]) : null;
  if (quantity && /milk|maziwa|dairy|cow|ng.?ombe/.test(q)) {
    if (Number.isFinite(quantity) && quantity > 0) {
      const when = /yesterday|jana/.test(q) ? (sw ? ' jana' : ' yesterday') : (sw ? ' leo' : ' today');
      return {
        kind: 'production',
        prompt: localizeAskText(`I understood ${quantity} litres of milk${when}. Save this to your dairy records?`, language),
        enterpriseId: enterprise?.id,
        quantity,
        unit: 'litres',
        occurredAt,
        note: 'Drafted from Ask Mkulima. Added by you after you confirm.'
      };
    }
  }

  const bags = q.match(/(\d+(?:\.\d+)?)\s*(?:bags?|gunia)/);
  if (bags?.[1] && /harvest|mavuno|picked|plucked|nilivuna/.test(q)) {
    const count = Number(bags[1]);
    if (Number.isFinite(count) && count > 0) {
      return {
        kind: 'production',
        prompt: localizeAskText(`I can add a harvest of ${count} bags. What bag size should I use is still missing, so I will save the bag count only if you confirm.`, language),
        enterpriseId: enterprise?.id,
        quantity: count,
        unit: 'bags',
        occurredAt,
        note: 'Drafted from Ask Mkulima. Added by you after you confirm.'
      };
    }
  }

  const spent = q.match(/(?:spent|paid|gharama|nililipa)\s*(?:kes\s*)?(\d[\d,]*)/);
  if (spent?.[1]) {
    const amount = Number(spent[1].replace(/,/g, ''));
    if (Number.isFinite(amount) && amount > 0) {
      return {
        kind: 'cost',
        prompt: localizeAskText(`I understood a farm cost of KES ${amount}. Save this cost?`, language),
        enterpriseId: enterprise?.id,
        amount,
        category: 'Other',
        occurredAt,
        note: 'Drafted from Ask Mkulima. Added by you after you confirm.'
      };
    }
  }

  return null;
}
