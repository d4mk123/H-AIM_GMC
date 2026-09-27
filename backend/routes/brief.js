import { Router } from 'express';
import { MalformedResponseError, RateLimitError, generateBrief } from '../ai_client.js';
import { DbUnavailableError } from '../db/pool.js';
import * as repo from '../db/repo.js';
import { buildFallbackBrief } from '../lib/brief_fallback.js';
import { resolveItems } from '../lib/feed_items.js';
import { rankByOverlap } from '../lib/tag_overlap.js';

/**
 * POST /brief — weekly career brief for a profile.
 *
 * body: { profile: { id, name?, occupation?, interests? }, items?, period?, force? }
 *
 * Order of preference:
 *   1. an already generated brief for the requested period (unless force)
 *   2. a fresh model-generated brief, persisted with its checklist
 *   3. the most recent valid brief, labelled source=stale
 *   4. a deterministic brief built from the items and profile interests
 * A database outage never fails the request — only persistence is skipped.
 */

const router = Router();

const PERIOD_PATTERN = /^\d{4}-W\d{2}$/;

// Only the most relevant items are sent to the model: a 30-item brief blows past
// AI_TIMEOUT_MS on slow providers. The deterministic fallback still sees everything.
function briefItemLimit() {
  const raw = Number.parseInt(process.env.BRIEF_ITEM_LIMIT ?? '', 10);
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 30) : 12;
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

function currentPeriod(date = new Date()) {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((day - yearStart) / 86400000 + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function normalizePeriod(raw) {
  if (typeof raw === 'string' && PERIOD_PATTERN.test(raw.trim())) return raw.trim();
  return currentPeriod();
}

function readProfile(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    const error = new Error('profile body must be an object');
    error.status = 400;
    throw error;
  }
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 64) : null;
  if (!id) {
    const error = new Error('profile.id is required');
    error.status = 400;
    throw error;
  }
  return {
    id,
    name: typeof raw.name === 'string' ? raw.name.trim().slice(0, 120) || null : null,
    occupation: typeof raw.occupation === 'string' ? raw.occupation.trim().slice(0, 120) || null : null,
    interests: Array.isArray(raw.interests)
      ? raw.interests.filter((tag) => typeof tag === 'string' && tag.trim()).slice(0, 30).map((tag) => tag.trim())
      : [],
  };
}

// The brief payload carries the checklist per skill; the checklist_tasks table
// mirrors it so progress can be tracked across requests.
function checklistTasks(brief) {
  const tasks = [];
  for (const skill of brief.skills ?? []) {
    let position = 0;
    for (const text of skill.checklist ?? []) {
      tasks.push({ skillName: skill.name, position, text });
      position += 1;
    }
  }
  return tasks;
}

async function tryGetBrief(profileId, period) {
  try {
    return await repo.getBrief(profileId, period);
  } catch (err) {
    if (err instanceof DbUnavailableError) return null;
    throw err;
  }
}

async function tryLatestValidBrief(profileId) {
  try {
    return await repo.getLatestValidBrief(profileId);
  } catch (err) {
    if (err instanceof DbUnavailableError) return null;
    throw err;
  }
}

async function persistBrief({ profileId, period, source, model, brief }) {
  const saved = await repo.saveBrief({ profileId, period, status: 'valid', payload: brief, source, model });
  const tasks = await repo.replaceChecklistTasks(saved.id, checklistTasks(brief));
  return { briefId: saved.id, tasks };
}

router.post('/brief', async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const rawProfile = typeof body.profile === 'object' && body.profile !== null ? body.profile : body;
    const profile = readProfile(rawProfile);
    const period = normalizePeriod(body.period);
    const force = body.force === true;
    const forceFallback = process.env.BRIEF_FORCE_FALLBACK === '1';

    if (!force) {
      const existing = await tryGetBrief(profile.id, period);
      if (existing && existing.status === 'valid' && existing.payload) {
        let tasks = checklistTasks(existing.payload);
        try {
          tasks = await repo.listChecklistTasks(existing.id);
        } catch (err) {
          if (!(err instanceof DbUnavailableError)) throw err;
        }
        res.json({
          period,
          source: existing.source ?? 'fallback',
          model: existing.model,
          fallbackReason: null,
          cached: true,
          persisted: true,
          brief: existing.payload,
          tasks,
        });
        return;
      }
    }

    const items = await resolveItems(body.items);
    let brief = null;
    let model = null;
    let source = 'fallback';
    let fallbackReason = forceFallback ? 'forced' : null;

    if (forceFallback) {
      brief = buildFallbackBrief(profile, items, period);
    } else if (items.length === 0) {
      brief = buildFallbackBrief(profile, items, period);
      fallbackReason = 'no_items';
    } else {
      try {
        const candidates = rankByOverlap(profile, items).slice(0, briefItemLimit());
        const result = await generateBrief(profile, candidates, period);
        brief = result.brief;
        model = result.model;
        source = 'model';
      } catch (err) {
        fallbackReason = fallbackReasonFor(err);
        console.warn(`[brief] model brief unavailable (${err.name}: ${err.message}) — ${fallbackReason}`);
      }
    }

    // Model failed: an older valid brief is better than a generic fresh one.
    if (!brief) {
      const stale = await tryLatestValidBrief(profile.id);
      if (stale && stale.payload) {
        res.json({
          period,
          source: 'stale',
          model: stale.model,
          fallbackReason,
          cached: false,
          persisted: false,
          brief: stale.payload,
          tasks: checklistTasks(stale.payload),
        });
        return;
      }
      brief = buildFallbackBrief(profile, items, period);
    }

    let persisted = false;
    let tasks = checklistTasks(brief);
    try {
      const saved = await persistBrief({
        profileId: profile.id,
        period,
        source: source === 'model' ? 'model' : null,
        model,
        brief,
      });
      tasks = saved.tasks;
      persisted = true;
    } catch (err) {
      if (!(err instanceof DbUnavailableError)) throw err;
    }

    res.json({
      period,
      source,
      model,
      fallbackReason,
      cached: false,
      persisted,
      brief,
      tasks,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
