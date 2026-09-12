import type { AskRisk, AskScreen } from '@/domain/ask';

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
  'dawa ya kuua', 'acaricide', 'antibiotic', 'inject', 'dosage', 'dose of',
  'wormer', 'dewormer', 'vet medicine', 'veterinary medicine', 'poison',
  'mln ', 'maize lethal', 'anthrax', 'rabies', 'foot and mouth'
];

const MEDIUM = [
  'disease', 'blight', 'wilt', 'pest', 'fall armyworm', 'worms on',
  'fertilizer rate', 'how much dap', 'how much can', 'how much urea',
  'should i plant', 'plant tomorrow', 'irrigation', 'how is my maize looking',
  'what is wrong with'
];

export function classifyAskRisk(question: string): AskRisk {
  const q = question.toLocaleLowerCase();
  if (HIGH.some((term) => q.includes(term))) return 'high';
  if (MEDIUM.some((term) => q.includes(term))) return 'medium';
  return 'low';
}

export function highRiskAnswer(question: string) {
  const q = question.toLocaleLowerCase();
  if (/(vet|inject|antibiotic|wormer|deworm|anthrax|rabies|ng'ombe mgonjwa|sick cow)/.test(q)) {
    return {
      intent: 'general' as const,
      answer: 'I will not recommend a veterinary medicine or a dose. If an animal is in pain, off feed, or suddenly weak, contact a veterinary officer. I can help you find a listed animal service near the farm if one is saved.',
      recommendations: ['Open Near your farm and look under Services. Add the vet you use if missing.'],
      followUps: ['Where can I get veterinary help near my farm?', 'How is my production?']
    };
  }
  return {
    intent: 'general' as const,
    answer: 'I will not name a pesticide, spray programme, or chemical rate. In Kenya that has to match a current PCPB registered use and the product label. I do not have that register on this phone. A local extension officer or agrovet can read the label with you.',
    recommendations: ['Do not spray from a chat answer. Confirm the registered use and the label.'],
    followUps: ['Where can I buy inputs near my farm?', 'How is the weather for my farm?']
  };
}

export function startersForScreen(screen?: AskScreen | null): string[] {
  if (screen === 'farm' || screen === 'farm_map') {
    return ['How large is this farm?', 'What markets are near here?', 'Is my farm mapped?'];
  }
  if (screen === 'markets') {
    return ['Where should I sell near my farm?', 'What is the latest price near me?', 'Which market is closest?'];
  }
  if (screen === 'weather') {
    return ['How is the weather for my farm?', 'Will it rain tomorrow?', 'Show the next 3 days'];
  }
  if (screen === 'places') {
    return ['Where can I sell near my farm?', 'Where can I buy inputs near my farm?', 'Where can I get veterinary help near my farm?'];
  }
  if (screen === 'records') {
    return ['How is my production?', 'What have I spent?', 'What record is still needed?'];
  }
  if (screen === 'profile') {
    return ['What should I do first?', 'Why is my profile incomplete?', 'What is still waiting to send?'];
  }
  return [];
}

export function provenancePrefix(verification?: string) {
  if (verification === 'FIELD_VERIFIED') return 'Confirmed during a farm visit';
  if (verification === 'PARTNER_CONFIRMED') return 'Confirmed by your cooperative';
  if (verification === 'OFFICIAL_REPORTED') return 'Latest reported Ministry figure';
  if (verification === 'FORECAST') return 'Based on the forecast for your farm place';
  return 'Based on what you added';
}
