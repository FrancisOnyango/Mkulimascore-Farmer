import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT ?? 8787);
const AUTH_MODE = process.env.AUTH_MODE ?? 'development';
const AI_PROVIDER = process.env.AI_PROVIDER ?? 'local';
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
const JWKS_CACHE_MS = 10 * 60 * 1000;

let jwksCache = null;

const localLimitation =
  'This is informational guidance, not an agronomic inspection, price guarantee, credit decision, or proof that a record is verified.';

export function createServer() {
  return http.createServer(async (req, res) => {
    const requestId = req.headers['x-request-id']?.toString() || crypto.randomUUID();
    setBaseHeaders(res, requestId);

    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

      if (req.method === 'OPTIONS') return sendJson(res, 204, null);
      if (req.method === 'GET' && url.pathname === '/health') {
        return sendJson(res, 200, { status: 'healthy', service: 'ask-mkulima', mode: AUTH_MODE, provider: providerLabel() });
      }

      if (url.pathname === '/api/v1/farmer/ask-mkulima/health') {
        if (req.method !== 'GET') return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Use GET for AI health.');
        const auth = await authenticate(req);
        if (!auth.ok) return sendError(res, auth.status, auth.code, auth.message);
        return sendJson(res, 200, {
          status: isProviderConfigured() ? 'healthy' : 'unavailable',
          service: 'ask-mkulima',
          provider: providerLabel(),
          model: modelLabel(),
          policy: 'farmer-safe-v1'
        });
      }

      if (url.pathname === '/api/v1/farmer/ask-mkulima') {
        if (req.method !== 'POST') return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Use POST for Ask Mkulima.');
        const auth = await authenticate(req);
        if (!auth.ok) return sendError(res, auth.status, auth.code, auth.message);
        const body = await readJson(req);
        const validation = validateAskRequest(body);
        if (!validation.ok) return sendError(res, 400, 'INVALID_REQUEST', validation.message);

        const question = body.question.trim();
        if (mentionsRestrictedTopic(question)) {
          return sendJson(res, 200, buildReply({
            text: 'I can explain your Mkulima Passport, records and next actions, but I cannot promise a loan, reveal score formulas, or show institution-only decision rules.',
            intent: 'general',
            confidence: 'high',
            requestId,
            localOnly: false,
            sources: [],
            recommendations: ['Ask about records, readiness, consent, weather, markets or next actions.'],
            followUps: ['What can I safely update next?']
          }));
        }

        const safeContext = normalizeContext(body.context);
        const reply = await answerQuestion(question, safeContext, body.history ?? [], requestId);
        return sendJson(res, 200, reply);
      }

      return sendError(res, 404, 'NOT_FOUND', 'Route not found.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected service error.';
      if (message === 'REQUEST_TOO_LARGE') return sendError(res, 413, 'REQUEST_TOO_LARGE', 'Request body is too large.');
      if (message === 'BAD_JSON') return sendError(res, 400, 'BAD_JSON', 'Request body must be valid JSON.');
      if (message === 'AI_NOT_CONFIGURED') return sendError(res, 503, 'AI_NOT_CONFIGURED', 'No production AI provider is configured.');
      if (message === 'AI_TIMEOUT') return sendError(res, 408, 'AI_TIMEOUT', 'The AI provider took too long to respond.');
      return sendError(res, 500, 'INTERNAL_ERROR', 'Ask Mkulima could not answer right now.');
    }
  });
}

async function authenticate(req) {
  if (AUTH_MODE === 'development') {
    return { ok: true, farmerId: 'dev-farmer', msid: 'MS-DEV' };
  }

  const token = getBearerToken(req);
  if (!token) return { ok: false, status: 401, code: 'AUTH_REQUIRED', message: 'Missing bearer token.' };

  try {
    const claims = await verifyJwt(token);
    return { ok: true, farmerId: claims.sub, msid: claims.msid };
  } catch {
    return { ok: false, status: 401, code: 'AUTH_INVALID', message: 'Invalid bearer token.' };
  }
}

