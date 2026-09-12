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

const refusal =
  'I can explain your Mkulima Passport, records and next actions, but I cannot promise a loan, reveal score formulas, or show institution-only decision rules.';
const localLimitation =
  'This is an informational view of records saved on this phone. It is not an agronomic inspection, price guarantee, credit decision, or proof that a record is verified.';

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
    if (mentionsRestrictedTopic(normalized)) return makeReply(refusal, 'general', [], ['What can I safely update next?'], [], ['Institution-only scoring rules are not available in this app.'], undefined, scoped.language);
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

  if (hasAny(question, ['weather', 'rain', 'temperature', 'forecast', 'wind', 'mvua', 'hewa', 'joto', 'upepo', 'baridi'])) {
    if (weather) {
      sources.push(source('Farm weather forecast', weather.updatedAt, 'Forecast conditions can change; check the field before acting.'));
      const nextDays = weather.forecast?.slice(0, 3) ?? [];
      const wantsDays = hasAny(question, ['next 3', 'next three', 'siku 3', 'siku tatu', 'coming days', 'siku zijazo']);
      const dayText = wantsDays && nextDays.length
        ? ` Next days: ${nextDays.map((day) => `${day.day} ${day.condition}, ${day.temperatureHighC}C, ${day.rainProbabilityPct}% rain`).join('; ')}.`
        : '';
      return {
        intent: 'weather',
        answer: `${weather.farmName}: ${weather.condition}. Today is ${weather.temperatureLowC}-${weather.temperatureHighC}C with ${weather.rainProbabilityPct}% rain probability and about ${weather.rainMm} mm expected. ${weather.fieldActivityNote}${dayText}`,
        recommendations: [
          weather.rainProbabilityPct >= 60 ? 'Prioritise time-sensitive field work before likely rain and keep harvested produce protected.' : 'Confirm soil and field conditions before applying inputs or scheduling labour.',
          weather.windLabel ? `Plan around the reported wind (${weather.windLabel}) and follow product label safety directions.` : 'Keep a simple field observation if conditions differ from the forecast.'
        ],
        followUps: nextDays.length ? ['Show the next 3 days of forecast', 'Which enterprise needs attention today?'] : ['Which enterprise needs attention today?', 'Is there a climate signal for this farm?'],
        sources
      };
    }
    return noData('weather', 'Farm-specific weather is not available yet because this phone has no usable farm location or cached forecast.', ['Add or map a farm location, then refresh weather.', 'Use local field observations until a forecast is available.'], ['How do I map my farm?'], 'Weather forecast');
  }

  if (hasAny(question, ['climate', 'drought', 'season', 'dry spell', 'el nino', 'la nina', 'ukame', 'msimu'])) {
    if (climate) {
      sources.push(source(climate.sourceLabel || 'Climate signal saved on this phone', climate.updatedAt, 'A climate signal is a seasonal reference, not a day-by-day forecast or yield promise.'));
      return {
        intent: 'climate',
        answer: `${climate.farmName}: ${climate.title} is ${climate.value} for ${climate.period}. ${climate.interpretation}`,
        recommendations: ['Use this as seasonal context alongside today’s weather and your own field notes.', 'Do not change planting or input plans from this signal alone.'],
        followUps: ["What should I do about today's weather?", 'How is my production looking?'],
        sources
      };
    }
    return noData('climate', 'No seasonal climate signal is saved for this farm yet.', ['Add a farm location so seasonal context can be attached when a source exists.', 'Keep your own rainfall and planting dates.'], ["What should I do about today's weather?"], 'Climate signal');
  }

  if (hasAny(question, ['alert', 'warning', 'urgent', 'onyo', 'tahadhari', 'hatari'])) {
    if (alert) {
      sources.push(source('Saved farm alerts on this phone', alert.createdAt, 'An alert is a reminder from saved data, not a guarantee of what will happen in the field.'));
      return {
        intent: 'alerts',
        answer: `${alert.title}. ${alert.detail}${alert.relatedEntityLabel ? ` Related: ${alert.relatedEntityLabel}.` : ''}`,
        recommendations: ['Check the related farm record or field conditions before changing a plan.', 'If this is weather-related, confirm today’s forecast and what you see on the farm.'],
        followUps: ['What should I update first?', "What should I do about today's weather?"],
        sources
      };
    }
    return noData('alerts', 'No farm alert is saved on this phone right now.', ['Refresh when you have a signal so weather or record alerts can appear.', 'Add recent production or cost records so the app has something to watch.'], ['What should I update first?'], 'Farm alerts');
  }

  if (hasAny(question, ['what did i sell', 'sold last', 'sales last', 'last month sale', 'niliuza', 'mauzo yangu'])) {
    const sales = (context.activity ?? []).filter((item) => item.type === 'sale' || /sale|sold/i.test(item.title));
    const monthAgo = Date.now() - 31 * 86_400_000;
    const recent = sales.filter((item) => {
      const at = new Date(item.occurredAt).getTime();
      return Number.isFinite(at) && at >= monthAgo;
    });
    const latestSale = recent[0];
    if (latestSale) {
      sources.push(source('Farm diary on this phone', latestSale.occurredAt, 'These are farmer-saved sales, not independently verified unless marked verified.'));
      return {
        intent: 'production',
        answer: `In the last month you saved ${recent.length} sale${recent.length === 1 ? '' : 's'}: ${recent.slice(0, 4).map((item) => item.detail || item.title).join('; ')}.`,
        recommendations: ['Open Activity if you need to add a missing sale.', 'Treat this as your own record, not a buyer statement.'],
        followUps: ['Which market near me has the latest price?', 'What should I update first?'],
        sources
      };
    }
    return noData('production', 'No sale is saved on this phone for the last month.', ['Add a sale from Activity when you are paid.', 'The assistant will not invent a sales total.'], ['How do I record a sale?'], 'Farm diary');
  }

  if (hasAny(question, ['last milk', 'last herd', 'when did i last', 'last update', 'nilisasisha', 'maziwa ya mwisho'])) {
    const hit = (context.activity ?? []).find((item) => /milk|herd|production|flock/i.test(`${item.type} ${item.title} ${item.detail}`));
    if (hit) {
      sources.push(source('Farm diary on this phone', hit.occurredAt, 'A diary entry is farmer-reported until a partner confirms it.'));
      return {
        intent: 'production',
        answer: `The last update I can see is “${hit.title}” (${hit.detail}) on ${hit.occurredAt.slice(0, 10)}.`,
        recommendations: ['Add today’s milk or herd change if that date is not today.', 'Keep one short note per day rather than reconstructing later.'],
        followUps: ['What should I update first?', 'Why is my profile incomplete?'],
        sources
      };
    }
    return noData('production', 'No milk or herd update is saved on this phone yet.', ['Record today’s milk or herd from Activity.', 'The assistant will not guess a last date.'], ["How do I record today's production?"], 'Farm diary');
  }

  if (hasAny(question, ['profile incomplete', 'why is my profile', 'missing from my', 'haujakamilika'])) {
    const gaps = [
      !context.farms[0]?.latitude ? 'mark the farm place' : null,
      context.farms[0] && !context.farms[0].mapped ? 'complete the farm boundary' : null,
      !context.enterprises.length ? 'add what you grow or keep' : null,
      !context.records.length ? 'add a recent production record' : null,
      !context.consents.length && !context.passport?.affiliations.length ? 'connect your cooperative' : null
    ].filter(Boolean);
    sources.push(source('Mkulima Passport on this phone', context.passport?.lastUpdated ?? '', 'This is a completeness view, not a score or loan decision.'));
    return {
      intent: 'next_actions',
      answer: gaps.length
        ? `Your profile is incomplete because you still need to ${gaps.join(', then ')}. None of these promise a score change.`
        : 'The main farm facts are in place. Keep production current so the record stays useful.',
      recommendations: gaps.length ? [`Start with: ${gaps[0]}.`, 'Do not expect points or a loan from completing a task.'] : ['Keep the latest milk, harvest or sale current.', 'Review permissions before sharing the Passport.'],
      followUps: ['What should I update first?', 'How do I map my farm?'],
      sources
    };
  }

  if (hasAny(question, ['market', 'price', 'sell', 'buyer', 'selling', 'bei', 'soko', 'mnunuzi', 'kuuza'])) {
    if (market) {
      sources.push(source('Market reference in this app', market.updatedAt, 'A reference price is not a guaranteed offer and may not match your buyer or grade.'));
      return {
        intent: 'markets',
        answer: `${market.commodity}: ${market.observedPrice} in ${market.marketScope}. Your recorded price is ${market.farmerRecordedPrice ?? 'not recorded recently'}. ${market.movementLabel}. ${market.interpretation}`,
        recommendations: [
          market.farmerRecordedPrice ? 'Compare the reference with your latest sale receipt, grade, quantity and buyer before negotiating.' : 'Record your latest sale price, quantity, buyer and date so your own history is visible.',
          'Confirm the final price, deductions and payment terms directly with the buyer.'
        ],
        followUps: ['What sale record should I add?', 'Explain my market movement'],
        sources
      };
    }
    return noData('markets', 'Market intelligence is not available in the saved data yet.', ['Add an enterprise and record a recent sale or buyer quote.', 'Treat any offline market information as a reference, not a promise.'], ['How do I record a sale?'], 'Market reference');
  }

  if (hasAny(question, ['cost', 'expense', 'spend', 'profit', 'margin', 'input', 'gharama', 'matumizi'])) {
    const costRecords = context.records.filter((record) => /cost|expense|input/i.test(`${record.category} ${record.title}`));
    const costSource = costRecords[0];
    if (costSource) sources.push(source('Farmer-submitted cost records', costSource.documentDate, 'Cost records are farmer-submitted and are not independently verified unless marked verified.'));
    const enterpriseText = primaryEnterprise ? `${primaryEnterprise.name} (${primaryEnterprise.productionMetric}: ${primaryEnterprise.productionValue})` : 'your main enterprise';
    return {
      intent: 'costs',
      answer: costRecords.length
        ? `${costRecords.length} cost record${costRecords.length === 1 ? '' : 's'} are available for review. They help explain the economics of ${enterpriseText}, but they do not by themselves prove profit or repayment capacity.`
        : `No cost record is available for ${enterpriseText} yet. Without costs, the app cannot estimate a reliable margin.`,
      recommendations: costRecords.length
        ? ['Add missing labour, feed, seed, fertiliser, transport and other input costs with dates and amounts.', 'Compare costs with your own sale records; do not rely on an estimated margin alone.']
        : ['Add the latest input, labour, transport and other farm costs with amount, date and enterprise.', 'Keep receipts or notes so you can correct a record later.'],
      followUps: ['How do I add a cost?', 'What production record should I add next?'],
      sources
    };
  }

  if (hasAny(question, ['production', 'yield', 'harvest', 'output', 'enterprise', 'performance', 'mazao', 'mavuno', 'maziwa', 'uzalishaji'])) {
    if (primaryEnterprise) {
      sources.push(source('Farmer Passport enterprise record', context.passport?.lastUpdated ?? '', 'Production values are recorded data; they are not an independent yield measurement.'));
      return {
        intent: 'production',
        answer: `${primaryEnterprise.name} (${primaryEnterprise.sector}) is recorded at ${primaryEnterprise.productionValue} ${primaryEnterprise.productionMetric}.${primaryEnterprise.trendLabel ? ` Trend: ${primaryEnterprise.trendLabel}.` : ''} ${primaryEnterprise.summary}`,
        recommendations: ['Record the latest production amount, unit, date and buyer or use so the trend stays current.', primaryEnterprise.trendPct !== undefined && primaryEnterprise.trendPct < 0 ? 'Check recent input, weather and disease observations before changing a practice.' : 'Compare production with recorded costs and weather before drawing conclusions.'],
        followUps: ["How do I record today's production?", 'What costs should I track for this enterprise?'],
        sources
      };
    }
    return noData('production', 'No enterprise production record is available on this phone yet.', ['Add your main enterprise and its latest production record.', 'Use a consistent unit and date for each production entry.'], ['How do I add production?'], 'Production records');
  }

  if (hasAny(question, ['record', 'upload', 'statement', 'document', 'evidence', 'receipt', 'stakabadhi', 'risiti', 'hati'])) {
    if (openRequest) sources.push({ label: `${openRequest.institution} document request`, freshness: openRequest.dueDate ? `Due ${openRequest.dueDate}` : 'Due date not provided', limitation: 'Uploading queues farmer-submitted evidence; it does not verify it automatically.' });
    const recentRecord = context.records[0];
    if (recentRecord) sources.push(source('Saved evidence records', recentRecord.documentDate, 'Record status and verification should be checked before sharing.'));
    return {
      intent: 'records',
      answer: openRequest
        ? `${openRequest.institution} is asking for ${openRequest.items.join(', ')}. Uploading it queues farmer-submitted evidence for review; it will not become verified automatically.`
        : recentRecord
          ? `Your saved records include ${recentRecord.title} (${recentRecord.status}, ${recentRecord.verification}). The next useful record is the newest production, sale or cost document connected to your main enterprise.`
          : 'No evidence record is saved yet. The most useful first record is a recent production, sale, cost or cooperative statement connected to your main enterprise.',
      recommendations: [
        openRequest ? 'Check the institution, purpose, consent and requested items before sharing anything.' : 'Start with the newest record that explains production, sales or costs.',
        'Keep the original safely; correct dates or amounts instead of silently replacing farmer-reported values.'
      ],
      followUps: ['Which record should I upload first?', 'What does verified mean?'],
      sources
    };
  }

  if (hasAny(question, ['map', 'mapped', 'mapping', 'area', 'location', 'boundary', 'gps', 'ramani', 'eneo', 'mpaka'])) {
    const unmapped = context.farms.find((farm) => !farm.mapped);
    if (unmapped) sources.push({ label: 'Farm profile saved on this phone', freshness: 'Location record available', limitation: 'A mapped boundary does not prove ownership or agronomic conditions.' });
    return {
      intent: 'farm_mapping',
      answer: unmapped
        ? `${unmapped.name} is not mapped yet. Mapping can add area and location context, while reported area and measured area remain separate.`
        : context.farms.length
          ? 'Your saved farm locations are mapped. Reported area and measured area remain separate so a map does not silently overwrite what you reported.'
          : 'No farm is saved yet, so there is no location context for farm mapping.',
      recommendations: unmapped ? ["Map the farm only with the farmer's permission and review the boundary before saving.", 'Compare reported and measured areas and flag differences for review.'] : ['Review each saved boundary and correct it if it does not match the farm.', 'Use mapped context as a guide, not as proof of ownership or production.'],
      followUps: ['What does measured area mean?', 'What can farm mapping unlock?'],
      sources
    };
  }

  if (hasAny(question, ['passport', 'profile', 'identity', 'readiness', 'finance', 'financing', 'loan', 'consent', 'permission', 'wasifu', 'kitambulisho', 'ruhusa'])) {
    const passport = context.passport;
    if (passport) sources.push(source('Mkulima Passport on this phone', passport.lastUpdated, 'Readiness is a data completeness view, not a lending decision or approval.'));
    const openConsents = context.consents.filter((consent) => consent.status === 'active' || consent.status === 'pending');
    return {
      intent: 'passport',
      answer: passport
        ? `${passport.readinessLabel}. Identity is ${passport.identityVerified ? 'marked verified' : 'not marked verified'}; profile status is ${passport.profileStatus}; evidence status is ${passport.evidenceStatus}; record freshness is ${passport.recordFreshness}.`
        : 'Your Mkulima Passport is not available in the saved data yet.',
      recommendations: passport
        ? ['Review stale or missing records and correct information through the app rather than guessing.', openConsents.length ? `Review ${openConsents.length} active or pending consent${openConsents.length === 1 ? '' : 's'} before sharing data.` : 'Review consent settings before sharing data with an institution.']
        : ['Complete the farmer profile and add a farm before relying on Passport context.'],
      followUps: ['Which records improve my Passport?', 'What permissions are active?'],
      sources
    };
  }

  if (hasAny(question, ['sync', 'offline', 'internet', 'pending', 'uploading', 'connection', 'mtandao', 'nje ya mtandao'])) {
    if (pending) sources.push({ label: 'Local sync queue', freshness: 'Current device state', limitation: 'A queued item is not accepted by a server until sync succeeds.' });
    return {
      intent: 'sync',
      answer: pending
        ? `${pending} update${pending === 1 ? '' : 's'} are saved on this phone and waiting to sync. Retrying is designed to reduce duplicate submissions.`
        : 'No unsynchronized update is visible in the local queue. This does not prove a server accepted every historical submission.',
      recommendations: pending ? ['Keep the app open when connected and retry Sync & offline.', 'Do not create duplicates while an item is pending; check its state first.'] : ['Refresh when connected and check the Sync & offline screen for any retry or conflict.', 'Keep important originals until the server confirms acceptance.'],
      followUps: ['Why is an item waiting to sync?', 'What does conflict mean?'],
      sources
    };
  }

  if (hasAny(question, ['next', 'action', 'do first', 'important', 'recommend', 'update first', 'help', 'nini nifanye', 'hatua', 'muhimu'])) {
    const next = attention?.action ?? attention?.explanation ?? (openRequest ? `review ${openRequest.items[0] ?? 'the open document request'}` : context.farms.some((farm) => !farm.mapped) ? 'map the farm location' : context.records.length === 0 ? 'add a recent farm record' : 'record the latest production or cost');
    if (attention) sources.push(source(attention.sourceLabel, attention.updatedAt, attention.limitation));
    return {
      intent: 'next_actions',
      answer: `A useful next action is to ${next}. ${attention?.explanation ?? 'This keeps your farmer-reported information current and easier to review.'}`,
      recommendations: ['Complete one small update with its date, amount and source before starting another.', 'Review the result and correct it if it does not match what happened on the farm.'],
      followUps: ['What should I update after that?', 'Show my record freshness'],
      sources
    };
  }

  return {
    intent: 'general',
    answer: 'I can use the farmer-safe data saved on this phone to explain weather, markets, production, costs, records, farm mapping, your Passport, sync status and next actions.',
    recommendations: ['Ask about one topic at a time for a clearer answer.', 'Use the source and freshness notes before acting on an answer.'],
    followUps: ['What should I update first?', 'What is my latest weather?'],
    sources: context.passport ? [source('Mkulima Passport on this phone', context.passport.lastUpdated, 'This assistant cannot see institution-only rules.')] : []
  };
}

