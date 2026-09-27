<div align="center">

# Nabdh

### The pulse of Tunisian tech, personalized.

Nabdh brings Tunisian technology news, jobs, internships, and events into one feed, ranked around each user's interests.

![Status](https://img.shields.io/badge/status-prototype-orange)

</div>

## About

Tech opportunities in Tunisia are spread across job boards, social networks, community groups, and event pages. Nabdh is designed to make that information easier to discover by combining local content with lightweight, profile-based personalization.

Users choose their occupation and interests, then receive a feed containing:

- Technology news
- Jobs and internships
- Technology events

Each item includes a short explanation of why it was recommended. Feedback can be used to improve future rankings, while automatic refresh keeps the feed current.

## Weekly career brief

Nabdh also turns the latest technology signals into a practical weekly report. It highlights emerging technologies, identifies skills that could strengthen a user's profile, and explains why they may be valuable for future opportunities.

For each recommended skill, the report provides:

- A personalized learning roadmap
- Suggested milestones and projects
- A clear checklist for tracking progress
- Links between the skill, the user's interests, and relevant opportunities

## Product flow

1. Create a profile with an occupation and interest tags.
2. Collect Tunisia-focused content from supported search sources.
3. Rank items according to the user's profile and recent feedback.
4. Display the feed with a relevance explanation for every item.
5. Generate a weekly brief covering emerging technologies and high-value skills.
6. Turn selected skills into a roadmap and progress checklist.
7. Refresh the feed automatically at the configured interval.

## Architecture

```text
/frontend
  index.html          Profile setup and feed UI; loads the js/ modules in order
  styles.css           Application styles
  js/                  Client modules (plain scripts sharing globals — order matters)
    constants.js         Config, static data, formatDate/escapeHtml helpers
    state.js             Application state
    dom.js               DOM references
    ui-widgets.js        Custom selects and interest grids
    auth.js              Auth and screen transitions
    ai-ranking.js        Calls POST /rank on the backend; offline tag fallback if it is down
    card-detail.js       Item detail popup
    feed.js              Feed rendering, card actions, auto-sync
    bootstrap.js         Launch feed and boot sequence
  seed_items.json      Local fallback content
  app.js               Legacy single-file bundle; superseded by js/ (not loaded)

/backend
  server.js            Application server and route mounting
  ai_client.js         Server-side model integration (ranking + brief)
  config.js            Loads .env from the repository root
  routes/search.js     Search integration and fallback handling
  routes/rank.js       Ranking endpoint
  routes/brief.js      Weekly career brief endpoint
  routes/profiles.js   Profile create and read
  routes/feedback.js   Up/down feedback per item
  lib/                 Shared helpers: item shape, tag overlap, brief fallback, cache
  db/                  Schema, migrations, connection pool, repository, seed import
  scripts/smoke.js     End-to-end smoke checkpoint
  test/                node:test suites
```

The search layer can fall back to local seed data when an external source is unavailable. The ranking layer also has a deterministic fallback so the feed can remain usable when an AI provider is unavailable or returns invalid data, and the brief follows the same rule: if the model cannot answer, the most recent valid brief is served when there is one, otherwise a deterministic brief is built from the items and the profile interests.

## AI and personalization

The ranking service receives a user profile and a set of content items, then returns an ordered list with a concise reason for each result. A separate briefing flow connects technology trends to the user's goals and produces skill recommendations, learning steps, and checklist items. Feedback can adjust the importance of interest tags over time.

API keys belong on the server and should be provided through environment variables. Never commit `.env` files or credentials to the repository.

## Configuration

All configuration is read from environment variables. Copy `.env.example` to `.env` and fill in the values; the file is ignored by git.

| Variable | Purpose |
| --- | --- |
| `NVIDIA_API_KEY` | NVIDIA NIM key used for ranking and the weekly brief. Optional in local dev — deterministic fallbacks are used when absent. |
| `NVIDIA_MODEL` | Model id sent to the AI provider (default `nvidia/nemotron-3-ultra-550b-a55b`). |
| `GROQ_API_KEY` / `GROQ_MODEL` | Alternative provider, used only when `NVIDIA_API_KEY` is empty (`GROQ_MODEL` defaults to `openai/gpt-oss-120b`). |
| `AI_BASE_URL` | AI provider base URL; inferred from the key that is set (NVIDIA unless only a Groq key is present), override for a mock. |
| `AI_TIMEOUT_MS` | Timeout for model calls (default 8000; `.env` uses 60000). |
| `DATABASE_URL` | PostgreSQL connection string (local Docker, Render, or Guepard at the hackathon). |
| `PG_SSL` | Set to `true` when the database requires TLS. |
| `SEARCH_PROVIDER` | `none`, `tavily`, or `serper`. |
| `TAVILY_API_KEY` / `SERPER_API_KEY` | Search provider keys; only needed for live search. |
| `SEARCH_TIMEOUT_MS` | Live search timeout; local data is returned on timeout. |
| `SEARCH_CACHE` / `SEARCH_CACHE_TTL_MS` | Response cache for `/search` (set `SEARCH_CACHE=0` to disable). |
| `RANK_CACHE` / `RANK_CACHE_TTL_MS` | Response cache for `/rank` (set `RANK_CACHE=0` to disable). |
| `RANK_PRE_FILTER_LIMIT` | Items sent to the model by `/rank`; the rest is ordered by tag overlap (default 30, `.env` uses 12). |
| `BRIEF_ITEM_LIMIT` | Items sent to the model by `/brief` (default 12). |
| `RANK_FORCE_FALLBACK` / `BRIEF_FORCE_FALLBACK` | Set to `1` to skip the model and use the deterministic path. |
| `PORT` | HTTP port. |
| `CORS_ORIGIN` | Allowed CORS origin (`*` by default). |

## Local development

```bash
docker compose up -d            # local PostgreSQL 16
cd backend && npm install
cp ../.env.example ../.env      # fill in keys
npm run dev                     # http://localhost:3000
npm test                        # unit + integration tests
npm run smoke                   # end-to-end checkpoint script
```

Database schema is applied automatically at startup, and `frontend/seed_items.json` is imported as fallback content on first boot.

## Deployment

The backend is deployable as a single service: it serves the API and (once built) the frontend from the same process.

- `render.yaml` — Render blueprint: build `npm ci --prefix backend`, start `node backend/server.js`. Set `GROQ_API_KEY` and `DATABASE_URL` as secret environment variables in the dashboard.
- `Dockerfile` — container build for any other host (including the hackathon's setup).
- Database: any PostgreSQL via `DATABASE_URL` (local Docker, Render Postgres, or a Guepard deployment).

## Project status

Nabdh is an early prototype. The current direction focuses on the personalized feed and weekly career brief. Future work includes production source integrations, richer feedback signals, scheduled backend refreshes, progress tracking, and broader regional coverage.

## Contributing

Issues and pull requests are welcome. For larger changes, please open an issue first to discuss the proposed direction.
