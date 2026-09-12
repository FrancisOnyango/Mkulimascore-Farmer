import { getAccessToken } from '@/lib/auth/tokenStore';
import { getAskMkulimaEndpoint } from '@/lib/ai/AskMkulimaIntegration';
import * as Crypto from 'expo-crypto';
import type {
  AskMkulimaContext,
  AskMkulimaIntent,
  AskMkulimaMessage,
  AskMkulimaMessageMetadata,
  AskMkulimaSource
} from '@/domain/types';

export interface AskMkulimaReply {
  text: string;
  metadata: AskMkulimaMessageMetadata;
}

export interface AskMkulimaClient {
  ask(question: string, context: AskMkulimaContext, history: AskMkulimaMessage[]): Promise<AskMkulimaReply>;
}

const refusal = 'I can talk about your Passport, records and next step. I cannot promise a loan or show a score.';
const localLimitation = 'This uses what is saved on this phone. It is not a farm visit, a price promise, or a loan decision.';

type IntentResult = {
  intent: AskMkulimaIntent;
  answer: string;
  recommendations: string[];
  followUps: string[];
  sources: AskMkulimaSource[];
  limitations?: string[];
  confidence?: AskMkulimaMessageMetadata['confidence'];
};

class DemoAskMkulimaClient implements AskMkulimaClient {
  async ask(question: string, context: AskMkulimaContext, history: AskMkulimaMessage[] = []): Promise<AskMkulimaReply> {
    const scoped = scopeContext(context);
    const normalized = resolveFollowUp(normalizeQuestion(question), history);
    if (mentionsRestrictedTopic(normalized)) {
      return makeReply(refusal, 'general', [], ['What should I do first?'], [], ['Loan and score rules stay with the institution.'], undefined, scoped.language);
    }
    const result = routeQuestion(normalized, scoped);
    return makeReply(result.answer, result.intent, result.recommendations, result.followUps, result.sources, result.limitations, result.confidence, scoped.language);
  }
}

