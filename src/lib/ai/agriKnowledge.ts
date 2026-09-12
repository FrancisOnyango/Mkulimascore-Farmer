import corpus from '@/lib/ai/knowledgeCorpus.json';

export type KnowledgeHit = {
  id: string;
  title: string;
  farmerLine: string;
  sourceOrganisation: string;
  authorityTier: string;
  sourceUrl: string;
  score: number;
};

type KnowledgeDoc = {
  id: string;
  country: string;
  valueChains: string[];
  topics: string[];
  sourceOrganisation: string;
  title: string;
  authorityTier: string;
  sourceUrl: string;
  farmerLine: string;
  farmerLineSw?: string;
  body: string;
};

const docs = corpus as KnowledgeDoc[];

export function searchAgriKnowledge(question: string, sector?: string, limit = 3, language: 'en' | 'sw' = 'en'): KnowledgeHit[] {
  const terms = question.toLocaleLowerCase().split(/[^a-z0-9']+/).filter((term) => term.length > 2);
  if (!terms.length) return [];
  return docs
    .map((doc) => {
      const hay = `${doc.title} ${doc.farmerLine} ${doc.farmerLineSw ?? ''} ${doc.body} ${doc.topics.join(' ')} ${doc.valueChains.join(' ')} wadudu ugonjwa mvua bei maziwa`.toLocaleLowerCase();
      let score = terms.reduce((sum, term) => sum + (hay.includes(term) ? 2 : 0), 0);
      if (sector && doc.valueChains.some((item) => item.toLocaleLowerCase() === sector.toLocaleLowerCase())) score += 3;
      score += Math.max(0, 7 - (doc.authorityTier.charCodeAt(0) - 64));
      return {
        id: doc.id,
        title: doc.title,
        farmerLine: language === 'sw' && doc.farmerLineSw ? doc.farmerLineSw : doc.farmerLine,
        sourceOrganisation: doc.sourceOrganisation,
        authorityTier: doc.authorityTier,
        sourceUrl: doc.sourceUrl,
        score
      };
    })
    .filter((item) => item.score >= 4)
    .sort((a, b) => b.score - a.score || a.authorityTier.localeCompare(b.authorityTier))
    .slice(0, limit);
}

export function knowledgeLines(hits: KnowledgeHit[]) {
  return hits.map((item) => `${item.farmerLine} (${item.sourceOrganisation}, tier ${item.authorityTier})`);
}
