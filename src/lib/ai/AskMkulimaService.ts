import { getAccessToken } from '@/lib/auth/tokenStore';
import { getAskMkulimaEndpoint } from '@/lib/ai/AskMkulimaIntegration';
import { knowledgeLines, searchAgriKnowledge } from '@/lib/ai/agriKnowledge';
import { detectAskDraft } from '@/lib/ai/askDraft';
import { classifyAskRisk, highRiskAnswer } from '@/lib/ai/askPolicy';
import { buildFarmerContextPacket } from '@/lib/ai/farmerContext';
import { detectAskLanguage, localizeAskList, localizeAskText } from '@/lib/i18n/askLanguage';
import { fieldConditionLine } from '@/lib/eo/farmerCopy';
import { inferFarmCycle } from '@/lib/intelligence/cycle';
import { buildEarlyWarnings, rankActiveWarnings } from '@/lib/warnings/engine';
import * as Crypto from 'expo-crypto';
import type { AskDraft, AskRisk } from '@/domain/ask';
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

export type AskMkulimaAskOptions = {
  imageDataUrl?: string;
  attachmentId?: string;
};

export type AskActionConfirmPayload = {
  type: string;
  label?: string;
  farmId?: string;
  summary?: string;
  field?: string;
  proposedValue?: string;
  reason?: string;
  kind?: string;
  narrative?: string;
  attachmentId?: string;
  alertId?: string;
  impactType?: string;
  question?: string;
  confirmed?: boolean;
};

export type AskAttachmentResult = {
  id: string;
  status: string;
  provisional?: boolean;
  note?: string;
};

export interface AskMkulimaClient {
  ask(question: string, context: AskMkulimaContext, history: AskMkulimaMessage[], options?: AskMkulimaAskOptions): Promise<AskMkulimaReply>;
  confirmAction?(actionId: string, payload: AskActionConfirmPayload): Promise<{ status: string; note?: string }>;
  registerAttachment?(input: { farmId?: string; contentType?: string; byteSize?: number; purpose?: string }): Promise<AskAttachmentResult | null>;
}

const refusal = 'I can talk about your farm, records and Passport. I cannot promise a loan or show a score.';
const localLimitation = 'This uses what is saved on this phone. It is not a farm visit, a price promise, or a loan decision.';

type IntentResult = {
  intent: AskMkulimaIntent;
  answer: string;
  recommendations: string[];
  followUps: string[];
  sources: AskMkulimaSource[];
  limitations?: string[];
  confidence?: AskMkulimaMessageMetadata['confidence'];
  draft?: AskDraft;
  risk?: AskRisk;
};

class DemoAskMkulimaClient implements AskMkulimaClient {
  async ask(question: string, context: AskMkulimaContext, history: AskMkulimaMessage[] = [], options?: AskMkulimaAskOptions): Promise<AskMkulimaReply> {
    const scoped = scopeContext(context);
    const language = detectAskLanguage(question, scoped.language);
    const normalized = resolveFollowUp(normalizeQuestion(question), history);
    if (options?.imageDataUrl || options?.attachmentId) {
      return makeReply(
        'I can look at a photo when you are online with the live assistant. Offline I will not invent a diagnosis from an image. Describe what you see, how widespread it is, and whether animals or people are affected.',
        'alerts',
        ['Take the photo when you have a signal, or ask an officer to look with you.'],
        ['How is my production?', 'How is the weather for my farm?'],
        [source('Photo assessment', '', 'A photo alone cannot confirm the cause.')],
        ['Photo findings stay provisional until a field check.'],
        'medium',
        language,
        {
          risk: 'medium',
          actionCards: [
            { type: 'report_pest_or_disease', label: 'Save provisional incident' },
            { type: 'escalate_to_officer', label: 'Ask an officer' }
          ],
          requiresConfirmation: true
        }
      );
    }
    if (mentionsRestrictedTopic(normalized)) {
      return makeReply(refusal, 'general', [], ['How is the weather for my farm?', 'How is my production?'], [], ['Loan and score rules stay with the institution.'], undefined, language);
    }
    const risk = classifyAskRisk(normalized);
    if (risk === 'high') {
      const blocked = highRiskAnswer(normalized, language);
      return makeReply(blocked.answer, blocked.intent, blocked.recommendations, blocked.followUps, [], ['High-risk advice needs a registered label or a veterinary officer.'], 'high', language, { risk });
    }
    const draft = detectAskDraft(normalized, scoped, language);
    if (draft) {
      return makeReply(draft.prompt, 'draft', ['Nothing is saved until you confirm.'], ['How is my production?'], [source('Conversation draft', '', 'Ask Mkulima may draft a record. It cannot save, update or delete farm evidence on its own.')], ['I will not change your farm book unless you confirm.'], 'high', language, { draft, risk });
    }
    const result = routeQuestion(normalized, scoped);
    return makeReply(result.answer, result.intent, result.recommendations, result.followUps, result.sources, result.limitations, result.confidence, language, { risk: result.risk ?? risk, draft: result.draft });
  }

