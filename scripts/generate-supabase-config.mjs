import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const strict = process.argv.includes('--strict');
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(rootDir, 'src/app/config/supabase.generated.ts');
const localEnv = readLocalEnv(resolve(rootDir, '.env.local'));
const url = process.env.SUPABASE_URL ?? localEnv.SUPABASE_URL ?? '';
const publishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? localEnv.SUPABASE_PUBLISHABLE_KEY ?? '';
const missing = [
  ['SUPABASE_URL', url],
  ['SUPABASE_PUBLISHABLE_KEY', publishableKey],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missing.length > 0) {
  const message = `Missing Supabase config: ${missing.join(', ')}`;

  if (strict) {
    throw new Error(message);
  }

  console.warn(`${message}. Generated an empty local config.`);
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `export const SUPABASE_GENERATED_CONFIG = {
  url: ${JSON.stringify(url)},
  publishableKey: ${JSON.stringify(publishableKey)},
} as const;
`,
);

function readLocalEnv(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  return readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .reduce((env, line) => {
      const separatorIndex = line.indexOf('=');

      if (separatorIndex === -1) {
        return env;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line
        .slice(separatorIndex + 1)
        .trim()
        .replace(/^['"]|['"]$/gu, '');
      env[key] = value;
      return env;
    }, {});
}