function routeQuestion(question: string, context: AskMkulimaContext): IntentResult {
  const sources: AskMkulimaSource[] = [];
  const attention = context.insights.find((insight) => insight.tone === 'attention');
  const openRequest = context.requests.find((request) => request.status === 'open');
  const pending = context.outbox.filter((item) => item.state !== 'SYNCED').length;
  const weather = context.weather[0];
  const climate = context.climate.find((signal) => signal.tone === 'attention') ?? context.climate[0];
  const market = context.markets[0];
  const alert = context.alerts.find((item) => item.severity === 'urgent') ?? context.alerts.find((item) => item.severity === 'attention') ?? context.alerts[0];
  const primaryEnterprise = context.enterprises.find((enterprise) => enterprise.primary) ?? context.enterprises[0];
  const farmName = context.farms[0]?.name ?? 'Your farm';

  if (hasAny(question, ['weather', 'rain', 'temperature', 'forecast', 'wind', 'mvua', 'hewa', 'joto', 'upepo', 'baridi'])) {
    if (weather) {
      sources.push(source('Farm weather forecast', weather.updatedAt, 'A forecast can change. Check the field before you act.'));
      const nextDays = weather.forecast?.slice(0, 3) ?? [];
      const wantsDays = hasAny(question, ['next 3', 'next three', 'siku 3', 'siku tatu', 'coming days', 'siku zijazo']);
      const rain = weather.rainProbabilityPct >= 60
        ? `Rain looks likely (${weather.rainProbabilityPct}%).`
        : `About ${weather.rainProbabilityPct}% chance of rain.`;
      const days = wantsDays && nextDays.length
        ? ` Coming days: ${nextDays.map((day) => `${day.day} ${day.condition.toLowerCase()}, ${day.temperatureHighC}C`).join('; ')}.`
        : '';
      return {
        intent: 'weather',
        answer: `${weather.farmName}: ${weather.condition.toLowerCase()}, ${weather.temperatureLowC} to ${weather.temperatureHighC}C. ${rain} ${weather.fieldActivityNote}${days}`,
        recommendations: [
          weather.rainProbabilityPct >= 60
            ? 'Protect harvested produce and finish urgent field work before the rain.'
            : 'Look at the soil before you spray or apply inputs.'
        ],
        followUps: nextDays.length ? ['Show the next 3 days', 'How is my production?'] : ['How is my production?', 'What should I do first?'],
        sources
      };
    }
    return noData('weather', `I do not have weather for ${farmName} yet. Mark the farm place, then ask again.`, ['Open My Farm and mark the farm place.'], ['How do I map my farm?'], 'Weather forecast');
  }

  if (hasAny(question, ['climate', 'drought', 'season', 'dry spell', 'el nino', 'la nina', 'ukame', 'msimu'])) {
    if (climate) {
      sources.push(source(climate.sourceLabel || 'Seasonal note on this phone', climate.updatedAt, 'This is a season note, not a day-by-day forecast.'));
      return {
        intent: 'climate',
        answer: `${climate.farmName}: ${climate.title} is ${climate.value} for ${climate.period}. ${climate.interpretation} Use it with today’s weather and what you see on the farm.`,
        recommendations: ['Do not change planting from this note alone.'],
        followUps: ['How is the weather for my farm?', 'How is my production?'],
        sources
      };
    }
    return noData('climate', 'No season note is saved for this farm yet.', ['Keep your own rainfall and planting dates.'], ['How is the weather for my farm?'], 'Season note');
  }

  if (hasAny(question, ['alert', 'warning', 'urgent', 'onyo', 'tahadhari', 'hatari'])) {
    if (alert) {
      sources.push(source('Saved farm alerts on this phone', alert.createdAt, 'An alert is a reminder from saved data, not a guarantee.'));
      return {
        intent: 'alerts',
        answer: `${alert.title}. ${alert.detail}${alert.relatedEntityLabel ? ` This is about ${alert.relatedEntityLabel}.` : ''} Check the farm before you change a plan.`,
        recommendations: ['Open the related record if you need the date or amount.'],
        followUps: ['What should I do first?', 'How is the weather for my farm?'],
        sources
      };
    }
    return noData('alerts', 'No farm alert is waiting on this phone.', ['Add a recent production or cost so there is something to watch.'], ['What should I do first?'], 'Farm alerts');
  }

  if (hasAny(question, ['what did i sell', 'sold last', 'sales last', 'last month sale', 'niliuza', 'mauzo yangu'])) {
    const sales = (context.activity ?? []).filter((item) => item.type === 'sale' || /sale|sold/i.test(item.title));
    const monthAgo = Date.now() - 31 * 86_400_000;
    const recent = sales.filter((item) => {
      const at = new Date(item.occurredAt).getTime();
      return Number.isFinite(at) && at >= monthAgo;
    });
    if (recent[0]) {
      sources.push(source('Farm diary on this phone', recent[0].occurredAt, 'These are sales you saved, not a buyer statement.'));
      return {
        intent: 'production',
        answer: `In the last month you saved ${recent.length} sale${recent.length === 1 ? '' : 's'}: ${recent.slice(0, 3).map((item) => item.detail || item.title).join('; ')}. Add any sale that is missing.`,
        recommendations: ['Open Activity if a sale is missing.'],
        followUps: ['What is the latest price near me?', 'What should I do first?'],
        sources
      };
    }
    return noData('production', 'No sale is saved for the last month. I will not invent a total.', ['Add a sale from Activity when you are paid.'], ['How do I record a sale?'], 'Farm diary');
  }

  if (hasAny(question, ['last milk', 'last herd', 'when did i last', 'last update', 'nilisasisha', 'maziwa ya mwisho'])) {
    const hit = (context.activity ?? []).find((item) => /milk|herd|production|flock/i.test(`${item.type} ${item.title} ${item.detail}`));
    if (hit) {
      sources.push(source('Farm diary on this phone', hit.occurredAt, 'A diary line is added by you until a partner confirms it.'));
      return {
        intent: 'production',
        answer: `The last update I can see is “${hit.title}” on ${hit.occurredAt.slice(0, 10)}. ${hit.detail} Add today’s figure if that date is not today.`,
        recommendations: ['Record today’s milk or herd from Activity.'],
        followUps: ['What should I do first?', 'Why is my profile incomplete?'],
        sources
      };
    }
    return noData('production', 'No milk or herd update is saved yet. I will not guess the last date.', ['Record today’s milk or herd from Activity.'], ['How do I record today’s production?'], 'Farm diary');
  }

  if (hasAny(question, ['profile incomplete', 'why is my profile', 'missing from my', 'haujakamilika'])) {
    const gaps = [
      !context.farms[0]?.latitude ? 'mark the farm place' : null,
      context.farms[0] && !context.farms[0].mapped ? 'walk or draw the farm edge' : null,
      !context.enterprises.length ? 'add what you grow or keep' : null,
      !context.records.length ? 'add a recent production record' : null,
      !context.consents.length && !context.passport?.affiliations.length ? 'connect your cooperative, if you have one' : null
    ].filter(Boolean);
    sources.push(source('Mkulima Passport on this phone', context.passport?.lastUpdated ?? '', 'This is about missing facts, not a score.'));
    return {
      intent: 'next_actions',
      answer: gaps.length
        ? `Your profile still needs you to ${gaps.join(', then ')}. None of this promises a loan.`
        : 'The main farm facts are in place. Keep production current so the record stays useful.',
      recommendations: gaps.length ? [`Start with: ${gaps[0]}.`] : ['Keep the latest milk, harvest or sale current.'],
      followUps: ['What should I do first?', 'How do I map my farm?'],
      sources
    };
  }

  if (hasAny(question, ['market', 'price', 'sell', 'buyer', 'selling', 'bei', 'soko', 'mnunuzi', 'kuuza'])) {
    if (market) {
      sources.push(source('Latest reported market price', market.updatedAt, 'A reported price is not what your buyer must pay.'));
      const own = market.farmerRecordedPrice ? ` Your last saved sale was ${market.farmerRecordedPrice}.` : ' You have not saved your own sale price yet.';
      return {
        intent: 'markets',
        answer: `${market.commodity} at ${market.marketScope}: ${market.observedPrice}. ${market.movementLabel}. ${market.interpretation}${own} Confirm the final price with your buyer.`,
        recommendations: [
          market.farmerRecordedPrice ? 'Compare this with your receipt, grade and quantity.' : 'Save your latest sale: price, quantity, buyer and date.'
        ],
        followUps: ['What did I sell last month?', 'How is my production?'],
        sources
      };
    }
    return noData('markets', 'I do not have a nearby market price yet. I will not invent one.', ['Add a sale when you are paid.'], ['How do I record a sale?'], 'Market reference');
  }

  if (hasAny(question, ['cost', 'expense', 'spend', 'profit', 'margin', 'input', 'gharama', 'matumizi'])) {
    const costRecords = context.records.filter((record) => /cost|expense|input/i.test(`${record.category} ${record.title}`));
    if (costRecords[0]) sources.push(source('Costs you saved', costRecords[0].documentDate, 'Costs are added by you until a partner confirms them.'));
    const who = primaryEnterprise ? primaryEnterprise.name : 'your farm';
    return {
      intent: 'costs',
      answer: costRecords.length
        ? `You have ${costRecords.length} cost record${costRecords.length === 1 ? '' : 's'} for ${who}. That helps you see spend. It does not prove profit.`
        : `No cost is saved for ${who} yet. Without costs I cannot talk about a margin.`,
      recommendations: costRecords.length
        ? ['Add any missing feed, labour, seed or transport with the date and amount.']
        : ['Add the latest farm cost with amount, date and enterprise.'],
      followUps: ['How is my production?', 'What should I do first?'],
      sources
    };
  }

  if (hasAny(question, ['production', 'yield', 'harvest', 'output', 'enterprise', 'performance', 'mazao', 'mavuno', 'maziwa', 'uzalishaji'])) {
    if (primaryEnterprise) {
      sources.push(source('Production on this phone', context.passport?.lastUpdated ?? '', 'This is what you recorded, not an independent measurement.'));
      const trend = primaryEnterprise.trendLabel ? ` ${primaryEnterprise.trendLabel}.` : '';
      return {
        intent: 'production',
        answer: `${primaryEnterprise.name} is recorded at ${primaryEnterprise.productionValue} ${primaryEnterprise.productionMetric}.${trend} ${primaryEnterprise.summary} Add today’s figure if that date is old.`,
        recommendations: ['Record the latest amount, unit and date.'],
        followUps: ['What have I spent?', 'How is the weather for my farm?'],
        sources
      };
    }
    return noData('production', 'No production is saved yet. Add what you grow or keep, then today’s amount.', ['Add your main enterprise from Activity.'], ['How do I add production?'], 'Production records');
  }

  if (hasAny(question, ['record', 'upload', 'statement', 'document', 'evidence', 'receipt', 'stakabadhi', 'risiti', 'hati'])) {
    if (openRequest) sources.push({ label: `${openRequest.institution} document request`, freshness: openRequest.dueDate ? `Due ${openRequest.dueDate}` : 'Due date not set', limitation: 'Sending a file queues it. It is not verified on its own.' });
    const recentRecord = context.records[0];
    if (recentRecord) sources.push(source('Saved records', recentRecord.documentDate, 'Check the status before you share.'));
    return {
      intent: 'records',
      answer: openRequest
        ? `${openRequest.institution} is asking for ${openRequest.items.join(', ')}. Sending it queues what you added. It does not become verified on its own.`
        : recentRecord
          ? `Your latest saved record is ${recentRecord.title}. It is ${statusWords(recentRecord.status, recentRecord.verification)}. A useful next record is a recent production, sale or cost.`
          : 'No record is saved yet. A useful first record is a recent production, sale or cost.',
      recommendations: [
        openRequest ? 'Check who is asking and why before you share.' : 'Start with the newest record that explains production, a sale or a cost.'
      ],
      followUps: ['What should I do first?', 'What does verified mean?'],
      sources
    };
  }

  if (hasAny(question, ['map', 'mapped', 'mapping', 'area', 'location', 'boundary', 'gps', 'ramani', 'eneo', 'mpaka'])) {
    const unmapped = context.farms.find((farm) => !farm.mapped);
    if (unmapped) sources.push({ label: 'Farm place on this phone', freshness: 'Location saved', limitation: 'A map is not proof of ownership.' });
    return {
      intent: 'farm_mapping',
      answer: unmapped
        ? `${unmapped.name} does not have a farm edge yet. Mapping adds place and area. What you reported and what was measured stay separate.`
        : context.farms.length
          ? 'Your saved farm places are mapped. Reported area and measured area stay separate.'
          : 'No farm is saved yet, so there is no place to map.',
      recommendations: unmapped ? ['Open Farm place and walk or draw the edge when you are there.'] : ['Open the map if the shape does not match the farm.'],
      followUps: ['What should I do first?', 'How is the weather for my farm?'],
      sources
    };
  }

  if (hasAny(question, ['passport', 'profile', 'identity', 'readiness', 'finance', 'financing', 'loan', 'consent', 'permission', 'wasifu', 'kitambulisho', 'ruhusa'])) {
    const passport = context.passport;
    if (passport) sources.push(source('Mkulima Passport on this phone', passport.lastUpdated, 'Ready means the facts are in place. It is not a loan decision.'));
    const openConsents = context.consents.filter((consent) => consent.status === 'active' || consent.status === 'pending');
    return {
      intent: 'passport',
      answer: passport
        ? `${passport.readinessLabel}. Identity is ${passport.identityVerified ? 'marked verified' : 'not marked verified'}. Records are ${passport.recordFreshness}. This is not a loan decision.`
        : 'Your Mkulima Passport is not on this phone yet.',
      recommendations: passport
        ? [openConsents.length ? `Review ${openConsents.length} permission${openConsents.length === 1 ? '' : 's'} before you share.` : 'Review permissions before you share the Passport.']
        : ['Add your name and a farm to start the Passport.'],
      followUps: ['Why is my profile incomplete?', 'What should I do first?'],
      sources
    };
  }

  if (hasAny(question, ['sync', 'offline', 'internet', 'pending', 'uploading', 'connection', 'mtandao', 'nje ya mtandao'])) {
    if (pending) sources.push({ label: 'Waiting on this phone', freshness: 'Now', limitation: 'Waiting is not the same as received.' });
    return {
      intent: 'sync',
      answer: pending
        ? `${pending} update${pending === 1 ? '' : 's'} ${pending === 1 ? 'is' : 'are'} waiting on this phone. ${pending === 1 ? 'It' : 'They'} will send when you have a signal.`
        : 'Nothing is waiting to send from this phone.',
      recommendations: pending ? ['Open Sync when you have a signal. Do not add the same record twice.'] : ['Keep the original note until you see it sent.'],
      followUps: ['What should I do first?', 'How is my production?'],
      sources
    };
  }

  if (hasAny(question, ['next', 'action', 'do first', 'important', 'recommend', 'update first', 'help', 'nini nifanye', 'hatua', 'muhimu'])) {
    const next = attention?.action ?? attention?.explanation ?? (openRequest ? `review ${openRequest.items[0] ?? 'the open request'}` : context.farms.some((farm) => !farm.mapped) ? 'map the farm place' : context.records.length === 0 ? 'add a recent farm record' : 'record the latest production or cost');
    if (attention) sources.push(source(attention.sourceLabel, attention.updatedAt, attention.limitation));
    return {
      intent: 'next_actions',
      answer: `A useful next step is to ${next}. ${attention?.explanation ?? 'One small update with a date is enough for today.'}`,
      recommendations: ['Finish that one update before starting another.'],
      followUps: ['How is the weather for my farm?', 'How is my production?'],
      sources
    };
  }

  return {
    intent: 'general',
    answer: `Ask about the weather, a price, production, a cost, a record, or what to do first on ${farmName}. I use what you saved. I will not invent a price or a loan.`,
    recommendations: ['Ask one thing at a time.'],
    followUps: ['What should I do first?', 'How is the weather for my farm?'],
    sources: context.passport ? [source('Mkulima Passport on this phone', context.passport.lastUpdated, 'I cannot see institution-only rules.')] : []
  };
}

