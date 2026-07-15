import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const queryDir = new URL('../queries/', import.meta.url);
const example = new URL('../examples/showcase.vim', import.meta.url);
const queries = readdirSync(queryDir)
  .filter((name) => name.endsWith('.scm'))
  .sort();

for (const query of queries) {
  const result = spawnSync(
    process.platform === 'win32' ? 'tree-sitter.exe' : 'tree-sitter',
    ['query', join(queryDir.pathname, query), example.pathname],
    { encoding: 'utf8' },
  );

  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    throw new Error(`query validation failed: ${query}`);
  }
}

console.log(`validated ${queries.length} query files`);
