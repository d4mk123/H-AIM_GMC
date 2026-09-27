const DEFAULT_MODEL = 'openai/gpt-oss-120b';

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
  return Boolean(process.env.GROQ_API_KEY);
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
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new ProviderError('AI provider is not configured (GROQ_API_KEY missing)', 0, { code: 'not_configured' });
  }
  const baseUrl = String(process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;
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