function statusWords(status: string, verification: string) {
  const verified = /verif/i.test(verification) ? 'checked during a farm visit or by a partner' : 'added by you';
  return `${status.replace(/_/g, ' ')}, ${verified}`;
}

function noData(intent: AskMkulimaIntent, answer: string, recommendations: string[], followUps: string[], sourceLabel: string): IntentResult {
  return { intent, answer, recommendations, followUps, sources: [{ label: sourceLabel, freshness: 'Nothing saved yet', limitation: 'I will not invent missing farm data.' }] };
}

function makeReply(answer: string, intent: AskMkulimaIntent, recommendations: string[], followUps: string[], sources: AskMkulimaSource[], limitations: string[] = [], confidence?: AskMkulimaMessageMetadata['confidence'], _language: 'en' | 'sw' = 'en'): AskMkulimaReply {
  const next = recommendations[0];
  const text = weaveNext(answer, next);
  return {
    text,
    metadata: {
      intent,
      sources,
      recommendations,
      followUps,
      limitations: [...limitations, localLimitation],
      localOnly: true,
      confidence: confidence ?? (sources.length >= 2 ? 'high' : sources.length === 1 ? 'medium' : 'low'),
      provider: 'local-free',
      model: 'mkulima-local-reasoner-v3',
      latencyMs: 0
    }
  };
}

