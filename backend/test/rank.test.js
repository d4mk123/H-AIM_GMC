import assert from 'node:assert/strict';
import { once } from 'node:events';
import test, { after, before } from 'node:test';
import { completion, sendJson, startMockAi, withEnv } from './helpers/mock_ai.js';

// Degraded-database mode for every test in this file: no DATABASE_URL means
// routes must fall back to the seed file and never crash.
process.env.DATABASE_URL = '';
process.env.GROQ_API_KEY = 'test-key';
process.env.GROQ_MODEL = 'test-model';
process.env.AI_BASE_URL = 'http://127.0.0.1:9/v1';
process.env.RANK_CACHE = '0';

const { createApp } = await import('../server.js');
const { loadSeedItems } = await import('../db/seed.js');

let server;
let base;

before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const BODY_ITEMS = [
  { id: 'i-ai', type: 'news', title: 'AI thing', summary: 'about ai', tags: ['ai'], publishedAt: '2026-09-10' },
  { id: 'i-game', type: 'event', title: 'Gaming thing', summary: 'games', tags: ['gaming'], publishedAt: '2026-09-11' },
  { id: 'i-web', type: 'job', title: 'Web thing', summary: 'web work', tags: ['web'], publishedAt: '2026-09-12' },
];

function post(path, payload, init = {}) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
    ...init,
  });
}

test('GET /health reports ok with unconfigured database', async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.db, 'unconfigured');
});

test('GET / serves the frontend, or the API info page when there is none', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  const type = res.headers.get('content-type') || '';
  if (type.includes('text/html')) {
    assert.ok((await res.text()).length > 0, 'frontend page is not empty');
  } else {
    const body = await res.json();
    assert.equal(body.service, 'nabdh-backend');
    assert.ok(Array.isArray(body.endpoints));
  }
});

test('forced fallback ranks by tag overlap and keeps every item', async () => {
  const res = await withEnv({ RANK_FORCE_FALLBACK: '1' }, () =>
    post('/rank', { profile: { id: 'p1', occupation: 'student', interests: ['ai', 'web'] }, items: BODY_ITEMS }),
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.source, 'fallback');
  assert.equal(body.items.length, 3);
  const ids = body.items.map((item) => item.id);
  assert.ok(!ids.includes('i-game') || ids[ids.length - 1] === 'i-game', 'non-matching item ranks last');
  for (const item of body.items) {
    assert.ok(item.score >= 0 && item.score <= 100);
    assert.ok(item.reason.length > 0);
    assert.ok(typeof item.deprioritizedReason === 'string' || item.deprioritizedReason === null);
  }
  const game = body.items.find((item) => item.id === 'i-game');
  assert.match(game.deprioritizedReason, /Deprioritized because/);
  assert.equal(typeof body.tookMs, 'number');
});

test('no items supplied in degraded mode loads every seed item', async () => {
  const res = await withEnv({ RANK_FORCE_FALLBACK: '1' }, () =>
    post('/rank', { profile: { interests: ['ai'] } }),
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.source, 'fallback');
  assert.equal(body.items.length, loadSeedItems().length);
  // Seed items keep their original link/date alongside the canonical fields.
  for (const item of body.items) {
    assert.equal(typeof item.url, 'string');
    assert.ok(item.url.length > 0, `seed item ${item.id} lost its link`);
    assert.ok(item.publishedAt, `seed item ${item.id} lost its date`);
  }
});

test('model path returns source=model with the model order', async () => {
  const mock = await startMockAi(({ res, body }) => {
    const ids = (body.messages?.[1]?.content ? JSON.parse(body.messages[1].content).items : []).map((item) => item.id);
    const reversed = [...ids].reverse().map((id, index) => ({
      id,
      score: 90 - index,
      reason: `model rank ${index + 1}`,
    }));
    sendJson(res, 200, completion({ role: 'assistant', content: JSON.stringify({ rankings: reversed }) }, 'test-model'));
  });
  try {
    const res = await withEnv({ AI_BASE_URL: mock.url }, () =>
      post('/rank', { profile: { id: 'p2', interests: ['ai'] }, items: BODY_ITEMS }),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.source, 'model');
    assert.equal(body.model, 'test-model');
    assert.deepEqual(body.items.map((item) => item.id), [...BODY_ITEMS].reverse().map((item) => item.id));
    for (const item of body.items) assert.ok(item.reason.length > 0);
  } finally {
    await mock.close();
  }
});

test('model failure degrades to fallback with 200', async () => {
  const mock = await startMockAi(({ res }) => {
    sendJson(res, 500, { error: { message: 'upstream down' } });
  });
  try {
    const res = await withEnv({ AI_BASE_URL: mock.url }, () =>
      post('/rank', { profile: { interests: ['ai'] }, items: BODY_ITEMS }),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.source, 'fallback');
    assert.equal(body.items.length, 3);
  } finally {
    await mock.close();
  }
});

test('429 from the model degrades directly to fallback', async () => {
  const mock = await startMockAi(({ res }) => {
    sendJson(res, 429, { error: { message: 'rate limited' } });
  });
  try {
    const res = await withEnv({ AI_BASE_URL: mock.url }, () =>
      post('/rank', { profile: { interests: ['ai'] }, items: BODY_ITEMS }),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.source, 'fallback');
  } finally {
    await mock.close();
  }
});