  async confirmAction(_actionId: string, _payload: AskActionConfirmPayload) {
    return { status: 'ACCEPTED', note: 'Saved on this phone as provisional until you sync.' };
  }

  async registerAttachment() {
    return null;
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
  const talk = farmTalk(context);

  if (hasAny(question, ['my score', 'improve my score', 'increase my score', 'gain points', 'readiness score', 'how can i improve'])) {
    const gaps = profileGaps(context);
    sources.push(source('Mkulima Passport on this phone', context.passport?.lastUpdated ?? '', 'This is a next action from missing facts, not a score or points.'));
    return {
      intent: 'next_actions',
      answer: gaps.length
        ? `Based on your records, the profile still needs you to ${gaps.join(', then ')}. I will not invent points or say a change will raise a score.`
        : 'Based on your records, the main farm facts are in place. Keep production current. I will not invent a score improvement.',
      recommendations: gaps.length ? [`Start with: ${gaps[0]}.`] : ['Keep the latest milk, harvest or sale current.'],
      followUps: ['How is my production?', 'How is the weather for my farm?'],
      sources,
      risk: 'low'
    };
  }

  if (hasAny(question, ['should i plant', 'plant tomorrow', 'plant today', 'nipande', 'kupanda kesho'])) {
    const cycle = inferFarmCycle(context.enterprises, context.activity ?? []);
    const weatherLine = weather
      ? `${weather.condition.toLowerCase()} at ${talk.place}, about ${weather.rainProbabilityPct}% chance of rain.`
      : 'I do not have a forecast for the farm place yet.';
    if (weather) sources.push(source('Farm weather forecast', weather.updatedAt, 'A forecast can change. Check the field before you plant.'));
    return {
      intent: 'weather',
      answer: layered(
        primaryEnterprise
          ? `${primaryEnterprise.name} is on this farm. ${cycle.line} You have not asked me to mark this season as planted.`
          : `I do not yet have a crop enterprise for ${talk.farmLine}.`,
        weatherLine,
        'Confirm that the topsoil has received enough moisture rather than relying on the forecast alone. I will not tell you to plant from a chat answer.'
      ),
      recommendations: ['Look at the soil on the farm before you plant.'],
      followUps: ['How is the weather for my farm?', 'How is my production?'],
      sources,
      risk: 'medium'
    };
  }

  if (hasAny(question, ['how is my maize', 'how is my field', 'how is the crop', 'field looking', 'how is my crop'])) {
    const field = fieldConditionLine(context.farms[0], context.climate);
    if (climate) sources.push(source(climate.sourceLabel || 'Field note on this phone', climate.updatedAt, 'Satellite or season notes cannot name a cause. A photo can help later.'));
    return {
      intent: 'climate',
      answer: layered(
        primaryEnterprise ? `${primaryEnterprise.name} is recorded at ${primaryEnterprise.productionValue} ${primaryEnterprise.productionMetric}.` : 'No crop enterprise is saved yet.',
        field ?? 'I do not have a field-condition note for this farm yet.',
        'Satellite or a saved look cannot identify a pest or disease. If a patch looks weaker, photograph the whole plant and the underside of a leaf. I will not name a definite cause from this alone.'
      ),
      recommendations: ['Walk the weaker section before you add more inputs.'],
      followUps: ['How is the weather for my farm?', 'Where can I get veterinary help near my farm?'],
      sources,
      risk: 'medium'
    };
  }

  const knowledge = knowledgeAnswer(question, context, talk, sources);
  if (knowledge) return knowledge;

  if (isGreeting(question) && !hasAny(question, ['weather', 'rain', 'price', 'bei', 'fertil', 'mbolea'])) {
    return {
      intent: 'chat',
      answer: `Habari${talk.firstName ? `, ${talk.firstName}` : ''}. I am here for ${talk.farmLine}. ${talk.oneLiner} Ask me anything about the farm — I will answer from what we actually have.`,
      recommendations: [],
      followUps: ['How is the weather for my farm?', 'What is the latest price near me?'],
      sources: talk.sources
    };
  }

  if (isThanks(question)) {
    return {
      intent: 'chat',
      answer: `Karibu${talk.firstName ? `, ${talk.firstName}` : ''}. I am still here if something else comes up on ${farmName}.`,
      recommendations: [],
      followUps: ['How is the weather for my farm?', 'How is my production?'],
      sources: talk.sources
    };
  }

  if (hasAny(question, ['who are you', 'what are you', 'what can you', 'what do you do', 'help me ask', 'nani wewe'])) {
    return {
      intent: 'chat',
      answer: `I am Ask Mkulima — a neighbour in the phone for ${talk.farmLine}. We can talk about weather, nearby listed places, reported produce prices, or what you already recorded. I will not invent a fertilizer quote or promise a loan.`,
      recommendations: [],
      followUps: ['How is the weather for my farm?', 'Where can I sell near my farm?'],
      sources: talk.sources
    };
  }

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
        answer: `Based on the forecast for your farm place, not a guess from me: ${weather.farmName} looks ${weather.condition.toLowerCase()}, ${weather.temperatureLowC} to ${weather.temperatureHighC}C. ${rain} ${weather.fieldActivityNote}${days}`,
        recommendations: [
          weather.rainProbabilityPct >= 60
            ? 'Protect harvested produce and finish urgent field work before the rain.'
            : 'Look at the soil before you spray or apply inputs.'
        ],
        followUps: nextDays.length ? ['Show the next 3 days', 'How is my production?'] : ['How is my production?', 'What is the latest price near me?'],
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

  if (hasAny(question, ['alert', 'warning', 'urgent', 'onyo', 'tahadhari', 'hatari', 'preparedness', 'early warning'])) {
    const farm = context.farms[0];
    const ews = rankActiveWarnings(buildEarlyWarnings({
      farm,
      enterprises: context.enterprises.filter((item) => !farm || item.farmId === farm.id),
      weather: context.weather[0],
      exposure: farm?.exposure,
      language: context.language === 'sw' ? 'sw' : 'en'
    }));
    if (ews[0]) {
      const top = ews[0];
      sources.push(source(top.sourceLabel, top.issuedAt, 'Preparedness watches are not official KMD or NDMA warnings unless labelled Official.'));
      return {
        intent: 'alerts',
        answer: `${top.title}. ${top.plainLanguageMessage} First action: ${top.actions[0]?.label ?? 'Stay safe'}. Open Early warning for the full plan.`,
        recommendations: top.actions.slice(0, 3).map((action) => action.label),
        followUps: ['How is the weather for my farm?', 'What should I do after heavy rain?'],
        sources
      };
    }
    if (alert) {
      sources.push(source('Saved farm alerts on this phone', alert.createdAt, 'An alert is a reminder from saved data, not a guarantee.'));
      return {
        intent: 'alerts',
        answer: `${alert.title}. ${alert.detail}${alert.relatedEntityLabel ? ` This is about ${alert.relatedEntityLabel}.` : ''} Check the farm before you change a plan.`,
        recommendations: ['Open the related record if you need the date or amount.'],
        followUps: ['How is the weather for my farm?', 'How is my production?'],
        sources
      };
    }
    return noData('alerts', 'No farm alert or preparedness watch is waiting on this phone.', [], ['How is the weather for my farm?', 'How is my production?'], 'Farm alerts');
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
        followUps: ['What is the latest price near me?', 'How is my production?'],
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
        answer: `Based on the diary you added, the last update I can see is “${hit.title}” on ${hit.occurredAt.slice(0, 10)}. ${hit.detail} Added by you — not checked during a farm visit.`,
        recommendations: ['Record today’s milk or herd from Activity.'],
        followUps: ['How is my production?', 'How is the weather for my farm?'],
        sources
      };
    }
    return noData('production', 'No milk or herd update is saved yet. I will not guess the last date.', ['Record today’s milk or herd from Activity.'], ['How do I record today’s production?'], 'Farm diary');
  }

  if (hasAny(question, ['profile incomplete', 'why is my profile', 'missing from my', 'haujakamilika', 'medium-low', 'why did i get this'])) {
    const gaps = profileGaps(context);
    sources.push(source('Mkulima Passport on this phone', context.passport?.lastUpdated ?? '', 'This is about missing facts, not a score.'));
    return {
      intent: 'next_actions',
      answer: gaps.length
        ? `Based on your records, your profile still needs you to ${gaps.join(', then ')}. None of this promises a loan or changes a score.`
        : 'Based on your records, the main farm facts are in place. Keep production current so the record stays useful.',
      recommendations: gaps.length ? [`Start with: ${gaps[0]}.`] : ['Keep the latest milk, harvest or sale current.'],
      followUps: ['How large is this farm?', 'How is the weather for my farm?'],
      sources
    };
  }

  if (isPlaceQuestion(question)) {
    return placesAnswer(question, context, talk, sources);
  }

  if (hasAny(question, ['fertil', 'mbolea', 'dap', 'urea', 'npk', 'c.a.n', ' can ', 'agrovet', 'mbegu', 'seed price', 'input price'])) {
    const savedActivity = (context.activity ?? []).find((item) => /fertil|mbolea|dap|urea|npk|seed|input|feed/i.test(`${item.title} ${item.detail}`));
    const savedRecord = context.records.find((record) => /fertil|mbolea|dap|urea|npk|seed|input|feed/i.test(`${record.category} ${record.title}`));
    const savedLine = savedActivity ? `${savedActivity.title} (${savedActivity.detail})` : savedRecord?.title;
    const savedAt = savedActivity?.occurredAt ?? savedRecord?.documentDate ?? '';
    const nearbyCrops = produceBoard(context.markets, 6).join('; ');
    const fertilizerQuote = context.markets.find((item) => /fertil/i.test(item.commodity));
    const inputShop = (context.places ?? []).find((item) => item.category === 'inputs');
    if (savedLine) sources.push(source('Input cost on this phone', savedAt, 'This is what you saved, not an agrovet quote.'));
    if (context.markets[0]) sources.push(source('Latest reported market prices near the farm', context.markets[0].updatedAt, 'KAMIS reports crop and milk prices, not agrovet fertilizer bags.'));
    const shopLine = inputShop
      ? ` A listed input shop is ${inputShop.name}, ${inputShop.distanceLabel} — ${inputShop.verificationLabel.toLowerCase()}.`
      : ' I do not have a listed agrovet near this farm yet.';
    return {
      intent: 'markets',
      answer: fertilizerQuote
        ? `Near ${talk.place}, a Ministry fertilizer report is ${fertilizerQuote.observedPrice} at ${fertilizerQuote.marketScope}. That is not a shop quote.${shopLine}${nearbyCrops ? ` Nearby produce: ${nearbyCrops}.` : ''} Confirm the bag at your agrovet.`
        : savedLine
          ? `Near ${talk.place}, I do not have a nearby Ministry fertilizer quote. I will not invent DAP or CAN. The last input you saved is ${savedLine}.${shopLine}${nearbyCrops ? ` Nearby reported produce: ${nearbyCrops}.` : ''} Confirm the bag price at the shop.`
        : `Near ${talk.place}, I do not have a nearby Ministry fertilizer quote. I will not invent DAP or CAN.${shopLine}${nearbyCrops ? ` Nearby reported produce: ${nearbyCrops}.` : ''} Add the agrovet you use if it is missing.`,
      recommendations: [inputShop ? 'Confirm the bag price at that shop. A listed place is not a price quote.' : 'Add the agrovet you use, then save the receipt with amount and date.'],
      followUps: ['Where can I buy inputs near my farm?', 'What is the latest price near me?'],
      sources
    };
  }

  if (hasAny(question, ['market', 'price', 'sell', 'buyer', 'selling', 'bei', 'soko', 'mnunuzi', 'kuuza', 'tomato', 'nyanya', 'beans', 'maharagwe', 'potato', 'viazi', 'onion', 'kitunguu', 'kale', 'sukuma', 'cabbage', 'avocado', 'mango', 'banana', 'ndizi', 'rice', 'mchele'])) {
    const named = context.markets.find((item) => question.includes(item.commodity.toLocaleLowerCase()));
    const board = produceBoard(context.markets);
    if (named || board.length) {
      sources.push(source('Latest reported market prices near the farm', named?.updatedAt ?? context.markets[0]?.updatedAt ?? '', 'A reported price is not what your buyer or agrovet must charge.'));
      const own = named?.farmerRecordedPrice ? ` Your last saved sale was ${named.farmerRecordedPrice}.` : '';
      const focus = named
        ? `${named.commodity} at ${named.marketScope} is ${named.observedPrice}. ${named.movementLabel}.`
        : `Latest reported: ${board.join('; ')}.`;
      return {
        intent: 'markets',
        answer: layered(
        primaryEnterprise ? `${primaryEnterprise.name} is on this farm.` : `I am using the farm place at ${talk.place}.`,
        `Near ${talk.place}: ${focus} ${named?.interpretation ?? 'These are Ministry reported prices, not a live shop offer.'}${own}`,
        hasAny(question, ['should i sell', 'where should i sell', 'which market'])
          ? 'I do not have your transport cost, so I cannot say which option leaves more net income. Confirm the price at the market.'
          : 'Confirm the final price at the market. A reported figure is not what your buyer must pay.'
      ),
        recommendations: [
          named?.farmerRecordedPrice ? 'Compare this with your receipt, grade and quantity.' : 'Save your latest sale: price, quantity, buyer and date.'
        ],
        followUps: board.length > 1 ? ['What is the tomato price?', 'What fertilizer cost have I saved?'] : ['What fertilizer cost have I saved?', 'How is my production?'],
        sources
      };
    }
    return noData('markets', `I do not have a nearby market price for ${talk.place} yet. I will not invent one.`, ['Add a sale when you are paid.'], ['How do I record a sale?'], 'Market reference');
  }

  if (hasAny(question, ['cost', 'expense', 'spend', 'profit', 'margin', 'gharama', 'matumizi'])) {
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
      followUps: ['How is my production?', 'How is the weather for my farm?'],
      sources
    };
  }

  if (hasAny(question, ['production', 'yield', 'harvest', 'output', 'enterprise', 'performance', 'mazao', 'mavuno', 'maziwa', 'uzalishaji'])) {
    if (primaryEnterprise) {
      sources.push(source('Production on this phone', context.passport?.lastUpdated ?? '', 'This is what you recorded, not an independent measurement.'));
      const trend = primaryEnterprise.trendLabel ? ` ${primaryEnterprise.trendLabel}.` : '';
      return {
        intent: 'production',
        answer: `Based on the ${primaryEnterprise.name} information you added, it is recorded at ${primaryEnterprise.productionValue} ${primaryEnterprise.productionMetric}.${trend} ${primaryEnterprise.summary} Added by you — not checked during a farm visit.`,
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
      followUps: ['How is my production?', 'What does verified mean?'],
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
      followUps: ['How is the weather for my farm?', 'How is my production?'],
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
      followUps: ['How is my production?', 'How is the weather for my farm?'],
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
      followUps: ['How is the weather for my farm?', 'How is my production?'],
      sources
    };
  }

  if (hasAny(question, ['what should i do first', 'what do i do first', 'what should i update', 'update first', 'nini nifanye kwanza', 'nifanye nini kwanza', 'what is the next step'])) {
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

  if (isOpenAskQuestion(question) || question.split(' ').length >= 3) {
    return openConversationAnswer(question, context, talk);
  }

  return {
    intent: 'chat',
    answer: `${talk.firstName ? `${talk.firstName}, I ` : 'I '}am listening. Ask me about farming, weather, markets, your records, or a general question. I will use your farm book and published guidance, and I will say when I do not know.`,
    recommendations: [],
    followUps: ['How is the weather for my farm?', 'What is the latest price near me?', 'How is my production?'],
    sources: talk.sources
  };
}

function isPlaceQuestion(question: string) {
  return hasAny(question, [
    'where can i sell',
    'where should i sell',
    'where to sell',
    'where do i sell',
    'nearest market',
    'nearby market',
    'where can i buy',
    'where to buy',
    'agrovet near',
    'input shop',
    'collection centre',
    'collection center',
    'milk collection',
    'veterinary',
    'vet near',
    'nearest vet',
    'cooperative near',
    'sacco near',
    'where is my cooperative',
    'places near'
  ]);
}

function placesAnswer(
  question: string,
  context: AskMkulimaContext,
  talk: ReturnType<typeof farmTalk>,
  sources: AskMkulimaSource[]
): IntentResult {
  const places = context.places ?? [];
  const wantsInputs = hasAny(question, ['buy', 'input', 'agrovet', 'fertil', 'seed', 'mbegu', 'mbolea']);
  const wantsVet = hasAny(question, ['vet', 'veterinary', 'animal', 'daktari']);
  const wantsCoop = hasAny(question, ['coop', 'sacco', 'collection', 'milk']);
  const wanted = places.filter((place) => {
    if (wantsInputs) return place.category === 'inputs';
    if (wantsVet) return place.category === 'services' || place.category === 'support';
    if (wantsCoop) return place.category === 'cooperatives' || place.category === 'collection';
    return place.category === 'markets' || place.category === 'collection' || place.category === 'cooperatives';
  });
  const shown = (wanted.length ? wanted : places).slice(0, 3);
  sources.push(source('Mkulima Places near the farm', '', 'Listed is not the same as verified. Distance is from the farm place, not the phone.'));
  if (!shown.length) {
    return {
      intent: 'places',
      answer: `Near ${talk.place}, I do not have a listed ${wantsInputs ? 'input shop' : wantsVet ? 'vet' : wantsCoop ? 'collection point' : 'market'} yet. I will not invent one. Add the place you actually use.`,
      recommendations: ['Open Near your farm and add the place name, type and GPS.'],
      followUps: ['What is the latest price near me?', 'How is the weather for my farm?'],
      sources
    };
  }
  const lines = shown.map((place) => {
    const extra = place.priceLabel ?? place.services.slice(0, 2).join(' · ');
    return `${place.name}, ${place.distanceLabel}${extra ? `, ${extra}` : ''}`;
  }).join('; ');
  const honesty = shown.some((place) => place.verification === 'FIELD_VERIFIED' || place.verification === 'PARTNER_CONFIRMED')
    ? 'A verified location has been confirmed. Others are listed only.'
    : 'These are listed places, not verified shops.';
  return {
    intent: 'places',
    answer: `Based on places listed near ${talk.farmLine}: ${lines}. ${honesty} Confirm before you travel. I will not invent a shop that is not listed.`,
    recommendations: ['Open the place for directions. Add a missing shop if you use one that is not listed.'],
    followUps: ['What is the latest price near me?', 'What fertilizer cost have I saved?'],
    sources
  };
}

function knowledgeAnswer(
  question: string,
  context: AskMkulimaContext,
  talk: ReturnType<typeof farmTalk>,
  sources: AskMkulimaSource[]
): IntentResult | null {
  if (!hasAny(question, [
    'armyworm', 'blight', 'wilt', 'pest', 'disease', 'what is wrong',
    'yellow leaves', 'spots', 'scout', 'extension', 'kalro', 'pcpb', 'cabi',
    'plant maize', 'soil', 'feed', 'compost', 'manure', 'irrigation', 'weeding',
    'drought', 'fall armyworm', 'yellowing', 'wilted', 'fungus', 'ticks'
  ])) return null;
  const enterprise = context.enterprises.find((item) => item.primary) ?? context.enterprises[0];
  const hits = searchAgriKnowledge(question, enterprise?.sector, 4, context.language);
  if (!hits.length) return null;
  hits.forEach((hit) => {
    sources.push(source(`${hit.sourceOrganisation} guidance`, '', `Tier ${hit.authorityTier}. Published guidance, not a farm visit. ${hit.sourceUrl}`));
  });
  return {
    intent: 'general',
    answer: layered(
      enterprise ? `${enterprise.name} is on this farm book.` : `I am looking at ${talk.farmLine}.`,
      talk.oneLiner,
      knowledgeLines(hits).join(' ')
    ),
    recommendations: ['Use this with what you see on the farm. I will not name a spray or a dose.'],
    followUps: ['How is the weather for my farm?', 'Where can I buy inputs near my farm?'],
    sources,
    risk: 'medium'
  };
}

/** Agricultural or everyday questions that should get a real answer, not a redirect to “update your profile”. */
function isOpenAskQuestion(question: string) {
  return hasAny(question, [
    'what is', 'what are', 'what does', 'how do', 'how can', 'how to', 'why', 'when should', 'when to',
    'tell me', 'explain', 'ni nini', 'nifanyeje', 'inafanyaje', 'kwa nini', 'linamaanisha',
    'maize', 'mahindi', 'dairy', 'milk', 'maziwa', 'coffee', 'kahawa', 'tea', 'chai',
    'avocado', 'poultry', 'kuku', 'beans', 'ndengu', 'potato', 'viazi', 'tomato', 'nyanya',
    'rice', 'mchele', 'livestock', 'ngombe', "ng'ombe", 'soil', 'udongo', 'rain', 'mvua',
    'drought', 'ukame', 'fertilizer', 'mbolea', 'compost', 'manure', 'samadi', 'irrigation',
    'weeding', 'harvest', 'mavuno', 'planting', 'kupanda', 'feed', 'chakula cha ngombe',
    'season', 'mawazo', 'agriculture', 'farming', 'kilimo', 'crop', 'zao',
    'who is', 'where is kenya', 'capital of', 'hello neighbour', 'good day'
  ]);
}

function openConversationAnswer(
  question: string,
  context: AskMkulimaContext,
  talk: ReturnType<typeof farmTalk>
): IntentResult {
  const enterprise = context.enterprises.find((item) => item.primary) ?? context.enterprises[0];
  const hits = searchAgriKnowledge(question, enterprise?.sector, 3, context.language);
  const sources: AskMkulimaSource[] = [...talk.sources];
  hits.forEach((hit) => {
    sources.push(source(`${hit.sourceOrganisation} guidance`, '', `Tier ${hit.authorityTier}. Published guidance, not a farm visit.`));
  });
  const knowledgeBit = hits.length ? knowledgeLines(hits).join(' ') : null;
  const farmBit = enterprise
    ? `${enterprise.name} is on your farm book for ${talk.farmLine}.`
    : `Your farm book is open for ${talk.farmLine}.`;
  return {
    intent: 'general',
    answer: knowledgeBit
      ? layered(farmBit, talk.oneLiner, knowledgeBit)
      : layered(
        farmBit,
        talk.oneLiner,
        `About your question: I will answer from published Kenya farm guidance and general knowledge where it is safe. I will not invent a price, a spray, a veterinary dose, or a loan. If this needs a farm visit, county extension or a vet, I will say so.`
      ),
    recommendations: [],
    followUps: ['How is the weather for my farm?', 'What is the latest price near me?', 'How is my production?'],
    sources,
    risk: 'low'
  };
}

function profileGaps(context: AskMkulimaContext) {
  return [
    !context.farms[0]?.latitude ? 'mark the farm place' : null,
    context.farms[0] && !context.farms[0].mapped ? 'walk or draw the farm edge' : null,
    !context.enterprises.length ? 'add what you grow or keep' : null,
    !context.records.length ? 'add a recent production record' : null,
    !context.consents.length && !context.passport?.affiliations.length ? 'connect your cooperative, if you have one' : null
  ].filter((item): item is string => Boolean(item));
}

function layered(records?: string, conditions?: string, suggestion?: string) {
  return [
    records ? `Based on your records: ${records}` : null,
    conditions ? `Based on current conditions: ${conditions}` : null,
    suggestion ? `My suggestion: ${suggestion}` : null
  ].filter(Boolean).join(' ');
}

function produceBoard(markets: AskMkulimaContext['markets'], limit = 8) {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const item of markets) {
    const key = item.commodity.toLocaleLowerCase();
    if (seen.has(key) || !item.observedPrice) continue;
    seen.add(key);
    lines.push(`${item.commodity} ${item.observedPrice} at ${item.marketScope}`);
    if (lines.length >= limit) break;
  }
  return lines;
}