function weaveNext(answer: string, next?: string) {
  const clean = answer.replace(/\s+/g, ' ').trim();
  if (!next) return clean;
  const clipped = next.replace(/\s+/g, ' ').trim();
  if (!clipped) return clean;
  if (clean.toLocaleLowerCase().includes(clipped.slice(0, Math.min(24, clipped.length)).toLocaleLowerCase())) return clean;
  return `${clean} ${clipped.endsWith('.') ? clipped : `${clipped}.`}`;
}

function source(label: string, updatedAt: string, limitation?: string): AskMkulimaSource {
  return { label, freshness: freshness(updatedAt), ...(limitation ? { limitation } : {}) };
}

function freshness(updatedAt: string) {
  if (!updatedAt) return 'Date not saved';
  const timestamp = new Date(updatedAt).getTime();
  if (!Number.isFinite(timestamp)) return 'Date not saved';
  const ageMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (ageMinutes < 60) return 'Updated less than 1 hr ago';
  if (ageMinutes < 1440) return `Updated ${Math.round(ageMinutes / 60)} hr ago`;
  if (ageMinutes < 10080) return `Updated ${Math.round(ageMinutes / 1440)} days ago`;
  return `Updated ${Math.round(ageMinutes / 10080)} weeks ago`;
}

function normalizeQuestion(question: string) {
  return question.toLocaleLowerCase().replace(/['']/g, '').replace(/\s+/g, ' ').trim();
}

