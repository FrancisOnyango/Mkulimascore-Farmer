import type { AskRisk, AskScreen } from '@/domain/ask';
import { localizeAskList, localizeAskText, type AskLang } from '@/lib/i18n/askLanguage';

/** Later RAG: Kenyan official sources outrank blogs. Never let Tier F override PCPB. */
export const KNOWLEDGE_TIERS = [
  'A: Kenyan regulatory / official (PCPB, Ministry)',
  'B: KALRO / national research',
  'C: FAO / CABI / CGIAR',
  'D: peer-reviewed literature',
  'E: reputable extension',
  'F: general web'
] as const;

const HIGH = [
  'pesticide', 'insecticide', 'herbicide', 'fungicide', 'spray programme', 'chemical spray',
  'dawa ya kuua', 'dawa ya kunyunyizia', 'kunyunyizia', 'acaricide', 'antibiotic', 'inject', 'dosage', 'dose of',
  'wormer', 'dewormer', 'vet medicine', 'veterinary medicine', 'poison', 'sumu',
  'mln ', 'maize lethal', 'anthrax', 'rabies', 'foot and mouth'
];

const MEDIUM = [
  'disease', 'blight', 'wilt', 'pest', 'fall armyworm', 'worms on',
  'fertilizer rate', 'how much dap', 'how much can', 'how much urea',
  'should i plant', 'plant tomorrow', 'irrigation', 'how is my maize looking',
  'what is wrong with', 'ugonjwa', 'wadudu', 'nipande kesho', 'mahindi yangu'
];

export function classifyAskRisk(question: string): AskRisk {
  const q = question.toLocaleLowerCase();
  if (HIGH.some((term) => q.includes(term))) return 'high';
  if (MEDIUM.some((term) => q.includes(term))) return 'medium';
  return 'low';
}

export function highRiskAnswer(question: string, language: AskLang = 'en') {
  const q = question.toLocaleLowerCase();
  if (/(vet|inject|antibiotic|wormer|deworm|anthrax|rabies|ng'ombe mgonjwa|ngombe mgonjwa|sick cow|mnyama mgonjwa)/.test(q)) {
    return {
      intent: 'general' as const,
      answer: localizeAskText('I will not recommend a veterinary medicine or a dose. If an animal is in pain, off feed, or suddenly weak, contact a veterinary officer. I can help you find a listed animal service near the farm if one is saved.', language),
      recommendations: localizeAskList(['Open Near your farm and look under Services. Add the vet you use if missing.'], language),
      followUps: localizeAskList(['Where can I get veterinary help near my farm?', 'How is my production?'], language)
    };
  }
  return {
    intent: 'general' as const,
    answer: localizeAskText('I will not name a pesticide, spray programme, or chemical rate. In Kenya that has to match a current PCPB registered use and the product label. I do not have that register on this phone. A local extension officer or agrovet can read the label with you.', language),
    recommendations: localizeAskList(['Do not spray from a chat answer. Confirm the registered use and the label.'], language),
    followUps: localizeAskList(['Where can I buy inputs near my farm?', 'How is the weather for my farm?'], language)
  };
}

export function startersForScreen(screen?: AskScreen | null, language: AskLang = 'en'): string[] {
  const en = screen === 'farm' || screen === 'farm_map'
    ? ['How large is this farm?', 'What markets are near here?', 'Is my farm mapped?']
    : screen === 'markets'
      ? ['Where should I sell near my farm?', 'What is the latest price near me?', 'Which market is closest?']
    : screen === 'weather'
      ? ['How is the weather for my farm?', 'Will it rain tomorrow?', 'Show the next 3 days']
    : screen === 'places'
      ? ['Where can I sell near my farm?', 'Where can I buy inputs near my farm?', 'Where can I get veterinary help near my farm?']
    : screen === 'records'
      ? ['How is my production?', 'What have I spent?', 'What record is still needed?']
    : screen === 'profile'
      ? ['How is my Passport looking?', 'What can I improve?', 'What is still waiting to send?']
    : [];
  return localizeAskList(en, language);
}

export function provenancePrefix(verification?: string, language: AskLang = 'en') {
  const en = verification === 'FIELD_VERIFIED'
    ? 'Confirmed during a farm visit'
    : verification === 'PARTNER_CONFIRMED'
      ? 'Confirmed by your cooperative'
    : verification === 'OFFICIAL_REPORTED'
      ? 'Latest reported Ministry figure'
    : verification === 'FORECAST'
      ? 'Based on the forecast for your farm place'
      : 'Based on what you added';
  return localizeAskText(en, language);
}