function noData(intent: AskMkulimaIntent, answer: string, recommendations: string[], followUps: string[], sourceLabel: string): IntentResult {
  return { intent, answer, recommendations, followUps, sources: [{ label: sourceLabel, freshness: 'No usable saved data', limitation: 'The assistant will not invent missing live data.' }] };
}

function makeReply(answer: string, intent: AskMkulimaIntent, recommendations: string[], followUps: string[], sources: AskMkulimaSource[], limitations: string[] = [], confidence?: AskMkulimaMessageMetadata['confidence'], language: 'en' | 'sw' = 'en'): AskMkulimaReply {
  const metadata: AskMkulimaMessageMetadata = {
    intent,
    sources,
    recommendations,
    followUps,
    limitations: [...limitations, localLimitation],
    localOnly: true,
    confidence: confidence ?? (sources.length >= 2 ? 'high' : sources.length === 1 ? 'medium' : 'low'),
    provider: 'local-free',
    model: 'mkulima-local-reasoner-v2',
    latencyMs: 0
  };
  const swahili = language === 'sw';
  const sourceText = sources.length ? `\n\n${swahili ? 'Chanzo na muda' : 'Source & freshness'}: ${sources.map((item) => `${item.label} (${item.freshness})`).join('; ')}.` : `\n\n${swahili ? 'Chanzo na muda' : 'Source & freshness'}: ${swahili ? 'Hakuna data ya kuhakiki.' : 'No supporting saved data was available.'}`;
  const limitationText = `\n\n${swahili ? 'Mipaka' : 'Limitations'}: ${metadata.limitations.join(' ')}`;
  const recommendationText = recommendations.length ? `\n\n${swahili ? 'Hatua zinazopendekezwa' : 'Suggested next steps'}:\n- ${recommendations.join('\n- ')}` : '';
  const confidenceText = `\n\n${swahili ? 'Kiwango cha uhakika' : 'Confidence'}: ${confidenceLabel(metadata.confidence, swahili)}`;
  return { text: `${swahili ? 'Jibu la Mkulima: ' : ''}${answer}${recommendationText}${sourceText}${limitationText}${confidenceText}`, metadata };
}

