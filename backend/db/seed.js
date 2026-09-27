import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { query, DbUnavailableError } from './pool.js';

const SEED_PATH = fileURLToPath(new URL('../../frontend/seed_items.json', import.meta.url));

export function loadSeedItems() {
  const raw = JSON.parse(readFileSync(SEED_PATH, 'utf8'));
  if (!Array.isArray(raw)) throw new Error('seed_items.json must contain an array');
  return raw;
}

const COLUMNS = 'id, type, title, summary, source, url, published_at, city, tags, origin';

export async function importSeedItems() {
  const items = loadSeedItems();
  try {
    for (const item of items) {
      await query(
        `INSERT INTO items (${COLUMNS})
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, 'seed')
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           summary = EXCLUDED.summary,
           source = EXCLUDED.source,
           url = EXCLUDED.url,
           published_at = EXCLUDED.published_at,
           city = EXCLUDED.city,
           tags = EXCLUDED.tags,
           origin = 'seed',
           fetched_at = now()`,
        [
          item.id,
          item.type,
          item.title,
          item.summary ?? '',
          item.source ?? '',
          item.url ?? '',
          item.publishedAt ?? null,
          item.city ?? null,
          JSON.stringify(item.tags ?? []),
        ],
      );
    }
    return items.length;
  } catch (err) {
    if (err instanceof DbUnavailableError) {
      console.warn(`[db] seed import skipped (${err.message}); seed file still used as fallback`);
      return 0;
    }
    throw err;
  }
}