function farmTalk(context: AskMkulimaContext) {
  const farm = context.farms[0];
  const enterprise = context.enterprises.find((item) => item.primary) ?? context.enterprises[0];
  const weather = context.weather[0];
  const market = context.markets[0];
  const firstName = (context.passport?.displayName ?? '').trim().split(/\s+/)[0] || '';
  const place = farm?.location || context.passport?.location || 'your farm place';
  const farmLine = [farm?.name || 'your farm', place].filter(Boolean).join(' in ');
  const oneLiner = weather
    ? `Today looks ${weather.condition.toLowerCase()} at the farm.`
    : enterprise
      ? `${enterprise.name} is recorded at ${enterprise.productionValue} ${enterprise.productionMetric}.`
      : market
        ? `A nearby reported price is ${market.commodity} at ${market.observedPrice}.`
        : 'The farm book is still filling.';
  const sources: AskMkulimaSource[] = [];
  if (weather) sources.push(source('Farm weather forecast', weather.updatedAt, 'A forecast can change.'));
  else if (context.passport) sources.push(source('Mkulima Passport on this phone', context.passport.lastUpdated, 'I use what you saved.'));
  return { firstName, place, farmLine, oneLiner, sources };
}

function talkFacts(context: AskMkulimaContext, question = '') {
  const talk = farmTalk(context);
  const packet = buildFarmerContextPacket(question, context);
  return {
    farmerName: talk.firstName,
    farm: talk.farmLine,
    place: talk.place,
    enterprises: context.enterprises.slice(0, 4).map((item) => `${item.name} ${item.productionValue} ${item.productionMetric}`),
    weather: context.weather[0] ? `${context.weather[0].condition}, ${context.weather[0].temperatureLowC}-${context.weather[0].temperatureHighC}C` : null,
    nearbyPrices: produceBoard(context.markets, 10),
    nearbyPlaces: (context.places ?? []).slice(0, 5).map((item) => `${item.name} ${item.distanceLabel} ${item.category} ${item.verificationLabel}${item.priceLabel ? ` ${item.priceLabel}` : ''}`),
    inputPriceNote: 'KAMIS reports nearby crop and milk prices from the farm place. It does not report agrovet fertilizer bags. Do not invent DAP, CAN, urea or seed shop prices. Listed places are not verified shops unless verification says so.',
    toolsUsed: packet.toolsUsed,
    provenance: packet.facts.map((item) => item.farmerLine),
    risk: packet.risk,
    layers: packet.layers,
    knowledge: searchAgriKnowledge(question, context.enterprises[0]?.sector).map((item) => item.farmerLine),
    rule: 'Farmer facts are SELF_REPORTED until verified. Weather and prices must come from tools, not model memory. Never silently save a record. Never invent a pesticide, dose, or score points.'
  };
}

