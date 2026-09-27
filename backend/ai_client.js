const DEFAULT_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b';
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';

export class ProviderError extends Error {
  constructor(message, status = 0, extra = {}) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
    Object.assign(this, extra);
  }
}

export class RateLimitError extends ProviderError {
  constructor(message = 'AI provider rate limited the request') {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

export class MalformedResponseError extends Error {
  constructor(message = 'AI provider returned an unusable response') {
    super(message);
    this.name = 'MalformedResponseError';
  }
}

export function isConfigured() {
  return Boolean(process.env.NVIDIA_API_KEY || process.env.GROQ_API_KEY);
}

// Without an explicit AI_BASE_URL the provider is inferred from the key that is
// set, so a Groq-only .env works without also configuring the endpoint.
function defaultBaseUrl() {
  return !process.env.NVIDIA_API_KEY && process.env.GROQ_API_KEY
    ? 'https://api.groq.com/openai/v1'
    : 'https://integrate.api.nvidia.com/v1';
}

// Provider first: a Groq endpoint must not be sent an NVIDIA model id (404).
function resolveModel(baseUrl) {
  const onGroq = baseUrl.includes('groq.com');
  const explicit = onGroq
    ? process.env.GROQ_MODEL || process.env.AI_MODEL || process.env.NVIDIA_MODEL
    : process.env.NVIDIA_MODEL || process.env.AI_MODEL || process.env.GROQ_MODEL;
  if (explicit) return explicit;
  return onGroq ? DEFAULT_GROQ_MODEL : DEFAULT_MODEL;
}

// Keep this system prompt stable: it is the caching anchor on provider side.
const SYSTEM_RANK_PROMPT = `You are Nabdh, the ranking engine of a Tunisian technology feed covering news, jobs, internships, and events.
Given one user profile and a list of items, order the items from most to least relevant for that user.
Rules:
- Use only the profile occupation/interests and the item fields provided. Do not invent items.
- Every input item id must appear exactly once in the output.
- Score is an integer from 0 to 100 where higher means more relevant to this profile.
- The reason is shown to the user as "why you see this": one short, concrete sentence that mentions the matching interest tags when they match.
- Respond with JSON only, in exactly this shape: {"rankings":[{"id":"item-id","score":85,"reason":"..."}]}`;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function truncate(text, max) {
  const value = String(text ?? '');
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function stripCodeFences(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

function parseLooseJson(content) {
  const candidates = [stripCodeFences(content)];
  const first = content.indexOf('{');
  const last = content.lastIndexOf('}');
  if (first !== -1 && last > first) {
    candidates.push(content.slice(first, last + 1));
  }
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* try next candidate */
    }
  }
  throw new MalformedResponseError('AI response is not valid JSON');
}

export async function chatJson(messages, { jsonMode = false } = {}) {
  const apiKey = process.env.NVIDIA_API_KEY || process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new ProviderError('AI provider is not configured (NVIDIA_API_KEY or GROQ_API_KEY missing)', 0, { code: 'not_configured' });
  }
  const baseUrl = String(process.env.AI_BASE_URL || defaultBaseUrl()).replace(/\/+$/, '');
  const model = resolveModel(baseUrl);
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS || 8000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ProviderError(`AI provider timed out after ${timeoutMs}ms`, 0, { code: 'timeout' });
    }
    throw new ProviderError(`AI provider unreachable: ${err.message}`, 0, { code: 'unreachable' });
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 429) {
    throw new RateLimitError();
  }
  if (!response.ok) {
    const detail = truncate(await response.text().catch(() => ''), 300);
    throw new ProviderError(`AI provider returned ${response.status}: ${detail}`, response.status);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new MalformedResponseError('AI provider returned invalid JSON');
  }

  // Only message content is used; provider reasoning fields are ignored by design.
  const message = data?.choices?.[0]?.message;
  const content = typeof message?.content === 'string' ? message.content.trim() : '';
  if (!content) {
    throw new MalformedResponseError('AI response is missing choices[0].message.content');
  }
  return { content, model: data?.model || model };
}

