import { DbUnavailableError } from '../db/pool.js';
import * as repo from '../db/repo.js';
import { loadSeedItems } from '../db/seed.js';

export const ITEM_TYPES = new Set(['news', 'job', 'internship', 'event']);

export function sanitizeItems(raw) {
  if (!Array.isArray(raw)) return null;
  const items = [];
  const seen = new Set();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.id !== 'string' || !entry.id.trim()) continue;
    if (!ITEM_TYPES.has(entry.type)) continue;
    if (typeof entry.title !== 'string' || !entry.title.trim()) continue;
    const id = entry.id.trim().slice(0, 120);
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      type: entry.type,
      title: entry.title.trim().slice(0, 300),
      summary: typeof entry.summary === 'string' ? entry.summary.slice(0, 1000) : '',
      source: typeof entry.source === 'string' ? entry.source.slice(0, 200) : '',
      url: typeof entry.url === 'string' ? entry.url.slice(0, 500) : '',
      publishedAt: typeof entry.publishedAt === 'string' ? entry.publishedAt.slice(0, 40) : null,
      city: typeof entry.city === 'string' ? entry.city.slice(0, 80) : null,
      tags: Array.isArray(entry.tags) ? entry.tags.filter((tag) => typeof tag === 'string').slice(0, 20) : [],
      origin: ITEM_TYPES.has(entry.type) ? (entry.origin ?? 'manual') : 'manual',
    });
    if (items.length >= 100) break;
  }
  return items;
}

// Request body items win; otherwise the database, otherwise the seed file.
export async function resolveItems(bodyItems) {
  const sanitized = sanitizeItems(bodyItems);
  if (sanitized && sanitized.length > 0) return sanitized;
  try {
    const fromDb = await repo.listRecentItems({ limit: 50 });
    if (fromDb.length > 0) return fromDb;
  } catch (err) {
    if (!(err instanceof DbUnavailableError)) throw err;
  }
  return loadSeedItems();
}
