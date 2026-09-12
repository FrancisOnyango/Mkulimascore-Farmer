import type { AskDraft } from '@/domain/ask';
import type { AskMkulimaContext } from '@/domain/types';

const yesterday = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString();
};

export function detectAskDraft(question: string, context: AskMkulimaContext): AskDraft | null {
  const q = question.toLocaleLowerCase();
  const enterprise = context.enterprises.find((item) => item.primary) ?? context.enterprises[0];
  const occurredAt = /yesterday|jana/.test(q) ? yesterday() : new Date().toISOString();

  const litres = q.match(/(\d+(?:\.\d+)?)\s*(?:litres?|liters?|lita|l)\b/);
  if (litres?.[1] && /milk|maziwa|dairy|cow|ng.?ombe/.test(q)) {
    const quantity = Number(litres[1]);
    if (Number.isFinite(quantity) && quantity > 0) {
      return {
        kind: 'production',
        prompt: `I understood ${quantity} litres of milk${/yesterday|jana/.test(q) ? ' yesterday' : ' today'}. Save this to your dairy records?`,
        enterpriseId: enterprise?.id,
        quantity,
        unit: 'litres',
        occurredAt,
        note: 'Drafted from Ask Mkulima. Added by you after you confirm.'
      };
    }
  }

  const bags = q.match(/(\d+(?:\.\d+)?)\s*(?:bags?|gunia)/);
  if (bags?.[1] && /harvest|mavuno|picked|plucked/.test(q)) {
    const quantity = Number(bags[1]);
    if (Number.isFinite(quantity) && quantity > 0) {
      return {
        kind: 'production',
        prompt: `I can add a harvest of ${quantity} bags. What bag size should I use is still missing, so I will save the bag count only if you confirm.`,
        enterpriseId: enterprise?.id,
        quantity,
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
        prompt: `I understood a farm cost of KES ${amount}. Save this cost?`,
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
