import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

await import('../config.js');
const { DbUnavailableError, closePool, query } = await import('../db/pool.js');
const { migrate } = await import('../db/migrate.js');
const { importSeedItems } = await import('../db/seed.js');
const repo = await import('../db/repo.js');

let available = false;
const stamp = `p-test-${Date.now()}`;

before(async () => {
  try {
    available = await migrate();
  } catch (err) {
    if (err instanceof DbUnavailableError) available = false;
    else throw err;
  }
});

after(async () => {
  if (available) {
    await query('DELETE FROM briefs WHERE profile_id LIKE $1', ['p-test-%']).catch(() => {});
    await query('DELETE FROM profiles WHERE id LIKE $1', ['p-test-%']).catch(() => {});
    await query('DELETE FROM feedback WHERE profile_id LIKE $1', ['p-test-%']).catch(() => {});
    await query('DELETE FROM rank_runs WHERE profile_id LIKE $1', ['p-test-%']).catch(() => {});
  }
  await closePool();
});

function skipUnless(t) {
  if (!available) t.skip('postgres is not available');
  return !available;
}

test('seed import brings in the 18 seed items', async (t) => {
  if (skipUnless(t)) return;
  const imported = await importSeedItems();
  assert.equal(imported, 18);
  assert.ok((await repo.countItems()) >= 18);
});

test('listRecentItems returns mapped items with parsed tags', async (t) => {
  if (skipUnless(t)) return;
  const items = await repo.listRecentItems({ limit: 5 });
  assert.ok(items.length > 0);
  for (const item of items) {
    assert.ok(typeof item.id === 'string');
    assert.ok(Array.isArray(item.tags));
    assert.ok(['news', 'job', 'internship', 'event'].includes(item.type));
  }
});

test('profile upsert and read roundtrip', async (t) => {
  if (skipUnless(t)) return;
  const profile = { id: stamp, name: 'Test', occupation: 'student', interests: ['ai', 'web'] };
  await repo.upsertProfile(profile);
  profile.interests = ['ai', 'data'];
  await repo.upsertProfile(profile);
  const loaded = await repo.getProfile(stamp);
  assert.deepEqual(loaded.interests, ['ai', 'data']);
  assert.equal(loaded.occupation, 'student');
});

test('rank run persists with its entries', async (t) => {
  if (skipUnless(t)) return;
  const items = await repo.listRecentItems({ limit: 3 });
  const runId = await repo.saveRankRun({
    profileId: stamp,
    source: 'fallback',
    model: null,
    itemIds: items.map((item) => item.id),
    durationMs: 12,
    entries: items.map((item, index) => ({ itemId: item.id, position: index + 1, score: 80 - index, reason: 'r' })),
  });
  assert.ok(Number(runId) > 0);
  const { rows } = await query('SELECT count(*)::int AS n FROM rank_entries WHERE run_id = $1', [runId]);
  assert.equal(rows[0].n, 3);
});

test('feedback upsert switches vote in place', async (t) => {
  if (skipUnless(t)) return;
  const first = await repo.addFeedback({ profileId: stamp, itemId: 'seed-news-01', vote: 'up' });
  const second = await repo.addFeedback({ profileId: stamp, itemId: 'seed-news-01', vote: 'down' });
  assert.equal(first.id, second.id);
  assert.equal(second.vote, 'down');
});

test('brief lifecycle: save, dedupe, latest, checklist', async (t) => {
  if (skipUnless(t)) return;
  const saved = await repo.saveBrief({
    profileId: stamp,
    period: '2026-W39',
    status: 'valid',
    payload: { period: '2026-W39', summary: 's', technologies: [], skills: [] },
    source: 'model',
    model: 'test-model',
  });
  const cached = await repo.getBrief(stamp, '2026-W39');
  assert.equal(cached.id, saved.id);
  assert.equal(cached.status, 'valid');

  const latest = await repo.getLatestValidBrief(stamp);
  assert.equal(latest.id, saved.id);

  const tasks = await repo.replaceChecklistTasks(saved.id, [
    { skillName: 'SQL', position: 0, text: 'Finish the joins tutorial' },
    { skillName: 'SQL', position: 1, text: 'Build a small report' },
  ]);
  assert.equal(tasks.length, 2);

  const marked = await repo.setChecklistTaskDone(tasks[0].id, true);
  assert.equal(marked.done, true);
  assert.ok(marked.doneAt);

  const listed = await repo.listChecklistTasks(saved.id);
  assert.equal(listed.filter((task) => task.done).length, 1);
});

test('degraded behaviour raises DbUnavailableError without a DATABASE_URL', async (t) => {
  const savedUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = '';
  try {
    const { closePool: reset } = await import('../db/pool.js');
    await reset();
    await assert.rejects(repo.countItems(), DbUnavailableError);
  } finally {
    process.env.DATABASE_URL = savedUrl;
    await closePool().catch(() => {});
  }
  t.diagnostic('pool is recreated lazily on next query');
});
