import { Router } from 'express';
import { MalformedResponseError, RateLimitError, rankItems } from '../ai_client.js';
import { DbUnavailableError } from '../db/pool.js';
import * as repo from '../db/repo.js';
import { loadSeedItems } from '../db/seed.js';
import { LruTtlCache, rankCacheKey } from '../lib/cache.js';
import { deprioritizedReason, rankByOverlap } from '../lib/tag_overlap.js';

const router = Router();

const rankCache = new LruTtlCache({ max: Number(process.env.RANK_CACHE_MAX || 50), ttlMs: Number(process.env.RANK_CACHE_TTL_MS || 300000) });

function cacheEnabled() {
  return process.env.RANK_CACHE !== '0' && process.env.RANK_CACHE !== 'false';
}

function preFilterLimit() {
  return Number(process.env.RANK_PRE_FILTER_LIMIT || 30);
}

function fallbackReasonFor(err) {
  if (!err) return 'forced';
  if (err instanceof RateLimitError) return 'rate_limited';
  if (err.code === 'not_configured') return 'ai_not_configured';
  if (err.code === 'timeout') return 'ai_timeout';
  if (err.code === 'unreachable') return 'ai_unreachable';
  if (err instanceof MalformedResponseError) return 'malformed_model_response';
  return 'provider_error';
}

const ITEM_TYPES = new Set(['news', 'job', 'internship', 'event']);

function normalizeProfile(raw) {
  if (raw === undefined || raw === null) {
    return { id: null, name: null, occupation: null, interests: [] };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    const error = new Error('profile must be an object');
    error.status = 400;
    throw error;
  }
  const interests = Array.isArray(raw.interests)
    ? raw.interests.filter((tag) => typeof tag === 'string' && tag.trim()).slice(0, 30).map((tag) => tag.trim())
    : [];
  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 64) : null,
    name: typeof raw.name === 'string' ? raw.name.trim().slice(0, 120) || null : null,
    occupation: typeof raw.occupation === 'string' ? raw.occupation.trim().slice(0, 120) || null : null,
    interests,
  };
}

function sanitizeItems(raw) {
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

async function resolveItems(bodyItems) {
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

function attachModelReasons(items, rankings, profile) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const ranked = [];
  for (const entry of rankings) {
    const item = itemById.get(entry.id);
    if (!item) continue;
    ranked.push({
      ...item,
      score: entry.score,
      reason: entry.reason,
      deprioritizedReason: deprioritizedReason(profile.interests, item.tags),
    });
  }
  return ranked;
}

router.post('/rank', async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const profile = normalizeProfile(body.profile);
    const items = await resolveItems(body.items);

    if (profile.id) {
      try {
        await repo.upsertProfile(profile);
      } catch (err) {
        if (!(err instanceof DbUnavailableError)) console.error('[rank] profile save failed:', err.message);
      }
    }

    if (items.length === 0) {
      res.json({ source: 'fallback', model: null, items: [], cached: false, tookMs: 0 });
      return;
    }

    const startedAt = Date.now();
    const forceFallback = process.env.RANK_FORCE_FALLBACK === '1';
    const cacheKey = rankCacheKey(profile, items);
    rankCache.ttlMs = Number(process.env.RANK_CACHE_TTL_MS || 300000);
    const cachedPayload = cacheEnabled() && !forceFallback ? rankCache.get(cacheKey) : undefined;

    if (cachedPayload) {
      res.json({ ...cachedPayload, cached: true, tookMs: Date.now() - startedAt });
      return;
    }

    let source = 'fallback';
    let model = null;
    let ranked = null;
    let fallbackReason = forceFallback ? 'forced' : null;

    if (!forceFallback) {
      let candidates = items;
      let remainder = [];
      if (items.length > preFilterLimit()) {
        const pre = rankByOverlap(profile, items);
        candidates = pre.slice(0, preFilterLimit());
        remainder = pre.slice(preFilterLimit());
      }
      try {
        const result = await rankItems(profile, candidates);
        model = result.model;
        ranked = attachModelReasons(candidates, result.rankings, profile);
        if (remainder.length > 0) ranked = [...ranked, ...remainder];
        source = 'model';
      } catch (err) {
        fallbackReason = fallbackReasonFor(err);
        console.warn(`[rank] model ranking unavailable (${err.name}: ${err.message}) — using tag-overlap fallback (${fallbackReason})`);
      }
    }

    if (!ranked) {
      ranked = rankByOverlap(profile, items);
    }

    const tookMs = Date.now() - startedAt;

    try {
      await repo.saveRankRun({
        profileId: profile.id,
        source,
        model,
        itemIds: ranked.map((item) => item.id),
        durationMs: tookMs,
        entries: ranked.map((item, index) => ({
          itemId: item.id,
          position: index + 1,
          score: item.score,
          reason: item.reason,
        })),
      });
    } catch (err) {
      if (!(err instanceof DbUnavailableError)) console.error('[rank] run save failed:', err.message);
    }

    const payload = { source, model, fallbackReason, items: ranked, cached: false };
    if (source === 'model' && cacheEnabled()) {
      rankCache.set(cacheKey, payload);
    }
    res.json({ ...payload, tookMs });
  } catch (err) {
    next(err);
  }
});

export default router;
