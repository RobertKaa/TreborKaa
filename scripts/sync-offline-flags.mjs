import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();
const snapshotPath = path.join(projectRoot, 'public', 'data', 'rest-countries.snapshot.json');
const outputDirectory = path.join(projectRoot, 'public', 'data', 'flags');
const concurrency = 8;

const countries = JSON.parse(await readFile(snapshotPath, 'utf8'));
const codes = [
  ...new Set(
    countries
      .map((country) => country.cca2?.toLowerCase())
      .filter((code) => typeof code === 'string' && /^[a-z]{2}$/u.test(code)),
  ),
].sort();

await mkdir(outputDirectory, { recursive: true });

let nextIndex = 0;
let downloadedCount = 0;

async function fileIsReady(filePath) {
  try {
    return (await stat(filePath)).size > 0;
  } catch {
    return false;
  }
}

async function downloadFlag(code) {
  const outputPath = path.join(outputDirectory, `${code}.png`);
  if (await fileIsReady(outputPath)) {
    return;
  }

  const response = await fetch(`https://flagcdn.com/w320/${code}.png`);
  if (!response.ok) {
    throw new Error(`Unable to download flag ${code}: HTTP ${response.status}`);
  }

  const content = Buffer.from(await response.arrayBuffer());
  if (content.length === 0) {
    throw new Error(`Unable to download flag ${code}: empty response`);
  }

  await writeFile(outputPath, content);
  downloadedCount += 1;
}

const workers = Array.from({ length: Math.min(concurrency, codes.length) }, async () => {
  while (nextIndex < codes.length) {
    const index = nextIndex;
    nextIndex += 1;
    await downloadFlag(codes[index]);
  }
});

await Promise.all(workers);
console.log(`Offline flags ready: ${codes.length} total, ${downloadedCount} downloaded.`);
