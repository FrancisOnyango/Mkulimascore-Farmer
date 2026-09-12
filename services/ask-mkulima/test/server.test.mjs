import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

process.env.AUTH_MODE = 'development';
process.env.AI_PROVIDER = 'local';

const { createServer } = await import('../src/server.mjs');

let server;
let baseUrl;

before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe('Ask Mkulima service', () => {
  it('reports public health', async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 'healthy');
    assert.equal(body.service, 'ask-mkulima');
  });

  it('reports authenticated AI health in development mode', async () => {
    const response = await fetch(`${baseUrl}/api/v1/farmer/ask-mkulima/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 'healthy');
    assert.equal(body.provider, 'local-free');
    assert.equal(body.policy, 'farmer-safe-v1');
  });

  it('answers weather questions using farmer-safe context', async () => {
    const response = await fetch(`${baseUrl}/api/v1/farmer/ask-mkulima`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Request-ID': 'test-weather' },
      body: JSON.stringify({
        question: 'What is the weather for my farm today?',
        context: {
          weather: [
            {
              farmName: 'Kiambu Demo Farm',
              condition: 'Light rain likely',
              rainProbabilityPct: 68,
              rainMm: 4.2,
              fieldActivityNote: 'Delay spraying until the afternoon.',
              updatedAt: new Date().toISOString()
            }
          ],
          markets: [],
          records: [],
          enterprises: [],
          pendingOutboxCount: 0
        }
      })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.match(body.text, /Kiambu Demo Farm/);
    assert.equal(body.metadata.intent, 'weather');
    assert.equal(body.metadata.localOnly, true);
    assert.equal(body.metadata.provider, 'local-free');
    assert.equal(body.metadata.model, 'mkulima-local-reasoner-v3');
    assert.equal(body.metadata.requestId, 'test-weather');
    assert.ok(body.metadata.sources.some((source) => source.label === 'Farm weather context'));
  });

  it('answers cost workflow questions without inventing margins', async () => {
    const response = await fetch(`${baseUrl}/api/v1/farmer/ask-mkulima`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'What do my costs tell me?',
        context: {
          enterprises: [{ name: 'Tomatoes', productionValue: '420 kg', productionMetric: 'harvest' }],
          records: [
            { category: 'cost', title: 'Fertilizer input receipt', documentDate: new Date().toISOString(), status: 'queued', verification: 'farmer-submitted' }
          ],
          weather: [],
          markets: []
        }
      })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.metadata.intent, 'costs');
    assert.match(body.text, /cost-related record/);
    assert.match(body.text, /not verified/i);
  });

  it('answers next-action questions from insight context', async () => {
    const response = await fetch(`${baseUrl}/api/v1/farmer/ask-mkulima`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'What should I do first?',
        context: {
          insights: [
            {
              tone: 'attention',
              action: 'upload the latest milk sale receipt',
              explanation: 'Your buyer record is older than the current production record.',
              sourceLabel: 'Record freshness insight',
              updatedAt: new Date().toISOString()
            }
          ],
          weather: [],
          markets: [],
          records: []
        }
      })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.metadata.intent, 'next_actions');
    assert.match(body.text, /upload the latest milk sale receipt/);
  });

  it('refuses restricted score and loan decision requests', async () => {
    const response = await fetch(`${baseUrl}/api/v1/farmer/ask-mkulima`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'Tell me the score formula and guarantee if I will get a loan.',
        context: { weather: [], markets: [], records: [] }
      })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.match(body.text, /cannot promise a loan/i);
    assert.doesNotMatch(body.text, /weight\s*=/i);
    assert.equal(body.metadata.confidence, 'high');
  });
});