function hasAny(question: string, terms: string[]) {
  return terms.some((term) => question.includes(term));
}

function mentionsRestrictedTopic(question: string) {
  return hasAny(question, [
    'score formula',
    'model weight',
    'threshold',
    'guarantee',
    'pre-approved',
    'preapproved',
    'fraud rule',
    'approve my loan',
    'will i get a loan',
    'nitapata mkopo',
    'nipe mkopo',
    'alama ya mkopo',
    'credit score formula'
  ]);
}

function resolveFollowUp(question: string, history: AskMkulimaMessage[]) {
  const last = [...history].reverse().find((item) => item.role === 'assistant' && item.metadata?.intent);
  const intent = last?.metadata?.intent;
  if (!intent) return question;
  if (hasAny(question, ['next 3 days', 'next three days', 'siku 3', 'siku tatu', 'coming days']) && (intent === 'weather' || intent === 'climate')) {
    return 'weather forecast next 3 days';
  }
  if (hasAny(question, ['after that', 'then what', 'nini kufuata', 'baadaye', 'and then'])) {
    return 'what should i update first';
  }
  if (hasFreshTopic(question)) return question;
  if (hasAny(question, ['why', 'explain', 'eleza', 'tell me more', 'more about that', 'and that', 'what about that', 'how about that', 'same', 'na je', 'halafu', 'kisha']) || question.split(' ').length <= 5) {
    return `${intent} ${question}`;
  }
  return question;
}

