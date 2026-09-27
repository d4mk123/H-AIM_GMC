import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

for (const candidate of [path.join(repoRoot, '.env'), path.join(process.cwd(), '.env')]) {
  if (existsSync(candidate)) {
    dotenv.config({ path: candidate, quiet: true });
  }
}

export { repoRoot };