function getBearerToken(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice('Bearer '.length).trim();
}

async function verifyJwt(token) {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw new Error('BAD_JWT');
  const header = JSON.parse(base64UrlDecode(encodedHeader).toString('utf8'));
  const claims = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8'));
  if (header.alg !== 'RS256') throw new Error('UNSUPPORTED_ALG');
  if (process.env.JWT_ISSUER && claims.iss !== process.env.JWT_ISSUER) throw new Error('BAD_ISSUER');
  if (process.env.JWT_AUDIENCE) {
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!aud.includes(process.env.JWT_AUDIENCE)) throw new Error('BAD_AUDIENCE');
  }
  if (claims.exp && Date.now() >= claims.exp * 1000) throw new Error('EXPIRED');
  if (!process.env.JWKS_URI) throw new Error('JWKS_REQUIRED');
  const jwk = await getJwk(header.kid);
  const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${encodedHeader}.${encodedPayload}`), key, base64UrlDecode(encodedSignature));
  if (!ok) throw new Error('BAD_SIGNATURE');
  return claims;
}

async function getJwk(kid) {
  const now = Date.now();
  if (!jwksCache || now - jwksCache.fetchedAt > JWKS_CACHE_MS) {
    const response = await fetch(process.env.JWKS_URI, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('JWKS_FETCH_FAILED');
    jwksCache = { fetchedAt: now, body: await response.json() };
  }
  const keys = jwksCache.body.keys ?? [];
  const jwk = keys.find((item) => !kid || item.kid === kid);
  if (!jwk) throw new Error('JWK_NOT_FOUND');
  return jwk;
}

function validateAskRequest(body) {
  if (!body || typeof body !== 'object') return { ok: false, message: 'Body must be an object.' };
  if (typeof body.question !== 'string' || !body.question.trim()) return { ok: false, message: 'Question is required.' };
  if (body.question.length > 800) return { ok: false, message: 'Question is too long.' };
  if (!body.context || typeof body.context !== 'object') return { ok: false, message: 'Farmer-safe context is required.' };
  if (body.history && !Array.isArray(body.history)) return { ok: false, message: 'History must be an array.' };
  return { ok: true };
}

function normalizeContext(context) {
  return {
    passport: context.passport ?? null,
    farms: safeArray(context.farms).slice(0, 10),
    enterprises: safeArray(context.enterprises).slice(0, 30),
    insights: safeArray(context.insights).slice(0, 30),
    records: safeArray(context.records).slice(0, 50),
    openRequests: safeArray(context.openRequests).slice(0, 20),
    consentSummaries: safeArray(context.consentSummaries).slice(0, 20),
    financing: safeArray(context.financing).slice(0, 20),
    weather: safeArray(context.weather).slice(0, 10),
    climate: safeArray(context.climate).slice(0, 20),
    markets: safeArray(context.markets).slice(0, 20),
    alerts: safeArray(context.alerts).slice(0, 20),
    pendingOutboxCount: Number(context.pendingOutboxCount ?? 0)
  };
}

async function answerQuestion(question, context, history, requestId) {
  if (AI_PROVIDER === 'local') return localAnswer(question, context, requestId);
  if (AI_PROVIDER === 'openai') return openAiAnswer(question, context, history, requestId);
  throw new Error('AI_NOT_CONFIGURED');
}

async function openAiAnswer(question, context, history, requestId) {
  if (!process.env.OPENAI_API_KEY) throw new Error('AI_NOT_CONFIGURED');
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.AI_TIMEOUT_MS ?? 15000));
  try {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt() },
          { role: 'user', content: JSON.stringify({ question, context, history: safeHistory(history) }) }
        ]
      }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`AI_PROVIDER_${response.status}`);
    const payload = await response.json();
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('AI_EMPTY');
    return buildReply({
      text,
      intent: inferIntent(question),
      confidence: 'medium',
      requestId,
      localOnly: false,
      provider: 'openai-compatible',
      model: OPENAI_MODEL,
      latencyMs: Date.now() - startedAt,
      sources: deriveSources(context),
      recommendations: [],
      followUps: defaultFollowUps(question)
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('AI_TIMEOUT');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function localAnswer(question, context, requestId) {
  const intent = inferIntent(question);
  const weather = context.weather[0];
  const market = context.markets[0];
  const passport = context.passport;
  const enterprise = context.enterprises[0];
  const pending = context.pendingOutboxCount;
  const attention = context.insights.find((item) => item.tone === 'attention') ?? context.insights[0];
  const openRequest = context.openRequests.find((item) => item.status === 'open') ?? context.openRequests[0];
  const unmappedFarm = context.farms.find((farm) => farm.mapped === false);
  const recommendations = [];
  let text = localOverview(context);

  if (intent === 'weather' && weather) {
    text = weatherAnswer(context.weather);
    recommendations.push(...weatherRecommendations(weather));
  } else if (intent === 'markets' && market) {
    text = `${market.commodity}: ${market.observedPrice} in ${market.marketScope}. ${market.farmerRecordedPrice ? `Your recorded price is ${market.farmerRecordedPrice}. ` : ''}${market.movementLabel ? `${market.movementLabel}. ` : ''}${market.interpretation ?? 'Use this as a reference, not a guaranteed offer.'}`;
    recommendations.push('Compare the reference with buyer grade, quantity, deductions and payment terms.');
    recommendations.push(market.farmerRecordedPrice ? 'Attach or record the latest sale receipt so your own evidence stays current.' : 'Record your latest sale price, buyer, quantity and date.');
  } else if (intent === 'passport' && passport) {
    const consentCount = context.consentSummaries.filter((item) => item.status === 'active' || item.status === 'pending').length;
    text = `${passport.readinessLabel}. Profile status: ${passport.profileStatus ?? 'unknown'}. Evidence: ${passport.evidenceStatus}. Record freshness: ${passport.recordFreshness}. ${consentCount ? `${consentCount} active or pending consent item${consentCount === 1 ? '' : 's'} need regular review.` : 'No active consent item was included in the context.'}`;
    recommendations.push('Update missing or stale records before relying on the Passport for a conversation with an institution.');
    recommendations.push('Review consent purpose and scopes before sharing any data.');
  } else if (intent === 'production' && enterprise) {
    text = `${enterprise.name}${enterprise.sector ? ` (${enterprise.sector})` : ''} is recorded at ${enterprise.productionValue}${enterprise.productionMetric ? ` ${enterprise.productionMetric}` : ''}. ${enterprise.trendLabel ? `Trend: ${enterprise.trendLabel}. ` : ''}${enterprise.summary ?? 'Use recent production, sales and cost records before judging performance.'}`;
    recommendations.push('Record the latest production amount, unit, date and buyer or household use.');
    recommendations.push('Compare production with weather and cost records before changing farm practice.');
  } else if (intent === 'costs') {
    const costRecords = context.records.filter((record) => /cost|expense|input|feed|fertili|seed|labou?r|transport/i.test(`${record.category ?? ''} ${record.title ?? ''}`));
    text = costRecords.length
      ? `${costRecords.length} cost-related record${costRecords.length === 1 ? '' : 's'} are available. They help explain margin, but farmer-submitted costs are not verified unless the record status says so.`
      : `No cost record was included for ${enterprise?.name ?? 'the main enterprise'}. Without input, labour and transport costs, the assistant cannot estimate a reliable margin.`;
    recommendations.push('Add input, labour, feed, transport and service costs with date, amount and enterprise.');
    recommendations.push('Keep receipts or notes so corrections can be reviewed later.');
  } else if (intent === 'records') {
    const recent = context.records[0];
    if (openRequest) {
      const items = safeArray(openRequest.items).join(', ') || 'documents';
      text = `${openRequest.institution ?? 'An institution'} is asking for ${items}. Uploading queues farmer-submitted evidence for review; it does not make the record verified automatically.`;
      recommendations.push('Check the institution, purpose, requested scope and due date before sharing.');
    } else if (recent) {
      text = `Your recent saved record is ${recent.title ?? 'an evidence record'} (${recent.status ?? 'status unknown'}, ${recent.verification ?? 'verification unknown'}). The next useful record is usually the newest production, sale, cost or cooperative statement tied to an enterprise.`;
      recommendations.push('Prioritise records with clear date, amount, buyer or institution, and enterprise.');
    } else {
      text = 'No evidence record was included. The best first record is a recent production, sale, cost, input receipt or cooperative statement.';
      recommendations.push('Add one current record before adding older history.');
    }
    recommendations.push('Keep originals safely and correct details through the app instead of silently replacing values.');
  } else if (intent === 'farm_mapping') {
    if (unmappedFarm) {
      text = `${unmappedFarm.name ?? 'One farm'} is not mapped yet. Mapping adds location and measured-area context, while reported area and measured area remain separate.`;
      recommendations.push('Map the farm only with the farmer permission and review the boundary before saving.');
      recommendations.push('Flag large differences between reported and measured area for review.');
    } else {
      text = context.farms.length ? 'The saved farms are mapped in the context. A mapped boundary helps with weather and location intelligence, but it does not prove ownership or production.' : 'No farm was included, so mapping guidance is limited.';
      recommendations.push('Review each farm boundary and correct it if the shape or location is wrong.');
    }
  } else if (intent === 'sync') {
    text = pending ? `${pending} update${pending === 1 ? '' : 's'} are waiting to sync.` : 'No pending sync items were sent in the context.';
    recommendations.push('Retry sync when connected and avoid duplicate submissions while items are pending.');
  } else if (intent === 'next_actions') {
    const next = attention?.action ?? attention?.explanation ?? (openRequest ? 'review the open document request' : unmappedFarm ? 'map the farm boundary' : context.records.length === 0 ? 'add one recent evidence record' : 'record the latest production or cost');
    text = `The strongest next action is to ${lowerFirst(next)}. ${attention?.explanation ?? 'This keeps farmer-reported information current and easier to review.'}`;
    recommendations.push('Finish one update with date, amount, enterprise and source before starting another.');
    recommendations.push('Refresh data after syncing so the next recommendation uses the latest context.');
  } else {
    const alert = context.alerts[0];
    text = alert ? `${alert.title}: ${alert.detail}` : text;
    recommendations.push('Ask about weather, markets, records, production, Passport readiness or sync status.');
  }

  return buildReply({
    text,
    intent,
    confidence: deriveSources(context).length ? 'medium' : 'low',
    requestId,
    localOnly: true,
    provider: 'local-free',
    model: 'mkulima-local-reasoner-v2',
    latencyMs: 0,
    sources: deriveSources(context),
    recommendations,
    followUps: defaultFollowUps(question)
  });
}

function localOverview(context) {
  const parts = [];
  if (context.passport?.readinessLabel) parts.push(context.passport.readinessLabel);
  if (context.farms.length) parts.push(`${context.farms.length} farm${context.farms.length === 1 ? '' : 's'}`);
  if (context.enterprises.length) parts.push(`${context.enterprises.length} enterprise${context.enterprises.length === 1 ? '' : 's'}`);
  if (context.records.length) parts.push(`${context.records.length} saved record${context.records.length === 1 ? '' : 's'}`);
  if (context.weather.length) parts.push('weather context');
  if (context.markets.length) parts.push('market context');
  if (context.pendingOutboxCount) parts.push(`${context.pendingOutboxCount} pending sync item${context.pendingOutboxCount === 1 ? '' : 's'}`);
  return parts.length
    ? `I can reason from the farmer-safe context available now: ${parts.join(', ')}. Ask one focused question for a sharper answer.`
    : 'I can answer using farmer-safe context, but this request did not include enough saved farm data for a specific recommendation.';
}

function weatherAnswer(weatherItems) {
  const today = weatherItems[0];
  const window = weatherItems.slice(0, 3);
  const summary = window.length > 1
    ? ` Next ${window.length} updates: ${window.map((item) => `${item.farmName ?? 'farm'} ${item.rainProbabilityPct ?? '?'}% rain`).join('; ')}.`
    : '';
  return `${today.farmName ?? 'Farm'}: ${today.condition ?? 'forecast available'}. Rain probability is ${today.rainProbabilityPct ?? 'unknown'}% with about ${today.rainMm ?? 'unknown'} mm expected.${today.temperatureLowC !== undefined && today.temperatureHighC !== undefined ? ` Temperature is ${today.temperatureLowC}-${today.temperatureHighC}C.` : ''} ${today.fieldActivityNote ?? 'Check field conditions before acting.'}${summary}`;
}

function weatherRecommendations(weather) {
  const rainProbability = Number(weather.rainProbabilityPct ?? 0);
  const rainMm = Number(weather.rainMm ?? 0);
  const notes = [];
  if (rainProbability >= 60 || rainMm >= 5) {
    notes.push('Protect harvested produce and delay spraying or fertilizer application until conditions are suitable.');
  } else {
    notes.push('Use the forecast as a planning signal, then confirm soil and crop condition in the field.');
  }
  if (weather.windLabel) notes.push(`Plan around wind conditions (${weather.windLabel}) and follow product-label safety directions.`);
  notes.push('Refresh weather before making time-sensitive field decisions.');
  return notes;
}

function systemPrompt() {
  return [
    'You are Ask Mkulima, the farmer-facing assistant for MkulimaScore.',
    'Answer only from the supplied farmer-safe context.',
    'Use plain, farmer-friendly language.',
    'Do not promise loans, reveal score formulas, invent prices/weather, or expose institution-only rules.',
    'Always mention uncertainty, freshness, or source limitations when relevant.',
    'Give practical next actions, not decorative analysis.'
  ].join('\n');
}

function buildReply({ text, intent, confidence, requestId, localOnly, provider, model, latencyMs, sources, recommendations, followUps }) {
  return {
    text,
    metadata: {
      intent,
      sources,
      recommendations,
      followUps,
      limitations: [localLimitation],
      localOnly,
      confidence,
      requestId,
      provider,
      model,
      latencyMs
    }
  };
}

function inferIntent(question) {
  const normalized = question.toLowerCase();
  if (hasAny(normalized, ['weather', 'rain', 'temperature', 'forecast', 'wind'])) return 'weather';
  if (hasAny(normalized, ['market', 'price', 'sell', 'buyer'])) return 'markets';
  if (hasAny(normalized, ['production', 'yield', 'harvest', 'output', 'enterprise'])) return 'production';
  if (hasAny(normalized, ['cost', 'expense', 'profit', 'margin', 'input'])) return 'costs';
  if (hasAny(normalized, ['record', 'upload', 'statement', 'document', 'evidence', 'receipt'])) return 'records';
  if (hasAny(normalized, ['map', 'boundary', 'area', 'location', 'gps'])) return 'farm_mapping';
  if (hasAny(normalized, ['passport', 'profile', 'readiness', 'finance', 'loan', 'consent', 'permission'])) return 'passport';
  if (hasAny(normalized, ['sync', 'offline', 'internet', 'pending', 'connection'])) return 'sync';
  if (hasAny(normalized, ['next', 'action', 'important', 'recommend', 'do first', 'update first', 'priority', 'prioritise', 'prioritize'])) return 'next_actions';
  return 'general';
}

function deriveSources(context) {
  const sources = [];
  if (context.passport) sources.push({ label: 'Mkulima Passport', freshness: context.passport.recordFreshness ?? 'Freshness unavailable' });
  if (context.farms[0]) sources.push({ label: 'Farm profile', freshness: context.farms[0].updatedAt ? freshness(context.farms[0].updatedAt) : 'Saved farm context', limitation: 'Farm mapping does not prove ownership.' });
  if (context.enterprises[0]) sources.push({ label: 'Enterprise records', freshness: context.enterprises[0].updatedAt ? freshness(context.enterprises[0].updatedAt) : 'Saved enterprise context' });
  if (context.weather[0]) sources.push({ label: 'Farm weather context', freshness: freshness(context.weather[0].updatedAt), limitation: 'Forecasts can change.' });
  if (context.markets[0]) sources.push({ label: 'Market reference', freshness: freshness(context.markets[0].updatedAt), limitation: 'Reference prices are not guaranteed offers.' });
  if (context.records[0]) sources.push({ label: 'Evidence records', freshness: freshness(context.records[0].documentDate), limitation: 'Farmer-submitted records need verification.' });
  if (context.insights[0]) sources.push({ label: context.insights[0].sourceLabel ?? 'Farm insight', freshness: freshness(context.insights[0].updatedAt), limitation: context.insights[0].limitation });
  return sources.slice(0, 5);
}

function defaultFollowUps(question) {
  const intent = inferIntent(question);
  if (intent === 'weather') return ['What should I avoid today?', 'Which enterprise is most affected?'];
  if (intent === 'markets') return ['Should I record a sale?', 'What affects my price?'];
  if (intent === 'records') return ['Which record should I upload next?', 'What does verified mean?'];
  return ['What should I update first?', 'What improves my Passport?'];
}

function mentionsRestrictedTopic(question) {
  return hasAny(question.toLowerCase(), ['score formula', 'model weight', 'threshold', 'guarantee', 'pre-approved', 'preapproved', 'fraud rule', 'approve my loan', 'will i get a loan']);
}

function hasAny(value, terms) {
  return terms.some((term) => value.includes(term));
}

function safeHistory(history) {
  return safeArray(history).slice(-8).map((message) => ({
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: String(message.text ?? '').slice(0, 1500)
  }));
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function lowerFirst(value) {
  if (!value) return 'review the latest farm context';
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function freshness(updatedAt) {
  const time = new Date(updatedAt).getTime();
  if (!Number.isFinite(time)) return 'Freshness unavailable';
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (minutes < 60) return 'Updated less than 1 hr ago';
  if (minutes < 1440) return `Updated ${Math.round(minutes / 60)} hr ago`;
  return `Updated ${Math.round(minutes / 1440)} days ago`;
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 256_000) throw new Error('REQUEST_TOO_LARGE');
  }
  try {
    return JSON.parse(body || '{}');
  } catch {
    throw new Error('BAD_JSON');
  }
}

function sendError(res, status, code, message) {
  return sendJson(res, status, { error: { code, message } });
}

function sendJson(res, status, body) {
  res.statusCode = status;
  if (body === null) return res.end();
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(body));
}

function setBaseHeaders(res, requestId) {
  res.setHeader('X-Request-ID', requestId);
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN ?? '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type,x-request-id');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
}

function base64UrlDecode(value) {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function providerLabel() {
  if (AI_PROVIDER === 'openai') return 'openai-compatible';
  return 'local-free';
}

function modelLabel() {
  if (AI_PROVIDER === 'openai') return OPENAI_MODEL;
  return 'mkulima-local-reasoner-v2';
}

function isProviderConfigured() {
  if (AI_PROVIDER === 'local') return true;
  if (AI_PROVIDER === 'openai') return Boolean(process.env.OPENAI_API_KEY);
  return false;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createServer().listen(PORT, () => {
    console.log(`Ask Mkulima service listening on http://localhost:${PORT}`);
  });
}
