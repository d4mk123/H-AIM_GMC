import { once } from 'node:events';
import { createApp } from '../server.js';

/**
 * End-to-end smoke check: boots the app on an ephemeral port and walks the
 * advertised endpoints. Works with no database and no AI key — degraded mode
 * is part of what is being verified.
 *
 *   npm run smoke
 */

const checks = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    checks.push({ name, ok: true, detail });
  } catch (err) {
    checks.push({ name, ok: false, detail: err.message });
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  // config.js (imported via ../server.js) already loaded .env, so these
  // assignments deliberately override it: a smoke check must never spend the
  // real API key or depend on a live provider. Degraded mode is the point.
  process.env.AI_BASE_URL = 'http://127.0.0.1:9/v1';

  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    await check('GET /health', async () => {
      const res = await fetch(`${base}/health`);
      const body = await res.json();
      expect(res.status === 200 && body.status === 'ok', `unexpected status ${res.status}`);
      return `db=${body.db}`;
    });

    await check('GET / serves the frontend', async () => {
      const res = await fetch(`${base}/`);
      const type = res.headers.get('content-type') || '';
      expect(res.status === 200, `status ${res.status}`);
      expect(type.includes('text/html'), `unexpected content-type ${type}`);
      return 'index.html';
    });

    await check('GET /search returns local results', async () => {
      const res = await fetch(`${base}/search?q=ai`);
      const body = await res.json();
      expect(res.status === 200, `status ${res.status}`);
      expect(body.count > 0, 'no results');
      expect(typeof body.items[0].id === 'string', 'item has no id');
      expect(typeof body.items[0].url === 'string', 'item has no url');
      return `${body.count} items, source=${body.source}`;
    });

    await check('GET /search rejects an unknown type', async () => {
      const res = await fetch(`${base}/search?type=podcast`);
      expect(res.status === 400, `status ${res.status}`);
      return '400 as expected';
    });

    await check('POST /rank falls back deterministically', async () => {
      const res = await fetch(`${base}/rank`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profile: { id: 'smoke', occupation: 'student', interests: ['ai'] } }),
      });
      const body = await res.json();
      expect(res.status === 200, `status ${res.status}`);
      expect(body.items.length > 0, 'no ranked items');
      expect(typeof body.items[0].score === 'number', 'item has no score');
      return `${body.items.length} items, source=${body.source}`;
    });

    await check('POST /brief returns a brief with a checklist', async () => {
      const res = await fetch(`${base}/brief`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profile: { id: 'smoke', occupation: 'student', interests: ['ai'] }, force: true }),
      });
      const body = await res.json();
      expect(res.status === 200, `status ${res.status}`);
      expect(Array.isArray(body.brief?.skills) && body.brief.skills.length > 0, 'no skills');
      expect(body.brief.skills[0].checklist.length > 0, 'no checklist items');
      return `${body.brief.skills.length} skills, source=${body.source}`;
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  let failed = 0;
  for (const { name, ok, detail } of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed += 1;
  }
  console.log(failed === 0 ? `smoke: ${checks.length}/${checks.length} checks passed` : `smoke: ${failed} check(s) failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('smoke: crashed:', err);
  process.exit(1);
});
