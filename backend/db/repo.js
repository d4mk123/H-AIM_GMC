import { query, withTransaction } from './pool.js';

function mapItem(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    summary: row.summary ?? '',
    source: row.source ?? '',
    url: row.url ?? '',
    publishedAt: row.published_at ?? null,
    city: row.city ?? null,
    tags: row.tags ?? [],
    origin: row.origin ?? 'manual',
  };
}

function mapBrief(row) {
  return {
    id: row.id,
    profileId: row.profile_id,
    period: row.period,
    status: row.status,
    payload: row.payload ?? null,
    source: row.source ?? null,
    model: row.model ?? null,
    generatedAt: row.generated_at,
  };
}

export async function upsertProfile(profile) {
  const { rows } = await query(
    `INSERT INTO profiles (id, name, occupation, interests)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       occupation = EXCLUDED.occupation,
       interests = EXCLUDED.interests,
       updated_at = now()
     RETURNING id, name, occupation, interests, created_at, updated_at`,
    [profile.id, profile.name ?? null, profile.occupation ?? null, JSON.stringify(profile.interests ?? [])],
  );
  const row = rows[0];
  return { ...row, interests: row.interests ?? [] };
}

export async function getProfile(id) {
  const { rows } = await query(
    'SELECT id, name, occupation, interests, created_at, updated_at FROM profiles WHERE id = $1',
    [id],
  );
  if (!rows[0]) return null;
  const row = rows[0];
  return { ...row, interests: row.interests ?? [] };
}

export async function listRecentItems({ limit = 50, type } = {}) {
  const params = [];
  let where = '';
  if (type) {
    params.push(type);
    where = `WHERE type = $${params.length}`;
  }
  params.push(Math.min(Number(limit) || 50, 200));
  const { rows } = await query(
    `SELECT ${'id, type, title, summary, source, url, published_at, city, tags, origin'}
     FROM items
     ${where}
     ORDER BY published_at DESC NULLS LAST, created_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows.map(mapItem);
}

export async function countItems() {
  const { rows } = await query('SELECT count(*)::int AS n FROM items');
  return rows[0]?.n ?? 0;
}

export async function upsertItems(items, origin = 'live') {
  let saved = 0;
  for (const item of items) {
    await query(
      `INSERT INTO items (id, type, title, summary, source, url, published_at, city, tags, origin, fetched_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, now())
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         summary = EXCLUDED.summary,
         source = EXCLUDED.source,
         url = EXCLUDED.url,
         published_at = EXCLUDED.published_at,
         city = EXCLUDED.city,
         tags = EXCLUDED.tags,
         origin = EXCLUDED.origin,
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
        origin,
      ],
    );
    saved += 1;
  }
  return saved;
}

export async function saveRankRun({ profileId = null, source, model = null, itemIds = [], durationMs = null, entries = [] }) {
  return withTransaction(async (client) => {
    const runResult = await client.query(
      `INSERT INTO rank_runs (profile_id, source, model, item_ids, duration_ms)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       RETURNING id`,
      [profileId, source, model, JSON.stringify(itemIds), durationMs],
    );
    const runId = runResult.rows[0].id;
    for (const entry of entries) {
      await client.query(
        `INSERT INTO rank_entries (run_id, item_id, position, score, reason)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (run_id, item_id) DO UPDATE SET
           position = EXCLUDED.position,
           score = EXCLUDED.score,
           reason = EXCLUDED.reason`,
        [runId, entry.itemId, entry.position, Math.round(entry.score ?? 0), entry.reason ?? ''],
      );
    }
    return runId;
  });
}

export async function addFeedback({ profileId, itemId, vote }) {
  const { rows } = await query(
    `INSERT INTO feedback (profile_id, item_id, vote)
     VALUES ($1, $2, $3)
     ON CONFLICT (profile_id, item_id) DO UPDATE SET vote = EXCLUDED.vote, created_at = now()
     RETURNING id, profile_id, item_id, vote, created_at`,
    [profileId, itemId, vote],
  );
  return rows[0];
}

export async function getBrief(profileId, period) {
  const { rows } = await query(
    `SELECT id, profile_id, period, status, payload, source, model, generated_at
     FROM briefs WHERE profile_id = $1 AND period = $2`,
    [profileId, period],
  );
  return rows[0] ? mapBrief(rows[0]) : null;
}

export async function getLatestValidBrief(profileId) {
  const { rows } = await query(
    `SELECT id, profile_id, period, status, payload, source, model, generated_at
     FROM briefs
     WHERE profile_id = $1 AND status = 'valid'
     ORDER BY generated_at DESC
     LIMIT 1`,
    [profileId],
  );
  return rows[0] ? mapBrief(rows[0]) : null;
}

export async function saveBrief({ profileId, period, status, payload = null, source = null, model = null }) {
  const { rows } = await query(
    `INSERT INTO briefs (profile_id, period, status, payload, source, model)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6)
     ON CONFLICT (profile_id, period) DO UPDATE SET
       status = EXCLUDED.status,
       payload = EXCLUDED.payload,
       source = EXCLUDED.source,
       model = EXCLUDED.model,
       generated_at = now()
     RETURNING id, profile_id, period, status, payload, source, model, generated_at`,
    [profileId, period, status, payload ? JSON.stringify(payload) : null, source, model],
  );
  return mapBrief(rows[0]);
}

export async function listChecklistTasks(briefId) {
  const { rows } = await query(
    `SELECT id, brief_id, skill_name, position, text, done, done_at
     FROM checklist_tasks
     WHERE brief_id = $1
     ORDER BY skill_name, position`,
    [briefId],
  );
  return rows.map((row) => ({
    id: row.id,
    briefId: row.brief_id,
    skillName: row.skill_name,
    position: row.position,
    text: row.text,
    done: row.done,
    doneAt: row.done_at,
  }));
}

export async function replaceChecklistTasks(briefId, tasks) {
  return withTransaction(async (client) => {
    await client.query('DELETE FROM checklist_tasks WHERE brief_id = $1', [briefId]);
    const saved = [];
    for (const task of tasks) {
      const { rows } = await client.query(
        `INSERT INTO checklist_tasks (brief_id, skill_name, position, text)
         VALUES ($1, $2, $3, $4)
         RETURNING id, brief_id, skill_name, position, text, done, done_at`,
        [briefId, task.skillName, task.position ?? 0, task.text],
      );
      const row = rows[0];
      saved.push({
        id: row.id,
        briefId: row.brief_id,
        skillName: row.skill_name,
        position: row.position,
        text: row.text,
        done: row.done,
        doneAt: row.done_at,
      });
    }
    return saved;
  });
}

export async function setChecklistTaskDone(taskId, done) {
  const { rows } = await query(
    `UPDATE checklist_tasks
     SET done = $2, done_at = CASE WHEN $2 THEN now() ELSE NULL END
     WHERE id = $1
     RETURNING id, brief_id, skill_name, position, text, done, done_at`,
    [taskId, done],
  );
  if (!rows[0]) return null;
  const row = rows[0];
  return {
    id: row.id,
    briefId: row.brief_id,
    skillName: row.skill_name,
    position: row.position,
    text: row.text,
    done: row.done,
    doneAt: row.done_at,
  };
}