test('malformed JSON body returns 400', async () => {
  const res = await post('/rank', 'this is not json');
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /malformed JSON/i);
});

test('non-object profile returns 400', async () => {
  const res = await post('/rank', { profile: 'not-an-object' });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /profile/);
});

test('feedback without a database returns 503, not a crash', async () => {
  const res = await post('/feedback', { profileId: 'p1', itemId: 'i-ai', vote: 'up' });
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.error, 'database unavailable');
});

test('profile save without a database returns 503, not a crash', async () => {
  const res = await post('/profiles', { id: 'p9', occupation: 'student', interests: ['ai'] });
  assert.equal(res.status, 503);
});

test('unknown route returns JSON 404', async () => {
  const res = await fetch(`${base}/definitely-not-a-route`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error, 'not found');
});

test('identical model rank requests are served from cache after one model call', async () => {
  let modelCalls = 0;
  const mock = await startMockAi(({ res, body }) => {
    modelCalls += 1;
    const items = JSON.parse(body.messages[1].content).items;
    const rankings = items.map((item, index) => ({ id: item.id, score: 95 - index, reason: 'cached-model' }));
    sendJson(res, 200, completion({ role: 'assistant', content: JSON.stringify({ rankings }) }));
  });
  try {
    const payload = {
      profile: { id: 'p-cache', occupation: 'engineer', interests: ['iot'] },
      items: [
        { id: 'cache-1', type: 'news', title: 'IoT', summary: '', tags: ['iot'], publishedAt: '2026-09-01' },
        { id: 'cache-2', type: 'job', title: 'IoT job', summary: '', tags: ['iot'], publishedAt: '2026-09-02' },
      ],
    };
    const run = () => withEnv({ AI_BASE_URL: mock.url, RANK_CACHE: '1' }, () => post('/rank', payload));
    const first = await run();
    const second = await run();
    const bodyFirst = await first.json();
    const bodySecond = await second.json();
    assert.equal(modelCalls, 1, 'model must be called exactly once for identical requests');
    assert.equal(bodyFirst.cached, false);
    assert.equal(bodySecond.cached, true);
    assert.equal(bodySecond.source, 'model');
    assert.deepEqual(bodySecond.items.map((item) => item.id), bodyFirst.items.map((item) => item.id));
  } finally {
    await mock.close();
  }
});

test('large result sets are pre-filtered before the model call but all items are returned', async () => {
  let seenItemCount = null;
  const manyItems = Array.from({ length: 40 }, (_, index) => ({
    id: `bulk-${index}`,
    type: index % 2 === 0 ? 'news' : 'event',
    title: `Bulk item ${index}`,
    summary: 'bulk',
    tags: index < 15 ? ['ai'] : ['gaming'],
    publishedAt: `2026-09-${String((index % 27) + 1).padStart(2, '0')}`,
  }));
  const mock = await startMockAi(({ res, body }) => {
    const sent = JSON.parse(body.messages[1].content).items;
    seenItemCount = sent.length;
    const rankings = sent.map((item, index) => ({ id: item.id, score: 99 - index, reason: 'top candidate' }));
    sendJson(res, 200, completion({ role: 'assistant', content: JSON.stringify({ rankings }) }));
  });
  try {
    const res = await withEnv({ AI_BASE_URL: mock.url, RANK_CACHE: '0', RANK_PRE_FILTER_LIMIT: '10' }, () =>
      post('/rank', { profile: { occupation: 'student', interests: ['ai'] }, items: manyItems }),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.source, 'model');
    assert.equal(seenItemCount, 10, 'model only receives the top candidates');
    assert.equal(body.items.length, 40, 'response still contains every item');
    const top = body.items.slice(0, 10);
    for (const item of top) assert.equal(item.tags[0], 'ai', 'pre-filtered candidates rank first');
    const rest = body.items.slice(10);
    const restAi = rest.filter((item) => item.tags[0] === 'ai');
    const restGaming = rest.filter((item) => item.tags[0] === 'gaming');
    assert.equal(restAi.length, 5, 'leftover matching items stay in the response');
    assert.equal(restGaming.length, 25);
    const firstGamingIndex = rest.findIndex((item) => item.tags[0] === 'gaming');
    assert.ok(firstGamingIndex >= restAi.length, 'overlap-ranked leftovers precede non-matching items');
    for (const item of rest) {
      assert.ok(item.score >= 0 && item.score <= 100);
      assert.ok(item.reason.length > 0);
    }
  } finally {
    await mock.close();
  }
});

test('forced fallback and rate-limit fallback are labelled with fallbackReason', async () => {
  const forced = await withEnv({ RANK_FORCE_FALLBACK: '1' }, () =>
    post('/rank', { profile: { interests: ['ai'] }, items: BODY_ITEMS }),
  );
  const forcedBody = await forced.json();
  assert.equal(forcedBody.fallbackReason, 'forced');

  const mock = await startMockAi(({ res }) => sendJson(res, 429, { error: { message: 'slow down' } }));
  try {
    const limited = await withEnv({ AI_BASE_URL: mock.url, RANK_CACHE: '0' }, () =>
      post('/rank', { profile: { interests: ['ai'] }, items: BODY_ITEMS }),
    );
    const limitedBody = await limited.json();
    assert.equal(limitedBody.source, 'fallback');
    assert.equal(limitedBody.fallbackReason, 'rate_limited');
  } finally {
    await mock.close();
  }
});
