import { createHash } from 'node:crypto';

export class LruTtlCache {
  constructor({ max = 50, ttlMs = 300000 } = {}) {
    this.max = Math.max(1, max);
    this.ttlMs = ttlMs;
    this.entries = new Map();
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.storedAt > this.ttlMs) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    if (this.entries.size >= this.max) {
      const oldest = this.entries.keys().next().value;
      this.entries.delete(oldest);
    }
    this.entries.set(key, { value, storedAt: Date.now() });
  }

  get size() {
    return this.entries.size;
  }

  clear() {
    this.entries.clear();
  }
}

export function hashKey(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function rankCacheKey(profile = {}, items = []) {
  const canonical = JSON.stringify({
    occupation: String(profile.occupation ?? '').trim().toLowerCase(),
    interests: [...new Set((profile.interests ?? []).map((tag) => String(tag).trim().toLowerCase()))].sort(),
    ids: items.map((item) => item.id),
  });
  return hashKey(canonical);
}