function confidenceLabel(confidence: AskMkulimaMessageMetadata['confidence'], swahili: boolean) {
  if (swahili) return confidence === 'high' ? 'Juu' : confidence === 'medium' ? 'Wastani' : 'Chini';
  return confidence.charAt(0).toUpperCase() + confidence.slice(1);
}

function source(label: string, updatedAt: string, limitation?: string): AskMkulimaSource {
  return { label, freshness: freshness(updatedAt), ...(limitation ? { limitation } : {}) };
}

function freshness(updatedAt: string) {
  if (!updatedAt) return 'Freshness unavailable';
  const timestamp = new Date(updatedAt).getTime();
  if (!Number.isFinite(timestamp)) return 'Freshness unavailable';
  const ageMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (ageMinutes < 60) return 'Updated less than 1 hr ago';
  if (ageMinutes < 1440) return `Updated ${Math.round(ageMinutes / 60)} hr ago`;
  if (ageMinutes < 10080) return `Updated ${Math.round(ageMinutes / 1440)} days ago`;
  return `Updated ${Math.round(ageMinutes / 10080)} weeks ago / stale`;
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
  if (hasAny(question, ['why', 'explain', 'eleza']) && question.split(' ').length <= 5) {
    return `${intent} ${question}`;
  }
  return question;
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
      return makeReply(refusal, 'general', [], ['What can I safely update next?'], [], ['Institution-only scoring rules are not available in this app.'], undefined, context.language);
    }
    const localReply = async (note: string) => {
      const reply = await this.fallback.ask(question, context, history);
      return { ...reply, text: `${reply.text}\n\n${note}`, metadata: { ...reply.metadata, localOnly: true } };
    };
    const token = await getAccessToken();
    if (!token) {
      return localReply('This answer used records saved on this phone. Sign in when you want the live assistant.');
    }
    const requestId = Crypto.randomUUID();
    const endpoint = getAskMkulimaEndpoint(this.baseUrl);
    if (!endpoint) {
      return localReply('The assistant is not configured, so this used the farmer-safe data on this phone.');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const startedAt = Date.now();
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}`, 'X-Request-ID': requestId },
        body: JSON.stringify({ question, context: projectSafeContext(context), history: history.slice(-8), requestId, audit: { action: 'ask_mkulima', client: 'mkulima-farmer', schemaVersion: 'v1' } }),
        signal: controller.signal
      });
      if (response.status === 401 || response.status === 403) {
        return localReply('The live assistant needs a fresh sign-in. This answer used records saved on this phone.');
      }
      if (response.status === 408 || response.status === 429) {
        return localReply('The live assistant is busy. This answer used records saved on this phone.');
      }
      if (response.status === 404 || response.status === 501 || response.status === 502 || response.status === 503 || !response.ok) {
        return localReply('The live assistant was not available, so this used the farmer-safe data on this phone.');
      }
      const payload = await response.json() as Partial<AskMkulimaReply>;
      if (!payload.text) {
        return localReply('The live assistant returned an empty answer, so this used records on this phone.');
      }
      const latencyMs = Date.now() - startedAt;
      return {
        text: payload.text,
        metadata: {
          ...(payload.metadata ?? {
            intent: 'general',
            sources: [{ label: 'Farmer assistant service', freshness: 'Freshness supplied by service', limitation: 'Remote responses must be checked against the saved records.' }],
            recommendations: [],
            followUps: [],
            limitations: [localLimitation],
            localOnly: false,
            confidence: 'medium',
            requestId
          }),
          localOnly: payload.metadata?.localOnly ?? false,
          requestId: payload.metadata?.requestId ?? requestId,
          latencyMs: payload.metadata?.latencyMs ?? latencyMs
        }
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return localReply('The live assistant took too long, so this used records saved on this phone.');
      }
      return localReply('The live assistant could not be reached, so this used records saved on this phone.');
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

