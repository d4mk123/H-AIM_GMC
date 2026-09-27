import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import cors from 'cors';
import express from 'express';
import { repoRoot } from './config.js';
import { closePool, DbUnavailableError, isConfigured as isDbConfigured } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { importSeedItems } from './db/seed.js';
import briefRouter from './routes/brief.js';
import feedbackRouter from './routes/feedback.js';
import profilesRouter from './routes/profiles.js';
import rankRouter from './routes/rank.js';
import searchRouter from './routes/search.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(express.json({ limit: '512kb' }));

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      db: isDbConfigured() ? 'configured' : 'unconfigured',
      uptimeSec: Math.round(process.uptime()),
    });
  });

  app.use(rankRouter);
  app.use(searchRouter);
  app.use(briefRouter);
  app.use(profilesRouter);
  app.use(feedbackRouter);

  const frontendDir = path.join(repoRoot, 'frontend');
  const indexPath = path.join(frontendDir, 'index.html');
  let hasUi = false;
  try {
    hasUi = existsSync(indexPath) && statSync(indexPath).size > 0;
  } catch {
    hasUi = false;
  }
  if (existsSync(frontendDir)) {
    app.use(express.static(frontendDir, { index: hasUi ? 'index.html' : false }));
  }

  app.get('/', (req, res) => {
    if (hasUi) {
      res.sendFile(indexPath);
      return;
    }
    res.json({
      service: 'nabdh-backend',
      status: 'ok',
      note: 'Frontend is not bundled yet; use the API endpoints below.',
      endpoints: [
        { method: 'GET', path: '/health', purpose: 'liveness and database configuration' },
        { method: 'POST', path: '/rank', purpose: 'rank feed items for a profile' },
        { method: 'GET', path: '/search', purpose: 'live search with seed fallback' },
        { method: 'POST', path: '/brief', purpose: 'weekly career brief' },
        { method: 'POST', path: '/profiles', purpose: 'create or update a profile' },
        { method: 'GET', path: '/profiles/:id', purpose: 'fetch a profile' },
        { method: 'POST', path: '/feedback', purpose: 'record up/down feedback for an item' },
      ],
    });
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'not found' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'malformed JSON body' });
      return;
    }
    if (err.status === 400) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof DbUnavailableError) {
      res.status(503).json({ error: 'database unavailable', detail: err.message });
      return;
    }
    console.error('[server] unhandled error:', err);
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}

export async function bootstrap({ listen = true } = {}) {
  const schemaReady = await migrate();
  if (schemaReady) {
    const imported = await importSeedItems();
    console.log(`[db] schema ready; ${imported} seed items upserted`);
  }

  const app = createApp();
  if (!listen) return { app };

  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, () => {
    console.log(`[server] nabdh-backend listening on http://localhost:${port}`);
  });

  const shutdown = (signal) => {
    console.log(`[server] ${signal} received, shutting down`);
    server.close(async () => {
      await closePool().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  return { app, server };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  bootstrap().catch((err) => {
    console.error('[server] failed to start:', err);
    process.exit(1);
  });
}
