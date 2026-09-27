import { Router } from 'express';
import { DbUnavailableError } from '../db/pool.js';
import * as repo from '../db/repo.js';
import { loadSeedItems } from '../db/seed.js';
import { LruTtlCache, hashKey } from '../lib/cache.js';
import { ITEM_TYPES } from '../lib/feed_items.js';

/**
 * GET /search — live search with local (database/seed) fallback.
 *
 * Provider comes from SEARCH_PROVIDER: none (default) | tavily | serper.
 * Live results are normalised into the canonical item shape used by /rank
 * ({ id, type, title, summary, source, url, publishedAt, city, tags, origin })
 * and best-effort persisted so /rank can pick them up afterwards.
 * Any provider failure degrades to a scored local search instead of an error.
 *
 * Query parameters:
 *   q      free text (empty means "most recent items")
 *   type   news | job | internship | event (400 on anything else)
 *   tags   comma separated tag filter (any match)
 *   limit  1..50, default 20
 */

const router = Router();

const PROVIDERS = new Set(['none', 'tavily', 'serper']);
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const LOCAL_CORPUS_LIMIT = 200;

const searchCache = new LruTtlCache({
  max: Number(process.env.SEARCH_CACHE_MAX || 100),
  ttlMs: Number(process.env.SEARCH_CACHE_TTL_MS || 300000),
});

class SearchProviderError extends Error {
  constructor(message, code = 'provider_error') {
    super(message);
    this.name = 'SearchProviderError';
    this.code = code;
  }
}

function cacheEnabled() {
  return process.env.SEARCH_CACHE !== '0' && process.env.SEARCH_CACHE !== 'false';
}

function activeProvider() {
  const raw = String(process.env.SEARCH_PROVIDER || 'none').trim().toLowerCase();
  return PROVIDERS.has(raw) ? raw : 'none';
}

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function parseQuery(raw) {
  // Express 5 query objects are null-prototype: read fields, never stringify
  // the object itself.
  const query = String(raw?.q ?? '').trim().slice(0, 200);

  const typeRaw = String(raw?.type ?? '').trim().toLowerCase();
  if (typeRaw && typeRaw !== 'all' && !ITEM_TYPES.has(typeRaw)) {
    throw badRequest(`type must be one of: ${[...ITEM_TYPES].join(', ')}`);
  }

  const limitRaw = Number.parseInt(raw?.limit, 10);
  const limit = Number.isNaN(limitRaw) || limitRaw < 1 ? DEFAULT_LIMIT : Math.min(limitRaw, MAX_LIMIT);

  const tags = String(raw?.tags ?? '')
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 10);

  return { query, type: typeRaw === 'all' ? '' : typeRaw, tags, limit };
}

/* ------------------------------------------------------------------ */
/* Local corpus: database first, seed file as the last resort          */
/* ------------------------------------------------------------------ */

async function loadLocalCorpus() {
  try {
    const fromDb = await repo.listRecentItems({ limit: LOCAL_CORPUS_LIMIT });
    if (fromDb.length > 0) return { items: fromDb, corpus: 'db' };
  } catch (err) {
    if (!(err instanceof DbUnavailableError)) throw err;
  }
  return { items: loadSeedItems(), corpus: 'seed' };
}

function matchesFilters(item, type, tags) {
  if (type && item.type !== type) return false;
  if (tags.length > 0) {
    const itemTags = (item.tags ?? []).map((tag) => String(tag).toLowerCase());
    if (!tags.some((tag) => itemTags.includes(tag))) return false;
  }
  return true;
}

function scoreItem(item, terms) {
  const title = String(item.title ?? '').toLowerCase();
  const haystack = [item.title, item.summary, (item.tags ?? []).join(' ')]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += 3;
    else if (haystack.includes(term)) score += 1;
    else return -1; // every term must appear somewhere
  }
  return score;
}

function searchLocal(corpus, { query, type, tags, limit }) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = [];
  corpus.forEach((item, index) => {
    if (!matchesFilters(item, type, tags)) return;
    const score = scoreItem(item, terms);
    if (score < 0) return;
    scored.push({ item, score, index });
  });
  scored.sort((a, b) => (b.score - a.score) || (a.index - b.index));
  return scored.slice(0, limit).map(({ item }) => item);
}

/* ------------------------------------------------------------------ */
/* Live providers                                                      */
/* ------------------------------------------------------------------ */

function timeoutGuard() {
  const ms = Number.parseInt(process.env.SEARCH_TIMEOUT_MS, 10) || 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  if (typeof timer.unref === 'function') timer.unref();
  return { signal: controller.signal, ms, done: () => clearTimeout(timer) };
}

async function postJson(url, headers, body, guard) {
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: guard.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new SearchProviderError(`search provider timed out after ${guard.ms}ms`, 'timeout');
    }
    throw new SearchProviderError(`search provider unreachable: ${err.message}`, 'unreachable');
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 200);
    throw new SearchProviderError(`search provider returned ${response.status}: ${detail}`);
  }
  try {
    return await response.json();
  } catch {
    throw new SearchProviderError('search provider returned invalid JSON', 'malformed');
  }
}

function sourceFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'external';
  }
}