function hasFreshTopic(question: string) {
  return hasAny(question, [
    'weather', 'rain', 'mvua', 'forecast',
    'price', 'market', 'bei', 'soko',
    'milk', 'maziwa', 'harvest', 'production', 'mazao',
    'cost', 'gharama', 'spent',
    'map', 'mapped', 'ramani',
    'sync', 'offline', 'mtandao',
    'passport', 'profile', 'wasifu',
    'sale', 'sold', 'niliuza'
  ]);
}

function scopeContext(context: AskMkulimaContext): AskMkulimaContext {
  const farmId = context.selectedFarmId ?? context.farms[0]?.id;
  if (!farmId) return context;
  const farms = context.farms.filter((farm) => farm.id === farmId);
  const enterprises = context.enterprises.filter((item) => item.farmId === farmId);
  const weather = context.weather.filter((item) => item.farmId === farmId);
  const climate = context.climate.filter((item) => item.farmId === farmId);
  return {
    ...context,
    farms: farms.length ? farms : context.farms,
    enterprises: enterprises.length ? enterprises : context.enterprises,
    weather: weather.length ? weather : context.weather,
    climate: climate.length ? climate : context.climate
  };
}

class ProductionAskMkulimaClient implements AskMkulimaClient {
  private readonly fallback = new DemoAskMkulimaClient();

  constructor(private readonly baseUrl: string) {}

