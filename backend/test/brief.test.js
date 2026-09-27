import assert from 'node:assert/strict';
import { once } from 'node:events';
import test, { after, before } from 'node:test';
import { completion, sendJson, startMockAi, withEnv } from './helpers/mock_ai.js';

// Degraded-database mode: the brief must be built and returned even when
// nothing can be persisted, and no real AI key may be spent.
process.env.DATABASE_URL = '';
process.env.AI_BASE_URL = 'http://127.0.0.1:9/v1';
process.env.BRIEF_FORCE_FALLBACK = '0';

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

const PROFILE = {
  id: 'p-brief-test',
  name: 'Test',
  occupation: 'CS student',
  interests: ['AI & Machine Learning', 'Cloud & DevOps'],
};

function post(path, payload) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

function assertBriefShape(brief) {
  assert.equal(typeof brief.headline, 'string');
  assert.ok(brief.headline.length > 0);
  assert.ok(Array.isArray(brief.trends));
  for (const trend of brief.trends) {
    assert.equal(typeof trend.tag, 'string');
    assert.ok(Number.isInteger(trend.mentions) && trend.mentions >= 0);
  }
  assert.ok(Array.isArray(brief.skills));
  assert.ok(brief.skills.length > 0, 'brief must recommend at least one skill');
  assert.ok(brief.skills.length <= 6, 'at most six skills');
  for (const skill of brief.skills) {
    assert.equal(typeof skill.name, 'string');
    assert.ok(skill.name.length > 0);
    assert.equal(typeof skill.why, 'string');
    assert.ok(skill.why.length > 0);
    assert.ok(Array.isArray(skill.roadmap) && skill.roadmap.length >= 3, 'roadmap needs steps');
    assert.ok(Array.isArray(skill.milestones) && skill.milestones.length >= 2, 'milestones needed');
    assert.ok(Array.isArray(skill.checklist) && skill.checklist.length >= 2, 'checklist needed');
  }
}

test('forced fallback builds a deterministic brief from interests and items', async () => {
  const res = await withEnv({ BRIEF_FORCE_FALLBACK: '1' }, () => post('/brief', { profile: PROFILE }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.source, 'fallback');
  assert.equal(body.fallbackReason, 'forced');
  assert.equal(body.cached, false);
  assert.equal(body.persisted, false, 'no database in this mode');
  assert.equal(body.period, expectPeriod());
  assertBriefShape(body.brief);
  assert.ok(body.brief.trends.length > 0, 'trends come from the seed items');
  // At least one skill links back to a profile interest.
  assert.ok(body.brief.skills.some((skill) => skill.interests.length > 0), 'interests are linked');
  // The task list mirrors every checklist entry.
  const expected = body.brief.skills.reduce((sum, skill) => sum + skill.checklist.length, 0);
  assert.equal(body.tasks.length, expected);
  for (const task of body.tasks) {
    assert.equal(typeof task.skillName, 'string');
    assert.equal(typeof task.text, 'string');
  }
});

test('model brief is used when the provider answers', async () => {
  const mock = await startMockAi(({ res, body }) => {
    const sent = JSON.parse(body.messages[1].content);
    assert.ok(sent.items.length > 0, 'model receives the items');
    assert.equal(sent.profile.occupation, PROFILE.occupation);
    sendJson(res, 200, completion({
      role: 'assistant',
      content: JSON.stringify({
        headline: 'A week of AI and cloud in Tunis',
        trends: [{ tag: 'ai', mentions: 12 }],
        skills: [
          {
            name: 'Applied LLM engineering',
            why: 'Matches your AI interest and 12 items this week.',
            interests: ['AI & Machine Learning'],
            sources: ['news-001'],
            roadmap: ['step one', 'step two', 'step three'],
            milestones: ['prototype', 'evaluation set'],
            checklist: ['task a', 'task b'],
          },
        ],
      }),
    }, 'test-model'));
  });
  try {
    const res = await withEnv({ AI_BASE_URL: mock.url }, () => post('/brief', { profile: PROFILE, force: true }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.source, 'model');
    assert.equal(body.model, 'test-model');
    assert.equal(body.fallbackReason, null);
    assert.equal(body.persisted, false, 'no database in this mode');
    assertBriefShape(body.brief);
    assert.equal(body.brief.skills[0].name, 'Applied LLM engineering');
    assert.equal(body.brief.trends[0].mentions, 12);
  } finally {
    await mock.close();
  }
});

test('unusable model response degrades to the deterministic brief', async () => {
  const mock = await startMockAi(({ res }) => {
    sendJson(res, 200, completion({ role: 'assistant', content: 'I only write poetry.' }));
  });
  try {
    const res = await withEnv({ AI_BASE_URL: mock.url }, () => post('/brief', { profile: PROFILE, force: true }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.source, 'fallback');
    assert.equal(body.fallbackReason, 'malformed_model_response');
    assertBriefShape(body.brief);
  } finally {
    await mock.close();
  }
});

test('unreachable provider degrades to the deterministic brief', async () => {
  const res = await withEnv({ AI_BASE_URL: 'http://127.0.0.1:9/v1' }, () =>
    post('/brief', { profile: PROFILE, force: true }),
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.source, 'fallback');
  assert.ok(['ai_unreachable', 'ai_timeout'].includes(body.fallbackReason));
  assertBriefShape(body.brief);
});

test('missing profile.id is a 400', async () => {
  const res = await post('/brief', { profile: { occupation: 'student' } });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /profile\.id/);
});

test('non-object profile is a 400', async () => {
  const res = await post('/brief', { profile: 'nope' });
  assert.equal(res.status, 400);
});

test('an invalid period falls back to the current ISO week', async () => {
  const res = await withEnv({ BRIEF_FORCE_FALLBACK: '1' }, () =>
    post('/brief', { profile: PROFILE, period: 'whenever' }),
  );
  const body = await res.json();
  assert.equal(body.period, expectPeriod());
});

test('a supplied period is preserved', async () => {
  const res = await withEnv({ BRIEF_FORCE_FALLBACK: '1' }, () =>
    post('/brief', { profile: PROFILE, period: '2027-W05' }),
  );
  const body = await res.json();
  assert.equal(body.period, '2027-W05');
  assert.equal(body.brief.period, '2027-W05');
});

function expectPeriod(date = new Date()) {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((day - yearStart) / 86400000 + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
