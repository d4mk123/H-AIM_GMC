import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MalformedResponseError,
  ProviderError,
  RateLimitError,
  rankItems,
} from '../ai_client.js';
import { completion, sendJson, startMockAi, withEnv } from './helpers/mock_ai.js';

const PROFILE = { occupation: 'student', interests: ['ai', 'web'] };
const ITEMS = [
  { id: 'a', type: 'news', title: 'AI news', summary: 's', tags: ['ai'], city: 'Tunis', publishedAt: '2026-09-01' },
  { id: 'b', type: 'job', title: 'Web job', summary: 's', tags: ['web'], city: null, publishedAt: '2026-09-02' },
];

function envFor(url, extra = {}) {
  return {
    GROQ_API_KEY: 'test-key',
    GROQ_MODEL: 'test-model',
    AI_BASE_URL: url,
    AI_TIMEOUT_MS: '1000',
    ...extra,
  };
}

test('parses fenced JSON content and ignores provider reasoning fields', async () => {
  const mock = await startMockAi(({ res }) => {
    sendJson(res, 200, completion({
      role: 'assistant',
      content: '```json\n{"rankings":[{"id":"b","score":88,"reason":"fits web"},{"id":"a","score":40,"reason":"weak"}]}\n```',
      reasoning: 'internal chain of thought that must never be read',
    }));
  });
  try {
    const result = await withEnv(envFor(mock.url), () => rankItems(PROFILE, ITEMS));
    assert.equal(result.model, 'test-model');
    assert.deepEqual(result.rankings.map((entry) => entry.id), ['b', 'a']);
    assert.equal(result.rankings[0].score, 88);
    assert.equal(result.rankings[0].reason, 'fits web');
  } finally {
    await mock.close();
  }
});

test('accepts bare array responses', async () => {
  const mock = await startMockAi(({ res }) => {
    sendJson(res, 200, completion({
      role: 'assistant',
      content: JSON.stringify([{ id: 'a', score: 70, reason: 'r1' }, { id: 'b', score: 60, reason: 'r2' }]),
    }));
  });
  try {
    const result = await withEnv(envFor(mock.url), () => rankItems(PROFILE, ITEMS));
    assert.deepEqual(result.rankings.map((entry) => entry.id), ['a', 'b']);
  } finally {
    await mock.close();
  }
});

test('appends items the model forgot, drops unknown ids, clamps scores', async () => {
  const mock = await startMockAi(({ res }) => {
    sendJson(res, 200, completion({
      role: 'assistant',
      content: JSON.stringify({
        rankings: [
          { id: 'ghost', score: 99, reason: 'unknown item' },
          { id: 'b', score: 250, reason: 'too high' },
        ],
      }),
    }));
  });
  try {
    const result = await withEnv(envFor(mock.url), () => rankItems(PROFILE, ITEMS));
    const ids = result.rankings.map((entry) => entry.id);
    assert.ok(!ids.includes('ghost'));
    assert.ok(ids.includes('a'));
    assert.ok(ids.includes('b'));
    assert.equal(new Set(ids).size, ids.length);
    const b = result.rankings.find((entry) => entry.id === 'b');
    assert.ok(b.score <= 100);
    for (const entry of result.rankings) {
      assert.ok(entry.score >= 0 && entry.score <= 100);
      assert.ok(entry.reason.length > 0);
    }
  } finally {
    await mock.close();
  }
});

test('429 raises RateLimitError', async () => {
  const mock = await startMockAi(({ res }) => {
    sendJson(res, 429, { error: { message: 'rate limited' } });
  });
  try {
    await assert.rejects(
      withEnv(envFor(mock.url), () => rankItems(PROFILE, ITEMS)),
      (err) => err instanceof RateLimitError && err.status === 429,
    );
  } finally {
    await mock.close();
  }
});

test('provider 500 raises ProviderError with status', async () => {
  const mock = await startMockAi(({ res }) => {
    sendJson(res, 500, { error: { message: 'boom' } });
  });
  try {
    await assert.rejects(
      withEnv(envFor(mock.url), () => rankItems(PROFILE, ITEMS)),
      (err) => err instanceof ProviderError && err.status === 500 && !(err instanceof RateLimitError),
    );
  } finally {
    await mock.close();
  }
});

test('non-JSON content raises MalformedResponseError', async () => {
  const mock = await startMockAi(({ res }) => {
    sendJson(res, 200, completion({ role: 'assistant', content: 'I refuse to answer in JSON.' }));
  });
  try {
    await assert.rejects(
      withEnv(envFor(mock.url), () => rankItems(PROFILE, ITEMS)),
      MalformedResponseError,
    );
  } finally {
    await mock.close();
  }
});

test('missing content raises MalformedResponseError', async () => {
  const mock = await startMockAi(({ res }) => {
    sendJson(res, 200, completion({ role: 'assistant', content: '' }));
  });
  try {
    await assert.rejects(
      withEnv(envFor(mock.url), () => rankItems(PROFILE, ITEMS)),
      MalformedResponseError,
    );
  } finally {
    await mock.close();
  }
});

test('unreachable provider raises ProviderError with timeout code', async () => {
  const mock = await startMockAi(() => {
    /* never respond: exercises AbortController */
  });
  try {
    await assert.rejects(
      withEnv(envFor(mock.url, { AI_TIMEOUT_MS: '150' }), () => rankItems(PROFILE, ITEMS)),
      (err) => err instanceof ProviderError && err.code === 'timeout',
    );
  } finally {
    await mock.close();
  }
});

test('missing API key raises not_configured ProviderError without network', async () => {
  await assert.rejects(
    withEnv(
      { GROQ_API_KEY: '', AI_BASE_URL: 'http://127.0.0.1:9/v1' },
      () => rankItems(PROFILE, ITEMS),
    ),
    (err) => err instanceof ProviderError && err.code === 'not_configured',
  );
});

test('empty item list short-circuits without calling the provider', async () => {
  const result = await withEnv(
    { GROQ_API_KEY: '', AI_BASE_URL: 'http://127.0.0.1:9/v1' },
    () => rankItems(PROFILE, []),
  );
  assert.deepEqual(result, { model: null, rankings: [] });
});
