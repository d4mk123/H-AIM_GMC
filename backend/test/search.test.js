import assert from 'node:assert/strict';
import { once } from 'node:events';
import test, { after, before } from 'node:test';
import { sendJson, startMockAi, withEnv } from './helpers/mock_ai.js';

// Degraded-database mode for every test in this file: no DATABASE_URL, no
// configured provider, and AI_BASE_URL pointed at a closed port so nothing
// can spend a real API key or touch the network.
process.env.DATABASE_URL = '';
process.env.SEARCH_PROVIDER = 'none';
process.env.SEARCH_CACHE = '0';
process.env.AI_BASE_URL = 'http://127.0.0.1:9/v1';

const { createApp } = await import('../server.js');

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

const get = (path) => fetch(`${base}${path}`);

test('local search returns results in the canonical item shape', async () => {
  const res = await get('/search?q=ai');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.source, 'local');
  assert.equal(body.provider, 'none');
  assert.equal(body.fallback, false);
  assert.ok(body.count > 0, 'expected matches for "ai"');
  assert.equal(body.items.length, body.count);
  assert.equal(typeof body.tookMs, 'number');
  for (const item of body.items) {
    assert.ok(typeof item.id === 'string' && item.id);
    assert.ok(typeof item.title === 'string' && item.title);
    assert.equal(typeof item.url, 'string');
    assert.ok(['news', 'job', 'internship', 'event'].includes(item.type));
    assert.ok(Array.isArray(item.tags));
    assert.equal(item.origin, 'seed');
  }
});

test('local search ranks matching items first', async () => {
  const body = await (await get('/search?q=fintech')).json();
  assert.ok(body.count > 0, 'expected fintech matches');
  const first = body.items[0];
  const haystack = `${first.title} ${first.summary} ${(first.tags || []).join(' ')}`.toLowerCase();
  assert.match(haystack, /fintech/);
  // Every returned item actually matches the query.
  for (const item of body.items) {
    const text = `${item.title} ${item.summary} ${(item.tags || []).join(' ')}`.toLowerCase();
    assert.match(text, /fintech/);
  }
});

test('type filter keeps only that type', async () => {
  const body = await (await get('/search?type=event')).json();
  assert.ok(body.count > 0);
  for (const item of body.items) assert.equal(item.type, 'event');
});

test('tag filter keeps only items carrying the tag', async () => {
  const body = await (await get('/search?tags=cloud')).json();
  assert.ok(body.count > 0);
  for (const item of body.items) {
    assert.ok(item.tags.map((tag) => tag.toLowerCase()).includes('cloud'));
  }
});

test('limit caps the result count', async () => {
  const body = await (await get('/search?limit=3')).json();
  assert.ok(body.count <= 3);
  assert.equal(body.items.length, body.count);
});

test('unknown type is a 400, not a silent empty result', async () => {
  const res = await get('/search?type=podcast');
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /type/);
});

test('empty query still answers with the most recent items', async () => {
  const body = await (await get('/search?limit=5')).json();
  assert.equal(body.source, 'local');
  assert.equal(body.count, 5);
});

test('identical local requests are served from the cache', async () => {
  const run = () => withEnv({ SEARCH_CACHE: '1' }, () => get('/search?q=cloud'));
  const first = await (await run()).json();
  const second = await (await run()).json();
  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.deepEqual(second.items.map((item) => item.id), first.items.map((item) => item.id));
});

test('live provider results are normalised and labelled source=live', async () => {
  const mock = await startMockAi(({ res }) => {
    sendJson(res, 200, {
      results: [
        { title: 'Tunisia AI scene grows', url: 'https://example.tn/ai-boom', content: 'local ai coverage', published_date: '2026-09-20' },
        { title: 'Duplicate link', url: 'https://example.tn/ai-boom', content: 'same article again' },
        { title: 'Missing url is dropped', content: 'no link' },
      ],
    });
  });
  try {
    const res = await withEnv(
      { SEARCH_PROVIDER: 'tavily', TAVILY_API_KEY: 'test-key', TAVILY_BASE_URL: mock.url, SEARCH_CACHE: '0' },
      () => get('/search?q=ai%20tunisia'),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.source, 'live');
    assert.equal(body.provider, 'tavily');
    assert.equal(body.fallback, false);
    assert.equal(body.count, 1, 'duplicate and linkless entries are dropped');
    const item = body.items[0];
    assert.ok(item.id.startsWith('live-tavily-'));
    assert.equal(item.origin, 'live');
    assert.equal(item.source, 'example.tn');
    assert.equal(item.url, 'https://example.tn/ai-boom');
    assert.equal(item.type, 'news');
    assert.deepEqual(item.tags, ['ai', 'tunisia'], 'query terms become tags for later ranking');
  } finally {
    await mock.close();
  }
});

test('unreachable provider degrades to local results with a reason', async () => {
  const res = await withEnv(
    { SEARCH_PROVIDER: 'serper', SERPER_API_KEY: 'test-key', SERPER_BASE_URL: 'http://127.0.0.1:9', SEARCH_CACHE: '0' },
    () => get('/search?q=ai'),
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.source, 'local');
  assert.equal(body.fallback, true);
  assert.match(body.reason, /unreachable|provider/i);
  assert.ok(body.count > 0, 'local results are still served');
  assert.equal(body.corpus, 'seed');
});

test('hanging provider times out and still answers', async () => {
  const mock = await startMockAi(() => {
    /* never responds */
  });
  try {
    const res = await withEnv(
      {
        SEARCH_PROVIDER: 'tavily',
        TAVILY_API_KEY: 'test-key',
        TAVILY_BASE_URL: mock.url,
        SEARCH_TIMEOUT_MS: '150',
        SEARCH_CACHE: '0',
      },
      () => get('/search?q=ai'),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.source, 'local');
    assert.equal(body.fallback, true);
    assert.match(body.reason, /timed out/i);
  } finally {
    await mock.close();
  }
});

test('configured provider without an API key falls back, it does not 500', async () => {
  const res = await withEnv(
    { SEARCH_PROVIDER: 'tavily', TAVILY_API_KEY: '', SEARCH_CACHE: '0' },
    () => get('/search?q=ai'),
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.fallback, true);
  assert.match(body.reason, /TAVILY_API_KEY/);
});
