-- Nabdh PostgreSQL schema. Idempotent: safe to run on every boot.

CREATE TABLE IF NOT EXISTS profiles (
  id          TEXT PRIMARY KEY,
  name        TEXT,
  occupation  TEXT,
  interests   JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS items (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL CHECK (type IN ('news', 'job', 'internship', 'event')),
  title        TEXT NOT NULL,
  summary      TEXT NOT NULL DEFAULT '',
  source       TEXT NOT NULL DEFAULT '',
  url          TEXT NOT NULL DEFAULT '',
  published_at TEXT,
  city         TEXT,
  tags         JSONB NOT NULL DEFAULT '[]'::jsonb,
  origin       TEXT NOT NULL DEFAULT 'seed' CHECK (origin IN ('seed', 'live', 'manual')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  fetched_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS items_published_at_idx ON items (published_at DESC);
CREATE INDEX IF NOT EXISTS items_type_idx ON items (type);

CREATE TABLE IF NOT EXISTS rank_runs (
  id          BIGSERIAL PRIMARY KEY,
  profile_id  TEXT,
  source      TEXT NOT NULL CHECK (source IN ('model', 'fallback')),
  model       TEXT,
  item_ids    JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration_ms INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rank_entries (
  run_id   BIGINT NOT NULL REFERENCES rank_runs(id) ON DELETE CASCADE,
  item_id  TEXT NOT NULL,
  position INTEGER NOT NULL,
  score    INTEGER NOT NULL DEFAULT 0,
  reason   TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (run_id, item_id)
);

CREATE TABLE IF NOT EXISTS feedback (
  id         BIGSERIAL PRIMARY KEY,
  profile_id TEXT NOT NULL,
  item_id    TEXT NOT NULL,
  vote       TEXT NOT NULL CHECK (vote IN ('up', 'down')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, item_id)
);

CREATE TABLE IF NOT EXISTS briefs (
  id           BIGSERIAL PRIMARY KEY,
  profile_id   TEXT NOT NULL,
  period       TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('valid', 'unavailable')),
  payload      JSONB,
  source       TEXT CHECK (source IN ('model', 'stale')),
  model        TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, period)
);

CREATE INDEX IF NOT EXISTS briefs_profile_idx ON briefs (profile_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS checklist_tasks (
  id         BIGSERIAL PRIMARY KEY,
  brief_id   BIGINT NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  text       TEXT NOT NULL,
  done       BOOLEAN NOT NULL DEFAULT FALSE,
  done_at    TIMESTAMPTZ,
  UNIQUE (brief_id, skill_name, position)
);