  async ask(question: string, context: AskMkulimaContext, history: AskMkulimaMessage[]): Promise<AskMkulimaReply> {
    if (mentionsRestrictedTopic(normalizeQuestion(question))) {
      return makeReply(refusal, 'general', [], ['What should I do first?'], [], ['Loan and score rules stay with the institution.'], undefined, context.language);
    }
    const draft = await this.fallback.ask(question, context, history);
    const token = await getAccessToken();
    const endpoint = getAskMkulimaEndpoint(this.baseUrl);
    if (!token || !endpoint) return draft;

    const requestId = Crypto.randomUUID();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18_000);
    const startedAt = Date.now();
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}`, 'X-Request-ID': requestId },
        body: JSON.stringify({
          question,
          context: projectSafeContext(context),
          history: history.slice(-8).map((item) => ({
            role: item.role === 'assistant' ? 'assistant' : 'farmer',
            text: item.text.slice(0, 320),
            intent: item.metadata?.intent
          })),
          draft: {
            text: draft.text,
            intent: draft.metadata.intent,
            recommendations: draft.metadata.recommendations,
            followUps: draft.metadata.followUps,
            sources: draft.metadata.sources
          },
          requestId,
          audit: { action: 'ask_mkulima', client: 'mkulima-farmer', schemaVersion: 'v1' }
        }),
        signal: controller.signal
      });
      if (!response.ok) return draft;
      const payload = await response.json() as Partial<AskMkulimaReply>;
      const text = payload.text?.trim();
      if (!text) return draft;
      return {
        text,
        metadata: {
          ...draft.metadata,
          ...(payload.metadata ?? {}),
          followUps: payload.metadata?.followUps?.length ? payload.metadata.followUps : draft.metadata.followUps,
          sources: payload.metadata?.sources?.length ? payload.metadata.sources : draft.metadata.sources,
          recommendations: payload.metadata?.recommendations?.length ? payload.metadata.recommendations : draft.metadata.recommendations,
          localOnly: payload.metadata?.localOnly ?? false,
          requestId: payload.metadata?.requestId ?? requestId,
          latencyMs: payload.metadata?.latencyMs ?? Date.now() - startedAt
        }
      };
    } catch {
      return draft;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function projectSafeContext(context: AskMkulimaContext) {
  return {
    passport: context.passport ? { readinessLabel: context.passport.readinessLabel, profileStatus: context.passport.profileStatus, recordFreshness: context.passport.recordFreshness, evidenceStatus: context.passport.evidenceStatus } : null,
    farms: context.farms.map((farm) => ({ name: farm.name, location: farm.location, reportedArea: farm.reportedArea, measuredArea: farm.measuredArea, areaUnit: farm.areaUnit, mapped: farm.mapped, verification: farm.verification })),
    enterprises: context.enterprises.map((enterprise) => ({ name: enterprise.name, sector: enterprise.sector, summary: enterprise.summary, productionMetric: enterprise.productionMetric, productionValue: enterprise.productionValue, trendPct: enterprise.trendPct })),
    insights: context.insights.map((insight) => ({ kind: insight.kind, title: insight.title, value: insight.value, explanation: insight.explanation, sourceLabel: insight.sourceLabel, updatedAt: insight.updatedAt, observationPeriod: insight.observationPeriod, limitation: insight.limitation })),
    records: context.records.map((record) => ({ category: record.category, title: record.title, documentDate: record.documentDate, status: record.status, verification: record.verification })),
    openRequests: context.requests.filter((request) => request.status === 'open'),
    consentSummaries: context.consents.map((consent) => ({ institution: consent.institution, purpose: consent.purpose, status: consent.status, scopes: consent.scopes })),
    financing: context.financing.map((facility) => ({ institution: facility.institution, status: facility.status, purpose: facility.purpose })),
    weather: context.weather.map((item) => ({ farmName: item.farmName, location: item.location, condition: item.condition, rainMm: item.rainMm, rainProbabilityPct: item.rainProbabilityPct, fieldActivityNote: item.fieldActivityNote, enterpriseNotes: item.enterpriseNotes, updatedAt: item.updatedAt })),
    climate: context.climate.map((item) => ({ farmName: item.farmName, title: item.title, value: item.value, interpretation: item.interpretation, period: item.period, sourceLabel: item.sourceLabel, updatedAt: item.updatedAt })),
    markets: context.markets.map((item) => ({ commodity: item.commodity, marketScope: item.marketScope, observedPrice: item.observedPrice, farmerRecordedPrice: item.farmerRecordedPrice, localRange: item.localRange, movementLabel: item.movementLabel, interpretation: item.interpretation, updatedAt: item.updatedAt })),
    alerts: context.alerts.map((item) => ({ category: item.category, title: item.title, detail: item.detail, severity: item.severity, relatedEntityLabel: item.relatedEntityLabel })),
    activity: (context.activity ?? []).slice(0, 12).map((item) => ({ type: item.type, title: item.title, detail: item.detail, occurredAt: item.occurredAt })),
    pendingOutboxCount: context.outbox.filter((item) => item.state !== 'SYNCED').length
  };
}

export function createAskMkulimaClient(): AskMkulimaClient {
  const mode = process.env.EXPO_PUBLIC_APP_MODE ?? 'demo';
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (mode === 'demo') return new DemoAskMkulimaClient();
  if (!baseUrl) throw new Error('EXPO_PUBLIC_API_BASE_URL is required outside demo mode.');
  return new ProductionAskMkulimaClient(baseUrl.replace(/\/$/, ''));
}