function statusWords(status: string, verification: string) {
  const verified = /verif/i.test(verification) ? 'checked during a farm visit or by a partner' : 'added by you';
  return `${status.replace(/_/g, ' ')}, ${verified}`;
}

function noData(intent: AskMkulimaIntent, answer: string, recommendations: string[], followUps: string[], sourceLabel: string): IntentResult {
  return { intent, answer, recommendations, followUps, sources: [{ label: sourceLabel, freshness: 'Nothing saved yet', limitation: 'I will not invent missing farm data.' }] };
}

function makeReply(answer: string, intent: AskMkulimaIntent, recommendations: string[], followUps: string[], sources: AskMkulimaSource[], limitations: string[] = [], confidence?: AskMkulimaMessageMetadata['confidence'], language: 'en' | 'sw' = 'en', extras?: {
  draft?: AskDraft;
  risk?: AskRisk;
  actionCards?: AskMkulimaMessageMetadata['actionCards'];
  requiresConfirmation?: boolean;
}): AskMkulimaReply {
  const text = localizeAskText(answer.replace(/\s+/g, ' ').trim(), language);
  const draft = extras?.draft && language === 'sw'
    ? { ...extras.draft, prompt: localizeAskText(extras.draft.prompt, 'sw') }
    : extras?.draft;
  return {
    text,
    metadata: {
      intent,
      sources: sources.map((item) => ({
        ...item,
        label: localizeAskText(item.label, language),
        limitation: item.limitation ? localizeAskText(item.limitation, language) : item.limitation
      })),
      recommendations: localizeAskList(recommendations, language),
      followUps: localizeAskList(followUps, language),
      limitations: localizeAskList([...limitations, localLimitation], language),
      localOnly: true,
      confidence: confidence ?? (sources.length >= 2 ? 'high' : sources.length === 1 ? 'medium' : 'low'),
      provider: 'local-free',
      model: 'mkulima-local-reasoner-v3',
      latencyMs: 0,
      risk: extras?.risk,
      draft,
      actionCards: extras?.actionCards,
      requiresConfirmation: extras?.requiresConfirmation
    }
  };
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
  if (isGreeting(question) || isThanks(question)) return question;
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
    'sale', 'sold', 'niliuza',
    'fertil', 'mbolea', 'dap', 'urea', 'agrovet', 'mbegu',
    'where can i sell', 'where to sell', 'where can i buy', 'nearest market', 'vet', 'cooperative', 'collection', 'places near',
    'plant', 'looking', 'pesticide', 'spray', 'litre', 'lita', 'bags', 'gunia'
  ]);
}