export async function rankItems(profile = {}, items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return { model: null, rankings: [] };
  }

  const payload = {
    profile: {
      occupation: profile.occupation ?? null,
      interests: Array.isArray(profile.interests) ? profile.interests : [],
    },
    items: items.map((item) => ({
      id: item.id,
      type: item.type,
      title: truncate(item.title, 200),
      summary: truncate(item.summary, 240),
      tags: item.tags ?? [],
      city: item.city ?? null,
      publishedAt: item.publishedAt ?? null,
    })),
  };

  const { content, model } = await chatJson(
    [
      { role: 'system', content: SYSTEM_RANK_PROMPT },
      { role: 'user', content: JSON.stringify(payload) },
    ],
    { jsonMode: true },
  );

  const parsed = parseLooseJson(content);
  const raw = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.rankings)
      ? parsed.rankings
      : null;
  if (!raw) {
    throw new MalformedResponseError('AI ranking response has no rankings array');
  }

  const itemById = new Map(items.map((item) => [item.id, item]));
  const seen = new Set();
  const ordered = [];

  for (const entry of raw) {
    if (!entry || typeof entry.id !== 'string') continue;
    const item = itemById.get(entry.id);
    if (!item || seen.has(entry.id)) continue;
    seen.add(entry.id);
    const rawScore = Number(entry.score);
    ordered.push({
      id: entry.id,
      score: Number.isFinite(rawScore) ? Math.round(clamp(rawScore, 0, 100)) : null,
      reason: typeof entry.reason === 'string' && entry.reason.trim()
        ? entry.reason.trim()
        : 'Ranked by the model for your profile.',
    });
  }

  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    ordered.push({ id: item.id, score: null, reason: 'Added after ranking — not scored by the model.' });
  }

  ordered.forEach((entry, index) => {
    if (entry.score === null) {
      entry.score = Math.max(5, 70 - index * 3);
    }
  });

  return { model, rankings: ordered };
}

// Keep this system prompt stable: it is the caching anchor on provider side.
const SYSTEM_BRIEF_PROMPT = `You are Nabdh, the weekly career-briefing engine of a Tunisian technology feed.
Given one user profile and this week's content items, produce a practical weekly brief.

Rules:
- Use only the profile and the item fields provided. Do not invent items or facts.
- trends: 3 to 6 objects {"tag":"...","mentions":<integer>} derived from the items.
- skills: 3 to 6 objects a reader could act on this week, each shaped as:
  {"name":"...","why":"one sentence tied to the profile interests","interests":["..."],
   "sources":["item id"],"roadmap":["4 to 6 ordered concrete steps"],
   "milestones":["2 to 4 checkpoints"],"checklist":["3 to 5 short trackable tasks"]}
- "interests" must reuse profile interest tags when they match; "sources" must be real item ids.
- headline: one sentence summarising the week for this profile.
- Respond with JSON only, in exactly this shape:
{"headline":"...","trends":[{"tag":"ai","mentions":4}],"skills":[{"name":"...","why":"...","interests":[],"sources":[],"roadmap":[],"milestones":[],"checklist":[]}]}`;

function stringList(value, maxItems, maxLen) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !entry.trim()) continue;
    out.push(entry.trim().slice(0, maxLen));
    if (out.length >= maxItems) break;
  }
  return out;
}

function normalizeBrief(raw, period) {
  if (!raw || typeof raw !== 'object') {
    throw new MalformedResponseError('AI brief response is not an object');
  }

  const skills = (Array.isArray(raw.skills) ? raw.skills : [])
    .filter((entry) => entry && typeof entry === 'object' && typeof entry.name === 'string' && entry.name.trim())
    .slice(0, 6)
    .map((entry) => ({
      name: entry.name.trim().slice(0, 120),
      why: typeof entry.why === 'string' ? entry.why.trim().slice(0, 400) : '',
      interests: stringList(entry.interests, 10, 60),
      sources: stringList(entry.sources, 10, 120),
      roadmap: stringList(entry.roadmap, 8, 200),
      milestones: stringList(entry.milestones, 5, 200),
      checklist: stringList(entry.checklist, 6, 160),
    }));

  if (skills.length === 0) {
    throw new MalformedResponseError('AI brief response has no usable skills');
  }

  const trends = (Array.isArray(raw.trends) ? raw.trends : [])
    .filter((entry) => entry && typeof entry.tag === 'string' && entry.tag.trim())
    .slice(0, 6)
    .map((entry) => ({
      tag: entry.tag.trim().slice(0, 60),
      mentions: Number.isFinite(Number(entry.mentions)) ? Math.max(0, Math.round(Number(entry.mentions))) : 0,
    }));

  return {
    period,
    headline: typeof raw.headline === 'string' && raw.headline.trim()
      ? raw.headline.trim().slice(0, 300)
      : 'Your weekly Nabdh brief',
    trends,
    skills,
  };
}

export async function generateBrief(profile = {}, items = [], period = '') {
  const payload = {
    period,
    profile: {
      occupation: profile.occupation ?? null,
      interests: Array.isArray(profile.interests) ? profile.interests : [],
    },
    items: items.map((item) => ({
      id: item.id,
      type: item.type,
      title: truncate(item.title, 200),
      summary: truncate(item.summary, 240),
      tags: item.tags ?? [],
      publishedAt: item.publishedAt ?? null,
    })),
  };

  const { content, model } = await chatJson(
    [
      { role: 'system', content: SYSTEM_BRIEF_PROMPT },
      { role: 'user', content: JSON.stringify(payload) },
    ],
    { jsonMode: true },
  );

  return { brief: normalizeBrief(parseLooseJson(content), period), model };
}
