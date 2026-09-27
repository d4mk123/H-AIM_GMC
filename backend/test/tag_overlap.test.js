import assert from 'node:assert/strict';
import test from 'node:test';
import { deprioritizedReason, overlapScore, rankByOverlap, sharedInterests } from '../lib/tag_overlap.js';

test('sharedInterests matches case-insensitively without duplicates', () => {
  const shared = sharedInterests(['AI', 'web', 'ai'], ['ai', 'Web', 'mobile', 'ai']);
  assert.deepEqual(shared, ['ai', 'web']);
});

test('overlapScore returns neutral 30 when profile has no interests', () => {
  assert.equal(overlapScore([], ['ai']), 30);
  assert.equal(overlapScore(undefined, undefined), 30);
});

test('overlapScore scales with matches and clamps to 0-100', () => {
  assert.equal(overlapScore(['ai'], ['web']), 20);
  assert.equal(overlapScore(['ai'], ['ai']), 60);
  assert.equal(overlapScore(['ai', 'web'], ['ai', 'web']), 100);
  assert.equal(overlapScore(['a', 'b', 'c'], ['a', 'b', 'c']), 100);
});

test('rankByOverlap orders by score, keeps ties stable by date then index', () => {
  const items = [
    { id: 'x', tags: ['ai'], publishedAt: '2026-09-01' },
    { id: 'y', tags: ['mobile'], publishedAt: '2026-09-10' },
    { id: 'z', tags: ['ai'], publishedAt: '2026-09-05' },
    { id: 'w', tags: ['web', 'ai'], publishedAt: '2026-09-02' },
  ];
  const ranked = rankByOverlap({ interests: ['ai', 'web'] }, items);
  assert.deepEqual(
    ranked.map((item) => item.id),
    ['w', 'z', 'x', 'y'],
  );
  assert.ok(ranked[0].score >= ranked[1].score);
  for (const item of ranked) {
    assert.ok(item.score >= 0 && item.score <= 100);
    assert.ok(item.reason.length > 0);
  }
});

test('rankByOverlap marks items without shared tags as deprioritized', () => {
  const ranked = rankByOverlap({ interests: ['ai'] }, [
    { id: 'match', tags: ['ai'] },
    { id: 'no-match', tags: ['gaming'] },
  ]);
  const match = ranked.find((item) => item.id === 'match');
  const noMatch = ranked.find((item) => item.id === 'no-match');
  assert.equal(match.deprioritizedReason, null);
  assert.match(noMatch.deprioritizedReason, /Deprioritized because/);
});

test('deprioritizedReason is null when any tag matches', () => {
  assert.equal(deprioritizedReason(['ai'], ['web', 'ai']), null);
  assert.match(deprioritizedReason(['ai'], ['web']), /does not match/);
});
