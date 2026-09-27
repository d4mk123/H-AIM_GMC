const normalize = (value) => String(value ?? '')
  .trim()
  .toLowerCase();

function uniqueNormalized(values) {
  const seen = new Set();
  const out = [];
  for (const value of values ?? []) {
    const normalized = normalize(value);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      out.push(normalized);
    }
  }
  return out;
}

export function sharedInterests(profileInterests, itemTags) {
  const interests = new Set(uniqueNormalized(profileInterests));
  const shared = [];
  for (const tag of uniqueNormalized(itemTags)) {
    if (interests.has(tag)) shared.push(tag);
  }
  return shared;
}

export function overlapScore(profileInterests, itemTags) {
  const interests = uniqueNormalized(profileInterests);
  if (interests.length === 0) return 30;
  const shared = sharedInterests(profileInterests, itemTags).length;
  return Math.max(0, Math.min(100, 20 + shared * 40));
}

export function deprioritizedReason(profileInterests, itemTags) {
  if (sharedInterests(profileInterests, itemTags).length > 0) return null;
  return 'Deprioritized because it does not match any of your interest tags.';
}

export function rankByOverlap(profile = {}, items = []) {
  const interests = profile.interests ?? [];
  const scored = items.map((item, index) => {
    const shared = sharedInterests(interests, item.tags);
    return {
      item,
      index,
      score: overlapScore(interests, item.tags),
      reason: shared.length > 0
        ? `Matches your interests: ${shared.join(', ')}.`
        : 'No direct interest match — kept for variety.',
      deprioritizedReason: deprioritizedReason(interests, item.tags),
    };
  });
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aDate = a.item.publishedAt ?? '';
    const bDate = b.item.publishedAt ?? '';
    if (aDate !== bDate) return bDate.localeCompare(aDate);
    return a.index - b.index;
  });
  return scored.map(({ item, score, reason, deprioritizedReason: note }) => ({
    ...item,
    score,
    reason,
    deprioritizedReason: note,
  }));
}