function normalizeLive(entry, { provider, type, queryTags }) {
  if (!entry || typeof entry !== 'object') return null;
  const title = String(entry.title ?? '').trim();
  const url = String(entry.url ?? entry.link ?? '').trim();
  if (!title || !url) return null;
  return {
    id: `live-${provider}-${hashKey(url).slice(0, 16)}`,
    type: ITEM_TYPES.has(type) ? type : 'news',
    title: title.slice(0, 300),
    summary: String(entry.content ?? entry.snippet ?? entry.description ?? '').slice(0, 1000),
    source: sourceFromUrl(url),
    url: url.slice(0, 500),
    publishedAt: entry.published_date ?? entry.date ?? null,
    city: null,
    tags: queryTags,
    origin: 'live',
  };
}

function cleanLive(items, { type, tags, limit }) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (!item || seen.has(item.id)) continue;
    if (!matchesFilters(item, type, tags)) continue;
    seen.add(item.id);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

async function searchTavily(params, guard) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new SearchProviderError('TAVILY_API_KEY is not set', 'not_configured');
  const base = String(process.env.TAVILY_BASE_URL || 'https://api.tavily.com').replace(/\/+$/, '');
  const data = await postJson(
    `${base}/search`,
    { authorization: `Bearer ${key}` },
    {
      query: params.query,
      max_results: params.limit,
      include_answer: false,
      include_raw_content: false,
    },
    guard,
  );
  const raw = Array.isArray(data.results) ? data.results : [];
  return cleanLive(
    raw.map((entry) => normalizeLive(entry, {
      provider: 'tavily',
      type: params.type || 'news',
      queryTags: liveTags(params),
    })),
    params,
  );
}

async function searchSerper(params, guard) {
  const key = process.env.SERPER_API_KEY;
  if (!key) throw new SearchProviderError('SERPER_API_KEY is not set', 'not_configured');
  const base = String(process.env.SERPER_BASE_URL || 'https://google.serper.dev').replace(/\/+$/, '');
  const data = await postJson(
    `${base}/search`,
    { 'x-api-key': key },
    { q: params.query, num: params.limit },
    guard,
  );
  const raw = Array.isArray(data.organic) ? data.organic : [];
  return cleanLive(
    raw.map((entry) => normalizeLive(entry, {
      provider: 'serper',
      type: params.type || 'news',
      queryTags: liveTags(params),
    })),
    params,
  );
}

/** Query terms become tags on live items so /rank can still match interests. */
function liveTags(params) {
  const fromQuery = params.query.toLowerCase().split(/\s+/).filter(Boolean);
  const merged = [...new Set([...params.tags, ...fromQuery])];
  return merged.slice(0, 8);
}

async function searchLive(params) {
  const provider = activeProvider();
  const guard = timeoutGuard();
  try {
    if (provider === 'tavily') return await searchTavily(params, guard);
    if (provider === 'serper') return await searchSerper(params, guard);
    return [];
  } finally {
    guard.done();
  }
}

/* ------------------------------------------------------------------ */
/* Route                                                               */
/* ------------------------------------------------------------------ */

router.get('/search', async (req, res, next) => {
  try {
    const startedAt = Date.now();
    const params = parseQuery(req.query);
    const provider = activeProvider();
    const cacheKey = hashKey(JSON.stringify([provider, params.query, params.type, params.tags, params.limit]));

    if (cacheEnabled()) {
      const cached = searchCache.get(cacheKey);
      if (cached) {
        res.json({ ...cached, cached: true, tookMs: Date.now() - startedAt });
        return;
      }
    }

    let liveItems = null;
    let reason = null;

    // Live providers need a query; without one the local corpus is the answer.
    if (provider !== 'none' && params.query) {
      try {
        const live = await searchLive(params);
        if (live.length > 0) {
          liveItems = live;
          // Best effort: remember live items so /rank can rank them too.
          try {
            await repo.upsertItems(liveItems, 'live');
          } catch (err) {
            if (!(err instanceof DbUnavailableError)) console.error('[search] live item save failed:', err.message);
          }
        } else {
          reason = 'search provider returned no results';
        }
      } catch (err) {
        reason = err.message;
        console.warn(`[search] ${provider} unavailable (${err.code ?? 'error'}) — using local results: ${err.message}`);
      }
    }

    // Local content is the intended source when no provider is configured,
    // and the fallback when one is.
    const usedLocal = liveItems === null;
    const fallback = usedLocal && provider !== 'none';
    let items = liveItems;
    let corpus = null;
    if (usedLocal) {
      const local = await loadLocalCorpus();
      items = searchLocal(local.items, params);
      corpus = local.corpus;
      if (fallback && !reason && !params.query) {
        reason = 'no query supplied; showing recent items';
      }
    }

    const payload = {
      query: params.query,
      provider,
      source: usedLocal ? 'local' : 'live',
      fallback,
      ...(usedLocal ? { corpus } : {}),
      ...(fallback ? { reason: reason ?? 'using local content' } : {}),
      items,
      count: items.length,
      cached: false,
    };

    if (cacheEnabled()) searchCache.set(cacheKey, payload);
    res.json({ ...payload, tookMs: Date.now() - startedAt });
  } catch (err) {
    next(err);
  }
});

export default router;
