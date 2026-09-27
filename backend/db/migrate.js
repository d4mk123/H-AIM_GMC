import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { query, DbUnavailableError } from './pool.js';

const SCHEMA_PATH = fileURLToPath(new URL('./schema.sql', import.meta.url));

export async function migrate() {
  const sql = readFileSync(SCHEMA_PATH, 'utf8');
  try {
    await query(sql);
    return true;
  } catch (err) {
    if (err instanceof DbUnavailableError) {
      console.warn(`[db] schema not applied (${err.message}); running in degraded mode`);
      return false;
    }
    throw err;
  }
}