function isGreeting(question: string) {
  return hasAny(question, ['hello', 'habari', 'jambo', 'sasa', 'good morning', 'good afternoon', 'good evening', 'how are you', 'mambo', 'niaje', 'salama', 'hey'])
    || question === 'hi'
    || question.startsWith('hi ')
    || question.startsWith('hi,');
}

function isThanks(question: string) {
  return hasAny(question, ['thank', 'thanks', 'asante', 'nashukuru']);
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

  async ask(question: string, context: AskMkulimaContext, history: AskMkulimaMessage[], options?: AskMkulimaAskOptions): Promise<AskMkulimaReply> {
    if (mentionsRestrictedTopic(normalizeQuestion(question))) {
      return makeReply(refusal, 'general', [], ['How is the weather for my farm?', 'How is my production?'], [], ['Loan and score rules stay with the institution.'], undefined, context.language);
    }
    const hasImage = Boolean(options?.imageDataUrl || options?.attachmentId);
    const draft = await this.fallback.ask(question, context, history, options);
    if (!hasImage && (draft.metadata.risk === 'high' || draft.metadata.draft || draft.metadata.intent === 'draft')) return draft;
    const token = await getAccessToken();
    const endpoint = getAskMkulimaEndpoint(this.baseUrl);
    if (!token || !endpoint) return draft;

    const farm = context.farms[0];
    const earlyWarnings = rankActiveWarnings(buildEarlyWarnings({
      farm,
      enterprises: context.enterprises.filter((item) => !farm || item.farmId === farm.id),
      weather: context.weather[0],
      exposure: farm?.exposure,
      language: detectAskLanguage(question, context.language)
    })).slice(0, 4);

    const requestId = Crypto.randomUUID();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), hasImage ? 45_000 : 22_000);
    const startedAt = Date.now();
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}`, 'X-Request-ID': requestId },
        body: JSON.stringify({
          question,
          language: detectAskLanguage(question, context.language),
          hasAttachment: hasImage,
          attachmentId: options?.attachmentId,
          imageDataUrl: options?.imageDataUrl?.startsWith('data:image/') ? options.imageDataUrl.slice(0, 1_800_000) : undefined,
          context: {
            ...projectSafeContext(context, question),
            farms: context.farms.slice(0, 2).map((item) => ({
              id: item.id,
              name: item.name,
              location: item.location,
              latitude: item.latitude,
              longitude: item.longitude,
              mapped: item.mapped,
              exposure: item.exposure,
              verification: item.verification
            })),
            enterprises: context.enterprises.slice(0, 4),
            weather: context.weather.slice(0, 1),
            markets: context.markets.slice(0, 6),
            alerts: context.alerts.slice(0, 4),
            places: (context.places ?? []).slice(0, 5),
            activity: (context.activity ?? []).slice(0, 6),
            earlyWarnings
          },
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
            sources: draft.metadata.sources,
            facts: talkFacts(context, question)
          },
          requestId,
          audit: { action: 'ask_mkulima', client: 'mkulima-farmer', schemaVersion: 'v2-orchestrator' }
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
          actionCards: payload.metadata?.actionCards ?? [],
          basis: payload.metadata?.basis,
          toolsUsed: payload.metadata?.toolsUsed,
          orchestrator: payload.metadata?.orchestrator,
          localOnly: payload.metadata?.localOnly ?? false,
          requestId: payload.metadata?.requestId ?? requestId,
          latencyMs: payload.metadata?.latencyMs ?? Date.now() - startedAt,
          // Never surface raw model ids to the farmer UI
          model: undefined
        }
      };
    } catch {
      return draft;
    } finally {
      clearTimeout(timeout);
    }
  }

  async confirmAction(actionId: string, payload: AskActionConfirmPayload) {
    const token = await getAccessToken();
    if (!token) return { status: 'AUTH_REQUIRED', note: 'Sign in to confirm this action live.' };
    const response = await fetch(`${this.baseUrl}/api/v1/ask/actions/${encodeURIComponent(actionId)}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...payload, confirmed: payload.confirmed ?? true })
    });
    if (!response.ok) {
      return { status: 'FAILED', note: 'Could not confirm that action. Nothing was overwritten.' };
    }
    const body = await response.json() as { status?: string; note?: string };
    return { status: body.status ?? 'ACCEPTED', note: body.note };
  }

  async registerAttachment(input: { farmId?: string; contentType?: string; byteSize?: number; purpose?: string }) {
    const token = await getAccessToken();
    if (!token) return null;
    const response = await fetch(`${this.baseUrl}/api/v1/ask/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(input)
    });
    if (!response.ok) return null;
    const body = await response.json() as { attachment?: AskAttachmentResult };
    return body.attachment ?? null;
  }
}

function projectSafeContext(context: AskMkulimaContext, question = '') {
  const packet = buildFarmerContextPacket(question, scopeContext(context));
  return {
    packet: {
      farmer: packet.farmer,
      location: packet.location,
      farms: packet.farms,
      enterprises: packet.enterprises,
      toolsUsed: packet.toolsUsed,
      facts: packet.facts.map((item) => ({
        attribute: item.attribute,
        value: item.value,
        source: item.source,
        verification: item.verification,
        confidence: item.confidence,
        farmerLine: item.farmerLine
      })),
      weatherLine: packet.weatherLine,
      marketLines: packet.marketLines,
      placeLines: packet.placeLines,
      profileAction: packet.profileAction,
      risk: packet.risk,
      layers: packet.layers
    },
    screen: context.screenContext ?? null
  };
}

export function createAskMkulimaClient(): AskMkulimaClient {
  const mode = process.env.EXPO_PUBLIC_APP_MODE ?? 'demo';
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (mode === 'demo') return new DemoAskMkulimaClient();
  if (!baseUrl) throw new Error('EXPO_PUBLIC_API_BASE_URL is required outside demo mode.');
  return new ProductionAskMkulimaClient(baseUrl.replace(/\/$/, ''));
}
