import pg from 'pg';

const { Pool } = pg;

let pool = null;

export class DbUnavailableError extends Error {
  constructor(message = 'database unavailable', cause) {
    super(message);
    this.name = 'DbUnavailableError';
    if (cause) this.cause = cause;
  }
}

const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ECONNRESET',
  'EPIPE',
  '53300',
  '57P03',
  '57P02',
  '08001',
  '08006',
  '08003',
  '08004',
  '08007',
  '28P01',
  '28000',
]);

function isConnectionError(err) {
  if (!err) return false;
  if (CONNECTION_ERROR_CODES.has(err.code)) return true;
  if (typeof err.code === 'string' && err.code.startsWith('08')) return true;
  if (err.cause && err.cause.code && CONNECTION_ERROR_CODES.has(err.cause.code)) return true;
  return false;
}

export function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  const useSsl = process.env.PG_SSL === 'true';
  pool = new Pool({
    connectionString,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    max: Number(process.env.PG_POOL_MAX || 5),
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
  });
  pool.on('error', (err) => {
    console.error('[db] idle client error:', err.message);
  });
  return pool;
}

export function isConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export async function query(text, params) {
  const active = getPool();
  if (!active) throw new DbUnavailableError('DATABASE_URL is not configured');
  try {
    return await active.query(text, params);
  } catch (err) {
    if (isConnectionError(err)) {
      throw new DbUnavailableError(`database connection failed: ${err.message}`, err);
    }
    throw err;
  }
}

export async function withTransaction(fn) {
  const active = getPool();
  if (!active) throw new DbUnavailableError('DATABASE_URL is not configured');
  let client;
  try {
    client = await active.connect();
  } catch (err) {
    if (isConnectionError(err)) throw new DbUnavailableError(`database connection failed: ${err.message}`, err);
    throw err;
  }
  try {
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* connection already broken */
    }
    if (isConnectionError(err)) throw new DbUnavailableError(`database connection failed: ${err.message}`, err);
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (!pool) return;
  const current = pool;
  pool = null;
  await current.end();
}
